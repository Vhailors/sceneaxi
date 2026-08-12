import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import * as authoringCoreSdk from "@sceneaxi/authoring-core";
import {
  atomicWriteLockArtifactPaths,
  releaseAtomicWriteLocksChecked,
} from "../src/atomic-write.js";
import {
  PROJECT_MIGRATION_JOURNAL_PATH,
  apply,
  acquireAtomicWriteLocks,
  commitProjectMigration,
  inspectProjectGit,
  propose,
  proposeProjectMigration,
  releaseAtomicWriteLocks,
  refuseUnsupportedProjectGitOperation,
  serializeDocument,
  writeNativeProjectSeed,
} from "@sceneaxi/authoring-core";
import {
  createProjectGitAuthoringAuthority,
  prepareProjectGitCommit,
  stageProjectGitPaths,
} from "../internal/project-git-authority.js";
import {
  PROJECT_GIT_DIAGNOSTICS,
  PROJECT_MANIFEST_PATH,
  createDocument,
  serializeProjectManifest,
} from "@sceneaxi/schemas";

const roots: string[] = [];
const authoringReady = Object.freeze({
  reviewStaged: false,
  recoveryPending: false,
  transactionDirty: false,
});

function mutationOptions(root: string) {
  return { root, authoring: createProjectGitAuthoringAuthority(root, () => authoringReady) };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(root: string, ...args: string[]) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function repository(label: string, objectFormat?: "sha256") {
  const root = mkdtempSync(join(tmpdir(), `sceneaxi-project-git-${label}-`));
  roots.push(root);
  const document = createDocument({ id: "contained-world", title: "Contained", data: { value: 1 } });
  const seeded = writeNativeProjectSeed({
    root,
    document,
    documentBytes: serializeDocument(document),
  });
  if (!seeded.ok) throw new Error(seeded.diagnostic.message);
  git(
    root,
    "init",
    ...(objectFormat === undefined ? [] : [`--object-format=${objectFormat}`]),
    "-b",
    "main",
  );
  git(root, "config", "user.name", "SceneAxi Test");
  git(root, "config", "user.email", "sceneaxi@example.invalid");
  git(root, "add", "--", "scene.json", PROJECT_MANIFEST_PATH);
  git(root, "commit", "-m", "seed");
  return { root, manifest: seeded.manifest };
}

describe("contained project Git service", () => {
  it("keeps Git mutation authority outside the public SDK root", () => {
    expect(Object.hasOwn(authoringCoreSdk, "createProjectGitAuthoringAuthority")).toBe(false);
    expect(Object.hasOwn(authoringCoreSdk, "stageProjectGitPaths")).toBe(false);
    expect(Object.hasOwn(authoringCoreSdk, "prepareProjectGitCommit")).toBe(false);
    const resolveFromTest = createRequire(import.meta.url).resolve;
    expect(() => resolveFromTest("@sceneaxi/authoring-core/desktop-session-authority")).toThrow();
    expect(() => resolveFromTest("@sceneaxi-internal/project-git-authority")).toThrow();
  });

  it("reports canonical and unrelated changes with stable diffs without changing either", () => {
    const { root } = repository("inspect");
    writeFileSync(join(root, "scene.json"), readFileSync(join(root, "scene.json"), "utf8").replace("Contained", "Changed"));
    writeFileSync(join(root, "notes.txt"), "operator notes\n", "utf8");
    const before = git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all");

    const result = inspectProjectGit({ root }, "diff");

    expect(result).toMatchObject({
      ok: true,
      state: {
        kind: "sceneaxi.project-git-state",
        branch: "main",
        detached: false,
        canonicalFiles: ["scene.json", PROJECT_MANIFEST_PATH].sort(),
        canonicalChanges: [{ path: "scene.json", canonical: true }],
        unrelatedChanges: [{ path: "notes.txt", canonical: false }],
        clean: false,
        undoScope: "sceneaxi-document-only",
      },
    });
    if (!result.ok) return;
    expect(result.state.workingTreeDiff).toContain("Changed");
    expect(result.state.workingTreeDiff).not.toContain("operator notes");
    expect(git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all")).toBe(before);
  });

  it("stages only explicit paths and prepares but never creates a commit", () => {
    const { root } = repository("prepare");
    writeFileSync(join(root, "scene.json"), readFileSync(join(root, "scene.json"), "utf8").replace("Contained", "Prepared"));
    writeFileSync(join(root, "notes.txt"), "leave unstaged\n", "utf8");
    const head = git(root, "rev-parse", "HEAD").trim();

    const staged = stageProjectGitPaths(mutationOptions(root), ["scene.json"]);
    expect(staged).toMatchObject({
      ok: true,
      state: {
        entries: [
          { path: "notes.txt", index: "?", worktree: "?" },
          { path: "scene.json", index: "M", worktree: " " },
        ],
      },
    });
    expect(git(root, "diff", "--cached", "--name-only").trim()).toBe("scene.json");
    expect(git(root, "diff", "--name-only").trim()).toBe("");

    const prepared = prepareProjectGitCommit(mutationOptions(root), ["scene.json"], "feat: save contained change");
    expect(prepared).toMatchObject({
      ok: true,
      preparation: {
        kind: "sceneaxi.project-git-commit-preparation",
        selectedPaths: ["scene.json"],
        commitCreated: false,
        hooksBypassed: false,
        undoScope: "sceneaxi-document-only",
      },
    });
    expect(git(root, "rev-parse", "HEAD").trim()).toBe(head);
    expect(prepareProjectGitCommit(mutationOptions(root), ["scene.json", "notes.txt"], "mismatch")).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.selectionMismatch },
    });
    expect(prepareProjectGitCommit(mutationOptions(root), ["scene.json"], "   ")).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.commitMessageInvalid },
    });

    writeFileSync(join(root, ":(top)**"), "literal pathspec name\n");
    const unusualPaths = [":(top)**", " notes,2026.txt", "C:notes.txt", "notes\\draft.txt"];
    for (const path of unusualPaths.slice(1)) writeFileSync(join(root, path), `${path}\n`);
    expect(stageProjectGitPaths(mutationOptions(root), unusualPaths)).toMatchObject({ ok: true });
    expect(git(root, "diff", "--cached", "--name-only", "-z").split("\0").filter(Boolean).sort()).toEqual([
      " notes,2026.txt",
      ":(top)**",
      "C:notes.txt",
      "notes\\draft.txt",
      "scene.json",
    ]);
  });

  it("publishes validated objects in SHA-256 repositories", () => {
    const { root } = repository("sha256", "sha256");
    writeFileSync(join(root, "notes.txt"), "sha256 object\n");

    expect(stageProjectGitPaths(mutationOptions(root), ["notes.txt"])).toMatchObject({ ok: true });
    expect(git(root, "rev-parse", "--show-object-format").trim()).toBe("sha256");
    expect(git(root, "diff", "--cached", "--name-only").trim()).toBe("notes.txt");
    const objectId = git(root, "rev-parse", ":notes.txt").trim();
    expect(objectId).toHaveLength(64);
    expect(git(root, "cat-file", "blob", objectId)).toBe("sha256 object\n");
  });

  it("refuses directory selections and leaves no operation-lock residue", () => {
    const { root } = repository("exact-files");
    mkdirSync(join(root, "assets"));
    writeFileSync(join(root, "assets", "one.txt"), "one\n");
    writeFileSync(join(root, "assets", "two.txt"), "two\n");

    expect(stageProjectGitPaths(mutationOptions(root), ["assets"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.selectionMismatch },
    });
    expect(git(root, "diff", "--cached", "--name-only").trim()).toBe("");
    expect(readdirSync(root).filter((name) => name.startsWith(".sceneaxi-lock-"))).toEqual([]);
    expect(existsSync(join(root, ".sceneaxi"))).toBe(false);
  });

  it("contains Git repository overrides inside the selected project", () => {
    const { root } = repository("environment");
    writeFileSync(join(root, "scene.json"), readFileSync(join(root, "scene.json"), "utf8").replace("Contained", "Contained override"));
    const outside = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-index-"));
    roots.push(outside);
    const outsideIndex = join(outside, "index");
    const previousIndex = process.env["GIT_INDEX_FILE"];
    process.env["GIT_INDEX_FILE"] = outsideIndex;
    try {
      expect(stageProjectGitPaths(mutationOptions(root), ["scene.json"])).toMatchObject({ ok: true });
    } finally {
      if (previousIndex === undefined) delete process.env["GIT_INDEX_FILE"];
      else process.env["GIT_INDEX_FILE"] = previousIndex;
    }
    expect(() => readFileSync(outsideIndex)).toThrow();
    expect(git(root, "diff", "--cached", "--name-only").trim()).toBe("scene.json");
  });

  it("disables lazy fetching at the shared Git process boundary", () => {
    const { root } = repository("no-lazy-fetch");
    const wrapper = join(root, "git-wrapper.sh");
    const sentinel = join(root, "lazy-fetch-enabled");
    writeFileSync(wrapper, `#!/bin/sh\nif [ "$GIT_NO_LAZY_FETCH" != "1" ]; then printf enabled > "${sentinel}"; fi\nexec git "$@"\n`);
    chmodSync(wrapper, 0o700);
    const previous = process.env["GIT_NO_LAZY_FETCH"];
    process.env["GIT_NO_LAZY_FETCH"] = "0";
    try {
      expect(inspectProjectGit({ root, gitExecutable: wrapper })).toMatchObject({ ok: true });
    } finally {
      if (previous === undefined) delete process.env["GIT_NO_LAZY_FETCH"];
      else process.env["GIT_NO_LAZY_FETCH"] = previous;
    }
    expect(existsSync(sentinel)).toBe(false);
  });

  it("terminates blocking Git subprocesses with a stable diagnostic", () => {
    const { root } = repository("process-timeout");
    const wrapper = join(root, "git-blocks-forever.js");
    writeFileSync(wrapper, "#!/usr/bin/env node\nwhile (true) {}\n");
    chmodSync(wrapper, 0o700);

    expect(inspectProjectGit({ root, gitExecutable: wrapper })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.repositoryUnavailable },
    });
  });

  it("refuses escaped repository and journal storage before mutation", () => {
    const journalRepository = repository("journal-escape");
    writeFileSync(join(journalRepository.root, "scene.json"), readFileSync(join(journalRepository.root, "scene.json"), "utf8").replace("Contained", "Escaped journal"));
    const outsideJournal = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-journal-outside-"));
    roots.push(outsideJournal);
    symlinkSync(outsideJournal, join(journalRepository.root, ".sceneaxi"));
    expect(stageProjectGitPaths(mutationOptions(journalRepository.root), ["scene.json"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.pathEscape },
    });
    expect(readdirSync(outsideJournal)).toEqual([]);

    const linkedRepository = repository("repository-escape");
    const outsideRepository = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-repository-outside-"));
    roots.push(outsideRepository);
    renameSync(join(linkedRepository.root, ".git"), join(outsideRepository, "git-data"));
    writeFileSync(join(linkedRepository.root, ".git"), `gitdir: ${join(outsideRepository, "git-data")}\n`);
    expect(inspectProjectGit({ root: linkedRepository.root })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.repositoryEscape },
    });

    const alternateRepository = repository("alternate-objects");
    const outsideObjects = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-objects-outside-"));
    roots.push(outsideObjects);
    mkdirSync(join(outsideObjects, "objects"));
    writeFileSync(
      join(alternateRepository.root, ".git", "objects", "info", "alternates"),
      `${join(outsideObjects, "objects")}\n`,
    );
    expect(inspectProjectGit({ root: alternateRepository.root })).toMatchObject({
      ok: false,
      diagnostic: {
        code: PROJECT_GIT_DIAGNOSTICS.repositoryEscape,
        path: "$git.objects.alternates",
      },
    });
  });

  it("preserves path-escape diagnostics for an escaped project manifest", () => {
    const { root } = repository("manifest-escape");
    const outside = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-manifest-outside-"));
    roots.push(outside);
    renameSync(join(root, PROJECT_MANIFEST_PATH), join(outside, PROJECT_MANIFEST_PATH));
    symlinkSync(join(outside, PROJECT_MANIFEST_PATH), join(root, PROJECT_MANIFEST_PATH));
    expect(inspectProjectGit({ root })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.pathEscape, path: PROJECT_MANIFEST_PATH },
    });
  });

  it("refuses immediate loose-object indirection before invoking Git", () => {
    const { root } = repository("loose-object-indirection");
    const outside = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-loose-object-outside-"));
    roots.push(outside);
    symlinkSync(outside, join(root, ".git", "objects", "ab"));

    expect(inspectProjectGit({
      root,
      gitExecutable: "sceneaxi-git-must-not-run",
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.repositoryEscape, path: "$git.objects" },
    });

    const nested = repository("loose-object-entry-indirection");
    mkdirSync(join(nested.root, ".git", "objects", "cd"));
    symlinkSync(join(outside, "object"), join(nested.root, ".git", "objects", "cd", "0".repeat(38)));
    expect(inspectProjectGit({
      root: nested.root,
      gitExecutable: "sceneaxi-git-must-not-run",
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.repositoryEscape, path: "$git.objects" },
    });
  });

  it("refuses Git control-file indirections and gitlinks before inspection", () => {
    const linkedConfig = repository("linked-config");
    const outside = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-config-outside-"));
    roots.push(outside);
    renameSync(join(linkedConfig.root, ".git", "config"), join(outside, "config"));
    symlinkSync(join(outside, "config"), join(linkedConfig.root, ".git", "config"));
    expect(inspectProjectGit({ root: linkedConfig.root })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.repositoryEscape },
    });

    const linkedExclude = repository("linked-exclude");
    const excludeOutside = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-exclude-outside-"));
    roots.push(excludeOutside);
    mkdirSync(join(linkedExclude.root, ".git", "info"), { recursive: true });
    writeFileSync(join(excludeOutside, "exclude"), "outside-ignore\n");
    rmSync(join(linkedExclude.root, ".git", "info", "exclude"), { force: true });
    symlinkSync(join(excludeOutside, "exclude"), join(linkedExclude.root, ".git", "info", "exclude"));
    expect(inspectProjectGit({
      root: linkedExclude.root,
      gitExecutable: "sceneaxi-git-must-not-run",
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.repositoryEscape, path: "$git.info.exclude" },
    });

    const configuredExclude = repository("configured-exclude");
    writeFileSync(
      join(configuredExclude.root, ".git", "config"),
      `${readFileSync(join(configuredExclude.root, ".git", "config"), "utf8")}\n[core]\n\texcludesFile = ${join(excludeOutside, "exclude")}\n`,
    );
    expect(inspectProjectGit({
      root: configuredExclude.root,
      gitExecutable: "sceneaxi-git-must-not-run",
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.repositoryEscape, path: "$git.config" },
    });

    const gitlink = repository("gitlink");
    const head = git(gitlink.root, "rev-parse", "HEAD").trim();
    git(gitlink.root, "update-index", "--add", "--cacheinfo", `160000,${head},nested`);
    expect(inspectProjectGit({ root: gitlink.root })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.repositoryEscape, path: "$git.index" },
    });
  });

  it("preserves both sides when a canonical file is renamed", () => {
    const { root } = repository("rename");
    renameSync(join(root, "scene.json"), join(root, "moved.json"));
    git(root, "add", "-A");
    const result = inspectProjectGit({ root });
    expect(result).toMatchObject({
      ok: true,
      state: {
        canonicalChanges: [{
          path: "moved.json",
          sourcePath: "scene.json",
          canonical: true,
        }],
      },
    });
    expect(stageProjectGitPaths(mutationOptions(root), ["moved.json", "scene.json"])).toMatchObject({
      ok: true,
    });
    expect(prepareProjectGitCommit(
      mutationOptions(root),
      ["moved.json", "scene.json"],
      "feat: rename scene",
    )).toMatchObject({
      ok: true,
      preparation: { selectedPaths: ["moved.json", "scene.json"] },
    });
    expect(prepareProjectGitCommit(
      mutationOptions(root),
      ["moved.json"],
      "feat: incomplete rename",
    )).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.selectionMismatch },
    });
  });

  it("reports an explicit rollback when prospective evidence is too large", () => {
    const { root } = repository("stage-rollback");
    const indexPath = join(root, ".git", "index");
    const beforeIndex = readFileSync(indexPath);
    const beforeObjects = git(root, "count-objects", "-v");
    writeFileSync(join(root, "large-untracked.bin"), randomBytes(900 * 1024));

    expect(stageProjectGitPaths(mutationOptions(root), ["large-untracked.bin"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.evidenceTooLarge },
    });
    expect(readFileSync(indexPath)).toEqual(beforeIndex);
    expect(git(root, "count-objects", "-v")).toBe(beforeObjects);
    expect(git(root, "diff", "--cached", "--name-only").trim()).toBe("");
  });

  it("refuses a selected file replaced by a directory before index publication", () => {
    const { root } = repository("stage-directory-race");
    const selected = join(root, "selected.txt");
    writeFileSync(selected, "selected file\n");
    const wrapper = join(root, "git-replaces-selected.sh");
    writeFileSync(wrapper, [
      "#!/bin/sh",
      "for arg in \"$@\"; do",
      "  if [ \"$arg\" = \"add\" ] || [ \"$arg\" = \"hash-object\" ]; then",
      `    rm -f -- ${JSON.stringify(selected)}`,
      `    mkdir -- ${JSON.stringify(selected)}`,
      `    printf child > ${JSON.stringify(join(selected, "child.txt"))}`,
      "    break",
      "  fi",
      "done",
      "exec git \"$@\"",
      "",
    ].join("\n"));
    chmodSync(wrapper, 0o700);

    expect(stageProjectGitPaths(
      { ...mutationOptions(root), gitExecutable: wrapper },
      ["selected.txt"],
    )).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.selectionMismatch },
    });
    expect(git(root, "diff", "--cached", "--name-only").trim()).toBe("");
  });

  it("refuses non-UTF-8 Git filenames without lossy evidence", () => {
    const { root } = repository("filename-encoding");
    const path = Buffer.concat([
      Buffer.from(`${root}/invalid-`, "utf8"),
      Buffer.from([0xff]),
    ]);
    writeFileSync(path, "invalid filename bytes\n");

    expect(inspectProjectGit({ root })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.filenameEncodingUnsupported },
    });
  });

  it("preserves a leading UTF-8 BOM in exact Git filenames", () => {
    const { root } = repository("filename-bom");
    const name = "\uFEFFnotes.txt";
    const path = Buffer.concat([
      Buffer.from(`${root}/`, "utf8"),
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("notes.txt", "utf8"),
    ]);
    writeFileSync(path, "bom filename\n");

    expect(inspectProjectGit({ root })).toMatchObject({
      ok: true,
      state: { unrelatedChanges: [{ path: name }] },
    });
    expect(stageProjectGitPaths(mutationOptions(root), [name])).toMatchObject({ ok: true });
    expect(git(root, "diff", "--cached", "--name-only", "-z")).toBe(`${name}\0`);
  });

  it("refuses a selected file that changes during prospective validation and cleans up", () => {
    const { root } = repository("stage-revalidation-race");
    const selected = join(root, "selected.txt");
    const wrapper = join(root, "git-removes-selected-during-validation.sh");
    writeFileSync(selected, "captured bytes\n");
    writeFileSync(wrapper, [
      "#!/bin/sh",
      "for arg in \"$@\"; do",
      "  if [ \"$arg\" = \"cat-file\" ]; then",
      `    rm -f -- ${JSON.stringify(selected)}`,
      "    break",
      "  fi",
      "done",
      "exec git \"$@\"",
      "",
    ].join("\n"));
    chmodSync(wrapper, 0o700);

    expect(stageProjectGitPaths(
      { ...mutationOptions(root), gitExecutable: wrapper },
      ["selected.txt"],
    )).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.selectionMismatch },
    });
    expect(git(root, "diff", "--cached", "--name-only").trim()).toBe("");
    expect(readdirSync(join(root, ".git")).some((name) => name.startsWith(".sceneaxi-index-"))).toBe(false);
    expect(readdirSync(root).filter((name) => name.startsWith(".sceneaxi-lock-"))).toEqual([]);
  });

  it("validates symlink and executable modes before index publication", () => {
    const raced = repository("stage-mode-race");
    const link = join(raced.root, "selected-link");
    const wrapper = join(raced.root, "git-rewrites-selected-mode.sh");
    symlinkSync("same-bytes", link);
    writeFileSync(wrapper, [
      "#!/bin/bash",
      "args=(\"$@\")",
      "for ((index = 0; index < ${#args[@]}; index += 1)); do",
      "  if [[ \"${args[$index]}\" == \"add\" ]]; then",
      `    rm -f -- ${JSON.stringify(link)}`,
      `    printf same-bytes > ${JSON.stringify(link)}`,
      "    git \"${args[@]}\"",
      "    status=$?",
      `    rm -f -- ${JSON.stringify(link)}`,
      `    ln -s same-bytes ${JSON.stringify(link)}`,
      "    exit $status",
      "  fi",
      "  if [[ \"${args[$index]}\" == \"120000\" ]]; then args[$index]=100644; fi",
      "done",
      "exec git \"${args[@]}\"",
      "",
    ].join("\n"));
    chmodSync(wrapper, 0o700);

    expect(stageProjectGitPaths(
      { ...mutationOptions(raced.root), gitExecutable: wrapper },
      ["selected-link"],
    )).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.selectionMismatch },
    });
    expect(git(raced.root, "diff", "--cached", "--name-only").trim()).toBe("");

    const exact = repository("stage-exact-modes");
    writeFileSync(join(exact.root, "executable.sh"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    symlinkSync("executable.sh", join(exact.root, "executable-link"));
    expect(stageProjectGitPaths(
      mutationOptions(exact.root),
      ["executable-link", "executable.sh"],
    )).toMatchObject({ ok: true });
    expect(git(exact.root, "ls-files", "--stage", "executable-link").split(" ")[0]).toBe("120000");
    expect(git(exact.root, "ls-files", "--stage", "executable.sh").split(" ")[0]).toBe("100755");
  });

  it("uses the live index lock protocol and discards a blocked prospective index", () => {
    const { root } = repository("stage-index-lock");
    const indexPath = join(root, ".git", "index");
    const lockPath = `${indexPath}.lock`;
    const beforeIndex = readFileSync(indexPath);
    writeFileSync(join(root, "notes.txt"), "blocked publish\n");
    writeFileSync(lockPath, "concurrent writer\n");

    expect(stageProjectGitPaths(mutationOptions(root), ["notes.txt"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.stageRolledBack },
    });
    expect(readFileSync(indexPath)).toEqual(beforeIndex);
    expect(readFileSync(lockPath, "utf8")).toBe("concurrent writer\n");
    expect(readdirSync(join(root, ".git")).some((name) => name.startsWith(".sceneaxi-index-"))).toBe(false);
    unlinkSync(lockPath);
  });

  it("reports a disappeared prospective index as rolled back", () => {
    const { root } = repository("stage-temp-disappears");
    const indexPath = join(root, ".git", "index");
    const beforeIndex = readFileSync(indexPath);
    const wrapper = join(root, "git-removes-temp-index.sh");
    writeFileSync(wrapper, [
      "#!/bin/sh",
      'git "$@"',
      "status=$?",
      'case "$GIT_INDEX_FILE" in',
      '  */.sceneaxi-index-*/index) rm -f -- "$GIT_INDEX_FILE" ;;',
      "esac",
      "exit $status",
      "",
    ].join("\n"));
    chmodSync(wrapper, 0o700);
    writeFileSync(join(root, "notes.txt"), "temporary index disappears\n");

    expect(stageProjectGitPaths(
      { ...mutationOptions(root), gitExecutable: wrapper },
      ["notes.txt"],
    )).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.stageRolledBack },
    });
    expect(readFileSync(indexPath)).toEqual(beforeIndex);
    expect(readdirSync(join(root, ".git")).some((name) => name.startsWith(".sceneaxi-index-"))).toBe(false);
  });

  it("refuses special Git control nodes before reading them", () => {
    const { root } = repository("special-control-node");
    const configPath = join(root, ".git", "config");
    rmSync(configPath);
    execFileSync("mkfifo", [configPath]);

    expect(inspectProjectGit({ root })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.repositoryEscape, path: "$git.config" },
    });
  });

  it("refuses split indexes and merge-state indirection before Git", () => {
    const split = repository("split-index");
    writeFileSync(join(split.root, ".git", "sharedindex.invalid"), "not an index\n");
    expect(inspectProjectGit({
      root: split.root,
      gitExecutable: "sceneaxi-git-must-not-run",
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.repositoryEscape, path: "$git.index" },
    });

    const merge = repository("merge-head-indirection");
    const outside = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-merge-head-outside-"));
    roots.push(outside);
    writeFileSync(join(outside, "MERGE_HEAD"), `${git(merge.root, "rev-parse", "HEAD").trim()}\n`);
    symlinkSync(join(outside, "MERGE_HEAD"), join(merge.root, ".git", "MERGE_HEAD"));
    expect(inspectProjectGit({
      root: merge.root,
      gitExecutable: "sceneaxi-git-must-not-run",
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.repositoryEscape, path: "$git.MERGE_HEAD" },
    });
  });

  it("refuses commit-graph metadata indirection before Git", () => {
    const single = repository("commit-graph-indirection");
    const outside = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-commit-graph-outside-"));
    roots.push(outside);
    writeFileSync(join(outside, "commit-graph"), "outside graph\n");
    symlinkSync(
      join(outside, "commit-graph"),
      join(single.root, ".git", "objects", "info", "commit-graph"),
    );
    expect(inspectProjectGit({
      root: single.root,
      gitExecutable: "sceneaxi-git-must-not-run",
    })).toMatchObject({
      ok: false,
      diagnostic: {
        code: PROJECT_GIT_DIAGNOSTICS.repositoryEscape,
        path: "$git.objects.info.commit-graph",
      },
    });

    const chain = repository("commit-graph-chain-indirection");
    mkdirSync(join(chain.root, ".git", "objects", "info", "commit-graphs"));
    symlinkSync(
      join(outside, "commit-graph"),
      join(chain.root, ".git", "objects", "info", "commit-graphs", "graph-test.graph"),
    );
    expect(inspectProjectGit({
      root: chain.root,
      gitExecutable: "sceneaxi-git-must-not-run",
    })).toMatchObject({
      ok: false,
      diagnostic: {
        code: PROJECT_GIT_DIAGNOSTICS.repositoryEscape,
        path: "$git.objects.info.commit-graphs",
      },
    });
  });

  it("refuses clean filters without executing them", () => {
    const { root } = repository("filter");
    const outside = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-filter-outside-"));
    roots.push(outside);
    const sentinel = join(outside, "executed");
    writeFileSync(join(root, ".gitattributes"), "scene.json filter=escape\n");
    git(root, "config", "filter.escape.clean", `touch ${sentinel} && cat`);
    writeFileSync(join(root, "scene.json"), readFileSync(join(root, "scene.json"), "utf8").replace("Contained", "Filtered"));
    expect(stageProjectGitPaths(mutationOptions(root), ["scene.json"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.commandFailed },
    });
    expect(() => readFileSync(sentinel)).toThrow();
    expect(git(root, "diff", "--cached", "--name-only").trim()).toBe("");
  });

  it("stages captured bytes without executing a filter introduced after preflight", () => {
    const { root } = repository("filter-race");
    const outside = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-filter-race-outside-"));
    roots.push(outside);
    const sentinel = join(outside, "executed");
    const wrapper = join(root, "git-introduces-filter.sh");
    writeFileSync(join(root, ".gitattributes"), "notes.txt filter=escape\n");
    writeFileSync(join(root, "notes.txt"), "captured without filter\n");
    writeFileSync(wrapper, [
      "#!/bin/sh",
      "trigger=0",
      "for arg in \"$@\"; do",
      "  if [ \"$arg\" = \"status\" ] || [ \"$arg\" = \"diff\" ] || [ \"$arg\" = \"add\" ] || [ \"$arg\" = \"hash-object\" ]; then trigger=1; fi",
      "done",
      "if [ \"$trigger\" = \"1\" ]; then",
      `  git config --local filter.escape.clean ${JSON.stringify(`touch ${sentinel} && cat`)}`,
      "  git \"$@\"",
      "  status=$?",
      "  git config --local --unset-all filter.escape.clean",
      "  exit $status",
      "fi",
      "exec git \"$@\"",
      "",
    ].join("\n"));
    chmodSync(wrapper, 0o700);

    expect(stageProjectGitPaths(
      { ...mutationOptions(root), gitExecutable: wrapper },
      ["notes.txt"],
    )).toMatchObject({ ok: true });
    expect(existsSync(sentinel)).toBe(false);
    expect(git(root, "show", ":notes.txt")).toBe("captured without filter\n");
  });

  it("refuses evidence that cannot cross every local client transport", () => {
    const { root } = repository("large-diff");
    const largePath = join(root, "large.bin");
    writeFileSync(largePath, randomBytes(17 * 1024 * 1024));
    git(root, "add", "large.bin");
    git(root, "commit", "-m", "large fixture");
    writeFileSync(largePath, randomBytes(17 * 1024 * 1024));
    const result = inspectProjectGit({ root }, "diff");
    expect(result).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.evidenceTooLarge },
    });
  });

  it("refuses oversized selected files before reading or mutating Git state", () => {
    const { root } = repository("selected-evidence-bound");
    const selected = join(root, "huge-sparse.bin");
    const beforeIndex = readFileSync(join(root, ".git", "index"));
    const beforeObjects = git(root, "count-objects", "-v");
    execFileSync("truncate", ["-s", "8G", selected]);

    expect(stageProjectGitPaths(mutationOptions(root), ["huge-sparse.bin"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.evidenceTooLarge },
    });
    expect(readFileSync(join(root, ".git", "index"))).toEqual(beforeIndex);
    expect(git(root, "count-objects", "-v")).toBe(beforeObjects);
    expect(readdirSync(join(root, ".git")).some((name) => name.startsWith(".sceneaxi-index-"))).toBe(false);
  });

  it("returns a stable refusal for malformed journal storage without leaking a lock", () => {
    const { root } = repository("journal-storage-failure");
    writeFileSync(join(root, "scene.json"), readFileSync(join(root, "scene.json"), "utf8").replace("Contained", "Changed"));
    writeFileSync(join(root, ".sceneaxi"), "not a directory\n");
    expect(stageProjectGitPaths(mutationOptions(root), ["scene.json"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.recoveryPending },
    });
    rmSync(join(root, ".sceneaxi"));
    expect(stageProjectGitPaths(mutationOptions(root), ["scene.json"])).toMatchObject({ ok: true });
    expect(readdirSync(root).filter((name) => name.startsWith(".sceneaxi-lock-"))).toEqual([]);
  });

  it("distinguishes completed, recoverable, and active authoring journal state", () => {
    const { root } = repository("journal");
    const proposed = propose({
      cwd: root,
      documentPath: "scene.json",
      jsonPointer: "/title",
      newValue: "Saved",
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(apply({ cwd: root, proposal: proposed.proposal })).toMatchObject({ ok: true });
    expect(readFileSync(join(root, ".sceneaxi", "journal", ".active"), "utf8").trim()).toBe("null");
    expect(stageProjectGitPaths(mutationOptions(root), ["scene.json"])).toMatchObject({ ok: true });

    const journalDirectory = join(root, ".sceneaxi", "journal");
    const journalName = readdirSync(journalDirectory).find((name) => name.endsWith(".json"));
    expect(journalName).toBeDefined();
    if (journalName === undefined) return;
    const completed = JSON.parse(readFileSync(join(journalDirectory, journalName), "utf8")) as Record<string, unknown>;
    const prepared: Record<string, unknown> = { ...completed, state: "prepared" };
    delete prepared["completedAt"];
    writeFileSync(join(journalDirectory, ".active"), `${JSON.stringify(prepared, null, 2)}\n`);
    expect(stageProjectGitPaths(mutationOptions(root), ["scene.json"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.recoveryPending },
    });

    writeFileSync(join(journalDirectory, ".active"), "null\n");
    const lockSet = acquireAtomicWriteLocks([join(root, ".sceneaxi-authoring-operation")]);
    try {
      expect(stageProjectGitPaths(mutationOptions(root), ["scene.json"])).toMatchObject({
        ok: false,
        diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.transactionDirty },
      });
    } finally {
      releaseAtomicWriteLocks(lockSet);
    }

    rmSync(join(journalDirectory, ".active"));
    mkdirSync(join(journalDirectory, ".active"));
    expect(stageProjectGitPaths(mutationOptions(root), ["scene.json"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.recoveryPending },
    });
    rmSync(join(journalDirectory, ".active"), { recursive: true });
    writeFileSync(join(journalDirectory, ".active"), "null\n");
    expect(stageProjectGitPaths(mutationOptions(root), ["scene.json"])).toMatchObject({ ok: true });
  });

  it("treats prepared and invalid migration journals as recovery pending", () => {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-migration-journal-"));
    roots.push(root);
    const document = createDocument({ id: "migration-pending", title: "Legacy" });
    writeFileSync(join(root, "scene.json"), serializeDocument(document));
    const proposed = proposeProjectMigration(root);
    if (!proposed.ok) throw new Error("migration proposal refused");
    expect(commitProjectMigration({
      root,
      approved: true,
      proposalDigest: proposed.proposal.proposalDigest,
    })).toMatchObject({ ok: true });
    git(root, "init", "-b", "main");
    git(root, "config", "user.name", "SceneAxi Test");
    git(root, "config", "user.email", "sceneaxi@example.invalid");
    git(root, "add", ".");
    git(root, "commit", "-m", "seed migrated project");
    writeFileSync(join(root, "notes.txt"), "pending migration\n");
    const journalPath = join(root, PROJECT_MIGRATION_JOURNAL_PATH);
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Record<string, unknown>;
    writeFileSync(journalPath, `${JSON.stringify({ ...journal, state: "prepared" }, null, 2)}\n`);

    const manifestBytes = readFileSync(join(root, PROJECT_MANIFEST_PATH));
    unlinkSync(join(root, PROJECT_MANIFEST_PATH));
    expect(stageProjectGitPaths(mutationOptions(root), ["notes.txt"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.recoveryPending },
    });
    writeFileSync(join(root, PROJECT_MANIFEST_PATH), manifestBytes);
    expect(stageProjectGitPaths(mutationOptions(root), ["notes.txt"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.recoveryPending },
    });
    writeFileSync(journalPath, "not valid json\n");
    expect(stageProjectGitPaths(mutationOptions(root), ["notes.txt"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.recoveryPending },
    });
    unlinkSync(journalPath);
    symlinkSync("missing-migration-journal.json", journalPath);
    expect(stageProjectGitPaths(mutationOptions(root), ["notes.txt"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.recoveryPending },
    });
    unlinkSync(journalPath);
    execFileSync("mkfifo", [journalPath]);
    expect(stageProjectGitPaths(mutationOptions(root), ["notes.txt"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.recoveryPending },
    });
  });

  it("reports conflicts read-only and refuses every unsafe mutation state before index changes", () => {
    const { root } = repository("refusals");
    git(root, "checkout", "-b", "other");
    writeFileSync(join(root, "scene.json"), readFileSync(join(root, "scene.json"), "utf8").replace("Contained", "Other"));
    git(root, "add", "scene.json");
    git(root, "commit", "-m", "other");
    git(root, "checkout", "main");
    writeFileSync(join(root, "scene.json"), readFileSync(join(root, "scene.json"), "utf8").replace("Contained", "Main"));
    git(root, "add", "scene.json");
    git(root, "commit", "-m", "main");
    expect(spawnSync("git", ["merge", "other"], { cwd: root }).status).not.toBe(0);

    expect(inspectProjectGit({ root })).toMatchObject({
      ok: true,
      state: { conflicts: ["scene.json"] },
    });
    expect(stageProjectGitPaths(mutationOptions(root), ["scene.json"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.mergeConflict },
    });
    git(root, "merge", "--abort");

    writeFileSync(join(root, "notes.txt"), "unchanged guard\n", "utf8");
    const before = git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all");
    expect(stageProjectGitPaths(
      { root } as Parameters<typeof stageProjectGitPaths>[0],
      ["notes.txt"],
    )).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.transactionDirty, path: "$authoring" },
    });
    const guarded = [
      { reviewStaged: true, recoveryPending: false, transactionDirty: false, code: PROJECT_GIT_DIAGNOSTICS.reviewStaged },
      { reviewStaged: false, recoveryPending: true, transactionDirty: false, code: PROJECT_GIT_DIAGNOSTICS.recoveryPending },
      { reviewStaged: false, recoveryPending: false, transactionDirty: true, code: PROJECT_GIT_DIAGNOSTICS.transactionDirty },
    ] as const;
    for (const state of guarded) {
      expect(stageProjectGitPaths({
        root,
        authoring: createProjectGitAuthoringAuthority(root, () => state),
      }, ["notes.txt"])).toMatchObject({
        ok: false,
        diagnostic: { code: state.code },
      });
      expect(git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all")).toBe(before);
    }

    git(root, "checkout", "--detach");
    expect(stageProjectGitPaths(mutationOptions(root), ["notes.txt"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.detachedWorktree },
    });
  });

  it("rejects a hand-built authoring authority", () => {
    const { root } = repository("forged-authority");
    writeFileSync(join(root, "notes.txt"), "not authorized\n");
    expect(stageProjectGitPaths({
      root,
      authoring: Object.freeze({}) as Parameters<typeof stageProjectGitPaths>[0]["authoring"],
    }, ["notes.txt"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.transactionDirty, path: "$authoring" },
    });
    expect(git(root, "diff", "--cached", "--name-only").trim()).toBe("");
  });

  it("reads authoring state live from one opaque authority", () => {
    const { root } = repository("live-authority");
    writeFileSync(join(root, "notes.txt"), "live state\n");
    let state = authoringReady;
    const authority = createProjectGitAuthoringAuthority(root, () => state);
    state = Object.freeze({ ...authoringReady, reviewStaged: true });
    expect(stageProjectGitPaths({ root, authoring: authority }, ["notes.txt"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.reviewStaged },
    });
    state = authoringReady;
    expect(stageProjectGitPaths({ root, authoring: authority }, ["notes.txt"])).toMatchObject({ ok: true });
  });

  it("binds authoring authority to its live session root", () => {
    const first = repository("authority-first");
    const second = repository("authority-second");
    writeFileSync(join(second.root, "notes.txt"), "wrong root\n");
    const authority = createProjectGitAuthoringAuthority(first.root, () => authoringReady);

    expect(stageProjectGitPaths({
      root: second.root,
      authoring: authority,
    }, ["notes.txt"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.transactionDirty, path: "$authoring" },
    });
    expect(git(second.root, "diff", "--cached", "--name-only").trim()).toBe("");
  });

  it("keeps checked lock ownership retryable until cleanup succeeds", () => {
    const { root } = repository("retryable-lock-release");
    const lockSet = acquireAtomicWriteLocks([join(root, ".sceneaxi-authoring-operation")]);
    const [artifact] = atomicWriteLockArtifactPaths(lockSet);
    expect(artifact).toBeDefined();
    if (artifact === undefined) return;
    const owner = readFileSync(artifact, "utf8");
    let released = false;
    try {
      writeFileSync(artifact, `${JSON.stringify({ token: "not-the-owner" })}\n`);
      expect(releaseAtomicWriteLocksChecked(lockSet)).toContain(artifact);
      writeFileSync(artifact, owner);
      expect(releaseAtomicWriteLocksChecked(lockSet)).toEqual([]);
      released = true;
      expect(existsSync(artifact)).toBe(false);
    } finally {
      if (!released) {
        writeFileSync(artifact, owner);
        releaseAtomicWriteLocksChecked(lockSet);
      }
    }
  });

  it("refuses missing Git, capability, Kids, path escape, and unsupported history operations by name", () => {
    const { root, manifest } = repository("host-refusals");
    expect(inspectProjectGit({ root, gitExecutable: "sceneaxi-git-does-not-exist" })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.missingGit },
    });
    expect(inspectProjectGit({ root, profile: "kids", gitExecutable: "sceneaxi-git-does-not-exist" })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.kidsDenied },
    });

    const outside = mkdtempSync(join(tmpdir(), "sceneaxi-project-git-outside-"));
    roots.push(outside);
    writeFileSync(join(outside, "secret.txt"), "outside\n");
    symlinkSync(outside, join(root, "escape"));
    expect(stageProjectGitPaths(mutationOptions(root), ["escape/secret.txt"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.pathEscape },
    });

    writeFileSync(join(root, PROJECT_MANIFEST_PATH), serializeProjectManifest({
      ...manifest,
      capabilities: manifest.capabilities.filter((grant) => grant.id !== "project.git.read"),
    }));
    expect(inspectProjectGit({ root })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.capabilityMissing },
    });

    for (const operation of ["push", "fetch", "credential", "history-rewrite", "branch-delete", "hook-bypass"] as const) {
      expect(refuseUnsupportedProjectGitOperation(operation)).toMatchObject({
        ok: false,
        diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.operationUnsupported },
      });
    }
  });
});
