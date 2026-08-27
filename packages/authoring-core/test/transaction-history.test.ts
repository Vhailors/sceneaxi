import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
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
  editDirect,
  propose,
  proposeMany,
  recoverIncompleteApplies,
  redoLastApply,
  undoLastApply,
  writeDocumentFile,
  writeProposalFile,
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

describe("authoring root containment", () => {
  it("refuses absolute, traversal, and symlinked document paths without creating journal bytes", () => {
    const { cwd } = project();
    const outside = mkdtempSync(join(tmpdir(), "sceneaxi-escape-"));
    writeFileSync(join(outside, "scene.json"), readFileSync(join(cwd, "scene.json"), "utf8"));
    const linkTarget = join(cwd, "link.json");
    symlinkSync(join(outside, "scene.json"), linkTarget);
    const snapshot = existsSync(join(cwd, ".sceneaxi")) ? readdirSync(join(cwd, ".sceneaxi")) : [];
    const escape = {
      code: "validation-failed",
      message: "Document path must be inside its authoritative project root.",
    };

    for (const documentPath of [join(outside, "scene.json"), "../escape/scene.json", "link.json"]) {
      expect(propose({ cwd, documentPath, jsonPointer: "/data/value", newValue: 1 })).toMatchObject({
        ok: false,
        diagnostics: [expect.objectContaining(escape)],
      });
      expect(editDirect({ cwd, documentPath, jsonPointer: "/data/value", newValue: 1 })).toMatchObject({
        ok: false,
        diagnostics: [expect.objectContaining(escape)],
      });
      expect(
        proposeMany([{ cwd, documentPath, jsonPointer: "/data/value", newValue: 1 }]),
      ).toMatchObject({ ok: false, diagnostics: [expect.objectContaining(escape)] });
    }

    expect(existsSync(join(cwd, ".sceneaxi")) ? readdirSync(join(cwd, ".sceneaxi")) : []).toEqual(snapshot);
    expect(readFileSync(linkTarget, "utf8")).toBe(readFileSync(join(outside, "scene.json"), "utf8"));
  });

  it("refuses a proposal file that resolves outside the authoritative project root before reading it", () => {
    const { cwd } = project();
    const staged = propose({ cwd, documentPath: "scene.json", jsonPointer: "/data/value", newValue: 1 });
    if (!staged.ok) throw new Error("proposal refused");
    const outsideDir = mkdtempSync(join(tmpdir(), "sceneaxi-proposal-"));
    const outsideProposal = join(outsideDir, "proposal.json");
    writeProposalFile(outsideProposal, staged.proposal);
    const before = readFileSync(join(cwd, "scene.json"), "utf8");

    const refused = apply({ cwd, proposal: outsideProposal });

    expect(refused).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "validation-failed",
          message: "Document path must be inside its authoritative project root.",
          documentPath: outsideProposal,
        }),
      ],
    });
    expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(before);
    expect(existsSync(join(cwd, ".sceneaxi", "journal"))).toBe(false);
  });
  it("apply refuses proposal edits whose document paths escape the authoritative project root", () => {
    const { cwd } = project();
    const staged = propose({ cwd, documentPath: "scene.json", jsonPointer: "/data/value", newValue: 1 });
    if (!staged.ok) throw new Error("proposal refused");
    const outsideDir = mkdtempSync(join(tmpdir(), "sceneaxi-edit-"));
    const outsideScene = join(outsideDir, "scene.json");
    writeFileSync(outsideScene, readFileSync(join(cwd, "scene.json"), "utf8"));
    symlinkSync(outsideScene, join(cwd, "edit-link.json"));
    const before = readFileSync(join(cwd, "scene.json"), "utf8");

    for (const documentPath of [outsideScene, "../sceneaxi-edit-missing/scene.json", "edit-link.json"]) {
      const forged = {
        ...staged.proposal,
        edits: staged.proposal.edits.map((edit) => ({ ...edit, documentPath })),
      } as typeof staged.proposal;
      expect(apply({ cwd, proposal: forged })).toMatchObject({
        ok: false,
        diagnostics: [
          expect.objectContaining({
            code: "validation-failed",
            message: "Document path must be inside its authoritative project root.",
            documentPath,
          }),
        ],
      });
    }

    expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(before);
    expect(existsSync(join(cwd, ".sceneaxi"))).toBe(false);
  });

  it("apply refuses proposal diffs whose document paths escape the authoritative project root after contained edits pass grouping", () => {
    const { cwd } = project();
    const staged = propose({ cwd, documentPath: "scene.json", jsonPointer: "/data/value", newValue: 1 });
    if (!staged.ok) throw new Error("proposal refused");
    const escapedDiffPath = "../sceneaxi-diff-escape/scene.json";
    const forged = {
      ...staged.proposal,
      diffs: staged.proposal.diffs.map((diff) => ({ ...diff, documentPath: escapedDiffPath })),
    } as typeof staged.proposal;
    const before = readFileSync(join(cwd, "scene.json"), "utf8");

    const refused = apply({ cwd, proposal: forged });

    expect(refused).toMatchObject({
      ok: false,
      diagnostics: [
        expect.objectContaining({
          code: "validation-failed",
          message: "Document path must be inside its authoritative project root.",
          documentPath: escapedDiffPath,
        }),
      ],
    });
    expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(before);
    expect(existsSync(join(cwd, ".sceneaxi"))).toBe(false);
  });

  it("keeps contained relative edits working across propose and apply", () => {
    const { cwd, path } = project();
    commit(cwd, 7);
    expect(readFileSync(path, "utf8")).toContain('"value": 7');
    const direct = editDirect({ cwd, documentPath: "./scene.json", jsonPointer: "/data/value", newValue: 8 });
    expect(direct).toMatchObject({ ok: true });
    expect(readFileSync(path, "utf8")).toContain('"value": 8');
  });
});
