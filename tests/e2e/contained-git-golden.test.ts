import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  serializeDocument,
  writeNativeProjectSeed,
} from "@sceneaxi/authoring-core";
import {
  createDocument,
  createEditorCommandInvocation,
  type EditorCommandClient,
  type JsonObject,
  type ProjectGitCommitPreparation,
} from "@sceneaxi/schemas";
import { createDesktopBridge } from "../../desktop/linux/src/index.ts";

const roots: string[] = [];
const clients = ["desktop-control", "cli", "local-agent"] as const satisfies readonly EditorCommandClient[];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function git(root: string, ...args: string[]) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function project() {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-contained-git-golden-"));
  roots.push(root);
  const document = createDocument({ id: "git-parity", title: "Before", data: { entities: [] } });
  const seeded = writeNativeProjectSeed({ root, document, documentBytes: serializeDocument(document) });
  if (!seeded.ok) throw new Error(seeded.diagnostic.message);
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "SceneAxi Test");
  git(root, "config", "user.email", "sceneaxi@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "-m", "seed");
  return root;
}

function command(
  bridge: ReturnType<typeof createDesktopBridge>,
  id: "project-git-status" | "project-git-diff" | "project-git-stage" | "project-git-commit-prepare",
  client: EditorCommandClient,
  input: JsonObject,
) {
  return bridge.handle({
    action: "command",
    payload: createEditorCommandInvocation(id, client, input, "web"),
  });
}

describe("contained Git client parity", () => {
  it("returns one repository state and commit-preparation evidence across desktop, CLI, and local-agent clients", () => {
    const root = project();
    writeFileSync(join(root, "scene.json"), readFileSync(join(root, "scene.json"), "utf8").replace("Before", "After"));
    writeFileSync(join(root, "notes.txt"), "unrelated and visible\n");
    const bridge = createDesktopBridge({ cwd: root });

    const initial = clients.map((client) => command(
      bridge,
      client === "cli" ? "project-git-diff" : "project-git-status",
      client,
      {},
    ));
    expect(initial[0]).toEqual(initial[1]);
    expect(initial[1]).toEqual(initial[2]);
    expect(initial[0]).toMatchObject({
      ok: true,
      data: {
        kind: "sceneaxi.project-git-state",
        canonicalChanges: [{ path: "scene.json" }],
        unrelatedChanges: [{ path: "notes.txt" }],
      },
    });

    const staged = command(bridge, "project-git-stage", "local-agent", { paths: ["scene.json"] });
    expect(staged).toMatchObject({ ok: true, data: { stagedDiff: expect.stringContaining("After") } });
    const prepared = command(bridge, "project-git-commit-prepare", "cli", {
      paths: ["scene.json"],
      message: "feat: save exact SceneAxi selection",
    });
    expect(prepared).toMatchObject({
      ok: true,
      data: {
        kind: "sceneaxi.project-git-commit-preparation",
        selectedPaths: ["scene.json"],
        commitCreated: false,
        hooksBypassed: false,
      },
    });
    const desktop = command(bridge, "project-git-status", "desktop-control", {});
    expect(desktop).toMatchObject({ ok: true });
    if (desktop.ok && prepared.ok) {
      expect((prepared.data as ProjectGitCommitPreparation).state).toEqual(desktop.data);
    }
  });
});
