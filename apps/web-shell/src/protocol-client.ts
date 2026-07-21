/**
 * Web-shell protocol client of authoring-core's propose/apply service.
 *
 * One behavior, many faces: this module never re-implements authoring, never
 * spawns the CLI binary, and never imports engine packages. All mutation goes
 * through `@sceneaxi/authoring-core`.
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
  /** Diff text prepared for the human inspector (review before accept). */
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
  readonly proposal: Proposal;
  readonly unifiedDiff: string;
  readonly renderedDiff: string;
  readonly appliedPaths: readonly string[];
};

export type ShellRoundTripReject = {
  readonly ok: false;
  readonly diagnostics: readonly ApplyDiagnostic[];
  readonly renderedDiff: string | null;
};

export type ShellRoundTripResult = ShellRoundTripOk | ShellRoundTripReject;

/**
 * Render a unified diff for the minimal web-shell inspector.
 * Stub surface: pure text — no DOM, no hosting. Callers display this string.
 */
export function renderDiffForInspector(unifiedDiff: string): string {
  const body = unifiedDiff.trimEnd();
  return [
    "=== SceneAxi inspector — proposed change (review before accept) ===",
    body,
    "=== end proposed change ===",
  ].join("\n");
}

/**
 * Propose a JSON Pointer edit. Returns the proposal plus a rendered diff for
 * human review. Does not write the document.
 */
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

/**
 * Apply a previously proposed change (after the human accepts the rendered diff).
 */
export function shellApply(
  input: ApplyInput & { readonly proposal: Proposal | string },
): ApplyResult {
  return apply(input);
}

/**
 * Full propose → render-diff → apply round-trip for the accepted path.
 * Use when the surface has already obtained acceptance (or for agent parity
 * tests that assert the same path as the CLI without interactive review).
 */
export function shellProposeAndApply(
  input: ShellEditInput,
): ShellRoundTripResult {
  const proposed = shellPropose(input);
  if (!proposed.ok) return proposed;

  const applied = apply({
    proposal: proposed.proposal,
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
  });

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
