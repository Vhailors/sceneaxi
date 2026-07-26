/**
 * `sceneaxi profile open-path` (sceneaxi#137).
 *
 * The verb reports the shared open-path demo policy and evaluates one demo
 * operation against it. It decides nothing itself — the assertions below are
 * about what it reports *verbatim* and what it refuses.
 */
import { describe, expect, it } from "vitest";
import { ExitCode, runCli } from "@sceneaxi/cli";
import {
  OPEN_PATH_REFUSE_CODES,
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  openPathPolicyView,
} from "@sceneaxi/schemas";

function result(argv: readonly string[]) {
  const outcome = runCli(argv);
  if (!outcome.envelope.ok) {
    throw new Error(`expected success, got ${outcome.envelope.error.message}`);
  }
  return outcome.envelope.result;
}

function error(argv: readonly string[]) {
  const outcome = runCli(argv);
  if (outcome.envelope.ok) throw new Error("expected a refusal");
  return { exitCode: outcome.exitCode, error: outcome.envelope.error };
}

describe("profile open-path", () => {
  it("reports the shared policy view verbatim", () => {
    const payload = result(["profile", "open-path"]);
    expect(payload["status"]).toBe("listed");
    expect(payload["policy"]).toEqual(openPathPolicyView());
  });

  it("never reports a shipping claim on any row", () => {
    const payload = result(["profile", "open-path"]);
    const policy = payload["policy"] as { rows: ReadonlyArray<{ shippingClaim: unknown }>; shippingClaim: unknown };
    expect(policy.shippingClaim).toBe(false);
    for (const row of policy.rows) expect(row.shippingClaim).toBe(false);
  });

  it("filters to one profile row", () => {
    const payload = result([
      "profile",
      "open-path",
      "--profile",
      "@sceneaxi/profile-game",
    ]);
    const policy = payload["policy"] as {
      policyCount: number;
      rows: ReadonlyArray<{ profile: string; demoLevel: string }>;
    };
    expect(policy.policyCount).toBe(1);
    expect(policy.rows).toHaveLength(1);
    expect(policy.rows[0]?.profile).toBe("@sceneaxi/profile-game");
    expect(policy.rows[0]?.demoLevel).toBe("demo-driveable");
  });

  it("evaluates an allowed demo operation", () => {
    const payload = result([
      "profile",
      "open-path",
      "--profile",
      "@sceneaxi/profile-web",
      "--operation",
      "advance",
    ]);
    expect(payload["status"]).toBe("evaluated");
    expect(payload["decision"]).toMatchObject({
      ok: true,
      profile: "@sceneaxi/profile-web",
      operation: "advance",
      demoLevel: "demo-driveable",
      shippingClaim: false,
    });
  });

  it("refuses the Kids profile with the named reason and a non-zero exit", () => {
    const refused = error([
      "profile",
      "open-path",
      "--profile",
      OPEN_PATH_REFUSE_ONLY_PROFILE,
      "--operation",
      "open",
    ]);
    expect(refused.exitCode).toBe(ExitCode.USAGE);
    expect(refused.error.code).toBe("VALIDATION");
    expect(refused.error.details?.["reason"]).toBe(
      OPEN_PATH_REFUSE_CODES.kidsRefused,
    );
  });

  it("still lists the Kids row as refuse-only rather than hiding it", () => {
    const payload = result([
      "profile",
      "open-path",
      "--profile",
      OPEN_PATH_REFUSE_ONLY_PROFILE,
    ]);
    const policy = payload["policy"] as {
      rows: ReadonlyArray<{ demoLevel: string; operations: readonly string[] }>;
    };
    expect(policy.rows[0]?.demoLevel).toBe("refuse-only");
    expect(policy.rows[0]?.operations).toEqual([]);
  });

  it("refuses an operation outside the closed kernel-seam set", () => {
    const refused = error([
      "profile",
      "open-path",
      "--profile",
      "@sceneaxi/profile-game",
      "--operation",
      "checkout",
    ]);
    expect(refused.exitCode).toBe(ExitCode.USAGE);
    expect(refused.error.details?.["reason"]).toBe(
      OPEN_PATH_REFUSE_CODES.operationNotInPolicy,
    );
  });

  it("refuses an unknown profile", () => {
    const refused = error([
      "profile",
      "open-path",
      "--profile",
      "@sceneaxi/profile-imaginary",
    ]);
    expect(refused.exitCode).toBe(ExitCode.USAGE);
    expect(refused.error.code).toBe("VALIDATION");
  });

  it("refuses --operation without --profile", () => {
    const refused = error([
      "profile",
      "open-path",
      "--operation",
      "open",
    ]);
    expect(refused.exitCode).toBe(ExitCode.USAGE);
    expect(refused.error.code).toBe("AMBIGUOUS_INPUT");
  });

  it("owns its unknown-flag refusal (takesArgs verbs must)", () => {
    const refused = error(["profile", "open-path", "--nope"]);
    expect(refused.exitCode).toBe(ExitCode.USAGE);
    expect(refused.error.code).toBe("UNKNOWN_FLAG");
  });

  it("has help that names both flags", () => {
    const payload = result(["profile", "open-path", "--help"]);
    expect(payload["command"]).toBe("profile open-path");
    expect(Object.keys(payload["flags"] as object)).toEqual([
      "--profile",
      "--operation",
    ]);
  });
});
