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
  isCommerceActive,
  missingMandatoryMetadata,
  profileConformanceRegistry,
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
const CATALOG_LIST_FLAGS = new Set(["--dir", "--cwd"]);
const ASSET_LIST_FLAGS = new Set(["--dir", "--cwd"]);
const EVIDENCE_LIST_FLAGS = new Set(["--dir", "--cwd"]);

const CATALOG_ITEM_SUFFIX = ".catalog-item.json";

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
      listable: missing.length === 0,
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
      "Items missing mandatory metadata cannot reach the listed state",
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

export function catalogListHelp(): ResultPayload {
  return Object.freeze({
    command: "catalog list",
    description:
      "List catalog items in a directory with pipeline state and inert commerce activation",
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
