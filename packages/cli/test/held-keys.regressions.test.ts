import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExitCode,
  SHIPPED_COMMAND_MAP,
  generateRegistrySnapshot,
  runCli,
  staticEpochAuthority,
  unavailableEpochAuthority,
  type FirstMateBacklogExport,
  type HeldKeyRuntime,
} from "@sceneaxi/cli";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "held-keys",
);

// Epoch-N export with every synthetic key resolved: the ONLY thing that can
// refuse in these regressions is the currency check itself.
const allResolvedExport = JSON.parse(
  readFileSync(join(fixturesDir, "firstmate-export.epoch3.all-resolved.json"), "utf8"),
) as FirstMateBacklogExport;

const N = allResolvedExport.registryEpoch;
const generated = generateRegistrySnapshot(allResolvedExport);
if (!generated.ok) throw new Error(generated.errors.join("; "));
const snapshotN = generated.value;

/** One hour after generatedAt — snapshot is fresh, well inside the 24h budget. */
const ONE_HOUR_LATER = Date.parse("2026-07-20T13:00:00.000Z");

function clientAtEpochN(authority: HeldKeyRuntime["authority"]): HeldKeyRuntime {
  return {
    commandMap: { ...SHIPPED_COMMAND_MAP, builtForRegistryEpoch: N },
    snapshot: snapshotN,
    authority,
    now: () => ONE_HOUR_LATER,
  };
}

const BYPASS_ENV_FLAGS = [
  "SCENEAXI_ALLOW_OFFLINE",
  "SCENEAXI_OFFLINE_OK",
  "SCENEAXI_SKIP_HELD_KEYS",
  "SCENEAXI_HELD_KEY_BYPASS",
  "SCENEAXI_TRUST_LOCAL_SNAPSHOT",
  "SCENEAXI_SIGNED_OFFLINE_MARKER",
];

describe("mandatory regression: fresh N/N vs authoritative N+1", () => {
  it("client with fresh snapshot N + map N refuses when the authority is at N+1", () => {
    // 1. Client has snapshot N + map N, generated 1 hour ago (fresh).
    // 2. Authoritative holds registered a new key → epoch is now N+1.
    // 3. Client has not refreshed.
    // 4. The gated command MUST refuse (currency mismatch).
    const r = runCli(["demo", "gated"], {
      heldKeys: clientAtEpochN(staticEpochAuthority(N + 1)),
    });
    expect(r.exitCode).toBe(ExitCode.HELD_KEY);
    expect(r.envelope.ok).toBe(false);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("HELD_KEY");
      expect(r.envelope.error.heldKeyReason).toBe("authoritative-epoch-mismatch");
    }
  });

  it("sanity: the same client is allowed when the authority still reports N", () => {
    const r = runCli(["demo", "gated"], {
      heldKeys: clientAtEpochN(staticEpochAuthority(N)),
    });
    expect(r.exitCode).toBe(ExitCode.OK);
  });
});

describe("mandatory regression: offline / unavailable authority", () => {
  it("matching local snapshot N + map N is NEVER sufficient when the authority is unreachable", () => {
    const r = runCli(["demo", "gated"], {
      heldKeys: clientAtEpochN(
        unavailableEpochAuthority("network unreachable (test double)"),
      ),
    });
    expect(r.exitCode).toBe(ExitCode.HELD_KEY);
    expect(r.envelope.ok).toBe(false);
    if (!r.envelope.ok) {
      expect(r.envelope.error.heldKeyReason).toBe("currency-unavailable");
    }
  });
});

describe("env flags cannot reopen an allow path for gated verbs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  for (const flag of BYPASS_ENV_FLAGS) {
    it(`${flag}=1 does not reopen the offline path`, () => {
      vi.stubEnv(flag, "1");
      const r = runCli(["demo", "gated"], {
        heldKeys: clientAtEpochN(unavailableEpochAuthority("offline")),
      });
      expect(r.exitCode).toBe(ExitCode.HELD_KEY);
    });

    it(`${flag}=1 does not reopen the stale-client (N vs N+1) path`, () => {
      vi.stubEnv(flag, "1");
      const r = runCli(["demo", "gated"], {
        heldKeys: clientAtEpochN(staticEpochAuthority(N + 1)),
      });
      expect(r.exitCode).toBe(ExitCode.HELD_KEY);
    });
  }
});
