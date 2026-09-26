import type { GltfAnimationClip } from "@sceneaxi/schemas";
import type {
  SculptMountApi,
  ThreeSculptPresentationBackend,
  ThreeTriangleAssetInput,
} from "@sceneaxi/engine-presentation";

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
  readonly importedAssets?: readonly Readonly<{
    instanceId: string;
    digest: string;
    meshes: ThreeTriangleAssetInput["meshes"];
    nodes: NonNullable<ThreeTriangleAssetInput["nodes"]>;
    animations: readonly GltfAnimationClip[];
  }>[];
};

export function desktopMountablePayload(value: unknown): value is DesktopMountablePayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<DesktopMountablePayload>;
  return (
    typeof candidate.sceneId === "string" &&
    typeof candidate.sceneDigest === "string" &&
    typeof candidate.artifacts === "object" &&
    candidate.artifacts !== null &&
    Array.isArray(candidate.instances) &&
    (candidate.importedAssets === undefined || Array.isArray(candidate.importedAssets))
  );
}

export function mountDesktopScene(
  mounts: SculptMountApi,
  payload: DesktopMountablePayload,
  triangleBackend?: Pick<ThreeSculptPresentationBackend, "mountTriangleAsset">,
): void {
  for (const instance of payload.instances) {
    mounts.mount({
      instanceId: instance.instanceId,
      artifact: payload.artifacts[instance.artifactId],
      transform: instance.worldTransform,
    } as Parameters<SculptMountApi["mount"]>[0]);
  }
  for (const asset of payload.importedAssets ?? []) {
    const instance = payload.instances.find((candidate) => candidate.instanceId === asset.instanceId);
    if (instance === undefined || triangleBackend === undefined) {
      throw new Error(`Contained asset instance "${asset.instanceId}" has no presentation target.`);
    }
    triangleBackend.mountTriangleAsset({
      instanceId: asset.instanceId,
      transform: instance.worldTransform as ThreeTriangleAssetInput["transform"],
      meshes: asset.meshes,
      nodes: asset.nodes,
    });
  }
}

export function resetDesktopSceneAnimations(input: {
  readonly backend: Pick<ThreeSculptPresentationBackend, "resetTriangleAnimation">;
  readonly scene: DesktopMountablePayload;
}): void {
  for (const asset of input.scene.importedAssets ?? []) input.backend.resetTriangleAnimation(asset.instanceId);
}

export function playDesktopSceneAnimations(input: {
  readonly backend: Pick<ThreeSculptPresentationBackend, "playTriangleAnimation">;
  readonly scene: DesktopMountablePayload;
  readonly time: number;
}): void {
  for (const asset of input.scene.importedAssets ?? []) {
    const clip = asset.animations[0];
    if (clip !== undefined) input.backend.playTriangleAnimation(asset.instanceId, clip, input.time);
  }
}

export function synchronizeViewportScene(input: {
  readonly mounts: SculptMountApi;
  readonly frameMountedContent: () => void;
  readonly current: DesktopMountablePayload;
  readonly next: unknown;
  readonly triangleBackend?: Pick<ThreeSculptPresentationBackend, "mountTriangleAsset">;
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
    mountDesktopScene(input.mounts, input.next, input.triangleBackend);
    input.frameMountedContent();
    return { ok: true, scene: input.next };
  } catch (error) {
    try {
      for (const mounted of input.mounts.list()) input.mounts.unmount(mounted.instanceId);
      mountDesktopScene(input.mounts, input.current, input.triangleBackend);
      input.frameMountedContent();
    } catch (rollbackError) {
      return { ok: false, scene: input.current, error: rollbackError };
    }
    return { ok: false, scene: input.current, error };
  }
}
