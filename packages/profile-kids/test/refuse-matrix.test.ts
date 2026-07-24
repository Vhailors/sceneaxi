import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  KIDS_NETWORK_DESTINATION_ALLOWLIST,
  evaluateKidsBoundaryClaim,
  evaluateKidsLlmRoute,
} from "@sceneaxi/profile-kids";

describe("Kids MVP dedicated refusal gate", () => {
  it.each([
    [
      "third-party model route",
      () => evaluateKidsLlmRoute("third-party"),
      "THIRD_PARTY_LLM_DENIED_BY_DEFAULT",
    ],
    [
      "external data plane",
      () => evaluateKidsBoundaryClaim({ kind: "external-data-plane", plane: "external" }),
      "EXTERNAL_DATA_PLANE_DENIED",
    ],
    [
      "non-Kids catalog",
      () => evaluateKidsBoundaryClaim({ kind: "catalog", profile: "web" }),
      "NON_KIDS_CATALOG_DENIED",
    ],
    [
      "commerce",
      () => evaluateKidsBoundaryClaim({ kind: "commerce", action: "purchase" }),
      "KIDS_COMMERCE_NOT_ENABLED",
    ],
    [
      "network destination outside allowlist",
      () => evaluateKidsBoundaryClaim({ kind: "network", destination: "api.example.invalid" }),
      "KIDS_NETWORK_DESTINATION_NOT_ALLOWLISTED",
    ],
  ] as const)("refuses %s with a named reason", (_label, evaluate, reason) => {
    expect(evaluate()).toMatchObject({ ok: false, reason });
  });

  it("keeps the MVP network allowlist empty and refuses malformed claims", () => {
    expect(KIDS_NETWORK_DESTINATION_ALLOWLIST).toEqual([]);
    expect(evaluateKidsBoundaryClaim(undefined)).toMatchObject({
      ok: false,
      reason: "KIDS_BOUNDARY_CLAIM_INVALID",
    });
    expect(evaluateKidsBoundaryClaim({ kind: "unknown" })).toMatchObject({
      ok: false,
      reason: "KIDS_BOUNDARY_CLAIM_INVALID",
    });
  });

  it("documents refusal-only MVP scope with no product surface", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    expect(readme).toContain("MVP = refuse/isolation only; no Kids UI/product");
  });
});
