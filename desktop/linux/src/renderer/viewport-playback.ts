import type { SculptMountApi } from "@sceneaxi/engine-presentation";

export type DesktopMountableInstance = {
  readonly instanceId: string;
  readonly artifactId: string;
  readonly label: string;
  readonly worldTransform: unknown;
};

export type DesktopMountablePayload = {
  readonly sceneId: string;
  readonly sceneDigest: string;
  readonly artifacts: Readonly<Record<string, unknown>>;
  readonly instances: readonly DesktopMountableInstance[];
};

export function desktopMountablePayload(value: unknown): value is DesktopMountablePayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DesktopMountablePayload>;
  return (
    typeof candidate.sceneId === "string" &&
    typeof candidate.sceneDigest === "string" &&
    typeof candidate.artifacts === "object" &&
    candidate.artifacts !== null &&
    Array.isArray(candidate.instances)
  );
}

export function mountDesktopScene(
  mounts: SculptMountApi,
  payload: DesktopMountablePayload,
): void {
  for (const instance of payload.instances) {
    mounts.mount({
      instanceId: instance.instanceId,
      artifact: payload.artifacts[instance.artifactId],
      transform: instance.worldTransform,
    } as Parameters<SculptMountApi["mount"]>[0]);
  }
}

export function synchronizeViewportScene(input: {
  readonly mounts: SculptMountApi;
  readonly frameMountedContent: () => void;
  readonly current: DesktopMountablePayload;
  readonly next: unknown;
}):
  | { readonly ok: true; readonly scene: DesktopMountablePayload }
  | { readonly ok: false; readonly scene: DesktopMountablePayload; readonly error: unknown } {
  if (!desktopMountablePayload(input.next)) {
    return { ok: false, scene: input.current, error: new Error("Invalid mountable scene payload.") };
  }
  if (input.next.sceneDigest === input.current.sceneDigest) {
    return { ok: true, scene: input.next };
  }

  const previous = input.mounts.list();
  try {
    for (const mounted of previous) input.mounts.unmount(mounted.instanceId);
    mountDesktopScene(input.mounts, input.next);
    input.frameMountedContent();
    return { ok: true, scene: input.next };
  } catch (error) {
    try {
      for (const mounted of input.mounts.list()) input.mounts.unmount(mounted.instanceId);
      for (const mounted of previous) {
        input.mounts.mount({
          instanceId: mounted.instanceId,
          artifact: mounted.artifact,
          transform: mounted.transform,
        });
      }
      input.frameMountedContent();
    } catch (rollbackError) {
      return { ok: false, scene: input.current, error: rollbackError };
    }
    return { ok: false, scene: input.current, error };
  }
}
