import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  apply,
  acquireAtomicWriteLocks,
  atomicWriteAll,
  contentHash,
  createDocument,
  createProposal,
  propose,
  proposeMany,
  recoverIncompleteApplies,
  releaseAtomicWriteLocks,
  serializeProposal,
  undoLastApply,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";

function fixtureDir(): string {
  return mkdtempSync(join(tmpdir(), "sceneaxi-e1-journal-"));
}

function preparedJournal(value: Record<string, unknown>): Record<string, unknown> {
  const prepared: Record<string, unknown> = { ...value, state: "prepared" };
  delete prepared["completedAt"];
  return prepared;
}

function stageActiveJournal(
  journalDirectory: string,
  value: Record<string, unknown>,
): void {
  writeFileSync(
    join(journalDirectory, ".active"),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
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
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Record<
      string,
      unknown
    >;

    // Simulate a process crash after a.json committed but before b.json did and
    // before the prepared journal could be marked completed.
    writeFileSync(bPath, beforeB, "utf8");
    stageActiveJournal(journalDir, preparedJournal(journal));

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
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Record<
      string,
      unknown
    >;
    writeFileSync(absolutePath, before, "utf8");
    stageActiveJournal(
      journalDir,
      { ...preparedJournal(journal), transactionId: "../escape" },
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
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Record<
      string,
      unknown
    >;
    writeFileSync(absolutePath, before, "utf8");
    stageActiveJournal(journalDir, preparedJournal(journal));

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

  it("validates object proposals before preparing a journal", () => {
    const cwd = fixtureDir();
    const invalid = createProposal({ edits: [], diffs: [] });

    const result = apply({ cwd, proposal: invalid });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]?.code).toBe("invalid-proposal");
    expect(readdirSync(cwd)).not.toContain(".sceneaxi");
  });

  it("rejects aliases for the same canonical proposal target", () => {
    const cwd = fixtureDir();
    const absolutePath = join(cwd, "scene.json");
    expect(
      writeDocumentFile(
        absolutePath,
        createDocument({ id: "scene", data: { x: 1, y: 1 } }),
      ).ok,
    ).toBe(true);
    const proposed = proposeMany([
      { cwd, documentPath: "scene.json", jsonPointer: "/data/x", newValue: 2 },
      { cwd, documentPath: "scene.json", jsonPointer: "/data/y", newValue: 2 },
    ]);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    const aliased = {
      ...proposed.proposal,
      edits: proposed.proposal.edits.map((edit, index) =>
        index === 1 ? { ...edit, documentPath: "./scene.json" } : edit,
      ),
    };

    const result = apply({ cwd, proposal: aliased });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]?.code).toBe("invalid-proposal");
    expect(JSON.parse(readFileSync(absolutePath, "utf8")).data).toEqual({
      x: 1,
      y: 1,
    });
  });

  it("rejects proposals whose reviewed diff or old values disagree with edits", () => {
    const cwd = fixtureDir();
    const absolutePath = join(cwd, "scene.json");
    expect(
      writeDocumentFile(
        absolutePath,
        createDocument({ id: "scene", data: { x: 1 } }),
      ).ok,
    ).toBe(true);
    const proposed = propose({
      cwd,
      documentPath: "scene.json",
      jsonPointer: "/data/x",
      newValue: 2,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;

    const hiddenEdit = {
      ...proposed.proposal,
      diffs: proposed.proposal.diffs.map((diff) => ({
        ...diff,
        unifiedDiff: "--- a/scene.json\n+++ b/scene.json\n",
      })),
    };
    const hiddenResult = apply({ cwd, proposal: hiddenEdit });
    expect(hiddenResult.ok).toBe(false);
    if (!hiddenResult.ok) {
      expect(hiddenResult.diagnostics[0]?.code).toBe("invalid-proposal");
    }

    const falseOldValue = {
      ...proposed.proposal,
      edits: proposed.proposal.edits.map((edit) => ({
        ...edit,
        oldValue: 999,
      })),
    };
    const oldValueResult = apply({ cwd, proposal: falseOldValue });
    expect(oldValueResult.ok).toBe(false);
    if (!oldValueResult.ok) {
      expect(oldValueResult.diagnostics[0]?.code).toBe("invalid-proposal");
    }
    expect(JSON.parse(readFileSync(absolutePath, "utf8")).data.x).toBe(1);
  });

  it("rejects proposeMany inputs from different working directories", () => {
    const firstCwd = fixtureDir();
    const secondCwd = fixtureDir();
    expect(
      writeDocumentFile(
        join(firstCwd, "scene.json"),
        createDocument({ id: "scene", data: { x: 1 } }),
      ).ok,
    ).toBe(true);
    expect(
      writeDocumentFile(
        join(secondCwd, "scene.json"),
        createDocument({ id: "scene", data: { x: 1 } }),
      ).ok,
    ).toBe(true);

    const result = proposeMany([
      {
        cwd: firstCwd,
        documentPath: "scene.json",
        jsonPointer: "/data/x",
        newValue: 2,
      },
      {
        cwd: secondCwd,
        documentPath: "scene.json",
        jsonPointer: "/data/x",
        newValue: 3,
      },
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]?.code).toBe("invalid-proposal");
  });

  it("recovers a newer prepared apply before undoing by completion order", () => {
    const cwd = fixtureDir();
    const absolutePath = join(cwd, "scene.json");
    expect(
      writeDocumentFile(
        absolutePath,
        createDocument({ id: "scene", data: { x: 1 } }),
      ).ok,
    ).toBe(true);

    const first = propose({
      cwd,
      documentPath: "scene.json",
      jsonPointer: "/data/x",
      newValue: 2,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(apply({ cwd, proposal: first.proposal }).ok).toBe(true);
    const afterFirst = readFileSync(absolutePath, "utf8");

    const second = propose({
      cwd,
      documentPath: "scene.json",
      jsonPointer: "/data/x",
      newValue: 3,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(apply({ cwd, proposal: second.proposal }).ok).toBe(true);

    const journalDir = join(cwd, ".sceneaxi", "journal");
    const journals = readdirSync(journalDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => ({
        name,
        value: JSON.parse(readFileSync(join(journalDir, name), "utf8")) as Record<
          string,
          unknown
        >,
      }));
    expect(
      journals
        .map(({ value }) => value["completionOrder"])
        .sort((a, b) => Number(a) - Number(b)),
    ).toEqual([1, 2]);
    const latest = journals.find(
      ({ value }) => value["completionOrder"] === 2,
    );
    expect(latest).toBeDefined();
    if (latest === undefined) return;
    writeFileSync(absolutePath, afterFirst, "utf8");
    stageActiveJournal(journalDir, preparedJournal(latest.value));

    const undone = undoLastApply({ cwd });

    expect(undone.ok).toBe(true);
    expect(readFileSync(absolutePath, "utf8")).toBe(afterFirst);
    const recoveredJournal = JSON.parse(
      readFileSync(join(journalDir, latest.name), "utf8"),
    ) as { state: string; completionOrder: number };
    expect(recoveredJournal.state).toBe("undone");
    expect(recoveredJournal.completionOrder).toBe(2);
  });

  it("recovers a crash-interrupted multi-document undo", () => {
    const cwd = fixtureDir();
    const aPath = join(cwd, "a.json");
    const bPath = join(cwd, "b.json");
    expect(
      writeDocumentFile(aPath, createDocument({ id: "a", data: { n: 1 } })).ok,
    ).toBe(true);
    expect(
      writeDocumentFile(bPath, createDocument({ id: "b", data: { n: 2 } })).ok,
    ).toBe(true);
    const beforeA = readFileSync(aPath, "utf8");
    const beforeB = readFileSync(bPath, "utf8");
    const proposed = proposeMany([
      { cwd, documentPath: "a.json", jsonPointer: "/data/n", newValue: 10 },
      { cwd, documentPath: "b.json", jsonPointer: "/data/n", newValue: 20 },
    ]);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(apply({ cwd, proposal: proposed.proposal }).ok).toBe(true);

    const journalDir = join(cwd, ".sceneaxi", "journal");
    const journalName = readdirSync(journalDir).find((name) =>
      /^\d{13}-[0-9a-f]{16}\.json$/.test(name),
    );
    expect(journalName).toBeDefined();
    if (journalName === undefined) return;
    const journalPath = join(journalDir, journalName);
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Record<
      string,
      unknown
    >;
    writeFileSync(aPath, beforeA, "utf8");
    stageActiveJournal(journalDir, { ...journal, state: "undoing" });

    const recovered = recoverIncompleteApplies({ cwd });

    expect(recovered.ok).toBe(true);
    expect(readFileSync(aPath, "utf8")).toBe(beforeA);
    expect(readFileSync(bPath, "utf8")).toBe(beforeB);
    expect(
      (JSON.parse(readFileSync(journalPath, "utf8")) as { state: string }).state,
    ).toBe("undone");
  });

  it("does not prepare a journal before acquiring every target lock", () => {
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
    const lockSet = acquireAtomicWriteLocks([absolutePath]);

    const failed = apply({ cwd, proposal: proposed.proposal });
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.diagnostics[0]?.code).toBe("apply-in-progress");
    releaseAtomicWriteLocks(lockSet);

    const next = propose({
      cwd,
      documentPath,
      jsonPointer: "/data/x",
      newValue: 3,
    });
    expect(next.ok).toBe(true);
    expect(readFileSync(absolutePath, "utf8")).toBe(before);
    const journalDir = join(cwd, ".sceneaxi", "journal");
    expect(
      readdirSync(journalDir).filter((name) => name.endsWith(".json")),
    ).toEqual([]);
  });

  it("checks expected hashes while holding the atomic target lock", () => {
    const cwd = fixtureDir();
    const path = join(cwd, "scene.json");
    writeFileSync(path, "before\n", "utf8");

    expect(() =>
      atomicWriteAll([
        {
          path,
          contents: "after\n",
          expectedContentHash: contentHash("different\n"),
        },
      ]),
    ).toThrow(/precondition/i);
    expect(readFileSync(path, "utf8")).toBe("before\n");
    expect(contentHash(readFileSync(path, "utf8"))).toBe(contentHash("before\n"));
  });

  it("keeps atomic artifacts distinct for sanitized-name collisions", () => {
    const cwd = fixtureDir();
    const colonPath = join(cwd, "a:b.json");
    const questionPath = join(cwd, "a?b.json");

    atomicWriteAll([
      { path: colonPath, contents: "colon\n" },
      { path: questionPath, contents: "question\n" },
    ]);

    expect(readFileSync(colonPath, "utf8")).toBe("colon\n");
    expect(readFileSync(questionPath, "utf8")).toBe("question\n");
  });

  it("uses one lock identity through symlinked directory aliases", () => {
    const cwd = fixtureDir();
    const realDirectory = join(cwd, "real");
    const aliasDirectory = join(cwd, "alias");
    mkdirSync(realDirectory);
    symlinkSync(realDirectory, aliasDirectory, "dir");
    const realPath = join(realDirectory, "scene.json");
    const aliasPath = join(aliasDirectory, "scene.json");
    writeFileSync(realPath, "before\n", "utf8");
    const lockSet = acquireAtomicWriteLocks([realPath]);

    expect(() => acquireAtomicWriteLocks([aliasPath])).toThrow(/progress/i);

    releaseAtomicWriteLocks(lockSet);
    atomicWriteAll([{ path: aliasPath, contents: "after\n" }]);
    expect(readFileSync(realPath, "utf8")).toBe("after\n");
  });

  it("rejects released lock capabilities", () => {
    const cwd = fixtureDir();
    const path = join(cwd, "scene.json");
    writeFileSync(path, "before\n", "utf8");
    const lockSet = acquireAtomicWriteLocks([path]);
    releaseAtomicWriteLocks(lockSet);

    expect(() =>
      atomicWriteAll([{ path, contents: "after\n" }], { lockSet }),
    ).toThrow(/progress/i);
    expect(readFileSync(path, "utf8")).toBe("before\n");
  });

  it("reclaims a stale atomic lock after PID reuse", () => {
    const cwd = fixtureDir();
    const path = join(cwd, "scene.json");
    writeFileSync(path, "before\n", "utf8");
    const lockSet = acquireAtomicWriteLocks([path]);
    const lockName = readdirSync(cwd).find((name) =>
      name.startsWith(".sceneaxi-lock-"),
    );
    expect(lockName).toBeDefined();
    releaseAtomicWriteLocks(lockSet);
    if (lockName === undefined) return;
    writeFileSync(
      join(cwd, lockName),
      JSON.stringify({
        pid: process.pid,
        identity: "stale-reused-pid",
        token: "stale",
      }),
      "utf8",
    );

    atomicWriteAll([{ path, contents: "after\n" }]);

    expect(readFileSync(path, "utf8")).toBe("after\n");
  });

  it("never evicts an aged lock owned by a live process", async () => {
    const cwd = fixtureDir();
    const path = join(cwd, "scene.json");
    writeFileSync(path, "before\n", "utf8");
    const lockSet = acquireAtomicWriteLocks([path]);
    const lockName = readdirSync(cwd).find((name) =>
      name.startsWith(".sceneaxi-lock-"),
    );
    expect(lockName).toBeDefined();
    releaseAtomicWriteLocks(lockSet);
    if (lockName === undefined) return;
    const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], {
      stdio: "ignore",
    });
    await once(child, "spawn");
    expect(child.pid).toBeDefined();
    if (child.pid === undefined) {
      child.kill();
      await once(child, "exit");
      return;
    }
    try {
      writeFileSync(
        join(cwd, lockName),
        JSON.stringify({ pid: child.pid, identity: null, token: "live" }),
        "utf8",
      );
      const old = new Date(Date.now() - 60_000);
      utimesSync(join(cwd, lockName), old, old);

      expect(() => atomicWriteAll([{ path, contents: "after\n" }])).toThrow(
        /progress/i,
      );
      expect(readFileSync(path, "utf8")).toBe("before\n");
    } finally {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  });

  it("never reclaims an incomplete lock owner record", () => {
    const cwd = fixtureDir();
    const path = join(cwd, "scene.json");
    writeFileSync(path, "before\n", "utf8");
    const lockSet = acquireAtomicWriteLocks([path]);
    const lockName = readdirSync(cwd).find((name) =>
      name.startsWith(".sceneaxi-lock-"),
    );
    expect(lockName).toBeDefined();
    releaseAtomicWriteLocks(lockSet);
    if (lockName === undefined) return;
    const lockPath = join(cwd, lockName);
    writeFileSync(lockPath, "", "utf8");
    const old = new Date(Date.now() - 60_000);
    utimesSync(lockPath, old, old);

    expect(() => atomicWriteAll([{ path, contents: "after\n" }])).toThrow(
      /progress/i,
    );
    expect(readFileSync(path, "utf8")).toBe("before\n");
  });

  it("rebuilds a damaged completion sequence before canonical commit", () => {
    const cwd = fixtureDir();
    const path = join(cwd, "scene.json");
    expect(
      writeDocumentFile(
        path,
        createDocument({ id: "scene", data: { x: 1 } }),
      ).ok,
    ).toBe(true);
    const first = propose({
      cwd,
      documentPath: "scene.json",
      jsonPointer: "/data/x",
      newValue: 2,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(apply({ cwd, proposal: first.proposal }).ok).toBe(true);
    writeFileSync(
      join(cwd, ".sceneaxi", "journal", ".completion-sequence"),
      "corrupt\n",
      "utf8",
    );
    const second = propose({
      cwd,
      documentPath: "scene.json",
      jsonPointer: "/data/x",
      newValue: 3,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const applied = apply({ cwd, proposal: second.proposal });

    expect(applied.ok).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8")).data.x).toBe(3);
  });

  it("rejects an unwritable completion sequence before canonical commit", () => {
    const cwd = fixtureDir();
    const path = join(cwd, "scene.json");
    expect(
      writeDocumentFile(
        path,
        createDocument({ id: "scene", data: { x: 1 } }),
      ).ok,
    ).toBe(true);
    const before = readFileSync(path, "utf8");
    const proposed = propose({
      cwd,
      documentPath: "scene.json",
      jsonPointer: "/data/x",
      newValue: 2,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    mkdirSync(
      join(cwd, ".sceneaxi", "journal", ".completion-sequence"),
      { recursive: true },
    );

    const applied = apply({ cwd, proposal: proposed.proposal });

    expect(applied.ok).toBe(false);
    if (applied.ok) return;
    expect(applied.diagnostics[0]?.code).toBe("apply-failed");
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  it("rejects completion sequence overflow before canonical commit", () => {
    const cwd = fixtureDir();
    const path = join(cwd, "scene.json");
    expect(
      writeDocumentFile(
        path,
        createDocument({ id: "scene", data: { x: 1 } }),
      ).ok,
    ).toBe(true);
    const before = readFileSync(path, "utf8");
    const proposed = propose({
      cwd,
      documentPath: "scene.json",
      jsonPointer: "/data/x",
      newValue: 2,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    const journalDir = join(cwd, ".sceneaxi", "journal");
    mkdirSync(journalDir, { recursive: true });
    writeFileSync(
      join(journalDir, ".completion-sequence"),
      `${JSON.stringify({
        schemaVersion: 1,
        kind: "sceneaxi.authoring-completion-sequence",
        value: Number.MAX_SAFE_INTEGER,
      })}\n`,
      "utf8",
    );

    const applied = apply({ cwd, proposal: proposed.proposal });

    expect(applied.ok).toBe(false);
    if (applied.ok) return;
    expect(applied.diagnostics[0]?.code).toBe("apply-failed");
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  it("reports journal finalization failures as recoverable state", () => {
    const cwd = fixtureDir();
    const path = join(cwd, "scene.json");
    expect(
      writeDocumentFile(
        path,
        createDocument({ id: "scene", data: { x: 1 } }),
      ).ok,
    ).toBe(true);
    const proposed = propose({
      cwd,
      documentPath: "scene.json",
      jsonPointer: "/data/x",
      newValue: 2,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(apply({ cwd, proposal: proposed.proposal }).ok).toBe(true);

    const journalDir = join(cwd, ".sceneaxi", "journal");
    const journalName = readdirSync(journalDir).find((name) =>
      /^\d{13}-[0-9a-f]{16}\.json$/.test(name),
    );
    expect(journalName).toBeDefined();
    if (journalName === undefined) return;
    const journalPath = join(journalDir, journalName);
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Record<
      string,
      unknown
    >;
    stageActiveJournal(journalDir, preparedJournal(journal));
    unlinkSync(journalPath);
    mkdirSync(journalPath);

    const failed = recoverIncompleteApplies({ cwd });

    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.diagnostics[0]?.code).toBe("apply-failed");
    expect(
      (JSON.parse(readFileSync(join(journalDir, ".active"), "utf8")) as {
        state: string;
      }).state,
    ).toBe("prepared");

    rmdirSync(journalPath);
    expect(recoverIncompleteApplies({ cwd }).ok).toBe(true);
  });

  it("checks only the active journal during recovery", () => {
    const cwd = fixtureDir();
    const journalDir = join(cwd, ".sceneaxi", "journal");
    mkdirSync(journalDir, { recursive: true });
    writeFileSync(
      join(journalDir, "0000000000000-0000000000000000.json"),
      "historical-corruption\n",
      "utf8",
    );

    expect(recoverIncompleteApplies({ cwd })).toEqual({
      ok: true,
      transactionIds: [],
      documentPaths: [],
    });
  });

  it("rejects invalid JSON Pointer escapes before proposing", () => {
    const cwd = fixtureDir();
    expect(
      writeDocumentFile(
        join(cwd, "scene.json"),
        createDocument({ id: "scene", data: { "~2": 1 } }),
      ).ok,
    ).toBe(true);

    const result = propose({
      cwd,
      documentPath: "scene.json",
      jsonPointer: "/data/~2",
      newValue: 2,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics[0]?.code).toBe("invalid-pointer");
  });

  it("accepts serialized proposals whose old value was negative zero", () => {
    const cwd = fixtureDir();
    const path = join(cwd, "scene.json");
    writeFileSync(
      path,
      '{\n  "schemaVersion": 1,\n  "kind": "sceneaxi.document",\n  "id": "scene",\n  "data": {\n    "x": -0\n  }\n}\n',
      "utf8",
    );
    const proposed = propose({
      cwd,
      documentPath: "scene.json",
      jsonPointer: "/data/x",
      newValue: 1,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;

    const applied = apply({ cwd, proposal: serializeProposal(proposed.proposal) });

    expect(applied.ok).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8")).data.x).toBe(1);
  });

  it("rejects journals whose filename and transaction ID disagree", () => {
    const cwd = fixtureDir();
    const path = join(cwd, "scene.json");
    expect(
      writeDocumentFile(
        path,
        createDocument({ id: "scene", data: { x: 1 } }),
      ).ok,
    ).toBe(true);
    const proposed = propose({
      cwd,
      documentPath: "scene.json",
      jsonPointer: "/data/x",
      newValue: 2,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(apply({ cwd, proposal: proposed.proposal }).ok).toBe(true);
    const journalDir = join(cwd, ".sceneaxi", "journal");
    const journalName = readdirSync(journalDir).find((name) =>
      /^\d{13}-[0-9a-f]{16}\.json$/.test(name),
    );
    expect(journalName).toBeDefined();
    if (journalName === undefined) return;
    const journalPath = join(journalDir, journalName);
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Record<
      string,
      unknown
    >;
    writeFileSync(
      journalPath,
      `${JSON.stringify(
        { ...journal, transactionId: "0000000000000-0000000000000000" },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const undone = undoLastApply({ cwd });

    expect(undone.ok).toBe(false);
    if (undone.ok) return;
    expect(undone.diagnostics[0]?.code).toBe("journal-invalid");
  });
});
