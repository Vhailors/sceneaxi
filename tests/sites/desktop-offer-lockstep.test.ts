/**
 * Lockstep between the desktop app offer the umbrella advertises and the recorded
 * build result `docs/desktop-linux.md` stands behind.
 *
 * The Linux desktop artifacts are not rebuilt by the site (electron packaging is
 * not bit-reproducible), so `/engine` renders the committed record in
 * `@sceneaxi/site-kit` — which means the record itself must be unable to drift
 * from the documented build. The doc's `<!-- desktop-linux:artifacts -->` table is
 * machine-read here and compared field by field: a digest, file name, or byte size
 * edited in one place fails until the other moves with it.
 *
 * `/engine` is not the only surface that restates the offer: the umbrella's marketing
 * download table (`sites/umbrella/src/lib/download-platform.ts`, sceneaxi#203) also
 * states which desktop platforms are packaged. That module is reached from a
 * `"use client"` component, so it may not value-import the Node-bearing site-kit
 * barrel and has to restate the fact — the same shape `viewport-letterbox.ts` uses for
 * a Foundations colour. This file is therefore the single owner of desktop-offer
 * drift, and the block below binds the marketing table to `unavailablePlatforms` so
 * packaging shipping for Windows or macOS fails the gate here instead of quietly leaving
 * a "Coming soon" row on the landing page.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DESKTOP_LINUX_APP_OFFER } from "@sceneaxi/site-kit";
import {
  DOWNLOAD_PLATFORMS,
  downloadCallToAction,
} from "../../sites/umbrella/src/lib/download-platform.ts";

const doc = readFileSync(new URL("../../docs/desktop-linux.md", import.meta.url), "utf8");
const desktopManifest = JSON.parse(
  readFileSync(new URL("../../desktop/linux/package.json", import.meta.url), "utf8"),
) as { name: string; version: string };
const desktopBuilder = readFileSync(
  new URL("../../desktop/linux/electron-builder.yml", import.meta.url),
  "utf8",
);

function documentedArtifacts(): ReadonlyArray<{
  kind: string;
  fileName: string;
  byteSize: number;
  sha256: string;
}> {
  const marker = "<!-- desktop-linux:artifacts -->";
  const start = doc.indexOf(marker);
  expect(start, "docs/desktop-linux.md lost its artifacts marker").toBeGreaterThan(-1);
  const rows: { kind: string; fileName: string; byteSize: number; sha256: string }[] = [];
  for (const line of doc.slice(start).split("\n").slice(1)) {
    if (rows.length > 0 && !line.startsWith("|")) break;
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 5 || cells[1] === "Artifact" || cells[1]?.startsWith("---")) continue;
    rows.push({
      kind: cells[1] ?? "",
      fileName: (cells[2] ?? "").replaceAll("`", ""),
      byteSize: Number(cells[3]),
      sha256: (cells[4] ?? "").replaceAll("`", ""),
    });
  }
  return rows;
}

describe("desktop offer ↔ recorded build lockstep", () => {
  it("advertises exactly the documented artifacts, field for field", () => {
    const documented = documentedArtifacts();
    expect(documented).toHaveLength(DESKTOP_LINUX_APP_OFFER.artifacts.length);
    expect(
      DESKTOP_LINUX_APP_OFFER.artifacts.map((artifact) => ({
        kind: artifact.kind,
        fileName: artifact.fileName,
        byteSize: artifact.byteSize,
        sha256: artifact.sha256,
      })),
    ).toEqual(documented);
  });

  it("records the same release identity the doc stands behind", () => {
    expect(doc).toContain(`Verified ${DESKTOP_LINUX_APP_OFFER.verifiedOn}`);
    expect(doc).toContain(DESKTOP_LINUX_APP_OFFER.downloadHref);
    expect(doc).toContain(String(DESKTOP_LINUX_APP_OFFER.workflowRunId));
    expect(doc).toContain(DESKTOP_LINUX_APP_OFFER.sourceCommit);
    expect(doc).toContain(DESKTOP_LINUX_APP_OFFER.ciArtifactName);
    expect(doc).toContain(DESKTOP_LINUX_APP_OFFER.checksumFileName);
    for (const artifact of DESKTOP_LINUX_APP_OFFER.artifacts) {
      expect(artifact.fileName).toContain(DESKTOP_LINUX_APP_OFFER.version);
    }
  });

  it("records the same retention window and expiry date the doc states", () => {
    expect(doc).toContain(
      `| Artifact retention | ${String(DESKTOP_LINUX_APP_OFFER.artifactRetentionDays)} days |`,
    );
    expect(doc).toContain(
      `| Download expires by | ${DESKTOP_LINUX_APP_OFFER.artifactExpiresBy} |`,
    );
    expect(doc).toContain("This download expires");
    expect(doc).toContain("declared 90-day retention window");
    expect(DESKTOP_LINUX_APP_OFFER.retentionNote).toContain("workflow artifact");
    expect(DESKTOP_LINUX_APP_OFFER.retentionNote).toContain("90-day retention window");
  });

  it("uses the desktop manifest as the version source and locks product identity", () => {
    expect(desktopManifest.name).toBe("@sceneaxi/desktop-linux");
    expect(DESKTOP_LINUX_APP_OFFER.version).toBe(desktopManifest.version);
    expect(DESKTOP_LINUX_APP_OFFER.productName).toBe("SceneAxi Engine Desktop");
    expect(desktopBuilder).toContain(`productName: ${DESKTOP_LINUX_APP_OFFER.productName}`);
    expect(desktopBuilder).toContain("appId: com.sceneaxi.engine-desktop");
    expect(desktopBuilder).toContain("executableName: sceneaxi-engine-desktop");
    for (const artifact of DESKTOP_LINUX_APP_OFFER.artifacts) {
      expect(artifact.fileName).toContain(`-${desktopManifest.version}-`);
    }
    expect(doc).toContain(`| Version | \`${desktopManifest.version}\` |`);
  });

  it("attributes every proof to the build it came from", () => {
    expect(doc).not.toContain("Smoke observations of the downloaded workflow build");
    const start = doc.indexOf("## Where each proof came from");
    expect(start, "docs/desktop-linux.md lost its proof-attribution section").toBeGreaterThan(-1);
    const evidence = doc.slice(start);
    expect(evidence).toContain("A local source build");
    expect(evidence).toContain("verified, not separately launched here");
    // Every source-built launch mode must sit below the source-build attribution,
    // never under the downloaded artifact, whose only proof is its checksum.
    for (const sourceBuiltMode of ["--appimage-extract-and-run", "SCENEAXI_SMOKE_SHOT"]) {
      expect(evidence).toContain(sourceBuiltMode);
      expect(evidence.indexOf("A local source build")).toBeLessThan(
        evidence.indexOf(sourceBuiltMode),
      );
    }
  });

  it("keeps the honesty claims aligned across released and unreleased platforms", () => {
    expect(doc).toContain("not bit-reproducible");
    expect(DESKTOP_LINUX_APP_OFFER.reproducibilityNote).toContain("not bit-reproducible");
    expect(doc).toContain("Windows packaging");
    expect(doc).toContain("No public macOS artifact is recorded");
    expect(doc).toContain("separate `desktop/macos` root now owns macOS packaging");
    expect(DESKTOP_LINUX_APP_OFFER.unavailablePlatforms.map((row) => row.platform)).toEqual([
      "macOS",
      "Windows",
    ]);
    expect(DESKTOP_LINUX_APP_OFFER.unavailablePlatforms.every((row) => row.status === "coming-soon"))
      .toBe(true);
    expect(doc).toContain("no code-signing claim");
    expect(doc).toContain("no auto-update support");
  });

  it("documents explicit project creation and all three honest product tabs", () => {
    // First launch must not silently choose a project root. The existing seed is
    // available only through New Project, while Open Project validates without
    // writing and invalid bytes remain the operator's bytes.
    expect(doc).toContain("First launch binds no root and writes no project");
    expect(doc).toContain(
      "New Project creates the\nstarter `scene.json` and `sceneaxi.project.json` v1 atomically",
    );
    expect(doc).toContain("Open\nProject performs no project write");
    expect(doc).toContain("Invalid `scene.json` bytes are never replaced");
    expect(doc).toContain("**Game**");
    expect(doc).toContain("**Website (Web)**");
    expect(doc).toContain("**Kids**");
    expect(doc).toContain("**refuse-only**");
  });

  it("keeps the record out of the build it describes", () => {
    // `desktop/linux` bundles site-kit for its scene payload, so without a pure
    // annotation esbuild keeps this module in `dist/main.cjs` — and a digest that
    // ships inside the artifact it identifies can never survive being re-recorded:
    // the next build differs by exactly the digest just written down.
    //
    // The outcome is asserted where the bundle exists: `desktop/linux/scripts/build.mjs`
    // fails the build if an emitted bundle carries a recorded digest or file name.
    // This is the secondary guard — the annotation that makes the drop possible — and
    // it lives here because the hermetic root cannot run the tier's esbuild.
    const source = readFileSync(
      new URL("../../packages/site-kit/src/desktop-app-offer.ts", import.meta.url),
      "utf8",
    );
    const freezes = source.match(/Object\.freeze\(/g) ?? [];
    const pureFreezes = source.match(/\/\* @__PURE__ \*\/ Object\.freeze\(/g) ?? [];
    expect(freezes.length).toBeGreaterThan(0);
    expect(pureFreezes).toHaveLength(freezes.length);
  });

  it("names the same CI workflow and artifact the repository actually declares", () => {
    const workflow = readFileSync(
      new URL("../../.github/workflows/desktop-linux.yml", import.meta.url),
      "utf8",
    );
    expect(workflow).toContain(`name: ${DESKTOP_LINUX_APP_OFFER.ciWorkflow}`);
    expect(workflow).toContain(`name: ${DESKTOP_LINUX_APP_OFFER.ciArtifactName}`);
    expect(workflow).toContain(
      `retention-days: ${String(DESKTOP_LINUX_APP_OFFER.artifactRetentionDays)}`,
    );
  });
});

describe("desktop offer ↔ umbrella download table lockstep", () => {
  const unpackagedPlatforms = DESKTOP_LINUX_APP_OFFER.unavailablePlatforms.map(
    (row) => row.platform as string,
  );
  const notPackaged = (name: string) => unpackagedPlatforms.includes(name);

  it("holds a coming-soon row for exactly the platforms the offer does not package", () => {
    const comingSoon = DOWNLOAD_PLATFORMS.filter(
      (offer) => offer.availability === "coming-soon",
    ).map((offer) => offer.name);
    expect([...comingSoon].sort()).toEqual([...unpackagedPlatforms].sort());
  });

  it("records a build for exactly the one platform the offer actually built", () => {
    const recorded = DOWNLOAD_PLATFORMS.filter(
      (offer) => offer.availability === "recorded-build",
    );
    expect(recorded).toHaveLength(1);
    // "Linux" against the offer's "Linux x86_64": the table names the platform, the
    // offer names the exact build target, and the marketing row may not out-claim it.
    expect(DESKTOP_LINUX_APP_OFFER.platform.startsWith(recorded[0]?.name ?? "")).toBe(true);
  });

  it("sends only a packaged platform to the evidence route", () => {
    for (const offer of DOWNLOAD_PLATFORMS) {
      expect(offer.href).toBe(notPackaged(offer.name) ? null : "/engine");
    }
  });

  it("keeps the detected copy of each platform on the same side of the offer", () => {
    for (const offer of DOWNLOAD_PLATFORMS) {
      const { context } = downloadCallToAction(offer.id);
      if (notPackaged(offer.name)) {
        expect(offer.label).toMatch(/coming soon/i);
        expect(context).toMatch(/coming soon/i);
      } else {
        // The packaged platform gets the offer's own two routes and its checksums,
        // never a served binary — the reason its label is "Recorded build".
        expect(offer.label).not.toMatch(/coming soon/i);
        expect(context).not.toMatch(/coming soon/i);
        expect(offer.note).toMatch(/from source/i);
        expect(offer.note).toMatch(/CI workflow artifact/i);
        expect(offer.note).toMatch(/checksums/i);
        // Each of those three words is a field of the offer, not a marketing flourish:
        // the source tree the build command in `docs/desktop-linux.md` runs in, the CI
        // artifact the same files can be taken from, and the digests they check against.
        expect(DESKTOP_LINUX_APP_OFFER.sourceDir.length).toBeGreaterThan(0);
        expect(DESKTOP_LINUX_APP_OFFER.ciArtifactName.length).toBeGreaterThan(0);
        expect(DESKTOP_LINUX_APP_OFFER.artifacts.length).toBeGreaterThan(0);
        for (const artifact of DESKTOP_LINUX_APP_OFFER.artifacts) {
          expect(artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
        }
      }
    }
  });
});
