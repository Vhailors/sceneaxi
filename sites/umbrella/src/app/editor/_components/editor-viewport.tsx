"use client";

/**
 * The entitled Minimum E2 editor's live viewport.
 *
 * The scene it draws is the editor session's own composition projection, resolved on
 * the server: the same instances, the same world transforms, and the same artifacts the
 * panels below the canvas report. The canvas therefore cannot show a scene the editor
 * did not compose.
 *
 * It **draws** that scene and nothing more. Play, pause, step, selection, and transform
 * edits are Minimum E2 session operations that happen on the server and arrive here as
 * a new composed scene; this component never advances a kernel session and invents no
 * simulation state of its own. The renderer lifecycle itself belongs to the site's one
 * viewport boundary, `useSculptViewport`.
 */
import { useMemo, useState } from "react";
import type { MountableScene } from "@sceneaxi/site-kit";
import {
  SculptFrameReport,
  SculptViewportSurface,
  currentFrame,
  useSculptViewport,
} from "../../_components/sculpt-viewport.js";

export function EditorViewport({
  scene,
  selectedInstanceId,
}: {
  readonly scene: MountableScene;
  readonly selectedInstanceId: string;
}) {
  const [isolateSelection, setIsolateSelection] = useState(false);

  /**
   * A selection the composed scene does not contain cannot be isolated to, so the
   * toggle falls back to the whole scene rather than emptying the canvas.
   */
  const isolatable = scene.instances.some(
    (instance) => instance.instanceId === selectedInstanceId,
  );

  const mountedInstanceIds = useMemo(
    () =>
      scene.instances
        .map((instance) => instance.instanceId)
        .filter(
          (instanceId) =>
            !isolateSelection || !isolatable || instanceId === selectedInstanceId,
        ),
    [scene, isolateSelection, isolatable, selectedInstanceId],
  );

  const viewport = useSculptViewport({ scene, mountedInstanceIds });
  const frame = currentFrame(viewport.status);

  if (viewport.status.kind === "refused") {
    return <SculptViewportSurface viewport={viewport} label="Minimum E2 editor viewport" />;
  }

  return (
    <>
      <SculptViewportSurface
        viewport={viewport}
        label="Minimum E2 editor viewport — drag to orbit, scroll to zoom"
      />

      {/* Both change what this canvas shows and nothing else, which is the view
          kind each declares — the editor shell's accounting rule reaches every
          interactive element on the route, these two included. */}
      <div className="actions">
        <button
          className="button button-quiet"
          type="button"
          data-kind="view"
          onClick={viewport.resetView}
        >
          Reset view
        </button>
        <button
          className="button button-quiet"
          type="button"
          data-kind="view"
          disabled={!isolatable}
          aria-pressed={isolateSelection && isolatable}
          onClick={() => {
            setIsolateSelection((previous) => !previous);
          }}
        >
          {isolateSelection && isolatable
            ? "Show the whole scene"
            : `Show only ${selectedInstanceId}`}
        </button>
      </div>

      <SculptFrameReport heading="Browser session frame" frame={frame} />
    </>
  );
}
