/**
 * web-shell inspector: propose → rendered diff → accept/reject (sceneaxi#11).
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
  createInspectorSession,
  renderDiffForInspector,
  shellPropose,
  shellProposeAndApply,
} from "@sceneaxi/web-shell";

function fixtureDir(): string {
  return mkdtempSync(join(tmpdir(), "sceneaxi-web-shell-"));
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

describe("web-shell protocol client", () => {
  it("propose returns a unified diff and a rendered inspector surface", () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", {
      entities: [{ id: "hero", x: 0, y: 0 }],
    });

    const proposed = shellPropose({
      documentPath: "scene.json",
      jsonPointer: "/data/entities/0/x",
      newValue: 10,
      cwd: dir,
    });

    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.unifiedDiff).toMatch(/^--- a\/scene\.json/m);
    expect(proposed.unifiedDiff).toMatch(/^\+.*"x": 10/m);
    expect(proposed.renderedDiff).toContain(proposed.unifiedDiff.trimEnd());
    expect(proposed.renderedDiff).toContain("SceneAxi inspector");
    expect(proposed.renderedDiff).toBe(
      renderDiffForInspector(proposed.unifiedDiff),
    );

    // Document unchanged until accept/apply.
    const text = readFileSync(join(dir, "scene.json"), "utf8");
    expect(JSON.parse(text).data.entities[0].x).toBe(0);
  });

  it("inspector proposeEdit → review renderedDiff → accept applies", () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", {
      entities: [{ id: "hero", x: 1, y: 2 }],
    });

    const session = createInspectorSession({ cwd: dir });
    const reviewing = session.proposeEdit({
      documentPath: "scene.json",
      jsonPointer: "/data/entities/0/x",
      newValue: 99,
    });

    expect(reviewing.phase).toBe("reviewing");
    expect(reviewing.renderedDiff).toBeTruthy();
    expect(reviewing.renderedDiff).toMatch(/"x": 99/);
    expect(reviewing.proposal).not.toBeNull();

    // Still unapplied while reviewing.
    expect(
      JSON.parse(readFileSync(join(dir, "scene.json"), "utf8")).data.entities[0]
        .x,
    ).toBe(1);

    const applied = session.accept();
    expect(applied.phase).toBe("applied");
    expect(applied.appliedPaths).toEqual(["scene.json"]);
    expect(applied.renderedDiff).toBeTruthy();

    const after = JSON.parse(readFileSync(join(dir, "scene.json"), "utf8")) as {
      data: { entities: Array<{ x: number }> };
    };
    expect(after.data.entities[0]?.x).toBe(99);
  });

  it("inspector reject discards without writing", () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { n: 1 });

    const session = createInspectorSession({ cwd: dir });
    session.proposeEdit({
      documentPath: "scene.json",
      jsonPointer: "/data/n",
      newValue: 2,
    });
    const rejected = session.reject();
    expect(rejected.phase).toBe("rejected");
    expect(rejected.proposal).toBeNull();
    expect(rejected.renderedDiff).toBeNull();

    const text = readFileSync(join(dir, "scene.json"), "utf8");
    expect(JSON.parse(text).data.n).toBe(1);
  });

  it("accepts in the working directory used for the pending proposal", () => {
    const sessionDir = fixtureDir();
    const proposalDir = fixtureDir();
    writeScene(sessionDir, "scene.json", { n: 1 });
    writeScene(proposalDir, "scene.json", { n: 10 });
    const session = createInspectorSession({ cwd: sessionDir });

    const reviewing = session.proposeEdit({
      cwd: proposalDir,
      documentPath: "scene.json",
      jsonPointer: "/data/n",
      newValue: 20,
    });
    expect(reviewing.phase).toBe("reviewing");
    const applied = session.accept();

    expect(applied.phase).toBe("applied");
    expect(JSON.parse(readFileSync(join(sessionDir, "scene.json"), "utf8")).data.n).toBe(
      1,
    );
    expect(JSON.parse(readFileSync(join(proposalDir, "scene.json"), "utf8")).data.n).toBe(
      20,
    );
  });

  it("shellProposeAndApply completes a full round-trip", () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", {
      entities: [{ id: "hero", x: 0, y: 0 }],
    });

    const result = shellProposeAndApply({
      documentPath: "scene.json",
      jsonPointer: "/data/entities/0/y",
      newValue: 7,
      cwd: dir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appliedPaths).toEqual(["scene.json"]);
    expect(result.renderedDiff).toContain("SceneAxi inspector");

    const after = JSON.parse(readFileSync(join(dir, "scene.json"), "utf8")) as {
      data: { entities: Array<{ y: number }> };
    };
    expect(after.data.entities[0]?.y).toBe(7);
  });
});
