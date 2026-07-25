import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A committed credential is the one defect in this vertical that no amount of
 * careful policy fixes after the fact, so it is asserted mechanically rather than
 * left to review. The scan walks the *whole* tracked tree via `git ls-files`, not
 * a hand-picked extension allow-list: a key pasted into an unrelated `.toml`,
 * `.sh`, extensionless file, or committed evidence JSON is the likeliest accident.
 * Only confirmed binary content (a NUL byte in the first page) is skipped.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const trackedFiles = (() => {
  let stdout: Buffer;
  try {
    stdout = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot });
  } catch {
    return [];
  }
  return stdout
    .toString("utf8")
    .split("\0")
    .filter((line) => line.length > 0);
})();

const files = trackedFiles.map((relative) => join(repoRoot, relative));

const textByFile = new Map<string, string | undefined>();

/**
 * Read a tracked file as text. Only confirmed binary content (a NUL byte in the
 * first page) is skipped; any read error fails the scan rather than being
 * silently treated as binary, so an unreadable tracked file cannot hide a key.
 */
const readText = (path: string): string | undefined => {
  if (textByFile.has(path)) return textByFile.get(path);
  const buffer = readFileSync(path);
  const text =
    buffer.subarray(0, 8000).includes(0) ? undefined : buffer.toString("utf8");
  textByFile.set(path, text);
  return text;
};

/**
 * Each pattern matches a *real* credential shape, not a mention of one. Prose and
 * documentation naturally contain the variable names, so the patterns look for
 * values: a live-looking key body, a connection string with a host, an assignment
 * with something after the `=`.
 */
const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
  ["a Stripe secret key", /\bsk_(?:test|live)_[A-Za-z0-9]{8,}/],
  ["a Stripe restricted key", /\brk_(?:test|live)_[A-Za-z0-9]{8,}/],
  ["a Stripe webhook secret", /\bwhsec_[A-Za-z0-9]{16,}/],
  ["a Postgres connection string", /\bpostgres(?:ql)?:\/\/[^\s"'`]+/],
  ["a Neon host", /\b[a-z0-9-]+\.[a-z0-9-]+\.neon\.tech\b/],
  ["an assigned DATABASE_URL", /^\s*DATABASE_URL\s*=\s*\S+/m],
  ["an assigned STRIPE_SECRET_KEY", /^\s*STRIPE_SECRET_KEY\s*=\s*\S+/m],
  ["an assigned STRIPE_WEBHOOK_SECRET", /^\s*STRIPE_WEBHOOK_SECRET\s*=\s*\S+/m],
  ["an assigned SCENEAXI_ADMIN_EMAIL", /^\s*SCENEAXI_ADMIN_EMAIL\s*=\s*\S+/m],
];

describe("no committed secrets", () => {
  it("scans a non-empty tracked surface", () => {
    // Fail-closed: a walk that found nothing would pass every check below.
    expect(files.length).toBeGreaterThan(50);
  });

  for (const [label, pattern] of FORBIDDEN) {
    it(`commits no ${label}`, () => {
      const offenders = files.filter((file) => {
        // This file necessarily contains the patterns themselves.
        if (file === fileURLToPath(import.meta.url)) return false;
        const text = readText(file);
        if (text === undefined) return false;
        return pattern.test(text);
      });
      expect(offenders.map((file) => file.slice(repoRoot.length))).toEqual([]);
    });
  }

  it("keeps .env.example to names only", () => {
    const text = readFileSync(join(repoRoot, ".env.example"), "utf8");
    for (const name of [
      "SCENEAXI_ADMIN_EMAIL",
      "DATABASE_URL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
    ]) {
      expect(text).toContain(name);
      // Every occurrence is commented and carries no value.
      const assigned = new RegExp(`^\\s*${name}\\s*=\\s*\\S`, "m");
      expect(assigned.test(text)).toBe(false);
    }
  });

  it("ignores .env while tracking .env.example", () => {
    const gitignore = readFileSync(join(repoRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain("!.env.example");
  });
});
