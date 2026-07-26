/**
 * Read-only listing verbs: profile / catalog / asset / evidence.
 *
 * Each one reports state that already exists in a public contract — the Profile
 * Conformance registry, the Catalog Item contract, and evidence packets written
 * by `project capture`. None of them invents a schema, and none can activate
 * commerce: `catalog list` reports the inert activation state, it never changes it.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  OPEN_PATH_POLICY_PROFILES,
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  isCommerceActive,
  missingMandatoryMetadata,
  openPathPolicyRowFor,
  profileConformanceRegistry,
  resolveOpenPathSurfaceRequest,
  validateCatalogItem,
  type CatalogItem,
} from "@sceneaxi/schemas";
import { failure, success, type CliOutcome, type ResultPayload } from "./envelope.js";
import {
  PROJECT_EVIDENCE_SUFFIX,
  readEvidencePacket,
} from "./project-lifecycle.js";
import { parseVerbArgs } from "./verb-args.js";
import {
  missingFlag,
  parseJsonOrRefuse,
  readDocumentOrRefuse,
  readTextOrRefuse,
  refuseUnknownArgs,
  resolveUnderCwd,
} from "./verb-support.js";

const PROFILE_LIST_FLAGS = new Set<string>([]);
const PROFILE_OPEN_PATH_FLAGS = new Set(["--profile", "--operation"]);
const CATALOG_LIST_FLAGS = new Set(["--dir", "--cwd"]);
const ASSET_LIST_FLAGS = new Set(["--dir", "--cwd"]);
const EVIDENCE_LIST_FLAGS = new Set(["--dir", "--cwd"]);

const CATALOG_ITEM_SUFFIX = ".catalog-item.json";

const PROFILE_OPEN_PATH_USAGE =
  "Usage: sceneaxi profile open-path [--profile <@sceneaxi/profile-name>] [--operation <open|dispatch|advance|observe|save|replay>]";

const CATALOG_LIST_USAGE =
  "Usage: sceneaxi catalog list --dir <directory of *.catalog-item.json> [--cwd <dir>]";
const ASSET_LIST_USAGE =
  "Usage: sceneaxi asset list --dir <directory of *.catalog-item.json> [--cwd <dir>]";
const EVIDENCE_LIST_USAGE =
  "Usage: sceneaxi evidence list --dir <directory of *.evidence.json> [--cwd <dir>]";

/**
 * `profile list` — the versioned Profile Conformance registry.
 * Claim status comes straight from the registry; the CLI never upgrades a
 * profile's claim, so a not-yet-claimed profile always reports as such.
 */
export function runProfileList(
  path: readonly string[],
  tokens: readonly string[],
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, PROFILE_LIST_FLAGS, path);
  if (unknown) return unknown;

  const profiles = profileConformanceRegistry.map((entry) =>
    Object.freeze({
      profile: entry.profile,
      claimStatus: entry.claimStatus,
      shippingClaim: entry.shippingClaim,
    }),
  );

  return success(
    Object.freeze({
      status: "listed",
      profileCount: profiles.length,
      profiles: Object.freeze(profiles),
    }),
    [
      "Claim status is the registry's, not a readiness or publication claim",
      "Run `sceneaxi protocol inspect` for the protocol contract summary",
    ],
  );
}

/**
 * `profile open-path` — the shared open-path demo policy (sceneaxi#137).
 *
 * With no flags this reports `openPathPolicyView()` **verbatim**: the same value
 * the desktop shell and web shell render, so surface parity is a data identity
 * the parity suite can assert rather than three prose descriptions a reviewer
 * has to compare. With `--profile` and `--operation` it runs the shared decision
 * function, so a refusal here is the same refusal every other surface gets —
 * including the Kids one, which is a non-zero exit, not a quiet empty row.
 *
 * Which of those branches an invocation selects is itself shared
 * (`resolveOpenPathSurfaceRequest`), so this verb only maps a tagged outcome
 * onto the CLI envelope. In particular an explicitly empty `--profile=` or
 * `--operation=` refuses there rather than reading as an absent flag here.
 *
 * The CLI decides nothing about open paths. It cannot: the matrix allows it
 * schemas and authoring-core only, and the policy is contracts.
 */
export function runProfileOpenPath(
  path: readonly string[],
  tokens: readonly string[],
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, PROFILE_OPEN_PATH_FLAGS, path);
  if (unknown) return unknown;

  const outcome = resolveOpenPathSurfaceRequest({
    profile: args.flags.get("--profile"),
    operation: args.flags.get("--operation"),
  });

  if (outcome.kind === "policy") {
    return success(Object.freeze({ status: "listed", policy: outcome.policy }), [
      "Demo levels are demonstrations, never a shipping or production-readiness claim",
      `${OPEN_PATH_REFUSE_ONLY_PROFILE} is refuse-only and stays that way`,
      "Add --profile and --operation to evaluate one demo against the shared policy",
    ]);
  }

  if (outcome.kind === "projection") {
    return success(
      Object.freeze({ status: "listed", policy: outcome.policy }),
      [
        "Demo levels are demonstrations, never a shipping or production-readiness claim",
        `Projection of one row: filteredTo names it, policyCount stays the policy's ${outcome.policy.policyCount}`,
        `Evidence for this row: ${outcome.policy.rows[0].evidence}`,
      ],
    );
  }

  if (outcome.kind === "decision") {
    return success(
      Object.freeze({ status: "evaluated", decision: outcome.decision }),
      [
        "The decision is a demo permission only; shippingClaim is false by contract",
        `Evidence for this level: ${outcome.decision.evidence}`,
      ],
    );
  }

  const { refusal, operation } = outcome;
  const row = openPathPolicyRowFor(refusal.profile);
  return failure(
    outcome.source === "request" ? "AMBIGUOUS_INPUT" : "VALIDATION",
    refusal.message,
    {
      path,
      details: Object.freeze({
        reason: refusal.code,
        profile: refusal.profile,
        ...(operation === null ? {} : { operation }),
      }),
      help: [
        row === undefined
          ? `Known profiles: ${OPEN_PATH_POLICY_PROFILES.join(", ")}`
          : `Operations in this profile's policy: ${
              row.operations.length === 0
                ? "(none — refuse-only)"
                : row.operations.join(", ")
            }`,
        PROFILE_OPEN_PATH_USAGE,
      ],
    },
  );
}

type CatalogScan =
  | {
      readonly ok: true;
      readonly items: ReadonlyArray<{
        readonly file: string;
        readonly item: CatalogItem;
      }>;
    }
  | { readonly ok: false; readonly outcome: CliOutcome };

/** Read every `*.catalog-item.json` in a directory, refusing on any bad file. */
function scanCatalogDir(
  dir: string,
  cwd: string | undefined,
  path: readonly string[],
  usage: string,
): CatalogScan {
  const listed = listDirBySuffix(dir, cwd, CATALOG_ITEM_SUFFIX, path, usage);
  if (!listed.ok) return { ok: false, outcome: listed.outcome };

  const items: { file: string; item: CatalogItem }[] = [];
  for (const file of listed.files) {
    const read = readTextOrRefuse(join(listed.absoluteDir, file), file, path);
    if (!read.ok) return { ok: false, outcome: read.outcome };
    const parsed = parseJsonOrRefuse(read.text, file, path);
    if (!parsed.ok) return { ok: false, outcome: parsed.outcome };

    const shaped = validateCatalogItem(parsed.value);
    if (!shaped.ok) {
      return {
        ok: false,
        outcome: failure("VALIDATION", `${file}: ${shaped.message}`, {
          path,
          help: [
            "Catalog items follow contracts/catalog-item.schema.json",
            usage,
          ],
        }),
      };
    }
    items.push({ file, item: shaped.item });
  }
  items.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  return { ok: true, items: Object.freeze(items) };
}

/**
 * `catalog list --dir <d>` — dormant catalog listing.
 * Reports pipeline state, missing mandatory metadata, and commerce activation.
 * Commerce is inert by contract; this verb only ever *reports* that.
 */
export function runCatalogList(
  path: readonly string[],
  tokens: readonly string[],
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, CATALOG_LIST_FLAGS, path);
  if (unknown) return unknown;

  const dir = args.flags.get("--dir");
  if (dir === undefined || dir.length === 0) {
    return missingFlag("Missing required flag --dir", CATALOG_LIST_USAGE, path);
  }

  const scanned = scanCatalogDir(dir, args.flags.get("--cwd"), path, CATALOG_LIST_USAGE);
  if (!scanned.ok) return scanned.outcome;

  const items = scanned.items.map(({ file, item }) => {
    const missing = missingMandatoryMetadata(item);
    return Object.freeze({
      file,
      itemId: item.itemId,
      pipelineState: item.moderation.pipelineState,
      commerceActive: isCommerceActive(item),
      missingMandatoryMetadata: Object.freeze(missing),
      metadataComplete: missing.length === 0,
    });
  });

  const anyCommerceActive = items.some((entry) => entry.commerceActive);

  return success(
    Object.freeze({
      status: "listed",
      directory: dir,
      itemCount: items.length,
      commerceActivation: anyCommerceActive ? "active" : "inert",
      items: Object.freeze(items),
    }),
    [
      "Commerce stays inert: this verb reports activation state and never changes it",
      "metadataComplete reports mandatory metadata only, not curation or listing readiness",
    ],
  );
}

/**
 * `asset list --dir <d>` — Asset Package refs declared by catalog items.
 * The Asset Package / ingestion policy source of truth is factories-helpers#47/#48;
 * this verb cites the refs already recorded on the Catalog Item contract and
 * defines no asset schema of its own.
 */
export function runAssetList(
  path: readonly string[],
  tokens: readonly string[],
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, ASSET_LIST_FLAGS, path);
  if (unknown) return unknown;

  const dir = args.flags.get("--dir");
  if (dir === undefined || dir.length === 0) {
    return missingFlag("Missing required flag --dir", ASSET_LIST_USAGE, path);
  }

  const scanned = scanCatalogDir(dir, args.flags.get("--cwd"), path, ASSET_LIST_USAGE);
  if (!scanned.ok) return scanned.outcome;

  const assets = scanned.items.map(({ file, item }) =>
    Object.freeze({
      file,
      itemId: item.itemId,
      packageId: item.assetPackage.packageId ?? null,
      contentHash: item.assetPackage.contentHash ?? null,
    }),
  );

  return success(
    Object.freeze({
      status: "listed",
      directory: dir,
      assetCount: assets.length,
      assets: Object.freeze(assets),
    }),
    [
      "Asset Package / ingestion policy stays with factories-helpers#47/#48 — cited, not redefined",
      "Refs come from each Catalog Item's assetPackage field",
    ],
  );
}

/** `evidence list --dir <d>` — evidence packets written by `project capture`. */
export function runEvidenceList(
  path: readonly string[],
  tokens: readonly string[],
): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, EVIDENCE_LIST_FLAGS, path);
  if (unknown) return unknown;

  const dir = args.flags.get("--dir");
  if (dir === undefined || dir.length === 0) {
    return missingFlag("Missing required flag --dir", EVIDENCE_LIST_USAGE, path);
  }

  const cwd = args.flags.get("--cwd");
  const listed = listDirBySuffix(
    dir,
    cwd,
    PROJECT_EVIDENCE_SUFFIX,
    path,
    EVIDENCE_LIST_USAGE,
  );
  if (!listed.ok) return listed.outcome;

  const packets: ResultPayload[] = [];
  for (const file of listed.files) {
    const loaded = readDocumentOrRefuse(
      join(listed.absoluteDir, file),
      file,
      path,
    );
    if (!loaded.ok) return loaded.outcome;

    const packet = readEvidencePacket(loaded.document.data);
    if (!packet.ok) {
      return failure("VALIDATION", `${file}: ${packet.message}`, {
        path,
        help: [
          "Evidence packets are produced by `sceneaxi project capture`",
          EVIDENCE_LIST_USAGE,
        ],
      });
    }

    const refused = packet.packet.checks.filter(
      (check) => check.status !== "pass",
    );
    packets.push(
      Object.freeze({
        file,
        documentId: packet.packet.documentId,
        documentPath: packet.packet.documentPath,
        documentContentHash: packet.packet.documentContentHash,
        checkCount: packet.packet.checks.length,
        refusedCount: refused.length,
      }),
    );
  }

  return success(
    Object.freeze({
      status: "listed",
      directory: dir,
      packetCount: packets.length,
      packets: Object.freeze(packets),
    }),
    [
      "Run `sceneaxi project report --evidence <path>` for a single packet's detail",
    ],
  );
}

type DirListing =
  | {
      readonly ok: true;
      readonly absoluteDir: string;
      readonly files: readonly string[];
    }
  | { readonly ok: false; readonly outcome: CliOutcome };

/** List files in a directory by suffix, sorted, refusing on a missing directory. */
function listDirBySuffix(
  dir: string,
  cwd: string | undefined,
  suffix: string,
  path: readonly string[],
  usage: string,
): DirListing {
  const absoluteDir = resolveUnderCwd(dir, cwd);
  let entries: readonly string[];
  try {
    if (!statSync(absoluteDir).isDirectory()) {
      return {
        ok: false,
        outcome: failure("VALIDATION", `Not a directory: ${dir}`, {
          path,
          help: [usage],
        }),
      };
    }
    entries = readdirSync(absoluteDir);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    if (code === "ENOENT") {
      return {
        ok: false,
        outcome: failure("NOT_FOUND", `Directory not found: ${dir}`, {
          path,
          help: [
            "Check the path relative to --cwd (default: process cwd)",
            usage,
          ],
        }),
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      outcome: failure("INTERNAL", `Could not read ${dir}: ${message}`, {
        path,
      }),
    };
  }

  const files = entries.filter((entry) => entry.endsWith(suffix)).sort();
  return { ok: true, absoluteDir, files: Object.freeze(files) };
}

export function profileListHelp(): ResultPayload {
  return Object.freeze({
    command: "profile list",
    description:
      "List the versioned Profile Conformance registry (claim status is the registry's, not a readiness claim)",
    flags: Object.freeze({}),
  });
}

export function profileOpenPathHelp(): ResultPayload {
  return Object.freeze({
    command: "profile open-path",
    description:
      "Report the shared open-path demo policy, or evaluate one profile's demo operation against it; demo levels are never a shipping or production-readiness claim",
    flags: Object.freeze({
      "--profile": "Limit the report (or the evaluation) to one profile package name",
      "--operation":
        "Kernel-seam operation to evaluate (open, dispatch, advance, observe, save, replay); requires --profile",
    }),
  });
}

export function catalogListHelp(): ResultPayload {
  return Object.freeze({
    command: "catalog list",
    description:
      "List catalog items with pipeline state, metadataComplete, and inert commerce activation; metadataComplete is not listing readiness",
    flags: Object.freeze({
      "--dir": `Directory containing *${CATALOG_ITEM_SUFFIX} files (required)`,
      "--cwd": "Working directory for relative paths",
    }),
  });
}

export function assetListHelp(): ResultPayload {
  return Object.freeze({
    command: "asset list",
    description:
      "Read Catalog Item assetPackage refs by design; no document-backed asset schema is defined here (policy SoT: factories-helpers#47/#48)",
    flags: Object.freeze({
      "--dir": `Directory containing *${CATALOG_ITEM_SUFFIX} files (required)`,
      "--cwd": "Working directory for relative paths",
    }),
  });
}

export function evidenceListHelp(): ResultPayload {
  return Object.freeze({
    command: "evidence list",
    description: "List evidence packets written by `project capture`",
    flags: Object.freeze({
      "--dir": `Directory containing *${PROJECT_EVIDENCE_SUFFIX} files (required)`,
      "--cwd": "Working directory for relative paths",
    }),
  });
}
