/**
 * Desktop authoring session — propose → review → accept/reject, plus status and
 * undo. Phases mirror the web-shell inspector exactly so the two surfaces stay
 * interchangeable faces of one protocol, not two editors.
 *
 * All state transitions route through `@sceneaxi/authoring-core`. There is no
 * second authoring implementation here, no CLI spawn (matrix-denied), and no
 * engine import.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canonicalPath,
  contentHash,
  applyRedoAvailability,
  applyUndoAvailability,
  parseDocumentText,
  redoLastApply,
  resolveApplyTransaction,
  undoLastApply,
  type ApplyUndoAvailability,
  type ApplyDiagnostic,
  type Proposal,
} from "@sceneaxi/authoring-core";
import {
  acquireProjectGitDesktopOwner,
  createProjectGitAuthoringAuthority,
  prepareProjectGitCommit,
  releaseProjectGitDesktopOwner,
  stageProjectGitPaths,
  type ProjectGitAuthoringAuthority,
  type ProjectGitAuthoringState,
  type ProjectGitDesktopOwner,
} from "@sceneaxi-internal/project-git-authority";
import {
  PROJECT_GIT_DIAGNOSTICS,
  type ProjectGitCommitPreparationResult,
  type ProjectGitFailure,
  type ProjectGitStateResult,
} from "@sceneaxi/schemas";
import {
  shellApply,
  shellPropose,
  type ShellEditInput,
} from "./protocol-client.js";

export type DesktopPhase =
  | "idle"
  | "reviewing"
  | "applied"
  | "pending"
  | "rejected";

export type DesktopSnapshot = {
  readonly phase: DesktopPhase;
  readonly unifiedDiff: string | null;
  readonly renderedDiff: string | null;
  readonly proposal: Proposal | null;
  readonly appliedPaths: readonly string[] | null;
  readonly journalRecoveryPending: boolean;
  readonly transactionId: string | null;
  readonly diagnostics: readonly ApplyDiagnostic[] | null;
};

export type DesktopDocumentStatus =
  | {
      readonly ok: true;
      readonly documentPath: string;
      readonly documentId: string;
      readonly contentHash: string;
      readonly contentByteLength: number;
      readonly dataKeys: readonly string[];
      readonly undoAvailability: ApplyUndoAvailability;
      readonly redoAvailability: ApplyUndoAvailability;
      /** Validated document data for project-loop proposals; never executable. */
      readonly data: Readonly<Record<string, unknown>>;
    }
  | {
      readonly ok: false;
      readonly documentPath: string;
      readonly diagnostics: readonly ApplyDiagnostic[];
    };

export type DesktopUndoResult =
  | { readonly ok: true; readonly transactionId: string; readonly restoredPaths: readonly string[] }
  | { readonly ok: false; readonly diagnostics: readonly ApplyDiagnostic[] };

export type DesktopRedoResult = DesktopUndoResult;

export type DesktopSession = {
  /** Current review surface (diff, phase, diagnostics). */
  snapshot(): DesktopSnapshot;
  /** Propose an edit and park it for review (does not write documents). */
  proposeEdit(input: ShellEditInput): DesktopSnapshot;
  /** Accept the pending proposal (apply via authoring-core). */
  accept(): DesktopSnapshot;
  /** Discard the pending proposal without writing. */
  reject(): DesktopSnapshot;
  /** Resolve a pending durable transaction. */
  refreshRecovery(): DesktopSnapshot;
  /** Read-only report on a document under this session's working directory. */
  status(documentPath: string): DesktopDocumentStatus;
  /** Undo the last completed apply. */
  undo(): DesktopUndoResult;
  /** Redo the next durable entry without discarding a staged proposal. */
  redo(): DesktopRedoResult;
};

export type DesktopSessionOperations = {
  readonly applyProposal: typeof shellApply;
  readonly applyUndoAvailability: typeof applyUndoAvailability;
  readonly applyRedoAvailability: typeof applyRedoAvailability;
  readonly resolveTransaction: typeof resolveApplyTransaction;
  readonly undoLastApply: typeof undoLastApply;
  readonly redoLastApply: typeof redoLastApply;
};

export type DesktopSessionOptions = {
  readonly cwd?: string;
  readonly operations?: Partial<DesktopSessionOperations>;
};

type DesktopProjectGitProfile = "game" | "web" | "kids";
type RootProjectGitAuthority = {
  readonly root: string;
  readonly authority: ProjectGitAuthoringAuthority;
  readonly owner: ProjectGitDesktopOwner;
  readonly sessions: Set<WeakRef<DesktopSession>>;
};
type DesktopProjectGitBinding = Readonly<{
  rootAuthority: RootProjectGitAuthority;
  readProfile: () => DesktopProjectGitProfile;
  sessionRef: WeakRef<DesktopSession>;
}>;

const projectGitBindings = new WeakMap<object, DesktopProjectGitBinding>();
const rootProjectGitAuthorities = new Map<string, RootProjectGitAuthority>();

export class DesktopProjectMutationOwnerError extends Error {
  readonly diagnostic: ProjectGitFailure["diagnostic"];

  constructor(diagnostic: ProjectGitFailure["diagnostic"]) {
    super(diagnostic.message);
    this.name = "DesktopProjectMutationOwnerError";
    this.diagnostic = diagnostic;
  }
}

function liveRootBindings(rootAuthority: RootProjectGitAuthority): readonly DesktopProjectGitBinding[] {
  const live: DesktopProjectGitBinding[] = [];
  for (const sessionRef of rootAuthority.sessions) {
    const session = sessionRef.deref();
    if (session === undefined) {
      rootAuthority.sessions.delete(sessionRef);
      continue;
    }
    const binding = projectGitBindings.get(session);
    if (binding?.rootAuthority === rootAuthority) live.push(binding);
  }
  return live;
}

function aggregateProjectGitState(rootAuthority: RootProjectGitAuthority): ProjectGitAuthoringState {
  let reviewStaged = false;
  let recoveryPending = false;
  let transactionDirty = false;
  const profiles = new Set<DesktopProjectGitProfile>();
  for (const binding of liveRootBindings(rootAuthority)) {
    const session = binding.sessionRef.deref();
    if (session === undefined) continue;
    const current = session.snapshot();
    reviewStaged ||= current.phase === "reviewing" && current.proposal !== null;
    recoveryPending ||= current.journalRecoveryPending;
    transactionDirty ||= current.phase === "pending";
    try {
      profiles.add(binding.readProfile());
    } catch {
      transactionDirty = true;
    }
  }
  transactionDirty ||= profiles.size > 1 && !profiles.has("kids");
  return Object.freeze({ reviewStaged, recoveryPending, transactionDirty });
}

function aggregateProjectGitProfile(
  rootAuthority: RootProjectGitAuthority,
): DesktopProjectGitProfile | undefined {
  const profiles = new Set<DesktopProjectGitProfile>();
  try {
    for (const binding of liveRootBindings(rootAuthority)) profiles.add(binding.readProfile());
  } catch {
    return undefined;
  }
  if (profiles.has("kids")) return "kids";
  return profiles.size === 1 ? [...profiles][0] : undefined;
}

function rootProjectGitAuthority(root: string): RootProjectGitAuthority {
  const canonicalRoot = canonicalPath(root);
  const existing = rootProjectGitAuthorities.get(canonicalRoot);
  if (existing !== undefined) return existing;
  const owner = acquireProjectGitDesktopOwner(canonicalRoot);
  if ("diagnostic" in owner) throw new DesktopProjectMutationOwnerError(owner.diagnostic);
  const sessions = new Set<WeakRef<DesktopSession>>();
  let rootAuthority: RootProjectGitAuthority;
  const authority = createProjectGitAuthoringAuthority(
    canonicalRoot,
    () => aggregateProjectGitState(rootAuthority),
  );
  rootAuthority = { root: canonicalRoot, authority, owner, sessions };
  rootProjectGitAuthorities.set(canonicalRoot, rootAuthority);
  return rootAuthority;
}

export function bindDesktopSessionProjectGitAuthority(
  session: DesktopSession,
  root: string,
  readProfile: () => DesktopProjectGitProfile,
): void {
  if (!releaseDesktopSessionProjectGitAuthority(session)) {
    throw new DesktopProjectMutationOwnerError(Object.freeze({
      code: PROJECT_GIT_DIAGNOSTICS.transactionDirty,
      path: ".sceneaxi-desktop-mutation-owner",
      message: "The previous desktop mutation-owner lease could not be released cleanly.",
    }));
  }
  const rootAuthority = rootProjectGitAuthority(root);
  const sessionRef = new WeakRef(session);
  rootAuthority.sessions.add(sessionRef);
  projectGitBindings.set(session, Object.freeze({ rootAuthority, readProfile, sessionRef }));
}

export function releaseDesktopSessionProjectGitAuthority(session: DesktopSession): boolean {
  const binding = projectGitBindings.get(session);
  if (binding === undefined) return true;
  if (liveRootBindings(binding.rootAuthority).length === 1) {
    if (!releaseProjectGitDesktopOwner(binding.rootAuthority.owner)) return false;
    rootProjectGitAuthorities.delete(binding.rootAuthority.root);
  }
  binding.rootAuthority.sessions.delete(binding.sessionRef);
  projectGitBindings.delete(session);
  return true;
}

function desktopSessionProjectGitBinding(
  session: DesktopSession,
): DesktopProjectGitBinding | undefined {
  return projectGitBindings.get(session);
}

function unavailableProjectGitAuthority() {
  return Object.freeze({
    ok: false as const,
    diagnostic: Object.freeze({
      code: PROJECT_GIT_DIAGNOSTICS.transactionDirty,
      path: "$authoring",
      message: "Authoritative SceneAxi review and recovery state is unavailable.",
    }),
  });
}

export function stageDesktopSessionProjectGitPaths(
  session: DesktopSession,
  paths: readonly string[],
): ProjectGitStateResult {
  const binding = desktopSessionProjectGitBinding(session);
  if (binding === undefined) return unavailableProjectGitAuthority();
  const profile = aggregateProjectGitProfile(binding.rootAuthority);
  if (profile === undefined) return unavailableProjectGitAuthority();
  return stageProjectGitPaths({
    root: binding.rootAuthority.root,
    profile,
    authoring: binding.rootAuthority.authority,
  }, paths);
}

export function prepareDesktopSessionProjectGitCommit(
  session: DesktopSession,
  paths: readonly string[],
  message: string,
): ProjectGitCommitPreparationResult {
  const binding = desktopSessionProjectGitBinding(session);
  if (binding === undefined) return unavailableProjectGitAuthority();
  const profile = aggregateProjectGitProfile(binding.rootAuthority);
  if (profile === undefined) return unavailableProjectGitAuthority();
  return prepareProjectGitCommit({
    root: binding.rootAuthority.root,
    profile,
    authoring: binding.rootAuthority.authority,
  }, paths, message);
}

/**
 * Freeze a validated JSON value all the way down.
 *
 * `Object.freeze` alone leaves nested objects writable, so a `Readonly<...>`
 * return would over-promise to an in-process caller — the Electron IPC boundary
 * structured-clones, but the CLI and the goldens hold the very same object.
 */
function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

const PENDING_DIAGNOSTICS: readonly ApplyDiagnostic[] = Object.freeze([
  Object.freeze({
    code: "apply-in-progress" as const,
    message: "The apply outcome is pending journal recovery.",
    reReadHint: "Resolve recovery before another session action.",
  }),
]);

const ACTIVE_PROPOSAL_DIAGNOSTICS: readonly ApplyDiagnostic[] = Object.freeze([
  Object.freeze({
    code: "invalid-proposal" as const,
    message: "One proposal is already waiting for review; accept or reject it before staging another.",
  }),
]);

/** Create a single-proposal desktop session bound to a working directory. */
export function createDesktopSession(
  options: DesktopSessionOptions = {},
): DesktopSession {
  const sessionCwd = canonicalPath(options.cwd ?? ".");
  const operations: DesktopSessionOperations = Object.freeze({
    applyProposal: options.operations?.applyProposal ?? shellApply,
    applyUndoAvailability:
      options.operations?.applyUndoAvailability ?? applyUndoAvailability,
    applyRedoAvailability:
      options.operations?.applyRedoAvailability ?? applyRedoAvailability,
    resolveTransaction:
      options.operations?.resolveTransaction ?? resolveApplyTransaction,
    undoLastApply: options.operations?.undoLastApply ?? undoLastApply,
    redoLastApply: options.operations?.redoLastApply ?? redoLastApply,
  });

  let phase: DesktopPhase = "idle";
  let unifiedDiff: string | null = null;
  let renderedDiff: string | null = null;
  let proposal: Proposal | null = null;
  let pendingCwd: string | undefined;
  let pendingTransactionId: string | null = null;
  const appliedCwdHistory: string[] = [];
  let sessionApplyHistoryStarted = false;
  let appliedPaths: readonly string[] | null = null;
  let journalRecoveryPending = false;
  let diagnostics: readonly ApplyDiagnostic[] | null = null;

  const snap = (): DesktopSnapshot =>
    Object.freeze({
      phase,
      unifiedDiff,
      renderedDiff,
      proposal,
      appliedPaths,
      journalRecoveryPending,
      transactionId: pendingTransactionId,
      diagnostics,
    });

  const clearProposal = (nextPhase: DesktopPhase): void => {
    phase = nextPhase;
    unifiedDiff = null;
    renderedDiff = null;
    proposal = null;
    pendingCwd = undefined;
    pendingTransactionId = null;
    appliedPaths = null;
    journalRecoveryPending = false;
    diagnostics = null;
  };

  const refusePending = (): DesktopSnapshot => {
    diagnostics = PENDING_DIAGNOSTICS;
    return snap();
  };

  const session: DesktopSession = {
    snapshot: snap,

    proposeEdit(input: ShellEditInput): DesktopSnapshot {
      if (journalRecoveryPending) return refusePending();
      const cwd = canonicalPath(input.cwd ?? sessionCwd);
      if (phase === "reviewing" && proposal !== null) {
        const conflictCheck = input.expectedContentHash === undefined
          ? null
          : shellPropose({ ...input, cwd });
        if (
          conflictCheck !== null &&
          !conflictCheck.ok &&
          conflictCheck.diagnostics.some(
            (diagnostic) => diagnostic.code === "content-hash-conflict",
          )
        ) {
          clearProposal("idle");
          diagnostics = conflictCheck.diagnostics;
          return snap();
        }
        diagnostics = ACTIVE_PROPOSAL_DIAGNOSTICS;
        return snap();
      }
      const result = shellPropose({ ...input, cwd });
      if (!result.ok) {
        clearProposal("idle");
        diagnostics = result.diagnostics;
        return snap();
      }
      clearProposal("reviewing");
      unifiedDiff = result.unifiedDiff;
      renderedDiff = result.renderedDiff;
      proposal = result.proposal;
      pendingCwd = cwd;
      return snap();
    },

    accept(): DesktopSnapshot {
      if (journalRecoveryPending) return refusePending();
      if (phase !== "reviewing" || proposal === null) {
        diagnostics = [
          {
            code: "invalid-proposal",
            message:
              "No pending proposal to accept. Propose an edit and review the rendered diff first.",
          },
        ];
        return snap();
      }

      const cwd = pendingCwd;
      const result = operations.applyProposal({
        proposal,
        ...(cwd !== undefined ? { cwd } : {}),
      });

      if (result.applicationState === "indeterminate") {
        phase = "pending";
        appliedPaths = null;
        journalRecoveryPending = true;
        pendingTransactionId = result.transactionId;
        diagnostics = result.diagnostics;
        return snap();
      }
      if (!result.ok) {
        phase = "reviewing";
        diagnostics = result.diagnostics;
        return snap();
      }

      phase = "applied";
      appliedPaths = result.appliedPaths;
      appliedCwdHistory.push(cwd ?? sessionCwd);
      sessionApplyHistoryStarted = true;
      journalRecoveryPending = result.journalRecoveryPending === true;
      pendingTransactionId = result.transactionId;
      diagnostics = null;
      // Keep renderedDiff so the surface can still show what was accepted.
      return snap();
    },

    reject(): DesktopSnapshot {
      if (journalRecoveryPending) return refusePending();
      clearProposal("rejected");
      return snap();
    },

    refreshRecovery(): DesktopSnapshot {
      if (!journalRecoveryPending || pendingTransactionId === null) {
        return snap();
      }
      const resolved = operations.resolveTransaction({
        transactionId: pendingTransactionId,
        ...(pendingCwd === undefined ? {} : { cwd: pendingCwd }),
      });
      if (!resolved.ok) {
        diagnostics = resolved.diagnostics;
        return snap();
      }
      if (resolved.state === "pending") {
        diagnostics = PENDING_DIAGNOSTICS;
        return snap();
      }
      if (resolved.state === "missing") {
        diagnostics = [
          {
            code: "journal-not-found",
            message: `Recovery did not resolve pending transaction ${pendingTransactionId}.`,
            reReadHint:
              "Re-read the affected documents and start a new session before continuing.",
          },
        ];
        return snap();
      }
      if (resolved.state !== "completed") {
        const staleId = resolved.transactionId;
        phase = "reviewing";
        appliedPaths = null;
        journalRecoveryPending = false;
        pendingTransactionId = null;
        diagnostics = [
          {
            code: "journal-conflict",
            message: `Pending transaction ${staleId} is ${resolved.state}.`,
            reReadHint:
              "Re-read the affected documents before accepting another proposal.",
          },
        ];
        return snap();
      }
      if (phase === "pending") {
        phase = "applied";
        appliedPaths = resolved.documentPaths;
        appliedCwdHistory.push(pendingCwd ?? sessionCwd);
        sessionApplyHistoryStarted = true;
      }
      journalRecoveryPending = false;
      pendingTransactionId = null;
      diagnostics = null;
      return snap();
    },

    status(documentPath: string): DesktopDocumentStatus {
      let text: string;
      try {
        text = readFileSync(resolve(sessionCwd, documentPath), "utf8");
      } catch (error) {
        const missing = typeof error === "object" && error !== null &&
          "code" in error && error.code === "ENOENT";
        return {
          ok: false,
          documentPath,
          diagnostics: [
            {
              code: missing ? "document-not-found" : "document-read-failed",
              message: missing
                ? `Document not found: ${documentPath}`
                : `Document could not be read: ${documentPath}`,
              documentPath,
            },
          ],
        };
      }

      const validation = parseDocumentText(text);
      if (!validation.ok) {
        return {
          ok: false,
          documentPath,
          diagnostics: [
            {
              code:
                validation.code === "not-object"
                  ? "invalid-document"
                  : validation.code,
              message: `${documentPath}: ${validation.message}`,
            },
          ],
        };
      }
      return {
        ok: true,
        documentPath,
        documentId: validation.document.id,
        contentHash: contentHash(text),
        contentByteLength: Buffer.byteLength(text, "utf8"),
        dataKeys: Object.freeze(Object.keys(validation.document.data).sort()),
        undoAvailability: (() => {
          if (journalRecoveryPending) return "recovery-pending";
          const appliedCwd = appliedCwdHistory.at(-1);
          if (appliedCwd !== undefined) {
            return operations.applyUndoAvailability({ cwd: appliedCwd });
          }
          return sessionApplyHistoryStarted
            ? "unavailable"
            : operations.applyUndoAvailability({ cwd: sessionCwd });
        })(),
        redoAvailability: journalRecoveryPending
          ? "recovery-pending"
          : operations.applyRedoAvailability({ cwd: appliedCwdHistory.at(-1) ?? sessionCwd }),
        data: deepFreeze(structuredClone(validation.document.data)),
      };
    },

    undo(): DesktopUndoResult {
      if (phase === "reviewing" && proposal !== null) {
        return {
          ok: false,
          diagnostics: [{
            code: "invalid-transaction-phase",
            message: "Undo is refused while a proposal is explicitly staged for review.",
            reReadHint: "Accept or reject the staged proposal before changing committed history.",
          }],
        };
      }
      // Session-originated applies are undone LIFO by canonical root; once exhausted, this session never falls back to another root.
      const appliedCwd = appliedCwdHistory.at(-1);
      if (appliedCwd === undefined && sessionApplyHistoryStarted) {
        return {
          ok: false,
          diagnostics: [
            {
              code: "journal-not-found",
              message: "No completed session apply is available to undo.",
            },
          ],
        };
      }
      const result = operations.undoLastApply({
        cwd: appliedCwd ?? sessionCwd,
      });
      if (!result.ok) {
        return { ok: false, diagnostics: result.diagnostics };
      }
      if (appliedCwd !== undefined) appliedCwdHistory.pop();
      clearProposal("idle");
      return { ok: true, transactionId: result.transactionId, restoredPaths: result.documentPaths };
    },

    redo(): DesktopRedoResult {
      if (phase === "reviewing" && proposal !== null) {
        return {
          ok: false,
          diagnostics: [{
            code: "invalid-transaction-phase",
            message: "Redo is refused while a proposal is explicitly staged for review.",
            reReadHint: "Accept or reject the staged proposal before changing committed history.",
          }],
        };
      }
      const result = operations.redoLastApply({ cwd: sessionCwd });
      if (!result.ok) return { ok: false, diagnostics: result.diagnostics };
      clearProposal("idle");
      return { ok: true, transactionId: result.transactionId, restoredPaths: result.documentPaths };
    },
  };
  return Object.freeze(session);
}
