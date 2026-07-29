/**
 * The live-mode authorization source (captain decision D5).
 *
 * The captain chose configuration over a code-only literal *against* the scout's
 * recommendation, and attached five requirements as the mitigation. This suite
 * is where four of them are proven; the fifth — that `assertModeAuthorized`
 * still refuses at both ends with the variable unset or malformed — is proven
 * end-to-end against real intent creation and a real grant in
 * `stripe-checkout.test.ts`, because that is where both ends live.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BILLING_REFUSE_REASONS,
  STRIPE_LIVE_MODE_AFFIRMATIVE,
  STRIPE_LIVE_MODE_ALIAS_ENV_VARS,
  STRIPE_LIVE_MODE_ENV_VAR,
  assertModeAuthorized,
  hasLiveModeAuthorizationProvenance,
  liveModeAuthorizedFlag,
  resolveLiveModeAuthorization,
  type LiveModeAuthorizationAudit,
} from "@sceneaxi/billing";

const AUTHORIZER = "captain@example.com";
const ON = "2026-07-29";
const AFFIRMATIVE = `${STRIPE_LIVE_MODE_AFFIRMATIVE}:${AUTHORIZER}:${ON}`;

/** A sink that keeps what it was handed, so the audit can be asserted. */
const recorder = () => {
  const written: LiveModeAuthorizationAudit[] = [];
  return {
    written,
    recordAudit: (audit: LiveModeAuthorizationAudit) => {
      written.push(audit);
    },
  };
};

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Every shipped TypeScript source in the workspace — no build output, no tests. */
const SHIPPED_SOURCES: ReadonlyArray<{ path: string; text: string }> = (() => {
  const skipped = new Set(["node_modules", "dist", ".next", "test", "tests"]);
  const found: { path: string; text: string }[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skipped.has(entry.name)) walk(`${dir}${entry.name}/`);
        continue;
      }
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
      const path = `${dir}${entry.name}`;
      found.push({
        path: path.slice(REPO_ROOT.length),
        text: readFileSync(path, "utf8"),
      });
    }
  };
  for (const root of ["packages", "sites", "apps"]) walk(`${REPO_ROOT}${root}/`);
  return Object.freeze(found);
})();

const resolve = (
  env: Readonly<Record<string, string | undefined>>,
  recordAudit?: unknown,
) =>
  resolveLiveModeAuthorization({
    env,
    recordAudit: (recordAudit ?? (() => undefined)) as never,
  });

describe("D5 requirement 1 — one named variable, never a second spelling", () => {
  it("names exactly one variable", () => {
    expect(STRIPE_LIVE_MODE_ENV_VAR).toBe("SCENEAXI_STRIPE_LIVE_AUTHORIZED");
  });

  it("authorizes from that variable alone", () => {
    const sink = recorder();
    const result = resolve({ [STRIPE_LIVE_MODE_ENV_VAR]: AFFIRMATIVE }, sink.recordAudit);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.source).toBe(STRIPE_LIVE_MODE_ENV_VAR);
    expect(result.value.authorizedBy).toBe(AUTHORIZER);
    expect(result.value.authorizedOn).toBe(ON);
  });

  it("refuses every alias by its presence alone, even holding a correct affirmative", () => {
    // The admin identity refuses `SCENEAXI_ADMIN_EMAILS` even when it names one valid
    // address, because a second spelling normalizes the thing the first spelling exists
    // to prevent. A second way to say "live is authorized" is the same defect, so this
    // must be no looser — the alias refuses even alongside a genuine affirmative.
    expect(STRIPE_LIVE_MODE_ALIAS_ENV_VARS.length).toBeGreaterThan(0);
    for (const alias of STRIPE_LIVE_MODE_ALIAS_ENV_VARS) {
      const result = resolve({
        [STRIPE_LIVE_MODE_ENV_VAR]: AFFIRMATIVE,
        [alias]: AFFIRMATIVE,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);
      expect(result.message).toContain(alias);
    }
  });

  it("does not read the alias itself as an authorization", () => {
    for (const alias of STRIPE_LIVE_MODE_ALIAS_ENV_VARS) {
      expect(resolve({ [alias]: AFFIRMATIVE }).ok).toBe(false);
    }
  });
});

describe("D5 requirement 2 — absent, malformed, or anything else means refused", () => {
  it("refuses an unset variable", () => {
    const result = resolve({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);
  });

  it("refuses every value that is not the exact affirmative", () => {
    // Each of these is a value an operator might reasonably expect to work. None is
    // an affirmative: the only accepted value states who authorized live mode and when.
    for (const value of [
      "",
      "   ",
      "true",
      "1",
      "yes",
      "TRUE",
      "on",
      "live",
      STRIPE_LIVE_MODE_AFFIRMATIVE,
      `${STRIPE_LIVE_MODE_AFFIRMATIVE}:${AUTHORIZER}`,
      `${STRIPE_LIVE_MODE_AFFIRMATIVE}:${ON}`,
      `authorized:${AUTHORIZER}:${ON}`,
      `${STRIPE_LIVE_MODE_AFFIRMATIVE}::${ON}`,
      `${STRIPE_LIVE_MODE_AFFIRMATIVE}:not-an-address:${ON}`,
      `${STRIPE_LIVE_MODE_AFFIRMATIVE}:${AUTHORIZER}:29-07-2026`,
      `${STRIPE_LIVE_MODE_AFFIRMATIVE}:${AUTHORIZER}:2026-13-01`,
      `${STRIPE_LIVE_MODE_AFFIRMATIVE}:${AUTHORIZER}:2026-02-30`,
      `${STRIPE_LIVE_MODE_AFFIRMATIVE}:${AUTHORIZER}:${ON}:extra`,
    ]) {
      const result = resolve({ [STRIPE_LIVE_MODE_ENV_VAR]: value });
      expect(result.ok, `"${value}" must not authorize live mode`).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);
    }
  });

  it("refuses a comma-separated list of authorizers", () => {
    // Plural by value rather than by variable name, and refused for the same reason.
    const result = resolve({
      [STRIPE_LIVE_MODE_ENV_VAR]: `${STRIPE_LIVE_MODE_AFFIRMATIVE}:${AUTHORIZER},mate@example.com:${ON}`,
    });
    expect(result.ok).toBe(false);
  });

  it("hands `assertModeAuthorized` nothing but `true` or `undefined`", () => {
    const refused = resolve({});
    expect(liveModeAuthorizedFlag(refused.ok ? refused.value : undefined)).toBeUndefined();
    expect(
      assertModeAuthorized("live", liveModeAuthorizedFlag(undefined)).ok,
    ).toBe(false);
    expect(assertModeAuthorized("test", liveModeAuthorizedFlag(undefined)).ok).toBe(
      true,
    );
  });
});

describe("D5 requirement 3 — the audit record is a precondition", () => {
  it("records who authorized live mode and when, before answering", () => {
    const sink = recorder();
    const result = resolve({ [STRIPE_LIVE_MODE_ENV_VAR]: AFFIRMATIVE }, sink.recordAudit);
    expect(result.ok).toBe(true);
    expect(sink.written.length).toBe(1);
    const audit = sink.written[0];
    expect(audit?.source).toBe(STRIPE_LIVE_MODE_ENV_VAR);
    expect(audit?.authorizedBy).toBe(AUTHORIZER);
    expect(audit?.authorizedOn).toBe(ON);
    expect(audit?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(audit?.record).toContain(AUTHORIZER);
    expect(audit?.record).toContain(ON);
    expect(audit?.record).toContain(audit?.fingerprint ?? "");
  });

  it("refuses when no audit sink is supplied", () => {
    // An authorization nobody can observe afterwards is the silent environment edit
    // the captain's requirement exists to prevent, so it is not an authorization.
    const result = resolveLiveModeAuthorization({
      env: { [STRIPE_LIVE_MODE_ENV_VAR]: AFFIRMATIVE },
    } as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);
  });

  it("refuses when the audit sink fails, rather than authorizing unrecorded", () => {
    const result = resolve({ [STRIPE_LIVE_MODE_ENV_VAR]: AFFIRMATIVE }, () => {
      throw new Error("the audit log is unreachable");
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);
  });

  it("fingerprints two different authorizations differently", () => {
    const first = recorder();
    const second = recorder();
    resolve({ [STRIPE_LIVE_MODE_ENV_VAR]: AFFIRMATIVE }, first.recordAudit);
    resolve(
      {
        [STRIPE_LIVE_MODE_ENV_VAR]: `${STRIPE_LIVE_MODE_AFFIRMATIVE}:mate@example.com:${ON}`,
      },
      second.recordAudit,
    );
    expect(first.written[0]?.fingerprint).not.toBe(second.written[0]?.fingerprint);
  });
});

describe("D5 requirement 4 — the gate stays a gate", () => {
  it("reads nothing that merely correlates with production", () => {
    // Every value here says "this is production" to a human. None of them is an input:
    // a gate that can infer its own authorization is not a gate. `SCENEAXI_BILLING_MODE`
    // is the sharpest of them — it is the variable most likely to be mistaken for live
    // authorization, and selecting the live *mode* is exactly what must not authorize it.
    // The values are deliberately not credential-shaped: what is being asserted is that
    // the name is never read, and a realistic secret literal would prove nothing extra
    // while planting a credential-shaped string in the tree.
    const result = resolve({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      SCENEAXI_BILLING_MODE: "live",
      STRIPE_SECRET_KEY: "set-but-never-read",
      STRIPE_WEBHOOK_SECRET: "set-but-never-read",
      SCENEAXI_ADMIN_EMAIL: AUTHORIZER,
      DATABASE_URL: "set-but-never-read",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(BILLING_REFUSE_REASONS.liveModeNotAuthorized);
  });

  it("authorizes only the exact object it issued, never a look-alike", () => {
    const sink = recorder();
    const result = resolve({ [STRIPE_LIVE_MODE_ENV_VAR]: AFFIRMATIVE }, sink.recordAudit);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const issued = result.value;

    expect(hasLiveModeAuthorizationProvenance(issued)).toBe(true);
    expect(liveModeAuthorizedFlag(issued)).toBe(true);

    // Every way of producing a look-alike produces a different object, and none of
    // them authorizes anything (sceneaxi#126).
    for (const copy of [
      { ...issued },
      Object.assign({}, issued),
      structuredClone(issued),
      JSON.parse(JSON.stringify(issued)) as unknown,
      new Proxy(issued, {}),
      {
        authorizedBy: AUTHORIZER,
        authorizedOn: ON,
        source: STRIPE_LIVE_MODE_ENV_VAR,
        audit: issued.audit,
      },
    ]) {
      expect(hasLiveModeAuthorizationProvenance(copy)).toBe(false);
      expect(liveModeAuthorizedFlag(copy)).toBeUndefined();
      expect(assertModeAuthorized("live", liveModeAuthorizedFlag(copy)).ok).toBe(false);
    }
  });
});

describe("D5 requirement 5 — the gate runs with no live authorization present", () => {
  it("resolves nothing from this process's own environment", () => {
    // `pnpm gate` is hermetic by rule: no network, no DATABASE_URL, no Stripe keys, and
    // no live authorization. If this ever passes, the gate is running somewhere it
    // must not.
    const result = resolveLiveModeAuthorization({
      env: process.env,
      recordAudit: () => undefined,
    });
    expect(result.ok).toBe(false);
  });

  it("is wired to no shipped call site, so live activation still needs its own decision", () => {
    // D5 decided where a `liveModeAuthorized` may come from. It did not enable live
    // mode: ADR 0021 holds live activation as a separate captain decision, so nothing
    // this repository ships passes this resolver's result to a checkout or a grant.
    // A call site appearing here is the change that would need that decision first.
    const callers = SHIPPED_SOURCES.filter(
      (source) =>
        source.text.includes("liveModeAuthorizedFlag(") &&
        !source.path.endsWith("/live-mode.ts"),
    ).map((source) => source.path);
    expect(callers).toEqual([]);
  });
});
