import { parseSceneEnvironmentMutation } from "@sceneaxi/schemas";

/** Descriptor-only inputs use the mutation parser’s raw contract; accepted snapshots contain only inert protocol data. */
type CatalogProtocolInput = Parameters<typeof parseSceneEnvironmentMutation>[0];

type CatalogProtocolSnapshot = string | number | boolean | null | undefined | readonly CatalogProtocolSnapshot[] | CatalogProtocolRecord;

interface CatalogProtocolRecord { readonly [field: string]: CatalogProtocolSnapshot; }

import { types } from "node:util";

/** Translate renderer-realm protocol containers, not the domain mutation schema.
 * Read descriptors only: cloning via JSON/structuredClone would invoke getters,
 * erase unsupported values, and bypass the existing parser refusal semantics.
 */
export function translateCatalogAuthoringMutation(value: CatalogProtocolInput): CatalogProtocolSnapshot {
  let remaining = 8192;
  const ancestors = new Set<object>();

  function intrinsicPrototype(prototype: CatalogProtocolInput, name: "Object" | "Array"): boolean {
    if (types.isProxy(prototype)) return false;
    const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor");

    if (constructor === undefined || !("value" in constructor)) return false;
    const fn: unknown = constructor.value;

    if (!isProtocolCallable(fn) || types.isProxy(fn)) return false;
    const target = Object.getOwnPropertyDescriptor(fn, "prototype");

    return target !== undefined && "value" in target && target.value === prototype &&
      Function.prototype.toString.call(fn) === `function ${name}() { [native code] }`;
  }

  function snapshot(entry: CatalogProtocolInput, depth: number): CatalogProtocolSnapshot {
    if (--remaining < 0 || depth > 32) throw new Error("Catalog protocol budget exceeded");

    if (entry === null || entry === undefined || isProtocolText(entry) ||
        isProtocolNumber(entry) || isProtocolBoolean(entry)) return entry;

    if (!isProtocolObject(entry) || types.isProxy(entry) || ancestors.has(entry)) {
      throw new Error("Catalog protocol requires inert values");
    }

    const prototype: unknown = Object.getPrototypeOf(entry);
    const array = Array.isArray(entry);

    if (array) {
      if (prototype === null || !isProtocolObject(prototype) || !intrinsicPrototype(prototype, "Array")) {
        throw new Error("Catalog protocol requires ordinary arrays");
      }
    } else if (prototype !== null && (!isProtocolObject(prototype) || types.isProxy(prototype) ||
        Object.getPrototypeOf(prototype) !== null || !intrinsicPrototype(prototype, "Object"))) {
      throw new Error("Catalog protocol requires plain records");
    }

    ancestors.add(entry);

    try {
      const keys = Reflect.ownKeys(entry);

      if (array) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(entry, "length");
        const length: unknown = lengthDescriptor?.value;

        if (!isProtocolNumber(length) || !Number.isSafeInteger(length) || length < 0 || length > 4096 ||
            keys.length !== length + 1) throw new Error("Catalog protocol requires dense arrays");
        const result: CatalogProtocolSnapshot[] = [];

        for (let index = 0; index < length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(entry, String(index));

          if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
            throw new Error("Catalog protocol array accessor or hole");
          }

          result.push(snapshot(descriptor.value, depth + 1));
        }

        return Object.freeze(result);
      }

      const result: { [field: string]: CatalogProtocolSnapshot } = {};

      for (const key of keys) {
        if (!isProtocolText(key)) throw new Error("Catalog protocol symbol key");
        const descriptor = Object.getOwnPropertyDescriptor(entry, key);

        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          throw new Error("Catalog protocol record accessor");
        }

        Object.defineProperty(result, key, { value: snapshot(descriptor.value, depth + 1), enumerable: true });
      }

      return Object.freeze(result);
    } finally {
      ancestors.delete(entry);
    }
  }

  try {
    return snapshot(value, 0);
  } catch {
    // Each existing domain parser turns null into its registered input refusal.
    return null;
  }
}

function isProtocolCallable<Value>(value: Value): value is Value & ((...args: never[]) => CatalogProtocolInput) {
  return isBoundaryCallableValue(value);
}

function isProtocolText<Value>(value: Value): value is Value & (string) {
  return typeof value === "string";
}

function isProtocolNumber<Value>(value: Value): value is Value & (number) {
  return typeof value === "number";
}

function isProtocolBoolean<Value>(value: Value): value is Value & (boolean) {
  return typeof value === "boolean";
}

function isProtocolObject<Value>(value: Value): value is Value & (object | null) {
  return isBoundaryObjectValue(value);
}

type BoundaryObjectValue = object | null;

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
