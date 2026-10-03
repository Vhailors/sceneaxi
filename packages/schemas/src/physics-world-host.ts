/**
 * Kernel-internal physics port. The kernel stays dependency-free: a host is
 * injected and probe-verified. Two adapters are required (ADR 0004): the
 * existing toy simulation and a Rapier deterministic host.
 */
import { requireScenePhysicsCatalog, SCENE_PHYSICS_REFUSALS, type ScenePhysicsSnapshot } from "./desktop-scene-physics.js";

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

/** Untrusted catalog inputs are parsed by requireScenePhysicsCatalog before allocation. */
type PhysicsCatalogInput = Parameters<typeof requireScenePhysicsCatalog>[0];

export type PhysicsWorldHost = {
    readonly kind: PhysicsWorldHostKind;
    create(catalog: PhysicsCatalogInput): PhysicsWorldHandle;
};

export const PHYSICS_HOST_PROBE_STEPS = 4 as const;

export function createToyPhysicsWorldHost(): PhysicsWorldHost {
    return Object.freeze({
        kind: "toy" as const,
        create(value: PhysicsCatalogInput): PhysicsWorldHandle {
            const catalog = requireScenePhysicsCatalog(value);
            let disposed = false;
            let steps = 0;

            const live = () => { if (disposed)
                throw new Error(PHYSICS_WORLD_HOST_REFUSALS.notReady); };

            const state = catalog.bodies.map((body, index) => {
                const collider = catalog.colliders.find((candidate) => candidate.bodyId === body.bodyId);
                const grounded = body.kind === "static" || (collider !== undefined && collider.kind === "box" && collider.size >= 100);

                return {
                    bodyId: body.bodyId,
                    y: index + 1 + (catalog.world.seed % 3) * 0.01,
                    vy: 0,
                    dynamic: body.kind === "dynamic" && !grounded,
                };
            });

            return {
                step(dtSeconds: number) {
                    live();

                    if (dtSeconds !== catalog.world.stepMs / 1000 || steps >= 100000)
                        throw new Error(SCENE_PHYSICS_REFUSALS.stepUnstable);
                    const next = state.map((body) => ({ ...body }));

                    for (const body of next) {
                        if (!body.dynamic)
                            continue;
                        body.vy += catalog.world.gravityY * dtSeconds;
                        body.y += body.vy * dtSeconds;

                        if (body.y < 0) {
                            const material = catalog.materials.find((candidate) => candidate.bodyId === body.bodyId);
                            body.y = 0;
                            body.vy = -body.vy * (material?.restitution ?? 0);
                        }
                    }

                    if (next.some((body) => !Number.isFinite(body.y) || !Number.isFinite(body.vy)))
                        throw new Error(SCENE_PHYSICS_REFUSALS.stepUnstable);

                    for (const [index, body] of next.entries())
                        state[index] = body;
                    steps += 1;
                },
                snapshot() {
                    live();

                    return Object.freeze(state.map((body) => Object.freeze({
                        bodyId: body.bodyId,
                        y: body.y,
                        vy: body.vy,
                    })));
                },
                serialize() {
                    live();

                    return JSON.stringify(state.map((body) => [body.bodyId, body.y, body.vy]));
                },
                dispose() {
                    if (disposed)
                        return;
                    disposed = true;
                    state.length = 0;
                },
            };
        },
    });
}
