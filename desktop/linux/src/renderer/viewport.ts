/**
 * The renderer-process live viewport: the desktop tier's one renderer-owning module.
 *
 * Runs inside the Engine Desktop chrome document in the packaged window. It asks
 * the main-process bridge for the composed `MountableScene` payload, mounts it on
 * the one Three presentation core through the ADR 0002 seam — exactly the calls the
 * umbrella's `sculpt-viewport.tsx` makes — and reports the real frame back over the
 * bridge so the packaged-app smoke test can see what was actually claimed.
 *
 * Honesty rules carried from the rest of the product:
 * - The chrome's `sceneaxi-pixels-drawn` meta is updated only from a real
 *   presentation frame's `pixelsDrawn`; nothing here asserts pixels it never drew.
 * - The frame report line prints the frame's own `surface`/`pixelsDrawn` fields.
 * - On any refusal the viewport names it in the report line and draws nothing.
 *
 * This file may not import Electron (enforced by `pnpm check:desktop`); it reaches
 * the main process only through the preload-exposed bridge global.
 */
import {
  createSculptMountApi,
  createThreeRenderLoop,
  createThreeSculptPresentationBackend,
  type SculptPresentationFrame,
  type ThreePresentationCoreOptions,
} from "@sceneaxi/engine-presentation";
import { formatSafeRarityEvidence } from "@sceneaxi/authoring-core/rarity-evidence";
import { createDesktopAssistantViewportController } from "../lib/assistant-viewport.js";
import type { DesktopAssistantProfile } from "../lib/bridge.js";
import { desktopAssistantRuntimeSignal } from "./assistant-runtime.js";
import { decideAssistantStart } from "./assistant-start.js";
import {
  assistantRaritySettlement,
  assistantRarityInvalidation,
  assistantRarityResultDigest,
  assistantRarityResultEvent,
  assistantRarityResultSettlement,
  assistantInspectionText,
  isRarityProposalResult,
  rarityInvalidationMatches,
} from "./assistant-inspection.js";
import {
  pollAssistantJob,
  watchAssistantRaritySettlement,
} from "./assistant-poll.js";
import {
  pixelsMetaContent,
  playableExercise,
  type PlayableExercise,
} from "./playback-report.js";
import type {
  DesktopByoConfigurationRequest,
  DesktopByoConfigurationResponse,
} from "../lib/byo-configuration-contract.js";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_BRIDGE_GLOBAL,
  DESKTOP_BRIDGE_REFUSALS,
  DESKTOP_RARITY_PROPOSAL_EVENT,
  DESKTOP_VIEWPORT_PLAY_EVENT,
  PIXELS_META_NAME,
  type DesktopBridgeResponse,
  type DesktopRarityEvidence,
} from "../lib/bridge-contract.js";
import {
  desktopMountablePayload,
  mountDesktopScene,
  synchronizeViewportScene,
} from "./viewport-playback.js";
import { installDesktopByoConfigurationSurface } from "./byo-configuration.js";

type BridgeGlobal = {
  request(request: unknown): Promise<DesktopBridgeResponse>;
  configureByo?: (
    request: DesktopByoConfigurationRequest,
  ) => Promise<DesktopByoConfigurationResponse>;
};

// A rejected bridge call is worth retrying — the next frame is milliseconds away —
// but a structural rejection (no handler on the channel, a payload that cannot be
// cloned) never recovers, and retrying it per frame would burn IPC for the life of
// the session. A few attempts, then the refusal stands on its own line.
const FRAME_REPORT_MAX_ATTEMPTS = 3;

const REPORT_ID = "desktop-live-viewport-report";
const OPEN_PATH_ID = "desktop-live-viewport-open-path";
const FRAME_REPORT_ID = "desktop-live-viewport-frame-report";
const RARITY_EVIDENCE_ID = "desktop-live-viewport-rarity-evidence";

function bridge(): BridgeGlobal | null {
  const candidate = (globalThis as Record<string, unknown>)[DESKTOP_BRIDGE_GLOBAL];
  if (typeof candidate !== "object" || candidate === null) return null;
  const request = (candidate as Record<string, unknown>)["request"];
  return typeof request === "function" ? (candidate as BridgeGlobal) : null;
}

function overlayLine(host: Element, id: string, kind: string, bottom: string, text: string): void {
  let line = document.getElementById(id);
  if (line === null) {
    line = document.createElement("p");
    line.id = id;
    line.className = "viewport-note";
    line.setAttribute("data-live-viewport", kind);
    // An overlay above the canvas: absolute siblings paint in DOM order, and the
    // note must stay readable over whatever the frame drew.
    line.style.position = "absolute";
    line.style.left = "12px";
    line.style.right = "12px";
    line.style.bottom = bottom;
    line.style.margin = "0";
    line.style.textAlign = "left";
    line.style.maxWidth = "none";
    line.style.pointerEvents = "none";
    // `.viewport-note` sets no `white-space`, so a multi-line body would collapse
    // into one run-on paragraph. The safe-evidence overlay is the one line whose
    // field boundaries carry meaning; single-line notes are unaffected.
    line.style.whiteSpace = "pre-wrap";
    host.append(line);
  }
  line.textContent = text;
}

/**
 * Remove an overlay line rather than blanking it.
 *
 * A report that has nothing to say about this run must not keep the previous
 * run's answer on screen: after an Undo takes the accepted namespace back out of
 * the project, the next Play carries no rarity, and an overlay that is only ever
 * written would still be printing that namespace's tier, seed, and digests.
 */
function clearOverlayLine(id: string): void {
  document.getElementById(id)?.remove();
}

function reportLine(host: Element, text: string): void {
  overlayLine(host, REPORT_ID, "report", "8px", text);
}

// The frame report rewrites itself every 15 frames, so anything that happens after
// the render loop starts needs its own line or it is erased within ~250ms.
function openPathLine(host: Element, text: string): void {
  overlayLine(host, OPEN_PATH_ID, "open-path", "52px", text);
}

function frameReportLine(host: Element, text: string): void {
  overlayLine(host, FRAME_REPORT_ID, "frame-report", "96px", text);
}

function rarityEvidenceLine(host: Element, text: string): void {
  overlayLine(host, RARITY_EVIDENCE_ID, "rarity-evidence", "140px", text);
}

function refusalText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function updatePixelsMeta(frame: SculptPresentationFrame): void {
  const content = pixelsMetaContent(frame);
  if (content === null) return;
  document
    .querySelector(`meta[name="${PIXELS_META_NAME}"]`)
    ?.setAttribute("content", content);
}

function frameText(frame: SculptPresentationFrame): string {
  return [
    `backend ${frame.backend}`,
    `label ${frame.label}`,
    `surface ${frame.surface ?? "unreported"}`,
    `pixelsDrawn ${frame.pixelsDrawn ?? "unreported"}`,
    `drawCalls ${frame.drawCalls}`,
    `mounted ${frame.instanceIds.join(", ") || "none"}`,
  ].join(" · ");
}

function signalAssistantRuntime(
  signal: Readonly<{ runtime: "none" | "local"; message?: string }>,
): void {
  const shell = document.querySelector<HTMLElement>(".shell");
  const eventName = shell?.dataset.assistantRuntimeEvent;
  if (eventName === undefined) return;
  document.dispatchEvent(
    new CustomEvent(eventName, {
      detail: signal,
    }),
  );
}

function signalAssistantRuntimeUnavailable(message: string): void {
  signalAssistantRuntime(desktopAssistantRuntimeSignal({ status: "refused", message }));
}

/**
 * One refusal, said in both places it has to be said: the viewport's own report
 * line, and the assistant composer that would otherwise still invite a prompt it
 * has no runtime to answer.
 */
function refuseLiveViewport(stage: Element | null, message: string): void {
  if (stage !== null) reportLine(stage, `Live viewport refused: ${message}`);
  signalAssistantRuntimeUnavailable(
    `${message} Assistant Build has no live viewport to mount a typed artifact into.`,
  );
}

function assistantProfile(shell: HTMLElement): DesktopAssistantProfile {
  const id = shell.dataset.profile;
  if (id === "web") return "@sceneaxi/profile-web";
  if (id === "kids") return "@sceneaxi/profile-kids";
  return "@sceneaxi/profile-game";
}

type RarityReportable = {
  readonly rarity?: DesktopRarityEvidence;
  readonly raritySession?: { readonly replayDigest?: unknown };
};

/**
 * Run/viewport's rarity provenance, on its own line above the open-path report.
 *
 * The body is the shared `formatSafeRarityEvidence()` output, not a clause
 * written here: this is one of the four surfaces required to display matching
 * provenance, and a second hand-written summary is exactly the drift the shared
 * formatter exists to prevent. Only the session attribution is added, because
 * the digests on the report line beside it belong to the composed scene session
 * the viewport draws while the namespace is verified in its own product session.
 */
function rarityEvidenceReport(exercise: RarityReportable): string | null {
  return formatSafeRarityEvidence(exercise.rarity, exercise.raritySession);
}

export function createDesktopPresentationBackend(
  options: ThreePresentationCoreOptions = {},
) {
  return createThreeSculptPresentationBackend(options);
}

function installAssistantProductFlow(
  stage: Element,
  port: BridgeGlobal,
  mounts: ReturnType<typeof createSculptMountApi>,
  backend: ReturnType<typeof createThreeSculptPresentationBackend>,
): boolean {
  const shell = document.querySelector<HTMLElement>(".shell");
  const prompt = document.querySelector<HTMLTextAreaElement>("#assistant-prompt");
  const send = document.querySelector<HTMLElement>("#assistant-send");
  const status = document.querySelector<HTMLElement>("[data-assistant-status]");
  const resultView = document.querySelector<HTMLElement>("[data-assistant-result]");
  const retry = document.querySelector<HTMLButtonElement>("#assistant-retry");
  const manipulatorBar = stage.querySelector<HTMLElement>("[data-assistant-manipulators]");
  const sendControls = Array.from(
    document.querySelectorAll<HTMLElement>("[data-action='assistant-send']"),
  );
  const manipulatorControls = Array.from(
    manipulatorBar?.querySelectorAll<HTMLButtonElement>(
      "[data-action='assistant-manipulator']",
    ) ?? [],
  );
  if (
    shell === null ||
    prompt === null ||
    send === null ||
    status === null ||
    resultView === null ||
    retry === null ||
    manipulatorBar === null ||
    sendControls.length === 0 ||
    !sendControls.includes(send) ||
    !sendControls.includes(retry) ||
    manipulatorControls.length === 0
  ) {
    return false;
  }
  let running = false;
  let assistantRunVersion = 0;
  let activeRarityProposalDigest: string | null = null;
  let displayedRarityResultDigest: string | null = null;
  const assistantViewport = createDesktopAssistantViewportController(mounts);

  document.addEventListener(DESKTOP_RARITY_PROPOSAL_EVENT, (event: Event) => {
    const invalidation = assistantRarityInvalidation(
      displayedRarityResultDigest,
      (event as CustomEvent).detail,
    );
    if (invalidation !== null) {
      activeRarityProposalDigest = null;
      displayedRarityResultDigest = null;
      resultView.textContent = invalidation.evidenceText;
      resultView.setAttribute("hidden", "");
      retry.removeAttribute("hidden");
      status.textContent = invalidation.status;
      running = false;
      return;
    }
    const settlement = assistantRaritySettlement(
      activeRarityProposalDigest,
      (event as CustomEvent).detail,
    );
    if (settlement === null) return;
    activeRarityProposalDigest = settlement.activeNamespaceDigest;
    const detail = (event as CustomEvent<{
      evidence?: { namespaceDigest?: unknown };
    }>).detail;
    const settledDigest = detail?.evidence?.namespaceDigest;
    displayedRarityResultDigest = settlement.evidenceVisible && typeof settledDigest === "string"
      ? settledDigest
      : null;
    resultView.textContent = settlement.evidenceText;
    if (settlement.evidenceVisible) resultView.removeAttribute("hidden");
    else resultView.setAttribute("hidden", "");
    retry.removeAttribute("hidden");
    status.textContent = settlement.status;
    running = false;
  });

  manipulatorControls.forEach((control) => {
    control.addEventListener("click", () => {
      if (control.getAttribute("aria-disabled") === "true") return;
      assistantViewport.manipulate(control.dataset.value);
    });
  });

  const refused = (reason: string, message: string): void => {
    running = false;
    status.textContent = `${reason} — ${message}`;
    retry?.removeAttribute("hidden");
  };

  const poll = async (): Promise<void> => {
    const outcome = await pollAssistantJob({
      request: (request) => port.request(request),
      onSnapshot: (job) => {
        const latest = job.latestProgress;
        if (latest !== null) status.textContent = `${latest.percent}% · ${latest.message}`;
      },
    });
    if (!outcome.ok) {
      refused(outcome.reason, outcome.message);
      return;
    }
    const job = outcome.job;
    const result = outcome.result;
    activeRarityProposalDigest = assistantRarityResultDigest(result);
    if (isRarityProposalResult(result)) {
      displayedRarityResultDigest = result.evidence.namespaceDigest;
      const settlement = assistantRarityResultSettlement(result);
      const lifecycleEvent = assistantRarityResultEvent(result);
      if (settlement !== null) {
        if (lifecycleEvent !== null) {
          document.dispatchEvent(
            new CustomEvent(DESKTOP_RARITY_PROPOSAL_EVENT, { detail: lifecycleEvent }),
          );
          void port.request({
            action: "assistant",
            payload: { op: "abandon", jobId: job.jobId },
          }).catch(() => undefined);
        }
        if (!settlement.evidenceVisible) displayedRarityResultDigest = null;
        resultView.textContent = settlement.evidenceText;
        if (settlement.evidenceVisible) resultView.removeAttribute("hidden");
        else resultView.setAttribute("hidden", "");
        retry.removeAttribute("hidden");
        status.textContent = settlement.status;
        running = false;
        return;
      }
      const replayed = result.replayed;
      resultView.textContent = formatSafeRarityEvidence(result.evidence) ?? "";
      resultView.removeAttribute("hidden");
      retry?.setAttribute("hidden", "");
      document.dispatchEvent(
        new CustomEvent(DESKTOP_RARITY_PROPOSAL_EVENT, {
          detail: lifecycleEvent,
        }),
      );
      status.textContent = replayed
        ? "Identical rarity event replayed · project bytes unchanged, so nothing was staged for review."
        : "Rarity proposal staged · review the canonical diff before Accept or Reject.";
      running = false;
      if (!replayed) {
        const watchedVersion = assistantRunVersion;
        void watchAssistantRaritySettlement({
          request: (request) => port.request(request),
          jobId: job.jobId,
          namespaceDigest: result.evidence.namespaceDigest,
          active: () => assistantRunVersion === watchedVersion,
        }).then((settled) => {
          if (settled === null || assistantRunVersion !== watchedVersion) return;
          const detail = assistantRarityResultEvent(settled);
          if (detail === null) return;
          document.dispatchEvent(
            new CustomEvent(DESKTOP_RARITY_PROPOSAL_EVENT, { detail }),
          );
          void port.request({
            action: "assistant",
            payload: { op: "abandon", jobId: job.jobId },
          }).catch(() => undefined);
        });
      }
      return;
    }
    assistantViewport.replace(result.mountable);
    displayedRarityResultDigest = null;
    backend.frameMountedContent();
    manipulatorBar?.removeAttribute("hidden");
    resultView.textContent = assistantInspectionText(job);
    resultView.removeAttribute("hidden");
    retry?.setAttribute("hidden", "");
    status.textContent =
      "Mounted in the live center viewport · translate/rotate/scale manipulators active · drag to orbit, wheel to zoom.";
    running = false;
  };

  const start = async (): Promise<void> => {
    if (running) return;
    const decision = decideAssistantStart({
      mode: shell.dataset.assistantMode,
      route: shell.dataset.assistantRoute,
      profile: assistantProfile(shell),
      prompt: prompt.value,
    });
    if (!decision.ok) {
      refused(decision.reason, decision.message);
      return;
    }
    running = true;
    retry?.setAttribute("hidden", "");
    resultView.setAttribute("hidden", "");
    status.textContent = "Starting assistant action…";
    const response = await port.request({
      action: "assistant",
      payload: decision.payload,
    });
    if (!response.ok) {
      refused(response.reason, response.message);
      return;
    }
    assistantRunVersion += 1;
    activeRarityProposalDigest = assistantRarityResultDigest(null);
    displayedRarityResultDigest = null;
    await poll();
  };

  sendControls.forEach((control) => {
    control.addEventListener("click", () => {
      if (control.getAttribute("aria-disabled") === "true") return;
      void start().catch((error: unknown) =>
        refused(DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed, refusalText(error)),
      );
    });
  });
  return true;
}

async function mountLiveViewport(): Promise<void> {
  const stage = document.querySelector<HTMLElement>(".viewport");
  if (stage === null) {
    refuseLiveViewport(null, "the chrome document has no viewport stage.");
    return;
  }

  const port = bridge();
  if (port === null) {
    refuseLiveViewport(stage, "the desktop bridge is not exposed.");
    return;
  }
  const byoConfigurationBound = installDesktopByoConfigurationSurface(port);
  if (!byoConfigurationBound) {
    openPathLine(
      stage,
      "BYOK configuration refused: the chrome document did not expose the assistant route controls the configuration surface binds to.",
    );
  }

  const sceneResponse = await port.request({
    action: "scene",
    payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
  });
  if (!sceneResponse.ok) {
    refuseLiveViewport(stage, `${sceneResponse.reason} — ${sceneResponse.message}`);
    return;
  }
  if (!desktopMountablePayload(sceneResponse.data)) {
    refuseLiveViewport(stage, "the active Scene Document payload is invalid.");
    return;
  }
  let scene = sceneResponse.data;
  let displayedViewportRarityDigest: string | null = null;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("data-live-viewport", "canvas");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const width = Math.max(1, stage.clientWidth);
  const height = Math.max(1, stage.clientHeight);
  canvas.width = width;
  canvas.height = height;
  // Painted above the decorative backdrop, below the notes and the sculpt
  // progress region — absolute siblings stack in DOM order, so position matters.
  const backdrop = stage.querySelector(".viewport-backdrop");
  if (backdrop !== null) backdrop.insertAdjacentElement("afterend", canvas);
  else stage.prepend(canvas);

  let backend: ReturnType<typeof createThreeSculptPresentationBackend>;
  try {
    backend = createDesktopPresentationBackend({
      canvas,
      // Transparent clear: the chrome's own viewport gradient stays visible
      // behind the mounted scene instead of a second background fighting it.
      background: null,
      viewport: {
        width,
        height,
        pixelRatio: Math.min(globalThis.devicePixelRatio || 1, 2),
      },
    });
  } catch (error) {
    canvas.remove();
    refuseLiveViewport(stage, `no WebGL surface — ${refusalText(error)}`);
    return;
  }

  const mounts = createSculptMountApi(backend);
  try {
    mountDesktopScene(mounts, scene);
    backend.frameMountedContent();
    backend.camera.attach(canvas);
  } catch (error) {
    mounts.dispose();
    canvas.remove();
    refuseLiveViewport(stage, `could not mount the composed scene — ${refusalText(error)}`);
    return;
  }

  // The drawing buffer was sized once from the stage; the window is resizable and
  // the canvas is CSS-stretched, so without this a resize scales a stale buffer.
  const applyViewport = (): void => {
    backend.resize(
      Math.max(1, stage.clientWidth),
      Math.max(1, stage.clientHeight),
      Math.min(globalThis.devicePixelRatio || 1, 2),
    );
  };
  if (typeof ResizeObserver === "function") new ResizeObserver(applyViewport).observe(stage);

  // The chrome's inert note says no renderer is mounted on this surface. That
  // was true until this line, so leaving it visible would be the lie — remove it
  // only now that a real backend owns the canvas. On any refusal above, it stays.
  stage.querySelector(".viewport-note-inert")?.remove();

  let printed = false;
  let frameReportSettled = false;
  let frameReportInFlight = false;
  let frameReportAttempts = 0;
  const loop = createThreeRenderLoop({
    onFrame: () => {
      const frame = mounts.render();
      updatePixelsMeta(frame);
      if (!printed || frame.frame % 15 === 0) {
        printed = true;
        reportLine(stage, `${frameText(frame)} · scene ${scene.sceneId}`);
      }
      if (!frameReportSettled && !frameReportInFlight) {
        frameReportInFlight = true;
        frameReportAttempts += 1;
        port.request({ action: "frame-report", payload: frame }).then(
          (response) => {
            frameReportInFlight = false;
            frameReportSettled = true;
            if (!response.ok) {
              frameReportLine(
                stage,
                `frame report refused: ${response.reason} — ${response.message}`,
              );
            }
          },
          (error: unknown) => {
            frameReportInFlight = false;
            const exhausted = frameReportAttempts >= FRAME_REPORT_MAX_ATTEMPTS;
            frameReportSettled = exhausted;
            frameReportLine(
              stage,
              `frame report refused: ${refusalText(error)} — ${
                exhausted
                  ? `giving up after ${frameReportAttempts} attempts`
                  : `retrying (attempt ${frameReportAttempts} of ${FRAME_REPORT_MAX_ATTEMPTS})`
              }`,
            );
          },
        );
      }
    },
  });
  loop.start();
  const assistantBound = installAssistantProductFlow(stage, port, mounts, backend);
  signalAssistantRuntime(
    desktopAssistantRuntimeSignal({ status: "mounted", controlsBound: assistantBound }),
  );

  document.addEventListener(DESKTOP_RARITY_PROPOSAL_EVENT, (event: Event) => {
    if (!rarityInvalidationMatches(displayedViewportRarityDigest, (event as CustomEvent).detail)) {
      return;
    }
    displayedViewportRarityDigest = null;
    clearOverlayLine(RARITY_EVIDENCE_ID);
  });

  document.addEventListener(DESKTOP_VIEWPORT_PLAY_EVENT, (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as {
      accepted?: unknown;
      frame?: unknown;
    } | null;
    const playable = playableExercise(event.detail);
    if (detail === null || playable === null) return;
    const exercise = playable as PlayableExercise & RarityReportable;
    const synchronized = synchronizeViewportScene({
      mounts,
      frameMountedContent: () => backend.frameMountedContent(),
      current: scene,
      next: exercise.mountable,
    });
    if (!synchronized.ok) return;
    scene = synchronized.scene;
    const frame = mounts.render();
    updatePixelsMeta(frame);
    detail.accepted = true;
    detail.frame = frame.frame;
    stage.dataset.playback = "acknowledged";
    openPathLine(
      stage,
      `kernel playback acknowledged: ${exercise.tickDigests.length} ticks advanced · digest ${exercise.initialDigest.slice(0, 18)}… → ${exercise.tickDigests.at(-1)?.slice(0, 18)}… · composed scene redrawn at viewport frame ${frame.frame}`,
    );
    const rarity = rarityEvidenceReport(exercise);
    displayedViewportRarityDigest = rarity === null || exercise.rarity === undefined
      ? null
      : exercise.rarity.namespaceDigest;
    if (rarity === null) clearOverlayLine(RARITY_EVIDENCE_ID);
    else rarityEvidenceLine(stage, rarity);
  });

  // Everything below runs after `loop.start()`, so it names itself on its own line
  // — a refusal written to the frame report would be overwritten by the next frame.
  try {
    const openPath = await port.request({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    if (openPath.ok) {
      const exercise = openPath.data as RarityReportable & {
        initialDigest: string;
        tickDigests: string[];
      };
      openPathLine(
        stage,
        `kernel open path: ${exercise.tickDigests.length} ticks advanced · digest ${exercise.initialDigest.slice(0, 18)}… → ${exercise.tickDigests[exercise.tickDigests.length - 1]?.slice(0, 18)}… · session closed`,
      );
      const rarity = rarityEvidenceReport(exercise);
      displayedViewportRarityDigest = rarity === null || exercise.rarity === undefined
        ? null
        : exercise.rarity.namespaceDigest;
      if (rarity === null) clearOverlayLine(RARITY_EVIDENCE_ID);
      else rarityEvidenceLine(stage, rarity);
    } else {
      openPathLine(stage, `kernel open path refused: ${openPath.reason} — ${openPath.message}`);
    }
  } catch (error) {
    openPathLine(stage, `kernel open path refused: ${refusalText(error)}`);
  }
}

// A bridge call rejects whenever the main-process handler throws rather than
// refusing by name; without this the canvas would already be in the DOM and the
// only trace would be an unhandled rejection, so the surface names it instead.
function startLiveViewport(): void {
  void mountLiveViewport().catch((error: unknown) => {
    refuseLiveViewport(document.querySelector(".viewport"), refusalText(error));
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startLiveViewport);
  } else {
    startLiveViewport();
  }
}
