/**
 * Propose/apply application service (E1).
 *
 * - One shared validator (`validateDocument`) for direct edits and proposals.
 * - propose → structured proposal + unified diff.
 * - apply → ok | reject(typed diagnostics); content-hash conflicts include re-read hints.
 * - Atomic tmp-then-rename writes; multi-document all-or-nothing.
 */

import { resolve } from "node:path";
import {
  createProposal,
  parseDocumentText,
  parseProposalText,
  serializeDocument,
  serializeProposal,
  validateDocument,
  validateProposal,
  isJsonValue,
  type ApplyDiagnostic,
  type ApplyResult,
  type Proposal,
  type ProposalEdit,
  type JsonValue,
  type SceneDocument,
} from "@sceneaxi/schemas";
import {
  AtomicWriteConflictError,
  AtomicWriteError,
  AtomicWriteLockError,
  atomicWriteAll,
  atomicWriteFile,
  canonicalPath,
  fileExists,
  readTextFile,
  verifyAtomicWritePreconditions,
} from "./atomic-write.js";
import { contentHash } from "./content-hash.js";
import { getAtPointer, setAtPointer } from "./json-pointer.js";
import { unifiedDiff } from "./unified-diff.js";
import {
  abortApplyJournal,
  beginApplyJournalTransaction,
  completeApplyJournal,
  endApplyJournalTransaction,
  prepareApplyJournal,
  recoverPreparedApply,
  recoverIncompleteApplies,
} from "./apply-journal.js";

export type ProposeInput = {
  readonly documentPath: string;
  readonly jsonPointer: string;
  readonly newValue: unknown;
  /** Working directory for relative document paths (default: process.cwd()). */
  readonly cwd?: string;
};

export type ProposeOk = {
  readonly ok: true;
  readonly proposal: Proposal;
  readonly unifiedDiff: string;
};

export type ProposeReject = {
  readonly ok: false;
  readonly diagnostics: readonly ApplyDiagnostic[];
};

export type ProposeResult = ProposeOk | ProposeReject;

export type DirectEditInput = {
  readonly documentPath: string;
  readonly jsonPointer: string;
  readonly newValue: unknown;
  readonly cwd?: string;
};

export type DirectEditOk = {
  readonly ok: true;
  readonly documentPath: string;
  readonly contentHash: string;
};

export type DirectEditResult = DirectEditOk | ProposeReject;

export type ApplyInput = {
  readonly proposal: Proposal | string;
  /** When string, treat as path to a proposal file (unless proposalJson). */
  readonly cwd?: string;
};

function resolvePath(cwd: string, documentPath: string): string {
  return canonicalPath(resolve(cwd, documentPath));
}

function jsonValuesEqual(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return left === right || (left === 0 && right === 0);
  }
  if (left === right) return true;
  if (left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => jsonValuesEqual(value, right[index]))
    );
  }
  if (typeof left !== "object" || typeof right !== "object") return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  return (
    leftKeys.length === Object.keys(rightRecord).length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(rightRecord, key) &&
        jsonValuesEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

function recoveryDiagnostics(cwd: string): readonly ApplyDiagnostic[] | null {
  const recovered = recoverIncompleteApplies({ cwd });
  return recovered.ok ? null : recovered.diagnostics;
}

function loadDocument(
  absPath: string,
  documentPath: string,
):
  | { ok: true; text: string; document: SceneDocument; hash: string }
  | { ok: false; diagnostics: ApplyDiagnostic[] } {
  if (!fileExists(absPath)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "document-not-found",
          message: `Document not found: ${documentPath}`,
          documentPath,
        },
      ],
    };
  }

  const text = readTextFile(absPath);
  const parsed = parseDocumentText(text);
  if (!parsed.ok) {
    const code =
      parsed.code === "schema-major-mismatch"
        ? "schema-major-mismatch"
        : parsed.code === "parse-error"
          ? "parse-error"
          : "invalid-document";
    return {
      ok: false,
      diagnostics: [
        {
          code,
          message: parsed.message,
          documentPath,
        },
      ],
    };
  }

  return {
    ok: true,
    text,
    document: parsed.document,
    hash: contentHash(text),
  };
}

/**
 * Shared mutation path: apply a pointer edit in memory and re-validate.
 * Used by both propose and directEdit — one validator implementation.
 */
export function applyPointerEditInMemory(
  document: SceneDocument,
  jsonPointer: string,
  newValue: unknown,
):
  | { ok: true; document: SceneDocument; text: string }
  | { ok: false; diagnostics: ApplyDiagnostic[] } {
  if (!isJsonValue(newValue)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "validation-failed",
          message: "Edited values must be finite, acyclic JSON values.",
        },
      ],
    };
  }
  const setResult = setAtPointer(document, jsonPointer, newValue);
  if (!setResult.ok) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "invalid-pointer",
          message: setResult.message,
        },
      ],
    };
  }

  // One validator: same validateDocument as load path.
  const validated = validateDocument(setResult.value);
  if (!validated.ok) {
    const code =
      validated.code === "schema-major-mismatch"
        ? "schema-major-mismatch"
        : "validation-failed";
    return {
      ok: false,
      diagnostics: [
        {
          code,
          message: validated.message,
        },
      ],
    };
  }

  const text = serializeDocument(validated.document);
  return { ok: true, document: validated.document, text };
}

/**
 * Propose a single JSON Pointer edit. Returns a proposal with unified diff.
 * Does not write the document.
 */
export function propose(input: ProposeInput): ProposeResult {
  const cwd = input.cwd ?? process.cwd();
  const recoveryFailure = recoveryDiagnostics(cwd);
  if (recoveryFailure !== null) {
    return { ok: false, diagnostics: recoveryFailure };
  }
  const abs = resolvePath(cwd, input.documentPath);
  const loaded = loadDocument(abs, input.documentPath);
  if (!loaded.ok) return loaded;

  const oldAt = getAtPointer(loaded.document, input.jsonPointer);
  if (!oldAt.ok) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "invalid-pointer",
          message: oldAt.message,
          documentPath: input.documentPath,
        },
      ],
    };
  }
  if (!isJsonValue(oldAt.value)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "invalid-document",
          message: "Existing document value is not valid JSON.",
          documentPath: input.documentPath,
        },
      ],
    };
  }

  const mutated = applyPointerEditInMemory(
    loaded.document,
    input.jsonPointer,
    input.newValue,
  );
  if (!mutated.ok) {
    return {
      ok: false,
      diagnostics: mutated.diagnostics.map((d) =>
        d.documentPath === undefined
          ? { ...d, documentPath: input.documentPath }
          : d,
      ),
    };
  }

  const edit: ProposalEdit = {
    documentPath: input.documentPath,
    baseContentHash: loaded.hash,
    jsonPointer: input.jsonPointer,
    oldValue: oldAt.value,
    newValue: input.newValue as JsonValue,
  };

  const diffText = unifiedDiff(loaded.text, mutated.text, {
    oldPath: `a/${input.documentPath}`,
    newPath: `b/${input.documentPath}`,
  });

  const proposal = createProposal({
    edits: [edit],
    diffs: [{ documentPath: input.documentPath, unifiedDiff: diffText }],
  });

  return { ok: true, proposal, unifiedDiff: diffText };
}

/**
 * Compose multiple single-edit propose results into one all-or-nothing proposal.
 * Fails if any propose fails or if the same document is edited twice with
 * inconsistent base hashes (caller should re-read).
 */
export function proposeMany(inputs: readonly ProposeInput[]): ProposeResult {
  if (inputs.length === 0) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "invalid-proposal",
          message: "proposeMany requires at least one edit.",
        },
      ],
    };
  }

  const edits: ProposalEdit[] = [];
  const diffsByPath = new Map<string, string>();
  // Track in-memory post-edit text per document so chained edits on the same
  // file share one base → final diff and a single base hash.
  const cwd = resolve(inputs[0]?.cwd ?? process.cwd());
  for (const input of inputs) {
    if (resolve(input.cwd ?? cwd) !== cwd) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "invalid-proposal",
            message: "proposeMany requires one shared working directory.",
          },
        ],
      };
    }
  }
  const recoveryFailure = recoveryDiagnostics(cwd);
  if (recoveryFailure !== null) {
    return { ok: false, diagnostics: recoveryFailure };
  }
  const workingText = new Map<string, string>();
  const baseHash = new Map<string, string>();
  const baseText = new Map<string, string>();
  const displayPath = new Map<string, string>();

  for (const input of inputs) {
    const abs = resolvePath(input.cwd ?? cwd, input.documentPath);
    const documentPath = displayPath.get(abs) ?? input.documentPath;
    displayPath.set(abs, documentPath);
    let text = workingText.get(abs);
    let hash = baseHash.get(abs);

    if (text === undefined) {
      const loaded = loadDocument(abs, documentPath);
      if (!loaded.ok) return loaded;
      text = loaded.text;
      hash = loaded.hash;
      workingText.set(abs, text);
      baseHash.set(abs, hash);
      baseText.set(abs, text);
    }

    const parsed = parseDocumentText(text);
    if (!parsed.ok) {
      return {
        ok: false,
        diagnostics: [
          {
            code:
              parsed.code === "schema-major-mismatch"
                ? "schema-major-mismatch"
                : "invalid-document",
            message: parsed.message,
            documentPath,
          },
        ],
      };
    }

    const oldAt = getAtPointer(parsed.document, input.jsonPointer);
    if (!oldAt.ok) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "invalid-pointer",
            message: oldAt.message,
            documentPath,
          },
        ],
      };
    }
    if (!isJsonValue(oldAt.value)) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "invalid-document",
            message: "Existing document value is not valid JSON.",
            documentPath,
          },
        ],
      };
    }

    const mutated = applyPointerEditInMemory(
      parsed.document,
      input.jsonPointer,
      input.newValue,
    );
    if (!mutated.ok) {
      return {
        ok: false,
        diagnostics: mutated.diagnostics.map((d) =>
          d.documentPath === undefined
            ? { ...d, documentPath }
            : d,
        ),
      };
    }

    if (hash === undefined) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "invalid-document",
            message: `Missing base hash for ${documentPath}`,
            documentPath,
          },
        ],
      };
    }

    edits.push({
      documentPath,
      baseContentHash: hash,
      jsonPointer: input.jsonPointer,
      oldValue: oldAt.value,
      newValue: input.newValue as JsonValue,
    });

    workingText.set(abs, mutated.text);
  }

  for (const [abs, finalText] of workingText) {
    const documentPath = displayPath.get(abs) ?? abs;
    const original = baseText.get(abs) ?? "";
    diffsByPath.set(
      documentPath,
      unifiedDiff(original, finalText, {
        oldPath: `a/${documentPath}`,
        newPath: `b/${documentPath}`,
      }),
    );
  }

  const diffs = [...diffsByPath.entries()].map(([documentPath, unifiedDiffText]) => ({
    documentPath,
    unifiedDiff: unifiedDiffText,
  }));

  const proposal = createProposal({ edits, diffs });
  const primaryDiff = diffs[0]?.unifiedDiff ?? "";
  return { ok: true, proposal, unifiedDiff: primaryDiff };
}

/**
 * Direct edit through the **same** validator + serializer path as propose/apply.
 * Used to prove byte-identical outcomes vs the proposal path.
 */
export function editDirect(input: DirectEditInput): DirectEditResult {
  const cwd = input.cwd ?? process.cwd();
  const recoveryFailure = recoveryDiagnostics(cwd);
  if (recoveryFailure !== null) {
    return { ok: false, diagnostics: recoveryFailure };
  }
  const abs = resolvePath(cwd, input.documentPath);
  const loaded = loadDocument(abs, input.documentPath);
  if (!loaded.ok) return loaded;

  const mutated = applyPointerEditInMemory(
    loaded.document,
    input.jsonPointer,
    input.newValue,
  );
  if (!mutated.ok) {
    return {
      ok: false,
      diagnostics: mutated.diagnostics.map((d) =>
        d.documentPath === undefined
          ? { ...d, documentPath: input.documentPath }
          : d,
      ),
    };
  }

  try {
    atomicWriteFile(abs, mutated.text, {
      expectedContentHash: loaded.hash,
    });
  } catch (error) {
    if (error instanceof AtomicWriteConflictError) {
      const current = error.currentContentHash ?? "missing";
      return {
        ok: false,
        diagnostics: [
          {
            code: "content-hash-conflict",
            message: `Content hash mismatch for ${input.documentPath}: expected ${loaded.hash}, current ${current}.`,
            documentPath: input.documentPath,
            reReadHint: `Re-read ${input.documentPath} before retrying the direct edit.`,
          },
        ],
      };
    }
    if (error instanceof AtomicWriteLockError) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "apply-in-progress",
            message: `Another write is already in progress for ${input.documentPath}.`,
            documentPath: input.documentPath,
            reReadHint: `Retry after the active writer completes, then re-read ${input.documentPath}.`,
          },
        ],
      };
    }
    throw error;
  }
  return {
    ok: true,
    documentPath: input.documentPath,
    contentHash: contentHash(mutated.text),
  };
}

/**
 * Apply a proposal. All-or-nothing across every edit; content-hash conflicts
 * reject the whole proposal with a re-read hint.
 */
export function apply(input: ApplyInput & { proposalPath?: string }): ApplyResult {
  const cwd = input.cwd ?? process.cwd();
  const recoveryFailure = recoveryDiagnostics(cwd);
  if (recoveryFailure !== null) {
    return { ok: false, diagnostics: recoveryFailure };
  }

  let proposal: Proposal;
  if (typeof input.proposal === "string") {
    // Treat as proposal JSON text if it looks like JSON, else as a path.
    const asPath = input.proposalPath === undefined && !input.proposal.trimStart().startsWith("{");
    if (asPath) {
      const abs = resolvePath(cwd, input.proposal);
      if (!fileExists(abs)) {
        return {
          ok: false,
          diagnostics: [
            {
              code: "document-not-found",
              message: `Proposal file not found: ${input.proposal}`,
              documentPath: input.proposal,
            },
          ],
        };
      }
      const text = readTextFile(abs);
      const parsed = parseProposalText(text);
      if (!parsed.ok) {
        return {
          ok: false,
          diagnostics: [
            {
              code:
                parsed.code === "schema-major-mismatch"
                  ? "schema-major-mismatch"
                  : parsed.code === "parse-error"
                    ? "parse-error"
                    : "invalid-proposal",
              message: parsed.message,
            },
          ],
        };
      }
      proposal = parsed.proposal;
    } else {
      const parsed = parseProposalText(input.proposal);
      if (!parsed.ok) {
        return {
          ok: false,
          diagnostics: [
            {
              code:
                parsed.code === "schema-major-mismatch"
                  ? "schema-major-mismatch"
                  : parsed.code === "parse-error"
                    ? "parse-error"
                    : "invalid-proposal",
              message: parsed.message,
            },
          ],
        };
      }
      proposal = parsed.proposal;
    }
  } else {
    const parsed = validateProposal(input.proposal);
    if (!parsed.ok) {
      return {
        ok: false,
        diagnostics: [
          {
            code:
              parsed.code === "schema-major-mismatch"
                ? "schema-major-mismatch"
                : "invalid-proposal",
            message: parsed.message,
          },
        ],
      };
    }
    proposal = parsed.proposal;
  }

  const byDoc = new Map<
    string,
    { readonly documentPath: string; readonly edits: ProposalEdit[] }
  >();
  for (const edit of proposal.edits) {
    const abs = resolvePath(cwd, edit.documentPath);
    const existing = byDoc.get(abs);
    if (existing !== undefined && existing.documentPath !== edit.documentPath) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "invalid-proposal",
            message: `Proposal aliases one canonical document as both ${existing.documentPath} and ${edit.documentPath}.`,
            documentPath: edit.documentPath,
          },
        ],
      };
    }
    if (existing === undefined) {
      byDoc.set(abs, { documentPath: edit.documentPath, edits: [edit] });
    } else {
      existing.edits.push(edit);
    }
  }

  const plans: Array<{
    path: string;
    contents: string;
    beforeContent: string;
    documentPath: string;
    expectedContentHash: string;
  }> = [];

  for (const [abs, grouped] of byDoc) {
    const { documentPath, edits } = grouped;
    const loaded = loadDocument(abs, documentPath);
    if (!loaded.ok) return loaded;

    // All edits for this document must share the same base hash (proposal base).
    const expectedHash = edits[0]?.baseContentHash;
    if (expectedHash === undefined) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "invalid-proposal",
            message: `Proposal has no edits for ${documentPath}`,
            documentPath,
          },
        ],
      };
    }

    for (const edit of edits) {
      if (edit.baseContentHash !== expectedHash) {
        return {
          ok: false,
          diagnostics: [
            {
              code: "invalid-proposal",
              message: `Inconsistent baseContentHash for ${documentPath} within one proposal.`,
              documentPath,
            },
          ],
        };
      }
    }

    if (loaded.hash !== expectedHash) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "content-hash-conflict",
            message: `Content hash mismatch for ${documentPath}: proposal base ${expectedHash}, current ${loaded.hash}.`,
            documentPath,
            reReadHint: `Re-read ${documentPath} and re-propose against current content (base hash ${loaded.hash}).`,
          },
        ],
      };
    }

    let current = loaded.document;
    for (const edit of edits) {
      const oldAt = getAtPointer(current, edit.jsonPointer);
      if (!oldAt.ok) {
        return {
          ok: false,
          diagnostics: [
            {
              code: "invalid-pointer",
              message: oldAt.message,
              documentPath,
            },
          ],
        };
      }

      if (!jsonValuesEqual(oldAt.value, edit.oldValue)) {
        return {
          ok: false,
          diagnostics: [
            {
              code: "invalid-proposal",
              message: `Proposal oldValue does not match ${documentPath} at ${edit.jsonPointer}.`,
              documentPath,
            },
          ],
        };
      }

      const mutated = applyPointerEditInMemory(
        current,
        edit.jsonPointer,
        edit.newValue,
      );
      if (!mutated.ok) {
        return {
          ok: false,
          diagnostics: mutated.diagnostics.map((d) =>
            d.documentPath === undefined ? { ...d, documentPath } : d,
          ),
        };
      }
      current = mutated.document;
    }

    plans.push({
      path: abs,
      contents: serializeDocument(current),
      beforeContent: loaded.text,
      documentPath,
      expectedContentHash: loaded.hash,
    });
  }

  const proposalDiffs = new Map<
    string,
    { readonly documentPath: string; readonly unifiedDiff: string }
  >();
  for (const diff of proposal.diffs) {
    const abs = resolvePath(cwd, diff.documentPath);
    const grouped = byDoc.get(abs);
    if (
      grouped === undefined ||
      grouped.documentPath !== diff.documentPath ||
      proposalDiffs.has(abs)
    ) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "invalid-proposal",
            message: `Proposal diff target ${diff.documentPath} is missing, duplicated, or aliased.`,
            documentPath: diff.documentPath,
          },
        ],
      };
    }
    proposalDiffs.set(abs, diff);
  }
  if (proposalDiffs.size !== plans.length) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "invalid-proposal",
          message: "Proposal must contain exactly one diff for every edited document.",
        },
      ],
    };
  }
  for (const plan of plans) {
    const expectedDiff = unifiedDiff(plan.beforeContent, plan.contents, {
      oldPath: `a/${plan.documentPath}`,
      newPath: `b/${plan.documentPath}`,
    });
    if (proposalDiffs.get(plan.path)?.unifiedDiff !== expectedDiff) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "invalid-proposal",
            message: `Proposal diff does not match the edits for ${plan.documentPath}.`,
            documentPath: plan.documentPath,
          },
        ],
      };
    }
  }

  let transaction: ReturnType<typeof beginApplyJournalTransaction>;
  try {
    transaction = beginApplyJournalTransaction(
      cwd,
      plans.map((plan) => plan.path),
    );
  } catch (error) {
    if (error instanceof AtomicWriteLockError) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "apply-in-progress",
            message: "Another apply or document write is in progress.",
            reReadHint:
              "Retry after the active writer completes, then re-read every proposed document.",
          },
        ],
      };
    }
    throw error;
  }
  try {
    const atomicPlans = plans.map((plan) => ({
      path: plan.path,
      contents: plan.contents,
      expectedContentHash: plan.expectedContentHash,
    }));
    try {
      verifyAtomicWritePreconditions(atomicPlans, transaction);
    } catch (error) {
      if (error instanceof AtomicWriteConflictError) {
        const plan = plans.find((candidate) => candidate.path === error.path);
        const documentPath = plan?.documentPath ?? error.path;
        const current = error.currentContentHash ?? "missing";
        return {
          ok: false,
          diagnostics: [
            {
              code: "content-hash-conflict",
              message: `Content hash mismatch for ${documentPath}: proposal base ${error.expectedContentHash}, current ${current}.`,
              documentPath,
              reReadHint: `Re-read ${documentPath} and re-propose against current content.`,
            },
          ],
        };
      }
      if (error instanceof AtomicWriteLockError) {
        return {
          ok: false,
          diagnostics: [
            {
              code: "apply-in-progress",
              message: "The acquired document locks are no longer valid.",
              reReadHint:
                "Retry after the active writer completes, then re-read every proposed document.",
            },
          ],
        };
      }
      throw error;
    }

    let journal: ReturnType<typeof prepareApplyJournal>;
    try {
      journal = prepareApplyJournal(
        cwd,
        plans.map((plan) => ({
          documentPath: plan.documentPath,
          beforeContent: plan.beforeContent,
          afterContent: plan.contents,
        })),
      );
    } catch {
      return {
        ok: false,
        diagnostics: [
          {
            code: "apply-failed",
            message: "The durable apply journal could not be prepared.",
            reReadHint: "Resolve the journal storage error before retrying.",
          },
        ],
      };
    }

    try {
      atomicWriteAll(atomicPlans, {
        token: journal.transactionId,
        lockSet: transaction,
      });
    } catch (error) {
      if (error instanceof AtomicWriteError && !error.rollbackComplete) {
        const recovered = recoverPreparedApply(cwd, journal, transaction);
        if (recovered.ok) {
          return {
            ok: true,
            appliedPaths: plans.map((plan) => plan.documentPath),
            ...(recovered.journalRecoveryPending === true
              ? { journalRecoveryPending: true }
              : {}),
          };
        }
        return recovered;
      }

      try {
        abortApplyJournal(cwd, journal);
      } catch {
        const recovered = recoverPreparedApply(cwd, journal, transaction);
        if (recovered.ok) {
          return {
            ok: true,
            appliedPaths: plans.map((plan) => plan.documentPath),
            journalRecoveryPending: true,
          };
        }
        return recovered;
      }
      if (error instanceof AtomicWriteConflictError) {
        const plan = plans.find((candidate) => candidate.path === error.path);
        const documentPath = plan?.documentPath ?? error.path;
        const current = error.currentContentHash ?? "missing";
        return {
          ok: false,
          diagnostics: [
            {
              code: "content-hash-conflict",
              message: `Content hash mismatch for ${documentPath}: proposal base ${error.expectedContentHash}, current ${current}.`,
              documentPath,
              reReadHint: `Re-read ${documentPath} and re-propose against current content.`,
            },
          ],
        };
      }
      return {
        ok: false,
        diagnostics: [
          {
            code: "apply-failed",
            message: "The apply failed and its canonical writes were rolled back.",
            reReadHint: "Re-read every proposed document before retrying.",
          },
        ],
      };
    }
    try {
      completeApplyJournal(cwd, journal);
    } catch {
      return {
        ok: true,
        appliedPaths: plans.map((plan) => plan.documentPath),
        journalRecoveryPending: true,
      };
    }
    return {
      ok: true,
      appliedPaths: plans.map((plan) => plan.documentPath),
    };
  } finally {
    endApplyJournalTransaction(transaction);
  }
}

/** Write a proposal artifact to disk (atomic). */
export function writeProposalFile(
  path: string,
  proposal: Proposal,
): void {
  atomicWriteFile(path, serializeProposal(proposal));
}

/** Read and validate a proposal file. */
export function readProposalFile(path: string): {
  ok: true;
  proposal: Proposal;
} | {
  ok: false;
  diagnostics: readonly ApplyDiagnostic[];
} {
  if (!fileExists(path)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "document-not-found",
          message: `Proposal file not found: ${path}`,
          documentPath: path,
        },
      ],
    };
  }
  const text = readTextFile(path);
  const parsed = parseProposalText(text);
  if (!parsed.ok) {
    return {
      ok: false,
      diagnostics: [
        {
          code:
            parsed.code === "schema-major-mismatch"
              ? "schema-major-mismatch"
              : parsed.code === "parse-error"
                ? "parse-error"
                : "invalid-proposal",
          message: parsed.message,
        },
      ],
    };
  }
  return { ok: true, proposal: parsed.proposal };
}

/** Write a document through the shared serializer + atomic write. */
export function writeDocumentFile(
  path: string,
  document: SceneDocument,
):
  | { ok: true; contentHash: string }
  | { ok: false; diagnostics: readonly ApplyDiagnostic[] } {
  const validated = validateDocument(document);
  if (!validated.ok) {
    return {
      ok: false,
      diagnostics: [
        {
          code:
            validated.code === "schema-major-mismatch"
              ? "schema-major-mismatch"
              : "validation-failed",
          message: validated.message,
          documentPath: path,
        },
      ],
    };
  }
  const text = serializeDocument(validated.document);
  atomicWriteFile(path, text);
  return { ok: true, contentHash: contentHash(text) };
}

export { contentHash, validateDocument, serializeDocument, serializeProposal };
