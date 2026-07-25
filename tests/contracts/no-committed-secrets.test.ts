import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A committed credential is the one defect in this vertical that no amount of
 * careful policy fixes after the fact, so it is asserted mechanically rather than
 * left to review. The scan walks the whole tracked tree, not just the identity
 * packages: a key pasted into an unrelated fixture is the likeliest accident.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
  ".sceneaxi",
  ".turbo",
  ".cache",
]);

const TEXT_FILE = /\.(ts|tsx|js|mjs|cjs|json|md|sql|yaml|yml|example)$/;

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (TEXT_FILE.test(entry)) out.push(path);
  }
  return out;
};

const files = walk(repoRoot);

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
  it("scans a non-empty surface", () => {
    // Fail-closed: a walk that found nothing would pass every check below.
    expect(files.length).toBeGreaterThan(50);
  });

  for (const [label, pattern] of FORBIDDEN) {
    it(`commits no ${label}`, () => {
      const offenders = files.filter((file) => {
        // This file necessarily contains the patterns themselves.
        if (file === fileURLToPath(import.meta.url)) return false;
        return pattern.test(readFileSync(file, "utf8"));
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
