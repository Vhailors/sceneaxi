import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  apply,
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

const ownedRoots: string[] = [];

afterEach(() => { for (const root of ownedRoots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function targetDir() {
  const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-importer-"));
  ownedRoots.push(cwd);

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

  it("freezes reviewed import data before apply", () => {
    const cwd = targetDir();

    const result = proposeSceneDocumentImport({
      sourceText: fixture("source.sceneaxi.json"),
      targetDocumentPath: "project.sceneaxi.json",
      cwd,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) return;
    const proposedData = result.proposal.edits[0]?.newValue;
    expect(Object.isFrozen(result.sourceDocument.data)).toBe(true);
    expect(Object.isFrozen(result.sourceDocument.data.entities)).toBe(true);
    expect(
      proposedData !== null &&
        isObjectRepresentation(proposedData) &&
        Object.isFrozen(proposedData),
    ).toBe(true);
    // SAFETY: sourceDocument.data came from the successful Scene Document parser and is a JSON object.
    expect(
      Reflect.set(
        result.sourceDocument.data,
        "source",
        "mutated-after-review",
      ),
    ).toBe(false);

    const applied = apply({ proposal: result.proposal, cwd });
    expect(applied.ok).toBe(true);

    const parsed = parseDocumentText(
      readFileSync(join(cwd, "project.sceneaxi.json"), "utf8"),
    );

    expect(parsed.ok).toBe(true);

    if (!parsed.ok) return;
    expect(parsed.document.data.source).toBe("recorded-fixture");
    expect(result.unifiedDiff).toContain("recorded-fixture");
    expect(result.unifiedDiff).not.toContain("mutated-after-review");
  });
});

describe("AP-04 bounded external Scene Document input", () => {
  it("refuses depth/byte/value excess through propose and apply without writes", () => {
    const cwd = targetDir();
    const before = readFileSync(join(cwd, "project.sceneaxi.json"));

    for (const depth of [63, 7000]) {
      const sourceText = fixture("source.sceneaxi.json").replace('"recorded-fixture"', '{"x":'.repeat(depth) + '0' + '}'.repeat(depth));

      for (const operation of [proposeSceneDocumentImport, applySceneDocumentImport]) {
        expect(operation({ cwd, targetDocumentPath: "project.sceneaxi.json", sourceText })).toMatchObject({ ok: false, stage: "validate", diagnostics: [{ code: "invalid-document" }] });
      }
    }

    for (const sourceText of [fixture("source.sceneaxi.json") + " ".repeat(8 * 1024 * 1024), fixture("source.sceneaxi.json").replace('"recorded-fixture"', '[' + Array.from({ length: 250001 }, () => '0').join(',') + ']')]) {
      expect(applySceneDocumentImport({ cwd, targetDocumentPath: "project.sceneaxi.json", sourceText })).toMatchObject({ ok: false, stage: "validate" });
    }

    expect(readFileSync(join(cwd, "project.sceneaxi.json"))).toEqual(before);
    const supported = fixture("source.sceneaxi.json").replace('"recorded-fixture"', '{"x":'.repeat(62) + '0' + '}'.repeat(62));
    expect(applySceneDocumentImport({ cwd, targetDocumentPath: "project.sceneaxi.json", sourceText: supported }).ok).toBe(true);
  });
});

it("AP-04 admits exact byte/value ceilings and refuses the next unit", () => {
  const cwd = targetDir();
  const fixtureText = fixture("source.sceneaxi.json");
  const maximumText = fixtureText + " ".repeat(8 * 1024 * 1024 - Buffer.byteLength(fixtureText));
  expect(proposeSceneDocumentImport({ cwd, targetDocumentPath: "project.sceneaxi.json", sourceText: maximumText }).ok).toBe(true);
  expect(proposeSceneDocumentImport({ cwd, targetDocumentPath: "project.sceneaxi.json", sourceText: maximumText + " " })).toMatchObject({ ok: false, stage: "validate" });

  // Fixed fixture contains12 JSON values including the replacement array.
  for (const count of [249988, 249989]) {
    const sourceText = fixtureText.replace('"recorded-fixture"', '[' + Array.from({ length: count }, () => '0').join(',') + ']');
    const result = proposeSceneDocumentImport({ cwd, targetDocumentPath: "project.sceneaxi.json", sourceText });
    expect(result.ok).toBe(count === 249988);
  }
});

function isObjectRepresentation(value: unknown): value is object | null {
  return typeof value === "object";
}
