import { describe, expect, it, vi } from "vitest";
import { createAudioPlaybackRuntime, type AudioContextPort } from "@sceneaxi/engine-presentation";

function wav(frames = 800) {
  const bytes = new Uint8Array(44 + frames * 2); const d = new DataView(bytes.buffer);
  const tag = (i: number, s: string) => [...s].forEach((c,j) => bytes[i+j] = c.charCodeAt(0));
  tag(0,"RIFF"); d.setUint32(4,bytes.length-8,true); tag(8,"WAVE"); tag(12,"fmt "); d.setUint32(16,16,true); d.setUint16(20,1,true); d.setUint16(22,1,true); d.setUint32(24,8000,true); d.setUint32(28,16000,true); d.setUint16(32,2,true); d.setUint16(34,16,true); tag(36,"data"); d.setUint32(40,frames*2,true);

  for (let i=0;i<frames;i++) d.setInt16(44+i*2,Math.round(Math.sin(i*2*Math.PI*440/8000)*1000),true);

  return bytes;
}

function context() {
  const sources: Array<{ onended: (() => void) | null; stop: () => void; disconnect: () => void }> = [];
  const gains: Array<{ gain: { value: number }; disconnect: () => void }> = [];

  const ctx: AudioContextPort = { destination: {}, state: "running", resume: vi.fn(async () => {}), close: vi.fn(async () => {}), createBuffer: vi.fn(() => ({ copyToChannel: vi.fn() })), createGain() { const g = { gain: { value: 1 }, connect() {}, disconnect: vi.fn() }; gains.push(g);

 return g; }, createBufferSource() {
    // SAFETY: null is a member of the callback-or-null union; the fake source starts with no completion handler.
    const s = { buffer: null, onended: null as (() => void) | null, connect() {}, disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }; sources.push(s);

 return s; } };

  return { ctx, sources, gains };
}

describe("public offline audio runtime (not audible-device proof)", () => {
  it("requires explicit unlock, decodes PCM, bounds volume, stops on hiding and owns teardown", async () => {
    const {ctx,sources,gains} = context(); const create = vi.fn(() => ctx);
    const a = createAudioPlaybackRuntime({ profile: "game", createContext: create });
    expect(() => a.play({assetId:"tone",bytes:wav()})).toThrow(/unlocked/);
    await expect(a.unlock(false)).rejects.toThrow(/interaction/); expect(create).not.toHaveBeenCalled();
    await a.unlock(true); const handle = a.play({assetId:"tone",bytes:wav()}); expect(a.activeSources()).toBe(1); expect(ctx.createBuffer).toHaveBeenCalledWith(1,800,8000);
    a.setVolume(0.25); expect(gains[0]?.gain.value).toBe(0.25); expect(() => a.setVolume(NaN)).toThrow();
    a.setVisible(false); expect(a.activeSources()).toBe(0); expect(sources[0]?.stop).toHaveBeenCalledTimes(1); expect(sources[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(() => a.play({assetId:"tone",bytes:wav()})).toThrow(/hidden/); a.setVisible(true); a.stop(handle);
    a.play({assetId:"tone",bytes:wav()}); await a.dispose(); await a.dispose(); expect(a.activeSources()).toBe(0); expect(ctx.close).toHaveBeenCalledTimes(1); expect(() => a.play({assetId:"tone",bytes:wav()})).toThrow(/disposed/);
  });
  it("releases partially allocated nodes and stops a failed start before retrying", async () => {
    const { ctx, sources, gains } = context();
    const audio = createAudioPlaybackRuntime({ profile: "game", createContext: () => ctx });
    await audio.unlock(true);
    const createGain = ctx.createGain.bind(ctx);
    ctx.createGain = () => { throw new Error("gain allocation failed"); };

    expect(() => audio.play({ assetId: "tone", bytes: wav() })).toThrow(/gain allocation failed/);
    expect(requireValue(sources[0]).disconnect).toHaveBeenCalledTimes(1);
    expect(audio.activeSources()).toBe(0);
    ctx.createGain = createGain;
    const createSource = ctx.createBufferSource.bind(ctx);
    ctx.createBufferSource = () => {
      const source = createSource();
      source.start = () => { throw new Error("start failed"); };

      return source;
    };

    expect(() => audio.play({ assetId: "tone", bytes: wav() })).toThrow(/start failed/);
    expect(requireValue(sources[1]).stop).toHaveBeenCalledTimes(1);
    expect(requireValue(sources[1]).disconnect).toHaveBeenCalledTimes(1);
    expect(requireValue(gains[0]).disconnect).toHaveBeenCalledTimes(1);
    expect(audio.activeSources()).toBe(0);
    ctx.createBufferSource = () => {
      const source = createSource();
      source.start = () => { throw new Error("original start failure"); };

      source.stop = () => { throw new Error("stop cleanup failure"); };

      source.disconnect = () => { throw new Error("source cleanup failure"); };

      return source;
    };

    ctx.createGain = () => {
      const gain = createGain();
      gain.disconnect = () => { throw new Error("gain cleanup failure"); };

      return gain;
    };

    expect(() => audio.play({ assetId: "tone", bytes: wav() })).toThrow("original start failure");
    expect(audio.activeSources()).toBe(0);
    ctx.createGain = createGain;
    ctx.createBufferSource = createSource;
    audio.play({ assetId: "tone", bytes: wav() });
    expect(audio.activeSources()).toBe(1);
    await audio.dispose();
    expect(audio.activeSources()).toBe(0);
  });
  it("refuses malformed/unsupported WAV before allocation, capacity limit+1 and Kids", async () => {
    const {ctx,sources} = context(); const a = createAudioPlaybackRuntime({profile:"web",createContext:()=>ctx}); await a.unlock(true);
    expect(() => a.play({assetId:"bad",bytes:new Uint8Array(44)})).toThrow(/RIFF/); expect(ctx.createBuffer).not.toHaveBeenCalled();

    for(let i=0;i<16;i++) a.play({assetId:"tone",bytes:wav()}); expect(a.activeSources()).toBe(16); expect(() => a.play({assetId:"tone",bytes:wav()})).toThrow(/capacity/);
    sources[0]?.onended?.(); expect(a.activeSources()).toBe(15); a.play({assetId:"tone",bytes:wav()}); await a.dispose(); expect(a.activeSources()).toBe(0);
    // SAFETY: The disallowed Kids profile is confined to the runtime-refusal assertion; no audio context is created from it.
    expect(() => createAudioPlaybackRuntime({profile:"kids" as never})).toThrow(/Kids/);
  });
});


it("disposal cleans every source even when a host stop or disconnect fails", async () => {
  const { ctx, sources, gains } = context();
  const a = createAudioPlaybackRuntime({ profile: "game", createContext: () => ctx });
  await a.unlock(true); a.play({ assetId: "tone", bytes: wav() }); a.play({ assetId: "tone", bytes: wav() });
  requireValue(sources[0]).stop = () => { throw new Error("host stop failed"); };

  requireValue(sources[0]).disconnect = () => { throw new Error("host disconnect failed"); };

  await expect(a.dispose()).rejects.toThrow();
  expect(a.activeSources()).toBe(0);
  expect(requireValue(sources[1]).stop).toHaveBeenCalledTimes(1);
  expect(requireValue(gains[0]).disconnect).toHaveBeenCalledTimes(1);
  expect(ctx.close).toHaveBeenCalledTimes(1);
  await a.dispose();
});

function requireValue<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error("Required fixture value is absent.");

  return value;
}

it("refuses accessor/proxy audio assets before allocation without conversion hooks", async () => {
  const { ctx } = context();
  const audio = createAudioPlaybackRuntime({ profile: "game", createContext: () => ctx });
  await audio.unlock(true);
  let reads = 0;
  const accessor = { get assetId() { reads += 1; throw new Error("private"); }, bytes: wav() };
  const nested = { assetId: "tone", get bytes() { reads += 1; throw new Error("private"); } };
  const revoked = Proxy.revocable({ assetId: "tone", bytes: wav() }, {}); revoked.revoke();
  try {
    for (const asset of [accessor, nested, revoked.proxy]) {
      expect(() => audio.play(asset)).toThrow(/Invalid contained audio asset/);
      expect(ctx.createBuffer).not.toHaveBeenCalled();
    }
    expect(reads).toBe(0);
  } finally { await audio.dispose(); }
});
