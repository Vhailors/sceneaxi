/**
 * The desktop app offer is a committed record with hard shape rules: real digest
 * shapes, positive sizes, Linux-only artifacts, and the honesty fields the engine
 * page renders. The record's lockstep with `docs/desktop-linux.md` — the recorded
 * build it must match — is asserted from `tests/sites/`, which may read the docs.
 */
import { describe, expect, it } from "vitest";
import {
  DESKTOP_LINUX_APP_OFFER,
  desktopLinuxAppOffer,
  resolveDesktopAppOffer,
} from "@sceneaxi/site-kit";

describe("desktop app offer", () => {
  const resolved = desktopLinuxAppOffer();
  if (!resolved.ok) throw new Error(`desktop offer refused: ${resolved.reason}`);
  const offer = resolved.value;

  it("returns the one frozen committed record", () => {
    expect(offer).toBe(DESKTOP_LINUX_APP_OFFER);
    expect(Object.isFrozen(offer)).toBe(true);
    expect(Object.isFrozen(offer.artifacts)).toBe(true);
    expect(Object.isFrozen(offer.unavailablePlatforms)).toBe(true);
  });

  it("publishes complete metadata for both verified Linux files", () => {
    expect(offer.artifacts.map((artifact) => artifact.kind)).toEqual(["AppImage", "deb"]);
    for (const artifact of offer.artifacts) {
      expect(artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(Number.isSafeInteger(artifact.byteSize)).toBe(true);
      expect(artifact.byteSize).toBeGreaterThan(0);
      expect(artifact.fileName).toContain(offer.version);
      expect(artifact.fileName).toContain("linux");
      expect(artifact.platform).toBe(offer.platform);
      expect(artifact.verifyCommand).toContain(artifact.sha256);
      expect(artifact.verifyCommand).toContain(artifact.fileName);
    }
    expect(offer.platform).toContain("Linux");
  });

  it("points to the exact repository workflow artifact instead of a placeholder", () => {
    expect(offer.downloadHref).toBe(
      `https://github.com/${offer.repository}/actions/runs/${offer.workflowRunId}`,
    );
    expect(offer.downloadHref).not.toContain("example");
    expect(offer.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(offer.ciArtifactName).toBe("sceneaxi-desktop-linux");
    expect(offer.checksumFileName).toBe("SHA256SUMS");
  });

  it("states unavailable platforms as coming soon instead of inventing installers", () => {
    expect(offer.unavailablePlatforms.map(({ platform, status }) => ({ platform, status }))).toEqual([
      { platform: "macOS", status: "coming-soon" },
      { platform: "Windows", status: "coming-soon" },
    ]);
    for (const platform of offer.unavailablePlatforms) expect(platform.reason).toContain("No ");
    expect(offer.reproducibilityNote).toContain("not bit-reproducible");
  });

  it("states an expiry the declared retention window actually implies", () => {
    expect(offer.artifactRetentionDays).toBe(90);
    expect(offer.artifactExpiresBy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(offer.artifactExpiresBy > offer.verifiedOn).toBe(true);
    expect(offer.retentionNote).toContain("upper bound");
    expect(offer.retentionNote).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("refuses a retention window the stated expiry does not follow from", () => {
    for (const drift of [
      { artifactExpiresBy: "2026-11-04" },
      { artifactExpiresBy: "2026-11-02" },
      { artifactExpiresBy: "not-a-day" },
      { artifactRetentionDays: 91 },
      { artifactRetentionDays: 0 },
      { artifactRetentionDays: -90 },
      { artifactRetentionDays: 90.5 },
      { artifactRetentionDays: "90" },
      { verifiedOn: "2026-08-06" },
      { verifiedOn: "2026-13-05" },
      { verifiedOn: "2026-02-30" },
      { retentionNote: "   " },
    ]) {
      expect(resolveDesktopAppOffer({ ...offer, ...drift })).toMatchObject({
        ok: false,
        reason: "DESKTOP_APP_ARTIFACT_UNAVAILABLE",
      });
    }
  });

  it("resolves a re-recorded window whose expiry moves with its verification day", () => {
    expect(
      resolveDesktopAppOffer({
        ...offer,
        verifiedOn: "2026-01-31",
        artifactExpiresBy: "2026-05-01",
      }),
    ).toMatchObject({ ok: true });
    expect(
      resolveDesktopAppOffer({
        ...offer,
        verifiedOn: "2026-01-31",
        artifactRetentionDays: 1,
        artifactExpiresBy: "2026-02-01",
      }),
    ).toMatchObject({ ok: true });
  });

  it("carries the version and checksum command the docs promise", () => {
    expect(offer.version).toBe("0.0.0");
    expect(offer.verifyCommand).toContain("sha256sum -c SHA256SUMS");
    expect(offer.sourceDir).toBe("desktop/linux");
  });

  it("refuses an absent record and a broken repository artifact link", () => {
    expect(resolveDesktopAppOffer(null)).toMatchObject({
      ok: false,
      reason: "DESKTOP_APP_ARTIFACT_UNAVAILABLE",
    });
    expect(
      resolveDesktopAppOffer({
        ...offer,
        downloadHref: "https://downloads.example/sceneaxi.AppImage",
      }),
    ).toMatchObject({ ok: false, reason: "DESKTOP_APP_ARTIFACT_LINK_INVALID" });
  });

  it("refuses incomplete metadata even when the repository link is well formed", () => {
    expect(resolveDesktopAppOffer({ ...offer, artifacts: [] })).toMatchObject({
      ok: false,
      reason: "DESKTOP_APP_ARTIFACT_UNAVAILABLE",
    });
  });

  it("refuses a non-record candidate as unavailable rather than as a broken link", () => {
    for (const candidate of ["", "an offer", 7, true, [], [offer]]) {
      expect(resolveDesktopAppOffer(candidate)).toMatchObject({
        ok: false,
        reason: "DESKTOP_APP_ARTIFACT_UNAVAILABLE",
      });
    }
  });

  it("refuses every honesty field the page renders unguarded", () => {
    const dropped = [
      "productName",
      "verifiedOn",
      "sourceDir",
      "verifyCommand",
      "reproducibilityNote",
      "unavailablePlatforms",
      "ciWorkflow",
      "retentionNote",
      "artifactRetentionDays",
      "artifactExpiresBy",
    ] as const;
    for (const field of dropped) {
      const rest = Object.fromEntries(
        Object.entries(offer).filter(([key]) => key !== field),
      );
      expect(resolveDesktopAppOffer(rest)).toMatchObject({
        ok: false,
        reason: "DESKTOP_APP_ARTIFACT_UNAVAILABLE",
      });
    }
    const [macOS, windows] = offer.unavailablePlatforms;
    if (macOS === undefined || windows === undefined) {
      throw new Error("the offer names fewer than two unavailable platforms");
    }
    for (const unavailablePlatforms of [
      [],
      [macOS],
      [windows],
      [macOS, macOS],
      [...offer.unavailablePlatforms, { ...macOS, platform: "Linux" }],
      [{ ...macOS, status: "shipping" }, windows],
      [{ ...macOS, platform: "Linux" }, windows],
      [macOS, { ...windows, reason: "  " }],
      ["macOS", "Windows"],
    ]) {
      expect(resolveDesktopAppOffer({ ...offer, unavailablePlatforms })).toMatchObject({
        ok: false,
        reason: "DESKTOP_APP_ARTIFACT_UNAVAILABLE",
      });
    }
  });

  it("refuses a file name that would print an unsafe or mismatched install command", () => {
    const [appImage] = offer.artifacts;
    if (appImage === undefined) throw new Error("the offer publishes no artifact");
    for (const fileName of [
      "linux app; rm -rf /.AppImage",
      "linux app.AppImage",
      "SceneAxi-Engine-Desktop-0.0.0-x86_64.AppImage",
    ]) {
      expect(
        resolveDesktopAppOffer({
          ...offer,
          artifacts: [{ ...appImage, fileName }],
        }),
      ).toMatchObject({ ok: false, reason: "DESKTOP_APP_ARTIFACT_UNAVAILABLE" });
    }
  });
});
