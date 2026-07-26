"use client";

/**
 * The public viewport: a real Sculpt Artifact drawn into a real WebGL canvas.
 *
 * The canvas lifecycle, render loop, mount reconciliation, and refusals belong to the
 * shared `useSculptViewport` hook — the site's one renderer boundary (ADR 0002/0022).
 * What lives here is only what is specific to the *public* path: which instances the
 * page offers to mount, and the frame report it publishes.
 */
import { useMemo, useState } from "react";
import type { LiveOpenScene } from "../../../lib/live-open.js";
import {
  SculptViewportSurface,
  currentFrame,
  useSculptViewport,
} from "../../_components/sculpt-viewport.js";

export function LiveViewport({ scene }: { readonly scene: LiveOpenScene }) {
  const [rootOnly, setRootOnly] = useState(false);

  const mountedInstanceIds = useMemo(
    () =>
      scene.instances
        .map((instance) => instance.instanceId)
        .filter((instanceId) => !rootOnly || instanceId === scene.rootInstanceId),
    [scene, rootOnly],
  );

  const viewport = useSculptViewport({ scene, mountedInstanceIds });
  const frame = currentFrame(viewport.status);

  if (viewport.status.kind === "refused") {
    return <SculptViewportSurface viewport={viewport} label="Live SceneAxi viewport" />;
  }

  return (
    <>
      <SculptViewportSurface
        viewport={viewport}
        label="Live SceneAxi viewport — drag to orbit, scroll to zoom"
      />

      <div className="actions">
        <button className="button button-quiet" type="button" onClick={viewport.resetView}>
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
