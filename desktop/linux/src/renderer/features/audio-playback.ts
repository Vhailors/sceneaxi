import { isJsonObject, type JsonValue } from "@sceneaxi/schemas";
import type { ModernAudioContextLike, ModernAudioPlaybackPort, AudioNodeLike, createAudioPlaybackPort } from "@sceneaxi/engine-presentation";
import { DESKTOP_ACTIVE_DOCUMENT_PATH } from "../../lib/bridge-contract.js";
import type { ViewportServices } from "./services.js";

type AudioClipManifest = Readonly<{
    assetId: string;
    mediaType: "audio/wav" | "audio/ogg" | "audio/mpeg";
    digest: string;
    byteLength: number;
}>;

function audioClipManifest<Input>(value: Input): readonly AudioClipManifest[] | null {
    if (!Array.isArray(value))
        return null;
    const clips: AudioClipManifest[] = [];

    for (const item of value) {
        if (!isJsonObject(item))
            return null;
        const clip = item;

        if (!("assetId" in clip) || !("mediaType" in clip) || !("digest" in clip) || !("byteLength" in clip) ||
            !isText(clip["assetId"]) || clip["assetId"].length === 0 ||
            (clip["mediaType"] !== "audio/wav" && clip["mediaType"] !== "audio/ogg" && clip["mediaType"] !== "audio/mpeg") ||
            !isText(clip["digest"]) || !/^sha256:[0-9a-f]{64}$/.test(clip["digest"]) ||
            !isNumeric(clip["byteLength"]) || !Number.isSafeInteger(clip["byteLength"]) || clip["byteLength"] < 1 || clip["byteLength"] > 8 * 1024 * 1024)
            return null;
        clips.push({
            assetId: clip["assetId"],
            mediaType: clip["mediaType"],
            digest: clip["digest"],
            byteLength: clip["byteLength"],
        });
    }

    return clips;
}

function browserAudioContext(): ModernAudioContextLike {
    const context = new AudioContext();
    const resumed = context.resume();
    void resumed.catch(() => undefined);
    const nodes = new WeakMap<object, AudioNode>();
    const decoded = new WeakSet<AudioBuffer>();
    let analyser: AnalyserNode | null = null;
    let closing = false;

    const wrap = (node: AudioNode) => {
        const facade = { connect: (destination: AudioNodeLike) => node.connect(resolve(destination)) };
        nodes.set(facade, node);

        return facade;
    };

    const resolve = (facade: AudioNodeLike): AudioNode => {
        const node = nodes.get(facade);

        if (node === undefined)
            throw new Error("AUDIO_NODE_INVALID");

        return node;
    };

    return {
        destination: wrap(context.destination),
        decodeAudioData: async (bytes) => {
            await resumed;

            if (closing) throw new Error("AUDIO_CONTEXT_DISPOSED");
            const buffer = await context.decodeAudioData(bytes);
            decoded.add(buffer);

            return buffer;
        },
        observeMasterGain: (gain) => {
            analyser = context.createAnalyser();
            // The playback port connects the gain to the returned analyser once.
            resolve(gain);
            analyser.connect(context.destination);

            return wrap(analyser);
        },
        measureOutputRms: () => {
            if (analyser === null)
                return 0;
            const samples = new Float32Array(analyser.fftSize);
            analyser.getFloatTimeDomainData(samples);
            let energy = 0;

            for (const sample of samples)
                energy += sample * sample;

            return Math.sqrt(energy / samples.length);
        },
        createGain: () => {
            const node = context.createGain();
            const facade = { gain: node.gain, connect: (destination: AudioNodeLike) => node.connect(resolve(destination)) };
            nodes.set(facade, node);

            return facade;
        },
        createBufferSource: () => {
            const node = context.createBufferSource();
            let buffer: object | null = null;

            return {
                get buffer() { return buffer; },
                set buffer(value) {
                    if (value !== null && (!(value instanceof AudioBuffer) || !decoded.has(value)))
                          throw new Error("AUDIO_BUFFER_INVALID");
                    node.buffer = value;
                    buffer = value;
                },
                get onended() { return node.onended === null ? null : () => node.onended?.(new Event("ended")); },
                set onended(handler) { node.onended = handler === null ? null : () => handler(); },
                connect: (destination) => { node.connect(resolve(destination)); },
                start: () => node.start(),
                stop: () => node.stop(),
            };
        },
        close: () => { closing = true;

 return context.close(); },
    };
}

export type DesktopAudioClip = AudioClipManifest;

/** Chrome confirms authority only after its current root/profile/generation checks. */
export function installDesktopAudioProfileBoundary(target: EventTarget, stop: () => void) {
    let profile: "game" | "web" | "kids" | null = null;

    const invalidate = (event: Event) => {
        profile = null;
        stop();

        if (!("detail" in event) || !isJsonObject(event.detail) || !("profile" in event.detail))
            return;
        const candidate = event.detail.profile;

        if (candidate === "game" || candidate === "web" || candidate === "kids")
            profile = candidate;
    };

    target.addEventListener("sceneaxi:desktop-audio-invalidate", invalidate);

    return Object.freeze({ getProfile: () => profile, dispose() {
        target.removeEventListener("sceneaxi:desktop-audio-invalidate", invalidate);
        profile = null;
        stop();
    } });
}

export type DesktopAudioLifecycleOptions = Readonly<{
    createAudioPlaybackPort: typeof createAudioPlaybackPort;
    createContext: () => ModernAudioContextLike;
    request: ViewportServices["request"];
    digest: (bytes: Uint8Array) => Promise<string>;
    getProfile: () => JsonValue | undefined;
    report: (message: string) => void;
}>;

/** Cancellation is checked at every await boundary, never by cached inline bytes. */
export function createDesktopAudioLifecycle(options: DesktopAudioLifecycleOptions) {
    let playback: ModernAudioPlaybackPort | null = null;
    let disposed = false, closed = false, epoch = 0;
    const generations = new Map<string, number>();

    const allowed = () => { const profile = options.getProfile();

 return profile === "game" || profile === "web"; };

    const invalidate = (id: string) => { const next = (generations.get(id) ?? 0) + 1; generations.set(id, next);

 return next; };

    const report = (code: string, id = "") => options.report("Audio refused: " + code + (id ? " " + id : ""));

    return Object.freeze({
        async play<Input>(value: Input): Promise<boolean> {
            const clips = audioClipManifest([value]), clip = clips?.[0];

            if (!clip) {
                report("AUDIO_CLIP_MANIFEST_INVALID");

                return false;
            }

            if (disposed || !allowed()) {
                report("AUDIO_KIDS_DENIED", clip.assetId);

                return false;
            }

            const generation = invalidate(clip.assetId), startedEpoch = epoch;
            const current = () => !disposed && allowed() && epoch === startedEpoch && generations.get(clip.assetId) === generation;

            try {
                playback ??= options.createAudioPlaybackPort(options.createContext);
                playback.stop(clip.assetId);
                const port = playback;
                const result = await options.request({ action: "audio-asset", payload: { assetId: clip.assetId, documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH } });

                if (!current())
                    return false;

                if (result.ok !== true || !isJsonObject(result.data)) {
                    report("AUDIO_CLIP_UNKNOWN", clip.assetId);

                    return false;
                }

                const data = result.data;

                if (!("assetId" in data) || !("mediaType" in data) || !("digest" in data) || !("byteLength" in data) || !("bytesBase64" in data) || data.assetId !== clip.assetId || data.mediaType !== clip.mediaType || data.digest !== clip.digest || data.byteLength !== clip.byteLength || !isText(data.bytesBase64) || data.bytesBase64.length !== 4 * Math.ceil(clip.byteLength / 3) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data.bytesBase64)) {
                    report("AUDIO_CLIP_INVALID", clip.assetId);

                    return false;
                }

                const bytes = Uint8Array.from(atob(data.bytesBase64), char => char.charCodeAt(0));
                // Reject alternative base64 spellings before hash or codec admission.
                const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                const encoded = data.bytesBase64;

                if ((encoded.endsWith("==") && (alphabet.indexOf(encoded.at(-3) ?? "") & 15) !== 0) || (encoded.endsWith("=") && !encoded.endsWith("==") && (alphabet.indexOf(encoded.at(-2) ?? "") & 3) !== 0)) {
                    report("AUDIO_CLIP_INVALID", clip.assetId);

                    return false;
                }

                if (bytes.byteLength !== clip.byteLength) {
                    report("AUDIO_CLIP_INVALID", clip.assetId);

                    return false;
                }

                const digest = await options.digest(bytes);

                if (!current())
                    return false;

                if (digest !== clip.digest) {
                    report("AUDIO_CLIP_INVALID", clip.assetId);

                    return false;
                }

                try {
                    await port.load(clip.assetId, bytes);
                }
                catch {
                    if (current())
                        report("AUDIO_DECODE_FAILED", clip.assetId);

                    return false;
                }

                if (!current())
                    return false;
                port.play(clip.assetId);

                return true;
            }
            catch {
                if (current())
                    report("AUDIO_PLAYBACK_FAILED", clip.assetId);

                return false;
            }
        },
        stop(id: string) {
            invalidate(id);

            try {
                playback?.stop(id);
            }
            catch {
                report("AUDIO_STOP_FAILED", id);
            }
        },
        reset() {
            epoch++;
            generations.clear();

            try {
                playback?.stopAll();
            }
            catch {
                report("AUDIO_STOP_FAILED");
            }
        },
        setVolume(value: number) { playback?.setVolume(value); },
        measureOutputRms() { return playback?.measureOutputRms() ?? 0; },
        contextClosed() { return closed; },
        async dispose() {
            if (disposed)
                return;
            disposed = true;
            epoch++;
            generations.clear();
            const closing = playback;
            playback = null;

            try {
                await closing?.dispose();
                closed = true;
            }
            catch {
                report("AUDIO_CONTEXT_CLOSE_FAILED");
            }
        },
    });
}

function mountAudioControls(services: ViewportServices, clips: readonly AudioClipManifest[], getProfile: () => JsonValue | undefined): () => void {
    const { stage: host, report } = services;

    if (clips.length === 0)
        return () => undefined;
    const controls = host.ownerDocument.createElement("div");
    controls.dataset.audioPlayback = "true";
    // Operate viewport chrome: one raised plate (chrome tokens, so it reads over any canvas pixels) and
    // the shared density-aware `ui-control` buttons from the desktop ui-kit.
    controls.style.cssText = "position:absolute;top:12px;right:12px;z-index:10;display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-1,4px);padding:var(--space-1,4px);border:1px solid var(--line-control);border-radius:var(--r-control);background:var(--overlay);accent-color:var(--accent);pointer-events:auto";
    controls.setAttribute("aria-label", "Play session audio");
    const audio = createDesktopAudioLifecycle({ createAudioPlaybackPort: services.createAudioPlaybackPort, createContext: browserAudioContext, request: services.request, getProfile, report: message => { if (!services.signal?.aborted) report.openPathLine(message); }, digest: async (bytes) => "sha256:" + [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer))].map(byte => byte.toString(16).padStart(2, "0")).join("") });
    const volume = host.ownerDocument.createElement("input");
    volume.type = "range";
    volume.min = "0";
    volume.max = "1";
    volume.step = "0.01";
    volume.value = "1";
    volume.setAttribute("aria-label", "Audio volume");
    const listenerOptions = services.signal === undefined ? undefined : { signal: services.signal };
    volume.addEventListener("input", () => { if (disposed) return; audio.setVolume(Number(volume.value)); controls.dataset.audioVolume = volume.value; }, listenerOptions);
    controls.append(volume);
    let disposed = false;
    const buttons: HTMLButtonElement[] = [];
    const uiGenerations = new Map<string, number>();

    for (const clip of clips) {
        const play = host.ownerDocument.createElement("button"), stop = host.ownerDocument.createElement("button");
        play.type = stop.type = "button";
        play.className = stop.className = "ui-control";
        play.textContent = "Play " + clip.assetId;
        stop.textContent = "Stop " + clip.assetId;
        play.addEventListener("click", () => {
            if (disposed) return;
            const generation = (uiGenerations.get(clip.assetId) ?? 0) + 1;
            uiGenerations.set(clip.assetId, generation);
            void audio.play(clip).then(started => {
                if (!started || disposed || uiGenerations.get(clip.assetId) !== generation)
                    return;
                audio.setVolume(Number(volume.value));
                controls.dataset.audioVolume = volume.value;
                play.dataset.audioState = "started";

                const updateRms = () => {
                    if (disposed || play.dataset.audioState !== "started")
                        return;
                    controls.dataset.audioRms = String(audio.measureOutputRms());
                    requestAnimationFrame(updateRms);
                };

                requestAnimationFrame(updateRms);
            });
        }, listenerOptions);
        stop.addEventListener("click", () => { if (disposed) return; uiGenerations.set(clip.assetId, (uiGenerations.get(clip.assetId) ?? 0) + 1); audio.stop(clip.assetId); play.dataset.audioState = "stopped"; stop.dataset.audioState = "stopped"; }, listenerOptions);
        buttons.push(play, stop);
        controls.append(play, stop);
    }

    let terminal = false, closing = false;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;

    const close = () => {
        if (closing) return;
        closing = true;
        void audio.dispose().then(() => {
            if (!terminal) controls.dataset.audioContextDisposed = String(audio.contextClosed());
            services.signal?.removeEventListener("abort", terminate);
        });
    };

    // A normal stop retains the 100ms silence measurement. Root shutdown cannot
    // wait for it: retired controls remain abort-owned until their context closes.
    const terminate = () => {
        if (terminal) return;
        terminal = true;

        if (stopTimer !== undefined) clearTimeout(stopTimer);

        if (!disposed) controls.remove();
        disposed = true;
        close();
    };

    services.signal?.addEventListener("abort", terminate, { once: true });

    if (services.signal?.aborted) terminate();
    else host.append(controls);

    return () => {
        if (disposed) return;
        disposed = true;
        audio.reset();

        for (const button of buttons) button.dataset.audioState = "stopped";
        stopTimer = setTimeout(() => {
            stopTimer = undefined;

            if (terminal) return;
            controls.dataset.audioRms = String(audio.measureOutputRms());
            close();
        }, 100);
        controls.remove();
    };
}

export function installAudioControls(services: ViewportServices, options: Readonly<{
    getProfile: () => JsonValue | undefined;
}>) {
    let disposeAudioControls: (() => void) | null = null;
    const stop = () => { disposeAudioControls?.(); disposeAudioControls = null; };

    return { stop, play<Input>(mountable: Input) {
            if (services.signal?.aborted) return;
            stop();

            if (options.getProfile() !== "game" && options.getProfile() !== "web") {
                services.report.openPathLine("Audio refused: AUDIO_KIDS_DENIED");

                return;
            }

            const projected = isJsonObject(mountable) && "audioClips" in mountable ? mountable.audioClips : [];
            const clips = audioClipManifest(projected);

            if (clips === null)
                services.report.openPathLine("Audio refused: AUDIO_CLIP_MANIFEST_INVALID");
            else
                disposeAudioControls = mountAudioControls(services, clips, options.getProfile);
        } };
}

function isText(value: unknown): value is string { return typeof value === "string"; }

function isNumeric(value: unknown): value is number { return typeof value === "number"; }
