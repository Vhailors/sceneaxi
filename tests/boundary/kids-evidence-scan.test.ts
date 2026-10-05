import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeFixture, removeFixture, runCheck, writeTo } from "../helpers/fixture.ts";

describe("Kids evidence versus runtime authority", () => {
  let root: string;
  beforeEach(() => { root = makeFixture(); });
  afterEach(() => { removeFixture(root); });

  it("retains inert build and screenshot receipts without treating them as runtime links", () => {
    writeTo(root, "sites/kids/test/visual-evidence/proof.log", "Build observed https://localhost.invalid and <a evidence-only>\n");
    writeTo(root, "sites/kids/test/visual-evidence/proof.png", "<a compressed-image-byte-sequence>\n");
    const result = runCheck(root, "check-sites.mjs");
    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    "sites/kids/src/lib/evidence-looking.ts",
    "sites/kids/test/visual-evidence/executable.mjs",
    "sites/kids/test/visual-evidence/runtime.config.ts",
  ])("still rejects outbound runtime/config authority in %s", (path) => {
    writeTo(root, path, "fetch('/outside');\n");
    const result = runCheck(root, "check-sites.mjs");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(path + " names fetch");
  });

  it("still scans inert receipts for secret-shaped material", () => {
    writeTo(root, "sites/kids/test/visual-evidence/unsafe.log", ["sk", "test", "fixtureonly000"].join("_") + "\n");
    const result = runCheck(root, "check-sites.mjs");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unsafe.log contains secret-shaped material");
  });
});
