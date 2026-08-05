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
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DESKTOP_LINUX_APP_OFFER } from "@sceneaxi/site-kit";

const doc = readFileSync(new URL("../../docs/desktop-linux.md", import.meta.url), "utf8");

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
    // The recorded run predates the declaration, so the doc and the note must bound
    // its retention rather than attribute it to a setting that governs later runs.
    expect(doc).toContain("governs every later run");
    expect(DESKTOP_LINUX_APP_OFFER.retentionNote).toContain("upper bound");
    expect(DESKTOP_LINUX_APP_OFFER.retentionNote).toContain("repository default");
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

  it("keeps the honesty claims aligned: not bit-reproducible, Windows/macOS absent", () => {
    expect(doc).toContain("not bit-reproducible");
    expect(DESKTOP_LINUX_APP_OFFER.reproducibilityNote).toContain("not bit-reproducible");
    expect(doc).toContain("Windows and macOS packaging");
    expect(DESKTOP_LINUX_APP_OFFER.unavailablePlatforms.map((row) => row.platform)).toEqual([
      "macOS",
      "Windows",
    ]);
    expect(DESKTOP_LINUX_APP_OFFER.unavailablePlatforms.every((row) => row.status === "coming-soon"))
      .toBe(true);
    expect(doc).toContain("no code-signing claim");
    expect(doc).toContain("no auto-update support");
  });

  it("documents first-run project creation and all three honest product tabs", () => {
    expect(doc).toContain("seeds `scene.json` only when that file is absent");
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
