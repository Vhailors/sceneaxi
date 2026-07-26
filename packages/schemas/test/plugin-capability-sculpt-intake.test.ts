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

const LANTERN_BRIEF = "Iron cage lantern with four glass panes.";

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
  brief: LANTERN_BRIEF,
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

  it("hands back a document the provider can no longer reach", () => {
    const request = { intakeId: "workshop-lantern", mode: "image+brief" } as const;
    let handedOver: Record<string, unknown> | undefined;
    const provider = source(() => {
      if (handedOver) handedOver["brief"] = "poisoned";
      handedOver = { ...LANTERN, image: { ...LANTERN.image } } as Record<
        string,
        unknown
      >;
      return { ok: true, intake: handedOver } as unknown as SculptIntakeSourceResult;
    });

    const first = requestSculptIntake(provider, request);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    requestSculptIntake(provider, request);
    expect(first.intake).toEqual(LANTERN);
    expect(() => {
      (first.intake as unknown as Record<string, unknown>)["brief"] = "poisoned";
    }).toThrow();
    expect(first.intake).toEqual(LANTERN);
  });

  it("validates the same values it returns when a provider answers with accessors", () => {
    const request = { intakeId: "workshop-lantern", mode: "image+brief" } as const;
    let reads = 0;
    const drifting = {
      ...LANTERN,
      get brief() {
        reads += 1;
        return reads === 1 ? LANTERN_BRIEF : "";
      },
    };

    const result = requestSculptIntake(
      source(() => ({ ok: true, intake: drifting })),
      request,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intake.mode).toBe("image+brief");
    if (result.intake.mode !== "image+brief") return;
    expect(result.intake.brief).toBe(LANTERN_BRIEF);
    expect(result.intake).toEqual(LANTERN);
  });

  it("refuses an intake that cannot be captured instead of throwing", () => {
    const request = { intakeId: "workshop-lantern", mode: "image+brief" } as const;
    const hostile = {
      ...LANTERN,
      get brief(): string {
        throw new Error("no reading that");
      },
    };

    const result = requestSculptIntake(
      source(() => ({ ok: true, intake: hostile })),
      request,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("malformed-result");
  });

  it("grades the answer against the request the caller made, not the provider's rewrite", () => {
    const request = { intakeId: "workshop-lantern", mode: "image+brief" } as const;
    let handed: Record<string, unknown> | undefined;
    const rewriter = source((incoming) => {
      handed = incoming as unknown as Record<string, unknown>;
      handed["intakeId"] = "other-plate";
      handed["mode"] = "multi-view";
      return {
        ok: true,
        intake: { ...LANTERN, intakeId: "other-plate" },
      } as unknown as SculptIntakeSourceResult;
    });

    const result = requestSculptIntake(rewriter, request);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(["provider-threw", "intake-mismatch"]).toContain(result.reason);
    expect(request.intakeId).toBe("workshop-lantern");
    expect(request.mode).toBe("image+brief");
    expect(handed).not.toBe(request);
  });

  it("refuses a source whose declared fields throw instead of throwing", () => {
    const request = { intakeId: "workshop-lantern", mode: "image+brief" } as const;
    const base = () => source(() => ({ ok: true, intake: LANTERN }));
    const hostiles: readonly (readonly [string, unknown])[] = [
      [
        "capabilityId",
        {
          ...base(),
          get capabilityId(): never {
            throw new Error("no reading capabilityId");
          },
        },
      ],
      [
        "contractVersion",
        {
          ...base(),
          get contractVersion(): never {
            throw new Error("no reading contractVersion");
          },
        },
      ],
      [
        "supportedModes",
        {
          ...base(),
          get supportedModes(): never {
            throw new Error("no reading supportedModes");
          },
        },
      ],
      [
        "produceIntake",
        {
          ...base(),
          get produceIntake(): never {
            throw new Error("no reading produceIntake");
          },
        },
      ],
    ];

    for (const [label, hostile] of hostiles) {
      const result = requestSculptIntake(hostile as SculptIntakeSource, request);
      expect(result.ok, label).toBe(false);
      if (result.ok) continue;
      expect(result.reason, label).toBe("source-invalid");
    }
  });

  it("refuses a result envelope that throws or drifts instead of throwing", () => {
    const request = { intakeId: "workshop-lantern", mode: "image+brief" } as const;

    const throwingOk = requestSculptIntake(
      source(
        () =>
          ({
            get ok(): never {
              throw new Error("no reading ok");
            },
          }) as unknown as SculptIntakeSourceResult,
      ),
      request,
    );
    expect(throwingOk.ok).toBe(false);
    if (!throwingOk.ok) expect(throwingOk.reason).toBe("malformed-result");

    const throwingMessage = requestSculptIntake(
      source(
        () =>
          ({
            ok: false,
            get message(): never {
              throw new Error("no reading message");
            },
          }) as unknown as SculptIntakeSourceResult,
      ),
      request,
    );
    expect(throwingMessage.ok).toBe(false);
    if (!throwingMessage.ok) {
      expect(throwingMessage.reason).toBe("malformed-result");
    }

    // `ok` is read once: an accessor cannot answer the gate and the branch
    // differently.
    let okReads = 0;
    const drifting = requestSculptIntake(
      source(
        () =>
          ({
            get ok() {
              okReads += 1;
              return okReads === 1;
            },
            intake: LANTERN,
          }) as unknown as SculptIntakeSourceResult,
      ),
      request,
    );
    expect(okReads).toBe(1);
    expect(drifting).toEqual({ ok: true, intake: LANTERN });
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
