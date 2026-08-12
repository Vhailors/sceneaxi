import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  inspectProjectGit,
  prepareProjectGitCommit,
  refuseUnsupportedProjectGitOperation,
  serializeDocument,
  stageProjectGitPaths,
  writeNativeProjectSeed,
} from "@sceneaxi/authoring-core";
import {
  PROJECT_GIT_DIAGNOSTICS,
  PROJECT_MANIFEST_PATH,
  createDocument,
  serializeProjectManifest,
} from "@sceneaxi/schemas";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(root: string, ...args: string[]) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function repository(label: string) {
  const root = mkdtempSync(join(tmpdir(), `sceneaxi-project-git-${label}-`));
  roots.push(root);
  const document = createDocument({ id: "contained-world", title: "Contained", data: { value: 1 } });
  const seeded = writeNativeProjectSeed({
    root,
    document,
    documentBytes: serializeDocument(document),
  });
  if (!seeded.ok) throw new Error(seeded.diagnostic.message);
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "SceneAxi Test");
  git(root, "config", "user.email", "sceneaxi@example.invalid");
  git(root, "add", "--", "scene.json", PROJECT_MANIFEST_PATH);
  git(root, "commit", "-m", "seed");
  return { root, manifest: seeded.manifest };
}

describe("contained project Git service", () => {
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

    const staged = stageProjectGitPaths({ root }, ["scene.json"]);
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

    const prepared = prepareProjectGitCommit({ root }, ["scene.json"], "feat: save contained change");
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
    expect(prepareProjectGitCommit({ root }, ["scene.json", "notes.txt"], "mismatch")).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.selectionMismatch },
    });
    expect(prepareProjectGitCommit({ root }, ["scene.json"], "   ")).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.commitMessageInvalid },
    });

    writeFileSync(join(root, ":(top)**"), "literal pathspec name\n");
    expect(stageProjectGitPaths({ root }, [":(top)**"])).toMatchObject({ ok: true });
    expect(git(root, "diff", "--cached", "--name-only").trim().split("\n").sort()).toEqual([
      ":(top)**",
      "scene.json",
    ]);
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
    expect(stageProjectGitPaths({ root }, ["scene.json"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.mergeConflict },
    });
    git(root, "merge", "--abort");

    writeFileSync(join(root, "notes.txt"), "unchanged guard\n", "utf8");
    const before = git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all");
    const guarded = [
      { reviewStaged: true, recoveryPending: false, transactionDirty: false, code: PROJECT_GIT_DIAGNOSTICS.reviewStaged },
      { reviewStaged: false, recoveryPending: true, transactionDirty: false, code: PROJECT_GIT_DIAGNOSTICS.recoveryPending },
      { reviewStaged: false, recoveryPending: false, transactionDirty: true, code: PROJECT_GIT_DIAGNOSTICS.transactionDirty },
    ] as const;
    for (const state of guarded) {
      expect(stageProjectGitPaths({ root, authoring: state }, ["notes.txt"])).toMatchObject({
        ok: false,
        diagnostic: { code: state.code },
      });
      expect(git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all")).toBe(before);
    }

    git(root, "checkout", "--detach");
    expect(stageProjectGitPaths({ root }, ["notes.txt"])).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.detachedWorktree },
    });
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
    expect(stageProjectGitPaths({ root }, ["escape/secret.txt"])).toMatchObject({
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

    for (const operation of ["push", "fetch", "history-rewrite", "branch-delete"] as const) {
      expect(refuseUnsupportedProjectGitOperation(operation)).toMatchObject({
        ok: false,
        diagnostic: { code: PROJECT_GIT_DIAGNOSTICS.operationUnsupported },
      });
    }
  });
});
