import { isJsonObject } from "@sceneaxi/schemas";
import { formatSafeRarityEvidence } from "@sceneaxi/authoring-core/rarity-evidence";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_RARITY_PROPOSAL_EVENT,
  DESKTOP_VIEWPORT_PLAY_EVENT,
  DESKTOP_VIEWPORT_STOP_EVENT,
  type DesktopRarityEvidence,
} from "../../lib/bridge-contract.js";
import { rarityInvalidationMatches } from "../assistant-inspection.js";
import { playableExercise, type PlayableExercise } from "../playback-report.js";
import { playDesktopSceneAnimations, resetDesktopSceneAnimations } from "../viewport-playback.js";
import type { installAudioControls } from "./audio-controls.js";
import { refusalText } from "./overlay-report.js";
import { synchronizeScene } from "./scene-sync.js";
import type { ViewportServices } from "./services.js";

type RarityReportable = {
  readonly rarity?: DesktopRarityEvidence;
  readonly raritySession?: { readonly replayDigest?: unknown };
};

export function installPlayLoop(
  services: ViewportServices,
  audio: ReturnType<typeof installAudioControls>,
) {
  const listenerOptions = services.signal === undefined ? undefined : { signal: services.signal };
  let animationStartedAt: number | null = null;
  let displayedViewportRarityDigest: string | null = null;
  const { stage, backend, mounts, report } = services;
  services.onFrame(() => {
    if (animationStartedAt !== null) {
      playDesktopSceneAnimations({ backend, scene: services.scene, time: (performance.now() - animationStartedAt) / 1000 });
    }
  });

  document.addEventListener(DESKTOP_RARITY_PROPOSAL_EVENT, (event: Event) => {
    if (services.signal?.aborted) return;

    if (!(event instanceof CustomEvent) || !rarityInvalidationMatches(displayedViewportRarityDigest, event.detail)) {
      return;
    }

    displayedViewportRarityDigest = null;
    report.clearRarityEvidence();
  }, listenerOptions);

  document.addEventListener(DESKTOP_VIEWPORT_PLAY_EVENT, (event: Event) => {
    if (services.signal?.aborted) return;

    if (!(event instanceof CustomEvent)) return;
    report.reportNextFrame();

    const detail = event.detail;

    const playable = playableExercise(event.detail);

    if (!isJsonObject(detail) || playable === null) return;
    services.inputContext = "play";
    // SAFETY: playableExercise validated the playback envelope; rarity evidence is independently validated by formatSafeRarityEvidence below.
    const exercise = playable as PlayableExercise & RarityReportable;
    audio.play(exercise.mountable);

    if (!synchronizeScene(services, exercise.mountable)) return;
    animationStartedAt = performance.now();
    playDesktopSceneAnimations({ backend, scene: services.scene, time: 0 });
    const frame = mounts.render();
    report.updatePixelsMeta(frame);
    Object.defineProperty(detail, "accepted", { value: true, writable: true, configurable: true, enumerable: true });
    Object.defineProperty(detail, "frame", { value: frame.frame, writable: true, configurable: true, enumerable: true });
    stage.dataset.playback = "acknowledged";
    report.openPathLine(
      `kernel playback acknowledged: ${exercise.tickDigests.length} ticks advanced · digest ${exercise.initialDigest.slice(0, 18)}… → ${exercise.tickDigests.at(-1)?.slice(0, 18)}… · composed scene redrawn at viewport frame ${frame.frame}`,
    );
    const rarity = formatSafeRarityEvidence(exercise.rarity, exercise.raritySession);
    displayedViewportRarityDigest = rarity === null || exercise.rarity === undefined
      ? null
      : exercise.rarity.namespaceDigest;

    if (rarity === null) report.clearRarityEvidence();
    else report.rarityEvidenceLine(rarity);
  }, listenerOptions);

  document.addEventListener(DESKTOP_VIEWPORT_STOP_EVENT, () => {
    if (services.signal?.aborted) return;
    audio.stop();
    animationStartedAt = null;
    services.inputContext = "editor";
    resetDesktopSceneAnimations({ backend, scene: services.scene });
  }, listenerOptions);

  return {
    resetAnimation: () => { animationStartedAt = null; },
    // Runs after the root starts the loop and binds the scene-open listener.
    openPath: async () => {
      try {
        const openPath = await services.request({
          action: "open-path",
          payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
        });

        if (services.signal?.aborted) return;

          if (openPath.ok) {
          if (!isJsonObject(openPath.data) || !isText(openPath.data.initialDigest) || !Array.isArray(openPath.data.tickDigests) || !openPath.data.tickDigests.every(isText)) return;

          // SAFETY: printable digest fields are validated above; formatSafeRarityEvidence independently validates optional rarity evidence before displaying it.
          const exercise = openPath.data as RarityReportable & {
            initialDigest: string;
            tickDigests: string[];
          };

          report.openPathLine(
            `kernel open path: ${exercise.tickDigests.length} ticks advanced · digest ${exercise.initialDigest.slice(0, 18)}… → ${exercise.tickDigests[exercise.tickDigests.length - 1]?.slice(0, 18)}… · session closed`,
          );
          const rarity = formatSafeRarityEvidence(exercise.rarity, exercise.raritySession);
          displayedViewportRarityDigest = rarity === null || exercise.rarity === undefined
            ? null
            : exercise.rarity.namespaceDigest;

          if (rarity === null) report.clearRarityEvidence();
          else report.rarityEvidenceLine(rarity);
        } else {
          report.openPathLine(`kernel open path refused: ${openPath.reason} — ${openPath.message}`);
        }
      } catch (error) {
          if (services.signal?.aborted) return;
        report.openPathLine(`kernel open path refused: ${refusalText(error)}`);
      }
    },
  };
}

function isText(value: unknown): value is string { return typeof value === "string"; }
