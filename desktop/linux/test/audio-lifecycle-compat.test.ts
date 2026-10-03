import { expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createAudioPlaybackPort, type ModernAudioContextLike } from "@sceneaxi/engine-presentation";
import { createDesktopAudioLifecycle } from "../src/renderer/viewport.js";
import { installDesktopAudioProfileBoundary } from "../src/renderer/features/audio-playback.js";
import { desktopOpenScene, desktopSceneFromDocumentData, inspectDesktopScenePackages } from "../src/index.js";

type AudioLifecycleOptions = Parameters<typeof createDesktopAudioLifecycle>[0];

type AudioProfileInput = ReturnType<AudioLifecycleOptions["getProfile"]>;

type AudioResponseInput = Awaited<ReturnType<AudioLifecycleOptions["request"]>>;

type DeferredFailure = Parameters<NonNullable<Parameters<Promise<never>["catch"]>[0]>>[0];

function deferred<T = undefined>() { let resolve!: (value: T) => void; let reject!: (error: DeferredFailure) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });

 return { resolve, reject, promise }; }

const bytes = new Uint8Array([79, 103, 103, 83]);

const digest = "sha256:" + createHash("sha256").update(bytes).digest("hex");

const clip = { assetId: "voice", mediaType: "audio/ogg" as const, digest, byteLength: bytes.length };

const response = { ok: true as const, action: "audio-asset" as const, data: { ...clip, bytesBase64: Buffer.from(bytes).toString("base64") } };

function fixture(getProfile?: AudioLifecycleOptions["getProfile"]) {
    const sources: Array<{
        buffer: object | null;
        onended: (() => void) | null;
        connect: () => void;
        start: ReturnType<typeof vi.fn<() => void>>;
        stop: ReturnType<typeof vi.fn<() => void>>;
    }> = [];

    const context: Mutable<ModernAudioContextLike> = { destination: { connect() { } }, decodeAudioData: vi.fn(async () => ({})), createGain: () => ({ gain: { value: 1 }, connect() { } }), createBufferSource() { const source: (typeof sources)[number] = { buffer: null, onended: null, connect() { }, start: vi.fn(), stop: vi.fn() }; sources.push(source);

 return source; }, close: vi.fn(async () => { }) };

    let profile = "game";
    const create = vi.fn(() => context), report = vi.fn();
    const request = vi.fn(async (): Promise<AudioResponseInput> => response), hash = vi.fn(async (data: Uint8Array) => "sha256:" + createHash("sha256").update(data).digest("hex"));
    const audio = createDesktopAudioLifecycle({ createAudioPlaybackPort, createContext: create, request, digest: hash, getProfile: getProfile ?? (() => profile), report });

    return { audio, context, create, report, request, hash, sources, setProfile: (value: string) => { profile = value; audio.reset(); } };
}

it("retains descriptor/digest admission and Ogg host codec, refuses bad envelopes before decode", async () => {
    const f = fixture();
    await expect(f.audio.play(clip)).resolves.toBe(true);
    expect(f.context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(f.sources[0]?.start).toHaveBeenCalledTimes(1);
    f.audio.stop(clip.assetId);
    expect(f.sources[0]?.stop).toHaveBeenCalledTimes(1);

    for (const data of [{ ...response.data, digest: "sha256:" + "0".repeat(64) }, { ...response.data, bytesBase64: "AQ==" }, { ...response.data, mediaType: "audio/wav" }]) {
        f.request.mockResolvedValueOnce({ ...response, data });
        await expect(f.audio.play(clip)).resolves.toBe(false);
    }

    expect(f.context.decodeAudioData).toHaveBeenCalledTimes(1);
    await f.audio.dispose();
});

it("Stop cancels before fetch, before digest and before deferred host decode", async () => {
    for (const seam of ["request", "digest", "decode"] as const) {
        const f = fixture();
        const wait = deferred<AudioResponseInput>(), entered = deferred();

        if (seam === "request")
            f.request.mockImplementationOnce(() => { entered.resolve(undefined);

 return wait.promise; });

        if (seam === "digest")
            f.hash.mockImplementationOnce(async () => { entered.resolve(undefined); await wait.promise;

 return digest; });

        if (seam === "decode")
            f.context.decodeAudioData = async () => { entered.resolve(undefined); await wait.promise;

 return {}; };

        const pending = f.audio.play(clip);
        await entered.promise;
        f.audio.stop(clip.assetId);
        wait.resolve(response);
        await expect(pending).resolves.toBe(false);
        expect(f.sources).toHaveLength(0);
        await f.audio.dispose();
    }
});

it("new Play wins out-of-order request and decode completions", async () => {
    const f = fixture(), first = deferred<AudioResponseInput>();
    f.request.mockImplementationOnce(() => first.promise);
    const older = f.audio.play(clip);
    await expect(f.audio.play(clip)).resolves.toBe(true);
    first.resolve(response);
    await expect(older).resolves.toBe(false);
    expect(f.sources).toHaveLength(1);
    const decode = deferred<object>(), entered = deferred();
    f.context.decodeAudioData = vi.fn().mockImplementationOnce(() => { entered.resolve(undefined);

 return decode.promise; }).mockResolvedValueOnce({ newer: true });
    const pending = f.audio.play(clip);
    await entered.promise;
    await f.audio.play(clip);
    decode.resolve({ older: true });
    await expect(pending).resolves.toBe(false);
    expect(f.sources.at(-1)?.buffer).toEqual({ newer: true });
    await f.audio.dispose();
});

it("reset/project/profile cancellation denies Kids before context allocation", async () => {
    const f = fixture();
    f.setProfile("kids");
    await expect(f.audio.play(clip)).resolves.toBe(false);
    expect(f.create).not.toHaveBeenCalled();
    expect(f.request).not.toHaveBeenCalled();
    f.setProfile("game");
    const wait = deferred<AudioResponseInput>();
    f.request.mockImplementationOnce(() => wait.promise);
    const pending = f.audio.play(clip);
    f.setProfile("kids");
    wait.resolve(response);
    await expect(pending).resolves.toBe(false);
    expect(f.sources).toHaveLength(0);
    await f.audio.dispose();
    expect(f.context.close).toHaveBeenCalledTimes(1);
});

it("request/decode/close rejection is named and repeated disposal closes once", async () => {
    const f = fixture();
    f.request.mockRejectedValueOnce(Error("private request"));
    await expect(f.audio.play(clip)).resolves.toBe(false);
    f.context.decodeAudioData = async () => { throw Error("private decoder"); };

    await expect(f.audio.play(clip)).resolves.toBe(false);
    f.context.close = vi.fn(async () => { throw Error("private close"); });
    await expect(f.audio.dispose()).resolves.toBeUndefined();
    await f.audio.dispose();
    expect(f.context.close).toHaveBeenCalledTimes(1);
    expect(f.report.mock.calls.flat().join(" ")).toContain("AUDIO_CONTEXT_CLOSE_FAILED");
    expect(f.report.mock.calls.flat().join(" ")).not.toContain("private");
});

it("frozen PR310 package refusal preserves modern presentation and physics projection", () => {
    expect(inspectDesktopScenePackages({})).toMatchObject({ kind: "sceneaxi.scene-package-inspection", catalog: { schemaVersion: 1, lock: [] }, networking: false, marketplace: false, savedBytesWritten: false });
    expect(inspectDesktopScenePackages({ scenePackages: null })).toMatchObject({ ok: false });
    expect(inspectDesktopScenePackages({ scenePackages: { schemaVersion: 999 } })).toMatchObject({ ok: false });
    const scene = desktopOpenScene();
    expect(scene.ok).toBe(true);

    if (!scene.ok)
        throw Error("fixture");
    expect(desktopSceneFromDocumentData({ composedScene: scene.composed.scene })).toMatchObject({ ok: true });
});

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

it("per-clip Stop leaves other accepted sources playing, reset retires the entire project", async () => {
    const f = fixture();
    await f.audio.play(clip);
    const other = { ...clip, assetId: "other" };
    f.request.mockResolvedValueOnce({ ...response, data: { ...response.data, assetId: "other" } });
    await f.audio.play(other);
    expect(f.sources).toHaveLength(2);
    f.audio.stop(clip.assetId);
    expect(f.sources[0]?.stop).toHaveBeenCalledTimes(1);
    expect(f.sources[1]?.stop).not.toHaveBeenCalled();
    f.audio.reset();
    expect(f.sources[1]?.stop).toHaveBeenCalledTimes(1);
    await f.audio.dispose();
});

it("rejected close is not reported as successful context disposal", async () => {
    const f = fixture();
    await f.audio.play(clip);
    f.context.close = vi.fn(async () => { throw Error("private close"); });
    await f.audio.dispose();
    expect(f.audio.contextClosed()).toBe(false);
    expect(f.report).toHaveBeenCalledWith("Audio refused: AUDIO_CONTEXT_CLOSE_FAILED");
    await f.audio.dispose();
    expect(f.context.close).toHaveBeenCalledTimes(1);
});

it("chrome null-profile fence cancels synchronously before a stale request completes", async () => {
    const target = new EventTarget();
    let reset: () => void = () => undefined;
    const boundary = installDesktopAudioProfileBoundary(target, () => reset());
    const f = fixture(boundary.getProfile);
    reset = f.audio.reset;
    const confirm = (profile: AudioProfileInput) => target.dispatchEvent(Object.assign(new Event("sceneaxi:desktop-audio-invalidate"), { detail: { profile } }));
    await expect(f.audio.play(clip)).resolves.toBe(false);
    expect(f.create).not.toHaveBeenCalled();
    confirm("game");
    const pendingResponse = deferred<AudioResponseInput>();
    f.request.mockImplementationOnce(() => pendingResponse.promise);
    const pending = f.audio.play(clip);
    confirm(null);
    expect(boundary.getProfile()).toBeNull();
    confirm("web");
    pendingResponse.resolve(response);
    await expect(pending).resolves.toBe(false);
    expect(f.context.decodeAudioData).not.toHaveBeenCalled();
    await expect(f.audio.play(clip)).resolves.toBe(true);
    confirm("kids");
    expect(f.sources[0]?.stop).toHaveBeenCalledTimes(1);
    await expect(f.audio.play(clip)).resolves.toBe(false);
    boundary.dispose();
    await f.audio.dispose();
});

it("malformed authority events remain denied and disposed listeners cannot restore authority", () => {
    const target = new EventTarget(), stop = vi.fn();
    const boundary = installDesktopAudioProfileBoundary(target, stop);

    for (const detail of [null, {}, { profile: "admin" }, { profile: 1 }]) {
        target.dispatchEvent(Object.assign(new Event("sceneaxi:desktop-audio-invalidate"), { detail }));
        expect(boundary.getProfile()).toBeNull();
    }

    expect(stop).toHaveBeenCalledTimes(4);
    boundary.dispose();
    target.dispatchEvent(Object.assign(new Event("sceneaxi:desktop-audio-invalidate"), { detail: { profile: "game" } }));
    expect(boundary.getProfile()).toBeNull();
    expect(stop).toHaveBeenCalledTimes(5);
});
