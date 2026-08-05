/**
 * `/engine` desktop-download contract (sceneaxi#193).
 *
 * The view stays framework-thin, so these tests assert the validated site-kit data
 * and the exact fields the TSX renders. This catches a page that drops the checksum,
 * hides a coming-soon state, or bypasses the resolver with a handwritten URL.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { desktopLinuxAppOffer, resolveDesktopAppOffer } from "@sceneaxi/site-kit";

const ENGINE_PAGE = readFileSync(
  new URL("../../sites/umbrella/src/app/engine/page.tsx", import.meta.url),
  "utf8",
);

const resolved = desktopLinuxAppOffer();
if (!resolved.ok) throw new Error(`desktop offer refused: ${resolved.reason}`);
const offer = resolved.value;

describe("umbrella desktop download", () => {
  it("renders the validated real repository artifact path as its Linux CTA", () => {
    const href = new URL(offer.downloadHref);
    expect(href.origin).toBe("https://github.com");
    expect(href.pathname).toBe(
      `/${offer.repository}/actions/runs/${String(offer.workflowRunId)}`,
    );
    expect(ENGINE_PAGE).toContain("desktopApp.downloadHref");
    expect(ENGINE_PAGE).toContain("Open Linux download");
    expect(ENGINE_PAGE).not.toContain("downloads.example");
  });

  it("renders explicit artifact metadata and copyable checksum commands", () => {
    for (const field of [
      "desktopApp.version",
      "artifact.platform",
      "artifact.fileName",
      "artifact.byteSize",
      "artifact.sha256",
      "artifact.verifyCommand",
      "desktopApp.verifyCommand",
    ]) {
      expect(ENGINE_PAGE).toContain(field);
    }
    expect(ENGINE_PAGE).toContain("Copy and verify this file");
    expect(ENGINE_PAGE).toContain("Verify the whole download");
  });

  it("shows macOS and Windows as coming soon with no invented download", () => {
    expect(offer.unavailablePlatforms.map((row) => row.platform)).toEqual([
      "macOS",
      "Windows",
    ]);
    expect(offer.unavailablePlatforms.every((row) => row.status === "coming-soon")).toBe(
      true,
    );
    expect(ENGINE_PAGE).toContain("desktopApp.unavailablePlatforms.map");
    expect(ENGINE_PAGE).toContain("Other platforms are coming soon");
    expect(ENGINE_PAGE).not.toContain("Download for macOS");
    expect(ENGINE_PAGE).not.toContain("Download for Windows");
  });

  it("renders a named refusal and no fallback URL when artifact metadata breaks", () => {
    expect(
      resolveDesktopAppOffer({ ...offer, downloadHref: "https://github.com/broken" }),
    ).toMatchObject({ ok: false, reason: "DESKTOP_APP_ARTIFACT_LINK_INVALID" });
    expect(ENGINE_PAGE).toContain("desktopRefusal !== null");
    expect(ENGINE_PAGE).toContain('title="Desktop artifact unavailable"');
    expect(ENGINE_PAGE).toContain("No fallback URL is offered");
  });

  it("documents honest first-launch behavior without signing or update claims", () => {
    expect(ENGINE_PAGE).toContain("seeds");
    expect(ENGINE_PAGE).toContain("Website (Web)");
    expect(ENGINE_PAGE).toContain("Kids");
    expect(ENGINE_PAGE).toContain("refuse-only");
    expect(ENGINE_PAGE).toContain("no code-signing claim");
    expect(ENGINE_PAGE).toMatch(/no auto-update\s+support/);
  });
});
