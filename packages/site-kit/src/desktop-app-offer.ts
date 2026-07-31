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
 *
 * Every `Object.freeze` below is annotated `@__PURE__` so this record can never
 * reach the packaged application it describes. `desktop/linux` bundles `site-kit`
 * for the scene payload, and without the annotation esbuild keeps this module in
 * `dist/main.cjs`: the digest of a build would then be inside that build, and
 * recording a fresh one would invalidate itself on the next rebuild. Held by
 * `tests/sites/desktop-offer-lockstep.test.ts`.
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

export const DESKTOP_LINUX_APP_OFFER: DesktopAppOffer = /* @__PURE__ */ Object.freeze({
  productName: "SceneAxi Engine Desktop",
  version: "0.0.0",
  platform: "Linux x86_64",
  recordedOn: "2026-07-31",
  artifacts: /* @__PURE__ */ Object.freeze([
    /* @__PURE__ */ Object.freeze({
      kind: "AppImage" as const,
      fileName: "SceneAxi-Engine-Desktop-0.0.0-linux-x86_64.AppImage",
      sha256: "4e1814157e78e6619407c07de4a1f1cdf5bf84880f5f53e917815722f07923db",
      byteSize: 115161576,
    }),
    /* @__PURE__ */ Object.freeze({
      kind: "deb" as const,
      fileName: "SceneAxi-Engine-Desktop-0.0.0-linux-amd64.deb",
      sha256: "d51cfb28f79e7fb8e4009648b6129f239ec8f39823c6fa390e2519754811a0a8",
      byteSize: 90491852,
    }),
  ]),
  buildCommand: "pnpm install && cd desktop/linux && pnpm install && pnpm dist",
  verifyCommand: "cd desktop/linux/release && sha256sum -c SHA256SUMS",
  smokeCommand: "cd desktop/linux && pnpm smoke --packaged",
  sourceDir: "desktop/linux",
  ciWorkflow: "desktop-linux",
  ciArtifactName: "sceneaxi-desktop-linux",
  notPackaged: /* @__PURE__ */ Object.freeze(["Windows", "macOS"]),
  reproducibilityNote:
    "Electron packaging is not bit-reproducible, so these digests identify the recorded build above. A rebuild from source produces its own SHA256SUMS beside its own artifacts — verify the pairing you obtained.",
});

/** The offer the umbrella engine page renders. One committed record, never invented. */
export function desktopLinuxAppOffer(): DesktopAppOffer {
  return DESKTOP_LINUX_APP_OFFER;
}
