import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PROJECT_MIGRATION_EVIDENCE_PATH,
  PROJECT_MIGRATION_JOURNAL_PATH,
  PROJECT_MIGRATION_PROPOSAL_PATH,
  acquireAtomicWriteLocks,
  apply,
  atomicWriteFile,
  contentHash,
  editDirect,
  propose,
  proposeMany,
  recoverIncompleteApplies,
  redoLastApply,
  undoLastApply,
  writeNativeProjectSeed,
  commitProjectMigration,
  inspectProjectModel,
  proposeProjectMigration,
  recoverProjectMigration,
  releaseAtomicWriteLocks,
  serializeDocument,
} from "@sceneaxi/authoring-core";
import {
  PROJECT_MANIFEST_DIAGNOSTICS,
  PROJECT_MANIFEST_PATH,
  createDocument,
  createProjectManifest,
  serializeProjectManifest,
} from "@sceneaxi/schemas";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporary(label: string) {
  const root = mkdtempSync(join(tmpdir(), `sceneaxi-project-model-${label}-`));
  roots.push(root);

  return root;
}

function legacyProject(label: string) {
  const root = temporary(label);

  const bytes = serializeDocument(createDocument({
    id: "portable-world",
    title: "Portable world",
    data: { entities: [{ id: "hero" }] },
  }));

  writeFileSync(join(root, "scene.json"), bytes, "utf8");

  return { root, bytes };
}

describe("native project migration host", () => {
  it("opens and proposes over legacy bytes without rewriting them", () => {
    const project = legacyProject("preserve");
    const inspected = inspectProjectModel(project.root);
    expect(inspected).toMatchObject({
      ok: true,
      inspection: { state: "legacy", migration: { required: true } },
    });
    expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(project.bytes);
    expect(existsSync(join(project.root, PROJECT_MANIFEST_PATH))).toBe(false);

    const proposed = proposeProjectMigration(project.root);
    expect(proposed).toMatchObject({ ok: true, replayed: false });
    expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(project.bytes);
    expect(existsSync(join(project.root, PROJECT_MANIFEST_PATH))).toBe(false);
    expect(proposeProjectMigration(project.root)).toMatchObject({
      ok: true,
      replayed: true,
      proposal: { proposalDigest: proposed.ok ? proposed.proposal.proposalDigest : "" },
    });
  });

  it("commits and recovers byte-identical manifests and evidence across roots", () => {
    const first = legacyProject("first");
    const second = legacyProject("second");
    const firstProposal = proposeProjectMigration(first.root);
    const secondProposal = proposeProjectMigration(second.root);

    if (!firstProposal.ok || !secondProposal.ok) throw new Error("proposal refused");
    expect(secondProposal.proposal).toEqual(firstProposal.proposal);
    expect(readFileSync(join(first.root, PROJECT_MIGRATION_PROPOSAL_PATH), "utf8")).toBe(
      readFileSync(join(second.root, PROJECT_MIGRATION_PROPOSAL_PATH), "utf8"),
    );

    expect(commitProjectMigration({
      root: first.root,
      approved: false,
      proposalDigest: firstProposal.proposal.proposalDigest,
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.approvalRequired },
    });

    const firstCommit = commitProjectMigration({
      root: first.root,
      approved: true,
      proposalDigest: firstProposal.proposal.proposalDigest,
    });

    const secondCommit = commitProjectMigration({
      root: second.root,
      approved: true,
      proposalDigest: secondProposal.proposal.proposalDigest,
    });

    expect(firstCommit).toMatchObject({ ok: true, inspection: { state: "native" } });
    expect(secondCommit).toMatchObject({ ok: true, inspection: { state: "native" } });
    expect(readFileSync(join(first.root, PROJECT_MANIFEST_PATH), "utf8")).toBe(
      readFileSync(join(second.root, PROJECT_MANIFEST_PATH), "utf8"),
    );
    expect(readFileSync(join(first.root, PROJECT_MIGRATION_EVIDENCE_PATH), "utf8")).toBe(
      readFileSync(join(second.root, PROJECT_MIGRATION_EVIDENCE_PATH), "utf8"),
    );
    expect(readFileSync(join(first.root, "scene.json"), "utf8")).toBe(first.bytes);

    const journalPath = join(first.root, PROJECT_MIGRATION_JOURNAL_PATH);
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Record<string, unknown>;
    writeFileSync(journalPath, `${JSON.stringify({ ...journal, state: "prepared" }, null, 2)}\n`, "utf8");
    rmSync(join(first.root, PROJECT_MANIFEST_PATH));
    rmSync(join(first.root, PROJECT_MIGRATION_EVIDENCE_PATH));
    const recovered = recoverProjectMigration(first.root);
    expect(recovered).toMatchObject({ ok: true, recovered: true, evidence: firstCommit.ok ? firstCommit.evidence : {} });
    expect(readFileSync(join(first.root, PROJECT_MANIFEST_PATH), "utf8")).toBe(
      readFileSync(join(second.root, PROJECT_MANIFEST_PATH), "utf8"),
    );
  });

  it("serializes migration commit and recovery through the authoring operation authority", () => {
    const project = legacyProject("operation-authority");
    const proposed = proposeProjectMigration(project.root);

    if (!proposed.ok) throw new Error("proposal refused");

    const operationLock = acquireAtomicWriteLocks([
      join(project.root, ".sceneaxi-authoring-operation"),
    ]);

    try {
      expect(commitProjectMigration({
        root: project.root,
        approved: true,
        proposalDigest: proposed.proposal.proposalDigest,
      })).toMatchObject({
        ok: false,
        diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.mutationConflict },
      });
      expect(existsSync(join(project.root, PROJECT_MIGRATION_JOURNAL_PATH))).toBe(false);
    } finally {
      releaseAtomicWriteLocks(operationLock);
    }

    expect(commitProjectMigration({
      root: project.root,
      approved: true,
      proposalDigest: proposed.proposal.proposalDigest,
    })).toMatchObject({ ok: true });
    const journalPath = join(project.root, PROJECT_MIGRATION_JOURNAL_PATH);
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Record<string, unknown>;
    writeFileSync(journalPath, `${JSON.stringify({ ...journal, state: "prepared" }, null, 2)}\n`);
    rmSync(join(project.root, PROJECT_MANIFEST_PATH));
    rmSync(join(project.root, PROJECT_MIGRATION_EVIDENCE_PATH));

    const recoveryLock = acquireAtomicWriteLocks([
      join(project.root, ".sceneaxi-authoring-operation"),
    ]);

    try {
      expect(recoverProjectMigration(project.root)).toMatchObject({
        ok: false,
        diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.mutationConflict },
      });
      expect(existsSync(join(project.root, PROJECT_MANIFEST_PATH))).toBe(false);
    } finally {
      releaseAtomicWriteLocks(recoveryLock);
    }

    expect(recoverProjectMigration(project.root)).toMatchObject({ ok: true, recovered: true });
  });

  it("refuses source changes and canonical asset escapes before manifest mutation", () => {
    const project = legacyProject("changed");
    const proposed = proposeProjectMigration(project.root);

    if (!proposed.ok) throw new Error("proposal refused");
    writeFileSync(join(project.root, "scene.json"), project.bytes.replace("Portable world", "Changed world"), "utf8");
    expect(commitProjectMigration({
      root: project.root,
      approved: true,
      proposalDigest: proposed.proposal.proposalDigest,
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.sourceChanged },
    });
    expect(existsSync(join(project.root, PROJECT_MANIFEST_PATH))).toBe(false);

    const escaped = legacyProject("escape");
    const outside = temporary("outside");
    writeFileSync(join(outside, "crate.glb"), "outside", "utf8");
    mkdirSync(join(escaped.root, "assets"));
    symlinkSync(join(outside, "crate.glb"), join(escaped.root, "assets", "crate.glb"));
    const document = createDocument({ id: "portable-world" });
    writeFileSync(join(escaped.root, "scene.json"), serializeDocument(document), "utf8");

    const manifest = createProjectManifest({
      document,
      assets: [{
        sourceId: "crate",
        path: "assets/crate.glb",
        mediaType: "model/gltf-binary",
        digest: `sha256:${"a".repeat(64)}`,
      }],
    });

    writeFileSync(join(escaped.root, PROJECT_MANIFEST_PATH), serializeProjectManifest(manifest), "utf8");
    expect(inspectProjectModel(escaped.root)).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.canonicalPathEscape },
    });
  });
});

/** Public regression oracles for production-swarm AUTHORING-001..004. */
describe("authoring project containment and valid seed bytes", () => {
  it.each(["../outside/victim.json", "linked.json", "linked-dir/victim.json"])(
    "refuses proposal/direct edit/multi-proposal outside root: %s", (documentPath) => {
      const parent = temporary("containment");
      const root = join(parent, "project");
      const outside = join(parent, "outside");
      mkdirSync(root); mkdirSync(outside);
      const bytes = serializeDocument(createDocument({ id: "victim", title: "Before" }));
      writeFileSync(join(outside, "victim.json"), bytes);
      symlinkSync(join(outside, "victim.json"), join(root, "linked.json"));
      symlinkSync(outside, join(root, "linked-dir"), "dir");
      const input = { cwd: root, documentPath, jsonPointer: "/title", newValue: "After" };
      expect(propose(input)).toMatchObject({ ok: false });
      expect(proposeMany([input])).toMatchObject({ ok: false });
      expect(editDirect(input)).toMatchObject({ ok: false });
      expect(readFileSync(join(outside, "victim.json"), "utf8")).toBe(bytes);
      expect(readdirSync(outside)).toEqual(["victim.json"]);
    },
  );

  it("rejects an escaping persisted proposal at apply even if built with another valid root", () => {
    const project = legacyProject("apply-boundary");
    const outside = legacyProject("apply-outside");
    const proposed = propose({ cwd: outside.root, documentPath: "scene.json", jsonPointer: "/title", newValue: "After" });

    if (!proposed.ok) throw new Error("fixture proposal refused");

    const proposal = {
      ...proposed.proposal,
      edits: proposed.proposal.edits.map((edit) => ({ ...edit, documentPath: join(outside.root, "scene.json") })),
      diffs: proposed.proposal.diffs.map((diff) => ({
        ...diff, documentPath: join(outside.root, "scene.json"),
        unifiedDiff: diff.unifiedDiff.replaceAll("a/scene.json", `a/${join(outside.root, "scene.json")}`).replaceAll("b/scene.json", `b/${join(outside.root, "scene.json")}`),
      })),
    };

    expect(apply({ cwd: project.root, proposal })).toMatchObject({ ok: false, diagnostics: [{ code: "validation-failed" }] });
    expect(readFileSync(join(outside.root, "scene.json"), "utf8")).toBe(outside.bytes);
  });

  it.each(["prepared", "undoing", "redoing"])("rejects hostile %s recovery before any mutation", (state) => {
    const parent = temporary("hostile-recovery");
    const root = join(parent, "project"); const outside = join(parent, "outside");
    mkdirSync(join(root, ".sceneaxi", "journal"), { recursive: true }); mkdirSync(outside);
    const before = serializeDocument(createDocument({ id: "victim", title: "Before" }));
    const after = serializeDocument(createDocument({ id: "victim", title: "After" }));
    writeFileSync(join(outside, "victim.json"), before);

    const active = JSON.stringify({
      schemaVersion: 4, kind: "sceneaxi.authoring-apply-journal", transactionId: "1700000000000-0123456789abcdef",
      createdAt: "2023-11-14T22:13:20.000Z", state, completionOrder: 1,
      ...(state === "prepared" ? {} : { completedAt: "2023-11-14T22:13:20.000Z" }),
      documents: [{ documentPath: "../outside/victim.json", beforeContent: before, beforeContentHash: contentHash(before), afterContent: after, afterContentHash: contentHash(after) }],
    });

    writeFileSync(join(root, ".sceneaxi", "journal", ".active"), active);
    expect(recoverIncompleteApplies({ cwd: root })).toMatchObject({ ok: false });
    expect(readFileSync(join(outside, "victim.json"), "utf8")).toBe(before);
    expect(readFileSync(join(root, ".sceneaxi", "journal", ".active"), "utf8")).toBe(active);
    expect(readdirSync(outside)).toEqual(["victim.json"]);
  });

  it.each(["journal", ".active", ".completion-sequence"])("rejects redirected journal resource %s", (resource) => {
    const project = legacyProject("journal-symlink"); const sink = temporary("sink");
    mkdirSync(join(project.root, ".sceneaxi", "journal"), { recursive: true });
    const proposed = propose({ cwd: project.root, documentPath: "scene.json", jsonPointer: "/title", newValue: "After" });

    if (!proposed.ok) throw new Error("fixture proposal refused");

    if (resource === "journal") {
      rmSync(join(project.root, ".sceneaxi", "journal"), { recursive: true });
      symlinkSync(sink, join(project.root, ".sceneaxi", "journal"), "dir");
    } else {
      writeFileSync(join(sink, resource), "null\n");
      symlinkSync(join(sink, resource), join(project.root, ".sceneaxi", "journal", resource));
    }

    const snapshot = readdirSync(sink).map((name) => [name, readFileSync(join(sink, name), "utf8")]);
    expect(apply({ cwd: project.root, proposal: proposed.proposal })).toMatchObject({ ok: false });
    expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(project.bytes);
    expect(readdirSync(sink).map((name) => [name, readFileSync(join(sink, name), "utf8")])).toEqual(snapshot);
  });

  it.each(["not-json", "{}", '{"schemaVersion":"99.0.0"}'])("rejects invalid native seed %s without artifacts", (documentBytes) => {
    const root = temporary("invalid-seed"); const document = createDocument({ id: "valid" });
    expect(writeNativeProjectSeed({ root, document, documentBytes })).toMatchObject({ ok: false });
    expect(readdirSync(root)).toEqual([]);
  });

  it("rejects valid but mismatched seed identity/data, and reopens matching valid seeds", () => {
    const root = temporary("seed-consistency"); const document = createDocument({ id: "valid", title: "Before" });

    for (const other of [createDocument({ id: "different" }), createDocument({ id: "valid", title: "After" })]) {
      expect(writeNativeProjectSeed({ root, document, documentBytes: serializeDocument(other) })).toMatchObject({ ok: false });
      expect(readdirSync(root)).toEqual([]);
    }

    expect(writeNativeProjectSeed({ root, document, documentBytes: serializeDocument(document) })).toMatchObject({ ok: true });
    expect(inspectProjectModel(root)).toMatchObject({ ok: true, document, inspection: { state: "native" } });
  });

  it("keeps valid in-root review/save/reopen/undo/redo bytes and canonical aliases working", () => {
    const project = legacyProject("valid-flow");
    symlinkSync(join(project.root, "scene.json"), join(project.root, "alias.json"));
    const proposed = propose({ cwd: project.root, documentPath: "alias.json", jsonPointer: "/title", newValue: "After" });

    if (!proposed.ok) throw new Error("proposal refused");
    expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(project.bytes);
    expect(apply({ cwd: project.root, proposal: proposed.proposal })).toMatchObject({ ok: true });
    const saved = readFileSync(join(project.root, "scene.json"), "utf8");
    expect(inspectProjectModel(project.root)).toMatchObject({ ok: true, document: { title: "After" } });
    expect(undoLastApply({ cwd: project.root })).toMatchObject({ ok: true });
    expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(project.bytes);
    expect(redoLastApply({ cwd: project.root })).toMatchObject({ ok: true });
    expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(saved);
  });
});

/** Platform branch coverage only: native signing hosts remain independent gates. */
describe("migration journal portable descriptor reading", () => {
  it.each(["darwin", "win32"])("reads and recovers a valid journal on the %s branch without procfs", (platform) => {
    const project = legacyProject(`portable-${platform}`);
    const proposed = proposeProjectMigration(project.root);

    if (!proposed.ok) throw new Error("fixture proposal refused");
    const committed = commitProjectMigration({ root: project.root, approved: true, proposalDigest: proposed.proposal.proposalDigest });
    expect(committed).toMatchObject({ ok: true });
    const descriptor = Object.getOwnPropertyDescriptor(process, "platform");

    if (descriptor === undefined) throw new Error("platform descriptor absent");
    Object.defineProperty(process, "platform", { ...descriptor, value: platform });

    try {
      expect(recoverProjectMigration(project.root)).toMatchObject({ ok: true, recovered: false });
      const journalPath = join(project.root, PROJECT_MIGRATION_JOURNAL_PATH);
      const journal = JSON.parse(readFileSync(journalPath, "utf8"));
      writeFileSync(journalPath, JSON.stringify({ ...journal, state: "prepared" }));
      rmSync(join(project.root, PROJECT_MANIFEST_PATH));
      rmSync(join(project.root, PROJECT_MIGRATION_EVIDENCE_PATH));
      expect(recoverProjectMigration(project.root)).toMatchObject({ ok: true, recovered: true });
      expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(project.bytes);
    } finally {
      Object.defineProperty(process, "platform", descriptor);
    }
  });
});

describe("atomic staging artifacts are not overwrite authority", () => {
  it.each(["tmp", "bak"])("isolates a pre-existing %s artifact symlink without changing victim bytes", (kind) => {
    const project = legacyProject("artifact-symlink"); const outside = temporary("artifact-victim");
    const victim = join(outside, "victim.txt"); writeFileSync(victim, "untouched");
    const target = join(project.root, "scene.json");
    const stem = createHash("sha256").update(target, "utf8").digest("hex").slice(0, 32);
    const artifact = join(project.root, `.sceneaxi-${kind}-known-token-${stem}`);
    symlinkSync(victim, artifact);
    expect(() => atomicWriteFile(target, "new bytes", { token: "known-token" })).not.toThrow();
    expect(readFileSync(victim, "utf8")).toBe("untouched");
    expect(readFileSync(target, "utf8")).toBe("new bytes");
    expect(existsSync(artifact)).toBe(true);
  });
});

/** Real CLI regression: the public core owns safety; CLI remains its adapter. */
describe("built CLI project containment front door", () => {
  const bin = fileURLToPath(new URL("../../cli/bin/sceneaxi.mjs", import.meta.url));

  function command(cwd: string, args: readonly string[]) {
    const result = spawnSync(process.execPath, [bin, ...args, "--cwd", cwd, "--json"], {
      cwd, encoding: "utf8", timeout: 10000,
    });

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe("");
    const envelope = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(envelope["schemaVersion"]).toBe(1);

    return { exit: result.status, envelope };
  }

  it("creates/reviews/rejects/saves/reopens with canonical bytes and refuses every escape without writes", () => {
    const parent = temporary("cli-project"); const root = join(parent, "project");
    const outside = join(parent, "outside"); mkdirSync(root); mkdirSync(outside);
    expect(command(root, ["project", "new", "--document", "scene.json", "--title", "Before"]).exit).toBe(0);
    const before = readFileSync(join(root, "scene.json"), "utf8");
    writeFileSync(join(outside, "victim.json"), before);
    symlinkSync(join(outside, "victim.json"), join(root, "linked.json"));
    symlinkSync(outside, join(root, "linked-dir"), "dir");
    const valid = ["project", "propose", "--document", "scene.json", "--pointer", "/title", "--value", '"After"', "--out", "accept.json"];
    expect(command(root, valid).exit).toBe(0);
    expect(readFileSync(join(root, "scene.json"), "utf8")).toBe(before);
    expect(command(root, [...valid.slice(0, -4), "--value", '"Rejected"', "--out", "reject.json"]).exit).toBe(0);
    expect(readFileSync(join(root, "scene.json"), "utf8")).toBe(before);
    expect(command(root, ["project", "apply", "--proposal", "accept.json"]).exit).toBe(0);
    const after = readFileSync(join(root, "scene.json"), "utf8");
    expect(JSON.parse(after).title).toBe("After");
    expect(command(root, ["project", "test", "--document", "scene.json"]).exit).toBe(0);
    expect(command(root, ["project", "apply", "--proposal", "reject.json"])).toMatchObject({ exit: 1, envelope: { ok: false, error: { code: "CONFLICT" } } });
    expect(readFileSync(join(root, "scene.json"), "utf8")).toBe(after);

    for (const documentPath of ["../outside/victim.json", "linked.json", "linked-dir/victim.json"]) {
      expect(command(root, ["project", "propose", "--document", documentPath, "--pointer", "/title", "--value", '"Attack"'])).toMatchObject({ exit: 2, envelope: { ok: false, error: { code: "VALIDATION" } } });
      expect(readFileSync(join(outside, "victim.json"), "utf8")).toBe(before);
      expect(readdirSync(outside)).toEqual(["victim.json"]);
    }

    const escapingProposal = JSON.parse(readFileSync(join(root, "accept.json"), "utf8"));
    const escapingPath = "../outside/victim.json";
    escapingProposal.edits = escapingProposal.edits.map((edit: Record<string, unknown>) => ({ ...edit, documentPath: escapingPath }));
    escapingProposal.diffs = escapingProposal.diffs.map((diff: { unifiedDiff: string }) => ({
      ...diff, documentPath: escapingPath,
      unifiedDiff: diff.unifiedDiff.replaceAll("a/scene.json", `a/${escapingPath}`).replaceAll("b/scene.json", `b/${escapingPath}`),
    }));
    writeFileSync(join(root, "escaping-proposal.json"), JSON.stringify(escapingProposal));
    expect(command(root, ["project", "apply", "--proposal", "escaping-proposal.json"])).toMatchObject({ exit: 2, envelope: { ok: false, error: { code: "VALIDATION" } } });
    expect(readFileSync(join(outside, "victim.json"), "utf8")).toBe(before);
    const archive = readdirSync(join(root, ".sceneaxi", "journal")).find((name) => name.endsWith(".json"));

    if (archive === undefined) throw new Error("durable journal absent");
    const entry = JSON.parse(readFileSync(join(root, ".sceneaxi", "journal", archive), "utf8"));
    delete entry.completedAt; entry.state = "prepared";
    writeFileSync(join(root, ".sceneaxi", "journal", ".active"), JSON.stringify(entry));
    writeFileSync(join(root, "scene.json"), before);
    expect(command(root, ["project", "propose", "--document", "scene.json", "--pointer", "/title", "--value", '"Recovered"']).exit).toBe(0);
    expect(readFileSync(join(root, "scene.json"), "utf8")).toBe(after);
    expect(readFileSync(join(root, ".sceneaxi", "journal", ".active"), "utf8").trim()).toBe("null");
  });

  it("recovers a genuinely abruptly terminated apply with durable scratch files and stale locks", () => {
    const project = legacyProject("actual-process-crash");
    expect(command(project.root, ["project", "propose", "--document", "scene.json", "--pointer", "/title", "--value", '"Recovered"', "--out", "crash-proposal.json"]).exit).toBe(0);
    const resolver = fileURLToPath(new URL("../../../scripts/workspace-dist-resolver.mjs", import.meta.url));
    const rootURL = new URL("../../../", import.meta.url).href;
    const scenePath = join(project.root, "scene.json");

    const script = `
      import { register, syncBuiltinESMExports } from 'node:module';
      import { pathToFileURL } from 'node:url';
      import fs from 'node:fs';
      register(pathToFileURL(${JSON.stringify(resolver)}), ${JSON.stringify(rootURL)});
      const original = fs.renameSync;
      fs.renameSync = (from, to) => {
        if (to === ${JSON.stringify(scenePath)}) process.exit(91);
        return original(from, to);
      };
      syncBuiltinESMExports();
      const core = await import('@sceneaxi/authoring-core');
      const proposal = fs.readFileSync(${JSON.stringify(join(project.root, "crash-proposal.json"))}, 'utf8');
      core.apply({ cwd: ${JSON.stringify(project.root)}, proposal });
      throw new Error('crash point not reached');
    `;

    const crashed = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: project.root, encoding: "utf8", timeout: 10000,
    });

    expect(crashed.status).toBe(91);
    expect(crashed.stderr).toBe("");
    expect(readFileSync(scenePath, "utf8")).toBe(project.bytes);
    expect(readdirSync(project.root).some((name) => name.startsWith(".sceneaxi-tmp-"))).toBe(true);
    expect(JSON.parse(readFileSync(join(project.root, ".sceneaxi", "journal", ".active"), "utf8")).state).toBe("prepared");
    expect(command(project.root, ["project", "propose", "--document", "scene.json", "--pointer", "/title", "--value", '"Next"']).exit).toBe(0);
    expect(JSON.parse(readFileSync(scenePath, "utf8")).title).toBe("Recovered");
    expect(readFileSync(join(project.root, ".sceneaxi", "journal", ".active"), "utf8").trim()).toBe("null");
    expect(readdirSync(project.root).some((name) => name.startsWith(".sceneaxi-lock-"))).toBe(false);
  });
});

describe("journal images must reopen as valid documents", () => {
  it("rejects matching-digest malformed after-images before overwriting a valid scene", () => {
    const project = legacyProject("invalid-recovery-image");
    mkdirSync(join(project.root, ".sceneaxi", "journal"), { recursive: true });
    const after = "not-json";

    const active = JSON.stringify({
      schemaVersion: 4, kind: "sceneaxi.authoring-apply-journal", transactionId: "1700000000000-0123456789abcdef",
      createdAt: "2023-11-14T22:13:20.000Z", state: "prepared", completionOrder: 1,
      documents: [{ documentPath: "scene.json", beforeContent: project.bytes, beforeContentHash: contentHash(project.bytes), afterContent: after, afterContentHash: contentHash(after) }],
    });

    writeFileSync(join(project.root, ".sceneaxi", "journal", ".active"), active);
    expect(recoverIncompleteApplies({ cwd: project.root })).toMatchObject({ ok: false, diagnostics: [{ code: "journal-invalid" }] });
    expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(project.bytes);
    expect(readFileSync(join(project.root, ".sceneaxi", "journal", ".active"), "utf8")).toBe(active);
  });
});
