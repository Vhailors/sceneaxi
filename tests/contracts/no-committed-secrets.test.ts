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
 *
 * The assignment patterns use `[^\S\r\n]*` rather than `\s*` around the `=` on
 * purpose: `\s` matches a newline, so `\s*\S+` would happily read the *next*
 * line's text as the value and flag every `NAME=` placeholder in a committed
 * `.env.example`. The value has to be on the same line to be a value.
 */
const HSPACE = "[^\\S\\r\\n]*";
const assignedTo = (name: string) =>
  new RegExp(`^${HSPACE}${name}${HSPACE}=${HSPACE}\\S+`, "m");

const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
  ["a Stripe secret key", /\bsk_(?:test|live)_[A-Za-z0-9]{8,}/],
  ["a Stripe restricted key", /\brk_(?:test|live)_[A-Za-z0-9]{8,}/],
  ["a Stripe webhook secret", /\bwhsec_[A-Za-z0-9]{16,}/],
  ["a Postgres connection string", /\bpostgres(?:ql)?:\/\/[^\s"'`]+/],
  ["a Neon host", /\b[a-z0-9-]+\.[a-z0-9-]+\.neon\.tech\b/],
  ["an assigned DATABASE_URL", assignedTo("DATABASE_URL")],
  ["an assigned STRIPE_SECRET_KEY", assignedTo("STRIPE_SECRET_KEY")],
  ["an assigned STRIPE_WEBHOOK_SECRET", assignedTo("STRIPE_WEBHOOK_SECRET")],
  ["an assigned SCENEAXI_ADMIN_EMAIL", assignedTo("SCENEAXI_ADMIN_EMAIL")],
];

/**
 * The few tracked files that must carry credential-shaped literals to do their
 * job: this scan itself, and the injected-violation fixture that proves the site
 * secret checker fails on a *planted* connection string. Nothing else is exempt,
 * and each entry is asserted below to still be tracked, so an exemption cannot
 * silently outlive the fixture that earned it.
 */
const CREDENTIAL_SHAPED_FIXTURES: ReadonlyArray<string> = [
  "tests/boundary/injected-site-violations.test.ts",
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
        if (CREDENTIAL_SHAPED_FIXTURES.some((f) => file === join(repoRoot, f))) {
          return false;
        }
        const text = readText(file);
        if (text === undefined) return false;
        return pattern.test(text);
      });
      expect(offenders.map((file) => file.slice(repoRoot.length))).toEqual([]);
    });
  }

  it("exempts only fixtures that still exist and still need the exemption", () => {
    for (const relative of CREDENTIAL_SHAPED_FIXTURES) {
      expect(trackedFiles).toContain(relative);
      // An exemption is only legitimate while the file actually carries a
      // credential-shaped literal; otherwise it is a hole with no reason left.
      const text = readText(join(repoRoot, relative));
      expect(text).toBeDefined();
      expect(FORBIDDEN.some(([, pattern]) => pattern.test(text ?? ""))).toBe(true);
    }
  });

  it("keeps every committed .env.example to names only", () => {
    const examples = trackedFiles.filter((relative) =>
      relative.endsWith(".env.example"),
    );
    // Fail-closed: the sites and the root each ship one, so an empty list means
    // the glob broke rather than that every example is clean.
    expect(examples.length).toBeGreaterThan(1);
    for (const relative of examples) {
      const text = readText(join(repoRoot, relative)) ?? "";
      for (const [label, pattern] of FORBIDDEN) {
        expect(`${relative}: ${label}: ${pattern.test(text)}`).toBe(
          `${relative}: ${label}: false`,
        );
      }
    }
  });

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
