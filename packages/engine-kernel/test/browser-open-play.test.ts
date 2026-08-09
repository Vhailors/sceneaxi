/**
 * Browser open path proof.
 *
 * Two things have to hold for a browser to open and play a kernel session:
 * the module graph must not reach a Node builtin, and the running session must
 * not depend on a Node global. This suite asserts both statically and at
 * runtime, then exercises the snapshot/save transport a presentation runtime
 * consumes. See docs/kernel-browser-open.md.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KERNEL_SESSION_SCHEMA_VERSION,
  open,
  openSceneKernelSession,
  openSculptKernelSession,
  portableKernelDigest,
  replay,
  replaySceneKernelSession,
  replaySculptKernelSession,
  resolveRarityRoll,
  type KernelDigest,
  type KernelDigestHost,
  type KernelHost,
} from "@sceneaxi/engine-kernel";
import {
  COMPOSED_SCENE_KIND,
  RARITY_POLICY_KIND,
  RARITY_REQUEST_KIND,
  RARITY_SCHEMA_VERSION,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  digestComposedScene,
  digestSceneArtifact,
  digestScenePlacements,
  resolveScenePlacements,
  type ComposedScene,
  type ComposedSceneInstance,
} from "@sceneaxi/schemas";
import {
  sceneCompositionArtifactFixture as artifactFixture,
  sceneCompositionFixtureDigest as fixtureDigest,
  sceneCompositionTransformFixture as transform,
} from "@sceneaxi/schemas/testing/scene-composition";

/** Any accidental `node:crypto` import in the kernel graph fails this file at load. */
vi.mock("node:crypto", () => {
  throw new Error("engine-kernel must not import node:crypto");
});

const KERNEL_SRC = fileURLToPath(new URL("../src", import.meta.url));
const SCHEMAS_SRC = fileURLToPath(
  new URL("../../schemas/src", import.meta.url),
);

/** Node-only surface the contracts package is allowed to keep (never on a session path). */
const SCHEMAS_NODE_ONLY_MODULES = ["profile-conformance-suite.ts"];

/** Static, dynamic, and CJS ways to pull in a Node builtin. */
const NODE_BUILTIN_IMPORT_RE =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']node:[a-z/]+["']/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

function relative(root: string, path: string): string {
  return path.slice(root.length + 1);
}

describe("kernel module graph is browser-clean", () => {
  it("imports no Node builtin anywhere under src", () => {
    const files = sourceFiles(KERNEL_SRC);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((file) =>
      NODE_BUILTIN_IMPORT_RE.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((file) => relative(KERNEL_SRC, file))).toEqual([]);
  });

  it("references no Node-only global under src", () => {
    const offenders = sourceFiles(KERNEL_SRC).filter((file) =>
      /\bBuffer\b|\bprocess\.|\brequire\(|\b__dirname\b|\b__filename\b/.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offenders.map((file) => relative(KERNEL_SRC, file))).toEqual([]);
  });

  it("pins the contracts package's Node-only surface to its node-only suite", () => {
    const offenders = sourceFiles(SCHEMAS_SRC)
      .filter((file) => NODE_BUILTIN_IMPORT_RE.test(readFileSync(file, "utf8")))
      .map((file) => relative(SCHEMAS_SRC, file))
      .sort();
    // Growing this list would put a Node builtin back on the browser open path.
    expect(offenders).toEqual(SCHEMAS_NODE_ONLY_MODULES);
  });
});

function fixedHost(startMs: number): KernelHost {
  let now = startMs;
  return {
    nowMs: () => {
      const value = now;
      now += 1;
      return value;
    },
  };
}

const crate = artifactFixture("crate-artifact");
const drone = artifactFixture("drone-artifact");

function sceneFixture(sceneId = "browser-bay"): ComposedScene {
  const resolved = resolveScenePlacements({
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: SCENE_COMPOSITION_INTAKE_KIND,
    sceneId,
    rootInstanceId: "floor-crate",
    placements: [
      {
        instanceId: "floor-crate",
        artifactId: "crate-artifact",
        parentInstanceId: null,
        transform: transform([1, 0, 2], [2, 2, 2]),
      },
      {
        instanceId: "stacked-crate",
        artifactId: "crate-artifact",
        parentInstanceId: "floor-crate",
        transform: transform([0, 1, 0]),
      },
      {
        instanceId: "hover-drone",
        artifactId: "drone-artifact",
        parentInstanceId: "floor-crate",
        transform: transform([0, 3, 0]),
      },
    ],
  });
  if (!resolved.ok) throw new Error("scene fixture refused");
  const artifacts = new Map([
    ["crate-artifact", crate],
    ["drone-artifact", drone],
  ]);
  const instances = resolved.value.map((placement): ComposedSceneInstance => {
    const artifact = artifacts.get(placement.artifactId);
    if (artifact === undefined) throw new Error("fixture artifact missing");
    return { ...placement, artifact };
  });
  const draft = {
    schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
    kind: COMPOSED_SCENE_KIND,
    sceneId,
    rootInstanceId: "floor-crate",
    instances,
    evidence: {
      intakeDigest: fixtureDigest("e"),
      placementDigest: digestScenePlacements(resolved.value),
      artifactDigests: instances.map((instance) => ({
        instanceId: instance.instanceId,
        artifactDigest: digestSceneArtifact(instance.artifact),
      })),
      sceneDigest: fixtureDigest("0"),
    },
  } satisfies ComposedScene;
  return {
    ...draft,
    evidence: { ...draft.evidence, sceneDigest: digestComposedScene(draft) },
  };
}

/** Run `action` with the Node-only globals a browser does not have removed. */
function withoutNodeGlobals<T>(action: () => T): T {
  vi.stubGlobal("Buffer", undefined);
  vi.stubGlobal("require", undefined);
  try {
    return action();
  } finally {
    vi.unstubAllGlobals();
  }
}

/** Plain-JSON transport, the only channel a browser presentation gets. */
function overTheWire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Byte-level transport fidelity: the wire copy re-encodes to the same JSON and
 * keeps the same digest. Deep equality is deliberately not the assertion — a
 * kernel `-0` velocity component encodes as `0`, an Object.is-level difference
 * the digest cannot see because the digest is taken over this same encoding.
 */
function expectSurvivesTheWire(snapshot: { readonly digest: string }): void {
  const wire = overTheWire(snapshot);
  expect(JSON.stringify(wire)).toBe(JSON.stringify(snapshot));
  expect(wire.digest).toBe(snapshot.digest);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sessions open and play without Node globals", () => {
  it("resolves the checked-in rarity algorithm without Node globals", () => {
    const resolved = withoutNodeGlobals(() =>
      resolveRarityRoll(
        {
          projectSeed: 424242,
          scope: "wayfinder-fixture",
          eventId: "roll-0000",
        },
        {
          schemaVersion: RARITY_SCHEMA_VERSION,
          kind: RARITY_POLICY_KIND,
          tierWeights: {
            common: 1,
            uncommon: 1,
            rare: 1,
            epic: 1,
            legendary: 1,
          },
        },
        {
          schemaVersion: RARITY_SCHEMA_VERSION,
          kind: RARITY_REQUEST_KIND,
          candidates: [
            { candidateId: "common-a", tier: "common", weight: 1 },
            { candidateId: "common-b", tier: "common", weight: 1 },
            { candidateId: "uncommon-a", tier: "uncommon", weight: 1 },
            { candidateId: "uncommon-b", tier: "uncommon", weight: 1 },
            { candidateId: "rare-a", tier: "rare", weight: 1 },
            { candidateId: "rare-b", tier: "rare", weight: 1 },
            { candidateId: "epic-a", tier: "epic", weight: 1 },
            { candidateId: "epic-b", tier: "epic", weight: 1 },
            { candidateId: "legendary-a", tier: "legendary", weight: 1 },
            { candidateId: "legendary-b", tier: "legendary", weight: 1 },
          ],
        },
      ),
    );
    expect(resolved).toMatchObject({
      ok: true,
      value: {
        outcome: { tier: "common", candidateId: "common-a" },
        provenance: {
          tierRollDigest:
            "sha256:005f1d88424a47c8127b6ae2082d92ea40cd5f5824205dbdcbb0b1ddf15f2cb3",
          candidateRollDigest:
            "sha256:3848d15225499ad5bbf2d283a8a25ce57399ad824505168cd36305b3b35a7c42",
        },
      },
    });
  });

  it("plays the entity session end to end", () => {
    const terminal = withoutNodeGlobals(() => {
      const session = open(
        { productId: "browser-demo", seed: 11, entities: [{ id: "hero", x: 0, y: 0 }] },
        fixedHost(1_000),
      );
      const initial = session.observe();
      session.dispatch({ type: "move", actor: "hero", axis: [2, 3] });
      expect(session.observe().digest).toBe(initial.digest);
      session.advance({ tick: 1, deltaMs: 16 });
      const snapshot = session.observe();
      expect(snapshot.digest).not.toBe(initial.digest);
      expect(snapshot.entities).toEqual([{ id: "hero", x: 2, y: 3 }]);
      const artifact = session.save();
      expect(artifact.schemaVersion).toBe(KERNEL_SESSION_SCHEMA_VERSION);
      return { snapshot, artifact };
    });

    // Snapshots and saves are plain data: they survive the wire unchanged.
    expectSurvivesTheWire(terminal.snapshot);
    const replayed = withoutNodeGlobals(() =>
      replay(overTheWire(terminal.artifact), fixedHost(9_000)),
    );
    expect(replayed.observe().digest).toBe(terminal.snapshot.digest);
  });

  it("plays the sculpt session end to end", () => {
    const terminal = withoutNodeGlobals(() => {
      const session = openSculptKernelSession(crate, { seed: 4242 });
      for (let tick = 1; tick <= 6; tick += 1) {
        session.advance({ tick, deltaMs: 100 });
      }
      return { snapshot: session.observe(), artifact: session.save() };
    });

    expect(terminal.snapshot.tick).toBe(6);
    expectSurvivesTheWire(terminal.snapshot);
    const replayed = withoutNodeGlobals(() =>
      replaySculptKernelSession(overTheWire(terminal.artifact)),
    );
    expect(replayed.observe().digest).toBe(terminal.snapshot.digest);
  });

  it("plays the multi-object scene session end to end", () => {
    const terminal = withoutNodeGlobals(() => {
      const session = openSceneKernelSession(sceneFixture(), { seed: 9101 });
      const initial = session.observe();
      for (let tick = 1; tick <= 8; tick += 1) {
        session.advance({ tick, deltaMs: 100 });
      }
      return { initial, snapshot: session.observe(), artifact: session.save() };
    });

    expect(terminal.snapshot.instances.map((i) => i.instanceId)).toEqual([
      "floor-crate",
      "hover-drone",
      "stacked-crate",
    ]);
    expect(terminal.snapshot.digest).not.toBe(terminal.initial.digest);
    expectSurvivesTheWire(terminal.snapshot);

    const replayed = withoutNodeGlobals(() =>
      replaySceneKernelSession(overTheWire(terminal.artifact)),
    );
    expect(replayed.observe().digest).toBe(terminal.snapshot.digest);
  });
});

describe("server kernel and browser kernel agree", () => {
  it("produces identical scene digests with and without an injected digest", () => {
    const scene = sceneFixture();
    const play = (host?: KernelDigestHost) => {
      const session = openSceneKernelSession(scene, { seed: 9101 }, host);
      for (let tick = 1; tick <= 4; tick += 1) session.advance({ tick, deltaMs: 100 });
      return session.save();
    };
    let calls = 0;
    const hostDigest: KernelDigest = (input) => {
      calls += 1;
      return portableKernelDigest(input);
    };
    const injected = play({ digest: hostDigest });
    const portable = play();
    expect(calls).toBeGreaterThan(0);
    expect(injected.terminalDigest).toBe(portable.terminalDigest);
    expect(JSON.stringify(injected)).toBe(JSON.stringify(portable));
  });

  it("uses an injected digest across entity and sculpt open paths", () => {
    let entityCalls = 0;
    const entityDigest: KernelDigest = (input) => {
      entityCalls += 1;
      return portableKernelDigest(input);
    };
    const entity = open(
      { productId: "browser-demo", seed: 11 },
      { nowMs: () => 1_000, digest: entityDigest },
    );
    entity.observe();
    expect(entityCalls).toBeGreaterThan(0);

    let sculptCalls = 0;
    const sculptDigest: KernelDigest = (input) => {
      sculptCalls += 1;
      return portableKernelDigest(input);
    };
    const sculpt = openSculptKernelSession(
      crate,
      { seed: 4242 },
      { digest: sculptDigest },
    );
    sculpt.observe();
    expect(sculptCalls).toBeGreaterThan(0);
  });

  it("refuses entity, sculpt, and scene sessions whose injected digest disagrees", () => {
    const badHost = { digest: () => "0".repeat(64) };
    expect(() =>
      open(
        { productId: "browser-demo", seed: 11 },
        { nowMs: () => 1_000, ...badHost },
      ),
    ).toThrow(/disagrees with the portable sha256 digest/);
    expect(() =>
      openSculptKernelSession(crate, { seed: 4242 }, badHost),
    ).toThrow(/disagrees with the portable sha256 digest/);
    expect(() =>
      openSceneKernelSession(sceneFixture(), { seed: 9101 }, badHost),
    ).toThrow(/disagrees with the portable sha256 digest/);
  });
});
