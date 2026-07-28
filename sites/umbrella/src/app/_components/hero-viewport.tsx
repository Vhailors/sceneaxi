"use client";

/**
 * The marketing hero, drawing a real Sculpt Artifact (decision D4).
 *
 * The accepted screen puts a scene behind the headline. It is drawn here through the
 * *same* payload path the public open surface uses — a `MountableScene` the server
 * composed from a committed artifact — and through the tier's one renderer boundary,
 * `useSculptViewport`. There is no bespoke marketing geometry and no second scene
 * source, so the artifact/digest contract chain behind the hero is the chain the gate
 * already proves; what the hero can show is exactly what a real artifact can express,
 * which is the constraint the decision accepted.
 *
 * The hero adds no capability. It mounts every instance the served scene contains,
 * advances no kernel session, and offers no control: this is a drawn snapshot beside a
 * headline, and the interactive path is one click away at the public open surface.
 *
 * Refusal is designed rather than hidden. WebGL can fail for reasons a page cannot
 * control, and when it does the hero says so with the core's own message instead of
 * leaving a black rectangle behind the headline — the shared surface component already
 * renders exactly that state, so the hero does not author a second refusal story.
 */
import { useMemo } from "react";
import type { MountableScene } from "@sceneaxi/site-kit";
import { SculptViewportSurface, currentFrame, useSculptViewport } from "./sculpt-viewport.js";

export function HeroViewport({
  scene,
  label,
}: {
  readonly scene: MountableScene;
  readonly label: string;
}) {
  const mountedInstanceIds = useMemo(
    () => scene.instances.map((instance) => instance.instanceId),
    [scene],
  );

  const viewport = useSculptViewport({ scene, mountedInstanceIds });
  const frame = currentFrame(viewport.status);

  return (
    <div className="hero-stage">
      <SculptViewportSurface viewport={viewport} label={label} refusalLevel={2} />
      {viewport.status.kind !== "refused" && (
        /*
          One line of provenance under the art, so the hero cannot read as a render of
          something invented. Both values come from the running core, never from this
          page — and `surface` is printed beside the frame count so a counter can never
          imply pixels the core did not draw.
        */
        <p className="hero-stage-note">
          <span className="dot tone-ok" aria-hidden="true" />
          {frame === null ? (
            "Opening a committed Sculpt Artifact…"
          ) : (
            <>
              <code>{frame.surface}</code> · frame {frame.frame} · {frame.drawCalls} draw
              calls · {frame.instanceIds.length} instances
            </>
          )}
        </p>
      )}
    </div>
  );
}
