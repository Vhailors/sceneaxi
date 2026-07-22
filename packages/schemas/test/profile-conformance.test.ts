import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PROFILE_CONFORMANCE_KIND,
  PROFILE_CONFORMANCE_SCHEMA_VERSION,
  PROFILE_CONFORMANCE_SUITE_VERSION,
  PROFILE_ROLLOUT_ORDER_HELD_KEY,
  contracts,
  createProfileConformanceClaim,
  profileConformanceRegistry,
  registryEntryFor,
  validateProfileConformanceClaim,
} from "@sceneaxi/schemas";

describe("Profile Conformance contract", () => {
  it("is registered in the contracts inventory with a versioned JSON Schema", () => {
    expect(contracts.profileConformance).toBe(
      "contracts/profile-conformance.schema.json",
    );
    const parsed = JSON.parse(
      readFileSync(
        new URL(`../${contracts.profileConformance}`, import.meta.url),
        "utf8",
      ),
    ) as { $schema?: string; $id?: string; title?: string };
    expect(parsed.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(parsed.$id).toBe(
      "https://sceneaxi.invalid/contracts/profile-conformance/v1",
    );
    expect(parsed.title).toMatch(/Profile Conformance/i);
  });

  it("accepts a valid development-consumer claim", () => {
    const claim = createProfileConformanceClaim({
      profile: "@sceneaxi/profile-game",
      claimStatus: "development-consumer",
      corePin: "^0.0.0",
    });
    const v = validateProfileConformanceClaim(claim);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.claim.schemaVersion).toBe(PROFILE_CONFORMANCE_SCHEMA_VERSION);
    expect(v.claim.kind).toBe(PROFILE_CONFORMANCE_KIND);
    expect(v.claim.suiteVersion).toBe(PROFILE_CONFORMANCE_SUITE_VERSION);
    expect(v.claim.shippingClaim).toBe(false);
    expect(v.claim.heldKeysCited).toContain(PROFILE_ROLLOUT_ORDER_HELD_KEY);
    expect(v.claim.evidenceHooks.present).toBe(true);
    expect(v.claim.evidenceHooks.hooks.length).toBeGreaterThan(0);
  });

  it("refuses major schema mismatch", () => {
    const r = validateProfileConformanceClaim({
      schemaVersion: 99,
      kind: PROFILE_CONFORMANCE_KIND,
      profile: "@sceneaxi/profile-game",
      claimStatus: "development-consumer",
      corePin: "^0.0.0",
      suiteVersion: 1,
      evidenceHooks: {
        present: true,
        hooks: [{ name: "kernel-session-save", status: "declared" }],
      },
      heldKeysCited: [PROFILE_ROLLOUT_ORDER_HELD_KEY],
      shippingClaim: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("schema-major-mismatch");
      expect(r.foundSchemaVersion).toBe(99);
    }
  });

  it("refuses shippingClaim true (no publication authority)", () => {
    const r = validateProfileConformanceClaim({
      schemaVersion: 1,
      kind: PROFILE_CONFORMANCE_KIND,
      profile: "@sceneaxi/profile-game",
      claimStatus: "development-consumer",
      corePin: "^0.0.0",
      suiteVersion: 1,
      evidenceHooks: {
        present: true,
        hooks: [{ name: "kernel-session-save", status: "declared" }],
      },
      heldKeysCited: [PROFILE_ROLLOUT_ORDER_HELD_KEY],
      shippingClaim: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("shipping-claim-forbidden");
  });

  it("refuses claims that omit the open profile-rollout-order hold", () => {
    const r = validateProfileConformanceClaim({
      schemaVersion: 1,
      kind: PROFILE_CONFORMANCE_KIND,
      profile: "@sceneaxi/profile-game",
      claimStatus: "development-consumer",
      corePin: "^0.0.0",
      suiteVersion: 1,
      evidenceHooks: {
        present: true,
        hooks: [{ name: "kernel-session-save", status: "declared" }],
      },
      heldKeysCited: ["some-other-key"],
      shippingClaim: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("missing-held-key-citation");
  });
});

describe("Profile Conformance registry", () => {
  it("lists Game as the first development consumer and Web/Kids as not-yet-claimed", () => {
    expect(profileConformanceRegistry.length).toBe(3);

    const game = registryEntryFor("@sceneaxi/profile-game");
    const web = registryEntryFor("@sceneaxi/profile-web");
    const kids = registryEntryFor("@sceneaxi/profile-kids");

    expect(game?.claimStatus).toBe("development-consumer");
    expect(web?.claimStatus).toBe("not-yet-claimed");
    expect(kids?.claimStatus).toBe("not-yet-claimed");
  });

  it("never records a shipping claim; always cites profile-rollout-order as open", () => {
    for (const row of profileConformanceRegistry) {
      expect(row.shippingClaim).toBe(false);
      expect(row.openHeldKey).toBe(PROFILE_ROLLOUT_ORDER_HELD_KEY);
    }
  });

  it("does not treat not-yet-claimed profiles as suite failures by presence alone", () => {
    // Registry rows for web/kids exist so the suite can see "absent claim",
    // not as failed development-consumer claims.
    const notClaimed = profileConformanceRegistry.filter(
      (r) => r.claimStatus === "not-yet-claimed",
    );
    expect(notClaimed.map((r) => r.profile).sort()).toEqual([
      "@sceneaxi/profile-kids",
      "@sceneaxi/profile-web",
    ]);
  });
});
