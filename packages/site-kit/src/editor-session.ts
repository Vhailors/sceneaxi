/**
 * Driving a real Minimum E2 session from URL state.
 *
 * Rebuilds the session per request in an ephemeral workspace, applies the state, saves
 * through authoring-core's propose/apply, and reads back the snapshot, the viewport
 * frame, and the multi-object composition projection. Every number a page shows
 * therefore comes from real engine code.
 *
 * The session runs on the Three presentation core's **headless** surface, because a
 * server has no WebGL drawing buffer: that frame reports `pixelsDrawn: false` and is
 * the same core the browser viewport builds on a canvas. The browser's mount payload
 * is projected from the same composition the page renders, so the canvas can never
 * draw a scene the server did not compose.
 *
 * Pure TypeScript: no React, no Next, gate-typechecked and gate-tested.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  MinimumE2SaveResult,
  MinimumE2Snapshot,
  SceneCompositionResult,
} from "@sceneaxi/authoring-core";
import { mountableScene, type MountableScene } from "./mountable-scene.js";
import { type SiteResult, ok } from "./refusals.js";
import { webEditorStarterArtifact } from "./starter-artifact.js";
import {
  type WebEditorViewportFrame,
  createWebEditorSession,
} from "./web-editor.js";
import type { EditorState } from "./editor-state.js";

/** Fixed seed, so the same URL always renders the same scene. */
export const EDITOR_SEED = 4242;

/** Document id of the composed scene an editor session projects. */
export const EDITOR_SCENE_ID = "umbrella-web-editor";

export type EditorRender = {
  readonly snapshot: MinimumE2Snapshot;
  /** The server session's own frame, drawn on the core's no-pixel surface. */
  readonly viewport: WebEditorViewportFrame;
  readonly save: MinimumE2SaveResult;
  readonly composition: SceneCompositionResult;
  /**
   * The composed scene as a browser mount payload, or `null` when the pipeline
   * refused the placements — in which case the page renders the pipeline's refusal
   * rather than a viewport with nothing in it.
   */
  readonly mountable: MountableScene | null;
  readonly artifactId: string;
};

/**
 * Render one editor state.
 *
 * The workspace is created and removed inside this call: nothing persists between
 * requests, which is the honest shape until a storage decision exists.
 */
export function renderEditorState(state: EditorState): SiteResult<EditorRender> {
  const artifact = webEditorStarterArtifact();
  if (!artifact.ok) return artifact;

  const workspaceRoot = mkdtempSync(join(tmpdir(), "sceneaxi-umbrella-editor-"));
  try {
    const created = createWebEditorSession({
      workspaceRoot,
      backend: "three",
      seed: EDITOR_SEED,
    });
    if (!created.ok) return created;
    const session = created.value;
    try {
      for (const instance of state.instances) {
        session.addSculpt({
          instanceId: instance.instanceId,
          artifact: artifact.value,
          transform: instance.transform,
        });
      }
      session.select(state.selectedInstanceId);
      if (state.playing) {
        session.play();
        session.step(16);
      }
      const composition = session.composeSceneProjection({ sceneId: EDITOR_SCENE_ID });
      return ok(
        Object.freeze({
          snapshot: session.snapshot(),
          viewport: session.viewport(),
          save: session.save(),
          composition,
          mountable: composition.ok ? mountableScene(composition) : null,
          artifactId: artifact.value.artifactId,
        }),
      );
    } finally {
      session.dispose();
    }
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}
