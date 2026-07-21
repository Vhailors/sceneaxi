import { describe, expect, it } from "vitest";
import {
  CLI_VERSION,
  PROTOCOL_SCHEMA_VERSION,
  runCli,
} from "@sceneaxi/cli";

describe("versioned protocol envelope", () => {
  it("stamps schemaVersion and cliVersion on success", () => {
    const r = runCli(["protocol", "version"]);
    expect(r.envelope.schemaVersion).toBe(PROTOCOL_SCHEMA_VERSION);
    expect(r.envelope.cliVersion).toBe(CLI_VERSION);
    expect(r.envelope.ok).toBe(true);
    expect(r.envelope.help.length).toBeGreaterThan(0);
  });

  it("stamps schemaVersion and cliVersion on failure", () => {
    const r = runCli(["nope"]);
    expect(r.envelope.schemaVersion).toBe(PROTOCOL_SCHEMA_VERSION);
    expect(r.envelope.cliVersion).toBe(CLI_VERSION);
    expect(r.envelope.ok).toBe(false);
    expect(r.envelope.help.length).toBeGreaterThan(0);
  });

  it("success envelope snapshot (versioned with CLI)", () => {
    const r = runCli(["protocol", "version", "--json"]);
    expect(r.envelope).toMatchSnapshot();
  });

  it("error envelope snapshot (versioned with CLI)", () => {
    const r = runCli(["project", "not-a-verb", "--json"]);
    expect(r.envelope).toMatchSnapshot();
  });

  it("protocol inspect exposes exit-code map in result", () => {
    const r = runCli(["protocol", "inspect"]);
    expect(r.envelope.ok).toBe(true);
    if (r.envelope.ok) {
      expect(r.envelope.result).toHaveProperty("exitCodes");
      expect(r.envelope.result).toHaveProperty("schemaVersion");
      expect(Array.isArray(r.envelope.result["exitCodes"])).toBe(true);
    }
  });
});

describe("help[] affordances on every result", () => {
  const cases: string[][] = [
    [],
    ["--help"],
    ["--version"],
    ["project"],
    ["project", "new"],
    ["project", "new", "--help"],
    ["project", "bogus"],
    ["totally-unknown"],
    ["project", "new", "extra"],
    ["--not-a-flag"],
    ["protocol", "inspect"],
  ];

  for (const argv of cases) {
    it(`help[] present for: sceneaxi ${argv.join(" ") || "(bare)"}`, () => {
      const r = runCli(argv);
      expect(Array.isArray(r.envelope.help)).toBe(true);
      expect(r.envelope.help.length).toBeGreaterThan(0);
      for (const line of r.envelope.help) {
        expect(typeof line).toBe("string");
        expect(line.length).toBeGreaterThan(0);
      }
    });
  }
});
