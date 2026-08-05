import type { SculptMountApi } from "@sceneaxi/engine-presentation";
import type { SculptTransform, Vector3 } from "@sceneaxi/schemas";
import type { MountableScene } from "@sceneaxi/site-kit";

type MutableTransform = {
  translation: [number, number, number];
  rotationEulerDegrees: [number, number, number];
  scale: [number, number, number];
};

function mutableVector(vector: Vector3): [number, number, number] {
  return [vector[0], vector[1], vector[2]];
}

function mutableTransform(transform: SculptTransform): MutableTransform {
  return {
    translation: mutableVector(transform.translation),
    rotationEulerDegrees: mutableVector(transform.rotationEulerDegrees),
    scale: mutableVector(transform.scale),
  };
}

function snapshot(transform: MutableTransform): SculptTransform {
  return Object.freeze({
    translation: Object.freeze(mutableVector(transform.translation)),
    rotationEulerDegrees: Object.freeze(mutableVector(transform.rotationEulerDegrees)),
    scale: Object.freeze(mutableVector(transform.scale)),
  });
}

export function createDesktopAssistantViewportController(mounts: SculptMountApi) {
  let instanceId: string | null = null;
  let transform: MutableTransform | null = null;

  return Object.freeze({
    replace(mountable: MountableScene) {
      const instance = mountable.instances[0];
      if (instance === undefined || mountable.instances.length !== 1) {
        throw new Error("Assistant output must contain exactly one mountable instance.");
      }
      const artifact = mountable.artifacts[instance.artifactId];
      if (artifact === undefined) {
        throw new Error("Assistant output does not contain its mounted artifact.");
      }
      if (instanceId !== null) {
        mounts.unmount(instanceId);
        instanceId = null;
        transform = null;
      }
      const mounted = mounts.mount({
        instanceId: instance.instanceId,
        artifact,
        transform: instance.worldTransform,
      });
      instanceId = instance.instanceId;
      transform = mutableTransform(instance.worldTransform);
      return mounted;
    },
    manipulate(action: string | undefined) {
      if (instanceId === null || transform === null) return null;
      switch (action) {
        case "move-x":
          transform.translation[0] += 0.25;
          break;
        case "move-y":
          transform.translation[1] += 0.25;
          break;
        case "rotate-y":
          transform.rotationEulerDegrees[1] += 15;
          break;
        case "scale-up":
          transform.scale = [
            transform.scale[0] + 0.1,
            transform.scale[1] + 0.1,
            transform.scale[2] + 0.1,
          ];
          break;
        default:
          return null;
      }
      return mounts.updateTransform(instanceId, snapshot(transform));
    },
  });
}
