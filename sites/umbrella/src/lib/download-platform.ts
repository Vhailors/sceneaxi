/**
 * Desktop-platform projection for the umbrella's primary download action.
 *
 * Detection changes copy only. Every visitor reaches the same evidence-backed `/engine`
 * route, and an unavailable platform never acquires a download URL by being detected.
 */

export type DownloadPlatformId = "linux" | "macos" | "windows";
export type DetectedDownloadPlatform = DownloadPlatformId | "unknown";

export interface DownloadPlatformOffer {
  readonly id: DownloadPlatformId;
  readonly name: string;
  readonly availability: "available" | "coming-soon";
  readonly note: string;
  readonly href: "/engine" | null;
}

export const DOWNLOAD_PLATFORMS: readonly DownloadPlatformOffer[] = Object.freeze([
  Object.freeze({
    id: "linux" as const,
    name: "Linux",
    availability: "available" as const,
    note: "Available first. The download page carries the recorded build and checksum.",
    href: "/engine" as const,
  }),
  Object.freeze({
    id: "macos" as const,
    name: "macOS",
    availability: "coming-soon" as const,
    note: "Coming soon after packaging and signing ship.",
    href: null,
  }),
  Object.freeze({
    id: "windows" as const,
    name: "Windows",
    availability: "coming-soon" as const,
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
  linux: "Linux detected. The recorded Linux desktop build is available now.",
  macos: "macOS detected. Packaging is coming soon; Linux is available first.",
  windows: "Windows detected. Packaging is coming soon; Linux is available first.",
  unknown: "Linux is available first. macOS and Windows packaging is coming soon.",
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
