/**
 * Kids refuse-only golden path (sceneaxi#118).
 *
 * The Kids *product* is a refusal and isolation boundary, not a UI. "Runnable"
 * for Kids therefore means the whole refuse matrix executes end to end and no
 * product surface exists — not that a Kids app starts.
 *
 * This file deliberately asserts absence as well as behaviour: a future change
 * that adds a Kids UI, catalog, commerce, or identity export, opens the network
 * allowlist, or lets any package depend on Kids must fail here.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  createModelProviderPort,
  type ModelDescriptor,
  type ModelProviderAdapter,
  type ModelProviderPolicyFilter,
} from "../../packages/authoring-core/src/index.ts";
import * as kids from "../../packages/profile-kids/src/index.ts";

const REPO_ROOT = new URL("../../", import.meta.url);

const MODEL: ModelDescriptor = Object.freeze({
  model: "fixture/kids-guard",
  provider: "fixture-provider",
  quantization: "none",
  version: "test-v1",
});

/** An adapter that would happily answer — so a Kids allow would be visible. */
function willingAdapter(calls: string[]): ModelProviderAdapter {
  return {
    routeKind: "third-party",
    capabilities: {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operations: ["complete"],
    },
    complete(request) {
      calls.push(request.prompt);
      return Promise.resolve({
        response: {
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operation: "complete" as const,
          text: "this must never be reached for Kids",
          finishReason: "stop" as const,
        },
        executedModel: MODEL,
      });
    },
  } as ModelProviderAdapter;
}

describe("Kids isolation matrix (executable, end to end)", () => {
  it("accepts every declared plane only when fully isolated", () => {
    expect(kids.KIDS_ISOLATION_PLANES.length).toBeGreaterThan(0);
    for (const plane of kids.KIDS_ISOLATION_PLANES) {
      expect(kids.evaluateKidsIsolation(plane, "isolated"), plane).toEqual({
        ok: true,
        plane,
        mode: "isolated",
      });
    }
  });

  it("refuses every plane in any shared or switchable mode", () => {
    for (const plane of kids.KIDS_ISOLATION_PLANES) {
      for (const mode of [
        "shared",
        "runtime-switchable",
        "partially-isolated",
        "",
        null,
        undefined,
        true,
      ]) {
        const decision = kids.evaluateKidsIsolation(plane, mode);
        expect(decision.ok, `${plane}/${String(mode)}`).toBe(false);
        if (!decision.ok) {
          expect(decision.reason).toBe("KIDS_ISOLATION_REQUIRED");
        }
      }
    }
  });

  it("refuses unknown planes rather than defaulting them open", () => {
    for (const plane of ["billing", "analytics", "", null, 7, {}]) {
      const decision = kids.evaluateKidsIsolation(plane, "isolated");
      expect(decision.ok, String(plane)).toBe(false);
      if (!decision.ok) {
        expect(decision.reason).toBe("UNKNOWN_ISOLATION_PLANE");
      }
    }
  });
});

describe("Kids LLM route deny", () => {
  it("denies every route kind, with a stable third-party reason", () => {
    expect(kids.policy.allowedLlmRouteKinds).toEqual([]);
    expect(kids.policy.thirdPartyLlmDefault).toBe("deny");

    expect(kids.evaluateKidsLlmRoute("third-party")).toMatchObject({
      ok: false,
      reason: "THIRD_PARTY_LLM_DENIED_BY_DEFAULT",
    });
    for (const routeKind of ["first-party", "self-hosted", "local", "", null]) {
      const decision = kids.evaluateKidsLlmRoute(routeKind);
      expect(decision.ok, String(routeKind)).toBe(false);
      if (!decision.ok) {
        expect(decision.reason).toBe("KIDS_LLM_ROUTE_NOT_ALLOWED");
      }
    }
  });

  it("is non-overridable at the Model Provider Port, even with an allow-all policy", async () => {
    const calls: string[] = [];
    const allowEverything: ModelProviderPolicyFilter = () => ({ ok: true });
    const port = createModelProviderPort({
      adapter: willingAdapter(calls),
      profilePolicies: {
        // Deliberately hostile setup: Kids is given an allow-all filter.
        "@sceneaxi/profile-kids": allowEverything,
        "@sceneaxi/profile-game": allowEverything,
      },
    });

    const kidsResult = await port.complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-kids",
      model: MODEL,
      prompt: "anything at all",
    });

    expect(kidsResult.ok).toBe(false);
    if (!kidsResult.ok) {
      expect(kidsResult.reason).toBe("THIRD_PARTY_LLM_DENIED_BY_DEFAULT");
    }
    // The deny happens before dispatch: the adapter was never reached.
    expect(calls).toEqual([]);

    // Control: the same port and adapter do serve a non-Kids profile, so the
    // refusal above is the Kids guard and not a broken fixture.
    const gameResult = await port.complete({
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      operation: "complete",
      profile: "@sceneaxi/profile-game",
      model: MODEL,
      prompt: "draft a scene",
    });
    expect(gameResult.ok).toBe(true);
    expect(calls).toEqual(["draft a scene"]);
  });
});

describe("Kids boundary claims (no external route is enabled)", () => {
  it("refuses every claim kind with its named reason", () => {
    const cases = [
      {
        claim: { kind: "external-data-plane", plane: "external" },
        reason: kids.KIDS_REFUSE_REASONS.externalDataPlaneDenied,
      },
      {
        claim: { kind: "external-data-plane", plane: "internal" },
        reason: kids.KIDS_REFUSE_REASONS.dataPlaneNotEnabled,
      },
      {
        claim: { kind: "catalog", profile: "game" },
        reason: kids.KIDS_REFUSE_REASONS.nonKidsCatalogDenied,
      },
      {
        claim: { kind: "catalog", profile: "kids" },
        reason: kids.KIDS_REFUSE_REASONS.catalogNotEnabled,
      },
      {
        claim: { kind: "commerce", action: "purchase" },
        reason: kids.KIDS_REFUSE_REASONS.commerceNotEnabled,
      },
      {
        claim: { kind: "network", destination: "https://example.invalid" },
        reason: kids.KIDS_REFUSE_REASONS.networkDestinationNotAllowlisted,
      },
    ] as const;

    for (const testCase of cases) {
      const refusal = kids.evaluateKidsBoundaryClaim(testCase.claim);
      expect(refusal.ok, JSON.stringify(testCase.claim)).toBe(false);
      expect(refusal.reason, JSON.stringify(testCase.claim)).toBe(
        testCase.reason,
      );
    }
  });

  it("refuses malformed and unknown claims rather than ignoring them", () => {
    for (const claim of [null, undefined, [], "commerce", 7, {}, { kind: "telemetry" }]) {
      const refusal = kids.evaluateKidsBoundaryClaim(claim);
      expect(refusal.ok, JSON.stringify(claim ?? null)).toBe(false);
      expect(refusal.reason).toBe(kids.KIDS_REFUSE_REASONS.claimInvalid);
    }
  });

  it("keeps the network allowlist empty", () => {
    expect(kids.KIDS_NETWORK_DESTINATION_ALLOWLIST).toEqual([]);
    expect(kids.policy.allowedNetworkDestinations).toEqual([]);
    expect(kids.policy.defaultDecision).toBe("refuse");
    expect(kids.policy.isolation).toBe("fully-isolated");
  });
});

describe("Kids has no product surface", () => {
  it("exports only policy and refusal helpers — no UI, commerce, or identity", () => {
    const exported = Object.keys(kids).sort();

    // Nothing that could act as a product surface may appear on the seam.
    const forbidden = /render|mount|component|view|screen|ui|checkout|purchase|cart|price|account|signin|signup|login|session|identity|store|fetch|client/i;
    const offenders = exported.filter(
      (name) =>
        forbidden.test(name) &&
        // Policy vocabulary legitimately *names* the things it refuses.
        !name.startsWith("KIDS_") &&
        !name.startsWith("evaluateKids"),
    );
    expect(offenders).toEqual([]);

    // And the surface is exactly what the refuse-only product is allowed to be.
    expect(exported).toEqual([
      "KIDS_ISOLATION_PLANES",
      "KIDS_NETWORK_DESTINATION_ALLOWLIST",
      "KIDS_POLICY_VERSION",
      "KIDS_REFUSE_REASONS",
      "evaluateKidsBoundaryClaim",
      "evaluateKidsIsolation",
      "evaluateKidsLlmRoute",
      "policy",
      "seam",
    ]);
  });

  it("makes no shipping claim in the conformance registry", async () => {
    const { profileConformanceRegistry } = await import(
      "../../packages/schemas/src/index.ts"
    );
    const entry = profileConformanceRegistry.find(
      (candidate) => candidate.profile === "@sceneaxi/profile-kids",
    );
    expect(entry).toBeDefined();
    expect(entry?.claimStatus).toBe("not-yet-claimed");
    expect(entry?.shippingClaim).toBe(false);
  });

  it("keeps the Kids dependency boundary closed to every package", () => {
    const matrix = JSON.parse(
      readFileSync(new URL("docs/dependency-matrix.json", REPO_ROOT), "utf8"),
    ) as {
      kidsBoundary: {
        kidsPackages: string[];
        allowedDependents: string[];
      };
      packages: Record<string, { allow: string[] }>;
    };

    expect(matrix.kidsBoundary.kidsPackages).toEqual([
      "@sceneaxi/profile-kids",
    ]);
    // The locked boundary: no package may be added as an allowed dependent.
    expect(matrix.kidsBoundary.allowedDependents).toEqual([]);

    // No package's allow list may name Kids, either.
    for (const [name, entry] of Object.entries(matrix.packages)) {
      expect(entry.allow, name).not.toContain("@sceneaxi/profile-kids");
    }
  });
});
