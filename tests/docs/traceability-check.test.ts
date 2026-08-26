import { describe, expect, it } from "vitest";
import { checkTraceability } from "../../scripts/check-traceability.mjs";
import { repoRoot } from "../helpers/fixture.ts";

describe("traceability checker", () => {
  it("accepts the checked-in declaration and live tree", () => {
    expect(checkTraceability(repoRoot)).toEqual([]);
  });

  it("returns stable, named findings instead of throwing on a missing owner", () => {
    const findings = checkTraceability("/tmp/sceneaxi-traceability-does-not-exist");
    expect(findings.some((finding) => finding.startsWith("[declaration-load]"))).toBe(true);
  });
});
