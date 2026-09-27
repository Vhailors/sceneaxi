import * as nodeModule from "node:module";
import process from "node:process";
import { resolve } from "node:path";
import { resolve as resolveWorkspace, RESOLVER_URL } from "../../scripts/workspace-dist-resolver.mjs";

if (typeof nodeModule.registerHooks === "function") nodeModule.registerHooks({ resolve: resolveWorkspace });
else nodeModule.register(RESOLVER_URL);

const { readFile } = await import("node:fs/promises");
const { composeScene, reconstructSculpt } = await import("@sceneaxi/authoring-core");
const root = process.cwd();
const json = async (path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const sources = [
  ["tests/e2e/fixtures/sculpt-quality/hard-surface-service-crate.intake.json", 8001],
  ["tests/e2e/fixtures/sculpt-quality/richer-field-drone.intake.json", 8002],
];
const intakes = await Promise.all(sources.map(([path]) => json(path)));
const artifacts = sources.map(([, seed], index) => {
  const result = reconstructSculpt(intakes[index], { seed });
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
const result = composeScene(intake, artifacts, {
  documentId: "workshop-bay-scene",
  title: "Workshop bay multi-object demo",
});
if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
process.stdout.write(`${result.sceneDigest}\n`);
