/**
 * Sculpt Intake Source capability contract (sceneaxi#135).
 *
 * Exercises the public package seam only: the shape check a host binds at load,
 * and the caller-side request path that refuses anything a provider gets wrong.
 */
import { describe, expect, it } from "vitest";
import {
  SCULPT_INTAKE_SOURCE_CAPABILITY_ID,
  SCULPT_INTAKE_SOURCE_CONTRACT_REF,
  SCULPT_INTAKE_SOURCE_CONTRACT_VERSION,
  SCULPT_INTAKE_SOURCE_OWNING_PACKAGE,
  checkSculptIntakeSourceImplementation,
  lookupPluginCapability,
  pluginCapabilityRegistrySeed,
  requestSculptIntake,
  type SculptIntake,
  type SculptIntakeSource,
  type SculptIntakeSourceResult,
} from "@sceneaxi/schemas";

const LANTERN: SculptIntake = {
  schemaVersion: 1,
  kind: "sceneaxi.sculpt-intake",
  intakeId: "workshop-lantern",
  mode: "image+brief",
  image: {
    mediaType: "image/png",
    uri: "asset://sceneaxi-demo/workshop-lantern/front.png",
    digest: `sha256:${"a".repeat(64)}`,
  },
  brief: "Iron cage lantern with four glass panes.",
};

function source(
  produceIntake: (request: {
    intakeId: string;
    mode: string;
  }) => SculptIntakeSourceResult,
): SculptIntakeSource {
  return {
    capabilityId: SCULPT_INTAKE_SOURCE_CAPABILITY_ID,
    contractVersion: SCULPT_INTAKE_SOURCE_CONTRACT_VERSION,
    supportedModes: ["image+brief"],
    produceIntake: produceIntake as SculptIntakeSource["produceIntake"],
  };
}

describe("sculpt intake source capability contract", () => {
  it("is the registry row it claims to be", () => {
    const hit = lookupPluginCapability(
      pluginCapabilityRegistrySeed(),
      SCULPT_INTAKE_SOURCE_CAPABILITY_ID,
    );
    expect(hit.ok).toBe(true);
    if (!hit.ok) return;
    expect(hit.entry).toEqual({
      capabilityId: SCULPT_INTAKE_SOURCE_CAPABILITY_ID,
      contractRef: SCULPT_INTAKE_SOURCE_CONTRACT_REF,
      contractVersion: SCULPT_INTAKE_SOURCE_CONTRACT_VERSION,
      owningPackage: SCULPT_INTAKE_SOURCE_OWNING_PACKAGE,
      documentationRef: "docs/plugins.md",
    });
  });

  it("accepts a conforming implementation", () => {
    expect(
      checkSculptIntakeSourceImplementation(
        source(() => ({ ok: true, intake: LANTERN })),
      ),
    ).toEqual({ ok: true });
  });

  it("refuses implementations that only look like the capability", () => {
    const cases: readonly (readonly [string, unknown])[] = [
      ["not an object", "sculpt-intake-source"],
      ["null", null],
      ["missing capabilityId", { contractVersion: "1.0.0", supportedModes: ["image"], produceIntake: () => null }],
      [
        "wrong capabilityId",
        { ...source(() => ({ ok: true, intake: LANTERN })), capabilityId: "sceneaxi.sculpt.intake-source.v2" },
      ],
      [
        "wrong contractVersion",
        { ...source(() => ({ ok: true, intake: LANTERN })), contractVersion: "0.0.1" },
      ],
      [
        "empty supportedModes",
        { ...source(() => ({ ok: true, intake: LANTERN })), supportedModes: [] },
      ],
      [
        "unknown mode",
        { ...source(() => ({ ok: true, intake: LANTERN })), supportedModes: ["holo"] },
      ],
      [
        "duplicate mode",
        {
          ...source(() => ({ ok: true, intake: LANTERN })),
          supportedModes: ["image+brief", "image+brief"],
        },
      ],
      [
        "produceIntake is not callable",
        { ...source(() => ({ ok: true, intake: LANTERN })), produceIntake: {} },
      ],
    ];

    for (const [label, candidate] of cases) {
      const result = checkSculptIntakeSourceImplementation(candidate);
      expect(result.ok, label).toBe(false);
      if (result.ok) continue;
      expect(result.message.length, label).toBeGreaterThan(0);
    }
  });

  it("returns a validated intake for a supported request", () => {
    const produced = requestSculptIntake(
      source(() => ({ ok: true, intake: LANTERN })),
      { intakeId: "workshop-lantern", mode: "image+brief" },
    );
    expect(produced).toEqual({ ok: true, intake: LANTERN });
  });

  it("refuses every way a provider can get the answer wrong", () => {
    const request = { intakeId: "workshop-lantern", mode: "image+brief" } as const;

    expect(
      requestSculptIntake(source(() => ({ ok: true, intake: LANTERN })), {
        intakeId: "workshop-lantern",
        mode: "multi-view",
      }).ok,
    ).toBe(false);

    const table: readonly (readonly [
      string,
      SculptIntakeSource,
      string,
    ])[] = [
      [
        "explicit refusal",
        source(() => ({ ok: false, reason: "request-refused", message: "no plate" })),
        "request-refused",
      ],
      [
        "not a result envelope",
        source(() => "sure" as unknown as SculptIntakeSourceResult),
        "malformed-result",
      ],
      [
        "invalid intake document",
        source(
          () =>
            ({ ok: true, intake: { schemaVersion: 1, kind: "nope" } }) as unknown as SculptIntakeSourceResult,
        ),
        "intake-invalid",
      ],
      [
        "intake identity drift",
        source(() => ({ ok: true, intake: { ...LANTERN, intakeId: "other-plate" } })),
        "intake-mismatch",
      ],
      [
        "provider throws",
        source(() => {
          throw new Error("boom");
        }),
        "provider-threw",
      ],
    ];

    for (const [label, provider, reason] of table) {
      const result = requestSculptIntake(provider, request);
      expect(result.ok, label).toBe(false);
      if (result.ok) continue;
      expect(result.reason, label).toBe(reason);
    }
  });

  it("refuses a source that never satisfied the contract instead of throwing", () => {
    // A host that binds no contract check for the capability hands back
    // whatever the plugin exported, so the request path re-checks the shape.
    const request = { intakeId: "workshop-lantern", mode: "image+brief" } as const;
    const impostors: readonly (readonly [string, unknown])[] = [
      ["empty table entry", {}],
      ["not an object", "sculpt-intake-source"],
      ["no supportedModes", { ...source(() => ({ ok: true, intake: LANTERN })), supportedModes: undefined }],
      ["no produceIntake", { ...source(() => ({ ok: true, intake: LANTERN })), produceIntake: undefined }],
      ["wrong contractVersion", { ...source(() => ({ ok: true, intake: LANTERN })), contractVersion: "0.0.1" }],
    ];

    for (const [label, impostor] of impostors) {
      const result = requestSculptIntake(
        impostor as SculptIntakeSource,
        request,
      );
      expect(result.ok, label).toBe(false);
      if (result.ok) continue;
      expect(result.reason, label).toBe("source-invalid");
      expect(result.message.length, label).toBeGreaterThan(0);
    }
  });
});
