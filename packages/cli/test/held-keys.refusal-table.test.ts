import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  ExitCode,
  SHIPPED_COMMAND_MAP,
  generateRegistrySnapshot,
  runCli,
  staticEpochAuthority,
  unavailableEpochAuthority,
  type CliCommandMap,
  type FirstMateBacklogExport,
  type HeldKeyRegistrySnapshot,
  type HeldKeyRuntime,
} from "@sceneaxi/cli";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "held-keys",
);
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));

const epoch2Export = loadFixture(
  "firstmate-export.epoch2.json",
) as FirstMateBacklogExport;
const epoch3AllResolvedExport = loadFixture(
  "firstmate-export.epoch3.all-resolved.json",
) as FirstMateBacklogExport;

function snapshotOf(exportFixture: FirstMateBacklogExport): HeldKeyRegistrySnapshot {
  const generated = generateRegistrySnapshot(exportFixture);
  if (!generated.ok) {
    throw new Error(`fixture snapshot generation failed: ${generated.errors.join("; ")}`);
  }
  return generated.value;
}

const snapshotEpoch2 = snapshotOf(epoch2Export); // beta open
const snapshotEpoch3AllResolved = snapshotOf(epoch3AllResolvedExport);

/** One hour after the fixtures' generatedAt — inside the 24h freshness budget. */
const FRESH_NOW = Date.parse("2026-07-20T13:00:00.000Z");
/** 25 hours after generatedAt — outside the 24h freshness budget. */
const STALE_NOW = Date.parse("2026-07-21T13:00:00.000Z");

const mapForEpoch = (epoch: number): CliCommandMap => ({
  ...SHIPPED_COMMAND_MAP,
  builtForRegistryEpoch: epoch,
});

function runtime(overrides: Partial<HeldKeyRuntime>): HeldKeyRuntime {
  return {
    commandMap: mapForEpoch(2),
    snapshot: snapshotEpoch2,
    authority: staticEpochAuthority(2),
    now: () => FRESH_NOW,
    ...overrides,
  };
}

function expectHeldKeyRefusal(
  r: ReturnType<typeof runCli>,
  reason: string,
): void {
  expect(r.exitCode).toBe(ExitCode.HELD_KEY);
  expect(r.envelope.ok).toBe(false);
  if (r.envelope.ok) return;
  expect(r.envelope.error.code).toBe("HELD_KEY");
  expect(r.envelope.error.heldKeyReason).toBe(reason);
  expect(r.envelope.help.length).toBeGreaterThan(0);
}

describe("held-key refusal table (docs/held-key-enforcement.md), row by row", () => {
  it("currency check unavailable → refuse", () => {
    const r = runCli(["demo", "gated"], {
      heldKeys: runtime({
        snapshot: snapshotEpoch3AllResolved,
        commandMap: mapForEpoch(3),
        authority: unavailableEpochAuthority("sentinel unreachable (test double)"),
      }),
    });
    expectHeldKeyRefusal(r, "currency-unavailable");
  });

  it("establishes currency before evaluating the local snapshot", () => {
    const probe = vi.fn(() => ({
      available: false as const,
      reason: "sentinel unreachable (test double)",
    }));
    const r = runCli(["demo", "gated"], {
      heldKeys: runtime({
        snapshot: loadFixture("snapshot.schema-invalid.json"),
        authority: { description: "ordered probe", probe },
      }),
    });

    expect(probe).toHaveBeenCalledOnce();
    expectHeldKeyRefusal(r, "currency-unavailable");
  });

  it("authoritative epoch ≠ local map/snapshot epoch → refuse (stale client)", () => {
    const r = runCli(["demo", "gated"], {
      heldKeys: runtime({
        snapshot: snapshotEpoch3AllResolved,
        commandMap: mapForEpoch(3),
        authority: staticEpochAuthority(4),
      }),
    });
    expectHeldKeyRefusal(r, "authoritative-epoch-mismatch");
  });

  it("snapshot missing → refuse", () => {
    const r = runCli(["demo", "gated"], {
      heldKeys: runtime({ snapshot: undefined }),
    });
    expectHeldKeyRefusal(r, "snapshot-missing");
  });

  it("snapshot schema-invalid → refuse", () => {
    const r = runCli(["demo", "gated"], {
      heldKeys: runtime({
        snapshot: loadFixture("snapshot.schema-invalid.json"),
      }),
    });
    expectHeldKeyRefusal(r, "snapshot-invalid");
  });

  it("snapshot older than the 24h freshness budget → refuse, even with currency OK", () => {
    const r = runCli(["demo", "gated"], {
      heldKeys: runtime({
        snapshot: snapshotEpoch3AllResolved,
        commandMap: mapForEpoch(3),
        authority: staticEpochAuthority(3),
        now: () => STALE_NOW,
      }),
    });
    expectHeldKeyRefusal(r, "snapshot-stale");
  });

  it("map epoch ≠ snapshot epoch → refuse", () => {
    const r = runCli(["demo", "gated"], {
      heldKeys: runtime({
        snapshot: snapshotEpoch2,
        commandMap: mapForEpoch(3),
        authority: staticEpochAuthority(3),
      }),
    });
    expectHeldKeyRefusal(r, "map-snapshot-epoch-mismatch");
  });

  it("verb undeclared in command map → refuse", () => {
    const withoutDemo: CliCommandMap = {
      ...mapForEpoch(2),
      commands: SHIPPED_COMMAND_MAP.commands.filter(
        (c) => c.command !== "demo gated",
      ),
    };
    const r = runCli(["demo", "gated"], {
      heldKeys: runtime({ commandMap: withoutDemo }),
    });
    expectHeldKeyRefusal(r, "verb-undeclared");
  });

  it("command map invalid → refuse (fail closed; cannot even establish gatedness)", () => {
    const r = runCli(["demo", "gated"], {
      heldKeys: runtime({ commandMap: { not: "a map" } }),
    });
    expectHeldKeyRefusal(r, "command-map-invalid");
  });

  it("verb gated by an open key → refuse and NAME the key in the machine-readable envelope", () => {
    const r = runCli(["demo", "gated"], {
      heldKeys: runtime({}),
    });
    expectHeldKeyRefusal(r, "open-held-key");
    if (!r.envelope.ok) {
      expect(r.envelope.error.heldKey).toBe("synthetic-demo-beta");
      expect(r.envelope.error.message).toContain("synthetic-demo-beta");
    }
  });

  it("verb gated by a key unknown to the snapshot → refuse", () => {
    const withoutBeta: FirstMateBacklogExport = {
      ...epoch2Export,
      holds: epoch2Export.holds.filter(
        (h) => h.identity !== "captain-decision-synthetic-demo-beta",
      ),
    };
    const r = runCli(["demo", "gated"], {
      heldKeys: runtime({ snapshot: snapshotOf(withoutBeta) }),
    });
    expectHeldKeyRefusal(r, "unknown-held-key");
    if (!r.envelope.ok) {
      expect(r.envelope.error.heldKey).toBe("synthetic-demo-beta");
    }
  });

  it("all gating keys resolved and currency OK → allow", () => {
    const r = runCli(["demo", "gated"], {
      heldKeys: runtime({
        snapshot: snapshotEpoch3AllResolved,
        commandMap: mapForEpoch(3),
        authority: staticEpochAuthority(3),
      }),
    });
    expect(r.exitCode).toBe(ExitCode.OK);
    expect(r.envelope.ok).toBe(true);
    if (r.envelope.ok) {
      expect(r.envelope.result["status"]).toBe("held-keys-cleared");
    }
  });
});

describe("ungated verbs and the default runtime", () => {
  it("ungated verbs (explicit heldKeys: []) skip the currency check entirely", () => {
    const probe = vi.fn(() => ({
      available: false as const,
      reason: "offline (test double)",
    }));
    const offline = runtime({
      snapshot: undefined,
      authority: { description: "must not be called", probe },
    });
    for (const path of [
      ["protocol", "version"],
      ["protocol", "inspect"],
      ["profile", "list"],
    ]) {
      const r = runCli(path, { heldKeys: offline });
      expect(r.exitCode, path.join(" ")).toBe(ExitCode.OK);
    }

    // An ungated verb that refuses on its own usage rules must also never
    // reach the currency probe: the gate runs before the verb body.
    expect(runCli(["project", "new"], { heldKeys: offline }).exitCode).toBe(
      ExitCode.USAGE,
    );

    expect(probe).not.toHaveBeenCalled();
  });

  it("the default runtime is fail-closed: demo gated refuses out of the box (no sentinel wired)", () => {
    const r = runCli(["demo", "gated"]);
    expectHeldKeyRefusal(r, "currency-unavailable");
  });

  it("held-key refusals honor strict --json equivalence", () => {
    const text = runCli(["demo", "gated"]);
    const json = runCli(["demo", "gated", "--json"]);
    expect(text.exitCode).toBe(json.exitCode);
    expect(text.envelope).toEqual(json.envelope);
    const parsed = JSON.parse(json.stdout) as unknown;
    expect(parsed).toEqual(json.envelope);
  });

  it("--help on a gated verb is introspection, not invocation — no refusal", () => {
    const r = runCli(["demo", "gated", "--help"]);
    expect(r.exitCode).toBe(ExitCode.OK);
  });
});
