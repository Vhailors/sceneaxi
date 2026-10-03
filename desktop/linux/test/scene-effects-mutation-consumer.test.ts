import { describe, expect, it } from "vitest";
import { COMPOSED_SCENE_DOCUMENT_DATA_KEY, parseSceneEffectsMutation, SCENE_EFFECTS_REFUSALS } from "@sceneaxi/schemas";
import { desktopOpenScene, stageDesktopSceneEffects } from "../src/lib/desktop-scene.js";

const fixtures = [
  {
    "kind": "upsert",
    "emitterId": "spark",
    "emitterKind": "point",
    "rate": 8,
    "lifetimeMs": 800,
    "speed": 1,
    "spread": 0.4,
    "instanceId": "desktop-crate-beside",
    "color": "#ffffff",
    "size": 1
  },
  {
    "kind": "remove",
    "emitterId": "spark"
  },
  {
    "kind": "seed-set",
    "seed": 1
  }
];

const wrongValues = [undefined, null, false, 7, "text", [], {}, 1n, Symbol("field"), () => 1, new Date()];

/** The schema parser owns raw malformed field fixtures and their refusals. */
type MutationFieldInput = Parameters<typeof parseSceneEffectsMutation>[0];

type FixturePrimitiveTypes = { string: string; number: number; boolean: boolean; undefined: undefined; bigint: bigint; symbol: symbol; function: (...args: never[]) => MutationFieldInput; object: object | null };

function isFixturePrimitive<Kind extends keyof FixturePrimitiveTypes>(value: MutationFieldInput, kind: Kind): value is FixturePrimitiveTypes[Kind] {
  return (
    (kind === "string" && isBoundaryTextValue(value)) ||
    (kind === "number" && isBoundaryNumericValue(value)) ||
    (kind === "boolean" && isBoundaryBooleanValue(value)) ||
    (kind === "bigint" && isBoundaryBigIntValue(value)) ||
    (kind === "symbol" && isBoundarySymbolValue(value)) ||
    (kind === "object" && isBoundaryObjectValue(value)) ||
    (kind === "function" && isBoundaryCallableValue(value)) ||
    (kind === "undefined" && isBoundaryUndefinedValue(value))
  );
}

function sameFieldType(original: MutationFieldInput, candidate: MutationFieldInput): boolean {
  if (original === null) return candidate === null || isProtocolText(candidate);

  if (Array.isArray(original)) return Array.isArray(candidate);

  return (["string", "number", "boolean", "undefined", "bigint", "symbol", "function", "object"] as const)
    .some(kind => isFixturePrimitive(original, kind) && isFixturePrimitive(candidate, kind));
}

describe("checked effects public desktop mutation consumer", () => {
  it("public desktop consumer admits a positive fixture without mutating the original", () => {
    const opened = desktopOpenScene();

    if (!opened.ok) throw new Error(opened.message);
    const documentData = { [COMPOSED_SCENE_DOCUMENT_DATA_KEY]: opened.composed.scene };
    const before = JSON.stringify(documentData);
    const mutation = { ...fixtures[0], instanceId: undefined };
    expect(stageDesktopSceneEffects({ documentData, contentHash: "sha256:" + "ab".repeat(32), mutation })).toMatchObject({ ok: true });
    expect(JSON.stringify(documentData)).toBe(before);
  });

  it("public desktop consumer refuses malformed fields with zero partial apply/accessor hooks", () => {
    const opened = desktopOpenScene();

    if (!opened.ok) throw new Error(opened.message);
    const documentData = { [COMPOSED_SCENE_DOCUMENT_DATA_KEY]: opened.composed.scene };
    const before = JSON.stringify(documentData);
    let hooks = 0;
    const malformed = Object.defineProperty({ ...fixtures[0] }, "kind", { enumerable: true, get() { hooks += 1; throw new Error("accessor"); } });

    for (const fixture of fixtures) {
      for (const [field, original] of Object.entries(fixture)) {
        for (const candidate of wrongValues) {
          if (sameFieldType(original, candidate)) continue;
          const mutation = { ...fixture, [field]: candidate };

          if (candidate === undefined && parseSceneEffectsMutation(mutation) !== null) continue;
          expect(stageDesktopSceneEffects({ documentData, contentHash: "sha256:" + "ab".repeat(32), mutation })).toMatchObject({ ok: false, reason: SCENE_EFFECTS_REFUSALS.inputUnsupported });
          expect(JSON.stringify(documentData)).toBe(before);
        }
      }
    }

    let coercions = 0;
    const executable = { toString() { coercions += 1; throw new Error("coercion"); }, [Symbol.toPrimitive]() { coercions += 1; throw new Error("conversion"); } };
    expect(stageDesktopSceneEffects({ documentData, contentHash: "sha256:" + "ab".repeat(32), mutation: { ...fixtures[0], kind: executable } })).toMatchObject({ ok: false, reason: SCENE_EFFECTS_REFUSALS.inputUnsupported });
    expect(coercions).toBe(0);
    const result = stageDesktopSceneEffects({ documentData, contentHash: "sha256:" + "ab".repeat(32), mutation: malformed });
    expect(result).toMatchObject({ ok: false, reason: SCENE_EFFECTS_REFUSALS.inputUnsupported });
    expect(JSON.stringify(documentData)).toBe(before);
    expect(hooks).toBe(0);
  });
});

function isProtocolText<Value>(value: Value): value is Value & (string) {
  return typeof value === "string";
}

type BoundaryObjectValue = object | null;

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryTextValue<Input>(value: Input): value is Input & string {
  return typeof value === "string";
}

function isBoundaryNumericValue<Input>(value: Input): value is Input & number {
  return typeof value === "number";
}

function isBoundaryBooleanValue<Input>(value: Input): value is Input & boolean {
  return typeof value === "boolean";
}

function isBoundaryBigIntValue<Input>(value: Input): value is Input & bigint {
  return typeof value === "bigint";
}

function isBoundarySymbolValue<Input>(value: Input): value is Input & symbol {
  return typeof value === "symbol";
}

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}

function isBoundaryUndefinedValue<Input>(value: Input): value is Input & undefined {
  return typeof value === "undefined";
}
