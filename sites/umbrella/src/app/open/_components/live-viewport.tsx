"use client";

/**
 * The public viewport: a real Sculpt Artifact drawn into a real WebGL canvas.
 *
 * This is the only file on the site that touches a renderer, and it touches it only
 * through the ADR 0002 seam (ADR 0022). It builds the Three presentation core on a
 * browser canvas, mounts the composed instances the server resolved through the Sculpt
 * Mount API, attaches orbit/zoom, and runs the frame loop the package owns. No Three
 * type is named here — the camera is plain numbers and the artifacts are contract data.
 *
 * WebGL can fail for reasons a page cannot control (no GPU, a blocked context, a
 * headless crawler). That refuses in the open with the error the core produced, rather
 * than leaving a blank rectangle that looks like a bug.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSculptMountApi,
  createThreeRenderLoop,
  createThreeSculptPresentationBackend,
  type SculptMountApi,
  type SculptPresentationFrame,
  type ThreeSculptPresentationBackend,
} from "@sceneaxi/engine-presentation";
import type { LiveOpenScene } from "../../../lib/live-open.js";

/** Frames are published to React at this cadence; the loop still draws every frame. */
const FRAME_REPORT_INTERVAL = 15;
const MAX_PIXEL_RATIO = 2;

type ViewportStatus =
  | { readonly kind: "starting" }
  | { readonly kind: "running"; readonly frame: SculptPresentationFrame }
  | { readonly kind: "refused"; readonly message: string };

type LiveSession = {
  readonly backend: ThreeSculptPresentationBackend;
  readonly mounts: SculptMountApi;
  readonly dispose: () => void;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function releaseAll(cleanups: Array<() => void>) {
  let firstFailure: { readonly error: unknown } | null = null;
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    try {
      cleanup?.();
    } catch (error) {
      firstFailure ??= { error };
    }
  }
  return firstFailure;
}

export function LiveViewport({ scene }: { readonly scene: LiveOpenScene }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const [status, setStatus] = useState<ViewportStatus>({ kind: "starting" });
  const [rootOnly, setRootOnly] = useState(false);

  /**
   * The button's intent, readable from inside the frame loop.
   *
   * The loop reconciles mounts against this every frame, so a click can never land
   * before or after the session exists and leave the button and the scene disagreeing.
   */
  const rootOnlyRef = useRef(rootOnly);
  useEffect(() => {
    rootOnlyRef.current = rootOnly;
  }, [rootOnly]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    /**
     * The canvas as it is right now: CSS size and device density together.
     *
     * Browser zoom and a move to a different-density display change the ratio as well as
     * the box, so every caller resolves both from the live document rather than from
     * whatever was true when the session was built.
     */
    const measure = () => ({
      width: Math.max(1, Math.round(canvas.clientWidth)),
      height: Math.max(1, Math.round(canvas.clientHeight)),
      pixelRatio: Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
    });

    const cleanups: Array<() => void> = [];
    const dispose = () => {
      const failure = releaseAll(cleanups);
      if (failure !== null) throw failure.error;
    };
    let session: LiveSession;
    try {
      const backend = createThreeSculptPresentationBackend({
        canvas,
        viewport: measure(),
        background: "#0b0e13",
      });
      /**
       * Renderer ownership moves with construction. The backend owns itself until
       * `createSculptMountApi` takes it, after which `mounts.dispose()` is the single
       * call that releases the WebGL renderer. Naming the owner makes that handoff one
       * assignment, so unwinding can never double-dispose or leak the renderer.
       */
      let renderOwner: { dispose: () => void } = backend;
      cleanups.push(() => {
        renderOwner.dispose();
      });
      const mounts = createSculptMountApi(backend);
      renderOwner = mounts;

      /**
       * The instances this viewport can actually draw, resolved once.
       *
       * Every later mount and unmount reads this one list, so the two directions can
       * never disagree about whether an instance exists — an unmount of something that
       * was never mounted refuses, and it would refuse inside the frame loop.
       */
      const placements = scene.instances.flatMap((instance) => {
        const artifact = scene.artifacts[instance.artifactId];
        if (artifact === undefined) return [];
        return [
          {
            instanceId: instance.instanceId,
            artifact,
            transform: instance.worldTransform,
          },
        ];
      });
      for (const placement of placements) {
        mounts.mount(placement);
      }
      backend.frameMountedContent();
      const detachInput = backend.camera.attach(canvas);
      cleanups.push(detachInput);

      // Mount and unmount the non-root instances to match the button, through the same
      // Mount API the page demonstrates. The renderer is never torn down to do it, and
      // the reconciliation is idempotent, so it converges from any starting state.
      const optionalPlacements = placements.filter(
        (placement) => placement.instanceId !== scene.rootInstanceId,
      );
      let appliedRootOnly = false;
      let reportNextFrame = true;
      const reconcileMounts = () => {
        if (rootOnlyRef.current === appliedRootOnly) return;
        appliedRootOnly = rootOnlyRef.current;
        // What is mounted just changed, so the report must not wait for its interval.
        reportNextFrame = true;
        for (const placement of optionalPlacements) {
          if (appliedRootOnly) {
            mounts.unmount(placement.instanceId);
            continue;
          }
          mounts.mount(placement);
        }
      };

      const observer = new ResizeObserver(() => {
        const next = measure();
        backend.resize(next.width, next.height, next.pixelRatio);
      });
      cleanups.push(() => {
        observer.disconnect();
      });
      observer.observe(canvas);

      const loop = createThreeRenderLoop({
        onFrame: () => {
          reconcileMounts();
          const frame = mounts.render();
          if (reportNextFrame || frame.frame % FRAME_REPORT_INTERVAL === 0) {
            reportNextFrame = false;
            setStatus({ kind: "running", frame });
          }
        },
      });
      cleanups.push(() => {
        loop.stop();
      });
      loop.start();

      session = {
        backend,
        mounts,
        dispose,
      };
    } catch (error) {
      releaseAll(cleanups);
      setStatus({ kind: "refused", message: messageOf(error) });
      return;
    }

    sessionRef.current = session;
    return () => {
      sessionRef.current = null;
      session.dispose();
    };
    // The served scene is a per-request constant, so the session is built once.
  }, [scene]);

  const resetView = useCallback(() => {
    const session = sessionRef.current;
    if (session === null) return;
    session.backend.camera.reset();
    session.backend.frameMountedContent();
  }, []);

  const frame = status.kind === "running" ? status.frame : null;

  if (status.kind === "refused") {
    return (
      <section className="state state-deny">
        <h3>The viewport could not open</h3>
        <p>
          The Three presentation core refused to build a WebGL surface in this browser,
          so nothing was drawn. Nothing is shown in its place.
        </p>
        <code className="reason">{status.message}</code>
      </section>
    );
  }

  return (
    <>
      <div className="viewport">
        <canvas
          ref={canvasRef}
          className="viewport-canvas"
          aria-label="Live SceneAxi viewport — drag to orbit, scroll to zoom"
        />
        {status.kind === "starting" && <p className="viewport-overlay">Opening the scene…</p>}
      </div>

      <div className="actions">
        <button className="button button-quiet" type="button" onClick={resetView}>
          Reset view
        </button>
        <button
          className="button button-quiet"
          type="button"
          aria-pressed={rootOnly}
          onClick={() => {
            setRootOnly((previous) => !previous);
          }}
        >
          {rootOnly ? "Mount every instance" : "Mount the root instance only"}
        </button>
      </div>

      <h3>What the running core reports</h3>
      <dl className="dl">
        <dt>Backend</dt>
        <dd>
          <code>{frame?.backend ?? "…"}</code>
        </dd>
        <dt>Label</dt>
        <dd>{frame?.label ?? "…"}</dd>
        <dt>Draw surface</dt>
        <dd>
          <code>{frame?.surface ?? "…"}</code>
        </dd>
        <dt>Pixels drawn</dt>
        <dd>
          <code>{frame === null ? "…" : String(frame.pixelsDrawn)}</code>
        </dd>
        <dt>Frame</dt>
        <dd>{frame?.frame ?? "…"}</dd>
        <dt>Draw calls</dt>
        <dd>{frame?.drawCalls ?? "…"}</dd>
        <dt>Mounted</dt>
        <dd>
          <code>{frame?.instanceIds.join(", ") ?? "…"}</code>
        </dd>
      </dl>
    </>
  );
}
