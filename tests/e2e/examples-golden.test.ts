import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function runExample(path: string) {
  const result = spawnSync(process.execPath, [path], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

describe("public package-root examples", () => {
  it("composes a two-object scene and prints its digest", () => {
    expect(runExample("examples/compose-scene/run.mjs")).toBe(
      "sha256:db836fe798fafca4983c40d320afaaadfcbc003d6bd941a6a4a12ab20578a2c9",
    );
  });

  it("opens the scene through the orchestrator and prints its digest", () => {
    expect(runExample("examples/open-scene/run.mjs")).toBe(
      "sha256:28d27adebd371f7ce330fc1442fb3b2cc42b59aafe644d01723759f9b02ae129",
    );
  });
});
