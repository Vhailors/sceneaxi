/**
 * The card mark: a deterministic figure derived from a listing's real content hash.
 *
 * The accepted design fills every card and hero tile with a rendered-looking asset
 * thumbnail. This storefront has no rendered thumbnails, and the same design archive is
 * where every digest, file size and download count is invented placeholder data — so
 * dressing an empty tile up as a render would be exactly the trust defect a product
 * whose pitch is "trust is shown, not implied" cannot afford.
 *
 * What ships instead keeps the design's tile treatment and makes it honest: the figure
 * is a pure function of the listing's own `sha256:` digest, so two listings differ
 * because their bytes differ, the same listing always draws the same mark, and the mark
 * claims nothing about geometry the storefront has not seen. A digest this module cannot
 * read is refused rather than defaulted, so a malformed record draws no mark at all.
 *
 * The palette is the Foundations v2 neutral ramp only. Store accent is applied by the
 * stylesheet, which is why this module is byte-identical on both storefronts.
 */

/** The four hex characters at each end, the way the design prints a digest. */
const SHORT_DIGEST_EDGE = 4;

/** Minimum hex length that can seed every field below without reusing a byte. */
const REQUIRED_HEX = 8;

/** Neutral chip pairs from the design's own tile fills. No hue carries meaning. */
const CHIP_PAIRS: readonly (readonly [string, string])[] = Object.freeze([
  Object.freeze(["#A0A6AE", "#4E545C"] as const),
  Object.freeze(["#98A2AE", "#464E58"] as const),
  Object.freeze(["#8A9099", "#3E444C"] as const),
  Object.freeze(["#9AA1A9", "#454B53"] as const),
  Object.freeze(["#7E858E", "#3A4048"] as const),
  Object.freeze(["#7A8189", "#383E45"] as const),
]);

export type DigestSigil = {
  /** Rotation in degrees, bounded to the design's ±9° range. */
  readonly rotateDeg: number;
  /** The design's constant chip skew. */
  readonly skewDeg: number;
  readonly widthPercent: number;
  readonly heightPercent: number;
  readonly gradientFrom: string;
  readonly gradientTo: string;
  /** `9f31…b0c4` — a shortening of the real digest, never a stand-in for one. */
  readonly shortDigest: string;
};

const HEX = /^[0-9a-f]+$/;

/** The hex body of a `sha256:` digest, or `null` when the record is not readable. */
function digestHex(digest: string): string | null {
  const trimmed = digest.trim().toLowerCase();
  const marker = trimmed.indexOf(":");
  if (marker === -1) return null;
  if (trimmed.slice(0, marker) !== "sha256") return null;
  const hex = trimmed.slice(marker + 1);
  return hex.length >= REQUIRED_HEX && HEX.test(hex) ? hex : null;
}

const byteAt = (hex: string, index: number): number =>
  Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);

/**
 * Build the mark for one digest, or `null` when the digest cannot be read.
 *
 * Every field is bounded, so a hostile or truncated digest can change which mark is
 * drawn but can never change the layout the mark is drawn into.
 */
export function digestSigil(digest: string): DigestSigil | null {
  const hex = digestHex(digest);
  if (hex === null) return null;
  const pair = CHIP_PAIRS[byteAt(hex, 3) % CHIP_PAIRS.length];
  if (pair === undefined) return null;
  return Object.freeze({
    rotateDeg: (byteAt(hex, 0) % 19) - 9,
    skewDeg: -6,
    widthPercent: 40 + (byteAt(hex, 1) % 12),
    heightPercent: 36 + (byteAt(hex, 2) % 10),
    gradientFrom: pair[0],
    gradientTo: pair[1],
    shortDigest: shortenDigest(digest),
  });
}

/**
 * `sha256:9f31…b0c4`, or the value unchanged when it is too short to shorten.
 *
 * Shortening is display only. The full digest stays on the page — the detail record
 * prints it in full and every truncated instance carries it in `title`.
 */
export function shortenDigest(digest: string): string {
  const hex = digestHex(digest);
  if (hex === null || hex.length <= SHORT_DIGEST_EDGE * 2) return digest;
  return `${hex.slice(0, SHORT_DIGEST_EDGE)}…${hex.slice(-SHORT_DIGEST_EDGE)}`;
}
