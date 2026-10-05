import type { JsonValue } from "@sceneaxi/schemas";

/** Durable answers are JSON *values*, not arbitrary JS instances. These bounds
 * apply during traversal, before any user serialization hook can run. */
export const HOSTED_RESPONSE_MAX_BYTES = 262144;
const MAX_VALUES = 32768;
const MAX_DEPTH = 64;

export type HostedResponseSnapshot = Readonly<{ value: JsonValue; json: string }>;

/** Snapshot data descriptors once and serialize the owned snapshot, never the
 * supplied object. Map/Date/BigInt, accessors, cycles, sparse/custom arrays,
 * functions, symbols, non-finite numbers and -0 are unsupported. Unicode must
 * also be representable by PostgreSQL jsonb (no NUL or lone surrogate).
 * Throwing reflection/proxies fail closed. Repeated acyclic objects have JSON
 * value semantics; prototypes/object identity are not a durable contract. */
export function snapshotHostedResponse(candidate: unknown): HostedResponseSnapshot | undefined {
  const ancestors = new Set<object>();
  const chunks: string[] = [];
  let bytes = 0;
  let values = 0;
  const emit = (text: string): void => {
    bytes += new TextEncoder().encode(text).byteLength;
    if (bytes > HOSTED_RESPONSE_MAX_BYTES) throw new Error("hosted response byte limit");
    chunks.push(text);
  };
  const emitString = (text: string): void => {
    if (text.length > HOSTED_RESPONSE_MAX_BYTES || text.includes("\0") || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text)) throw new Error("unsupported hosted response string");
    emit(JSON.stringify(text));
  };
  const visit = (value: unknown, depth: number): JsonValue => {
    if (++values > MAX_VALUES || depth > MAX_DEPTH) throw new Error("hosted response traversal limit");
    if (value === null || typeof value === "boolean") { emit(JSON.stringify(value)); return value; }
    if (typeof value === "string") { emitString(value); return value; }
    if (typeof value === "number") {
      if (!Number.isFinite(value) || Object.is(value, -0)) throw new Error("unsupported hosted response number");
      emit(JSON.stringify(value));
      return value;
    }
    if (typeof value !== "object" || ancestors.has(value)) throw new Error("unsupported hosted response value");
    const prototype: unknown = Object.getPrototypeOf(value);
    const array = Array.isArray(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error("unsupported hosted response prototype");
    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_VALUES) throw new Error("hosted response key limit");
    ancestors.add(value);
    if (array) {
      const length: unknown = Object.getOwnPropertyDescriptor(value, "length")?.value;
      if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > MAX_VALUES || keys.length !== length + 1) throw new Error("unsupported hosted response array");
      const copy: JsonValue[] = [];
      emit("[");
      for (let i = 0; i < length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) throw new Error("unsupported hosted response array property");
        const child: unknown = descriptor.value;
        if (i > 0) emit(",");
        copy.push(visit(child, depth + 1));
      }
      emit("]");
      ancestors.delete(value);
      return Object.freeze(copy);
    }
    const copy: { [key: string]: JsonValue } = {};
    emit("{");
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (typeof key !== "string") throw new Error("unsupported hosted response key");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) throw new Error("unsupported hosted response property");
      const child: unknown = descriptor.value;
      if (i > 0) emit(",");
      emitString(key);
      emit(":");
      Object.defineProperty(copy, key, { value: visit(child, depth + 1), enumerable: true });
    }
    emit("}");
    ancestors.delete(value);
    return Object.freeze(copy);
  };
  try {
    const value = visit(candidate, 0);
    return Object.freeze({ value, json: chunks.join("") });
  } catch { return undefined; }
}
