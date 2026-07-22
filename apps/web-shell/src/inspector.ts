/**
 * Minimal web-shell inspector session — propose → review rendered diff → accept/reject.
 *
 * Human path: proposeEdit() surfaces `renderedDiff`; accept() applies; reject() discards.
 * Stub only: no DOM, no hosting, no deployment.
 */

import type { ApplyDiagnostic, Proposal } from "@sceneaxi/authoring-core";
import {
  shellApply,
  shellPropose,
  type ShellEditInput,
} from "./protocol-client.js";

export type InspectorPhase = "idle" | "reviewing" | "applied" | "rejected";

export type InspectorSnapshot = {
  readonly phase: InspectorPhase;
  readonly unifiedDiff: string | null;
  readonly renderedDiff: string | null;
  readonly proposal: Proposal | null;
  readonly appliedPaths: readonly string[] | null;
  readonly journalRecoveryPending: boolean;
  readonly diagnostics: readonly ApplyDiagnostic[] | null;
};

export type InspectorSession = {
  /** Current review surface (diff, phase, diagnostics). */
  snapshot(): InspectorSnapshot;
  /** Propose an edit and park it for review (does not write documents). */
  proposeEdit(input: ShellEditInput): InspectorSnapshot;
  /** Accept the pending proposal (apply via authoring-core). */
  accept(): InspectorSnapshot;
  /** Discard the pending proposal without writing. */
  reject(): InspectorSnapshot;
};

/**
 * Create a single-proposal inspector session bound to an optional working directory.
 */
export function createInspectorSession(options: {
  readonly cwd?: string;
} = {}): InspectorSession {
  let phase: InspectorPhase = "idle";
  let unifiedDiff: string | null = null;
  let renderedDiff: string | null = null;
  let proposal: Proposal | null = null;
  let pendingCwd: string | undefined;
  let appliedPaths: readonly string[] | null = null;
  let journalRecoveryPending = false;
  let diagnostics: readonly ApplyDiagnostic[] | null = null;

  const snap = (): InspectorSnapshot =>
    Object.freeze({
      phase,
      unifiedDiff,
      renderedDiff,
      proposal,
      appliedPaths,
      journalRecoveryPending,
      diagnostics,
    });

  return {
    snapshot: snap,

    proposeEdit(input: ShellEditInput): InspectorSnapshot {
      const cwd = input.cwd ?? options.cwd;
      const result = shellPropose({
        ...input,
        ...(cwd !== undefined ? { cwd } : {}),
      });
      if (!result.ok) {
        phase = "idle";
        unifiedDiff = null;
        renderedDiff = null;
        proposal = null;
        pendingCwd = undefined;
        appliedPaths = null;
        journalRecoveryPending = false;
        diagnostics = result.diagnostics;
        return snap();
      }
      phase = "reviewing";
      unifiedDiff = result.unifiedDiff;
      renderedDiff = result.renderedDiff;
      proposal = result.proposal;
      pendingCwd = cwd;
      appliedPaths = null;
      journalRecoveryPending = false;
      diagnostics = null;
      return snap();
    },

    accept(): InspectorSnapshot {
      if (phase !== "reviewing" || proposal === null) {
        diagnostics = [
          {
            code: "invalid-proposal",
            message:
              "No pending proposal to accept. Call proposeEdit() and review the rendered diff first.",
          },
        ];
        return snap();
      }
      const cwd = pendingCwd;
      const result = shellApply({
        proposal,
        ...(cwd !== undefined ? { cwd } : {}),
      });
      if (!result.ok) {
        phase = "reviewing";
        diagnostics = result.diagnostics;
        return snap();
      }
      phase = "applied";
      appliedPaths = result.appliedPaths;
      journalRecoveryPending = result.journalRecoveryPending === true;
      diagnostics = null;
      // Keep renderedDiff visible after apply so the inspector can show what was accepted.
      return snap();
    },

    reject(): InspectorSnapshot {
      phase = "rejected";
      unifiedDiff = null;
      renderedDiff = null;
      proposal = null;
      pendingCwd = undefined;
      appliedPaths = null;
      journalRecoveryPending = false;
      diagnostics = null;
      return snap();
    },
  };
}
