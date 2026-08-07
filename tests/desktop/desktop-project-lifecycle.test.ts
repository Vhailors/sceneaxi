import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDocument, writeDocumentFile } from "@sceneaxi/authoring-core";
import {
  DESKTOP_PROJECT_REFUSALS,
  DESKTOP_RECENT_PROJECTS_FILE,
  createDesktopProjectHost,
  createDesktopProjectLifecycle,
} from "../../desktop/linux/src/index.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporaryRoot(label: string) {
  const root = mkdtempSync(join(tmpdir(), `sceneaxi-project-${label}-`));
  roots.push(root);
  return root;
}

function validProject(label: string, title: string) {
  const root = temporaryRoot(label);
  const written = writeDocumentFile(
    join(root, "scene.json"),
    createDocument({ id: label, title, data: { entities: [] } }),
    { cwd: root },
  );
  if (!written.ok) throw new Error(`could not create ${label}`);
  return root;
}

function statusOf(response: ReturnType<ReturnType<typeof createDesktopProjectLifecycle>["startup"]>) {
  if (!response.ok) throw new Error(`${response.reason}: ${response.message}`);
  return response.data.status;
}

describe("desktop contained project lifecycle", () => {
  it("starts without creating an implicit root and creates the starter only after New Project", () => {
    const state = temporaryRoot("state");
    const chosen = temporaryRoot("chosen");
    const lifecycle = createDesktopProjectLifecycle({ stateDirectory: state });

    const first = statusOf(lifecycle.startup());
    expect(first.active).toBeNull();
    expect(first.recents).toEqual([]);
    expect(first.recovery).toBeNull();
    expect(existsSync(join(chosen, "scene.json"))).toBe(false);
    expect(existsSync(join(state, DESKTOP_RECENT_PROJECTS_FILE))).toBe(false);

    const created = lifecycle.createProject(chosen);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.status.active).toMatchObject({
      root: resolve(chosen),
      documentPath: "scene.json",
      source: "new",
    });
    expect(existsSync(join(chosen, "scene.json"))).toBe(true);

    const bytes = readFileSync(join(chosen, "scene.json"), "utf8");
    const repeated = lifecycle.createProject(chosen);
    expect(repeated).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_REFUSALS.documentExists,
    });
    expect(readFileSync(join(chosen, "scene.json"), "utf8")).toBe(bytes);
  });

  it("refuses invalid roots and invalid existing documents before any lifecycle write", () => {
    const state = temporaryRoot("invalid-state");
    const invalid = temporaryRoot("invalid-document");
    const notDirectoryRoot = temporaryRoot("not-directory");
    const notDirectory = join(notDirectoryRoot, "project.txt");
    writeFileSync(notDirectory, "not a directory", "utf8");
    const invalidBytes = "{ definitely-not-json";
    writeFileSync(join(invalid, "scene.json"), invalidBytes, "utf8");
    const lifecycle = createDesktopProjectLifecycle({ stateDirectory: state });

    expect(lifecycle.openProject("relative/project")).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_REFUSALS.rootNotAbsolute,
    });
    expect(lifecycle.openProject(`${invalid}/../${basename(invalid)}`)).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_REFUSALS.rootTraversal,
    });
    expect(lifecycle.openProject(notDirectory)).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_REFUSALS.rootNotDirectory,
    });
    expect(lifecycle.openProject(join(invalid, "missing"))).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_REFUSALS.rootMissing,
    });
    expect(lifecycle.createProject(invalid)).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_REFUSALS.documentInvalid,
    });
    expect(readFileSync(join(invalid, "scene.json"), "utf8")).toBe(invalidBytes);
    expect(existsSync(join(state, DESKTOP_RECENT_PROJECTS_FILE))).toBe(false);
  });

  it("canonicalizes selected roots and refuses a scene.json symlink escape", () => {
    const state = temporaryRoot("symlink-state");
    const outside = validProject("outside", "Outside");
    const selected = temporaryRoot("symlink-selected");
    symlinkSync(join(outside, "scene.json"), join(selected, "scene.json"), "file");
    const aliasParent = temporaryRoot("alias-parent");
    const alias = join(aliasParent, "project-link");
    symlinkSync(outside, alias, "dir");
    const lifecycle = createDesktopProjectLifecycle({ stateDirectory: state });

    expect(lifecycle.openProject(selected)).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_REFUSALS.documentEscape,
    });
    const opened = lifecycle.openProject(alias);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.data.status.active?.root).toBe(resolve(outside));
    expect(readFileSync(join(state, DESKTOP_RECENT_PROJECTS_FILE), "utf8")).not.toContain(
      alias,
    );
  });

  it("migrates recents atomically, omits missing entries, removes entries, and restores the last valid root", () => {
    const state = temporaryRoot("migration-state");
    const first = validProject("first", "First project");
    const second = validProject("second", "Second project");
    const missing = join(state, "missing-project");
    const stateFile = join(state, DESKTOP_RECENT_PROJECTS_FILE);
    writeFileSync(
      stateFile,
      JSON.stringify({
        schemaVersion: 0,
        lastProject: second,
        recentProjects: [missing, first, second],
      }),
      "utf8",
    );

    const lifecycle = createDesktopProjectLifecycle({ stateDirectory: state });
    const started = statusOf(lifecycle.startup());
    expect(started.active).toMatchObject({
      name: "Second project",
      root: resolve(second),
      source: "restored",
    });
    expect(started.recents.map((entry) => entry.root)).toEqual([
      resolve(first),
      resolve(second),
    ]);
    const persisted = JSON.parse(readFileSync(stateFile, "utf8")) as {
      schemaVersion: number;
      roots: string[];
    };
    expect(persisted).toEqual({
      schemaVersion: 1,
      lastRoot: resolve(second),
      roots: [resolve(first), resolve(second)],
    });
    expect(readdirSync(state).filter((name) => name.includes(".tmp-"))).toEqual([]);

    const removed = lifecycle.removeRecent(first);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.data.status.recents.map((entry) => entry.root)).toEqual([
      resolve(second),
    ]);

    const restarted = createDesktopProjectLifecycle({ stateDirectory: state });
    expect(statusOf(restarted.startup()).active?.root).toBe(resolve(second));
  });

  it("returns a named recovery choice after restart and leaves invalid project bytes untouched", () => {
    const state = temporaryRoot("recovery-state");
    const project = validProject("recovery-project", "Recovery project");
    const lifecycle = createDesktopProjectLifecycle({ stateDirectory: state });
    expect(lifecycle.openProject(project).ok).toBe(true);
    const invalidBytes = "not-json-after-open";
    writeFileSync(join(project, "scene.json"), invalidBytes, "utf8");

    const restarted = createDesktopProjectLifecycle({ stateDirectory: state });
    const status = statusOf(restarted.startup());
    expect(status.active).toBeNull();
    expect(status.recents).toEqual([]);
    expect(status.recovery).toEqual({
      reason: DESKTOP_PROJECT_REFUSALS.documentInvalid,
      root: resolve(project),
      choices: ["new", "open"],
    });
    expect(readFileSync(join(project, "scene.json"), "utf8")).toBe(invalidBytes);
    const repeated = createDesktopProjectLifecycle({ stateDirectory: state });
    expect(statusOf(repeated.startup()).recovery?.reason).toBe(
      DESKTOP_PROJECT_REFUSALS.documentInvalid,
    );
  });

  it("leaves invalid recent-state bytes untouched and refuses a project write", () => {
    const state = temporaryRoot("invalid-recent-state");
    const chosen = temporaryRoot("invalid-recent-chosen");
    const stateFile = join(state, DESKTOP_RECENT_PROJECTS_FILE);
    const invalidState = "not-json-recent-state";
    writeFileSync(stateFile, invalidState, "utf8");
    const lifecycle = createDesktopProjectLifecycle({ stateDirectory: state });

    const started = statusOf(lifecycle.startup());
    expect(started.recovery?.reason).toBe(DESKTOP_PROJECT_REFUSALS.stateInvalid);
    expect(lifecycle.createProject(chosen)).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_REFUSALS.stateInvalid,
    });
    expect(readFileSync(stateFile, "utf8")).toBe(invalidState);
    expect(existsSync(join(chosen, "scene.json"))).toBe(false);
  });
});

describe("desktop project dialog host", () => {
  it("keeps cancel non-mutating and activates create/open through typed responses", async () => {
    const state = temporaryRoot("host-state");
    const created = temporaryRoot("host-created");
    const opened = validProject("host-opened", "Opened project");
    const choices: Array<string | null> = [null, created, opened];
    const activated: string[] = [];
    const lifecycle = createDesktopProjectLifecycle({ stateDirectory: state });
    const host = createDesktopProjectHost({
      lifecycle,
      dialogs: {
        async chooseNewProjectRoot() {
          return choices.shift() ?? null;
        },
        async chooseOpenProjectRoot() {
          return choices.shift() ?? null;
        },
      },
      activate(root) {
        activated.push(root);
      },
    });

    const kids = await host.handle({ action: "choose-new", profile: "kids" });
    expect(kids).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_REFUSALS.kidsDenied,
    });
    expect(choices).toEqual([null, created, opened]);

    const cancelled = await host.handle({ action: "choose-new", profile: "game" });
    expect(cancelled).toMatchObject({ ok: true, data: { outcome: "cancelled" } });
    expect(activated).toEqual([]);
    expect(existsSync(join(created, "scene.json"))).toBe(false);

    const newProject = await host.handle({ action: "choose-new", profile: "game" });
    expect(newProject).toMatchObject({ ok: true, data: { outcome: "ready" } });
    expect(activated).toEqual([resolve(created)]);

    const openProject = await host.handle({ action: "choose-open", profile: "web" });
    expect(openProject).toMatchObject({ ok: true, data: { outcome: "ready" } });
    expect(activated).toEqual([resolve(created), resolve(opened)]);

    expect(await host.handle({ action: "open-recent", profile: "game", root: "/not-approved" })).toMatchObject({
      ok: false,
      reason: DESKTOP_PROJECT_REFUSALS.recentUnknown,
    });
  });
});
