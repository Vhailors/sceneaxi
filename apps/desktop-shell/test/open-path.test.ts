/**
 * `sceneaxi-desktop open-path` (sceneaxi#137).
 *
 * The desktop shell reports the shared open-path demo policy and evaluates one
 * operation against it, with the same refusals the CLI produces. It opens no
 * session to do so — policy is contracts, not documents — which is what the
 * "no session was created" assertion below pins down.
 */
import { describe, expect, it } from "vitest";
import {
  OPEN_PATH_REFUSE_CODES,
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  openPathPolicyView,
} from "@sceneaxi/schemas";
import { DesktopExit, runDesktopCommand } from "@sceneaxi/desktop-shell";

describe("desktop shell open-path", () => {
  it("reports the shared policy view verbatim", () => {
    const result = runDesktopCommand(["open-path"]);
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(DesktopExit.OK);
    expect(result.result["policy"]).toEqual(openPathPolicyView());
  });

  it("creates no session: the policy is contracts, not documents", () => {
    let sessions = 0;
    const result = runDesktopCommand(["open-path"], () => {
      sessions += 1;
      throw new Error("open-path must not open a session");
    });
    expect(result.ok).toBe(true);
    expect(sessions).toBe(0);
  });

  it("filters to one profile row, marked as a projection of the whole policy", () => {
    const result = runDesktopCommand([
      "open-path",
      "--profile",
      "@sceneaxi/profile-game",
    ]);
    const policy = result.result["policy"] as {
      policyCount: number;
      filteredTo: string;
      rows: ReadonlyArray<{ profile: string; sessionKind: string }>;
    };
    expect(policy.rows).toHaveLength(1);
    expect(policy.rows[0]?.profile).toBe("@sceneaxi/profile-game");
    expect(policy.rows[0]?.sessionKind).toBe("scene-kernel-session");
    expect(policy.filteredTo).toBe("@sceneaxi/profile-game");
    expect(policy.policyCount).toBe(openPathPolicyView().policyCount);
  });

  it("evaluates an allowed demo operation without claiming shipping", () => {
    const result = runDesktopCommand([
      "open-path",
      "--profile",
      "@sceneaxi/profile-web",
      "--operation",
      "open",
    ]);
    expect(result.ok).toBe(true);
    expect(result.result["decision"]).toMatchObject({
      ok: true,
      profile: "@sceneaxi/profile-web",
      operation: "open",
      shippingClaim: false,
    });
  });

  it("refuses the Kids profile by name with a non-zero exit", () => {
    const result = runDesktopCommand([
      "open-path",
      "--profile",
      OPEN_PATH_REFUSE_ONLY_PROFILE,
      "--operation",
      "open",
    ]);
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(DesktopExit.USAGE);
    expect(result.result["reason"]).toBe(OPEN_PATH_REFUSE_CODES.kidsRefused);
  });

  it("refuses an operation outside the closed kernel-seam set", () => {
    const result = runDesktopCommand([
      "open-path",
      "--profile",
      "@sceneaxi/profile-game",
      "--operation",
      "publish",
    ]);
    expect(result.ok).toBe(false);
    expect(result.result["reason"]).toBe(
      OPEN_PATH_REFUSE_CODES.operationNotInPolicy,
    );
  });

  it("refuses an unknown profile with the shared refusal code, with or without an operation", () => {
    for (const argv of [
      ["open-path", "--profile", "@sceneaxi/profile-imaginary"],
      [
        "open-path",
        "--profile",
        "@sceneaxi/profile-imaginary",
        "--operation",
        "open",
      ],
    ]) {
      const result = runDesktopCommand(argv);
      expect(result.ok).toBe(false);
      expect(result.exitCode).toBe(DesktopExit.USAGE);
      expect(result.result["reason"]).toBe(
        OPEN_PATH_REFUSE_CODES.unknownProfile,
      );
      expect(result.result["profile"]).toBe("@sceneaxi/profile-imaginary");
    }
  });

  it("refuses --operation without --profile, and unknown flags", () => {
    expect(
      runDesktopCommand(["open-path", "--operation", "open"]).exitCode,
    ).toBe(DesktopExit.USAGE);
    expect(runDesktopCommand(["open-path", "--document", "x.json"]).exitCode).toBe(
      DesktopExit.USAGE,
    );
  });

  it("appears in the shell's own command list and help", () => {
    const help = runDesktopCommand([]);
    expect(help.ok).toBe(true);
    expect(
      Object.keys(help.result["commands"] as Record<string, string>),
    ).toContain("open-path");
  });
});
