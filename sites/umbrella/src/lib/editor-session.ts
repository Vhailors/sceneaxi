/**
 * Driving a real Minimum E2 session from URL state.
 *
 * Rebuilds the session per request in an ephemeral workspace, applies the state, saves
 * through authoring-core's propose/apply, and reads back the snapshot plus the
 * multi-object composition projection. Every number a page shows therefore comes from
 * real engine code.
 *
 * Pure TypeScript: no React, no Next, gate-typechecked and gate-tested.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type MinimumE2SaveResult,
  type MinimumE2Snapshot,
  type SceneCompositionResult,
  type SiteResult,
  createWebEditorSession,
  ok,
  webEditorStarterArtifact,
} from "@sceneaxi/site-kit";
import type { EditorState } from "./editor-state.js";

/** Fixed seed, so the same URL always renders the same scene. */
export const EDITOR_SEED = 4242;

export type EditorRender = {
  readonly snapshot: MinimumE2Snapshot;
  readonly save: MinimumE2SaveResult;
  readonly composition: SceneCompositionResult;
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
      backend: "null",
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
      return ok(
        Object.freeze({
          snapshot: session.snapshot(),
          save: session.save(),
          composition: session.composeSceneProjection({ sceneId: "umbrella-web-editor" }),
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
