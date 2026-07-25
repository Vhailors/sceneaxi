/**
 * Bounded Minimum E2 web editor session.
 *
 * A thin server-side wrapper over `createMinimumE2Editor` from
 * `@sceneaxi/authoring-core`, giving the umbrella site an editor session over an
 * ephemeral per-session workspace. There is **no second authoring implementation
 * here**: save/load goes through authoring-core's propose/apply, and every editor
 * operation delegates.
 *
 * The exposed surface is exactly the Minimum E2 checklist plus one additive
 * projection, `composeSceneProjection()`, which reads the session's mounted
 * placements through the landed scene-composition pipeline (ADRs 0014-0015). The
 * key set is frozen and asserted, so general-E2 expansion fails the gate —
 * ADR 0003 keeps general E2 specified-not-built and this ship does not touch that.
 *
 * Composition is a **projection**: a Sculpt Artifact is never rewritten to place
 * it, because its evidence binds its exact spec bytes.
 */
import { existsSync, mkdirSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  type MinimumE2Editor,
  type MinimumE2LoadResult,
  type MinimumE2SaveResult,
  type MinimumE2Snapshot,
  type SceneCompositionResult,
  canonicalPath,
  composeScene,
  createMinimumE2Editor,
  parseDocumentText,
  readTextFile,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";
import {
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  createDocument,
  digestSceneArtifact,
  identitySculptTransform,
  isSculptTransform,
  type SceneCompositionIntake,
  type SculptArtifact,
  type SculptTransform,
  validateSculptArtifact,
} from "@sceneaxi/schemas";
import { type SiteRefusalReason, type SiteResult, ok, refuse } from "./refusals.js";

/** The default document a session reads and writes inside its workspace. */
export const WEB_EDITOR_DOCUMENT_PATH = "scene.sceneaxi.json";

const DEFAULT_SCENE_ID = "umbrella-web-editor-scene";
const DEFAULT_SCENE_ROOT_ID = "umbrella-web-editor-root";

/**
 * Exactly the operations a web editor session exposes. Frozen and asserted, so a
 * general-E2 operation cannot be added without failing the gate.
 */
export const WEB_EDITOR_SESSION_OPERATIONS = Object.freeze([
  "addSculpt",
  "removeSculpt",
  "select",
  "setSelectedTransform",
  "play",
  "pause",
  "step",
  "viewport",
  "snapshot",
  "save",
  "load",
  "dispose",
  "composeSceneProjection",
] as const);

/** Thrown when a disposed session is used. Carries the named refusal reason. */
export class WebEditorError extends Error {
  readonly reason: SiteRefusalReason;

  constructor(reason: SiteRefusalReason, message: string) {
    super(message);
    this.name = "WebEditorError";
    this.reason = reason;
  }
}

export type WebEditorMount = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly transform: SculptTransform;
};

type ProjectedMount = {
  readonly artifact: SculptArtifact;
  readonly transform: SculptTransform;
};

export type WebEditorViewportFrame = ReturnType<MinimumE2Editor["viewport"]>;

export interface WebEditorSession {
  addSculpt(input: {
    readonly instanceId: string;
    readonly artifact: SculptArtifact;
    readonly transform?: SculptTransform;
  }): void;
  removeSculpt(instanceId: string): void;
  select(instanceId: string | null): void;
  setSelectedTransform(transform: SculptTransform): void;
  play(): void;
  pause(): void;
  step(deltaMs?: number): void;
  viewport(): WebEditorViewportFrame;
  snapshot(): MinimumE2Snapshot;
  save(): MinimumE2SaveResult;
  load(): MinimumE2LoadResult;
  dispose(): void;
  /**
   * Project the session's mounted placements through `composeScene`. Additive and
   * read-only: it mutates nothing and rewrites no artifact.
   *
   * A composed scene declares exactly one root, so one mounted instance is the
   * root and the rest are its children. Placement is hierarchical per ADR 0014:
   * a child transform is read relative to its parent.
   */
  composeSceneProjection(input?: {
    readonly sceneId?: string;
    readonly rootInstanceId?: string;
  }): SceneCompositionResult;
}

export type WebEditorSessionOptions = {
  /** Absolute path to an ephemeral per-session workspace. */
  readonly workspaceRoot: string;
  readonly documentPath?: string;
  readonly backend?: "three" | "null";
  readonly seed?: number;
  /** Document id used when this session seeds a fresh document. */
  readonly sceneId?: string;
};

/**
 * Whether `documentPath` stays inside `workspaceRoot`.
 *
 * Path confinement is checked by segment containment after resolution, so `..`,
 * an absolute path, and a path that merely shares a prefix with the root are all
 * caught rather than only the obvious `../` case.
 */
function confinedDocumentPath(
  workspaceRoot: string,
  documentPath: string,
): SiteResult<string> {
  if (!isAbsolute(workspaceRoot)) return refuse("EDITOR_WORKSPACE_INVALID");
  if (documentPath.trim().length === 0) return refuse("EDITOR_WORKSPACE_ESCAPE");
  if (isAbsolute(documentPath)) return refuse("EDITOR_WORKSPACE_ESCAPE");
  const root = resolve(workspaceRoot);
  const target = resolve(root, documentPath);
  const rel = relative(root, target);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return refuse("EDITOR_WORKSPACE_ESCAPE");
  }
  return ok(documentPath);
}

function isPathInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const cloneTransform = (transform: SculptTransform): SculptTransform =>
  Object.freeze({
    translation: Object.freeze([...transform.translation] as [number, number, number]),
    rotationEulerDegrees: Object.freeze([
      ...transform.rotationEulerDegrees,
    ] as [number, number, number]),
    scale: Object.freeze([...transform.scale] as [number, number, number]),
  });

function readPersistedMounts(documentFile: string): Map<string, ProjectedMount> | null {
  let parsed;
  try {
    parsed = parseDocumentText(readTextFile(documentFile));
  } catch {
    return null;
  }
  if (!parsed.ok) return null;
  const state = parsed.document.data["minimumE2"];
  if (!isRecord(state) || !Array.isArray(state["instances"])) return null;
  const loaded = new Map<string, ProjectedMount>();
  for (const value of state["instances"]) {
    if (!isRecord(value) || typeof value["instanceId"] !== "string") return null;
    const artifact = validateSculptArtifact(value["artifact"]);
    const transform = value["transform"];
    if (!artifact.ok || !isSculptTransform(transform) || loaded.has(value["instanceId"])) {
      return null;
    }
    loaded.set(value["instanceId"], {
      artifact: artifact.value,
      transform: cloneTransform(transform),
    });
  }
  return loaded;
}

/**
 * Create a bounded Minimum E2 editor session.
 *
 * Refuses rather than throwing on an unusable workspace, so a route can render a
 * named reason instead of a stack trace.
 */
export function createWebEditorSession(
  options: WebEditorSessionOptions,
): SiteResult<WebEditorSession> {
  const documentPath = options.documentPath ?? WEB_EDITOR_DOCUMENT_PATH;
  const confined = confinedDocumentPath(options.workspaceRoot, documentPath);
  if (!confined.ok) return confined;

  const workspaceRoot = resolve(options.workspaceRoot);
  mkdirSync(workspaceRoot, { recursive: true });
  const canonicalWorkspaceRoot = canonicalPath(workspaceRoot);
  const documentFile = canonicalPath(resolve(canonicalWorkspaceRoot, confined.value));
  if (!isPathInside(canonicalWorkspaceRoot, documentFile)) {
    return refuse("EDITOR_WORKSPACE_ESCAPE");
  }

  // Minimum E2 `save()` proposes an edit against an existing text-canonical
  // document, so an empty session needs one seeded before it can ever save.
  if (!existsSync(documentFile)) {
    const seeded = writeDocumentFile(
      confined.value,
      createDocument({ id: options.sceneId ?? DEFAULT_SCENE_ID, data: {} }),
      { cwd: canonicalWorkspaceRoot },
    );
    if (!seeded.ok) return refuse("EDITOR_WORKSPACE_INVALID");
  }

  const editor: MinimumE2Editor = createMinimumE2Editor({
    cwd: canonicalWorkspaceRoot,
    documentPath: confined.value,
    ...(options.backend === undefined ? {} : { backend: options.backend }),
    ...(options.seed === undefined ? {} : { seed: options.seed }),
  });

  // Mounted placements are tracked here only so `composeSceneProjection` can build
  // a composition intake. The editor remains the single source of truth for state.
  const mounts = new Map<string, ProjectedMount>();
  let disposed = false;

  const live = (): void => {
    if (disposed) {
      throw new WebEditorError(
        "EDITOR_SESSION_DISPOSED",
        "The editor session has been disposed.",
      );
    }
  };

  const implementation: WebEditorSession = {
    addSculpt(input) {
      live();
      editor.addSculpt(input);
      const artifact = validateSculptArtifact(input.artifact);
      if (!artifact.ok) throw new Error("The editor accepted an invalid Sculpt Artifact.");
      mounts.set(input.instanceId, {
        artifact: artifact.value,
        transform: cloneTransform(input.transform ?? identitySculptTransform()),
      });
    },
    removeSculpt(instanceId) {
      live();
      editor.removeSculpt(instanceId);
      mounts.delete(instanceId);
    },
    select(instanceId) {
      live();
      editor.select(instanceId);
    },
    setSelectedTransform(transform) {
      live();
      editor.setSelectedTransform(transform);
      const selected = editor.snapshot().selectedInstanceId;
      const mount = selected === null ? undefined : mounts.get(selected);
      if (selected !== null && mount !== undefined) {
        mounts.set(selected, { artifact: mount.artifact, transform: cloneTransform(transform) });
      }
    },
    play() {
      live();
      editor.play();
    },
    pause() {
      live();
      editor.pause();
    },
    step(deltaMs) {
      live();
      if (deltaMs === undefined) editor.step();
      else editor.step(deltaMs);
    },
    viewport() {
      live();
      return editor.viewport();
    },
    snapshot() {
      live();
      return editor.snapshot();
    },
    save() {
      live();
      return editor.save();
    },
    load() {
      live();
      const loadedMounts = readPersistedMounts(documentFile);
      const result = editor.load();
      if (result.ok) {
        mounts.clear();
        if (
          loadedMounts !== null &&
          loadedMounts.size === result.instanceIds.length &&
          result.instanceIds.every((instanceId) => loadedMounts.has(instanceId))
        ) {
          for (const [instanceId, mount] of loadedMounts) {
            mounts.set(instanceId, mount);
          }
        }
      }
      return result;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mounts.clear();
      editor.dispose();
    },
    composeSceneProjection(input) {
      live();
      const mounted = editor
        .snapshot()
        .sceneTree.filter((node) => node.kind === "sculpt-instance")
        .flatMap((node) => {
          const mount = mounts.get(node.instanceId);
          return mount === undefined ? [] : [{ instanceId: node.instanceId, mount }];
        });
      const requestedRoot = input?.rootInstanceId;
      const rootInstanceId =
        requestedRoot !== undefined &&
        mounted.some((entry) => entry.instanceId === requestedRoot)
          ? requestedRoot
          : (mounted[0]?.instanceId ?? DEFAULT_SCENE_ROOT_ID);
      const placements = mounted.map((entry) => ({
        instanceId: entry.instanceId,
        artifactId: entry.mount.artifact.artifactId,
        parentInstanceId: entry.instanceId === rootInstanceId ? null : rootInstanceId,
        transform: entry.mount.transform,
      }));
      const intake: SceneCompositionIntake = {
        schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
        kind: SCENE_COMPOSITION_INTAKE_KIND,
        sceneId: input?.sceneId ?? DEFAULT_SCENE_ID,
        rootInstanceId,
        placements,
      };
      const artifacts: SculptArtifact[] = [];
      const artifactDigests = new Map<string, string>();
      for (const entry of mounted) {
        const artifact = entry.mount.artifact;
        const digest = digestSceneArtifact(artifact);
        const priorDigest = artifactDigests.get(artifact.artifactId);
        if (priorDigest === undefined) {
          artifactDigests.set(artifact.artifactId, digest);
          artifacts.push(artifact);
        } else if (priorDigest !== digest) {
          artifacts.push(artifact);
        }
      }
      return composeScene(intake, artifacts);
    },
  };

  return ok(Object.freeze(implementation));
}
