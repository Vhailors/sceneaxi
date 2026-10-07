import type { AudioContextLike, AudioNodeLike } from "@sceneaxi/engine-presentation";
import { DESKTOP_ACTIVE_DOCUMENT_PATH } from "../../lib/bridge-contract.js";
import type { ViewportServices } from "./services.js";

type AudioClipManifest = Readonly<{
  assetId: string;
  mediaType: "audio/wav" | "audio/ogg" | "audio/mpeg";
  digest: string;
  byteLength: number;
}>;

function audioClipManifest<Input>(value: Input): readonly AudioClipManifest[] | null {
  if (!Array.isArray(value)) return null;
  const clips: AudioClipManifest[] = [];

  for (const item of value) {
    if (!isObjectLike(item)) return null;
    const clip = item;

    if (
      !("assetId" in clip) || !("mediaType" in clip) || !("digest" in clip) || !("byteLength" in clip) ||
      !isText(clip["assetId"]) || clip["assetId"].length === 0 ||
      (clip["mediaType"] !== "audio/wav" && clip["mediaType"] !== "audio/ogg" && clip["mediaType"] !== "audio/mpeg") ||
      !isText(clip["digest"]) || !/^sha256:[0-9a-f]{64}$/.test(clip["digest"]) ||
      !isNumeric(clip["byteLength"]) || !Number.isSafeInteger(clip["byteLength"]) || clip["byteLength"] < 1 || clip["byteLength"] > 8 * 1024 * 1024
    ) return null;
    clips.push({
      assetId: clip["assetId"],
      mediaType: clip["mediaType"],
      digest: clip["digest"],
      byteLength: clip["byteLength"],
    });
  }

  return clips;
}

function browserAudioContext(): AudioContextLike {
  const context = new AudioContext();
  void context.resume();
  const nodes = new WeakMap<object, AudioNode>();
  let analyser: AnalyserNode | null = null;

  const wrap = (node: AudioNode) => {
    const facade = { connect: (destination: AudioNodeLike) => node.connect(resolve(destination)) };
    nodes.set(facade, node);

    return facade;
  };

  const resolve = (facade: AudioNodeLike): AudioNode => {
    const node = nodes.get(facade);

    if (node === undefined) throw new Error("AUDIO_NODE_INVALID");

    return node;
  };

  return {
    destination: wrap(context.destination),
    decodeAudioData: (bytes) => context.decodeAudioData(bytes),
    observeMasterGain: (gain) => {
      analyser = context.createAnalyser();
      resolve(gain).connect(analyser);
      analyser.connect(context.destination);

      return wrap(analyser);
    },
    measureOutputRms: () => {
      if (analyser === null) return 0;
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      let energy = 0;

      for (const sample of samples) energy += sample * sample;

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
          buffer = value;
          // SAFETY: playback buffers are returned by this context's decodeAudioData.
          node.buffer = value as AudioBuffer | null;
        },
        get onended() { return node.onended === null ? null : () => node.onended?.(new Event("ended")); },
        set onended(handler) { node.onended = handler === null ? null : () => handler(); },
        connect: (destination) => { node.connect(resolve(destination)); },
        start: () => node.start(),
        stop: () => node.stop(),
      };
    },
    close: () => context.close(),
  };
}

function mountAudioControls(
  services: ViewportServices,
  clips: readonly AudioClipManifest[],
): () => void {
  const { stage: host, request, createAudioPlaybackPort, report } = services;

  if (clips.length === 0) return () => undefined;
  const controls = host.ownerDocument.createElement("div");
  controls.dataset.audioPlayback = "true";
  controls.style.cssText = "position:absolute;top:12px;right:12px;z-index:10;display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-1,4px);padding:var(--space-1,4px);border:1px solid var(--line-control);border-radius:var(--r-control);background:var(--overlay);accent-color:var(--accent);pointer-events:auto";
  controls.setAttribute("aria-label", "Play session audio");
  const volume = host.ownerDocument.createElement("input");
  volume.type = "range";
  volume.min = "0";
  volume.max = "1";
  volume.step = "0.01";
  volume.value = "1";
  volume.setAttribute("aria-label", "Audio volume");
  let audio: ReturnType<typeof createAudioPlaybackPort> | null = null;
  let disposed = false;
  const buttons: HTMLButtonElement[] = [];
  volume.addEventListener("input", () => {
    if (audio !== null) {
      audio.setVolume(Number(volume.value));
      controls.dataset.audioVolume = volume.value;
    }
  });
  controls.append(volume);

  for (const clip of clips) {
    const button = host.ownerDocument.createElement("button");
    button.type = "button";
    button.className = "ui-control";
    button.textContent = `Play ${clip.assetId}`;
    button.addEventListener("click", () => {
      try {
        audio ??= createAudioPlaybackPort(browserAudioContext);
        audio.setVolume(Number(volume.value));
        controls.dataset.audioVolume = volume.value;
      } catch {
        report.openPathLine(`Audio refused: AUDIO_CONTEXT_UNAVAILABLE ${clip.assetId}`);

        return;
      }

      const playback = audio;
      void (async () => {
        const result = await request({ action: "audio-asset", payload: { assetId: clip.assetId, documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH } });

        if (!result.ok || !isObjectLike(result.data)) {
          report.openPathLine(`Audio refused: AUDIO_CLIP_UNKNOWN ${clip.assetId}`);

          return;
        }

        const data = result.data;

        if (!isObjectLike(data) || !("bytesBase64" in data)) {
          report.openPathLine(`Audio refused: AUDIO_CLIP_INVALID ${clip.assetId}`);

          return;
        }

        const encoded = data["bytesBase64"];

        if (
          !("assetId" in data) || !("mediaType" in data) || !("digest" in data) || !("byteLength" in data) ||
          data["assetId"] !== clip.assetId || data["mediaType"] !== clip.mediaType ||
          data["digest"] !== clip.digest || data["byteLength"] !== clip.byteLength ||
          !isText(encoded) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)
        ) {
          report.openPathLine(`Audio refused: AUDIO_CLIP_INVALID ${clip.assetId}`);

          return;
        }

        const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
        const digest = `sha256:${[...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;

        if (bytes.byteLength !== clip.byteLength || digest !== clip.digest) {
          report.openPathLine(`Audio refused: AUDIO_CLIP_INVALID ${clip.assetId}`);

          return;
        }

        try {
          await playback.load(clip.assetId, bytes);

          if (!disposed) {
            playback.play(clip.assetId);
            button.dataset.audioState = "started";

            const updateRms = () => {
              if (disposed || button.dataset.audioState !== "started") return;
              controls.dataset.audioRms = String(playback.measureOutputRms());
              requestAnimationFrame(updateRms);
            };

            requestAnimationFrame(updateRms);
          }
        } catch {
          if (!disposed) report.openPathLine(`Audio refused: AUDIO_DECODE_FAILED ${clip.assetId}`);
        }
      })().catch(() => {
        if (!disposed) report.openPathLine(`Audio refused: AUDIO_PLAYBACK_FAILED ${clip.assetId}`);
      });
    });
    buttons.push(button);
    controls.append(button);
  }

  host.append(controls);

  return () => {
    if (disposed) return;
    disposed = true;

    if (audio === null) controls.dataset.audioContextDisposed = "true";
    else {
      const closing = audio;
      closing.stopAll();
      // Measure after the running graph passes the stopped sources: closing
      // freezes the analyser on its last buffer. Preserve the existing delay.
      void new Promise((resolve) => setTimeout(resolve, 100))
        .then(() => {
          controls.dataset.audioRms = String(closing.measureOutputRms());

          return closing.dispose();
        })
        .then(
          () => { controls.dataset.audioContextDisposed = "true"; },
          () => report.openPathLine("Audio refused: AUDIO_CONTEXT_CLOSE_FAILED"),
        );
    }

    for (const button of buttons) {
      if (button.dataset.audioState === "started") button.dataset.audioState = "stopped";
    }

    controls.remove();
  };
}

export function installAudioControls(services: ViewportServices) {
  let disposeAudioControls: (() => void) | null = null;

  const stop = () => {
    disposeAudioControls?.();
    disposeAudioControls = null;
  };

  return {
    stop,
    play: <Input>(mountable: Input) => {
      stop();

      const projectedClips = isObjectLike(mountable) && "audioClips" in mountable
        ? mountable.audioClips
        : [];

      const clips = audioClipManifest(projectedClips);

      if (clips === null) {
        services.report.openPathLine("Audio refused: AUDIO_CLIP_MANIFEST_INVALID");
      } else {
        disposeAudioControls = mountAudioControls(services, clips);
      }
    },
  };
}

function isObjectLike<Value>(value: Value): value is Value & object { return typeof value === "object" && value !== null; }

function isText(value: unknown): value is string { return typeof value === "string"; }

function isNumeric(value: unknown): value is number { return typeof value === "number"; }
