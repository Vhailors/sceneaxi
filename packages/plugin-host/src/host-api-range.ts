/**
 * Minimal hostApi range evaluator for the Plugin Manifest v1 dialect.
 * Supports the grammar documented by PLUGIN_MANIFEST_HOST_API_DIALECT.
 */

type ParsedVersion = {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly string[];
};

const FULL_SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

function parseFullVersion(text: string): ParsedVersion | null {
  const match = FULL_SEMVER_RE.exec(text);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

function compareIdentifiers(a: string, b: string): number {
  const aNum = /^\d+$/.test(a);
  const bNum = /^\d+$/.test(b);
  if (aNum && bNum) {
    const diff = Number(a) - Number(b);
    return diff === 0 ? 0 : diff < 0 ? -1 : 1;
  }
  if (aNum) return -1;
  if (bNum) return 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;
  const len = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < len; i += 1) {
    const left = a.prerelease[i];
    const right = b.prerelease[i];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    const cmp = compareIdentifiers(left, right);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

function expandPartialEndpoint(text: string, end: "lower" | "upper"): ParsedVersion | null {
  if (text === "x" || text === "X" || text === "*") {
    return end === "lower"
      ? { major: 0, minor: 0, patch: 0, prerelease: [] }
      : { major: Number.POSITIVE_INFINITY, minor: 0, patch: 0, prerelease: [] };
  }

  const full = parseFullVersion(text);
  if (full) return full;

  const parts = text.split(".");
  if (parts.length === 1) {
    const major = Number(parts[0]);
    if (!Number.isInteger(major) || major < 0) return null;
    return end === "lower"
      ? { major, minor: 0, patch: 0, prerelease: [] }
      : { major: major + 1, minor: 0, patch: 0, prerelease: [] };
  }
  if (parts.length === 2) {
    const major = Number(parts[0]);
    const minor = Number(parts[1]);
    if (!Number.isInteger(major) || major < 0) return null;
    if (!Number.isInteger(minor) || minor < 0) return null;
    return end === "lower"
      ? { major, minor, patch: 0, prerelease: [] }
      : { major, minor: minor + 1, patch: 0, prerelease: [] };
  }
  return null;
}

function satisfiesComparator(host: ParsedVersion, term: string): boolean {
  const caret = term.startsWith("^") ? term.slice(1) : null;
  if (caret !== null) {
    const base = parseFullVersion(caret) ?? expandPartialEndpoint(caret, "lower");
    if (!base) return false;
    if (compareVersions(host, base) < 0) return false;
    if (base.major > 0) {
      return host.major === base.major;
    }
    if (base.minor > 0) {
      return host.major === 0 && host.minor === base.minor;
    }
    return host.major === 0 && host.minor === 0 && host.patch === base.patch;
  }

  const tilde = term.startsWith("~") ? term.slice(1) : null;
  if (tilde !== null) {
    const base = parseFullVersion(tilde) ?? expandPartialEndpoint(tilde, "lower");
    if (!base) return false;
    if (compareVersions(host, base) < 0) return false;
    return host.major === base.major && host.minor === base.minor;
  }

  const ops = [">=", "<=", ">", "<", "="] as const;
  for (const op of ops) {
    if (!term.startsWith(op)) continue;
    const rest = term.slice(op.length);
    const base = parseFullVersion(rest) ?? expandPartialEndpoint(rest, "lower");
    if (!base) return false;
    const cmp = compareVersions(host, base);
    switch (op) {
      case ">=":
        return cmp >= 0;
      case "<=":
        return cmp <= 0;
      case ">":
        return cmp > 0;
      case "<":
        return cmp < 0;
      case "=":
        return cmp === 0;
    }
  }

  const exact = parseFullVersion(term);
  if (exact) return compareVersions(host, exact) === 0;

  // Partial / x-range as a single term: major-compatible window.
  const lower = expandPartialEndpoint(term, "lower");
  const upper = expandPartialEndpoint(term, "upper");
  if (!lower || !upper) return false;
  return compareVersions(host, lower) >= 0 && compareVersions(host, upper) < 0;
}

function satisfiesHyphen(host: ParsedVersion, arm: string): boolean {
  const parts = arm.split(" - ");
  if (parts.length !== 2) return false;
  const lowerText = parts[0];
  const upperText = parts[1];
  if (lowerText === undefined || upperText === undefined) return false;
  const lower = expandPartialEndpoint(lowerText, "lower");
  const upperExact = parseFullVersion(upperText);
  if (!lower) return false;
  if (upperExact) {
    return (
      compareVersions(host, lower) >= 0 && compareVersions(host, upperExact) <= 0
    );
  }
  const upper = expandPartialEndpoint(upperText, "upper");
  if (!upper) return false;
  return compareVersions(host, lower) >= 0 && compareVersions(host, upper) < 0;
}

function satisfiesArm(host: ParsedVersion, arm: string): boolean {
  if (arm.includes(" - ")) {
    return satisfiesHyphen(host, arm);
  }
  const terms = arm.split(" ");
  return terms.every((term) => satisfiesComparator(host, term));
}

/**
 * Return true when `hostVersion` satisfies the manifest `hostApi` range.
 * Invalid host versions refuse closed (false).
 */
export function hostApiSatisfied(
  hostApiRange: string,
  hostVersion: string,
): boolean {
  const host = parseFullVersion(hostVersion);
  if (!host) return false;
  const arms = hostApiRange.split(" || ");
  return arms.some((arm) => satisfiesArm(host, arm));
}
