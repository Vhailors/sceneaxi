/**
 * The Linux desktop application offer: every fact the umbrella may print about it.
 *
 * The packaged app (ADR 0024, `desktop/linux`) is built by electron-builder, which
 * is not bit-reproducible, so — unlike the SDK archive — the site cannot read these
 * facts off a served file it rebuilt. What ships here is the **recorded build
 * result** of the pinned toolchain run documented in `docs/desktop-linux.md`, and
 * `tests/sites/` holds the two files in lockstep: a digest or file name that
 * appears in one and not the other fails the gate, so the page can never advertise
 * a build the docs do not stand behind.
 *
 * The site serves no binary: the artifacts are built from source with one command,
 * or fetched from the named CI workflow artifact. Windows and macOS are stated as
 * not packaged — a page that offered them would be inventing installers.
 */

export type DesktopAppArtifact = {
  readonly kind: "AppImage" | "deb";
  readonly fileName: string;
  /** SHA-256 of the recorded build, from `desktop/linux/release/SHA256SUMS`. */
  readonly sha256: string;
  readonly byteSize: number;
};

export type DesktopAppOffer = {
  readonly productName: string;
  readonly version: string;
  readonly platform: string;
  readonly recordedOn: string;
  readonly artifacts: readonly DesktopAppArtifact[];
  readonly buildCommand: string;
  readonly verifyCommand: string;
  readonly smokeCommand: string;
  readonly sourceDir: string;
  readonly ciWorkflow: string;
  readonly ciArtifactName: string;
  readonly notPackaged: readonly string[];
  /** Why the digests are a recorded result rather than a rebuild invariant. */
  readonly reproducibilityNote: string;
};

export const DESKTOP_LINUX_APP_OFFER: DesktopAppOffer = Object.freeze({
  productName: "SceneAxi Engine Desktop",
  version: "0.0.0",
  platform: "Linux x86_64",
  recordedOn: "2026-07-31",
  artifacts: Object.freeze([
    Object.freeze({
      kind: "AppImage" as const,
      fileName: "SceneAxi-Engine-Desktop-0.0.0-linux-x86_64.AppImage",
      sha256: "720ca4cb8145231f4eb3cc537ddcd0c246a55a44c09b4f6edca1690c40f2021a",
      byteSize: 115161554,
    }),
    Object.freeze({
      kind: "deb" as const,
      fileName: "SceneAxi-Engine-Desktop-0.0.0-linux-amd64.deb",
      sha256: "a7f7ac9c4cb25db25ae9e8bff7333d60cbab4ac53c035b22e8898e2230fa340f",
      byteSize: 90491280,
    }),
  ]),
  buildCommand: "pnpm install && cd desktop/linux && pnpm install && pnpm dist",
  verifyCommand: "cd desktop/linux/release && sha256sum -c SHA256SUMS",
  smokeCommand: "cd desktop/linux && pnpm smoke --packaged",
  sourceDir: "desktop/linux",
  ciWorkflow: "desktop-linux",
  ciArtifactName: "sceneaxi-desktop-linux",
  notPackaged: Object.freeze(["Windows", "macOS"]),
  reproducibilityNote:
    "Electron packaging is not bit-reproducible, so these digests identify the recorded build above. A rebuild from source produces its own SHA256SUMS beside its own artifacts — verify the pairing you obtained.",
});

/** The offer the umbrella engine page renders. One committed record, never invented. */
export function desktopLinuxAppOffer(): DesktopAppOffer {
  return DESKTOP_LINUX_APP_OFFER;
}
