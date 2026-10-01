import { init } from "@dimforge/rapier3d-compat";
import {
  PHYSICS_HOST_PROBE_STEPS,
  PHYSICS_WORLD_HOST_REFUSALS,
  emptyScenePhysicsCatalog,
  type PackageSeam,
  type PhysicsWorldHost,
  type ScenePhysicsCatalog,
} from "@sceneaxi/schemas";
import { createWorld, replayWorld, type RapierWorldHandle, type RapierWorldOptions, type RapierWorldSave } from "./world.js";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/physics-rapier",
  releaseGroup: "core-train",
});

let initialization: Promise<void> | undefined;

function probe() {
  const catalog: ScenePhysicsCatalog = {
    ...emptyScenePhysicsCatalog(),
    world: { gravityY: -9.81, stepMs: 16, seed: 1, engine: "rapier" },
    bodies: [{ bodyId: "probe", instanceId: "probe", kind: "dynamic", mass: 1 }],
    colliders: [{ colliderId: "probe", bodyId: "probe", kind: "sphere", size: 0.5 }],
  };

  function run() {
    const world = createWorld(catalog);

    try {
      for (let step = 0; step < PHYSICS_HOST_PROBE_STEPS; step += 1) world.step(0.016);
      const body = world.snapshot()[0];

      if (body === undefined || body.y >= 1.01 || body.vy >= 0) {
        throw new Error(PHYSICS_WORLD_HOST_REFUSALS.probeFailed);
      }

      return world.serialize();
    } finally {
      world.dispose();
    }
  }

  if (run() !== run()) throw new Error(PHYSICS_WORLD_HOST_REFUSALS.probeFailed);
}

export type RapierPhysicsWorldHost = Omit<PhysicsWorldHost, "create"> & { create(catalog: ScenePhysicsCatalog, options?: RapierWorldOptions): RapierWorldHandle; replay(save: RapierWorldSave): RapierWorldHandle };

export type { RapierBodyPose, RapierBodySnapshot, RapierJointFrame, RapierWorldOptions, RapierWorldSave, RapierWorldHandle } from "./world.js";

export async function createRapierPhysicsWorldHost(): Promise<RapierPhysicsWorldHost> {
  try {
    initialization ??= init();
    await initialization;
  } catch {
    initialization = undefined;
    throw new Error(PHYSICS_WORLD_HOST_REFUSALS.notReady);
  }

  try {
    probe();
  } catch {
    throw new Error(PHYSICS_WORLD_HOST_REFUSALS.probeFailed);
  }

  return Object.freeze({ kind: "rapier", create: createWorld, replay: replayWorld });
}
