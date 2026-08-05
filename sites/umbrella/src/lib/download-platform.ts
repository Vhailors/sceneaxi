/**
 * Desktop-platform projection for the umbrella's primary download action.
 *
 * Detection changes copy only. Every visitor reaches the same evidence-backed `/engine`
 * route, and an unavailable platform never acquires a download URL by being detected.
 *
 * The Linux state is `recorded-build` rather than "available", because that is the
 * offer `/engine` can actually serve. `desktopLinuxAppOffer()` in `@sceneaxi/site-kit`
 * states that this site serves no desktop binary: the artifacts are built from source
 * with one command or fetched from the named CI workflow artifact, against recorded
 * checksums. A row labelled "Available" beside a build recipe would be exactly the
 * claim this vocabulary exists to prevent, so each state carries its own rendered
 * words here instead of a component deriving them from the state name.
 *
 * Which platforms are packaged is that offer's fact, not this table's. This module is
 * reached from a `"use client"` component, so it may not value-import the Node-bearing
 * site-kit barrel and restates the split instead, in the same shape
 * `viewport-letterbox.ts` uses for a Foundations colour and for the same reason.
 * The offer's `unavailablePlatforms` is what decides:
 * `tests/sites/desktop-offer-lockstep.test.ts` binds every row's availability, href, and
 * detected copy to it, so packaging shipping for Windows or macOS fails the gate rather
 * than leaving a stale "Coming soon" here. The rows are authored rather than derived
 * because a derived row would silently keep this copy beside the new state.
 */

export type DownloadPlatformId = "linux" | "macos" | "windows";
export type DetectedDownloadPlatform = DownloadPlatformId | "unknown";
export type DownloadAvailability = "recorded-build" | "coming-soon";

export interface DownloadPlatformOffer {
  readonly id: DownloadPlatformId;
  readonly name: string;
  readonly availability: DownloadAvailability;
  /** The state's own rendered words. No surface may shorten one into "Available". */
  readonly label: string;
  readonly note: string;
  readonly href: "/engine" | null;
}

export const DOWNLOAD_PLATFORMS: readonly DownloadPlatformOffer[] = Object.freeze([
  Object.freeze({
    id: "linux" as const,
    name: "Linux",
    availability: "recorded-build" as const,
    label: "Recorded build",
    note: "First platform. Build it from source with one command, or take the named CI workflow artifact, and check it against the recorded checksums.",
    href: "/engine" as const,
  }),
  Object.freeze({
    id: "macos" as const,
    name: "macOS",
    availability: "coming-soon" as const,
    label: "Coming soon",
    note: "Coming soon after packaging and signing ship.",
    href: null,
  }),
  Object.freeze({
    id: "windows" as const,
    name: "Windows",
    availability: "coming-soon" as const,
    label: "Coming soon",
    note: "Coming soon after packaging and signing ship.",
    href: null,
  }),
]);

export function resolveDownloadPlatform(userAgent: string): DetectedDownloadPlatform {
  if (/android|cros|iphone|ipad|ipod/i.test(userAgent)) return "unknown";
  if (/windows/i.test(userAgent)) return "windows";
  if (/macintosh|mac os x/i.test(userAgent)) return "macos";
  if (/linux|x11/i.test(userAgent)) return "linux";
  return "unknown";
}

const DOWNLOAD_CONTEXT: Readonly<Record<DetectedDownloadPlatform, string>> = Object.freeze({
  linux:
    "Linux detected. The download page carries the engine SDK archive, plus the recorded Linux desktop build you compile from source or take from CI against its published checksums.",
  macos:
    "macOS detected. The download page carries the engine SDK archive; desktop packaging is coming soon, and Linux is the first platform.",
  windows:
    "Windows detected. The download page carries the engine SDK archive; desktop packaging is coming soon, and Linux is the first platform.",
  unknown:
    "The download page carries the engine SDK archive. The Linux desktop build is recorded and checksummed; macOS and Windows packaging is coming soon.",
});

export function downloadCallToAction(platform: DetectedDownloadPlatform) {
  return Object.freeze({
    label: "Download" as const,
    href: "/engine" as const,
    context: DOWNLOAD_CONTEXT[platform],
    detectedPlatform: platform,
    platforms: DOWNLOAD_PLATFORMS,
  });
}
