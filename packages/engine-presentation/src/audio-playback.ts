/** Injected Web Audio seam. Importing this module never constructs audio output. */
export type AudioBufferLike = object;

export type AudioNodeLike = Readonly<{ connect(destination: AudioNodeLike): unknown }>;

export type AudioContextLike = Readonly<{
  destination: AudioNodeLike;
  decodeAudioData(bytes: ArrayBuffer): Promise<AudioBufferLike>;
  createGain(): AudioNodeLike & Readonly<{ gain: { value: number } }>;
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

export function createAudioPlaybackPort(createContext: () => AudioContextLike) {
  const context = createContext();
  const gain = context.createGain();
  gain.connect(context.observeMasterGain?.(gain) ?? context.destination);
  const buffers = new Map<string, AudioBufferLike>();
  const sources = new Map<string, ReturnType<AudioContextLike["createBufferSource"]>>();
  let disposed = false;
  let finalOutputRms = 0;

  function live() {
    if (disposed) throw new Error("AUDIO_CONTEXT_DISPOSED");
  }

  return Object.freeze({
    async load(name: string, bytes: Uint8Array) {
      live();
      if (!name || bytes.byteLength === 0) throw new Error("AUDIO_CLIP_INVALID");
      const buffer = await context.decodeAudioData(bytes.slice().buffer);
      live();
      buffers.set(name, buffer);
    },
    play(name: string) {
      live();
      const buffer = buffers.get(name);
      if (buffer === undefined) throw new Error(`AUDIO_CLIP_UNKNOWN:${name}`);
      sources.get(name)?.stop();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.onended = () => { if (sources.get(name) === source) sources.delete(name); };
      sources.set(name, source);
      source.start();
    },
    stop(name: string) {
      sources.get(name)?.stop();
      sources.delete(name);
    },
    stopAll() {
      for (const source of sources.values()) source.stop();
      sources.clear();
    },
    setVolume(value: number) {
      live();
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error("AUDIO_VOLUME_INVALID");
      gain.gain.value = value;
    },
    measureOutputRms() {
      return disposed ? finalOutputRms : context.measureOutputRms?.() ?? 0;
    },
    async dispose() {
      if (disposed) return;
      this.stopAll();
      await new Promise((resolve) => setTimeout(resolve, 50));
      finalOutputRms = context.measureOutputRms?.() ?? 0;
      disposed = true;
      buffers.clear();
      await context.close();
    },
  });
}
