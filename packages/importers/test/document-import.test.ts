import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDocument,
  parseDocumentText,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";
import {
  applySceneDocumentImport,
  proposeSceneDocumentImport,
} from "@sceneaxi/importers";

function fixture(name: string) {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

function targetDir() {
  const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-importer-"));
  const written = writeDocumentFile(
    "project.sceneaxi.json",
    createDocument({
      id: "local-project",
      title: "Local identity",
      data: { entities: [], source: "local" },
    }),
    { cwd },
  );
  expect(written.ok).toBe(true);
  return cwd;
}

describe("text-canonical SceneAxi document importer", () => {
  it("validates and proposes external content without writing before apply", () => {
    const cwd = targetDir();
    const before = readFileSync(join(cwd, "project.sceneaxi.json"), "utf8");
    const result = proposeSceneDocumentImport({
      sourceText: fixture("source.sceneaxi.json"),
      targetDocumentPath: "project.sceneaxi.json",
      cwd,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.unifiedDiff).toMatch(/recorded-fixture/);
    expect(result.proposal.edits).toHaveLength(1);
    expect(result.proposal.edits[0]?.jsonPointer).toBe("/data");
    expect(readFileSync(join(cwd, "project.sceneaxi.json"), "utf8")).toBe(before);
  });

  it("applies imported content through authoring-core and preserves local document identity", () => {
    const cwd = targetDir();
    const result = applySceneDocumentImport({
      sourceText: fixture("source.sceneaxi.json"),
      targetDocumentPath: "project.sceneaxi.json",
      cwd,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.apply.appliedPaths).toEqual(["project.sceneaxi.json"]);
    const parsed = parseDocumentText(
      readFileSync(join(cwd, "project.sceneaxi.json"), "utf8"),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.document.id).toBe("local-project");
    expect(parsed.document.title).toBe("Local identity");
    expect(parsed.document.data).toEqual(result.sourceDocument.data);
  });

  it("fails closed on unsupported schemas and ambiguous multi-document input", () => {
    const cwd = targetDir();
    expect(
      proposeSceneDocumentImport({
        sourceText: fixture("unsupported-schema.sceneaxi.json"),
        targetDocumentPath: "project.sceneaxi.json",
        cwd,
      }),
    ).toMatchObject({
      ok: false,
      stage: "validate",
      diagnostics: [{ code: "schema-major-mismatch" }],
    });
    expect(
      proposeSceneDocumentImport({
        sourceText: `[${fixture("source.sceneaxi.json")}, ${fixture("source.sceneaxi.json")}]`,
        targetDocumentPath: "project.sceneaxi.json",
        cwd,
      }),
    ).toMatchObject({
      ok: false,
      stage: "validate",
      diagnostics: [{ code: "invalid-document" }],
    });
  });

  it("fails closed on duplicate JSON members at every nesting level", () => {
    const cwd = targetDir();
    const source = fixture("source.sceneaxi.json");
    const topLevelDuplicate = source.replace(
      "\"schemaVersion\": 1,",
      "\"schemaVersion\": 1, \"schemaVersion\": 1,",
    );
    const escapedNestedDuplicate = source.replace(
      "\"source\": \"recorded-fixture\"",
      "\"source\": \"recorded-fixture\", \"sour\\u0063e\": \"substitute\"",
    );

    for (const sourceText of [topLevelDuplicate, escapedNestedDuplicate]) {
      expect(
        proposeSceneDocumentImport({
          sourceText,
          targetDocumentPath: "project.sceneaxi.json",
          cwd,
        }),
      ).toMatchObject({
        ok: false,
        stage: "validate",
        diagnostics: [{ code: "parse-error" }],
      });
    }
  });
});
