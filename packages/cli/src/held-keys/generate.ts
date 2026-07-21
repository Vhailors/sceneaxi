/**
 * Registry snapshot generator: FirstMate structured-backlog export → held-key
 * registry snapshot (held-key-registry.schema.json).
 *
 * The only admissible input is the authoritative FirstMate structured captain
 * holds export (tasks-axi). A snapshot is NEVER generated from a Markdown
 * document — the factories-helpers #42 registry documents keys for humans and
 * stays the human-facing source of truth, outside this runtime protocol
 * (docs/held-key-enforcement.md).
 */

import {
  computeSourceDigest,
  isDateTimeString,
  isHeldKeyName,
  isPlainObject,
  isRegistryEpoch,
  validateRegistrySnapshot,
  HELD_KEY_SCHEMA_VERSION,
  type HeldKeyEntry,
  type HeldKeyRegistrySnapshot,
  type HeldKeyState,
  type Validation,
} from "./registry.js";

/** Discriminator every structured backlog export must carry. */
export const FIRSTMATE_EXPORT_FORMAT = "firstmate-structured-backlog" as const;

/** Captain-hold identities take the form `<origin>-decision-<key>`. */
const IDENTITY_MARKER = "-decision-";

/** Sources that look like Markdown documents are refused outright. */
const MARKDOWN_SOURCE = /(\.md|\.markdown)$|markdown/i;

export interface FirstMateHoldRecord {
  readonly identity: string;
  readonly title: string;
  readonly state: HeldKeyState;
  readonly registeredAt: string;
  readonly resolvedAt?: string;
  readonly decisionRecord?: string;
}

export interface FirstMateBacklogExport {
  readonly format: typeof FIRSTMATE_EXPORT_FORMAT;
  readonly source: string;
  readonly registryEpoch: number;
  readonly exportedAt: string;
  readonly holds: readonly FirstMateHoldRecord[];
}

const EXPORT_PROPS = new Set([
  "format",
  "source",
  "registryEpoch",
  "exportedAt",
  "holds",
]);
const HOLD_PROPS = new Set([
  "identity",
  "title",
  "state",
  "registeredAt",
  "resolvedAt",
  "decisionRecord",
]);

export interface GenerateSnapshotOptions {
  /**
   * Highest registry epoch this consumer has already observed. The epoch is
   * monotonic; an export below it is a regression and refuses.
   */
  readonly previousRegistryEpoch?: number;
}

/**
 * Generate a schema-valid registry snapshot from a structured backlog export.
 * Fail-closed: anything that is not exactly a well-formed structured export
 * refuses with errors instead of producing a snapshot. The emitted snapshot is
 * re-validated (including digest verification) before it is returned.
 */
export function generateRegistrySnapshot(
  input: unknown,
  options: GenerateSnapshotOptions = {},
): Validation<HeldKeyRegistrySnapshot> {
  if (typeof input === "string") {
    return {
      ok: false,
      errors: [
        "backlog export is raw text, not a structured export; Markdown registries document keys for humans and are never the runtime source (docs/held-key-enforcement.md)",
      ],
    };
  }
  if (!isPlainObject(input)) {
    return { ok: false, errors: ["backlog export must be a JSON object"] };
  }

  const errors: string[] = [];
  for (const prop of Object.keys(input)) {
    if (!EXPORT_PROPS.has(prop)) {
      errors.push(`export has unknown property '${prop}' (fail closed)`);
    }
  }
  if (input["format"] !== FIRSTMATE_EXPORT_FORMAT) {
    errors.push(
      `export.format must be '${FIRSTMATE_EXPORT_FORMAT}' — snapshots are generated only from the authoritative FirstMate structured backlog`,
    );
  }
  const source = input["source"];
  if (typeof source !== "string" || source.length === 0) {
    errors.push("export.source must be a non-empty string");
  } else if (MARKDOWN_SOURCE.test(source)) {
    errors.push(
      `export.source '${source}' looks like a Markdown document; a registry snapshot is never generated from Markdown (docs/held-key-enforcement.md)`,
    );
  }
  const registryEpoch = input["registryEpoch"];
  if (!isRegistryEpoch(registryEpoch)) {
    errors.push("export.registryEpoch must be an integer >= 1");
  } else if (
    options.previousRegistryEpoch !== undefined &&
    registryEpoch < options.previousRegistryEpoch
  ) {
    errors.push(
      `export.registryEpoch ${registryEpoch} regresses below previously observed epoch ${options.previousRegistryEpoch}; the registry epoch is monotonic`,
    );
  }
  const exportedAt = input["exportedAt"];
  if (!isDateTimeString(exportedAt)) {
    errors.push("export.exportedAt must be an ISO date-time string");
  }
  const holds = input["holds"];
  const entries: HeldKeyEntry[] = [];
  if (!Array.isArray(holds)) {
    errors.push("export.holds must be an array");
  } else {
    holds.forEach((raw: unknown, i: number) => {
      const entry = holdToEntry(raw, `holds[${i}]`, errors);
      if (entry !== undefined) entries.push(entry);
    });
    const seen = new Set<string>();
    for (const entry of entries) {
      if (seen.has(entry.key)) {
        errors.push(`export derives duplicate held key '${entry.key}'`);
      }
      seen.add(entry.key);
    }
  }

  if (
    errors.length > 0 ||
    !isRegistryEpoch(registryEpoch) ||
    !isDateTimeString(exportedAt) ||
    typeof source !== "string"
  ) {
    return {
      ok: false,
      errors: errors.length > 0 ? errors : ["export failed validation"],
    };
  }

  const keys = [...entries].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
  );
  const snapshot: HeldKeyRegistrySnapshot = {
    schemaVersion: HELD_KEY_SCHEMA_VERSION,
    registryEpoch,
    generatedAt: exportedAt,
    source,
    sourceDigest: computeSourceDigest(keys),
    keys,
  };
  // Emitted snapshots are verified against the contract, digest included.
  return validateRegistrySnapshot(snapshot);
}

function holdToEntry(
  raw: unknown,
  label: string,
  errors: string[],
): HeldKeyEntry | undefined {
  if (!isPlainObject(raw)) {
    errors.push(`${label} must be an object`);
    return undefined;
  }
  const local: string[] = [];
  for (const prop of Object.keys(raw)) {
    if (!HOLD_PROPS.has(prop)) {
      local.push(`${label} has unknown property '${prop}' (fail closed)`);
    }
  }

  const identity = raw["identity"];
  let origin: string | undefined;
  let key: string | undefined;
  if (typeof identity !== "string") {
    local.push(`${label}.identity must be a string`);
  } else {
    const markerIndex = identity.indexOf(IDENTITY_MARKER);
    if (markerIndex <= 0) {
      local.push(
        `${label}.identity '${identity}' must take the form <origin>${IDENTITY_MARKER}<key>`,
      );
    } else {
      origin = identity.slice(0, markerIndex);
      key = identity.slice(markerIndex + IDENTITY_MARKER.length);
      if (!isHeldKeyName(origin)) local.push(`${label}.identity has an invalid origin '${origin}'`);
      if (!isHeldKeyName(key)) local.push(`${label}.identity has an invalid key '${key ?? ""}'`);
    }
  }

  const title = raw["title"];
  const state = raw["state"];
  const registeredAt = raw["registeredAt"];
  const resolvedAt = raw["resolvedAt"];
  const decisionRecord = raw["decisionRecord"];
  if (typeof title !== "string" || title.length === 0) local.push(`${label}.title must be a non-empty string`);
  if (state !== "open" && state !== "resolved") local.push(`${label}.state must be 'open' or 'resolved'`);
  if (!isDateTimeString(registeredAt)) local.push(`${label}.registeredAt must be an ISO date-time string`);
  if (resolvedAt !== undefined && !isDateTimeString(resolvedAt)) local.push(`${label}.resolvedAt must be an ISO date-time string`);
  if (decisionRecord !== undefined && (typeof decisionRecord !== "string" || decisionRecord.length === 0)) {
    local.push(`${label}.decisionRecord must be a non-empty string`);
  }
  if (state === "resolved" && (resolvedAt === undefined || decisionRecord === undefined)) {
    local.push(`${label} is resolved but is missing resolvedAt and/or decisionRecord`);
  }

  if (local.length > 0) {
    errors.push(...local);
    return undefined;
  }
  if (
    isHeldKeyName(origin) &&
    isHeldKeyName(key) &&
    typeof title === "string" &&
    (state === "open" || state === "resolved") &&
    isDateTimeString(registeredAt)
  ) {
    return {
      key,
      origin,
      title,
      state,
      registeredAt,
      ...(isDateTimeString(resolvedAt) ? { resolvedAt } : {}),
      ...(typeof decisionRecord === "string" ? { decisionRecord } : {}),
    };
  }
  return undefined;
}
