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
  type ApplyDiagnostic,
  type ApplyResult,
  type Proposal,
  type ProposalEdit,
  type SceneDocument,
} from "@sceneaxi/schemas";
import {
  atomicWriteAll,
  atomicWriteFile,
  fileExists,
  readTextFile,
} from "./atomic-write.js";
import { contentHash } from "./content-hash.js";
import { getAtPointer, setAtPointer } from "./json-pointer.js";
import { unifiedDiff } from "./unified-diff.js";

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
  return resolve(cwd, documentPath);
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
    newValue: input.newValue,
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
  const cwd = inputs[0]?.cwd ?? process.cwd();
  const workingText = new Map<string, string>();
  const baseHash = new Map<string, string>();
  const baseText = new Map<string, string>();

  for (const input of inputs) {
    const abs = resolvePath(input.cwd ?? cwd, input.documentPath);
    let text = workingText.get(input.documentPath);
    let hash = baseHash.get(input.documentPath);

    if (text === undefined) {
      const loaded = loadDocument(abs, input.documentPath);
      if (!loaded.ok) return loaded;
      text = loaded.text;
      hash = loaded.hash;
      workingText.set(input.documentPath, text);
      baseHash.set(input.documentPath, hash);
      baseText.set(input.documentPath, text);
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
            documentPath: input.documentPath,
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
            documentPath: input.documentPath,
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
            ? { ...d, documentPath: input.documentPath }
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
            message: `Missing base hash for ${input.documentPath}`,
            documentPath: input.documentPath,
          },
        ],
      };
    }

    edits.push({
      documentPath: input.documentPath,
      baseContentHash: hash,
      jsonPointer: input.jsonPointer,
      oldValue: oldAt.value,
      newValue: input.newValue,
    });

    workingText.set(input.documentPath, mutated.text);
  }

  for (const [documentPath, finalText] of workingText) {
    const original = baseText.get(documentPath) ?? "";
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

  atomicWriteFile(abs, mutated.text);
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
    proposal = input.proposal;
  }

  // Group edits by document path while preserving order within each document.
  const byDoc = new Map<string, ProposalEdit[]>();
  for (const edit of proposal.edits) {
    const list = byDoc.get(edit.documentPath) ?? [];
    list.push(edit);
    byDoc.set(edit.documentPath, list);
  }

  const plans: Array<{ path: string; contents: string; documentPath: string }> =
    [];

  for (const [documentPath, edits] of byDoc) {
    const abs = resolvePath(cwd, documentPath);
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

      // Optional consistency: oldValue should match current (not required by E1,
      // but hash already covers concurrent rewrite of the whole file).
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
      documentPath,
    });
  }

  // All-or-nothing atomic write across every touched document.
  atomicWriteAll(plans.map((p) => ({ path: p.path, contents: p.contents })));

  return {
    ok: true,
    appliedPaths: plans.map((p) => p.documentPath),
  };
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
