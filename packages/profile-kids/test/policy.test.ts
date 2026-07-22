import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  KIDS_ISOLATION_PLANES,
  evaluateKidsIsolation,
  evaluateKidsLlmRoute,
  policy,
} from "@sceneaxi/profile-kids";

const dependencyMatrix = JSON.parse(
  readFileSync(
    new URL("../../../docs/dependency-matrix.json", import.meta.url),
    "utf8",
  ),
) as {
  kidsBoundary: {
    kidsPackages: string[];
    allowedDependents: string[];
  };
};

describe("@sceneaxi/profile-kids compiled isolation policy", () => {
  it.each(KIDS_ISOLATION_PLANES)("accepts only isolated %s", (plane) => {
    expect(evaluateKidsIsolation(plane, "isolated")).toEqual({
      ok: true,
      plane,
      mode: "isolated",
    });
    expect(evaluateKidsIsolation(plane, "shared")).toMatchObject({
      ok: false,
      plane,
      reason: "KIDS_ISOLATION_REQUIRED",
    });
  });

  it("refuses unknown planes and runtime mode weakening", () => {
    expect(evaluateKidsIsolation("main-product-session", "isolated")).toMatchObject(
      {
        ok: false,
        reason: "UNKNOWN_ISOLATION_PLANE",
      },
    );
    expect(evaluateKidsIsolation("sessions", "runtime-toggle")).toMatchObject({
      ok: false,
      reason: "KIDS_ISOLATION_REQUIRED",
    });
  });

  it("denies third-party LLM routes by default and refuses undeclared routes", () => {
    expect(evaluateKidsLlmRoute("third-party")).toMatchObject({
      ok: false,
      reason: "THIRD_PARTY_LLM_DENIED_BY_DEFAULT",
    });
    expect(evaluateKidsLlmRoute("first-party")).toMatchObject({
      ok: false,
      reason: "KIDS_LLM_ROUTE_NOT_ALLOWED",
    });
    expect(evaluateKidsLlmRoute(undefined)).toMatchObject({
      ok: false,
      routeKind: null,
      reason: "KIDS_LLM_ROUTE_NOT_ALLOWED",
    });
    expect(policy.allowedLlmRouteKinds).toEqual([]);
  });

  it("keeps the package dependency boundary fully isolated", () => {
    expect(dependencyMatrix.kidsBoundary.kidsPackages).toEqual([
      "@sceneaxi/profile-kids",
    ]);
    expect(dependencyMatrix.kidsBoundary.allowedDependents).toEqual([]);
  });

  it("does not invent an age-band policy", () => {
    expect(policy).not.toHaveProperty("ageBand");
    expect(JSON.stringify(policy)).not.toMatch(/age|under-?13/i);
  });

  it("exposes an immutable, refuse-by-default policy", () => {
    expect(policy.defaultDecision).toBe("refuse");
    expect(policy.isolation).toBe("fully-isolated");
    expect(policy.thirdPartyLlmDefault).toBe("deny");
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.isolationPlanes)).toBe(true);
    expect(Object.isFrozen(policy.allowedLlmRouteKinds)).toBe(true);
  });
});
