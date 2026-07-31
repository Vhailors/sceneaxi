/**
 * The desktop app offer is a committed record with hard shape rules: real digest
 * shapes, positive sizes, Linux-only artifacts, and the honesty fields the engine
 * page renders. The record's lockstep with `docs/desktop-linux.md` — the recorded
 * build it must match — is asserted from `tests/sites/`, which may read the docs.
 */
import { describe, expect, it } from "vitest";
import { DESKTOP_LINUX_APP_OFFER, desktopLinuxAppOffer } from "@sceneaxi/site-kit";

describe("desktop app offer", () => {
  const offer = desktopLinuxAppOffer();

  it("returns the one frozen committed record", () => {
    expect(offer).toBe(DESKTOP_LINUX_APP_OFFER);
    expect(Object.isFrozen(offer)).toBe(true);
    expect(Object.isFrozen(offer.artifacts)).toBe(true);
    expect(Object.isFrozen(offer.notPackaged)).toBe(true);
  });

  it("offers exactly the two Linux artifact kinds with real digest shapes", () => {
    expect(offer.artifacts.map((artifact) => artifact.kind)).toEqual(["AppImage", "deb"]);
    for (const artifact of offer.artifacts) {
      expect(artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(Number.isSafeInteger(artifact.byteSize)).toBe(true);
      expect(artifact.byteSize).toBeGreaterThan(0);
      expect(artifact.fileName).toContain(offer.version);
      expect(artifact.fileName).toContain("linux");
    }
    expect(offer.platform).toContain("Linux");
  });

  it("states what is not packaged instead of leaving it to implication", () => {
    expect(offer.notPackaged).toEqual(["Windows", "macOS"]);
    expect(offer.reproducibilityNote).toContain("not bit-reproducible");
  });

  it("carries the version plan and the commands the docs promise", () => {
    expect(offer.version).toBe("0.0.0");
    expect(offer.buildCommand).toContain("pnpm dist");
    expect(offer.verifyCommand).toContain("sha256sum -c SHA256SUMS");
    expect(offer.smokeCommand).toContain("pnpm smoke --packaged");
    expect(offer.sourceDir).toBe("desktop/linux");
  });
});
