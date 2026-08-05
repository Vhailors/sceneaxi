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
  DESKTOP_BRIDGE_REFUSALS,
  PIXELS_META_NAME,
  type DesktopAssistantJobSnapshot,
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

// A rejected bridge call is worth retrying — the next frame is milliseconds away —
// but a structural rejection (no handler on the channel, a payload that cannot be
// cloned) never recovers, and retrying it per frame would burn IPC for the life of
// the session. A few attempts, then the refusal stands on its own line.
const FRAME_REPORT_MAX_ATTEMPTS = 3;

const REPORT_ID = "desktop-live-viewport-report";
const OPEN_PATH_ID = "desktop-live-viewport-open-path";
const FRAME_REPORT_ID = "desktop-live-viewport-frame-report";

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
    host.append(line);
  }
  line.textContent = text;
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

function refusalText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

const ASSISTANT_INSTANCE_ID = "assistant-live-output";

/**
 * The composer controls the chrome renders live whenever the desktop runtime is
 * declared. They only *are* live once `installAssistantProductFlow()` has bound
 * them to a mount API, and that happens at the end of a path with several
 * refusals in front of it. A control that is neither bound nor inert is the one
 * thing this surface does not allow, so every path that returns before the
 * binding turns them inert here, naming the refusal the chrome already prints a
 * paragraph for.
 */
const ASSISTANT_CONTROL_IDS = ["assistant-prompt", "assistant-send", "assistant-retry"] as const;

function refuseAssistantControls(reason: string, message: string): void {
  const status = document.querySelector<HTMLElement>("[data-assistant-status]");
  if (status !== null) status.textContent = `${reason} — ${message}`;
  for (const id of ASSISTANT_CONTROL_IDS) {
    const control = document.getElementById(id);
    if (control === null) continue;
    control.dataset.runtimeRefusal = reason;
    if (control.dataset.kind === "inert") continue;
    control.setAttribute("data-kind", "inert");
    control.setAttribute("aria-disabled", "true");
    control.setAttribute("data-refusal", reason);
    control.setAttribute("aria-describedby", `refusal-${reason}`);
    control.classList.add("is-inert");
    if (control instanceof HTMLTextAreaElement) control.readOnly = true;
  }
  document
    .querySelector<HTMLElement>("[data-assistant-manipulators]")
    ?.setAttribute("hidden", "");
}

/**
 * One refusal, said in both places it has to be said: the viewport's own report
 * line, and the assistant composer that would otherwise still invite a prompt it
 * has no runtime to answer.
 */
function refuseLiveViewport(stage: Element | null, message: string): void {
  if (stage !== null) reportLine(stage, `Live viewport refused: ${message}`);
  refuseAssistantControls(
    DESKTOP_BRIDGE_REFUSALS.presentationRuntimeUnavailable,
    `${message} Assistant Build has no live viewport to mount a typed artifact into.`,
  );
}

function assistantProfile(shell: HTMLElement): `@sceneaxi/profile-${string}` {
  const id = shell.dataset.profile;
  return `@sceneaxi/profile-${id === "web" ? "web" : id === "kids" ? "kids" : "game"}`;
}

function inspectionText(job: DesktopAssistantJobSnapshot): string {
  const inspection = job.result?.inspection;
  if (inspection === undefined) return "";
  const materials = inspection.materials.values
    .map(
      (material) =>
        `${material.id}: ${material.baseColor}, metal ${material.metallic}, rough ${material.roughness}`,
    )
    .join("\n");
  const physics = inspection.physics.supported
    ? inspection.physics.colliders
        .map((collider) => `${collider.id}: ${collider.shape} collider`)
        .join("\n")
    : `${inspection.physics.reason}: ${inspection.physics.message}`;
  const settings = inspection.settings.proceduralModule;
  return [
    "MATERIALS (read-only)",
    materials || "none",
    "",
    "PHYSICS (read-only)",
    physics || "none",
    "",
    "SETTINGS (read-only)",
    `${settings.moduleId} · ${settings.exportName}`,
    inspection.settings.edit.refusal,
  ].join("\n");
}

function installAssistantProductFlow(
  stage: Element,
  port: BridgeGlobal,
  mounts: ReturnType<typeof createSculptMountApi>,
  backend: ReturnType<typeof createThreeSculptPresentationBackend>,
): void {
  const shell = document.querySelector<HTMLElement>(".shell");
  const prompt = document.querySelector<HTMLTextAreaElement>("#assistant-prompt");
  const status = document.querySelector<HTMLElement>("[data-assistant-status]");
  const resultView = document.querySelector<HTMLElement>("[data-assistant-result]");
  const retry = document.querySelector<HTMLButtonElement>("#assistant-retry");
  const manipulatorBar = stage.querySelector<HTMLElement>("[data-assistant-manipulators]");
  if (shell === null || prompt === null || status === null || resultView === null) return;
  let running = false;
  const identityTransform = () => ({
    translation: [0, 0, 0] as [number, number, number],
    rotationEulerDegrees: [0, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
  });
  let manipulatorTransform = identityTransform();

  manipulatorBar
    ?.querySelectorAll<HTMLButtonElement>("[data-action='assistant-manipulator']")
    .forEach((control) => {
      control.addEventListener("click", () => {
        if (control.getAttribute("aria-disabled") === "true") return;
        switch (control.dataset.value) {
          case "move-x":
            manipulatorTransform.translation[0] += 0.25;
            break;
          case "move-y":
            manipulatorTransform.translation[1] += 0.25;
            break;
          case "rotate-y":
            manipulatorTransform.rotationEulerDegrees[1] += 15;
            break;
          case "scale-up":
            manipulatorTransform.scale = [
              manipulatorTransform.scale[0] + 0.1,
              manipulatorTransform.scale[1] + 0.1,
              manipulatorTransform.scale[2] + 0.1,
            ];
            break;
          default:
            return;
        }
        mounts.updateTransform(ASSISTANT_INSTANCE_ID, {
          translation: [...manipulatorTransform.translation],
          rotationEulerDegrees: [...manipulatorTransform.rotationEulerDegrees],
          scale: [...manipulatorTransform.scale],
        });
      });
    });

  const refused = (reason: string, message: string): void => {
    running = false;
    status.textContent = `${reason} — ${message}`;
    retry?.removeAttribute("hidden");
  };

  const poll = async (): Promise<void> => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const response = await port.request({ action: "assistant", payload: { op: "status" } });
      if (!response.ok) {
        refused(response.reason, response.message);
        return;
      }
      const job = response.data as DesktopAssistantJobSnapshot | null;
      if (job === null) {
        refused(
          DESKTOP_BRIDGE_REFUSALS.assistantJobMissing,
          "The assistant job disappeared; retry the prompt.",
        );
        return;
      }
      const latest = job.latestProgress;
      if (latest !== null) status.textContent = `${latest.percent}% · ${latest.message}`;
      if (job.status === "refused") {
        refused(
          job.refusal?.reason ?? DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
          job.refusal === undefined
            ? "The assistant action refused."
            : `${job.refusal.message}${job.refusal.detail === undefined ? "" : ` — ${job.refusal.detail}`}`,
        );
        return;
      }
      if (job.status === "ready" && job.result !== undefined) {
        const already = mounts.list().find((instance) => instance.instanceId === ASSISTANT_INSTANCE_ID);
        if (already !== undefined) mounts.unmount(ASSISTANT_INSTANCE_ID);
        mounts.mount({
          instanceId: ASSISTANT_INSTANCE_ID,
          artifact: job.result.artifact,
        });
        backend.frameMountedContent();
        manipulatorTransform = identityTransform();
        manipulatorBar?.removeAttribute("hidden");
        resultView.textContent = inspectionText(job);
        resultView.removeAttribute("hidden");
        retry?.setAttribute("hidden", "");
        status.textContent =
          "Mounted in the live center viewport · translate/rotate/scale manipulators active · drag to orbit, wheel to zoom.";
        running = false;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await port.request({ action: "assistant", payload: { op: "abandon" } });
    refused(
      DESKTOP_BRIDGE_REFUSALS.assistantStatusTimeout,
      "The assistant job did not finish in time; it was abandoned and Retry may start a fresh job.",
    );
  };

  const start = async (): Promise<void> => {
    if (running) return;
    if (shell.dataset.assistantMode !== "build") {
      refused(
        DESKTOP_BRIDGE_REFUSALS.assistantBuildModeRequired,
        "Choose Build mode to produce and mount a typed Sculpt Artifact; Ask and Agent are not implemented by this first-release flow.",
      );
      return;
    }
    const value = prompt.value.trim();
    if (value.length === 0) {
      refused("ASSISTANT_SCULPT_PROMPT_INVALID", "Enter a prompt before sending.");
      return;
    }
    running = true;
    retry?.setAttribute("hidden", "");
    resultView.setAttribute("hidden", "");
    status.textContent = "Starting assistant action…";
    const response = await port.request({
      action: "assistant",
      payload: {
        op: "start",
        route: shell.dataset.assistantRoute ?? "local",
        profile: assistantProfile(shell),
        prompt: value,
      },
    });
    if (!response.ok) {
      refused(response.reason, response.message);
      return;
    }
    await poll();
  };

  document.querySelectorAll<HTMLElement>("[data-action='assistant-send']").forEach((control) => {
    control.addEventListener("click", () => {
      if (control.getAttribute("aria-disabled") === "true") return;
      void start().catch((error: unknown) =>
        refused(DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed, refusalText(error)),
      );
    });
  });
}

async function mountLiveViewport(): Promise<void> {
  const stage = document.querySelector(".viewport");
  if (stage === null) {
    refuseLiveViewport(null, "the chrome document has no viewport stage.");
    return;
  }

  const port = bridge();
  if (port === null) {
    refuseLiveViewport(stage, "the desktop bridge is not exposed.");
    return;
  }

  const sceneResponse = await port.request({ action: "scene" });
  if (!sceneResponse.ok) {
    refuseLiveViewport(stage, `${sceneResponse.reason} — ${sceneResponse.message}`);
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
    refuseLiveViewport(stage, `no WebGL surface — ${refusalText(error)}`);
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
  installAssistantProductFlow(stage, port, mounts, backend);

  // Everything below runs after `loop.start()`, so it names itself on its own line
  // — a refusal written to the frame report would be overwritten by the next frame.
  try {
    const openPath = await port.request({ action: "open-path" });
    if (openPath.ok) {
      const exercise = openPath.data as { initialDigest: string; tickDigests: string[] };
      openPathLine(
        stage,
        `kernel open path: ${exercise.tickDigests.length} ticks advanced · digest ${exercise.initialDigest.slice(0, 18)}… → ${exercise.tickDigests[exercise.tickDigests.length - 1]?.slice(0, 18)}… · session closed`,
      );
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startLiveViewport);
} else {
  startLiveViewport();
}
