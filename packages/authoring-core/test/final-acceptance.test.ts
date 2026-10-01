/** Independent final acceptance: public package only; real filesystem and child processes. */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  apply, contentHash, editDirect, propose, proposeMany, recoverIncompleteApplies,
  redoLastApply, resolveApplyTransaction, undoLastApply, writeNativeProjectSeed,
  commitProjectMigration, proposeProjectMigration, PROJECT_MIGRATION_JOURNAL_PATH,
  PROJECT_MIGRATION_EVIDENCE_PATH, inspectProjectModel, serializeDocument,
} from "@sceneaxi/authoring-core";
import { createDocument, PROJECT_MANIFEST_DIAGNOSTICS, PROJECT_MANIFEST_PATH } from "@sceneaxi/schemas";

const roots: string[] = [];

afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture() {
  const parent = mkdtempSync(join(tmpdir(), "sceneaxi-final-authoring-")); roots.push(parent);
  const root = join(parent, "project"), outside = join(parent, "outside");
  mkdirSync(root); mkdirSync(outside);
  const document = createDocument({ id: "final", title: "Before" });
  const before = serializeDocument(document);
  const after = serializeDocument(createDocument({ id: "final", title: "After" }));
  writeFileSync(join(root, "scene.json"), before); writeFileSync(join(outside, "victim.json"), before);

  return { root, outside, document, before, after };
}

const transactionId = "1700000000000-0123456789abcdef";

function journal(project: ReturnType<typeof fixture>, state: string, documentPath = "scene.json", before = project.before, after = project.after) {
  return {
    schemaVersion: 4, kind: "sceneaxi.authoring-apply-journal", transactionId,
    createdAt: "2023-11-14T22:13:20.000Z", state, completionOrder: 1,
    ...(state === "prepared" ? {} : { completedAt: "2023-11-14T22:13:20.000Z" }),
    documents: [{ documentPath, beforeContent: before, beforeContentHash: contentHash(before), afterContent: after, afterContentHash: contentHash(after) }],
  };
}

function store(project: ReturnType<typeof fixture>, value: unknown, name = ".active") {
  const directory = join(project.root, ".sceneaxi", "journal"); mkdirSync(directory, { recursive: true });
  const path = join(directory, name), bytes = JSON.stringify(value); writeFileSync(path, bytes);

  return { path, bytes };
}

function unchanged(project: ReturnType<typeof fixture>) {
  expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(project.before);
  expect(readFileSync(join(project.outside, "victim.json"), "utf8")).toBe(project.before);
  expect(readdirSync(project.outside)).toEqual(["victim.json"]);
}

describe("final project boundary acceptance", () => {
  it.each(["relative", "absolute", "file-symlink", "directory-symlink"])("names proposal/direct/multi refusal for %s escape", (kind) => {
    const project = fixture();
    symlinkSync(join(project.outside, "victim.json"), join(project.root, "linked.json"));
    symlinkSync(project.outside, join(project.root, "linked-dir"), "dir");
    const documentPath = kind === "relative" ? "../outside/victim.json" : kind === "absolute" ? join(project.outside, "victim.json") : kind === "file-symlink" ? "linked.json" : "linked-dir/victim.json";
    const input = { cwd: project.root, documentPath, jsonPointer: "/title", newValue: "Attack" };

    for (const result of [propose(input), proposeMany([input]), editDirect(input)]) {
      expect(result).toMatchObject({ ok: false, diagnostics: [{ code: "validation-failed" }] });
    }

    unchanged(project);
  });
  it("rechecks canonical containment when a reviewed document is redirected before apply", () => {
    const project = fixture();
    const proposed = propose({ cwd: project.root, documentPath: "scene.json", jsonPointer: "/title", newValue: "After" });

    if (!proposed.ok) throw new Error("fixture proposal refused");
    rmSync(join(project.root, "scene.json")); symlinkSync(join(project.outside, "victim.json"), join(project.root, "scene.json"));
    expect(apply({ cwd: project.root, proposal: proposed.proposal })).toMatchObject({ ok: false, diagnostics: [{ code: "validation-failed" }] });
    unchanged(project);
  });

  for (const state of ["prepared", "undoing", "redoing"]) {
    it.each(["relative", "file-symlink", "directory-symlink"])(`names ${state} recovery refusal for %s escape`, (kind) => {
      const project = fixture();
      symlinkSync(join(project.outside, "victim.json"), join(project.root, "linked.json"));
      symlinkSync(project.outside, join(project.root, "linked-dir"), "dir");
      const documentPath = kind === "relative" ? "../outside/victim.json" : kind === "file-symlink" ? "linked.json" : "linked-dir/victim.json";
      const saved = store(project, journal(project, state, documentPath));
      expect(recoverIncompleteApplies({ cwd: project.root })).toMatchObject({ ok: false, diagnostics: [{ code: "journal-invalid" }] });
      unchanged(project); expect(readFileSync(saved.path, "utf8")).toBe(saved.bytes);
    });
  }

  it.each(["journal", ".active", ".completion-sequence"])("names apply refusal for redirected journal resource %s", (resource) => {
    const project = fixture();
    const proposed = propose({ cwd: project.root, documentPath: "scene.json", jsonPointer: "/title", newValue: "After" });

    if (!proposed.ok) throw new Error("fixture proposal refused");
    const directory = join(project.root, ".sceneaxi", "journal"); mkdirSync(directory, { recursive: true });

    if (resource === "journal") {
      rmSync(directory, { recursive: true }); symlinkSync(project.outside, directory, "dir");
    } else symlinkSync(join(project.outside, "victim.json"), join(directory, resource));
    expect(apply({ cwd: project.root, proposal: proposed.proposal })).toMatchObject({
      ok: false, diagnostics: [{ code: resource === ".completion-sequence" ? "validation-failed" : "journal-invalid" }],
    });
    unchanged(project);
  });
  it.each(["completed", "undone"])("refuses escaping %s archives at history and transaction resolution boundaries", (state) => {
    const project = fixture();
    const saved = store(project, journal(project, state, "../outside/victim.json"), `${transactionId}.json`);
    expect(resolveApplyTransaction({ cwd: project.root, transactionId })).toMatchObject({ ok: false, diagnostics: [{ code: "journal-invalid" }] });
    expect(undoLastApply({ cwd: project.root })).toMatchObject({ ok: false, diagnostics: [{ code: "journal-invalid" }] });
    expect(redoLastApply({ cwd: project.root })).toMatchObject({ ok: false, diagnostics: [{ code: "journal-invalid" }] });
    unchanged(project); expect(readFileSync(saved.path, "utf8")).toBe(saved.bytes);
  });
  it.each([".sceneaxi", ".sceneaxi-authoring-operation", "archive"])("refuses redirected %s resource with a named code", (resource) => {
    const project = fixture();

    if (resource === ".sceneaxi") symlinkSync(project.outside, join(project.root, resource), "dir");
    else if (resource === "archive") {
      mkdirSync(join(project.root, ".sceneaxi", "journal"), { recursive: true });
      symlinkSync(join(project.outside, "victim.json"), join(project.root, ".sceneaxi", "journal", `${transactionId}.json`));
    } else symlinkSync(join(project.outside, "victim.json"), join(project.root, resource));
    const result = resource === "archive" ? resolveApplyTransaction({ cwd: project.root, transactionId }) : recoverIncompleteApplies({ cwd: project.root });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: "journal-invalid" }] });
    unchanged(project);
  });
});

describe("final document image validity acceptance", () => {
  const invalidImages = ["not-json", "{}", '{"schemaVersion":"99.0.0"}'];

  for (const state of ["prepared", "undoing", "redoing"]) {
    for (const image of ["before", "after"]) {
      it.each(invalidImages)(`refuses digest-correct ${state} ${image} image %s`, (invalid) => {
        const project = fixture();
        const saved = store(project, journal(project, state, "scene.json", image === "before" ? invalid : project.before, image === "after" ? invalid : project.after));
        expect(recoverIncompleteApplies({ cwd: project.root })).toMatchObject({ ok: false, diagnostics: [{ code: "journal-invalid" }] });
        unchanged(project); expect(readFileSync(saved.path, "utf8")).toBe(saved.bytes);
      });
    }
  }

  it.each(invalidImages)("names invalid seed refusal without creating artifacts: %s", (documentBytes) => {
    const project = fixture(); rmSync(join(project.root, "scene.json"));
    expect(writeNativeProjectSeed({ root: project.root, document: project.document, documentBytes })).toMatchObject({ ok: false, diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.malformed } });
    expect(readdirSync(project.root)).toEqual([]);
  });
  it("preserves exact valid noncanonical seed bytes, but refuses a valid mismatched document", () => {
    const project = fixture(); rmSync(join(project.root, "scene.json"));
    expect(writeNativeProjectSeed({ root: project.root, document: project.document, documentBytes: project.after })).toMatchObject({ ok: false, diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.malformed } });
    expect(readdirSync(project.root)).toEqual([]);
    const documentBytes = JSON.stringify(project.document);
    expect(writeNativeProjectSeed({ root: project.root, document: project.document, documentBytes })).toMatchObject({ ok: true });
    expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(documentBytes);
    expect(inspectProjectModel(project.root)).toMatchObject({ ok: true, document: project.document });
  });
});

const resolver = fileURLToPath(new URL("../../../scripts/workspace-dist-resolver.mjs", import.meta.url));

const rootURL = new URL("../../../", import.meta.url).href;

function child(project: ReturnType<typeof fixture>, body: string) {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import { register, syncBuiltinESMExports } from 'node:module';
    import { pathToFileURL } from 'node:url';
    import fs from 'node:fs';
    register(pathToFileURL(${JSON.stringify(resolver)}), ${JSON.stringify(rootURL)});
    ${body}
  `], { cwd: project.root, encoding: "utf8", timeout: 10000 });

  expect(result.error).toBeUndefined(); expect(result.signal).toBeNull();
  expect(result.stderr).toBe(""); expect(result.status).toBe(0);
}

describe("final descriptor and exclusive staging acceptance", () => {
  it("recovers on Linux with procfs unavailable and never opens a procfs file", () => {
    const project = fixture();
    const proposed = proposeProjectMigration(project.root);

 if (!proposed.ok) throw new Error("fixture migration refused");
    expect(commitProjectMigration({ root: project.root, approved: true, proposalDigest: proposed.proposal.proposalDigest })).toMatchObject({ ok: true });
    const path = join(project.root, PROJECT_MIGRATION_JOURNAL_PATH);
    writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, "utf8")), state: "prepared" }));
    rmSync(join(project.root, PROJECT_MANIFEST_PATH)); rmSync(join(project.root, PROJECT_MIGRATION_EVIDENCE_PATH));
    child(project, `
      const exists = fs.existsSync, open = fs.openSync; let probed = false;
      fs.existsSync = path => String(path).startsWith('/proc/self/fd/') ? (probed = true, false) : exists(path);
      fs.openSync = (path, ...args) => { assert.ok(!String(path).startsWith('/proc/')); return open(path, ...args); };
      syncBuiltinESMExports();
      const core = await import('@sceneaxi/authoring-core');
      const result = core.recoverProjectMigration(${JSON.stringify(project.root)});
      assert.equal(result.ok, true); assert.equal(result.recovered, true); assert.equal(probed, process.platform === 'linux');
    `);
    expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(project.before);
    expect(existsSync(join(project.root, PROJECT_MANIFEST_PATH))).toBe(true);
  });
  it.each(["tmp", "bak"])("refuses an actual %s creation collision without following or deleting the hostile symlink", (kind) => {
    const project = fixture();
    child(project, `
      const open = fs.openSync; let collision;
      fs.openSync = (path, ...args) => {
        if (!collision && String(path).includes('.sceneaxi-${kind}-')) {
          collision = path; fs.symlinkSync(${JSON.stringify(join(project.outside, "victim.json"))}, path);
        }
        return open(path, ...args);
      };
      syncBuiltinESMExports();
      const core = await import('@sceneaxi/authoring-core');
      assert.throws(() => core.atomicWriteFile(${JSON.stringify(join(project.root, "scene.json"))}, 'Attack'));
      assert.ok(collision); assert.equal(fs.lstatSync(collision).isSymbolicLink(), true);
    `);
    unchanged(project);
  });
});

/** Exercise every shipped project verb through the built binary, not runCli. */
describe("final built CLI project verb front doors", () => {
  const bin = fileURLToPath(new URL("../../cli/bin/sceneaxi.mjs", import.meta.url));
  const verbs = ["init", "migrate", "new", "dev", "test", "capture", "report", "propose", "apply"];

  function command(root: string, args: readonly string[]) {
    const result = spawnSync(process.execPath, [bin, "project", ...args, "--cwd", root, "--json"], {
      cwd: root, encoding: "utf8", timeout: 10000,
    });

    expect(result.error).toBeUndefined(); expect(result.signal).toBeNull(); expect(result.stderr).toBe("");
    const envelope = JSON.parse(result.stdout);
    expect(envelope.schemaVersion).toBe(1);

    return { exit: result.status, envelope };
  }

  it.each(verbs)("runs the real project %s positive path", (verb) => {
    const project = fixture();
    let flags: string[];

    if (verb === "init") flags = ["--template", "workshop-bay", "--document", "template.json"];
    else if (verb === "new") flags = ["--document", "new.json", "--title", "Created"];
    else if (verb === "capture") flags = ["--document", "scene.json", "--out", "capture.json"];
    else if (verb === "report") {
      expect(command(project.root, ["capture", "--document", "scene.json", "--out", "capture.json"]).exit).toBe(0);
      flags = ["--evidence", "capture.json"];
    } else if (verb === "propose") flags = ["--document", "scene.json", "--pointer", "/title", "--value", '"After"', "--out", "review.json"];
    else if (verb === "apply") {
      expect(command(project.root, ["propose", "--document", "scene.json", "--pointer", "/title", "--value", '"After"', "--out", "review.json"]).exit).toBe(0);
      flags = ["--proposal", "review.json"];
    } else flags = ["--document", "scene.json"];
    expect(command(project.root, [verb, ...flags])).toMatchObject({ exit: 0, envelope: { ok: true } });
    expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(verb === "apply" ? project.after : project.before);
    expect(readFileSync(join(project.outside, "victim.json"), "utf8")).toBe(project.before);

    if (verb === "init") expect(existsSync(join(project.root, "template.json"))).toBe(true);

    if (verb === "new") expect(existsSync(join(project.root, "new.json"))).toBe(true);

    if (verb === "capture") expect(existsSync(join(project.root, "capture.json"))).toBe(true);

    if (verb === "propose") expect(existsSync(join(project.root, "review.json"))).toBe(true);
  });
  it.each(verbs)("names the real project %s unknown-flag refusal without mutations", (verb) => {
    const project = fixture();
    expect(command(project.root, [verb, "--not-a-project-flag"])).toMatchObject({ exit: 2, envelope: { ok: false, error: { code: "UNKNOWN_FLAG" } } });
    unchanged(project); expect(readdirSync(project.root)).toEqual(["scene.json"]);
  });
});
