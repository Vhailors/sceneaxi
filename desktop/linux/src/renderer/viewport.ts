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
} from "@sceneaxi/engine-presentation";
import {
  DESKTOP_BRIDGE_GLOBAL,
  PIXELS_META_NAME,
  type DesktopBridgeResponse,
} from "../lib/bridge-contract.js";

type BridgeGlobal = {
  request(request: unknown): Promise<DesktopBridgeResponse>;
};

type MountableInstance = {
  instanceId: string;
  artifactId: string;
  label: string;
  worldTransform: unknown;
};

type MountablePayload = {
  sceneId: string;
  sceneDigest: string;
  artifacts: Record<string, unknown>;
  instances: MountableInstance[];
};

const REPORT_ID = "desktop-live-viewport-report";

function bridge(): BridgeGlobal | null {
  const candidate = (globalThis as Record<string, unknown>)[DESKTOP_BRIDGE_GLOBAL];
  if (typeof candidate !== "object" || candidate === null) return null;
  const request = (candidate as Record<string, unknown>)["request"];
  return typeof request === "function" ? (candidate as BridgeGlobal) : null;
}

function reportLine(host: Element, text: string): void {
  let line = document.getElementById(REPORT_ID);
  if (line === null) {
    line = document.createElement("p");
    line.id = REPORT_ID;
    line.className = "viewport-note";
    line.setAttribute("data-live-viewport", "report");
    // An overlay above the canvas: absolute siblings paint in DOM order, and the
    // report must stay readable over whatever the frame drew.
    line.style.position = "absolute";
    line.style.left = "12px";
    line.style.right = "12px";
    line.style.bottom = "8px";
    line.style.margin = "0";
    line.style.textAlign = "left";
    line.style.maxWidth = "none";
    line.style.pointerEvents = "none";
    host.append(line);
  }
  line.textContent = text;
}

function updatePixelsMeta(frame: SculptPresentationFrame): void {
  const meta = document.querySelector(`meta[name="${PIXELS_META_NAME}"]`);
  if (meta !== null && typeof frame.pixelsDrawn === "boolean") {
    meta.setAttribute("content", String(frame.pixelsDrawn));
  }
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

async function mountLiveViewport(): Promise<void> {
  const stage = document.querySelector(".viewport");
  if (stage === null) return;

  const port = bridge();
  if (port === null) {
    reportLine(stage, "Live viewport refused: the desktop bridge is not exposed.");
    return;
  }

  const sceneResponse = await port.request({ action: "scene" });
  if (!sceneResponse.ok) {
    reportLine(stage, `Live viewport refused: ${sceneResponse.reason} — ${sceneResponse.message}`);
    return;
  }
  const scene = sceneResponse.data as MountablePayload;

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
    backend = createThreeSculptPresentationBackend({
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
    reportLine(
      stage,
      `Live viewport refused: no WebGL surface — ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  const mounts = createSculptMountApi(backend);
  try {
    for (const instance of scene.instances) {
      const artifact = scene.artifacts[instance.artifactId];
      // The payload crossed IPC as JSON; the Sculpt Mount API re-validates every
      // artifact and transform at mount time and refuses invalid ones by name.
      mounts.mount({
        instanceId: instance.instanceId,
        artifact,
        transform: instance.worldTransform,
      } as Parameters<typeof mounts.mount>[0]);
    }
    backend.frameMountedContent();
    backend.camera.attach(canvas);
  } catch (error) {
    mounts.dispose();
    canvas.remove();
    reportLine(
      stage,
      `Live viewport refused: could not mount the composed scene — ${error instanceof Error ? error.message : String(error)}`,
    );
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

  let reported = false;
  const loop = createThreeRenderLoop({
    onFrame: () => {
      const frame = mounts.render();
      updatePixelsMeta(frame);
      if (!reported || frame.frame % 15 === 0) {
        reportLine(stage, `${frameText(frame)} · scene ${scene.sceneId}`);
      }
      if (!reported) {
        reported = true;
        void port.request({ action: "frame-report", payload: frame });
      }
    },
  });
  loop.start();

  const openPath = await port.request({ action: "open-path" });
  if (openPath.ok) {
    const exercise = openPath.data as { initialDigest: string; tickDigests: string[] };
    const status = document.createElement("p");
    status.className = "viewport-note";
    status.setAttribute("data-live-viewport", "open-path");
    status.style.position = "absolute";
    status.style.left = "12px";
    status.style.right = "12px";
    status.style.bottom = "52px";
    status.style.margin = "0";
    status.style.textAlign = "left";
    status.style.maxWidth = "none";
    status.style.pointerEvents = "none";
    status.textContent = `kernel open path: ${exercise.tickDigests.length} ticks advanced · digest ${exercise.initialDigest.slice(0, 18)}… → ${exercise.tickDigests[exercise.tickDigests.length - 1]?.slice(0, 18)}… · session closed`;
    stage.append(status);
  }
}

// A bridge call rejects whenever the main-process handler throws rather than
// refusing by name; without this the canvas would already be in the DOM and the
// only trace would be an unhandled rejection, so the surface names it instead.
function startLiveViewport(): void {
  void mountLiveViewport().catch((error: unknown) => {
    const stage = document.querySelector(".viewport");
    if (stage === null) return;
    reportLine(
      stage,
      `Live viewport refused: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startLiveViewport);
} else {
  startLiveViewport();
}
