/** Bounded Minimum E2 orchestration for the hybrid sculpt vertical. */
import {
  isJsonObject,
  isSculptIdentifier,
  isSculptTransform,
  parseDocumentText,
  validateSculptArtifact,
  type ApplyDiagnostic,
  type JsonObject,
  type SculptArtifact,
  type SculptTransform,
} from "@sceneaxi/schemas";
import {
  openSculptKernelSession,
  type SculptKernelSession,
  type SculptKernelSnapshot,
} from "@sceneaxi/engine-kernel";
import {
  createNullSculptPresentationBackend,
  createSculptMountApi,
  createThreeSculptPresentationBackend,
  type SculptMountApi,
  type SculptMountedInstance,
  type SculptPresentationFrame,
} from "@sceneaxi/engine-presentation";
import { resolve } from "node:path";
import { canonicalPath, readTextFile } from "./atomic-write.js";
import { apply, propose, type ProposeOk } from "./propose-apply.js";

export const MINIMUM_E2_STATE_VERSION = 1 as const;

export type MinimumE2PlayState = "paused" | "playing";

export type MinimumE2TreeNode = {
  readonly id: string;
  readonly parentId: string | null;
  readonly instanceId: string;
  readonly label: string;
  readonly kind: "sculpt-instance" | "sculpt-node";
};

export type MinimumE2Inspector = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly transform: SculptTransform;
  readonly componentCount: number;
  readonly socketCount: number;
  readonly kernel: SculptKernelSnapshot;
};

export type MinimumE2Snapshot = {
  readonly playState: MinimumE2PlayState;
  readonly tick: number;
  readonly selectedInstanceId: string | null;
  readonly sceneTree: readonly MinimumE2TreeNode[];
  readonly inspector: MinimumE2Inspector | null;
};

export type MinimumE2SaveResult =
  | {
      readonly ok: true;
      readonly proposal: ProposeOk["proposal"];
      readonly unifiedDiff: string;
      readonly appliedPaths: readonly string[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ApplyDiagnostic[];
    };

export type MinimumE2LoadResult =
  | { readonly ok: true; readonly instanceIds: readonly string[] }
  | { readonly ok: false; readonly code: "document-invalid" | "state-invalid"; readonly message: string };

export interface MinimumE2Editor {
  addSculpt(input: { readonly instanceId: string; readonly artifact: SculptArtifact; readonly transform?: SculptTransform }): void;
  removeSculpt(instanceId: string): void;
  select(instanceId: string | null): void;
  setSelectedTransform(transform: SculptTransform): void;
  play(): void;
  pause(): void;
  step(deltaMs?: number): void;
  tick(deltaMs: number): void;
  viewport(): SculptPresentationFrame;
  snapshot(): MinimumE2Snapshot;
  save(): MinimumE2SaveResult;
  load(): MinimumE2LoadResult;
  dispose(): void;
}

export class MinimumE2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MinimumE2Error";
  }
}

type PersistedInstance = {
  readonly instanceId: string;
  readonly artifact: SculptArtifact;
  readonly transform: SculptTransform;
};

function hasExactFields(value: JsonObject, fields: readonly string[]) {
  const keys = Object.keys(value);
  return keys.length === fields.length && keys.every((key) => fields.includes(key));
}

function persistedState(instances: readonly SculptMountedInstance[], selectedInstanceId: string | null): JsonObject {
  return {
    schemaVersion: MINIMUM_E2_STATE_VERSION,
    selectedInstanceId,
    instances: instances.map((instance) => ({
      instanceId: instance.instanceId,
      artifact: instance.artifact,
      transform: instance.transform,
    })),
  };
}

function validatePersistedState(value: unknown):
  | { readonly ok: true; readonly instances: readonly PersistedInstance[]; readonly selectedInstanceId: string | null }
  | { readonly ok: false; readonly message: string } {
  if (!isJsonObject(value)) return { ok: false, message: "minimumE2 state must be an object." };
  const state = value;
  if (!hasExactFields(state, ["schemaVersion", "selectedInstanceId", "instances"])) {
    return { ok: false, message: "minimumE2 state has missing or unexpected fields." };
  }
  if (state["schemaVersion"] !== MINIMUM_E2_STATE_VERSION || !Array.isArray(state["instances"])) {
    return { ok: false, message: `minimumE2 state must use schemaVersion ${MINIMUM_E2_STATE_VERSION} and an instances array.` };
  }
  const selected = state["selectedInstanceId"];
  if (selected !== null && typeof selected !== "string") return { ok: false, message: "selectedInstanceId must be a string or null." };
  const instances: PersistedInstance[] = [];
  const ids = new Set<string>();
  for (const [index, item] of state["instances"].entries()) {
    if (!isJsonObject(item)) return { ok: false, message: `instances[${index}] must be an object.` };
    const instance = item;
    if (!hasExactFields(instance, ["instanceId", "artifact", "transform"])) {
      return { ok: false, message: `instances[${index}] has missing or unexpected fields.` };
    }
    const instanceId = instance["instanceId"];
    if (!isSculptIdentifier(instanceId) || ids.has(instanceId)) return { ok: false, message: `instances[${index}].instanceId is invalid or duplicated.` };
    const artifact = validateSculptArtifact(instance["artifact"]);
    if (!artifact.ok) return { ok: false, message: `instances[${index}].artifact refused: ${artifact.diagnostics[0]?.message ?? "invalid artifact"}` };
    const transform = instance["transform"];
    if (!isSculptTransform(transform)) return { ok: false, message: `instances[${index}].transform is invalid.` };
    ids.add(instanceId);
    instances.push({ instanceId, artifact: artifact.value, transform });
  }
  if (selected !== null && !ids.has(selected)) return { ok: false, message: "selectedInstanceId must reference a persisted instance." };
  return { ok: true, instances, selectedInstanceId: selected };
}

/**
 * Create exactly the Minimum E2 checklist surface: viewport, tree, selection,
 * numeric transform, inspector, play/pause/step, add/remove, and save/load.
 */
export function createMinimumE2Editor(options: {
  readonly cwd: string;
  readonly documentPath: string;
  readonly backend?: "three" | "null";
  readonly seed?: number;
}): MinimumE2Editor {
  function createMounts() {
    return createSculptMountApi(
      options.backend === "null"
        ? createNullSculptPresentationBackend()
        : createThreeSculptPresentationBackend(),
    );
  }

  let mounts: SculptMountApi = createMounts();
  let sessions = new Map<string, SculptKernelSession>();
  const seed = options.seed ?? 1;
  let selectedInstanceId: string | null = null;
  let playState: MinimumE2PlayState = "paused";
  let tick = 0;
  const documentFile = canonicalPath(resolve(options.cwd, options.documentPath));

  function mountSculpt(
    targetMounts: SculptMountApi,
    targetSessions: Map<string, SculptKernelSession>,
    input: { readonly instanceId: string; readonly artifact: SculptArtifact; readonly transform?: SculptTransform },
  ) {
    targetMounts.mount(input);
    try {
      targetSessions.set(input.instanceId, openSculptKernelSession(input.artifact, { seed }));
    } catch (error) {
      targetMounts.unmount(input.instanceId);
      throw error;
    }
  }

  function add(input: { readonly instanceId: string; readonly artifact: SculptArtifact; readonly transform?: SculptTransform }) {
    mountSculpt(mounts, sessions, input);
  }

  function advance(deltaMs: number) {
    if (!Number.isInteger(deltaMs) || deltaMs < 0) throw new MinimumE2Error("deltaMs must be a non-negative integer.");
    tick += 1;
    for (const session of sessions.values()) session.advance({ tick, deltaMs });
  }

  function snapshot(): MinimumE2Snapshot {
    const instances = mounts.list();
    const tree: MinimumE2TreeNode[] = [];
    for (const instance of instances) {
      tree.push(Object.freeze({
        id: instance.instanceId,
        parentId: null,
        instanceId: instance.instanceId,
        label: instance.artifactId,
        kind: "sculpt-instance",
      }));
      for (const node of instance.artifact.runtimeHierarchy.nodes) {
        tree.push(Object.freeze({
          id: `${instance.instanceId}/${node.id}`,
          parentId: node.parentId === null ? instance.instanceId : `${instance.instanceId}/${node.parentId}`,
          instanceId: instance.instanceId,
          label: node.id,
          kind: "sculpt-node",
        }));
      }
    }
    const selected = selectedInstanceId === null ? undefined : instances.find((instance) => instance.instanceId === selectedInstanceId);
    const kernel = selected === undefined ? undefined : sessions.get(selected.instanceId)?.observe();
    const inspector = selected === undefined || kernel === undefined
      ? null
      : Object.freeze({
          instanceId: selected.instanceId,
          artifactId: selected.artifactId,
          transform: selected.transform,
          componentCount: selected.artifact.spec.components.length,
          socketCount: selected.artifact.spec.sockets.length,
          kernel,
        });
    return Object.freeze({
      playState,
      tick,
      selectedInstanceId,
      sceneTree: Object.freeze(tree),
      inspector,
    });
  }

  return {
    addSculpt: add,
    removeSculpt(instanceId) {
      mounts.unmount(instanceId);
      sessions.delete(instanceId);
      if (selectedInstanceId === instanceId) selectedInstanceId = null;
    },
    select(instanceId) {
      if (instanceId !== null && !mounts.list().some((instance) => instance.instanceId === instanceId)) {
        throw new MinimumE2Error(`Cannot select missing sculpt instance "${instanceId}".`);
      }
      selectedInstanceId = instanceId;
    },
    setSelectedTransform(transform) {
      if (selectedInstanceId === null) throw new MinimumE2Error("Select a sculpt instance before editing its transform.");
      mounts.updateTransform(selectedInstanceId, transform);
    },
    play() {
      playState = "playing";
    },
    pause() {
      playState = "paused";
    },
    step(deltaMs = 16) {
      advance(deltaMs);
    },
    tick(deltaMs) {
      if (playState === "playing") advance(deltaMs);
    },
    viewport() {
      return mounts.render();
    },
    snapshot,
    save() {
      let document;
      try {
        document = parseDocumentText(readTextFile(documentFile));
      } catch (error) {
        return { ok: false, diagnostics: [{ code: "document-not-found", message: error instanceof Error ? error.message : String(error), documentPath: options.documentPath }] };
      }
      if (!document.ok) return { ok: false, diagnostics: [{ code: "invalid-document", message: document.message, documentPath: options.documentPath }] };
      const newData: JsonObject = {
        ...document.document.data,
        minimumE2: persistedState(mounts.list(), selectedInstanceId),
      };
      const proposed = propose({ cwd: options.cwd, documentPath: options.documentPath, jsonPointer: "/data", newValue: newData });
      if (!proposed.ok) return proposed;
      const applied = apply({ cwd: options.cwd, proposal: proposed.proposal });
      if (!applied.ok) return { ok: false, diagnostics: applied.diagnostics };
      return { ok: true, proposal: proposed.proposal, unifiedDiff: proposed.unifiedDiff, appliedPaths: applied.appliedPaths };
    },
    load() {
      let parsed;
      try {
        parsed = parseDocumentText(readTextFile(documentFile));
      } catch (error) {
        return { ok: false, code: "document-invalid", message: error instanceof Error ? error.message : String(error) };
      }
      if (!parsed.ok) return { ok: false, code: "document-invalid", message: parsed.message };
      const state = validatePersistedState(parsed.document.data["minimumE2"]);
      if (!state.ok) return { ok: false, code: "state-invalid", message: state.message };
      const stagedMounts = createMounts();
      const stagedSessions = new Map<string, SculptKernelSession>();
      try {
        for (const instance of state.instances) {
          mountSculpt(stagedMounts, stagedSessions, instance);
        }
      } catch (error) {
        stagedMounts.dispose();
        return {
          ok: false,
          code: "state-invalid",
          message: error instanceof Error ? error.message : String(error),
        };
      }
      mounts.dispose();
      sessions.clear();
      mounts = stagedMounts;
      sessions = stagedSessions;
      selectedInstanceId = state.selectedInstanceId;
      playState = "paused";
      tick = 0;
      return { ok: true, instanceIds: Object.freeze(state.instances.map((instance) => instance.instanceId)) };
    },
    dispose() {
      mounts.dispose();
      sessions.clear();
    },
  };
}
