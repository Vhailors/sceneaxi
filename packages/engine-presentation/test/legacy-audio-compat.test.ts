import { expect, it, vi } from "vitest";
import { createAudioPlaybackPort, type AudioContextLike, type LegacyAudioContextLike, type AudioPlaybackPort, type AudioOutputDestination, type AudioGainLike, type AudioSourceLike } from "@sceneaxi/engine-presentation";

function fake() {
    const sources: ModernAudioSource[] = [];

    const ctx: Mutable<AudioContextLike> = { destination: { connect() { } }, decodeAudioData: vi.fn(async () => ({})), createGain: () => ({ gain: { value: 1 }, connect() { } }), createBufferSource: () => { const s: ModernAudioSource = { buffer: null, onended: null, connect() { }, start: vi.fn(), stop: vi.fn() }; sources.push(s);

 return s; }, close: vi.fn(async () => { }) };

    return { ctx, sources };
}

it("preserves historical object factory, typed tagged nodes, async Play and master volume", async () => {
    const destination: AudioOutputDestination = { kind: "audio-output", target: {} };
    const gain: AudioGainLike = { kind: "audio-gain", gain: { value: 1 }, connect: vi.fn() };
    const source: AudioSourceLike = { buffer: null, onended: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    const ctx: Mutable<LegacyAudioContextLike> = { destination, createGain: () => gain, createBufferSource: () => source, decodeAudioData: vi.fn(async () => ({})), close: vi.fn(async () => { }) };
    // A historical host must not silently widen main's public context contract.
    const legacyIsModern: LegacyAudioContextLike extends AudioContextLike ? true : false = false;
    expect(legacyIsModern).toBe(false);
    const audio: AudioPlaybackPort = createAudioPlaybackPort({ createAudioContext: () => ctx });
    await audio.load("ogg", new Uint8Array([79, 103, 103, 83]));
    await audio.play("ogg");
    audio.setMasterVolume(0.3);
    expect(gain.gain.value).toBe(0.3);
    expect(source.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(destination);
    audio.stop("ogg");
    await audio.dispose();
    expect(source.stop).toHaveBeenCalledTimes(1);
    expect(ctx.close).toHaveBeenCalledTimes(1);
});

it("denies historical Kids before allocating and preserves modern function factory", async () => {
    const { ctx, sources } = fake();
    const create = vi.fn(() => ctx);
    expect(() => createAudioPlaybackPort({ createAudioContext: create, kids: true })).toThrow("AUDIO_KIDS_DENIED");
    expect(create).not.toHaveBeenCalled();
    const a = createAudioPlaybackPort(create);
    await a.load("mp3", new Uint8Array([255, 251]));
    a.play("mp3");
    a.setVolume(0.2);
    a.stopAll();
    expect(sources[0]?.stop).toHaveBeenCalledTimes(1);
    await a.dispose();
    await a.dispose();
    expect(ctx.close).toHaveBeenCalledTimes(1);
});

it("invalidates pending and out-of-order decodes through Stop and reset", async () => {
    const { ctx, sources } = fake();
    const complete: Array<(v: DecodedAudio) => void> = [];
    ctx.decodeAudioData = () => new Promise(resolve => complete.push(resolve));
    const a = createAudioPlaybackPort(() => ctx);
    const first = a.load("clip", new Uint8Array([1]));
    const second = a.load("clip", new Uint8Array([2]));
    const latest = { version: 2 };
    complete[1]?.(latest);
    await second;
    complete[0]?.({ version: 1 });
    await first;
    a.play("clip");
    expect(sources[0]?.buffer).toBe(latest);
    const pending = a.load("pending", new Uint8Array([3]));
    a.stop("pending");
    complete[2]?.({});
    await pending;
    expect(() => a.play("pending")).toThrow(/UNKNOWN/);
    const reset = a.load("reset", new Uint8Array([4]));
    a.stopAll();
    complete[3]?.({});
    await reset;
    expect(() => a.play("reset")).toThrow(/UNKNOWN/);
    await a.dispose();
});

it("rejects post-dispose decoding and closes every source even after host stop errors", async () => {
    const { ctx } = fake();
    let finish: ((v: DecodedAudio) => void) | undefined;
    ctx.decodeAudioData = () => new Promise(resolve => { finish = resolve; });
    const a = createAudioPlaybackPort(() => ctx);
    const pending = a.load("clip", new Uint8Array([1]));
    await a.dispose();
    finish?.({});
    await expect(pending).rejects.toThrow(/DISPOSED/);
    const f = fake();
    const b = createAudioPlaybackPort(() => f.ctx);

    for (const n of ["a", "b"]) {
        await b.load(n, new Uint8Array([1]));
        b.play(n);
    }

    if (f.sources[0])
        f.sources[0].stop = vi.fn(() => { throw Error("host stop"); });
    await expect(b.dispose()).rejects.toThrow(/host stop/);
    expect(f.sources[1]?.stop).toHaveBeenCalledTimes(1);
    expect(f.ctx.close).toHaveBeenCalledTimes(1);
    await b.dispose();
});

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type DecodedAudio = Awaited<ReturnType<AudioContextLike["decodeAudioData"]>>;

type ModernAudioSource = ReturnType<AudioContextLike["createBufferSource"]>;
