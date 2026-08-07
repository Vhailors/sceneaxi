import {
  constants,
  accessSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  fsyncSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { parseDocumentText } from "@sceneaxi/authoring-core";
import { DESKTOP_ACTIVE_DOCUMENT_PATH } from "./bridge-contract.js";
import {
  DESKTOP_PROJECT_REFUSALS,
  DESKTOP_PROJECT_STATE_SCHEMA_VERSION,
  projectRefuse,
  type DesktopProjectRefusalReason,
  type DesktopProjectResponse,
  type DesktopProjectSource,
  type DesktopProjectStatus,
  type DesktopProjectSummary,
} from "./project-lifecycle-contract.js";
import { seedDesktopProject } from "./project-seed.js";

const RECENT_PROJECTS_FILE = "recent-projects.json";
const MAX_RECENT_PROJECTS = 12;
const RECOVERY_CHOICES = Object.freeze(["new", "open"] as const);

type StoredStateV1 = Readonly<{
  schemaVersion: 1;
  lastRoot: string | null;
  roots: readonly string[];
}>;

type ValidProject = Readonly<{
  root: string;
  name: string;
}>;

type ProjectValidation =
  | Readonly<{ ok: true; project: ValidProject }>
  | Readonly<{
      ok: false;
      reason: DesktopProjectRefusalReason;
      message: string;
      root: string | null;
    }>;

export type DesktopProjectLifecycleOptions = Readonly<{
  stateDirectory: string;
}>;

export type DesktopProjectLifecycle = Readonly<{
  startup(): DesktopProjectResponse;
  status(): DesktopProjectResponse;
  createProject(root: string): DesktopProjectResponse;
  openProject(root: string, source?: "opened" | "recent"): DesktopProjectResponse;
  openRecent(root: string): DesktopProjectResponse;
  removeRecent(root: string): DesktopProjectResponse;
}>;

function own(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function refusal(
  reason: DesktopProjectRefusalReason,
  message: string,
  root: string | null = null,
): ProjectValidation {
  return Object.freeze({ ok: false as const, reason, message, root });
}

function hasTraversal(path: string): boolean {
  return path.split(/[\\/]+/).includes("..");
}

function canonicalRoot(selected: string, writable: boolean): ProjectValidation {
  if (!isAbsolute(selected)) {
    return refusal(
      DESKTOP_PROJECT_REFUSALS.rootNotAbsolute,
      "A project root must be an absolute path selected by the desktop host.",
      selected,
    );
  }
  if (selected.includes("\0") || hasTraversal(selected)) {
    return refusal(
      DESKTOP_PROJECT_REFUSALS.rootTraversal,
      "A project root may not contain a null byte or '..' traversal segment.",
      selected,
    );
  }
  if (!existsSync(selected)) {
    return refusal(
      DESKTOP_PROJECT_REFUSALS.rootMissing,
      "The selected project root does not exist.",
      selected,
    );
  }
  try {
    if (!statSync(selected).isDirectory()) {
      return refusal(
        DESKTOP_PROJECT_REFUSALS.rootNotDirectory,
        "The selected project root is not a directory.",
        selected,
      );
    }
    accessSync(
      selected,
      constants.R_OK | constants.X_OK | (writable ? constants.W_OK : 0),
    );
    const root = realpathSync(selected);
    return Object.freeze({
      ok: true as const,
      project: Object.freeze({ root, name: basename(root) || root }),
    });
  } catch {
    return refusal(
      DESKTOP_PROJECT_REFUSALS.rootInaccessible,
      "The selected project root cannot be accessed with the required permissions.",
      selected,
    );
  }
}

function validateProject(selected: string): ProjectValidation {
  const root = canonicalRoot(selected, false);
  if (!root.ok) return root;
  const documentFile = join(root.project.root, DESKTOP_ACTIVE_DOCUMENT_PATH);
  if (!existsSync(documentFile)) {
    return refusal(
      DESKTOP_PROJECT_REFUSALS.documentMissing,
      `The selected root has no ${DESKTOP_ACTIVE_DOCUMENT_PATH}.`,
      root.project.root,
    );
  }
  try {
    const canonicalDocument = realpathSync(documentFile);
    if (dirname(canonicalDocument) !== root.project.root) {
      return refusal(
        DESKTOP_PROJECT_REFUSALS.documentEscape,
        `${DESKTOP_ACTIVE_DOCUMENT_PATH} resolves outside the selected project root.`,
        root.project.root,
      );
    }
    if (!lstatSync(documentFile).isFile()) {
      return refusal(
        DESKTOP_PROJECT_REFUSALS.documentInvalid,
        `${DESKTOP_ACTIVE_DOCUMENT_PATH} is not a regular project document.`,
        root.project.root,
      );
    }
    const parsed = parseDocumentText(readFileSync(canonicalDocument, "utf8"));
    if (!parsed.ok) {
      return refusal(
        DESKTOP_PROJECT_REFUSALS.documentInvalid,
        `${DESKTOP_ACTIVE_DOCUMENT_PATH} is invalid: ${parsed.message}`,
        root.project.root,
      );
    }
    const title = parsed.document.title?.trim();
    return Object.freeze({
      ok: true as const,
      project: Object.freeze({
        root: root.project.root,
        name: title === undefined || title.length === 0 ? root.project.name : title,
      }),
    });
  } catch {
    return refusal(
      DESKTOP_PROJECT_REFUSALS.rootInaccessible,
      `The active ${DESKTOP_ACTIVE_DOCUMENT_PATH} cannot be read.`,
      root.project.root,
    );
  }
}

function storedState(value: unknown): { state: StoredStateV1; migrated: boolean } | null {
  const schemaVersion = own(value, "schemaVersion");
  const lastRoot = own(value, schemaVersion === 0 ? "lastProject" : "lastRoot");
  const roots = own(value, schemaVersion === 0 ? "recentProjects" : "roots");
  if (
    (schemaVersion !== 0 && schemaVersion !== DESKTOP_PROJECT_STATE_SCHEMA_VERSION) ||
    (lastRoot !== null && typeof lastRoot !== "string") ||
    !Array.isArray(roots) ||
    !roots.every((root) => typeof root === "string")
  ) {
    return null;
  }
  return {
    state: Object.freeze({
      schemaVersion: DESKTOP_PROJECT_STATE_SCHEMA_VERSION,
      lastRoot,
      roots: Object.freeze([...new Set(roots)]),
    }),
    migrated: schemaVersion === 0,
  };
}

function summary(project: ValidProject, source: DesktopProjectSource): DesktopProjectSummary {
  return Object.freeze({
    name: project.name,
    root: project.root,
    documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    source,
  });
}

export function createDesktopProjectLifecycle(
  options: DesktopProjectLifecycleOptions,
): DesktopProjectLifecycle {
  const stateFile = join(options.stateDirectory, RECENT_PROJECTS_FILE);
  let initialized = false;
  let stateReadable = true;
  let active: DesktopProjectSummary | null = null;
  let roots: string[] = [];
  let recovery: DesktopProjectStatus["recovery"] = null;
  let writeSequence = 0;

  const statusValue = (): DesktopProjectStatus => {
    const recents = roots.flatMap((root) => {
      const checked = validateProject(root);
      return checked.ok ? [summary(checked.project, "recent")] : [];
    });
    return Object.freeze({
      schemaVersion: DESKTOP_PROJECT_STATE_SCHEMA_VERSION,
      active,
      recents: Object.freeze(recents),
      recovery,
    });
  };

  const ok = (
    outcome: "ready" | "removed",
  ): DesktopProjectResponse => Object.freeze({
    ok: true as const,
    action: "project" as const,
    data: Object.freeze({ outcome, status: statusValue() }),
  });

  const persist = (lastRoot: string | null): DesktopProjectResponse | null => {
    if (!stateReadable) {
      return projectRefuse(
        DESKTOP_PROJECT_REFUSALS.stateInvalid,
        "The recent-project state is invalid and was left byte-identical.",
      );
    }
    const bytes = `${JSON.stringify({
      schemaVersion: DESKTOP_PROJECT_STATE_SCHEMA_VERSION,
      lastRoot,
      roots,
    })}\n`;
    const temporary = `${stateFile}.tmp-${process.pid}-${writeSequence++}`;
    let descriptor: number | null = null;
    try {
      mkdirSync(options.stateDirectory, { recursive: true });
      descriptor = openSync(temporary, "wx", 0o600);
      writeFileSync(descriptor, bytes, "utf8");
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = null;
      renameSync(temporary, stateFile);
      return null;
    } catch (error) {
      if (descriptor !== null) closeSync(descriptor);
      if (existsSync(temporary)) unlinkSync(temporary);
      return projectRefuse(
        DESKTOP_PROJECT_REFUSALS.stateWriteFailed,
        "The recent-project state could not be persisted atomically.",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const initialize = (): DesktopProjectResponse | null => {
    if (initialized) return null;
    initialized = true;
    if (!existsSync(stateFile)) return null;
    let decoded: unknown;
    try {
      decoded = JSON.parse(readFileSync(stateFile, "utf8"));
    } catch {
      stateReadable = false;
      recovery = Object.freeze({
        reason: DESKTOP_PROJECT_REFUSALS.stateInvalid,
        root: null,
        choices: RECOVERY_CHOICES,
      });
      return null;
    }
    const parsed = storedState(decoded);
    if (parsed === null) {
      stateReadable = false;
      recovery = Object.freeze({
        reason: DESKTOP_PROJECT_REFUSALS.stateInvalid,
        root: null,
        choices: RECOVERY_CHOICES,
      });
      return null;
    }

    const validRoots: string[] = [];
    for (const candidate of parsed.state.roots) {
      const checked = validateProject(candidate);
      if (checked.ok && !validRoots.includes(checked.project.root)) {
        validRoots.push(checked.project.root);
      }
    }
    roots = validRoots.slice(0, MAX_RECENT_PROJECTS);

    if (parsed.state.lastRoot !== null) {
      const last = validateProject(parsed.state.lastRoot);
      if (last.ok) {
        active = summary(last.project, "restored");
        if (!roots.includes(last.project.root)) roots.unshift(last.project.root);
      } else {
        recovery = Object.freeze({
          reason: last.reason,
          root: last.root,
          choices: RECOVERY_CHOICES,
        });
      }
    }

    if (
      parsed.migrated ||
      roots.length !== parsed.state.roots.length ||
      roots.some((root, index) => root !== parsed.state.roots[index])
    ) {
      return persist(active?.root ?? parsed.state.lastRoot);
    }
    return null;
  };

  const remember = (
    project: ValidProject,
    source: DesktopProjectSource,
  ): DesktopProjectResponse => {
    const previousRoots = roots;
    roots = [project.root, ...roots.filter((root) => root !== project.root)].slice(
      0,
      MAX_RECENT_PROJECTS,
    );
    const written = persist(project.root);
    if (written !== null) {
      roots = previousRoots;
      return written;
    }
    active = summary(project, source);
    recovery = null;
    return ok("ready");
  };

  const refuseValidation = (checked: Extract<ProjectValidation, { ok: false }>) =>
    projectRefuse(checked.reason, checked.message, checked.root);

  const startup = (): DesktopProjectResponse => {
    const failure = initialize();
    return failure ?? ok("ready");
  };

  const openProject = (
    selected: string,
    source: "opened" | "recent" = "opened",
  ): DesktopProjectResponse => {
    const failure = initialize();
    if (failure !== null) return failure;
    if (!stateReadable) {
      return projectRefuse(
        DESKTOP_PROJECT_REFUSALS.stateInvalid,
        "The recent-project state is invalid and was left byte-identical.",
      );
    }
    const checked = validateProject(selected);
    if (!checked.ok) return refuseValidation(checked);
    return remember(checked.project, source);
  };

  return Object.freeze({
    startup,
    status: startup,
    createProject(selected: string): DesktopProjectResponse {
      const failure = initialize();
      if (failure !== null) return failure;
      if (!stateReadable) {
        return projectRefuse(
          DESKTOP_PROJECT_REFUSALS.stateInvalid,
          "The recent-project state is invalid and was left byte-identical.",
        );
      }
      const root = canonicalRoot(selected, true);
      if (!root.ok) return refuseValidation(root);
      const documentFile = join(root.project.root, DESKTOP_ACTIVE_DOCUMENT_PATH);
      if (existsSync(documentFile)) {
        const existing = validateProject(root.project.root);
        if (!existing.ok) return refuseValidation(existing);
        return projectRefuse(
          DESKTOP_PROJECT_REFUSALS.documentExists,
          `New Project refuses to replace the existing ${DESKTOP_ACTIVE_DOCUMENT_PATH}.`,
          root.project.root,
        );
      }
      const seeded = seedDesktopProject(root.project.root);
      if (!seeded.ok) {
        return projectRefuse(
          DESKTOP_PROJECT_REFUSALS.documentInvalid,
          seeded.message,
          root.project.root,
        );
      }
      const created = validateProject(root.project.root);
      if (!created.ok) return refuseValidation(created);
      return remember(created.project, "new");
    },
    openProject,
    openRecent(selected: string): DesktopProjectResponse {
      const failure = initialize();
      if (failure !== null) return failure;
      if (!stateReadable) {
        return projectRefuse(
          DESKTOP_PROJECT_REFUSALS.stateInvalid,
          "The recent-project state is invalid and was left byte-identical.",
        );
      }
      if (!roots.includes(selected)) {
        return projectRefuse(
          DESKTOP_PROJECT_REFUSALS.recentUnknown,
          "The requested root is not in the validated recent-project registry.",
          selected,
        );
      }
      return openProject(selected, "recent");
    },
    removeRecent(selected: string): DesktopProjectResponse {
      const failure = initialize();
      if (failure !== null) return failure;
      if (!stateReadable) {
        return projectRefuse(
          DESKTOP_PROJECT_REFUSALS.stateInvalid,
          "The recent-project state is invalid and was left byte-identical.",
        );
      }
      if (!roots.includes(selected)) {
        return projectRefuse(
          DESKTOP_PROJECT_REFUSALS.recentUnknown,
          "The requested root is not in the validated recent-project registry.",
          selected,
        );
      }
      const previousRoots = roots;
      roots = roots.filter((root) => root !== selected);
      const written = persist(active?.root === selected ? null : (active?.root ?? null));
      if (written !== null) {
        roots = previousRoots;
        return written;
      }
      return ok("removed");
    },
  });
}

export const DESKTOP_RECENT_PROJECTS_FILE = RECENT_PROJECTS_FILE;
