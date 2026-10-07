import type { SculptPresentationFrame } from "@sceneaxi/engine-presentation";
import { PIXELS_META_NAME } from "../../lib/bridge-contract.js";
import { pixelsMetaContent } from "../playback-report.js";
import type { BridgeGlobal } from "./services.js";

// Retry a rejected call, but stop burning IPC on structural channel failures.
const FRAME_REPORT_MAX_ATTEMPTS = 3;

const REPORT_ID = "desktop-live-viewport-report";

const OPEN_PATH_ID = "desktop-live-viewport-open-path";

const FRAME_REPORT_ID = "desktop-live-viewport-frame-report";

const RARITY_EVIDENCE_ID = "desktop-live-viewport-rarity-evidence";

function overlayLine(host: Element, id: string, kind: string, bottom: string, text: string): void {
  let line = document.getElementById(id);

  if (line === null) {
    line = document.createElement("p");
    line.id = id;
    line.className = "viewport-note";
    line.setAttribute("data-live-viewport", kind);
    // Absolute siblings paint in DOM order; keep the note above the canvas.
    line.style.position = "absolute";
    line.style.left = "12px";
    line.style.right = "auto";
    line.style.bottom = bottom;
    line.style.margin = "0";
    line.style.textAlign = "left";
    line.style.maxWidth = "calc(100% - 24px)";
    line.style.pointerEvents = "none";
    // Operate evidence plate: chrome tokens give the note a solid ground, so its contrast never
    // depends on whatever the canvas drew behind it. Machine evidence reads in the mono face.
    line.style.padding = "2px var(--space-2, 8px)";
    line.style.border = "1px solid var(--line-control)";
    line.style.borderRadius = "var(--r-control)";
    line.style.background = "var(--overlay)";
    line.style.color = "var(--text-2)";
    line.style.font = "13px/1.5 var(--mono)";
    // Preserve field boundaries in the multi-line safe-evidence overlay.
    line.style.whiteSpace = "pre-wrap";
    host.append(line);
  }

  line.textContent = text;
}

export function reportLine(host: Element, text: string): void {
  overlayLine(host, REPORT_ID, "report", "8px", text);
}

// Separate lines prevent the frame report from overwriting later outcomes.
export function openPathLine(host: Element, text: string): void {
  overlayLine(host, OPEN_PATH_ID, "open-path", "52px", text);
}

export function refusalText<Input>(error: Input): string {
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

export function installOverlayReport(stage: HTMLElement, request: BridgeGlobal["request"], signal?: AbortSignal) {
  let printed = false;
  let frameReportSettled = false;
  let frameReportInFlight = false;
  let frameReportAttempts = 0;

  const frameReportLine = (text: string) =>
    overlayLine(stage, FRAME_REPORT_ID, "frame-report", "96px", text);

  return {
    reportLine: (text: string) => { if (!signal?.aborted) reportLine(stage, text); },
    openPathLine: (text: string) => { if (!signal?.aborted) openPathLine(stage, text); },
    rarityEvidenceLine: (text: string) =>
      { if (!signal?.aborted) overlayLine(stage, RARITY_EVIDENCE_ID, "rarity-evidence", "140px", text); },
    // Remove the previous run's evidence rather than leaving stale provenance.
    clearRarityEvidence: () => { if (!signal?.aborted) document.getElementById(RARITY_EVIDENCE_ID)?.remove(); },
    updatePixelsMeta: (frame: SculptPresentationFrame) => { if (!signal?.aborted) updatePixelsMeta(frame); },
    reportNextFrame: () => {
      if (signal?.aborted) return;
      frameReportSettled = false;
      frameReportAttempts = 0;
    },
    reportFrame: (frame: SculptPresentationFrame, sceneId: string) => {
      if (signal?.aborted) return;
      updatePixelsMeta(frame);

      if (!printed || frame.frame % 15 === 0) {
        printed = true;
        reportLine(stage, `${frameText(frame)} · scene ${sceneId}`);
      }

      if (!frameReportSettled && !frameReportInFlight) {
        frameReportInFlight = true;
        frameReportAttempts += 1;
        request({ action: "frame-report", payload: frame }).then(
          (response) => {
            frameReportInFlight = false;

            if (signal?.aborted) return;
            frameReportSettled = true;

            // The host now holds this frame, observable by the smoke proof.
            if (response.ok) stage.dataset.frameReported = String(frame.frame);

            if (!response.ok) {
              frameReportLine(`frame report refused: ${response.reason} — ${response.message}`);
            }
          },
          (error) => {
            frameReportInFlight = false;

            if (signal?.aborted) return;
            const exhausted = frameReportAttempts >= FRAME_REPORT_MAX_ATTEMPTS;
            frameReportSettled = exhausted;
            frameReportLine(
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
  };
}
