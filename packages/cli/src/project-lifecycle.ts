/**
 * E1 project lifecycle verbs: new / dev / test / capture / report.
 *
 * Thin protocol adapters over authoring-core's document model. No engine
 * imports (matrix-denied), no network, no credential, no spend — the CLI stays
 * free and BYO-AI. Every artifact these verbs write is deterministic: the same
 * document bytes always produce the same evidence bytes and the same digest.
 */

import { existsSync } from "node:fs";
import { basename } from "node:path";
import {
  contentHash,
  createDocument,
  parseDocumentText,
  serializeDocument,
  writeDocumentFile,
  type JsonObject,
  type SceneDocument,
} from "@sceneaxi/authoring-core";
import { failure, success, type CliOutcome, type ResultPayload } from "./envelope.js";
import { parseVerbArgs } from "./verb-args.js";
import {
  diagnosticsToFailure,
  missingFlag,
  parseJsonOrRefuse,
  readTextOrRefuse,
  refuseUnknownArgs,
  resolveUnderCwd,
} from "./verb-support.js";

/** Evidence packet kind written by `project capture` and read by `project report`. */
export const PROJECT_EVIDENCE_KIND = "sceneaxi.project-evidence" as const;
export const PROJECT_EVIDENCE_SCHEMA_VERSION = 1 as const;

/** Filename suffix `evidence list` scans for. */
export const PROJECT_EVIDENCE_SUFFIX = ".evidence.json" as const;

export type ProjectEvidencePacket = {
  readonly schemaVersion: typeof PROJECT_EVIDENCE_SCHEMA_VERSION;
  readonly kind: typeof PROJECT_EVIDENCE_KIND;
  readonly documentPath: string;
  readonly documentId: string;
  readonly documentContentHash: string;
  readonly documentTitle?: string;
  readonly dataKeys: readonly string[];
  readonly checks: readonly ProjectEvidenceCheck[];
};

export type ProjectEvidenceCheck = {
  readonly name: string;
  readonly status: "pass" | "refuse";
  readonly detail: string;
};

const NEW_FLAGS = new Set(["--document", "--id", "--title", "--data", "--cwd"]);
const NEW_SWITCHES = new Set(["--force"]);
const DEV_FLAGS = new Set(["--document", "--cwd"]);
const DEV_SWITCHES = new Set(["--watch"]);
const TEST_FLAGS = new Set(["--document", "--cwd"]);
const CAPTURE_FLAGS = new Set(["--document", "--out", "--cwd"]);
const REPORT_FLAGS = new Set(["--evidence", "--cwd"]);

const NEW_USAGE =
  "Usage: sceneaxi project new --document <path> [--id <id>] [--title <text>] [--data <json>] [--cwd <dir>] [--force]";
const DEV_USAGE =
  "Usage: sceneaxi project dev --document <path> [--cwd <dir>]  (one-shot; --watch is refused)";
const TEST_USAGE =
  "Usage: sceneaxi project test --document <path> [--cwd <dir>]";
const CAPTURE_USAGE =
  "Usage: sceneaxi project capture --document <path> --out <evidence.json> [--cwd <dir>]";
const REPORT_USAGE =
  "Usage: sceneaxi project report --evidence <path> [--cwd <dir>]";

/**
 * Derive a document id from the target filename when `--id` is absent.
 * Document ids are `^[a-z0-9][a-z0-9-]*$`; anything that cannot be coerced into
 * that shape refuses rather than being silently mangled into a different id.
 */
function deriveDocumentId(documentPath: string): string | null {
  const stem = basename(documentPath).split(".")[0] ?? "";
  const candidate = stem.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const trimmed = candidate.replace(/^-+/, "").replace(/-+$/, "");
  return /^[a-z0-9][a-z0-9-]*$/.test(trimmed) ? trimmed : null;
}

/** Load and validate the document at `--document`, or return the refusal. */
function loadDocument(
  documentPath: string,
  cwd: string | undefined,
  path: readonly string[],
):
  | { readonly ok: true; readonly document: SceneDocument; readonly text: string }
  | { readonly ok: false; readonly outcome: CliOutcome } {
  const absolute = resolveUnderCwd(documentPath, cwd);
  const read = readTextOrRefuse(absolute, documentPath, path);
  if (!read.ok) return { ok: false, outcome: read.outcome };

  const validation = parseDocumentText(read.text);
  if (!validation.ok) {
    return {
      ok: false,
      outcome: diagnosticsToFailure(
        [
          {
            code:
              validation.code === "not-object"
                ? "invalid-document"
                : validation.code,
            message: `${documentPath}: ${validation.message}`,
          },
        ],
        path,
      ),
    };
  }

  return { ok: true, document: validation.document, text: read.text };
}

/** `project new --document <path> [--id] [--title] [--data] [--cwd] [--force]` */
export function runProjectNew(
  path: readonly string[],
  tokens: readonly string[],
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, NEW_FLAGS, path, NEW_SWITCHES);
  if (unknown) return unknown;

  const documentPath = args.flags.get("--document");
  if (documentPath === undefined || documentPath.length === 0) {
    return missingFlag("Missing required flag --document", NEW_USAGE, path);
  }

  const cwd = args.flags.get("--cwd");
  const absolute = resolveUnderCwd(documentPath, cwd);
  const force = args.switches.has("--force");

  if (existsSync(absolute) && !force) {
    return failure(
      "CONFLICT",
      `Refusing to overwrite existing document: ${documentPath}`,
      {
        path,
        help: [
          "Pass --force to overwrite deliberately",
          "`project new` never clobbers authored content by default",
        ],
      },
    );
  }

  const explicitId = args.flags.get("--id");
  const id = explicitId ?? deriveDocumentId(documentPath);
  if (id === null || id.length === 0) {
    return failure(
      "VALIDATION",
      `Cannot derive a valid document id from '${documentPath}'; pass --id explicitly.`,
      {
        path,
        help: ["Document ids match ^[a-z0-9][a-z0-9-]*$", NEW_USAGE],
      },
    );
  }

  const rawData = args.flags.get("--data");
  let data: JsonObject = {};
  if (rawData !== undefined) {
    const parsed = parseJsonOrRefuse(rawData, "--data", path);
    if (!parsed.ok) return parsed.outcome;
    if (
      parsed.value === null ||
      typeof parsed.value !== "object" ||
      Array.isArray(parsed.value)
    ) {
      return failure("VALIDATION", "--data must be a JSON object.", {
        path,
        help: [NEW_USAGE],
      });
    }
    data = parsed.value as JsonObject;
  }

  const title = args.flags.get("--title");
  const document = createDocument({
    id,
    data,
    ...(title !== undefined ? { title } : {}),
  });

  const written = writeDocumentFile(absolute, document, {
    cwd: cwd ?? process.cwd(),
  });
  if (!written.ok) return diagnosticsToFailure(written.diagnostics, path);

  return success(
    Object.freeze({
      status: "created",
      documentPath,
      documentId: id,
      contentHash: written.contentHash,
      ...(title !== undefined ? { title } : {}),
    }),
    [
      `Run \`sceneaxi project test --document ${documentPath}\` to validate it`,
      `Run \`sceneaxi project propose --document ${documentPath} --pointer /data/... --value <json>\` to edit it`,
    ],
  );
}

/**
 * `project dev --document <path> [--cwd]`
 *
 * One-shot project status. `--watch` refuses: this CLI does not ship a
 * hot-reload loop, and pretending to would be a false runnable claim.
 */
export function runProjectDev(
  path: readonly string[],
  tokens: readonly string[],
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, DEV_FLAGS, path, DEV_SWITCHES);
  if (unknown) return unknown;

  if (args.switches.has("--watch")) {
    return failure(
      "NOT_IMPLEMENTED",
      "`project dev --watch` is not implemented; this CLI has no hot-reload loop.",
      {
        path,
        help: [
          "Run `sceneaxi project dev --document <path>` for a one-shot status",
          "Re-run the verb after each edit; there is no background watcher to attach to",
        ],
      },
    );
  }

  const documentPath = args.flags.get("--document");
  if (documentPath === undefined || documentPath.length === 0) {
    return missingFlag("Missing required flag --document", DEV_USAGE, path);
  }

  const cwd = args.flags.get("--cwd");
  const loaded = loadDocument(documentPath, cwd, path);
  if (!loaded.ok) return loaded.outcome;

  return success(
    Object.freeze({
      status: "ready",
      mode: "one-shot",
      watchSupported: false,
      documentPath,
      documentId: loaded.document.id,
      contentHash: contentHash(loaded.text),
      dataKeys: Object.freeze(Object.keys(loaded.document.data).sort()),
    }),
    [
      `Run \`sceneaxi project test --document ${documentPath}\` for the validation report`,
      "There is no watcher: re-run this verb after each edit",
    ],
  );
}

/** `project test --document <path> [--cwd]` — validate and report. */
export function runProjectTest(
  path: readonly string[],
  tokens: readonly string[],
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, TEST_FLAGS, path);
  if (unknown) return unknown;

  const documentPath = args.flags.get("--document");
  if (documentPath === undefined || documentPath.length === 0) {
    return missingFlag("Missing required flag --document", TEST_USAGE, path);
  }

  const cwd = args.flags.get("--cwd");
  const loaded = loadDocument(documentPath, cwd, path);
  if (!loaded.ok) return loaded.outcome;

  const checks = documentChecks(loaded.document, loaded.text);
  return success(
    Object.freeze({
      status: "passed",
      documentPath,
      documentId: loaded.document.id,
      contentHash: contentHash(loaded.text),
      checks,
    }),
    [
      `Run \`sceneaxi project capture --document ${documentPath} --out <evidence.json>\` to record evidence`,
    ],
  );
}

/**
 * Deterministic checks recorded by `project test` and `project capture`.
 * Reaching here means the document already parsed and validated, so these
 * describe *what was proven*, never a re-derived opinion.
 */
function documentChecks(
  document: SceneDocument,
  text: string,
): readonly ProjectEvidenceCheck[] {
  const canonical = serializeDocument(document);
  return Object.freeze([
    Object.freeze({
      name: "document-schema",
      status: "pass" as const,
      detail: `Validated against document schema v${String(document.schemaVersion)}.`,
    }),
    Object.freeze({
      name: "text-canonical-form",
      status: canonical === text ? ("pass" as const) : ("refuse" as const),
      detail:
        canonical === text
          ? "On-disk bytes match the canonical 2-space serialization."
          : "On-disk bytes differ from the canonical serialization; re-write via propose/apply.",
    }),
  ]);
}

/** `project capture --document <path> --out <evidence.json> [--cwd]` */
export function runProjectCapture(
  path: readonly string[],
  tokens: readonly string[],
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, CAPTURE_FLAGS, path);
  if (unknown) return unknown;

  const documentPath = args.flags.get("--document");
  if (documentPath === undefined || documentPath.length === 0) {
    return missingFlag("Missing required flag --document", CAPTURE_USAGE, path);
  }
  const out = args.flags.get("--out");
  if (out === undefined || out.length === 0) {
    return missingFlag("Missing required flag --out", CAPTURE_USAGE, path);
  }

  const cwd = args.flags.get("--cwd");
  const loaded = loadDocument(documentPath, cwd, path);
  if (!loaded.ok) return loaded.outcome;

  const packet = buildEvidencePacket(
    documentPath,
    loaded.document,
    loaded.text,
  );

  // Evidence packets are ordinary documents: the packet body rides in `/data`
  // so the same atomic-write and validation path covers them.
  const carrier = createDocument({
    id: `${loaded.document.id}-evidence`,
    title: `Evidence for ${loaded.document.id}`,
    data: packet as unknown as JsonObject,
  });
  const written = writeDocumentFile(resolveUnderCwd(out, cwd), carrier, {
    cwd: cwd ?? process.cwd(),
  });
  if (!written.ok) return diagnosticsToFailure(written.diagnostics, path);

  return success(
    Object.freeze({
      status: "captured",
      evidencePath: out,
      documentPath,
      documentId: loaded.document.id,
      documentContentHash: packet.documentContentHash,
      evidenceContentHash: written.contentHash,
      checks: packet.checks,
    }),
    [
      `Run \`sceneaxi project report --evidence ${out}\` to summarize it`,
      "Evidence is deterministic: identical document bytes yield identical evidence bytes",
    ],
  );
}

function buildEvidencePacket(
  documentPath: string,
  document: SceneDocument,
  text: string,
): ProjectEvidencePacket {
  const base = {
    schemaVersion: PROJECT_EVIDENCE_SCHEMA_VERSION,
    kind: PROJECT_EVIDENCE_KIND,
    documentPath,
    documentId: document.id,
    documentContentHash: contentHash(text),
    dataKeys: Object.freeze(Object.keys(document.data).sort()),
    checks: documentChecks(document, text),
  } as const;
  return Object.freeze(
    document.title === undefined ? base : { ...base, documentTitle: document.title },
  );
}

/**
 * Read an evidence packet from its carrier document.
 * Anything that is not a v1 packet refuses rather than being half-read.
 */
export function readEvidencePacket(
  value: unknown,
): { readonly ok: true; readonly packet: ProjectEvidencePacket } | { readonly ok: false; readonly message: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "Evidence packet must be a JSON object." };
  }
  const raw = value as Record<string, unknown>;
  if (raw["kind"] !== PROJECT_EVIDENCE_KIND) {
    return {
      ok: false,
      message: `Evidence packet kind must be '${PROJECT_EVIDENCE_KIND}'; found '${String(raw["kind"])}'.`,
    };
  }
  if (raw["schemaVersion"] !== PROJECT_EVIDENCE_SCHEMA_VERSION) {
    return {
      ok: false,
      message: `Evidence packet schemaVersion must be ${String(PROJECT_EVIDENCE_SCHEMA_VERSION)}; found ${String(raw["schemaVersion"])}.`,
    };
  }

  const known = new Set([
    "schemaVersion",
    "kind",
    "documentPath",
    "documentId",
    "documentContentHash",
    "documentTitle",
    "dataKeys",
    "checks",
  ]);
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) {
      return {
        ok: false,
        message: `Evidence packet contains unexpected field '${key}'.`,
      };
    }
  }

  const documentPath = raw["documentPath"];
  if (typeof documentPath !== "string" || documentPath.length === 0) {
    return {
      ok: false,
      message: "Evidence packet 'documentPath' must be a non-empty string.",
    };
  }
  const documentId = raw["documentId"];
  if (
    typeof documentId !== "string" ||
    !/^[a-z0-9][a-z0-9-]*$/.test(documentId)
  ) {
    return {
      ok: false,
      message: "Evidence packet 'documentId' must be a valid document id.",
    };
  }
  const documentContentHash = raw["documentContentHash"];
  if (
    typeof documentContentHash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/.test(documentContentHash)
  ) {
    return {
      ok: false,
      message:
        "Evidence packet 'documentContentHash' must be a lowercase sha256 digest.",
    };
  }
  const documentTitle = raw["documentTitle"];
  if (
    Object.hasOwn(raw, "documentTitle") &&
    typeof documentTitle !== "string"
  ) {
    return {
      ok: false,
      message: "Evidence packet 'documentTitle' must be a string when present.",
    };
  }

  const dataKeys = raw["dataKeys"];
  if (
    !Array.isArray(dataKeys) ||
    !dataKeys.every((key) => typeof key === "string")
  ) {
    return {
      ok: false,
      message: "Evidence packet 'dataKeys' must be an array of strings.",
    };
  }

  const rawChecks = raw["checks"];
  if (!Array.isArray(rawChecks) || rawChecks.length === 0) {
    return {
      ok: false,
      message: "Evidence packet 'checks' must be a non-empty array.",
    };
  }

  const checks: ProjectEvidenceCheck[] = [];
  for (const [index, value] of rawChecks.entries()) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return {
        ok: false,
        message: `Evidence packet check ${String(index)} must be an object.`,
      };
    }
    const check = value as Record<string, unknown>;
    for (const key of Object.keys(check)) {
      if (key !== "name" && key !== "status" && key !== "detail") {
        return {
          ok: false,
          message: `Evidence packet check ${String(index)} contains unexpected field '${key}'.`,
        };
      }
    }
    if (typeof check["name"] !== "string" || check["name"].length === 0) {
      return {
        ok: false,
        message: `Evidence packet check ${String(index)} requires a non-empty name.`,
      };
    }
    if (check["status"] !== "pass" && check["status"] !== "refuse") {
      return {
        ok: false,
        message: `Evidence packet check ${String(index)} has an invalid status.`,
      };
    }
    if (typeof check["detail"] !== "string" || check["detail"].length === 0) {
      return {
        ok: false,
        message: `Evidence packet check ${String(index)} requires non-empty detail.`,
      };
    }
    checks.push(
      Object.freeze({
        name: check["name"],
        status: check["status"],
        detail: check["detail"],
      }),
    );
  }

  const packet: ProjectEvidencePacket = Object.freeze({
    schemaVersion: PROJECT_EVIDENCE_SCHEMA_VERSION,
    kind: PROJECT_EVIDENCE_KIND,
    documentPath,
    documentId,
    documentContentHash,
    ...(typeof documentTitle === "string" ? { documentTitle } : {}),
    dataKeys: Object.freeze([...dataKeys]),
    checks: Object.freeze(checks),
  });
  return { ok: true, packet };
}

/** `project report --evidence <path> [--cwd]` */
export function runProjectReport(
  path: readonly string[],
  tokens: readonly string[],
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, REPORT_FLAGS, path);
  if (unknown) return unknown;

  const evidencePath = args.flags.get("--evidence");
  if (evidencePath === undefined || evidencePath.length === 0) {
    return missingFlag("Missing required flag --evidence", REPORT_USAGE, path);
  }

  const cwd = args.flags.get("--cwd");
  const loaded = loadDocument(evidencePath, cwd, path);
  if (!loaded.ok) return loaded.outcome;

  const packet = readEvidencePacket(loaded.document.data);
  if (!packet.ok) {
    return failure("VALIDATION", `${evidencePath}: ${packet.message}`, {
      path,
      help: [
        "Evidence packets are produced by `sceneaxi project capture`",
        REPORT_USAGE,
      ],
    });
  }

  const checks = packet.packet.checks;
  const refused = checks.filter((check) => check.status !== "pass");

  return success(
    Object.freeze({
      status: refused.length === 0 ? "all-checks-passed" : "checks-refused",
      evidencePath,
      documentPath: packet.packet.documentPath,
      documentId: packet.packet.documentId,
      documentContentHash: packet.packet.documentContentHash,
      checkCount: checks.length,
      passedCount: checks.length - refused.length,
      refusedChecks: Object.freeze(refused.map((check) => check.name)),
      checks,
    }),
    refused.length === 0
      ? ["Every recorded check passed for the captured document bytes"]
      : [
          "Re-run `sceneaxi project test` against the current document",
          "Refused checks describe the captured bytes, not the current file",
        ],
  );
}

export function projectNewHelp(): ResultPayload {
  return Object.freeze({
    command: "project new",
    description:
      "Create a new text-canonical project document; refuses to overwrite without --force",
    flags: Object.freeze({
      "--document": "Path to write the new document (required)",
      "--id": "Document id (default: derived from the filename)",
      "--title": "Optional document title",
      "--data": "Initial /data payload as a JSON object (default: {})",
      "--cwd": "Working directory for relative paths",
      "--force": "Overwrite an existing document deliberately",
    }),
  });
}

export function projectDevHelp(): ResultPayload {
  return Object.freeze({
    command: "project dev",
    description:
      "One-shot project status over a document. There is no hot-reload loop: --watch refuses",
    flags: Object.freeze({
      "--document": "Path to the document (required)",
      "--cwd": "Working directory for relative paths",
      "--watch": "Refused — this CLI ships no watcher",
    }),
  });
}

export function projectTestHelp(): ResultPayload {
  return Object.freeze({
    command: "project test",
    description:
      "Validate a document and report deterministic checks (schema, canonical form)",
    flags: Object.freeze({
      "--document": "Path to the document (required)",
      "--cwd": "Working directory for relative paths",
    }),
  });
}

export function projectCaptureHelp(): ResultPayload {
  return Object.freeze({
    command: "project capture",
    description:
      "Write a deterministic evidence packet for a document (no timestamps, no network)",
    flags: Object.freeze({
      "--document": "Path to the document (required)",
      "--out": "Path to write the evidence packet (required)",
      "--cwd": "Working directory for relative paths",
    }),
  });
}

export function projectReportHelp(): ResultPayload {
  return Object.freeze({
    command: "project report",
    description: "Summarize a captured evidence packet",
    flags: Object.freeze({
      "--evidence": "Path to the evidence packet (required)",
      "--cwd": "Working directory for relative paths",
    }),
  });
}
