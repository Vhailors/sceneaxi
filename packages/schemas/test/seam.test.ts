import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as schemas from "@sceneaxi/schemas";
import { runProfileConformanceSuite } from "@sceneaxi/schemas/node/profile-conformance-suite";

const { contracts, seam } = schemas;

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { name: string; sceneaxi: { releaseGroup: string } };

describe("@sceneaxi/schemas public seam", () => {
  it("identifies itself exactly as its manifest does", () => {
    expect(seam.name).toBe(manifest.name);
    expect(seam.releaseGroup).toBe(manifest.sceneaxi.releaseGroup);
  });

  it("is immutable", () => {
    expect(typeof seam).toBe("object");
    expect(Object.isFrozen(seam)).toBe(true);
    expect(typeof contracts).toBe("object");
    expect(Object.isFrozen(contracts)).toBe(true);
  });

  it("keeps the Node-only conformance suite off the browser-facing root", () => {
    expect("runProfileConformanceSuite" in schemas).toBe(false);
    expect(typeof runProfileConformanceSuite).toBe("function");
  });

  it("ships every declared contract as versioned JSON Schema", () => {
    const entries = Object.values(contracts);
    expect(entries.length).toBeGreaterThan(0);
    for (const rel of entries) {
      const parsed = JSON.parse(
        readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"),
      ) as { $schema?: string; $id?: string; title?: string };
      expect(parsed.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      expect(parsed.$id).toMatch(/^https:\/\/sceneaxi\.invalid\/contracts\/[a-z-]+\/v\d+$/);
      expect(parsed.title).toBeTruthy();
    }
  });
});
