/**
 * Kernel-internal physics port. The kernel stays dependency-free: a host is
 * injected and probe-verified. Two adapters are required (ADR 0004): the
 * existing toy simulation and a Rapier deterministic host.
 */
import type { ScenePhysicsCatalog, ScenePhysicsSnapshot } from "./desktop-scene-physics.js";

export const PHYSICS_WORLD_HOST_KINDS = Object.freeze(["toy", "rapier"] as const);
export type PhysicsWorldHostKind = (typeof PHYSICS_WORLD_HOST_KINDS)[number];

export const PHYSICS_WORLD_HOST_REFUSALS = Object.freeze({
  probeFailed: "PHYSICS_HOST_PROBE_FAILED",
  kindUnknown: "PHYSICS_HOST_KIND_UNKNOWN",
  notReady: "PHYSICS_HOST_NOT_READY",
} as const);

export type PhysicsWorldHandle = {
  step(dtSeconds: number): void;
  snapshot(): ScenePhysicsSnapshot["bodies"];
  serialize(): string;
  dispose(): void;
};

export type PhysicsWorldHost = {
  readonly kind: PhysicsWorldHostKind;
  create(catalog: ScenePhysicsCatalog): PhysicsWorldHandle;
};

export const PHYSICS_HOST_PROBE_STEPS = 4 as const;

export function createToyPhysicsWorldHost(): PhysicsWorldHost {
  return Object.freeze({
    kind: "toy" as const,
    create(catalog: ScenePhysicsCatalog): PhysicsWorldHandle {
      const state = catalog.bodies.map((body, index) => {
        const shape = catalog.shapes.find((candidate) => candidate.bodyId === body.bodyId);
        const grounded = body.kind === "static" || (shape !== undefined && shape.kind === "box" && shape.size >= 100);
        return {
          bodyId: body.bodyId,
          y: index + 1 + (catalog.world.seed % 3) * 0.01,
          vy: 0,
          dynamic: body.kind === "dynamic" && !grounded,
        };
      });
      return {
        step(dtSeconds: number) {
          for (const body of state) {
            if (!body.dynamic) continue;
            body.vy += catalog.world.gravityY * dtSeconds;
            body.y += body.vy * dtSeconds;
            if (body.y < 0) {
              const material = catalog.materials.find((candidate) => candidate.bodyId === body.bodyId);
              body.y = 0;
              body.vy = -body.vy * (material?.restitution ?? 0);
            }
          }
        },
        snapshot() {
          return Object.freeze(state.map((body) => Object.freeze({
            bodyId: body.bodyId,
            y: body.y,
            vy: body.vy,
          })));
        },
        serialize() {
          return JSON.stringify(state.map((body) => [body.bodyId, body.y, body.vy]));
        },
        dispose() {
          state.length = 0;
        },
      };
    },
  });
}
