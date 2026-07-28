"use client";

/**
 * The umbrella's one browser viewport over the Three presentation core.
 *
 * This module is the only place on the site that touches a renderer, and it touches it
 * only through the ADR 0002 seam (ADR 0022). Both pixel-drawing surfaces — the public
 * live open path and the entitled Minimum E2 editor — build on it, so there is exactly
 * one canvas lifecycle, one render loop, and one refusal story rather than a second
 * near-copy per route. No Three type is named here: the camera is plain numbers and the
 * scene is contract data the server composed.
 *
 * The set of mounted instances is reconciled **inside the frame loop** against the
 * caller's latest intent, so a click can never land before or after the session exists
 * and leave a control and the drawn scene disagreeing.
 *
 * A surface is one of two presentations, and the difference is a product distinction
 * rather than a tuning knob. An `interactive` surface is a session: orbit and zoom input
 * is attached to its canvas and its loop runs for the life of the mount, which is what
 * the routed open and editor paths promise in their own copy. A `snapshot` surface is
 * art: no input is attached, the canvas keeps the touch gestures the page needs to
 * scroll, and the loop draws only until the frame settles and then stops. Because the
 * two travel together, a surface cannot end up orbitable but frozen, or still and
 * redrawing an unchanging image sixty times a second.
 *
 * WebGL can fail for reasons a page cannot control (no GPU, a blocked context, a
 * headless crawler). That refuses in the open with the error the core produced, rather
 * than leaving a blank rectangle that looks like a bug.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  createSculptMountApi,
  createThreeRenderLoop,
  createThreeSculptPresentationBackend,
  type SculptPresentationFrame,
  type ThreeSculptPresentationBackend,
} from "@sceneaxi/engine-presentation";
import type { MountableScene } from "@sceneaxi/site-kit";
import { VIEWPORT_LETTERBOX } from "../../lib/viewport-letterbox.js";
import { StatePanel } from "./state-panel.js";

/**
 * Frames are published to React at this cadence on an interactive surface; the loop
 * still draws every frame. A snapshot publishes the one frame it settles on instead.
 */
const FRAME_REPORT_INTERVAL = 15;
const MAX_PIXEL_RATIO = 2;

type RefusalStage = "open" | "draw";

const REFUSAL_COPY: Record<RefusalStage, { readonly heading: string; readonly body: string }> = {
  open: {
    heading: "The viewport could not open",
    body: "The Three presentation core refused to build a WebGL surface in this browser, so nothing was drawn. Nothing is shown in its place.",
  },
  draw: {
    heading: "The viewport stopped drawing",
    body: "The Three presentation core failed while drawing a frame. The loop was stopped and the surface released, so a frozen image is never left on screen reporting itself as live.",
  },
};

export type SculptViewportStatus =
  | { readonly kind: "starting" }
  | { readonly kind: "running"; readonly frame: SculptPresentationFrame }
  | { readonly kind: "refused"; readonly stage: RefusalStage; readonly message: string };

/** An orbitable session, or a still frame the page draws once and leaves alone. */
export type SculptViewportPresentation = "interactive" | "snapshot";

export type SculptViewport = {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly status: SculptViewportStatus;
  /** Return the camera to the framing the session opened with. */
  readonly resetView: () => void;
  /**
   * What this surface is, carried back so the canvas element cannot disagree with the
   * session behind it about whether it takes input.
   */
  readonly presentation: SculptViewportPresentation;
};

type LiveSession = {
  readonly backend: ThreeSculptPresentationBackend;
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

/**
 * Build a live viewport for a composed scene.
 *
 * `mountedInstanceIds` is the caller's intent, not a command: instances outside the
 * served scene are ignored, and reconciliation is idempotent, so it converges from any
 * starting state without the renderer ever being rebuilt.
 */
export function useSculptViewport(input: {
  readonly scene: MountableScene;
  readonly mountedInstanceIds: readonly string[];
  readonly background?: string;
  /** Defaults to the interactive session both routed viewports mount. */
  readonly presentation?: SculptViewportPresentation;
}): SculptViewport {
  const { scene, background, presentation = "interactive" } = input;
  const snapshot = presentation === "snapshot";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const [status, setStatus] = useState<SculptViewportStatus>({ kind: "starting" });

  /**
   * The caller's intent, readable from inside the frame loop.
   *
   * Joined into one string so the effect below re-publishes it on a *content* change
   * rather than on every render's new array identity.
   */
  const wantedKey = input.mountedInstanceIds.join("\u0000");
  const wantedRef = useRef(wantedKey);
  useEffect(() => {
    wantedRef.current = wantedKey;
  }, [wantedKey]);

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
        background: background ?? VIEWPORT_LETTERBOX,
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

      const mounted = new Set<string>();
      let appliedKey: string | null = null;
      let reportNextFrame = true;
      // Reconcile what is mounted against the caller's intent, through the same Mount
      // API the pages demonstrate. The renderer is never torn down to do it.
      const reconcileMounts = () => {
        const applied = wantedRef.current;
        if (applied === appliedKey) return;
        appliedKey = applied;
        const wanted = new Set(applied.length === 0 ? [] : applied.split("\u0000"));
        for (const placement of placements) {
          const shouldMount = wanted.has(placement.instanceId);
          if (shouldMount === mounted.has(placement.instanceId)) continue;
          // What is mounted is about to change, so the report must not wait for its
          // interval.
          reportNextFrame = true;
          if (shouldMount) {
            mounts.mount(placement);
            mounted.add(placement.instanceId);
            continue;
          }
          mounts.unmount(placement.instanceId);
          mounted.delete(placement.instanceId);
        }
      };

      // Frame the opening scene before the first drawn frame, so the camera the "reset
      // view" control returns to is the one the viewer actually saw.
      reconcileMounts();
      backend.frameMountedContent();
      // A snapshot takes no input at all. Attaching orbit and zoom to art that says it
      // offers neither is the contradiction; taking the canvas out of the browser's own
      // panning is the harm, because a swipe that starts on it would then scroll nothing.
      if (!snapshot) {
        const detachInput = backend.camera.attach(canvas);
        cleanups.push(detachInput);
      }

      /**
       * One drawn frame, and the refusal every caller of it shares.
       *
       * A frame that throws refuses in the open, exactly like a frame that never came.
       * The loop cannot keep drawing after this, so releasing here is what stops the
       * page from showing a stale frame report over a frozen image with no refusal.
       *
       * A snapshot publishes the frame it *settled* on and nothing before it, and settled
       * is the core's own report rather than a guess about elapsed time: the frame
       * reached a real drawing buffer, and it issued draw calls whenever there is
       * anything mounted to draw. Until both hold it keeps drawing — a blocked WebGL
       * context, or a canvas measured before layout resolved, is a frame to draw again,
       * not one to stop on — so a surface that stops is one that finished rather than one
       * that froze part-way through opening.
       */
      const drawFrame = () => {
        try {
          reconcileMounts();
          const frame = mounts.render();
          if (snapshot) {
            const settled =
              frame.pixelsDrawn === true && (mounted.size === 0 || frame.drawCalls > 0);
            if (!settled) {
              loop.start();
              return;
            }
            loop.stop();
            setStatus({ kind: "running", frame });
            return;
          }
          if (reportNextFrame || frame.frame % FRAME_REPORT_INTERVAL === 0) {
            reportNextFrame = false;
            setStatus({ kind: "running", frame });
          }
        } catch (error) {
          sessionRef.current = null;
          releaseAll(cleanups);
          setStatus({ kind: "refused", stage: "draw", message: messageOf(error) });
        }
      };

      const loop = createThreeRenderLoop({ onFrame: drawFrame });
      cleanups.push(() => {
        loop.stop();
      });

      /**
       * Re-measure and redraw. A snapshot has no loop running to pick the new size up on
       * its next frame, so it draws here instead — which is what keeps stopped art
       * correct rather than stretched.
       */
      const applyViewport = () => {
        const next = measure();
        backend.resize(next.width, next.height, next.pixelRatio);
        if (snapshot) drawFrame();
      };

      const observer = new ResizeObserver(applyViewport);
      cleanups.push(() => {
        observer.disconnect();
      });
      observer.observe(canvas);

      /**
       * Density is the half a `ResizeObserver` cannot see: moving a window to a
       * different-density display changes `devicePixelRatio` without changing the CSS
       * box, so no entry ever arrives. The query has to be rebuilt after every change
       * because it names the ratio it was built for.
       */
      let densityQuery: MediaQueryList | null = null;
      const watchDensity = () => {
        if (typeof window.matchMedia !== "function") return;
        densityQuery?.removeEventListener("change", onDensityChange);
        densityQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        densityQuery.addEventListener("change", onDensityChange);
      };
      const onDensityChange = () => {
        applyViewport();
        watchDensity();
      };
      watchDensity();
      cleanups.push(() => {
        densityQuery?.removeEventListener("change", onDensityChange);
        densityQuery = null;
      });

      loop.start();

      session = {
        backend,
        dispose,
      };
    } catch (error) {
      releaseAll(cleanups);
      setStatus({ kind: "refused", stage: "open", message: messageOf(error) });
      return;
    }

    sessionRef.current = session;
    return () => {
      sessionRef.current = null;
      session.dispose();
    };
    // The served scene is a per-request constant, so the session is built once.
  }, [scene, background, snapshot]);

  const resetView = useCallback(() => {
    const session = sessionRef.current;
    if (session === null) return;
    session.backend.camera.reset();
    session.backend.frameMountedContent();
  }, []);

  return { canvasRef, status, resetView, presentation };
}

/**
 * The canvas itself, its opening overlay, and the refusal that replaces both.
 *
 * A refused viewport renders no canvas at all: an empty black rectangle beside a live
 * frame report is exactly the "looks like a bug" state the refusal exists to avoid.
 */
export function SculptViewportSurface({
  viewport,
  label,
  refusalLevel,
}: {
  readonly viewport: SculptViewport;
  readonly label: string;
  /**
   * Heading level for the refusal, when one is rendered.
   *
   * The two routed viewports sit under a section heading, so their refusal is an `h3`;
   * the marketing hero sits directly under the page's `h1` and passes `2`. The default
   * keeps the routed callers unchanged.
   */
  readonly refusalLevel?: 2 | 3;
}) {
  const { canvasRef, status, presentation } = viewport;

  if (status.kind === "refused") {
    const refusal = REFUSAL_COPY[status.stage];
    return (
      <StatePanel
        tone="deny"
        level={refusalLevel ?? 3}
        title={refusal.heading}
        reason={status.message}
        evidence={[{ term: "Stage", value: status.stage }]}
      >
        <p>{refusal.body}</p>
      </StatePanel>
    );
  }

  /*
    The modifier is what keeps the two presentations from having to trust each other: a
    snapshot canvas takes no pointer gestures, so it never claims the touch the page
    needs to scroll, and it never advertises a drag the session behind it would ignore.
  */
  return (
    <div className="viewport">
      <canvas
        ref={canvasRef}
        className={
          presentation === "snapshot" ? "viewport-canvas viewport-canvas-static" : "viewport-canvas"
        }
        aria-label={label}
      />
      {status.kind === "starting" && <p className="viewport-overlay">Opening the scene…</p>}
    </div>
  );
}

/** The frame the running core last published, or `null` before the first one. */
export function currentFrame(status: SculptViewportStatus): SculptPresentationFrame | null {
  return status.kind === "running" ? status.frame : null;
}

/**
 * What the running core reports about the frame it just drew.
 *
 * Draw surface and pixels drawn are the rows that keep a frame counter from reading as a
 * pixel claim, so both drawing surfaces render them from this one place rather than from
 * per-route copies that could drift apart into two different honesty stories.
 *
 * The heading is required rather than optional because a page may show more than one of
 * these tables — the editor reports its server frame beside this browser one — and an
 * unlabelled report is one a reader cannot attribute to a surface.
 */
export function SculptFrameReport({
  heading,
  frame,
}: {
  readonly heading: string;
  readonly frame: SculptPresentationFrame | null;
}) {
  return (
    <>
      <h3>{heading}</h3>
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
