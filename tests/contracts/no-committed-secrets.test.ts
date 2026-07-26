import { readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
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
 *
 * A leading comment marker is part of the assignment, not a reason to skip it:
 * the root `.env.example` writes every variable as `# NAME=`, so anchoring on the
 * name alone would make a pasted `# DATABASE_URL=postgres://…` invisible in the
 * one committed file whose whole job is to carry names without values.
 */
const HSPACE = "[^\\S\\r\\n]*";
const COMMENT = `${HSPACE}(?:#+|//+|\\*+)?${HSPACE}`;
const assignedTo = (name: string) =>
  new RegExp(`^${COMMENT}${name}${HSPACE}=${HSPACE}\\S+`, "m");

/** Names a committed `.env.example` must declare, and may never assign. */
const DOCUMENTED_NAMES: ReadonlyArray<string> = [
  "DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SCENEAXI_ADMIN_EMAIL",
  "SCENEAXI_ADMIN_BOOTSTRAP_SECRET",
];

/**
 * Every name whose *assignment* is forbidden anywhere in the tree.
 * `BETTER_AUTH_SECRET` belongs to the injected provider rather than to SceneAxi,
 * so no committed example declares it — but a deployment still holds one, and
 * `scripts/check-sites.mjs` only ever walks `sites/`, so this repo-wide scan is
 * the only thing standing between a value pasted anywhere else and a commit.
 */
const ASSIGNED_NAMES: ReadonlyArray<string> = [
  ...DOCUMENTED_NAMES,
  "BETTER_AUTH_SECRET",
];

const FORBIDDEN: ReadonlyArray<readonly [string, RegExp]> = [
  ["a Stripe secret key", /\bsk_(?:test|live)_[A-Za-z0-9]{8,}/],
  ["a Stripe restricted key", /\brk_(?:test|live)_[A-Za-z0-9]{8,}/],
  ["a Stripe webhook secret", /\bwhsec_[A-Za-z0-9]{16,}/],
  ["a Postgres connection string", /\bpostgres(?:ql)?:\/\/[^\s"'`]+/],
  ["a Neon host", /\b[a-z0-9-]+\.[a-z0-9-]+\.neon\.tech\b/],
  ...ASSIGNED_NAMES.map(
    (name) => [`an assigned ${name}`, assignedTo(name)] as const,
  ),
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

  it("documents every SceneAxi-owned variable name in a committed .env.example", () => {
    // The value half of the rule is covered by the scan above; what is unique
    // here is presence — an operator has to be able to find the name it must
    // set, whether it belongs to the root example or to one site's.
    const examples = trackedFiles
      .filter((relative) => relative.endsWith(".env.example"))
      .map((relative) => readText(join(repoRoot, relative)) ?? "");
    for (const name of DOCUMENTED_NAMES) {
      const documented = examples.some((text) => text.includes(name));
      expect(`${name}: ${documented}`).toBe(`${name}: true`);
    }
  });

  it("ignores .env while tracking .env.example", () => {
    // Asked of git, not of the file's text. A substring assertion passes on a
    // `.gitignore` whose *last* matching pattern re-ignores `.env.example` —
    // last match wins — which is exactly how a trailing `.env*` once defeated
    // the negation while this test stayed green. Every path below is checked
    // with `--no-index`, so the answer is the pattern set's, not the index's.
    const ignored = (relative: string): boolean => {
      const result = spawnSync("git", ["check-ignore", "-q", "--no-index", "--", relative], {
        cwd: repoRoot,
      });
      // 0 = ignored, 1 = not ignored; anything else is a broken invocation.
      expect([0, 1]).toContain(result.status);
      return result.status === 0;
    };

    for (const relative of [".env", ".env.local", "sites/umbrella/.env.local"]) {
      expect(`${relative}: ${ignored(relative)}`).toBe(`${relative}: true`);
    }

    // Every committed example, including each site's, has to survive the whole
    // pattern set — an operator cannot edit a template git refuses to see.
    const examples = trackedFiles.filter((relative) => relative.endsWith(".env.example"));
    expect(examples.length).toBeGreaterThan(1);
    for (const relative of examples) {
      expect(`${relative}: ${ignored(relative)}`).toBe(`${relative}: false`);
    }
  });
});
