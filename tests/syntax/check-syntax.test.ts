import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendTo, makeFixture, removeFixture, runCheck, writeTo } from "../helpers/fixture.ts";

/**
 * Regressions for the syntax gate's meaning: every source file must parse
 * (now as TypeScript, since tsc is wired), and an empty surface never passes.
 */
describe("syntax check", () => {
  let fx: string;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    removeFixture(fx);
  });

  it("control: the unmodified tree passes", () => {
    const res = runCheck(fx, "check-syntax.mjs");
    expect(res.stderr).toBe("");
    expect(res.stdout).toContain("syntax check OK");
    expect(res.status).toBe(0);
  });

  it("accepts TypeScript-only syntax in sources", () => {
    writeTo(
      fx,
      "packages/schemas/src/typed-probe.ts",
      "export interface Probe { readonly name: string }\n",
    );
    const res = runCheck(fx, "check-syntax.mjs");
    expect(res.status).toBe(0);
  });

  it("fails when a source file does not parse", () => {
    appendTo(fx, "packages/cli/src/index.ts", "\nconst = ;\n");
    const res = runCheck(fx, "check-syntax.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("syntax FAIL packages/cli/src/index.ts");
    expect(res.stderr).toContain("syntax check FAILED");
  });

  it("refuses to pass on an empty source surface", () => {
    rmSync(join(fx, "packages"), { recursive: true, force: true });
    rmSync(join(fx, "apps"), { recursive: true, force: true });
    const res = runCheck(fx, "check-syntax.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("found zero source files");
  });
});
