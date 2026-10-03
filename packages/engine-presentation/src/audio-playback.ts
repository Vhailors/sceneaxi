/** Injected Web Audio seam. Importing this module never constructs audio output. */
export type AudioBufferLike = object;

/** The injected host owns its connection result; playback deliberately ignores it. */
export type AudioNodeLike<ConnectionResult = unknown> = Readonly<{
    connect(destination: AudioNodeLike): ConnectionResult;
}>;

export type ModernAudioContextLike = Readonly<{
    destination: AudioNodeLike;
    decodeAudioData(bytes: ArrayBuffer): Promise<AudioBufferLike>;
    createGain(): AudioNodeLike & Readonly<{
        gain: {
            value: number;
        };
    }>;
    createBufferSource(): AudioNodeLike & {
        buffer: AudioBufferLike | null;
        onended: (() => void) | null;
        start(): void;
        stop(): void;
    };
    observeMasterGain?(gain: AudioNodeLike): AudioNodeLike;
    measureOutputRms?(): number;
    close(): Promise<void>;
}>;

/** Gesture-only, offline PCM WAV playback. No URLs, provider calls or autoplay. */
import { snapshotPlainRecord } from "@sceneaxi/schemas";

export type AudioConnectionTarget = AudioGainPort | AudioDestinationPort | AudioGainLike | AudioOutputDestination;

export type AudioDestinationPort = {
    readonly channelCount?: number;
    readonly channelCountMode?: string;
};

type BrowserAudioHost = {
    AudioContext?: new () => AudioContextPort;
};

export type AudioBufferPort = {
    copyToChannel(data: Float32Array, channel: number): void;
};

export type AudioGainPort = {
    gain: {
        value: number;
    };
    connect(target: AudioConnectionTarget): void;
    disconnect(): void;
};

export type AudioSourcePort = {
    buffer: AudioBufferPort | null;
    onended: (() => void) | null;
    connect(target: AudioConnectionTarget): void;
    disconnect(): void;
    start(): void;
    stop(): void;
};

export type AudioContextPort = {
    readonly destination: AudioConnectionTarget;
    readonly state: string;
    createBuffer(channels: number, frames: number, sampleRate: number): AudioBufferPort;
    createGain(): AudioGainPort;
    createBufferSource(): AudioSourcePort;
    resume(): Promise<void>;
    close(): Promise<void>;
};

export type ContainedAudioAsset = Readonly<{
    assetId: string;
    bytes: Uint8Array;
}>;

export interface AudioPlaybackRuntime {
    unlock(userGesture: boolean): Promise<void>;
    play(asset: Parameters<typeof snapshotPlainRecord>[0]): number;
    stop(handle?: number): void;
    setVolume(volume: number): void;
    setVisible(visible: boolean): void;
    activeSources(): number;
    dispose(): Promise<void>;
}

export class AudioPlaybackError extends Error {
    constructor(readonly code: "AUDIO_REFUSED" | "AUDIO_GESTURE_REQUIRED" | "AUDIO_UNAVAILABLE", message: string) { super(message); this.name = "AudioPlaybackError"; }
}

function refuse(message: string): never { throw new AudioPlaybackError("AUDIO_REFUSED", message); }

/** Strict RIFF/WAVE PCM16 admission, fully checked before any audio allocation. */
function decodeWav(bytes: Uint8Array) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 44 || bytes.byteLength > 8 * 1024 * 1024)
        return refuse("Invalid bounded WAV bytes.");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));

    if (tag(0) !== "RIFF" || tag(8) !== "WAVE" || view.getUint32(4, true) + 8 !== bytes.length)
        return refuse("Invalid RIFF envelope.");
    let channels = 0, sampleRate = 0, dataOffset = -1, dataLength = 0;
    let format = false;

    for (let offset = 12; offset < bytes.length;) {
        if (offset + 8 > bytes.length)
            return refuse("Truncated WAV chunk.");
        const length = view.getUint32(offset + 4, true);
        const start = offset + 8;

        if (length > bytes.length - start)
            return refuse("Truncated WAV data.");

        if (tag(offset) === "fmt ") {
            if (format || length !== 16 || view.getUint16(start, true) !== 1 || view.getUint16(start + 14, true) !== 16)
                return refuse("Only canonical PCM16 WAV is supported.");
            channels = view.getUint16(start + 2, true);
            sampleRate = view.getUint32(start + 4, true);

            if ((channels !== 1 && channels !== 2) || sampleRate < 8000 || sampleRate > 96000 || view.getUint16(start + 12, true) !== channels * 2 || view.getUint32(start + 8, true) !== sampleRate * channels * 2)
                return refuse("Invalid WAV format.");
            format = true;
        }
        else if (tag(offset) === "data") {
            if (dataOffset !== -1)
                return refuse("Duplicate WAV data.");
            dataOffset = start;
            dataLength = length;
        }

        offset = start + length + (length % 2);

        if (offset > bytes.length)
            return refuse("Missing WAV chunk padding.");
    }

    if (!format || dataOffset < 0 || dataLength === 0 || dataLength % (channels * 2) !== 0)
        return refuse("Invalid WAV frame data.");
    const frames = dataLength / (channels * 2);

    if (frames > sampleRate * 60)
        return refuse("Audio duration exceeds 60 seconds.");

    return { channels, sampleRate, frames, dataOffset, view };
}

function browserContext(): AudioContextPort {
    // SAFETY: the browser-provided AudioContext constructor implements the Web Audio operations in AudioContextPort; absence is refused below.
    const host = globalThis as BrowserAudioHost;

    if (!host.AudioContext)
        throw new AudioPlaybackError("AUDIO_UNAVAILABLE", "Web Audio is unavailable.");

    return new host.AudioContext();
}

export function createAudioPlaybackRuntime(options: Readonly<{
    profile: "game" | "web";
    createContext?: () => AudioContextPort;
}>): AudioPlaybackRuntime {
    if (!options || (options.profile !== "game" && options.profile !== "web"))
        return refuse("Audio profile is not admitted; Kids refuses.");
    let context: AudioContextPort | null = null;
    let unlocked = false, disposed = false, visible = true, volume = 1, serial = 0;
    let unlocking: Promise<void> | null = null;

    const active = new Map<number, {
        source: AudioSourcePort;
        gain: AudioGainPort;
    }>();

    const live = () => {
        if (disposed)
            return refuse("Audio runtime is disposed.");
    };

    const release = (handle: number) => {
        const item = active.get(handle);

        if (!item)
            return;
        active.delete(handle);
        item.source.onended = null;

        try {
            item.source.disconnect();
        }
        finally {
            item.gain.disconnect();
        }
    };

    const stop = (handle?: number) => {
        const errors: unknown[] = [];

        for (const id of handle === undefined ? [...active.keys()] : [handle]) {
            const item = active.get(id);

            if (!item)
                continue;

            try {
                item.source.stop();
            }
            catch (error) {
                errors.push(error);
            }

            try {
                release(id);
            }
            catch (error) {
                errors.push(error);
            }
        }

        if (errors.length > 0)
            throw new AudioPlaybackError("AUDIO_UNAVAILABLE", "Audio host cleanup failed after releasing all owned sources.");
    };

    return Object.freeze({
        async unlock(userGesture: boolean) {
            live();

            if (userGesture !== true)
                throw new AudioPlaybackError("AUDIO_GESTURE_REQUIRED", "Unlock needs an explicit user interaction.");

            if (unlocking)
                return unlocking;
            context ??= (options.createContext ?? browserContext)();
            const ctx = context;
            unlocking = ctx.resume().then(() => {
                if (disposed)
                    return refuse("Audio runtime was disposed during unlock.");

                if (ctx.state !== "running")
                    throw new AudioPlaybackError("AUDIO_GESTURE_REQUIRED", "Audio context is not running.");
                unlocked = true;
            }).finally(() => { unlocking = null; });

            return unlocking;
        },
        play(asset: Parameters<typeof snapshotPlainRecord>[0]) {
            live();

            if (!unlocked || context?.state !== "running")
                throw new AudioPlaybackError("AUDIO_GESTURE_REQUIRED", "Audio has not been unlocked.");

            if (!visible || active.size >= 16)
                return refuse("Audio is hidden or source capacity exceeded.");
            const record = snapshotPlainRecord(asset);
            const assetId = record?.["assetId"], bytes = record?.["bytes"];

            if (!record || !isAssetId(assetId) || !/^[a-z0-9][a-z0-9-]{0,127}$/.test(assetId) || !(bytes instanceof Uint8Array))
                return refuse("Invalid contained audio asset id or bytes.");
            const pcm = decodeWav(bytes);
            const buffer = context.createBuffer(pcm.channels, pcm.frames, pcm.sampleRate);

            for (let channel = 0; channel < pcm.channels; channel++) {
                const data = new Float32Array(pcm.frames);

                for (let frame = 0; frame < pcm.frames; frame++)
                    data[frame] = pcm.view.getInt16(pcm.dataOffset + (frame * pcm.channels + channel) * 2, true) / 32768;
                buffer.copyToChannel(data, channel);
            }

            const source = context.createBufferSource();
            let gain: AudioGainPort | null = null;
            const handle = ++serial;

            try {
                gain = context.createGain();
                source.buffer = buffer;
                gain.gain.value = volume;
                active.set(handle, { source, gain });
                source.onended = () => release(handle);
                source.connect(gain);
                gain.connect(context.destination);
                source.start();

                return handle;
            }
            catch (error) {
                active.delete(handle);
                source.onended = null;

                // A host may throw after starting: stop and release every allocated node.
                // Cleanup failures must not replace the original admission/start failure.
                try {
                    source.stop();
                }
                catch { /* A not-yet-started source may refuse stop. */ }

                try {
                    source.disconnect();
                }
                catch { /* Continue releasing the gain. */ }

                try {
                    gain?.disconnect();
                }
                catch { /* Preserve the original host failure. */ }

                throw error;
            }
        },
        stop(handle?: number) { live(); stop(handle); },
        setVolume(value: number) {
            live();

            if (!Number.isFinite(value) || value < 0 || value > 1)
                return refuse("Volume must be in 0..1.");
            volume = value;

            for (const item of active.values())
                item.gain.gain.value = volume;
        },
        setVisible(value: boolean) {
            live();

            if (!isVisibility(value))
                return refuse("Visibility must be boolean.");
            visible = value;

            if (!visible)
                stop();
        },
        activeSources: () => active.size,
        async dispose() {
            if (disposed)
                return;
            disposed = true;
            unlocked = false;

            try {
                stop();
            }
            finally {
                const ctx = context;
                context = null;

                if (ctx)
                    await ctx.close();
            }
        },
    });
}

function isAssetId<Input>(value: Input): value is Input & string {
    return typeof value === "string";
}

function isVisibility(value: boolean): value is boolean {
    return typeof value === "boolean";
}

// The tagged v1 host and untagged modern host remain distinct checked adapters.
export type AudioOutputDestination = Readonly<{
    kind: "audio-output";
    target: object;
}>;

export type AudioGainLike = {
    kind: "audio-gain";
    gain: {
        value: number;
    };
    connect(destination: AudioOutputDestination): void;
};

export type AudioSourceLike = {
    buffer: AudioBufferLike | null;
    connect(destination: AudioGainLike | AudioOutputDestination): void;
    start(): void;
    stop(): void;
    onended: (() => void) | null;
};

export type LegacyAudioContextLike = {
    readonly destination: AudioOutputDestination;
    decodeAudioData(bytes: ArrayBuffer): Promise<AudioBufferLike>;
    createBufferSource(): AudioSourceLike;
    createGain(): AudioGainLike;
    close(): Promise<void>;
};

// Keep the main public name structurally unchanged; v1 hosts enter only the object adapter.
export type AudioContextLike = ModernAudioContextLike;

type CompatibleAudioContextLike = AudioContextLike | LegacyAudioContextLike;

export type AudioPlaybackPort = Readonly<{
    load(name: string, bytes: Uint8Array): Promise<void>;
    play(name: string): Promise<void>;
    stop(name: string): void;
    setMasterVolume(volume: number): void;
    dispose(): Promise<void>;
}>;

export type ModernAudioPlaybackPort = Readonly<{
    load(name: string, bytes: Uint8Array): Promise<void>;
    play(name: string): void;
    stop(name: string): void;
    stopAll(): void;
    setVolume(value: number): void;
    setMasterVolume(value: number): void;
    measureOutputRms(): number;
    dispose(): Promise<void>;
}>;

function legacyContext(context: CompatibleAudioContextLike): context is LegacyAudioContextLike {
    return "kind" in context.destination && context.destination.kind === "audio-output";
}

function adaptContext(context: CompatibleAudioContextLike): ModernAudioContextLike {
    if (!legacyContext(context))
        return context;
    const destination: AudioNodeLike = { connect() { throw new Error("AUDIO_NODE_INVALID"); } };
    const gains = new WeakMap<AudioNodeLike, AudioGainLike>();

    return { destination, decodeAudioData: bytes => context.decodeAudioData(bytes), close: () => context.close(), createGain() {
            const gain = context.createGain();

            const facade = { gain: gain.gain, connect(target: AudioNodeLike) {
                    if (target !== destination)
                        throw new Error("AUDIO_NODE_INVALID");
                    gain.connect(context.destination);
                } };

            gains.set(facade, gain);

            return facade;
        }, createBufferSource() {
            const source = context.createBufferSource();

            return { get buffer() { return source.buffer; }, set buffer(v) { source.buffer = v; }, get onended() { return source.onended; }, set onended(v) { source.onended = v; }, connect(target: AudioNodeLike) {
                    const gain = gains.get(target);

                    if (gain)
                        source.connect(gain);
                    else if (target === destination)
                        source.connect(context.destination);
                    else
                        throw new Error("AUDIO_NODE_INVALID");
                }, start: () => source.start(), stop: () => source.stop() };
        } };
}

export function createAudioPlaybackPort(input: Readonly<{
    createAudioContext: () => CompatibleAudioContextLike;
    kids?: boolean;
}>): AudioPlaybackPort;
export function createAudioPlaybackPort(input: () => AudioContextLike): ModernAudioPlaybackPort;
export function createAudioPlaybackPort(input: (() => AudioContextLike) | Readonly<{
    createAudioContext: () => CompatibleAudioContextLike;
    kids?: boolean;
}>): AudioPlaybackPort | ModernAudioPlaybackPort {
    const historical = !isAudioContextFactory(input);

    if (historical && input.kids)
        throw new Error("AUDIO_KIDS_DENIED");
    const context = adaptContext((isAudioContextFactory(input) ? input : input.createAudioContext)());
    const gain = context.createGain();
    gain.connect(context.observeMasterGain?.(gain) ?? context.destination);
    const buffers = new Map<string, AudioBufferLike>();
    const sources = new Map<string, ReturnType<ModernAudioContextLike["createBufferSource"]>>();
    const generations = new Map<string, number>();
    let epoch = 0, disposed = false;

    const live = () => {
        if (disposed)
            throw new Error(historical ? "AUDIO_PORT_DISPOSED" : "AUDIO_CONTEXT_DISPOSED");
    };

    const invalidate = (name: string) => { generations.set(name, (generations.get(name) ?? 0) + 1); };

    const stopSource = (name: string) => {
        const source = sources.get(name);
        sources.delete(name);

        if (source) {
            source.onended = null;
            source.stop();
        }
    };

    const stopAll = () => {
        epoch++;
        const errors: unknown[] = [];

        for (const name of sources.keys()) {
            try {
                stopSource(name);
            }
            catch (error) {
                errors.push(error);
            }
        }

        if (errors.length)
            throw errors[0];
    };

    const setVolume = (value: number) => {
        live();

        if (!Number.isFinite(value) || value < 0 || value > 1)
            throw new Error("AUDIO_VOLUME_INVALID");
        gain.gain.value = value;
    };

    const play = (name: string) => {
        live();
        const buffer = buffers.get(name);

        if (buffer === undefined)
            throw new Error(historical ? "AUDIO_CLIP_UNKNOWN" : "AUDIO_CLIP_UNKNOWN:" + name);
        stopSource(name);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(gain);
        source.onended = () => {
            if (sources.get(name) === source)
                sources.delete(name);
        };

        sources.set(name, source);

        try {
            source.start();
        }
        catch (error) {
            sources.delete(name);
            source.onended = null;

            try {
                source.stop();
            }
            catch { /* Preserve the original host failure after attempted cleanup. */ }

            throw error;
        }
    };

    const port: ModernAudioPlaybackPort = Object.freeze({ async load(name: string, bytes: Uint8Array) {
            live();

            if (!isAssetId(name) || !name || !(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024)
                throw new Error("AUDIO_CLIP_INVALID");
            invalidate(name);
            const generation = generations.get(name), currentEpoch = epoch;
            const buffer = await context.decodeAudioData(bytes.slice().buffer);
            live();

            if (generations.get(name) === generation && currentEpoch === epoch)
                buffers.set(name, buffer);
        }, play, stop(name: string) { invalidate(name); stopSource(name); }, stopAll, setVolume, setMasterVolume: setVolume, measureOutputRms: () => disposed ? 0 : context.measureOutputRms?.() ?? 0, async dispose() {
            if (disposed)
                return;
            disposed = true;
            buffers.clear();
            let failure: unknown;

            try {
                stopAll();
            }
            catch (error) {
                failure = error;
            }

            try {
                await context.close();
            }
            catch (error) {
                failure ??= error;
            }

            if (failure !== undefined)
                throw failure;
        } });

    return historical ? Object.freeze({ ...port, async play(name: string) { play(name); } }) : port;
}

function isAudioContextFactory<Input>(value: Input): value is Input & (() => AudioContextLike) { return isBoundaryCallableValue(value); }

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}
