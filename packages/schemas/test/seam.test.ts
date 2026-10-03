import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as schemas from "@sceneaxi/schemas";
import * as browserSchemas from "../src/index.js";
import { runProfileConformanceSuite } from "@sceneaxi/schemas/node/profile-conformance-suite";

const { contracts, seam } = schemas;

// SAFETY: the checked-in package manifest defines its package name and sceneaxi release group.
const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string; sceneaxi: { releaseGroup: string } };

describe("@sceneaxi/schemas public seam", () => {
  it("identifies itself exactly as its manifest does", () => {
    expect(seam.name).toBe(manifest.name);
    expect(seam.releaseGroup).toBe(manifest.sceneaxi.releaseGroup);
  });

  it("is immutable", () => {
    expect(isSeamRecord(seam)).toBe(true);
    expect(Object.isFrozen(seam)).toBe(true);
    expect(isSeamRecord(contracts)).toBe(true);
    expect(Object.isFrozen(contracts)).toBe(true);
  });

  it("keeps the Node-only conformance suite off the browser-facing root", () => {
    expect("runProfileConformanceSuite" in browserSchemas).toBe(false);
    expect(schemas.runProfileConformanceSuite).toBe(runProfileConformanceSuite);
    expect(isConformanceRunner(runProfileConformanceSuite)).toBe(true);
  });

  it("exposes only control kinds a shared editor surface mints", () => {
    expect(schemas.EDITOR_SHELL_CONTROL_KINDS).toEqual(["view", "live", "inert"]);
  });

  it("ships every declared contract as versioned JSON Schema", () => {
    const entries = Object.values(contracts);
    expect(entries.length).toBeGreaterThan(0);

    for (const rel of entries) {
      // SAFETY: every declared contract points to a checked-in JSON Schema; the assertions below verify its metadata.
      const parsed = JSON.parse(
        readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"),
      ) as { $schema?: string; $id?: string; title?: string };

      expect(parsed.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      expect(parsed.$id).toMatch(/^https:\/\/sceneaxi\.invalid\/contracts\/[a-z-]+\/v\d+$/);
      expect(parsed.title).toBeTruthy();
    }
  });
});

function isSeamRecord(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

function isConformanceRunner(value: unknown): value is typeof runProfileConformanceSuite {
  return isBoundaryCallableValue(value);
}

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}
