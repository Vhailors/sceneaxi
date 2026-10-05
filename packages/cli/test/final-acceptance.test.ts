import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { runCli, SHIPPED_COMMAND_MAP, staticEpochAuthority, generateRegistrySnapshot, type FirstMateBacklogExport, type HeldKeyRuntime } from "@sceneaxi/cli";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/held-keys/firstmate-export.epoch3.all-resolved.json", import.meta.url), "utf8")) as FirstMateBacklogExport;

const generated = generateRegistrySnapshot(fixture);

if (!generated.ok) throw new Error("Invalid acceptance fixture");

const stamp = Date.parse(generated.value.generatedAt);

const runtime = (overrides: Partial<HeldKeyRuntime> = {}): HeldKeyRuntime => ({ commandMap: { ...SHIPPED_COMMAND_MAP, builtForRegistryEpoch: 3 }, snapshot: generated.value, authority: staticEpochAuthority(3), now: () => stamp, ...overrides });

describe("CLI independent final acceptance", () => {
  it.each(["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"].flatMap(key => [[key], ["project", key], ["desktop", key], ["desktop", "bridge", key]]))("never resolves inherited path %j", (...path: string[]) => {
    const result = runCli([...path, "--json"]);
    expect(result.exitCode).toBe(2);
    expect(result.envelope).toMatchObject({ ok: false, error: { code: "UNKNOWN_COMMAND" } });
  });
  it.each(["--version", "-v", "-V"])("accepts only bare %s in JSON and text", flag => {
    const json = runCli([flag, "--json"]); const text = runCli([flag]);
    expect(json.exitCode).toBe(0); expect(text.exitCode).toBe(0);
    expect(text.envelope).toEqual(json.envelope);
    expect(json.envelope).toMatchObject({ ok: true, result: { cliVersion: expect.any(String) } });

    for (const tokens of [["--bogus"], ["--json=1"], ["project"], ["--bogus", "project"]]) {
      expect(runCli([flag, ...tokens]).exitCode).toBe(2);
    }
  });
  it.each([NaN, Infinity, -Infinity, -1])("refuses invalid freshness clock %s", now => {
    expect(runCli(["demo", "gated"], { heldKeys: runtime({ now: () => now }) }).envelope).toMatchObject({ ok: false, error: { heldKeyReason: "snapshot-stale" } });
  });
  it.each([NaN, Infinity, -Infinity, -1])("refuses invalid budget %s", freshnessBudgetMs => {
    expect(runCli(["demo", "gated"], { heldKeys: runtime({ freshnessBudgetMs }) }).envelope).toMatchObject({ ok: false, error: { heldKeyReason: "snapshot-stale" } });
  });
  it("preserves default 24h, future refusal, and currency-first ordering", () => {
    expect(runCli(["demo", "gated"], { heldKeys: runtime({ now: () => stamp + 86400000 }) }).exitCode).toBe(0);

    for (const now of [stamp - 1, stamp + 86400001]) expect(runCli(["demo", "gated"], { heldKeys: runtime({ now: () => now }) }).envelope).toMatchObject({ ok: false, error: { heldKeyReason: "snapshot-stale" } });
    expect(runCli(["demo", "gated"], { heldKeys: runtime({ snapshot: {}, now: () => NaN, authority: { description: "unavailable fixture", probe: () => ({ available: false, reason: "fixture" }) } }) }).envelope).toMatchObject({ ok: false, error: { heldKeyReason: "currency-unavailable" } });
  });
  it.each(["--help", "-h", "--version", "--json=true", "--help=1", "--version=1"])("built watch introspection %s exits without a watcher", flag => {
    const result = spawnSync(process.execPath, ["packages/cli/bin/sceneaxi.mjs", "project", "dev", "--document", "missing.json", "--watch", flag, "--json"], { timeout: 5000, encoding: "utf8" });
    expect(result.error).toBeUndefined(); expect(result.signal).toBeNull();
    expect(result.status).toBe(flag === "--help" || flag === "-h" ? 0 : 2);
    const envelope: unknown = JSON.parse(result.stdout);
    expect(envelope).toHaveProperty("schemaVersion");
    expect(result.stdout).not.toContain('"cycle"');
  });
});
