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
import {
  contentHash,
  parseDocumentText,
  readTextFile,
  type MinimumE2SaveResult,
  type MinimumE2Snapshot,
  type SceneCompositionResult,
  type SceneDocument,
} from "@sceneaxi/authoring-core";
import { mountableScene, type MountableScene } from "./mountable-scene.js";
import { type SiteResult, ok } from "./refusals.js";
import { webEditorStarterArtifact } from "./starter-artifact.js";
import {
  WEB_EDITOR_DOCUMENT_PATH,
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
  /** SHA-256 of the text-canonical document after this render's real save. */
  readonly documentDigest: string;
  /** Digest of the composed editor artifact; identical to the composition evidence. */
  readonly artifactDigest: string;
  /**
   * The text-canonical document as it stood *before* this render's save, or
   * `null` when it could not be read back. The Changes panel reviews the real
   * save proposal against exactly this baseline, so what the review shows is
   * the diff propose/apply actually judged.
   */
  readonly baseDocument: SceneDocument | null;
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

      // Captured before save so the Changes review judges the same baseline
      // the proposal was made against. An unreadable baseline is `null`, never
      // an invented document.
      let baseDocument: SceneDocument | null = null;
      try {
        const parsed = parseDocumentText(
          readTextFile(join(workspaceRoot, WEB_EDITOR_DOCUMENT_PATH)),
        );
        baseDocument = parsed.ok ? parsed.document : null;
      } catch {
        baseDocument = null;
      }

      const save = session.save();
      if (!save.ok) {
        return ok(
          Object.freeze({
            snapshot: session.snapshot(),
            viewport: session.viewport(),
            save,
            composition,
            mountable: composition.ok ? mountableScene(composition) : null,
            artifactId: artifact.value.artifactId,
            documentDigest: "",
            artifactDigest: composition.ok ? composition.sceneDigest : "",
            baseDocument,
          }),
        );
      }
      // An unreadable saved document yields no digest rather than an invented one,
      // exactly like the `!save.ok` branch above; submission refuses on an empty digest.
      let documentDigest = "";
      try {
        documentDigest = contentHash(
          readTextFile(join(workspaceRoot, WEB_EDITOR_DOCUMENT_PATH)),
        );
      } catch {
        documentDigest = "";
      }
      return ok(
        Object.freeze({
          snapshot: session.snapshot(),
          viewport: session.viewport(),
          save,
          composition,
          mountable: composition.ok ? mountableScene(composition) : null,
          artifactId: artifact.value.artifactId,
          documentDigest,
          artifactDigest: composition.ok ? composition.sceneDigest : "",
          baseDocument,
        }),
      );
    } finally {
      session.dispose();
    }
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
}
