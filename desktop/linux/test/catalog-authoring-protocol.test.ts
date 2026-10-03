import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { EDITOR_COMMAND_REFUSALS } from "@sceneaxi/schemas";
import { createDesktopBridge, DESKTOP_ACTIVE_DOCUMENT_PATH, seedDesktopProject } from "../src/index.js";
import { translateCatalogAuthoringMutation } from "../src/lib/bridge/catalog-authoring.js";

const fixtures = [
  { id: "animation-apply", mutation: { kind: "clip-upsert", clipId: "golden", name: "Golden", startMs: 0, durationMs: 1000 }, field: "durationMs", invalid: -1 },
  { id: "physics-apply", mutation: { kind: "world-set", gravityY: -7, stepMs: 16, seed: 13, engine: "rapier" }, field: "stepMs", invalid: -1 },
  { id: "environment-apply", mutation: { kind: "set", background: "#123456", exposure: 2 }, field: "exposure", invalid: -1 },
  { id: "material-apply", mutation: { kind: "upsert", instanceId: "desktop-crate-beside", emissiveColor: "#123456", emissiveIntensity: 2, opacity: 0.5, baseColorMapAssetId: null, normalMapAssetId: null, roughnessMapAssetId: null }, field: "opacity", invalid: 2 },
  { id: "effect-apply", mutation: { kind: "seed-set", seed: 17 }, field: "seed", invalid: -1 },
];

type CatalogMutationInput = Parameters<typeof translateCatalogAuthoringMutation>[0];

type CatalogMutationOverrides = { expectedContentHash?: string };

type CatalogCycleFixture = (typeof fixtures)[number]["mutation"] & { cycle?: CatalogCycleFixture };

type CatalogNestedFixture = { nested?: CatalogNestedFixture };

function foreign(value: CatalogMutationInput): CatalogMutationInput {
  return runInNewContext(`JSON.parse(bytes)`, { bytes: JSON.stringify(value) });
}

function withBridge(test: (context: { apply: (id: string, mutation: CatalogMutationInput, overrides?: CatalogMutationOverrides) => ReturnType<ReturnType<typeof createDesktopBridge>["handle"]>; accept: () => ReturnType<ReturnType<typeof createDesktopBridge>["handle"]>; bytes: () => string; before: string }) => void) {
  const root = mkdtempSync(join(tmpdir(), "catalog-protocol-"));
  const bridge = createDesktopBridge({ cwd: root });

  try {
    expect(seedDesktopProject(root)).toMatchObject({ ok: true });
    const bytes = () => readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    const before = bytes();
    const expectedContentHash = `sha256:${createHash("sha256").update(before).digest("hex")}`;

    const apply = (id: string, mutation: CatalogMutationInput, overrides: CatalogMutationOverrides = {}) => bridge.handle({
      action: "command",
      payload: { schemaVersion: 1, commandId: id, client: "desktop-control", permission: "project:write", profile: "game",
        input: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH, expectedContentHash, profile: "game", mutation, ...overrides } },
    });

    const accept = () => bridge.handle({ action: "command", payload: {
      schemaVersion: 1, commandId: "change-review-accept", client: "desktop-control", permission: "project:write", profile: "game", input: {},
    } });

    test({ apply, accept, bytes, before });
  } finally {
    bridge.close();
    rmSync(root, { recursive: true, force: true });
  }
}

describe("public bridge catalog protocol translation", () => {
  for (const fixture of fixtures) {
    it(`${fixture.id} translates foreign plain renderer mutation into real review and persists only after acceptance`, () => withBridge(({ apply, accept, bytes, before }) => {
      expect(apply(fixture.id, foreign(fixture.mutation))).toMatchObject({ ok: true, data: { authoringSnapshot: { phase: "reviewing" }, transaction: { status: "reviewing", progress: { phase: "reviewing", terminal: false }, refusal: null } } });
      expect(bytes()).toBe(before);
      expect(accept()).toMatchObject({ ok: true, data: { phase: "applied" } });
      expect(bytes()).not.toBe(before);
    }));
    it(`${fixture.id} preserves malformed, range, accessor and stale refusal without hooks or writes`, () => withBridge(({ apply, bytes, before }) => {
      let hooks = 0;
      const getter = Object.defineProperty({ ...fixture.mutation }, fixture.field, { enumerable: true, get() { hooks += 1; throw new Error("getter"); } });
      const cycle: CatalogCycleFixture = { ...fixture.mutation };
      cycle["cycle"] = cycle;

      for (const mutation of [foreign({ ...fixture.mutation, [fixture.field]: {} }), foreign({ ...fixture.mutation, [fixture.field]: fixture.invalid }),
          { ...fixture.mutation, [fixture.field]: NaN }, { ...fixture.mutation, [fixture.field]: Infinity }, getter,
          Object.create(fixture.mutation), cycle, new Proxy(fixture.mutation, { get() { hooks += 1; throw new Error("proxy"); } })]) {
        expect(apply(fixture.id, mutation)).toMatchObject({ ok: false });
        expect(bytes()).toBe(before);
      }

      expect(hooks).toBe(0);
      expect(apply(fixture.id, foreign(fixture.mutation), { expectedContentHash: `sha256:${"00".repeat(32)}` })).toMatchObject({ ok: false, transaction: { status: "refused", progress: { phase: "refused", terminal: true }, refusal: EDITOR_COMMAND_REFUSALS.staleBase } });
      expect(bytes()).toBe(before);
    }));
  }

  it("translates nested renderer arrays and v2 environment fields through the domain parser", () => withBridge(({ apply, bytes, before }) => {
    const mutation = { kind: "set", keyDirection: [1, 2, 3], effects: ["bloom"],
      sky: { top: "#123456", horizon: "#345678", ground: "#567890" },
      shadowBudget: { mapSize: 1024, maxDistance: 20 }, bloom: { strength: 1, threshold: 0.5, radius: 0.5 } };

    expect(apply("environment-apply", foreign(mutation))).toMatchObject({ ok: true, data: { authoringSnapshot: { phase: "reviewing" }, transaction: { status: "reviewing", progress: { phase: "reviewing", terminal: false }, refusal: null } } });
    expect(bytes()).toBe(before);
  }));

  it("does not execute nested accessors, toJSON or proxy traps during translation", () => {
    let hooks = 0;

    const accessor = Object.defineProperty({}, "strength", { enumerable: true, get() { hooks += 1;

 return 1; } });

    const proxy = new Proxy({}, { ownKeys() { hooks += 1;

 return []; }, getPrototypeOf() { hooks += 1;

 return null; } });

    const toJSON = { toJSON() { hooks += 1;

 return {}; } };

    const sparse: number[] = [];
    sparse.length = 2;

    const hostile = [accessor, proxy, Object.create(proxy), toJSON, new Date(), /x/, new Map(), Object.create({ strength: 1 }), sparse, Object.assign([1], { extra: 2 }),
      Object.defineProperty({}, "hidden", { value: 1 }), { [Symbol("field")]: 1 }];

    for (const bloom of hostile) expect(translateCatalogAuthoringMutation({ kind: "set", bloom })).toBeNull();
    expect(hooks).toBe(0);
  });

  it("preserves both collider and legacy shape aliases and precedence before parsing", () => {
    for (const colliderAliases of [{ "shapeId": "s1", "shapeKind": "box" }, { colliderId: "s1", colliderKind: "box" },
      { colliderId: "modern", colliderKind: "box", "shapeId": "legacy", "shapeKind": "sphere" }]) {
      const mutation = { kind: "shape-upsert", bodyId: "b1", size: 1, ...colliderAliases };
      expect(translateCatalogAuthoringMutation(foreign(mutation))).toEqual(mutation);
    }
  });

  it("bounds cyclic, deep and oversized protocol trees without coercion", () => {
    let nested: CatalogNestedFixture = {};

    for (let depth = 0; depth < 40; depth += 1) nested = { nested };
    expect(translateCatalogAuthoringMutation(nested)).toBeNull();
    expect(translateCatalogAuthoringMutation(Array.from({ length: 4097 }, () => 0))).toBeNull();
    expect(translateCatalogAuthoringMutation({ keyDirection: [NaN, Infinity, -Infinity] })).toEqual({ keyDirection: [NaN, Infinity, -Infinity] });
  });
});
