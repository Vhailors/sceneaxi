import { describe, expect, it } from "vitest";
import { runCli } from "@sceneaxi/cli";

/**
 * Strict `--json` equivalence: the same argv with and without `--json` must
 * produce identical envelope data; only the stdout rendering differs.
 */
describe("strict --json equivalence", () => {
  const paths: string[][] = [
    [],
    ["--help"],
    ["--version"],
    ["protocol", "version"],
    ["protocol", "inspect"],
    ["profile", "list"],
    ["project", "new"],
    ["project", "dev"],
    ["project", "test"],
    ["project", "capture"],
    ["project", "report"],
    ["scene", "compose"],
    ["asset", "list"],
    ["catalog", "list"],
    ["evidence", "list"],
    ["project"],
    ["scene"],
    ["project", "bogus-verb"],
    ["unknown-top"],
    ["project", "new", "extra-depth"],
    ["--not-a-real-flag"],
    ["project", "new", "--help"],
    ["scene", "compose", "--help"],
    ["catalog", "list", "--help"],
  ];

  for (const path of paths) {
    const label = path.length === 0 ? "(bare)" : path.join(" ");

    it(`same envelope with/without --json: ${label}`, () => {
      const text = runCli(path);
      // Insert --json without disturbing path semantics.
      const json = runCli([...path, "--json"]);

      expect(json.format).toBe("json");
      expect(text.exitCode).toBe(json.exitCode);
      expect(text.envelope).toEqual(json.envelope);

      // JSON stdout is parseable and equals the envelope.
      const parsed = JSON.parse(json.stdout) as unknown;
      expect(parsed).toEqual(json.envelope);

      // Text stdout is non-empty and not JSON (unless envelope is trivial).
      expect(text.stdout.length).toBeGreaterThan(0);
      if (text.format === "text") {
        expect(text.stdout.startsWith("{")).toBe(false);
        expect(text.stdout).toContain("ok:");
        expect(text.stdout).toMatch(/help\[\d+\]:/);
      }
    });
  }

  it("--json may appear before the command path", () => {
    const a = runCli(["--json", "protocol", "version"]);
    const b = runCli(["protocol", "version", "--json"]);
    expect(a.exitCode).toBe(b.exitCode);
    expect(a.envelope).toEqual(b.envelope);
    expect(a.format).toBe("json");
  });

  it("--json may appear between group and verb", () => {
    const a = runCli(["project", "--json", "new"]);
    const b = runCli(["project", "new", "--json"]);
    expect(a.envelope).toEqual(b.envelope);
  });
});
