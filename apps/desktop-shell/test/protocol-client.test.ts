/**
 * desktop-shell: thin wrapper over the same authoring-core protocol (sceneaxi#11).
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDocument,
  type JsonObject,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";
import {
  shellPropose,
  shellProposeAndApply,
} from "@sceneaxi/desktop-shell";

function fixtureDir(): string {
  return mkdtempSync(join(tmpdir(), "sceneaxi-desktop-shell-"));
}

function writeScene(
  dir: string,
  name: string,
  data: JsonObject,
): void {
  const path = join(dir, name);
  const doc = createDocument({ id: name.replace(/\.json$/, ""), data });
  const result = writeDocumentFile(path, doc);
  expect(result.ok).toBe(true);
}

describe("desktop-shell protocol client", () => {
  it("propose → apply round-trip mutates via authoring-core only", () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", {
      entities: [{ id: "hero", x: 0, y: 0 }],
    });

    const result = shellProposeAndApply({
      documentPath: "scene.json",
      jsonPointer: "/data/entities/0/x",
      newValue: 42,
      cwd: dir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.unifiedDiff).toMatch(/^--- a\/scene\.json/m);
    expect(result.renderedDiff).toContain(result.unifiedDiff.trimEnd());
    expect(result.appliedPaths).toEqual(["scene.json"]);

    const after = JSON.parse(readFileSync(join(dir, "scene.json"), "utf8")) as {
      data: { entities: Array<{ x: number }> };
    };
    expect(after.data.entities[0]?.x).toBe(42);
  });

  it("propose alone does not write the document", () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { n: 5 });

    const proposed = shellPropose({
      documentPath: "scene.json",
      jsonPointer: "/data/n",
      newValue: 9,
      cwd: dir,
    });
    expect(proposed.ok).toBe(true);

    const text = readFileSync(join(dir, "scene.json"), "utf8");
    expect(JSON.parse(text).data.n).toBe(5);
  });
});
