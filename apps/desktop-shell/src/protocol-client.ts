/**
 * Desktop-shell protocol client — thin wrapper over the same authoring-core
 * propose/apply service used by web-shell. No forked authoring path, no CLI
 * spawn, no engine imports.
 *
 * Identity with web-shell is proven by the shell↔CLI parity conformance test
 * and by package-level equality tests (same operation → identical documents).
 */

import {
  apply,
  propose,
  type ApplyDiagnostic,
  type ApplyInput,
  type ApplyResult,
  type ProposeInput,
  type Proposal,
} from "@sceneaxi/authoring-core";

export type ShellEditInput = {
  readonly documentPath: string;
  readonly jsonPointer: string;
  readonly newValue: unknown;
  readonly cwd?: string;
};

export type ShellProposeOk = {
  readonly ok: true;
  readonly proposal: Proposal;
  readonly unifiedDiff: string;
  /** Same rendered-diff shape as web-shell so surfaces stay interchangeable. */
  readonly renderedDiff: string;
};

export type ShellProposeReject = {
  readonly ok: false;
  readonly diagnostics: readonly ApplyDiagnostic[];
  readonly renderedDiff: null;
};

export type ShellProposeResult = ShellProposeOk | ShellProposeReject;

export type ShellRoundTripOk = {
  readonly ok: true;
  readonly applicationState?: never;
  readonly proposal: Proposal;
  readonly unifiedDiff: string;
  readonly renderedDiff: string;
  readonly appliedPaths: readonly string[];
  readonly journalRecoveryPending?: true;
};

export type ShellRoundTripIndeterminate = {
  readonly ok: false;
  readonly proposal: Proposal;
  readonly unifiedDiff: string;
  readonly renderedDiff: string;
  readonly applicationState: "indeterminate";
  readonly journalRecoveryPending: true;
  readonly diagnostics: readonly ApplyDiagnostic[];
  readonly appliedPaths?: never;
};

export type ShellRoundTripReject = {
  readonly ok: false;
  readonly applicationState?: never;
  readonly diagnostics: readonly ApplyDiagnostic[];
  readonly renderedDiff: string | null;
};

export type ShellRoundTripResult =
  | ShellRoundTripOk
  | ShellRoundTripIndeterminate
  | ShellRoundTripReject;

/**
 * Render a unified diff for desktop review. Must match web-shell's framing so
 * parity tests can assert interchangeable surfaces over one protocol layer.
 */
export function renderDiffForInspector(unifiedDiff: string): string {
  const body = unifiedDiff.trimEnd();
  return [
    "=== SceneAxi inspector — proposed change (review before accept) ===",
    body,
    "=== end proposed change ===",
  ].join("\n");
}

/** Propose via authoring-core (desktop face of the same protocol). */
export function shellPropose(input: ShellEditInput): ShellProposeResult {
  const result = propose(toProposeInput(input));
  if (!result.ok) {
    return { ok: false, diagnostics: result.diagnostics, renderedDiff: null };
  }
  return {
    ok: true,
    proposal: result.proposal,
    unifiedDiff: result.unifiedDiff,
    renderedDiff: renderDiffForInspector(result.unifiedDiff),
  };
}

/** Apply via authoring-core. */
export function shellApply(
  input: ApplyInput & { readonly proposal: Proposal | string },
): ApplyResult {
  return apply(input);
}

/** Propose → apply round-trip (non-interactive / agent-equivalent path). */
export function shellProposeAndApply(
  input: ShellEditInput,
): ShellRoundTripResult {
  const proposed = shellPropose(input);
  if (!proposed.ok) return proposed;

  const applied = apply({
    proposal: proposed.proposal,
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
  });

  if (applied.applicationState === "indeterminate") {
    return {
      ok: false,
      proposal: proposed.proposal,
      unifiedDiff: proposed.unifiedDiff,
      renderedDiff: proposed.renderedDiff,
      applicationState: "indeterminate",
      journalRecoveryPending: true,
      diagnostics: applied.diagnostics,
    };
  }

  if (!applied.ok) {
    return {
      ok: false,
      diagnostics: applied.diagnostics,
      renderedDiff: proposed.renderedDiff,
    };
  }

  return {
    ok: true,
    proposal: proposed.proposal,
    unifiedDiff: proposed.unifiedDiff,
    renderedDiff: proposed.renderedDiff,
    appliedPaths: applied.appliedPaths,
    ...(applied.journalRecoveryPending === true
      ? { journalRecoveryPending: true }
      : {}),
  };
}

function toProposeInput(input: ShellEditInput): ProposeInput {
  return {
    documentPath: input.documentPath,
    jsonPointer: input.jsonPointer,
    newValue: input.newValue,
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
  };
}
