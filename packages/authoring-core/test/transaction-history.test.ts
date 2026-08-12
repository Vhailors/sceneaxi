import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  apply,
  applyRedoAvailability,
  applyUndoAvailability,
  createDocument,
  propose,
  recoverIncompleteApplies,
  redoLastApply,
  undoLastApply,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";

function project() {
  const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-transactions-"));
  const path = join(cwd, "scene.json");
  expect(writeDocumentFile(path, createDocument({ id: "scene", data: { value: 0 } }), { cwd }).ok).toBe(true);
  return { cwd, path };
}

function commit(cwd: string, value: number) {
  const staged = propose({ cwd, documentPath: "scene.json", jsonPointer: "/data/value", newValue: value });
  expect(staged.ok).toBe(true);
  if (!staged.ok) throw new Error("proposal refused");
  const committed = apply({ cwd, proposal: staged.proposal });
  expect(committed.ok).toBe(true);
  if (!committed.ok) throw new Error("apply refused");
  return committed.transactionId;
}

describe("full-editor durable command history", () => {
  it("refuses a stale base before creating journal bytes or changing the project", () => {
    const { cwd, path } = project();
    const stale = propose({ cwd, documentPath: "scene.json", jsonPointer: "/data/value", newValue: 1 });
    expect(stale.ok).toBe(true);
    if (!stale.ok) return;
    commit(cwd, 2);
    const before = readFileSync(path, "utf8");
    const journalNames = readdirSync(join(cwd, ".sceneaxi", "journal")).sort();

    const refused = apply({ cwd, proposal: stale.proposal });

    expect(refused).toMatchObject({ ok: false, diagnostics: [{ code: "content-hash-conflict" }] });
    expect(readFileSync(path, "utf8")).toBe(before);
    expect(readdirSync(join(cwd, ".sceneaxi", "journal")).sort()).toEqual(journalNames);
  });

  it("restores exact canonical bytes in order through multi-level undo and redo after restart", () => {
    const { cwd, path } = project();
    const versions = [readFileSync(path, "utf8")];
    const transactionIds = [commit(cwd, 1), commit(cwd, 2), commit(cwd, 3)];
    versions.push(
      ...[1, 2, 3].map((value) => `${JSON.stringify(createDocument({ id: "scene", data: { value } }), null, 2)}\n`),
    );

    for (let index = 2; index >= 0; index -= 1) {
      const undone = undoLastApply({ cwd });
      expect(undone).toMatchObject({ ok: true, transactionId: transactionIds[index] });
      expect(readFileSync(path, "utf8")).toBe(versions[index]);
    }
    expect(applyUndoAvailability({ cwd })).toBe("unavailable");

    // Every operation re-opens journal state from disk; no renderer/session state participates.
    for (let index = 0; index < 3; index += 1) {
      const redone = redoLastApply({ cwd });
      expect(redone).toMatchObject({ ok: true, transactionId: transactionIds[index] });
      expect(readFileSync(path, "utf8")).toBe(versions[index + 1]);
    }
    expect(applyRedoAvailability({ cwd })).toBe("unavailable");
  });

  it("preserves redo while review is only staged, then clears only the superseded branch on commit", () => {
    const { cwd } = project();
    commit(cwd, 1);
    commit(cwd, 2);
    expect(undoLastApply({ cwd }).ok).toBe(true);
    expect(applyRedoAvailability({ cwd })).toBe("available");

    const staged = propose({ cwd, documentPath: "scene.json", jsonPointer: "/data/value", newValue: 9 });
    expect(staged.ok).toBe(true);
    expect(applyRedoAvailability({ cwd })).toBe("available");
    if (!staged.ok) return;
    expect(apply({ cwd, proposal: staged.proposal }).ok).toBe(true);
    expect(applyRedoAvailability({ cwd })).toBe("unavailable");
    expect(applyUndoAvailability({ cwd })).toBe("available");
  });

  it("rolls every active durable phase to its deterministic image, including redo", () => {
    const { cwd, path } = project();
    commit(cwd, 1);
    const after = readFileSync(path, "utf8");
    expect(undoLastApply({ cwd }).ok).toBe(true);
    const before = readFileSync(path, "utf8");
    const journalDir = join(cwd, ".sceneaxi", "journal");
    const name = readdirSync(journalDir).find((candidate) => /^\d{13}-[0-9a-f]{16}\.json$/.test(candidate));
    expect(name).toBeDefined();
    if (name === undefined) return;
    const journal = JSON.parse(readFileSync(join(journalDir, name), "utf8")) as Record<string, unknown>;

    writeFileSync(join(journalDir, ".active"), `${JSON.stringify({ ...journal, state: "redoing" }, null, 2)}\n`);
    writeFileSync(path, before);
    expect(recoverIncompleteApplies({ cwd })).toMatchObject({ ok: true, documentPaths: ["scene.json"] });
    expect(readFileSync(path, "utf8")).toBe(after);
  });
});
