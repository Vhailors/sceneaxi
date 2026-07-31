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

  it("records the same date and version the doc stands behind", () => {
    expect(doc).toContain(`Recorded ${DESKTOP_LINUX_APP_OFFER.recordedOn}`);
    for (const artifact of DESKTOP_LINUX_APP_OFFER.artifacts) {
      expect(artifact.fileName).toContain(DESKTOP_LINUX_APP_OFFER.version);
    }
  });

  it("keeps the honesty claims aligned: not bit-reproducible, Windows/macOS absent", () => {
    expect(doc).toContain("not bit-reproducible");
    expect(DESKTOP_LINUX_APP_OFFER.reproducibilityNote).toContain("not bit-reproducible");
    expect(doc).toContain("Windows and macOS packaging");
    expect(DESKTOP_LINUX_APP_OFFER.notPackaged).toEqual(["Windows", "macOS"]);
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
  });
});
