import {
  isSculptIdentifier,
  isSculptTransform,
  validateSculptArtifact,
  type SculptArtifact,
  type SculptTransform,
} from "@sceneaxi/schemas";

export const EXPERIMENTAL_THREE_NON_DECISION_LABEL =
  "Experimental Three preview — non-decision; Stage 1 has not run.";

export type SculptInstanceInput = {
  readonly instanceId: string;
  readonly artifact: SculptArtifact;
  readonly transform?: SculptTransform;
};

export type SculptMountedInstance = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly artifact: SculptArtifact;
  readonly transform: SculptTransform;
};

export type SculptPresentationFrame = {
  readonly backend: "experimental-three" | "null";
  readonly label: string;
  readonly frame: number;
  readonly instanceIds: readonly string[];
  readonly drawCalls: number;
};

/** Backend-neutral adapter contract; renderer objects never cross this boundary. */
export interface SculptPresentationBackend {
  readonly id: SculptPresentationFrame["backend"];
  readonly label: string;
  mount(instance: SculptMountedInstance): void;
  update(instance: SculptMountedInstance): void;
  unmount(instanceId: string): void;
  render(instanceIds: readonly string[]): SculptPresentationFrame;
  dispose(): void;
}

export interface SculptMountApi {
  mount(input: SculptInstanceInput): SculptMountedInstance;
  updateTransform(instanceId: string, transform: SculptTransform): SculptMountedInstance;
  unmount(instanceId: string): void;
  list(): readonly SculptMountedInstance[];
  render(): SculptPresentationFrame;
  dispose(): void;
}

export class SculptMountError extends Error {
  constructor(
    readonly code:
      | "already-mounted"
      | "disposed"
      | "invalid-artifact"
      | "invalid-instance-id"
      | "invalid-transform"
      | "not-mounted",
    message: string,
  ) {
    super(message);
    this.name = "SculptMountError";
  }
}

const IDENTITY_TRANSFORM: SculptTransform = Object.freeze({
  translation: Object.freeze([0, 0, 0] as [number, number, number]),
  rotationEulerDegrees: Object.freeze([0, 0, 0] as [number, number, number]),
  scale: Object.freeze([1, 1, 1] as [number, number, number]),
});

function cloneTransform(transform: SculptTransform): SculptTransform {
  return Object.freeze({
    translation: Object.freeze([...transform.translation] as [number, number, number]),
    rotationEulerDegrees: Object.freeze([...transform.rotationEulerDegrees] as [number, number, number]),
    scale: Object.freeze([...transform.scale] as [number, number, number]),
  });
}

function freezeInstance(input: SculptInstanceInput, transform: SculptTransform): SculptMountedInstance {
  return Object.freeze({
    instanceId: input.instanceId,
    artifactId: input.artifact.artifactId,
    artifact: input.artifact,
    transform: cloneTransform(transform),
  });
}

/** Bind validated Sculpt Artifacts to one hidden presentation backend. */
export function createSculptMountApi(backend: SculptPresentationBackend): SculptMountApi {
  const instances = new Map<string, SculptMountedInstance>();
  let disposed = false;

  function requireLive() {
    if (disposed) throw new SculptMountError("disposed", "Sculpt Mount API is disposed.");
  }

  return {
    mount(input) {
      requireLive();
      if (!isSculptIdentifier(input.instanceId)) throw new SculptMountError("invalid-instance-id", "instanceId must be a lowercase slug.");
      if (instances.has(input.instanceId)) throw new SculptMountError("already-mounted", `Sculpt instance "${input.instanceId}" is already mounted.`);
      const artifact = validateSculptArtifact(input.artifact);
      if (!artifact.ok) throw new SculptMountError("invalid-artifact", artifact.diagnostics[0]?.message ?? "Sculpt Artifact refused.");
      const transform = input.transform ?? IDENTITY_TRANSFORM;
      if (!isSculptTransform(transform)) throw new SculptMountError("invalid-transform", "Instance transform is invalid.");
      const mounted = freezeInstance({ ...input, artifact: artifact.value }, transform);
      backend.mount(mounted);
      instances.set(mounted.instanceId, mounted);
      return mounted;
    },

    updateTransform(instanceId, transform) {
      requireLive();
      const current = instances.get(instanceId);
      if (current === undefined) throw new SculptMountError("not-mounted", `Sculpt instance "${instanceId}" is not mounted.`);
      if (!isSculptTransform(transform)) throw new SculptMountError("invalid-transform", "Instance transform is invalid.");
      const updated = freezeInstance({ instanceId, artifact: current.artifact }, transform);
      backend.update(updated);
      instances.set(instanceId, updated);
      return updated;
    },

    unmount(instanceId) {
      requireLive();
      if (!instances.has(instanceId)) throw new SculptMountError("not-mounted", `Sculpt instance "${instanceId}" is not mounted.`);
      backend.unmount(instanceId);
      instances.delete(instanceId);
    },

    list() {
      requireLive();
      return Object.freeze([...instances.values()]);
    },

    render() {
      requireLive();
      return backend.render([...instances.keys()].sort());
    },

    dispose() {
      requireLive();
      backend.dispose();
      instances.clear();
      disposed = true;
    },
  };
}

/** Mount-compatible null path used by non-visual gates. */
export function createNullSculptPresentationBackend(): SculptPresentationBackend {
  let frame = 0;
  return {
    id: "null",
    label: "Null sculpt presentation backend",
    mount() {},
    update() {},
    unmount() {},
    render(instanceIds) {
      frame += 1;
      return Object.freeze({
        backend: "null",
        label: "Null sculpt presentation backend",
        frame,
        instanceIds: Object.freeze([...instanceIds]),
        drawCalls: 0,
      });
    },
    dispose() {},
  };
}
