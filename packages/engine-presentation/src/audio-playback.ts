/** Browser-safe audio playback port. AudioContext is injected so node consumers stay silent. */
export type AudioBufferLike = object;

export type AudioSourceLike = {
  buffer: AudioBufferLike | null;
  connect(destination: AudioConnectionTarget): void;
  start(): void;
  stop(): void;
  onended: (() => void) | null;
};

export type AudioGainLike = {
  kind: "audio-gain";
  gain: { value: number };
  connect(destination: AudioOutputDestination): void;
};

export type AudioOutputDestination = Readonly<{
  kind: "audio-output";
  target: object;
}>;

export type AudioConnectionTarget = AudioGainLike | AudioOutputDestination;

export type AudioContextLike = {
  readonly destination: AudioOutputDestination;
  decodeAudioData(bytes: ArrayBuffer): Promise<AudioBufferLike>;
  createBufferSource(): AudioSourceLike;
  createGain(): AudioGainLike;
  close(): Promise<void>;
};

export type AudioPlaybackPort = Readonly<{
  load(name: string, bytes: Uint8Array): Promise<void>;
  play(name: string): Promise<void>;
  stop(name: string): void;
  setMasterVolume(volume: number): void;
  dispose(): Promise<void>;
}>;

export function createAudioPlaybackPort(input: Readonly<{
  createAudioContext: () => AudioContextLike;
  kids?: boolean;
}>): AudioPlaybackPort {
  if (input.kids) throw new Error("AUDIO_KIDS_DENIED");
  const context = input.createAudioContext();
  const gain = context.createGain();
  gain.connect(context.destination);
  const buffers = new Map<string, AudioBufferLike>();
  const sources = new Map<string, AudioSourceLike>();
  let disposed = false;

  const requireLive = () => {
    if (disposed) throw new Error("AUDIO_PORT_DISPOSED");
  };

  return Object.freeze({
    async load(name, bytes) {
      requireLive();

      if (name.length === 0 || bytes.byteLength === 0) throw new Error("AUDIO_CLIP_INVALID");
      const copy = bytes.slice();
      buffers.set(name, await context.decodeAudioData(copy.buffer));
    },
    async play(name) {
      requireLive();
      const buffer = buffers.get(name);

      if (buffer === undefined) throw new Error("AUDIO_CLIP_UNKNOWN");
      sources.get(name)?.stop();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.onended = () => { if (sources.get(name) === source) sources.delete(name); };

      sources.set(name, source);
      source.start();
    },
    stop(name) { sources.get(name)?.stop(); sources.delete(name); },
    setMasterVolume(volume) {
      requireLive();

      if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error("AUDIO_VOLUME_INVALID");
      gain.gain.value = volume;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;

      for (const source of sources.values()) source.stop();
      sources.clear();
      buffers.clear();
      await context.close();
    },
  });
}
