import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

const replay = `
import { register } from 'node:module';
import { createHash } from 'node:crypto';
register('./scripts/workspace-dist-resolver.mjs', import.meta.url);
const { createRapierPhysicsWorldHost } = await import('@sceneaxi/physics-rapier');
const { emptyScenePhysicsCatalog, evaluateScenePhysics } = await import('@sceneaxi/schemas');
const catalog = {
  ...emptyScenePhysicsCatalog(),
  world: { gravityY: -9.81, stepMs: 16, seed: 7, engine: 'rapier' },
  bodies: [
    { bodyId: 'floor', instanceId: 'floor', kind: 'static', mass: 1 },
    { bodyId: 'ball', instanceId: 'ball', kind: 'dynamic', mass: 2 },
    { bodyId: 'capsule', instanceId: 'capsule', kind: 'kinematic', mass: 3 },
    { bodyId: 'fixed', instanceId: 'fixed', kind: 'dynamic', mass: 4 },
    { bodyId: 'hinged', instanceId: 'hinged', kind: 'dynamic', mass: 5 },
  ],
  shapes: [
    { shapeId: 'floor', bodyId: 'floor', kind: 'box', size: 1 },
    { shapeId: 'ball', bodyId: 'ball', kind: 'sphere', size: 0.25 },
    { shapeId: 'capsule', bodyId: 'capsule', kind: 'capsule', size: 0.25 },
  ],
  materials: [
    { bodyId: 'floor', friction: 0.8, restitution: 0.6 },
    { bodyId: 'ball', friction: 0.2, restitution: 0.6 },
  ],
  constraints: [
    { constraintId: 'fixed', kind: 'fixed', bodyA: 'floor', bodyB: 'fixed' },
    { constraintId: 'hinged', kind: 'hinge', bodyA: 'floor', bodyB: 'hinged' },
  ],
};
const inputBytes = JSON.stringify(catalog);
const host = await createRapierPhysicsWorldHost();
const world = host.create(catalog);
try {
  for (let step = 0; step < 64; step += 1) world.step(0.016);
  const serialized = world.serialize();
  const evaluated = evaluateScenePhysics({ catalog, sourceContentHash: 'sha256:' + 'cd'.repeat(32), steps: 64, host });
  if (!evaluated.ok) throw new Error(evaluated.reason);
  if (inputBytes !== JSON.stringify(catalog)) throw new Error('catalog mutated');
  process.stdout.write(JSON.stringify({
    stateDigest: 'sha256:' + createHash('sha256').update(serialized).digest('hex'),
    evaluationDigest: evaluated.evaluation.digest,
    bodies: world.snapshot(),
    serialized,
  }));
} finally { world.dispose(); }
`;

describe("Rapier WASM deterministic replay golden", () => {
  it("replays byte-identical state and digest in three fresh processes", () => {
    const outputs = Array.from({ length: 3 }, () => {
      const result = spawnSync(process.execPath, ["--input-type=module", "-e", replay], {
        cwd: root,
        encoding: "utf8",
        timeout: 30_000,
      });

      expect(result.status, result.stderr).toBe(0);

      return result.stdout;
    });

    expect(outputs[1]).toBe(outputs[0]);
    expect(outputs[2]).toBe(outputs[0]);
    const expected = readFileSync(new URL("./fixtures/physics-rapier-golden.json", import.meta.url), "utf8").trim();
    expect(outputs[0]).toBe(expected);
  });
});
