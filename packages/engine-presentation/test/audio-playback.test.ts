import { describe, expect, it } from "vitest";
import { createAudioPlaybackPort, type AudioContextLike, type AudioSourceLike } from "@sceneaxi/engine-presentation";

describe("presentation audio playback", () => {
  it("decodes and plays named clips, stops them, and applies master volume", async () => {
    const events: string[] = [];
    const buffer = {};
    const source: AudioSourceLike = {
      buffer: null,
      connect: () => events.push("connect-source"),
      start: () => events.push("start"),
      stop: () => events.push("stop"),
      onended: null,
    };
    const context: AudioContextLike = {
      destination: { kind: "audio-output", target: {} },
      decodeAudioData: async (bytes) => { events.push(`decode:${bytes.byteLength}`); return buffer; },
      createBufferSource: () => source,
      createGain: () => ({ kind: "audio-gain", gain: { value: 1 }, connect: () => events.push("connect-gain") }),
      close: async () => { events.push("close"); },
    };
    const port = createAudioPlaybackPort({ createAudioContext: () => context });
    await port.load("theme", new Uint8Array([1, 2, 3]));
    await port.play("theme");
    port.setMasterVolume(0.4);
    port.stop("theme");
    await port.dispose();
    expect(events).toEqual(["connect-gain", "decode:3", "connect-source", "start", "stop", "close"]);
  });

  it("does not construct audio for Kids and rejects invalid clip and volume input", async () => {
    let constructed = false;
    expect(() => createAudioPlaybackPort({ kids: true, createAudioContext: () => { constructed = true; throw new Error(); } })).toThrow("AUDIO_KIDS_DENIED");
    expect(constructed).toBe(false);
    const port = createAudioPlaybackPort({ createAudioContext: () => ({
      destination: { kind: "audio-output", target: {} }, decodeAudioData: async () => ({}), createBufferSource: () => ({ buffer: null, connect() {}, start() {}, stop() {}, onended: null }), createGain: () => ({ kind: "audio-gain", gain: { value: 1 }, connect() {} }), close: async () => {},
    }) });
    await expect(port.load("", new Uint8Array())).rejects.toThrow("AUDIO_CLIP_INVALID");
    expect(() => port.setMasterVolume(2)).toThrow("AUDIO_VOLUME_INVALID");
    await port.dispose();
  });
});
