/**
 * Held-key registry snapshot + CLI command map: typed mirrors of the seeded
 * contracts in packages/schemas/contracts (held-key-registry.schema.json,
 * cli-command-map.schema.json) with fail-closed structural validation.
 *
 * Enforcement semantics are normative in docs/held-key-enforcement.md. The
 * factories-helpers #42 Markdown registry documents keys for humans; it is
 * never the runtime source and nothing here reads it.
 */

import { createHash } from "node:crypto";

export const HELD_KEY_SCHEMA_VERSION = 1 as const;

/** Key/origin naming rule shared by both contracts. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const RFC3339_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))(?![\s\S])/;

export type HeldKeyState = "open" | "resolved";

export interface HeldKeyEntry {
  readonly key: string;
  readonly origin: string;
  readonly title: string;
  readonly state: HeldKeyState;
  readonly registeredAt: string;
  readonly resolvedAt?: string;
  readonly decisionRecord?: string;
}

export interface HeldKeyRegistrySnapshot {
  readonly schemaVersion: typeof HELD_KEY_SCHEMA_VERSION;
  readonly registryEpoch: number;
  readonly generatedAt: string;
  readonly source: string;
  readonly sourceDigest: string;
  readonly keys: readonly HeldKeyEntry[];
}

export interface CommandMapEntry {
  readonly command: string;
  readonly heldKeys: readonly string[];
  readonly composedOf?: readonly string[];
}

export interface CliCommandMap {
  readonly schemaVersion: typeof HELD_KEY_SCHEMA_VERSION;
  readonly builtForRegistryEpoch: number;
  readonly cliVersion: string;
  readonly commands: readonly CommandMapEntry[];
}

export type Validation<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly string[] };

const SNAPSHOT_PROPS = new Set([
  "schemaVersion",
  "registryEpoch",
  "generatedAt",
  "source",
  "sourceDigest",
  "keys",
]);
const ENTRY_PROPS = new Set([
  "key",
  "origin",
  "title",
  "state",
  "registeredAt",
  "resolvedAt",
  "decisionRecord",
]);
const MAP_PROPS = new Set([
  "schemaVersion",
  "builtForRegistryEpoch",
  "cliVersion",
  "commands",
]);
const MAP_ENTRY_PROPS = new Set(["command", "heldKeys", "composedOf"]);

export function isPlainObject(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isRegistryEpoch(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

export function isDateTimeString(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = RFC3339_DATE_TIME.exec(value);
  if (match === null) return false;

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    offsetHourText = "0",
    offsetMinuteText = "0",
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = Number(offsetHourText);
  const offsetMinute = Number(offsetMinuteText);

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (daysInMonth[month - 1] ?? 0) &&
    hour <= 23 &&
    minute <= 59 &&
    // Leap seconds fail closed because the runtime freshness clock cannot
    // compare them portably with Date.parse.
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  );
}

export function isHeldKeyName(value: unknown): value is string {
  return typeof value === "string" && KEY_PATTERN.test(value);
}

const byKey = (a: HeldKeyEntry, b: HeldKeyEntry): number =>
  a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

/**
 * Digest of the canonicalized key set: entries sorted by key, properties in
 * fixed order, JSON-encoded, sha256-hex. Recomputable from any snapshot, so
 * `sourceDigest` is verifiable — not just format-checked.
 */
export function computeSourceDigest(keys: readonly HeldKeyEntry[]): string {
  const canonical = [...keys].sort(byKey).map((k) => ({
    key: k.key,
    origin: k.origin,
    title: k.title,
    state: k.state,
    registeredAt: k.registeredAt,
    ...(k.resolvedAt === undefined ? {} : { resolvedAt: k.resolvedAt }),
    ...(k.decisionRecord === undefined
      ? {}
      : { decisionRecord: k.decisionRecord }),
  }));
  const hex = createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
  return `sha256:${hex}`;
}

function validateHeldKeyEntry(
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
    if (!ENTRY_PROPS.has(prop)) {
      local.push(`${label} has unknown property '${prop}' (additionalProperties: false)`);
    }
  }
  const key = raw["key"];
  const origin = raw["origin"];
  const title = raw["title"];
  const state = raw["state"];
  const registeredAt = raw["registeredAt"];
  const resolvedAt = raw["resolvedAt"];
  const decisionRecord = raw["decisionRecord"];

  if (!isHeldKeyName(key)) local.push(`${label}.key must match ${String(KEY_PATTERN)}`);
  if (!isHeldKeyName(origin)) local.push(`${label}.origin must match ${String(KEY_PATTERN)}`);
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
    isHeldKeyName(key) &&
    isHeldKeyName(origin) &&
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

/**
 * Fail-closed snapshot validation per held-key-registry.schema.json, plus
 * digest verification: `sourceDigest` must equal the digest recomputed from
 * the key set. Any deviation refuses.
 */
export function validateRegistrySnapshot(
  value: unknown,
): Validation<HeldKeyRegistrySnapshot> {
  if (!isPlainObject(value)) {
    return { ok: false, errors: ["held-key registry snapshot must be a JSON object"] };
  }
  const errors: string[] = [];
  for (const prop of Object.keys(value)) {
    if (!SNAPSHOT_PROPS.has(prop)) {
      errors.push(`snapshot has unknown property '${prop}' (additionalProperties: false)`);
    }
  }
  if (value["schemaVersion"] !== HELD_KEY_SCHEMA_VERSION) {
    errors.push("snapshot.schemaVersion must be the constant 1");
  }
  const registryEpoch = value["registryEpoch"];
  if (!isRegistryEpoch(registryEpoch)) {
    errors.push("snapshot.registryEpoch must be an integer >= 1");
  }
  const generatedAt = value["generatedAt"];
  if (!isDateTimeString(generatedAt)) {
    errors.push("snapshot.generatedAt must be an ISO date-time string");
  }
  const source = value["source"];
  if (typeof source !== "string" || source.length === 0) {
    errors.push("snapshot.source must be a non-empty string");
  }
  const sourceDigest = value["sourceDigest"];
  if (typeof sourceDigest !== "string" || !DIGEST_PATTERN.test(sourceDigest)) {
    errors.push(`snapshot.sourceDigest must match ${String(DIGEST_PATTERN)}`);
  }
  const rawKeys = value["keys"];
  const entries: HeldKeyEntry[] = [];
  if (!Array.isArray(rawKeys)) {
    errors.push("snapshot.keys must be an array");
  } else {
    rawKeys.forEach((raw: unknown, i: number) => {
      const entry = validateHeldKeyEntry(raw, `keys[${i}]`, errors);
      if (entry !== undefined) entries.push(entry);
    });
    const seen = new Set<string>();
    for (const entry of entries) {
      if (seen.has(entry.key)) {
        errors.push(`snapshot.keys contains duplicate key '${entry.key}'`);
      }
      seen.add(entry.key);
    }
    if (errors.length === 0 && typeof sourceDigest === "string") {
      const expected = computeSourceDigest(entries);
      if (expected !== sourceDigest) {
        errors.push(
          "snapshot.sourceDigest does not match the canonicalized key set (digest verification failed)",
        );
      }
    }
  }

  if (
    errors.length === 0 &&
    isRegistryEpoch(registryEpoch) &&
    isDateTimeString(generatedAt) &&
    typeof source === "string" &&
    typeof sourceDigest === "string"
  ) {
    return {
      ok: true,
      value: {
        schemaVersion: HELD_KEY_SCHEMA_VERSION,
        registryEpoch,
        generatedAt,
        source,
        sourceDigest,
        keys: entries,
      },
    };
  }
  return {
    ok: false,
    errors: errors.length > 0 ? errors : ["snapshot failed validation"],
  };
}

/**
 * Fail-closed command-map validation per cli-command-map.schema.json, plus the
 * composition rule the schema documents for CI: a composed verb's heldKeys
 * must be a superset of every composed verb's heldKeys (dependency closure).
 */
export function validateCommandMap(value: unknown): Validation<CliCommandMap> {
  if (!isPlainObject(value)) {
    return { ok: false, errors: ["CLI command map must be a JSON object"] };
  }
  const errors: string[] = [];
  for (const prop of Object.keys(value)) {
    if (!MAP_PROPS.has(prop)) {
      errors.push(`command map has unknown property '${prop}' (additionalProperties: false)`);
    }
  }
  if (value["schemaVersion"] !== HELD_KEY_SCHEMA_VERSION) {
    errors.push("commandMap.schemaVersion must be the constant 1");
  }
  const builtForRegistryEpoch = value["builtForRegistryEpoch"];
  if (!isRegistryEpoch(builtForRegistryEpoch)) {
    errors.push("commandMap.builtForRegistryEpoch must be an integer >= 1");
  }
  const cliVersion = value["cliVersion"];
  if (typeof cliVersion !== "string" || cliVersion.length === 0) {
    errors.push("commandMap.cliVersion must be a non-empty string");
  }
  const rawCommands = value["commands"];
  const entries: CommandMapEntry[] = [];
  if (!Array.isArray(rawCommands)) {
    errors.push("commandMap.commands must be an array");
  } else {
    rawCommands.forEach((raw: unknown, i: number) => {
      const entry = validateCommandMapEntry(raw, `commands[${i}]`, errors);
      if (entry !== undefined) entries.push(entry);
    });
    const seen = new Set<string>();
    for (const entry of entries) {
      if (seen.has(entry.command)) {
        errors.push(`commandMap declares '${entry.command}' more than once`);
      }
      seen.add(entry.command);
    }
    // Dependency closure: composed verbs carry the union of their parts' keys.
    const byCommand = new Map(entries.map((e) => [e.command, e]));
    for (const entry of entries) {
      for (const ref of entry.composedOf ?? []) {
        const target = byCommand.get(ref);
        if (target === undefined) {
          errors.push(`'${entry.command}' composes undeclared verb '${ref}'`);
          continue;
        }
        const missing = target.heldKeys.filter((k) => !entry.heldKeys.includes(k));
        if (missing.length > 0) {
          errors.push(
            `'${entry.command}'.heldKeys must be a superset of composed verb '${ref}' (missing: ${missing.join(", ")})`,
          );
        }
      }
    }
  }

  if (
    errors.length === 0 &&
    isRegistryEpoch(builtForRegistryEpoch) &&
    typeof cliVersion === "string"
  ) {
    return {
      ok: true,
      value: {
        schemaVersion: HELD_KEY_SCHEMA_VERSION,
        builtForRegistryEpoch,
        cliVersion,
        commands: entries,
      },
    };
  }
  return {
    ok: false,
    errors: errors.length > 0 ? errors : ["command map failed validation"],
  };
}

function validateCommandMapEntry(
  raw: unknown,
  label: string,
  errors: string[],
): CommandMapEntry | undefined {
  if (!isPlainObject(raw)) {
    errors.push(`${label} must be an object`);
    return undefined;
  }
  const local: string[] = [];
  for (const prop of Object.keys(raw)) {
    if (!MAP_ENTRY_PROPS.has(prop)) {
      local.push(`${label} has unknown property '${prop}' (additionalProperties: false)`);
    }
  }
  const command = raw["command"];
  if (typeof command !== "string" || command.length === 0) {
    local.push(`${label}.command must be a non-empty string`);
  }
  const rawHeldKeys = raw["heldKeys"];
  const heldKeys: string[] = [];
  if (!Array.isArray(rawHeldKeys)) {
    local.push(`${label}.heldKeys must be an array (empty means explicitly ungated)`);
  } else {
    rawHeldKeys.forEach((k: unknown, i: number) => {
      if (isHeldKeyName(k)) heldKeys.push(k);
      else local.push(`${label}.heldKeys[${i}] must match ${String(KEY_PATTERN)}`);
    });
    if (new Set(heldKeys).size !== heldKeys.length) {
      local.push(`${label}.heldKeys contains duplicates`);
    }
  }
  const rawComposedOf = raw["composedOf"];
  const composedOf: string[] = [];
  if (rawComposedOf !== undefined) {
    if (!Array.isArray(rawComposedOf)) {
      local.push(`${label}.composedOf must be an array when present`);
    } else {
      rawComposedOf.forEach((ref: unknown, i: number) => {
        if (typeof ref === "string" && ref.length > 0) composedOf.push(ref);
        else local.push(`${label}.composedOf[${i}] must be a non-empty string`);
      });
    }
  }

  if (local.length > 0) {
    errors.push(...local);
    return undefined;
  }
  if (typeof command === "string") {
    return {
      command,
      heldKeys,
      ...(rawComposedOf === undefined ? {} : { composedOf }),
    };
  }
  return undefined;
}
