import * as nodeModule from "node:module";
import process from "node:process";
import { resolve } from "node:path";
import { resolve as resolveWorkspace, RESOLVER_URL } from "../../scripts/workspace-dist-resolver.mjs";

if (typeof nodeModule.registerHooks === "function") nodeModule.registerHooks({ resolve: resolveWorkspace });
else nodeModule.register(RESOLVER_URL);

const { readFile } = await import("node:fs/promises");
const { composeScene, reconstructSculpt } = await import("@sceneaxi/authoring-core");
const { bootstrapOpenPath } = await import("@sceneaxi/engine-orchestrator");
const root = process.cwd();
const json = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const intakes = await Promise.all([
  json("tests/e2e/fixtures/sculpt-quality/hard-surface-service-crate.intake.json"),
  json("tests/e2e/fixtures/sculpt-quality/richer-field-drone.intake.json"),
]);
const artifacts = intakes.map((intake, index) => {
  const result = reconstructSculpt(intake, { seed: index === 0 ? 8001 : 8002 });
  if (!result.ok) throw new Error(result.message);
  return result.artifact;
});
const fixture = await json("tests/e2e/fixtures/scene-composition/workshop-bay.scene.json");
const intake = {
  ...fixture,
  placements: [fixture.placements[0], {
    ...fixture.placements[2],
    parentInstanceId: fixture.rootInstanceId,
  }],
};
const composed = composeScene(intake, artifacts, {
  documentId: "workshop-bay-scene",
  title: "Workshop bay multi-object demo",
});
if (!composed.ok) throw new Error(`${composed.code}: ${composed.message}`);
const opened = bootstrapOpenPath({ kind: "scene", scene: composed.scene, options: { seed: 9101 } }, {
  nowMs: () => 1_700_000_000_000,
});
if (!opened.ok) throw new Error(`${opened.reason}: ${opened.detail}`);
const session = opened.value.session();
if (!session.ok) throw new Error(`${session.reason}: ${session.detail}`);
process.stdout.write(`${session.value.observe().digest}\n`);
opened.value.close();
