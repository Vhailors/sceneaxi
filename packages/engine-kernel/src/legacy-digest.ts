/** Original v1 three-argument helper. Caller order and JSON projection are contractual. */
import type { SnapshotEntity } from "@sceneaxi/schemas";
import { portableKernelDigest } from "./portable-digest.js";

export function computeDigest(tick: number, seed: number, entities: ReadonlyArray<SnapshotEntity>): string {
    return "sha256:" + portableKernelDigest(JSON.stringify({ tick, seed, entities: entities.map(entity => ({ id: entity.id, x: entity.x, y: entity.y })) }));
}
