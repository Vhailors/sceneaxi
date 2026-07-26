import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  makeFixture,
  removeFixture,
  runCheck,
  writeTo,
} from "../helpers/fixture.ts";

/**
 * Injected-drift regressions for the open-path policy lockstep surface of
 * check-contracts.mjs (sceneaxi#137). Each test copies the real tree, injects
 * one drift, and proves the checker fails closed on exactly that drift. The
 * control test proves the clean copy passes, so every failure below is caused
 * by its injection alone — the same pattern as tests/boundary and tests/syntax.
 *
 * The two invariants worth injecting against directly are the ones the policy
 * exists to hold: a row must not claim shipping, and the Kids row must stay
 * refuse-only with no operations.
 */

const FIXTURES_REL = "packages/schemas/contracts/open-path-policy.fixtures.json";
const DOC_REL = "docs/open-path-policy.md";

interface PolicyFixture {
  schemaVersion: number;
  refuseOnlyProfile: string;
  profiles: {
    profile: string;
    demoLevel: string;
    sessionKind: string;
    operations: string[];
    evidence: string;
    shippingClaim: boolean;
    summary: string;
  }[];
}

const readPolicy = (root: string): PolicyFixture =>
  JSON.parse(readFileSync(join(root, FIXTURES_REL), "utf8")) as PolicyFixture;

const writePolicy = (root: string, policy: PolicyFixture): void => {
  writeTo(root, FIXTURES_REL, `${JSON.stringify(policy, null, 2)}\n`);
};

const rowFor = (policy: PolicyFixture, profile: string) => {
  const row = policy.profiles.find((entry) => entry.profile === profile);
  if (row === undefined) throw new Error(`fixture has no ${profile} row`);
  return row;
};

describe("contract check — injected open-path policy drift", () => {
  let fx: string;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    removeFixture(fx);
  });

  it("control: the unmodified tree passes", () => {
    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.stderr).toBe("");
    expect(res.stdout).toContain("contract check OK");
    expect(res.stdout).toContain("open-path policy rows schema-locked");
    expect(res.status).toBe(0);
  });

  it("fails when a row claims shipping readiness", () => {
    const policy = readPolicy(fx);
    rowFor(policy, "@sceneaxi/profile-game").shippingClaim = true;
    writePolicy(fx, policy);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("shippingClaim must be false");
  });

  it("fails when the Kids row stops being refuse-only", () => {
    const policy = readPolicy(fx);
    const kids = rowFor(policy, "@sceneaxi/profile-kids");
    kids.demoLevel = "demo-driveable";
    kids.sessionKind = "kernel-session";
    writePolicy(fx, policy);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("must stay refuse-only");
  });

  it("fails when the Kids row gains an operation", () => {
    const policy = readPolicy(fx);
    rowFor(policy, "@sceneaxi/profile-kids").operations.push("open");
    writePolicy(fx, policy);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("must declare an empty operation set");
  });

  it("fails when a row drops its committed evidence", () => {
    const policy = readPolicy(fx);
    rowFor(policy, "@sceneaxi/profile-web").evidence = "";
    writePolicy(fx, policy);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("names no committed evidence");
  });

  it("fails when a row changes in the fixture but not in the doc table", () => {
    const policy = readPolicy(fx);
    rowFor(policy, "@sceneaxi/profile-web").sessionKind = "scene-kernel-session";
    writePolicy(fx, policy);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("policy table does not exactly match");
  });

  it("fails when a profile is added to the fixture but not to the doc table", () => {
    const policy = readPolicy(fx);
    policy.profiles.push({
      profile: "@sceneaxi/profile-injected",
      demoLevel: "demo-driveable",
      sessionKind: "kernel-session",
      operations: ["open"],
      evidence: "tests/e2e/injected.test.ts",
      shippingClaim: false,
      summary: "Injected row.",
    });
    writePolicy(fx, policy);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("contract check FAILED");
  });

  it("fails on a duplicate profile row", () => {
    const policy = readPolicy(fx);
    policy.profiles.push({ ...rowFor(policy, "@sceneaxi/profile-web") });
    writePolicy(fx, policy);

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("duplicate profile(s)");
  });

  it("fails when the doc lockstep markers are missing", () => {
    const doc = readFileSync(join(fx, DOC_REL), "utf8");
    writeTo(fx, DOC_REL, doc.replaceAll("<!-- open-path-policy:list -->", ""));

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("open-path-policy:list");
  });

  it("fails when the doc stops naming the canonical fixture path", () => {
    const doc = readFileSync(join(fx, DOC_REL), "utf8");
    writeTo(
      fx,
      DOC_REL,
      doc.replaceAll("open-path-policy.fixtures.json", "elsewhere.json"),
    );

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "does not name the canonical open-path policy fixture path",
    );
  });

  it("fails when the fixture file is unreadable", () => {
    writeTo(fx, FIXTURES_REL, "not json");

    const res = runCheck(fx, "check-contracts.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("contract check FAILED");
  });
});
