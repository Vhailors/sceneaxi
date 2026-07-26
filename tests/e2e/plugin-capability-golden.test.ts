/**
 * Golden path for the first **registered** plugin capability (sceneaxi#135).
 *
 * Until now the capability registry shipped empty, so every plugin demo had to
 * bind a test-only ID to prove the machinery worked. This drives the real thing
 * end to end:
 *
 *   shipped seed registry -> declared capability -> isolation -> load
 *   -> contract check -> addressed implementation -> validated Sculpt Intake
 *
 * The intake the provider returns is a checked-in golden, digest included, so a
 * silent change in what a plugin may hand the pipeline fails here.
 */
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openPluginHost } from "../../packages/plugin-host/src/index.ts";
import {
  SCULPT_INTAKE_SOURCE_CAPABILITY_ID,
  SCULPT_INTAKE_SOURCE_CONTRACT_VERSION,
  SHIPPED_PLUGIN_CAPABILITY_IDS,
  checkSculptIntakeSourceImplementation,
  emptyPluginCapabilityRegistry,
  lookupPluginCapability,
  pluginCapabilityRegistrySeed,
  requestSculptIntake,
  validateSculptIntake,
  type SculptIntakeSource,
} from "../../packages/schemas/src/index.ts";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PLUGIN_FIXTURES = join(REPO_ROOT, "tests/e2e/fixtures/plugin-host");

const PROVIDER_ROOT = join(PLUGIN_FIXTURES, "sculpt-intake-source");
const BROKEN_PROVIDER_ROOT = join(PLUGIN_FIXTURES, "sculpt-intake-source-broken");
const ILLEGAL_CLAIM_ROOT = join(PLUGIN_FIXTURES, "illegal-claim");

const PROVIDER_PLUGIN_ID = "dev.sceneaxi.sample.intake-source";
const BROKEN_PLUGIN_ID = "dev.sceneaxi.sample.intake-source-broken";

/** Golden intake the demo provider must produce for `workshop-lantern`. */
const GOLDEN_INTAKE = Object.freeze({
  schemaVersion: 1,
  kind: "sceneaxi.sculpt-intake",
  intakeId: "workshop-lantern",
  mode: "image+brief",
  image: {
    mediaType: "image/png",
    uri: "asset://sceneaxi-demo/workshop-lantern/front.png",
    digest:
      "sha256:4d001d09f9aa789ceba26cf24860f7d4802aefad3a343bc71ba6d9533d1f67f1",
  },
  brief:
    "Hand-carried workshop lantern: iron cage, four glass panes, hinged top hatch.",
});

/** The one contract check a caller binds for this capability. */
function contractChecks(): ReadonlyMap<
  string,
  typeof checkSculptIntakeSourceImplementation
> {
  return new Map([
    [SCULPT_INTAKE_SOURCE_CAPABILITY_ID, checkSculptIntakeSourceImplementation],
  ]);
}

function openSeededHost() {
  return openPluginHost({
    registry: pluginCapabilityRegistrySeed(),
    capabilityContracts: contractChecks(),
  });
}

describe("registered capability seed", () => {
  it("ships exactly the reviewed capability IDs and resolves them", () => {
    const seed = pluginCapabilityRegistrySeed();

    expect(SHIPPED_PLUGIN_CAPABILITY_IDS).toEqual([
      SCULPT_INTAKE_SOURCE_CAPABILITY_ID,
    ]);
    expect(seed.entries.map((entry) => entry.capabilityId)).toEqual([
      ...SHIPPED_PLUGIN_CAPABILITY_IDS,
    ]);

    const hit = lookupPluginCapability(seed, SCULPT_INTAKE_SOURCE_CAPABILITY_ID);
    expect(hit.ok).toBe(true);
    if (!hit.ok) return;
    expect(hit.entry.owningPackage).toBe("@sceneaxi/schemas");
    expect(hit.entry.contractRef).toBe("contracts/sculpt-intake.schema.json");
    expect(hit.entry.contractVersion).toBe(SCULPT_INTAKE_SOURCE_CONTRACT_VERSION);
  });

  it("still refuses IDs nobody registered", () => {
    const miss = lookupPluginCapability(
      pluginCapabilityRegistrySeed(),
      "sceneaxi.sculpt.intake-source.v2",
    );
    expect(miss).toEqual({
      ok: false,
      capabilityId: "sceneaxi.sculpt.intake-source.v2",
      reason: "unknown-capability",
    });
  });
});

describe("sculpt intake source capability golden path", () => {
  it("loads the provider and produces a contract-valid intake", async () => {
    const host = openSeededHost();
    const result = await host.load([PROVIDER_ROOT]);

    expect(result.refused).toEqual([]);
    expect(result.loaded).toHaveLength(1);
    expect(result.loaded[0]?.pluginId).toBe(PROVIDER_PLUGIN_ID);
    expect(result.loaded[0]?.capabilities).toEqual([
      SCULPT_INTAKE_SOURCE_CAPABILITY_ID,
    ]);

    const addressed = host.getImplementation(
      PROVIDER_PLUGIN_ID,
      SCULPT_INTAKE_SOURCE_CAPABILITY_ID,
    );
    expect(addressed.ok).toBe(true);
    if (!addressed.ok) return;

    // The implementation passed its contract check at load, so this cast is
    // backed by the same check the host ran, not by trust in the plugin.
    const source = addressed.implementation as SculptIntakeSource;
    const produced = requestSculptIntake(source, {
      intakeId: "workshop-lantern",
      mode: "image+brief",
    });

    expect(produced.ok).toBe(true);
    if (!produced.ok) return;
    expect(produced.intake).toEqual(GOLDEN_INTAKE);

    // The golden digest is the provider's own claim recomputed here, so a
    // fabricated digest cannot ride along in the fixture.
    expect(GOLDEN_INTAKE.image.digest).toBe(
      `sha256:${createHash("sha256")
        .update("sceneaxi demo plate: workshop lantern, front elevation", "utf8")
        .digest("hex")}`,
    );

    // And it is a real Sculpt Intake, not merely a shape the demo agreed with.
    expect(validateSculptIntake(produced.intake).ok).toBe(true);
  });

  it("refuses provider answers that would poison the pipeline", async () => {
    const host = openSeededHost();
    await host.load([PROVIDER_ROOT]);
    const addressed = host.getImplementation(
      PROVIDER_PLUGIN_ID,
      SCULPT_INTAKE_SOURCE_CAPABILITY_ID,
    );
    expect(addressed.ok).toBe(true);
    if (!addressed.ok) return;
    const source = addressed.implementation as SculptIntakeSource;

    // Mode the provider never claimed.
    expect(
      requestSculptIntake(source, { intakeId: "workshop-lantern", mode: "multi-view" }),
    ).toEqual({
      ok: false,
      reason: "unsupported-mode",
      message: 'Provider does not support intake mode "multi-view".',
    });

    // Identity the provider does not speak for.
    const unknown = requestSculptIntake(source, {
      intakeId: "not-a-plate",
      mode: "image+brief",
    });
    expect(unknown.ok).toBe(false);
    if (unknown.ok) return;
    expect(unknown.reason).toBe("request-refused");

    // A provider that answers with a malformed intake is caught at the boundary.
    const liar: SculptIntakeSource = {
      capabilityId: SCULPT_INTAKE_SOURCE_CAPABILITY_ID,
      contractVersion: SCULPT_INTAKE_SOURCE_CONTRACT_VERSION,
      supportedModes: ["image+brief"],
      produceIntake: () =>
        ({ ok: true, intake: { schemaVersion: 1, kind: "nope" } }) as never,
    };
    const rejected = requestSculptIntake(liar, {
      intakeId: "workshop-lantern",
      mode: "image+brief",
    });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.reason).toBe("intake-invalid");

    // A provider that throws is a refusal, never an escaped exception.
    const thrower: SculptIntakeSource = {
      ...liar,
      produceIntake: () => {
        throw new Error("provider exploded");
      },
    };
    const threw = requestSculptIntake(thrower, {
      intakeId: "workshop-lantern",
      mode: "image+brief",
    });
    expect(threw.ok).toBe(false);
    if (threw.ok) return;
    expect(threw.reason).toBe("provider-threw");
  });
});

describe("capability refusals stay closed", () => {
  it("refuses an unknown capability ID before evaluating the entrypoint", async () => {
    // The illegal-claim fixture throws on evaluation, so a passing assertion
    // here is also proof that nothing ran.
    const host = openSeededHost();
    const result = await host.load([ILLEGAL_CLAIM_ROOT]);

    expect(result.loaded).toEqual([]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.reason).toBe("unknown-capability");
    expect(result.refused[0]?.phase).toBe("descriptor");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
    expect(result.refused[0]?.capabilityId).toBe(
      "test.sceneaxi.fixture.capability.issue-53-never-registered",
    );
  });

  it("refuses a registered claim whose implementation violates the contract", async () => {
    const host = openSeededHost();
    const result = await host.load([BROKEN_PROVIDER_ROOT]);

    expect(result.loaded).toEqual([]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.reason).toBe("capability-contract-violation");
    expect(result.refused[0]?.phase).toBe("integrity");
    expect(result.refused[0]?.entrypointEvaluated).toBe(true);
    expect(result.refused[0]?.capabilityId).toBe(
      SCULPT_INTAKE_SOURCE_CAPABILITY_ID,
    );

    // Refused means nothing is addressable, not "loaded with a warning".
    expect(
      host.getImplementation(BROKEN_PLUGIN_ID, SCULPT_INTAKE_SOURCE_CAPABILITY_ID)
        .ok,
    ).toBe(false);
  });

  it("refuses the same provider when the bound registry defines nothing", async () => {
    // Keeps the golden honest: the load above came from a registered ID, not
    // from a weak check that accepts any declared string.
    const host = openPluginHost({
      registry: emptyPluginCapabilityRegistry(),
      capabilityContracts: contractChecks(),
    });
    const result = await host.load([PROVIDER_ROOT]);

    expect(result.loaded).toEqual([]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.reason).toBe("unknown-capability");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
  });

  it("still refuses at the request boundary when no contract check is bound", async () => {
    // Binding a check is optional, so the broken provider becomes addressable
    // here. The request path is the second closed door: a typed refusal, never
    // a thrown TypeError on a shape the plugin never implemented.
    const host = openPluginHost({ registry: pluginCapabilityRegistrySeed() });
    const result = await host.load([BROKEN_PROVIDER_ROOT]);

    expect(result.refused).toEqual([]);
    const addressed = host.getImplementation(
      BROKEN_PLUGIN_ID,
      SCULPT_INTAKE_SOURCE_CAPABILITY_ID,
    );
    expect(addressed.ok).toBe(true);
    if (!addressed.ok) return;

    const produced = requestSculptIntake(
      addressed.implementation as SculptIntakeSource,
      { intakeId: "workshop-lantern", mode: "image+brief" },
    );
    expect(produced.ok).toBe(false);
    if (produced.ok) return;
    expect(produced.reason).toBe("source-invalid");
  });

  it("loads a good provider and refuses a bad one in the same load set", async () => {
    const host = openSeededHost();
    const result = await host.load([PROVIDER_ROOT, BROKEN_PROVIDER_ROOT]);

    expect(result.loaded.map((plugin) => plugin.pluginId)).toEqual([
      PROVIDER_PLUGIN_ID,
    ]);
    expect(result.refused.map((plugin) => plugin.pluginId)).toEqual([
      BROKEN_PLUGIN_ID,
    ]);
    expect(host.list().loaded).toHaveLength(1);
  });
});
