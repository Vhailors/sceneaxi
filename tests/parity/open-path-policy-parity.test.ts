/**
 * Open-path demo policy parity across every surface the dependency matrix
 * allows to express it (sceneaxi#137).
 *
 * `tests/parity/shell-cli-parity.test.ts` proves the three surfaces produce
 * byte-identical *documents*. This suite proves they make identical *policy
 * statements*: the CLI verb, the desktop shell command, and the web shell view
 * model all render one shared value, and both profiles read their row from that
 * same table instead of authoring one.
 *
 * The point is that parity here is a data identity rather than three prose
 * descriptions kept aligned by review. A surface that wants to say something
 * different about an open path has to change the policy.
 *
 * Imports use relative paths into package sources so the root `tests/` tree does
 * not need hoisted `@sceneaxi/*` links (pnpm isolates workspace deps).
 */
import { describe, expect, it } from "vitest";
import {
  OPEN_PATH_POLICY,
  OPEN_PATH_REFUSE_CODES,
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  openPathPolicyView,
  openPathSurfaceNotes,
  resolveOpenPathSurfaceRequest,
} from "../../packages/schemas/src/index.ts";
import { runCli } from "../../packages/cli/src/index.ts";
import { runDesktopCommand } from "../../apps/desktop-shell/src/index.ts";
import { createOpenPathView } from "../../apps/web-shell/src/index.ts";
import {
  openPathPolicy as gamePolicy,
  evaluateOpenPath as evaluateGame,
} from "../../packages/profile-game/src/index.ts";
import {
  openPathPolicy as webPolicy,
  evaluateOpenPath as evaluateWeb,
} from "../../packages/profile-web/src/index.ts";

function cliPolicy(argv: readonly string[]): unknown {
  const outcome = runCli(argv);
  if (!outcome.envelope.ok) {
    throw new Error(`CLI refused: ${outcome.envelope.error.message}`);
  }
  return outcome.envelope.result["policy"];
}

describe("open-path policy parity (conformance)", () => {
  it("CLI, desktop shell, and web shell report one identical policy payload", () => {
    const contract = openPathPolicyView();
    const cli = cliPolicy(["profile", "open-path"]);
    const desktop = runDesktopCommand(["open-path"]).result["policy"];
    const web = createOpenPathView().policy;

    expect(cli).toEqual(contract);
    expect(desktop).toEqual(contract);
    expect(web).toEqual(contract);
    expect(cli).toEqual(desktop);
    expect(desktop).toEqual(web);
  });

  it("both profiles read the same rows the surfaces report", () => {
    const rows = openPathPolicyView().rows;
    expect(rows.find((row) => row.profile === "@sceneaxi/profile-game")).toEqual({
      ...gamePolicy,
      operations: [...gamePolicy.operations],
    });
    expect(rows.find((row) => row.profile === "@sceneaxi/profile-web")).toEqual({
      ...webPolicy,
      operations: [...webPolicy.operations],
    });
  });

  it("every surface reaches the same verdict for every profile × operation", () => {
    const operations = [
      "open",
      "dispatch",
      "advance",
      "observe",
      "save",
      "replay",
      "publish",
      "checkout",
      "deploy",
    ];

    for (const row of OPEN_PATH_POLICY) {
      for (const operation of operations) {
        const argv = [
          "profile",
          "open-path",
          "--profile",
          row.profile,
          "--operation",
          operation,
        ];
        const cli = runCli(argv);
        const desktop = runDesktopCommand([
          "open-path",
          "--profile",
          row.profile,
          "--operation",
          operation,
        ]);
        const web = createOpenPathView().evaluate(row.profile, operation);

        expect(cli.envelope.ok).toBe(web.ok);
        expect(desktop.ok).toBe(web.ok);

        if (web.ok) {
          expect(
            cli.envelope.ok ? cli.envelope.result["decision"] : undefined,
          ).toEqual(web);
          expect(desktop.result["decision"]).toEqual(web);
        } else {
          expect(
            cli.envelope.ok ? undefined : cli.envelope.error.details?.["reason"],
          ).toBe(web.code);
          expect(desktop.result["reason"]).toBe(web.code);
        }
      }
    }
  });

  it("the profiles' own evaluators agree with the surfaces", () => {
    for (const operation of gamePolicy.operations) {
      expect(evaluateGame(operation)).toEqual(
        createOpenPathView().evaluate("@sceneaxi/profile-game", operation),
      );
    }
    for (const operation of webPolicy.operations) {
      expect(evaluateWeb(operation)).toEqual(
        createOpenPathView().evaluate("@sceneaxi/profile-web", operation),
      );
    }
  });

  it("every surface projects one profile the same way, and keeps the true policy count", () => {
    for (const row of OPEN_PATH_POLICY) {
      const cli = cliPolicy(["profile", "open-path", "--profile", row.profile]);
      const desktop = runDesktopCommand([
        "open-path",
        "--profile",
        row.profile,
      ]).result["policy"];
      const web = createOpenPathView().policyFor(row.profile);

      expect(web.ok).toBe(true);
      if (!web.ok) continue;
      expect(cli).toEqual(web.policy);
      expect(desktop).toEqual(web.policy);
      expect(web.policy.filteredTo).toBe(row.profile);
      expect(web.policy.rows).toHaveLength(1);
      expect(web.policy.policyCount).toBe(OPEN_PATH_POLICY.length);
    }
  });

  it("both command surfaces print the shared policy sentences, not their own", () => {
    const reported: ReadonlyArray<{
      readonly request: { profile?: string; operation?: string };
      readonly cli: readonly string[];
      readonly desktop: readonly string[];
    }> = [
      { request: {}, cli: ["profile", "open-path"], desktop: ["open-path"] },
      {
        request: { profile: "@sceneaxi/profile-game" },
        cli: ["profile", "open-path", "--profile", "@sceneaxi/profile-game"],
        desktop: ["open-path", "--profile", "@sceneaxi/profile-game"],
      },
      {
        request: { profile: "@sceneaxi/profile-web", operation: "open" },
        cli: [
          "profile",
          "open-path",
          "--profile",
          "@sceneaxi/profile-web",
          "--operation",
          "open",
        ],
        desktop: [
          "open-path",
          "--profile",
          "@sceneaxi/profile-web",
          "--operation",
          "open",
        ],
      },
    ];

    for (const { request, cli: cliArgv, desktop: desktopArgv } of reported) {
      const shared = [
        ...openPathSurfaceNotes(resolveOpenPathSurfaceRequest(request)),
      ];
      expect(shared.length).toBeGreaterThan(0);
      expect([...runCli(cliArgv).envelope.help].slice(0, shared.length)).toEqual(
        shared,
      );
      expect([...runDesktopCommand(desktopArgv).help]).toEqual(shared);
    }

    const kids = {
      profile: OPEN_PATH_REFUSE_ONLY_PROFILE,
      operation: "open",
    };
    const kidsHelp = runCli([
      "profile",
      "open-path",
      "--profile",
      kids.profile,
      "--operation",
      kids.operation,
    ]).envelope.help;
    for (const note of openPathSurfaceNotes(
      resolveOpenPathSurfaceRequest(kids),
    )) {
      expect(kidsHelp).toContain(note);
    }
  });

  it("an off-policy profile refuses identically on every surface", () => {
    const unknown = "@sceneaxi/profile-imaginary";

    for (const operation of ["open", "publish"]) {
      const cli = runCli([
        "profile",
        "open-path",
        "--profile",
        unknown,
        "--operation",
        operation,
      ]);
      const desktop = runDesktopCommand([
        "open-path",
        "--profile",
        unknown,
        "--operation",
        operation,
      ]);
      const web = createOpenPathView().evaluate(unknown, operation);

      expect(web.ok).toBe(false);
      if (web.ok) continue;
      expect(web.code).toBe(OPEN_PATH_REFUSE_CODES.unknownProfile);
      expect(cli.envelope.ok).toBe(false);
      expect(desktop.ok).toBe(false);
      expect(
        cli.envelope.ok ? undefined : cli.envelope.error.details?.["reason"],
      ).toBe(web.code);
      expect(
        cli.envelope.ok ? undefined : cli.envelope.error.message,
      ).toBe(web.message);
      expect(desktop.result["reason"]).toBe(web.code);
      expect(desktop.result["message"]).toBe(web.message);
    }
  });

  it("reporting an off-policy profile refuses with the same code as evaluating one", () => {
    const unknown = "@sceneaxi/profile-imaginary";
    const cli = runCli(["profile", "open-path", "--profile", unknown]);
    const desktop = runDesktopCommand(["open-path", "--profile", unknown]);
    const web = createOpenPathView().policyFor(unknown);

    expect(web.ok).toBe(false);
    if (web.ok) return;
    expect(web.code).toBe(OPEN_PATH_REFUSE_CODES.unknownProfile);
    expect(cli.envelope.ok).toBe(false);
    expect(cli.exitCode).not.toBe(0);
    expect(
      cli.envelope.ok ? undefined : cli.envelope.error.details?.["reason"],
    ).toBe(web.code);
    expect(cli.envelope.ok ? undefined : cli.envelope.error.message).toBe(
      web.message,
    );
    expect(desktop.ok).toBe(false);
    expect(desktop.exitCode).not.toBe(0);
    expect(desktop.result["reason"]).toBe(web.code);
    expect(desktop.result["message"]).toBe(web.message);
  });

  it("Kids refuses on every surface, and never as an empty result", () => {
    const cli = runCli([
      "profile",
      "open-path",
      "--profile",
      OPEN_PATH_REFUSE_ONLY_PROFILE,
      "--operation",
      "open",
    ]);
    const desktop = runDesktopCommand([
      "open-path",
      "--profile",
      OPEN_PATH_REFUSE_ONLY_PROFILE,
      "--operation",
      "open",
    ]);
    const web = createOpenPathView().evaluate(
      OPEN_PATH_REFUSE_ONLY_PROFILE,
      "open",
    );

    expect(cli.envelope.ok).toBe(false);
    expect(cli.exitCode).not.toBe(0);
    expect(desktop.ok).toBe(false);
    expect(desktop.exitCode).not.toBe(0);
    expect(web.ok).toBe(false);
    if (!web.ok) expect(web.code).toBe(OPEN_PATH_REFUSE_CODES.kidsRefused);
  });

  it("an explicitly empty flag value refuses identically on both command surfaces", () => {
    const cases: ReadonlyArray<{
      readonly cli: readonly string[];
      readonly desktop: readonly string[];
    }> = [
      {
        cli: ["profile", "open-path", "--profile="],
        desktop: ["open-path", "--profile="],
      },
      {
        cli: [
          "profile",
          "open-path",
          `--profile=${OPEN_PATH_REFUSE_ONLY_PROFILE}`,
          "--operation=",
        ],
        desktop: [
          "open-path",
          `--profile=${OPEN_PATH_REFUSE_ONLY_PROFILE}`,
          "--operation=",
        ],
      },
    ];

    for (const { cli: cliArgv, desktop: desktopArgv } of cases) {
      const cli = runCli(cliArgv);
      const desktop = runDesktopCommand(desktopArgv);

      expect(cli.envelope.ok).toBe(false);
      expect(cli.exitCode).not.toBe(0);
      expect(desktop.ok).toBe(false);
      expect(desktop.exitCode).not.toBe(0);

      const reason = cli.envelope.ok
        ? undefined
        : cli.envelope.error.details?.["reason"];
      expect(reason).toBe(OPEN_PATH_REFUSE_CODES.invalidProperty);
      expect(desktop.result["reason"]).toBe(reason);
      expect(desktop.result["message"]).toBe(
        cli.envelope.ok ? undefined : cli.envelope.error.message,
      );
    }
  });

  it("no surface reports a shipping or production-readiness claim", () => {
    const payloads = [
      JSON.stringify(cliPolicy(["profile", "open-path"])),
      JSON.stringify(runDesktopCommand(["open-path"]).result["policy"]),
      JSON.stringify(createOpenPathView().policy),
    ];
    for (const payload of payloads) {
      expect(payload).toContain('"shippingClaim":false');
      expect(payload).not.toContain('"shippingClaim":true');
      const lowered = payload.toLowerCase();
      for (const forbidden of [
        "production-ready",
        "shipping-ready",
        "ready to ship",
      ]) {
        expect(lowered).not.toContain(forbidden);
      }
    }
  });
});
