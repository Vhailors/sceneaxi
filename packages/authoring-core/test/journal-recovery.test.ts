import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  apply,
  createDocument,
  propose,
  proposeMany,
  recoverIncompleteApplies,
  undoLastApply,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";

function fixtureDir(): string {
  return mkdtempSync(join(tmpdir(), "sceneaxi-e1-journal-"));
}

describe("E1 apply journal", () => {
  it("undo restores the prior document bytes from a completed apply journal", () => {
    const cwd = fixtureDir();
    const documentPath = "scene.json";
    const absolutePath = join(cwd, documentPath);
    const document = createDocument({ id: "scene", data: { x: 1 } });
    expect(writeDocumentFile(absolutePath, document).ok).toBe(true);
    const before = readFileSync(absolutePath, "utf8");

    const proposed = propose({
      cwd,
      documentPath,
      jsonPointer: "/data/x",
      newValue: 2,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;

    const applied = apply({ cwd, proposal: proposed.proposal });
    expect(applied.ok).toBe(true);
    expect(readFileSync(absolutePath, "utf8")).not.toBe(before);

    const undone = undoLastApply({ cwd });
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.documentPaths).toEqual([documentPath]);
    expect(readFileSync(absolutePath, "utf8")).toBe(before);
  });

  it("recovery completes a crash-interrupted multi-document apply", () => {
    const cwd = fixtureDir();
    const aPath = join(cwd, "a.json");
    const bPath = join(cwd, "b.json");
    expect(
      writeDocumentFile(aPath, createDocument({ id: "a", data: { n: 1 } })).ok,
    ).toBe(true);
    expect(
      writeDocumentFile(bPath, createDocument({ id: "b", data: { n: 2 } })).ok,
    ).toBe(true);
    const beforeB = readFileSync(bPath, "utf8");

    const proposed = proposeMany([
      { cwd, documentPath: "a.json", jsonPointer: "/data/n", newValue: 10 },
      { cwd, documentPath: "b.json", jsonPointer: "/data/n", newValue: 20 },
    ]);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(apply({ cwd, proposal: proposed.proposal }).ok).toBe(true);
    const afterA = readFileSync(aPath, "utf8");
    const afterB = readFileSync(bPath, "utf8");

    const journalDir = join(cwd, ".sceneaxi", "journal");
    const journalName = readdirSync(journalDir).find((name) =>
      name.endsWith(".json"),
    );
    expect(journalName).toBeDefined();
    if (journalName === undefined) return;
    const journalPath = join(journalDir, journalName);
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      state: string;
    };

    // Simulate a process crash after a.json committed but before b.json did and
    // before the prepared journal could be marked completed.
    writeFileSync(bPath, beforeB, "utf8");
    writeFileSync(
      journalPath,
      `${JSON.stringify({ ...journal, state: "prepared" }, null, 2)}\n`,
      "utf8",
    );

    const recovered = recoverIncompleteApplies({ cwd });
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) return;
    expect(recovered.documentPaths).toEqual(["a.json", "b.json"]);
    expect(readFileSync(aPath, "utf8")).toBe(afterA);
    expect(readFileSync(bPath, "utf8")).toBe(afterB);
    expect(
      (JSON.parse(readFileSync(journalPath, "utf8")) as { state: string }).state,
    ).toBe("completed");
  });

  it("recovery fails closed on tampered journal metadata", () => {
    const cwd = fixtureDir();
    const documentPath = "scene.json";
    const absolutePath = join(cwd, documentPath);
    expect(
      writeDocumentFile(
        absolutePath,
        createDocument({ id: "scene", data: { x: 1 } }),
      ).ok,
    ).toBe(true);
    const before = readFileSync(absolutePath, "utf8");
    const proposed = propose({
      cwd,
      documentPath,
      jsonPointer: "/data/x",
      newValue: 2,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(apply({ cwd, proposal: proposed.proposal }).ok).toBe(true);

    const journalDir = join(cwd, ".sceneaxi", "journal");
    const journalName = readdirSync(journalDir).find((name) =>
      name.endsWith(".json"),
    );
    expect(journalName).toBeDefined();
    if (journalName === undefined) return;
    const journalPath = join(journalDir, journalName);
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      state: string;
      transactionId: string;
    };
    writeFileSync(absolutePath, before, "utf8");
    writeFileSync(
      journalPath,
      `${JSON.stringify(
        { ...journal, state: "prepared", transactionId: "../escape" },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const recovered = recoverIncompleteApplies({ cwd });
    expect(recovered.ok).toBe(false);
    if (recovered.ok) return;
    expect(recovered.diagnostics[0]?.code).toBe("journal-invalid");
    expect(readFileSync(absolutePath, "utf8")).toBe(before);
  });

  it("recovery ignores non-canonical journal temp artifacts from an interrupted status write", () => {
    const cwd = fixtureDir();
    const journalDir = join(cwd, ".sceneaxi", "journal");
    mkdirSync(journalDir, { recursive: true });
    writeFileSync(
      join(journalDir, ".sceneaxi-tmp-deadbeef-orphan.json"),
      "incomplete",
      { encoding: "utf8", flag: "w" },
    );

    const recovered = recoverIncompleteApplies({ cwd });
    expect(recovered).toEqual({
      ok: true,
      transactionIds: [],
      documentPaths: [],
    });
  });

  it("the propose service recovers prepared transactions before reading documents", () => {
    const cwd = fixtureDir();
    const documentPath = "scene.json";
    const absolutePath = join(cwd, documentPath);
    expect(
      writeDocumentFile(
        absolutePath,
        createDocument({ id: "scene", data: { x: 1 } }),
      ).ok,
    ).toBe(true);
    const before = readFileSync(absolutePath, "utf8");
    const first = propose({
      cwd,
      documentPath,
      jsonPointer: "/data/x",
      newValue: 2,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(apply({ cwd, proposal: first.proposal }).ok).toBe(true);
    const recoveredBase = readFileSync(absolutePath, "utf8");

    const journalDir = join(cwd, ".sceneaxi", "journal");
    const journalName = readdirSync(journalDir).find((name) =>
      /^\d{13}-[0-9a-f]{16}\.json$/.test(name),
    );
    expect(journalName).toBeDefined();
    if (journalName === undefined) return;
    const journalPath = join(journalDir, journalName);
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      state: string;
    };
    writeFileSync(absolutePath, before, "utf8");
    writeFileSync(
      journalPath,
      `${JSON.stringify({ ...journal, state: "prepared" }, null, 2)}\n`,
      "utf8",
    );

    const next = propose({
      cwd,
      documentPath,
      jsonPointer: "/data/x",
      newValue: 3,
    });
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(readFileSync(absolutePath, "utf8")).toBe(recoveredBase);
    expect(next.unifiedDiff).toMatch(/^-.*"x": 2/m);
    expect(next.unifiedDiff).toMatch(/^\+.*"x": 3/m);
  });
});
