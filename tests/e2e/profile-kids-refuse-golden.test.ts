/**
 * Kids isolated first-release golden path (sceneaxi#118, sceneaxi#200).
 *
 * The shared engine open path remains refuse-only, but the dedicated Kids
 * origin now owns one closed, local build-and-play activity. "Runnable" means
 * that curated flow and the whole refusal/isolation matrix execute together.
 *
 * This file deliberately asserts absence as well as behaviour: a future change
 * Any change that adds a catalog, commerce, identity, provider, or external data
 * export, opens the network allowlist, or lets any package depend on Kids must
 * fail here.
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

describe("Kids dedicated local activity", () => {
  it("builds and plays one curated world without leaving the isolated seam", () => {
    let state = kids.createKidsActivityState();
    for (const request of [
      { action: "world.choose", worldId: "moon" },
      { action: "piece.add", pieceId: "rocket" },
      { action: "piece.add", pieceId: "friend" },
      { action: "play.start" },
    ] as const) {
      const decision = kids.applyKidsActivityAction(state, request);
      expect(decision.ok, JSON.stringify(request)).toBe(true);
      if (decision.ok) state = decision.state;
    }
    expect(state).toMatchObject({
      worldId: "moon",
      pieceIds: ["rocket", "friend"],
      mode: "play",
    });
    expect(kids.policy.activityMode).toBe("curated-in-memory");
    expect(kids.policy.allowedActivityActions).toBe(kids.KIDS_ACTIVITY_ACTIONS);
  });

  it("refuses every editing action while a world is playing, leaving the scene untouched", () => {
    let state = kids.createKidsActivityState();
    for (const request of [
      { action: "piece.add", pieceId: "star" },
      { action: "play.start" },
    ] as const) {
      const decision = kids.applyKidsActivityAction(state, request);
      if (decision.ok) state = decision.state;
    }
    const playing = JSON.stringify(state);

    for (const request of [
      { action: "world.choose", worldId: "ocean" },
      { action: "piece.add", pieceId: "tree" },
      { action: "piece.undo" },
      { action: "scene.reset" },
    ] as const) {
      const decision = kids.applyKidsActivityAction(state, request);
      expect(decision, JSON.stringify(request)).toMatchObject({
        ok: false,
        reason: kids.KIDS_ACTIVITY_REFUSE_REASONS.buildPaused,
      });
      expect(decision).not.toHaveProperty("state");
    }
    expect(JSON.stringify(state)).toBe(playing);

    // The mode toggles themselves refuse the transition they are already in.
    expect(kids.applyKidsActivityAction(state, { action: "play.start" })).toMatchObject({
      ok: false,
      reason: kids.KIDS_ACTIVITY_REFUSE_REASONS.alreadyPlaying,
    });
    expect(
      kids.applyKidsActivityAction(kids.createKidsActivityState(), { action: "play.stop" }),
    ).toMatchObject({ ok: false, reason: kids.KIDS_ACTIVITY_REFUSE_REASONS.alreadyStopped });
    expect(
      kids.applyKidsActivityAction(kids.createKidsActivityState(), { action: "piece.undo" }),
    ).toMatchObject({ ok: false, reason: kids.KIDS_ACTIVITY_REFUSE_REASONS.sceneEmpty });
  });

  it("exports only policy, refusal helpers, and the local activity — no external plane", () => {
    const exported = Object.keys(kids).sort();

    // Nothing that could bridge the dedicated activity to an external product
    // plane may appear on the seam.
    const forbidden = /render|mount|component|view|screen|ui|checkout|purchase|cart|price|account|signin|signup|login|session|identity|store|fetch|client/i;
    const offenders = exported.filter(
      (name) =>
        forbidden.test(name) &&
        // Policy vocabulary legitimately *names* the things it refuses.
        !name.startsWith("KIDS_") &&
        !name.startsWith("evaluateKids"),
    );
    expect(offenders).toEqual([]);

    // And the surface is exactly the closed local activity plus the isolation gate.
    expect(exported).toEqual([
      "KIDS_ACTIVITY_ACTIONS",
      "KIDS_ACTIVITY_PIECES",
      "KIDS_ACTIVITY_PIECE_LIMIT",
      "KIDS_ACTIVITY_REFUSE_REASONS",
      "KIDS_ACTIVITY_VERSION",
      "KIDS_ACTIVITY_WORLDS",
      "KIDS_ISOLATION_PLANES",
      "KIDS_NETWORK_DESTINATION_ALLOWLIST",
      "KIDS_POLICY_VERSION",
      "KIDS_REFUSE_REASONS",
      "applyKidsActivityAction",
      "createKidsActivityState",
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
