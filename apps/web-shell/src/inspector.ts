/**
 * Minimal web-shell inspector session — propose → review rendered diff → accept/reject.
 *
 * Human path: proposeEdit() surfaces `renderedDiff`; accept() applies; reject() discards.
 * Stub only: no DOM, no hosting, no deployment.
 */

import { resolve } from "node:path";

import {
  recoverIncompleteApplies,
  type ApplyDiagnostic,
  type Proposal,
} from "@sceneaxi/authoring-core";
import {
  shellApply,
  shellPropose,
  type ShellEditInput,
} from "./protocol-client.js";

export type InspectorPhase =
  | "idle"
  | "reviewing"
  | "applied"
  | "pending"
  | "rejected";

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
  refreshRecovery(): InspectorSnapshot;
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
  let pendingTransactionId: string | null = null;
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

  const pendingDiagnostics = (): readonly ApplyDiagnostic[] => [
    {
      code: "apply-in-progress",
      message: "The apply outcome is pending journal recovery.",
      reReadHint: "Call refreshRecovery() before another inspector action.",
    },
  ];

  const refusePending = (): InspectorSnapshot => {
    diagnostics = pendingDiagnostics();
    return snap();
  };

  return {
    snapshot: snap,

    proposeEdit(input: ShellEditInput): InspectorSnapshot {
      if (journalRecoveryPending) return refusePending();
      const cwd = resolve(input.cwd ?? options.cwd ?? ".");
      const result = shellPropose({
        ...input,
        cwd,
      });
      if (!result.ok) {
        phase = "idle";
        unifiedDiff = null;
        renderedDiff = null;
        proposal = null;
        pendingCwd = undefined;
        pendingTransactionId = null;
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
      pendingTransactionId = null;
      appliedPaths = null;
      journalRecoveryPending = false;
      diagnostics = null;
      return snap();
    },

    accept(): InspectorSnapshot {
      if (journalRecoveryPending) return refusePending();
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
      journalRecoveryPending = result.journalRecoveryPending === true;
      pendingTransactionId = result.transactionId ?? null;
      diagnostics = null;
      // Keep renderedDiff visible after apply so the inspector can show what was accepted.
      return snap();
    },

    reject(): InspectorSnapshot {
      if (journalRecoveryPending) return refusePending();
      phase = "rejected";
      unifiedDiff = null;
      renderedDiff = null;
      proposal = null;
      pendingCwd = undefined;
      pendingTransactionId = null;
      appliedPaths = null;
      journalRecoveryPending = false;
      diagnostics = null;
      return snap();
    },

    refreshRecovery(): InspectorSnapshot {
      if (!journalRecoveryPending || pendingTransactionId === null) {
        return snap();
      }
      const recovered = recoverIncompleteApplies(
        pendingCwd === undefined ? {} : { cwd: pendingCwd },
      );
      if (!recovered.ok) {
        diagnostics = recovered.diagnostics;
        return snap();
      }
      if (recovered.journalRecoveryPending === true) {
        diagnostics = pendingDiagnostics();
        return snap();
      }
      if (!recovered.transactionIds.includes(pendingTransactionId)) {
        diagnostics = [
          {
            code: "journal-not-found",
            message: `Recovery did not resolve pending transaction ${pendingTransactionId}.`,
            reReadHint:
              "Re-read the affected documents and create a new inspector session before continuing.",
          },
        ];
        return snap();
      }
      if (phase === "pending") {
        phase = "applied";
        appliedPaths = [
          ...new Set(proposal?.edits.map((edit) => edit.documentPath) ?? []),
        ];
      }
      journalRecoveryPending = false;
      pendingTransactionId = null;
      diagnostics = null;
      return snap();
    },
  };
}
