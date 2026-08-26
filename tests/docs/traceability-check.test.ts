import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkTraceability } from "../../scripts/check-traceability.mjs";
import { repoRoot } from "../helpers/fixture.ts";
import { traceabilityRuntimeSurfaces } from "../helpers/traceability-runtime.ts";

function normalizedRuntimeSurfaces(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (!Array.isArray(entry)) return [key, entry];
      if (key === "heldKeyEntries") {
        return [
          key,
          entry
            .map((item) => {
              const row = item as { command: string; heldKeys: string[] };
              return { command: row.command, heldKeys: [...row.heldKeys].sort() };
            })
            .sort((left, right) => left.command.localeCompare(right.command)),
        ];
      }
      if (key === "refusalRegistries") {
        return [
          key,
          [...entry].sort((left, right) =>
            JSON.stringify(left).localeCompare(JSON.stringify(right))),
        ];
      }
      return [key, [...entry].sort()];
    }),
  );
}

describe("traceability checker", () => {
  it("accepts the checked-in declaration and live tree", () => {
    expect(checkTraceability(repoRoot)).toEqual([]);
  });

  it("keeps the generated runtime protocol equal to exported executable registries", () => {
    const generated = JSON.parse(
      readFileSync(
        join(repoRoot, "docs/audits/initiation/runtime-surfaces.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(normalizedRuntimeSurfaces(generated)).toEqual(
      normalizedRuntimeSurfaces(
        traceabilityRuntimeSurfaces() as unknown as Record<string, unknown>,
      ),
    );
  });

  it("returns stable, named findings instead of throwing on a missing owner", () => {
    const findings = checkTraceability("/tmp/sceneaxi-traceability-does-not-exist");
    expect(findings.some((finding) => finding.startsWith("[declaration-load]"))).toBe(true);
  });
});
