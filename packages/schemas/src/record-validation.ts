/**
 * Record-validation helpers shared by the identity, credits, and billing
 * contracts and their untrusted adapter boundaries.
 */

import { CATALOG_DATE_TIME_PATTERN } from "./catalog.js";

/**
 * RFC 3339 date-time with a mandatory explicit timezone. Same expression the
 * catalog contract uses — one regex, so a timestamp accepted by one SceneAxi
 * contract is accepted by all of them.
 */
export const RFC3339_DATE_TIME_PATTERN = CATALOG_DATE_TIME_PATTERN;

const DATE_TIME_RE = new RegExp(RFC3339_DATE_TIME_PATTERN);

/** A refusal carrying the contract's own named code. */
export type ContractRefuse<Code extends string> = {
  readonly ok: false;
  readonly code: Code;
  readonly message: string;
};

export function refuseWith<Code extends string>(
  code: Code,
  message: string,
): ContractRefuse<Code> {
  return Object.freeze({ ok: false, code, message });
}

/**
 * A plain, own-property-only object. Prototype-carrying values, arrays, and
 * exotic objects are rejected so a getter or inherited property can never
 * decide a contract check.
 */
export function snapshotPlainRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        return undefined;
      }
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return undefined;
  }
}

/**
 * A plain, own-property-only array snapshot.
 *
 * Mirrors `snapshotPlainRecord` for arrays: a Proxy-wrapped array passes
 * `Array.isArray` but can throw or lie during iteration, so every element is read
 * through its own data descriptor before the snapshot is trusted. An accessor, a
 * non-array prototype, or a throw returns `undefined` so the caller can fail closed.
 */
export function snapshotPlainArray(
  value: unknown,
): ReadonlyArray<unknown> | undefined {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) === false
    ) {
      return undefined;
    }
    if (Object.getPrototypeOf(value) !== Array.prototype) return undefined;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      typeof lengthDescriptor.value !== "number"
    ) {
      return undefined;
    }
    const length = lengthDescriptor.value;
    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(
        value,
        String(index),
      );
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        return undefined;
      }
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    return undefined;
  }
}

export function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  return snapshotPlainRecord(value) !== undefined;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isDateTime(value: unknown): value is string {
  return typeof value === "string" && DATE_TIME_RE.test(value);
}

/** A safe integer — rejects NaN, Infinity, and fractional values. */
export function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function isEpochMilliseconds(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isFinite(new Date(value).getTime())
  );
}

/** The first required key absent from the record, or undefined. */
export function firstMissingKey(
  record: Record<string, unknown>,
  required: ReadonlyArray<string>,
): string | undefined {
  return required.find((key) => !Object.hasOwn(record, key));
}

/** The first key present but not permitted, or undefined. */
export function firstUnexpectedKey(
  record: Record<string, unknown>,
  required: ReadonlyArray<string>,
  optional: ReadonlyArray<string> = [],
): string | undefined {
  const allowed = new Set([...required, ...optional]);
  return Object.keys(record).find((key) => !allowed.has(key));
}
