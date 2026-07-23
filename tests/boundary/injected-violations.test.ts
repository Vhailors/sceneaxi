import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendTo,
  editManifest,
  makeFixture,
  removeFixture,
  runCheck,
  writeTo,
} from "../helpers/fixture.ts";

/**
 * Injected-violation regressions: each test copies the real tree into a
 * fixture, injects one forbidden change, and proves `check-boundaries.mjs`
 * fails closed on exactly that violation. The control test proves the clean
 * copy passes, so every failure below is caused by its injection alone.
 */
describe("boundary check — injected violations", () => {
  let fx: string;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    removeFixture(fx);
  });

  it("control: the unmodified tree passes", () => {
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.stderr).toBe("");
    expect(res.stdout).toContain("boundary check OK");
    expect(res.status).toBe(0);
  });

  it("fails on a forbidden manifest dependency edge (cli -> engine-kernel)", () => {
    editManifest(fx, "packages/cli/package.json", (m) => {
      m.dependencies = { ...m.dependencies, "@sceneaxi/engine-kernel": "workspace:^" };
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain(
      "@sceneaxi/cli: dependency @sceneaxi/engine-kernel is DENIED by the matrix",
    );
  });

  it("fails on a forbidden manifest dependency edge (plugin-host -> engine-kernel)", () => {
    editManifest(fx, "packages/plugin-host/package.json", (m) => {
      m.dependencies = {
        ...m.dependencies,
        "@sceneaxi/engine-kernel": "workspace:^",
      };
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain(
      "@sceneaxi/plugin-host: dependency @sceneaxi/engine-kernel is DENIED by the matrix",
    );
  });

  it("fails on a forbidden source import (cli src imports engine-kernel)", () => {
    appendTo(fx, "packages/cli/src/index.ts", '\nimport "@sceneaxi/engine-kernel";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain("imports @sceneaxi/engine-kernel, DENIED by the matrix");
  });

  it("fails the Kids boundary on a manifest dependency (catalog-web -> profile-kids)", () => {
    editManifest(fx, "apps/catalog-web/package.json", (m) => {
      m.dependencies = { ...m.dependencies, "@sceneaxi/profile-kids": "workspace:^" };
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain(
      "depends on Kids package @sceneaxi/profile-kids — Kids boundary violation",
    );
  });

  it("fails the Kids boundary on a source import (catalog-web imports profile-kids)", () => {
    appendTo(fx, "apps/catalog-web/src/index.ts", '\nimport "@sceneaxi/profile-kids";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain(
      "imports Kids package @sceneaxi/profile-kids — Kids boundary violation",
    );
  });

  it("fails on a release-group stamp mismatch", () => {
    editManifest(fx, "packages/engine-kernel/package.json", (m) => {
      m.sceneaxi = { ...m.sceneaxi, releaseGroup: "profile" };
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain(
      "@sceneaxi/engine-kernel: sceneaxi.releaseGroup is 'profile', matrix says 'core-train'",
    );
  });

  it("fails when a profile drops its core pin", () => {
    editManifest(fx, "packages/profile-web/package.json", (m) => {
      if (m.sceneaxi) delete m.sceneaxi.corePin;
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain(
      "@sceneaxi/profile-web: profile package must declare sceneaxi.corePin",
    );
  });

  it("fails on a shared-prefix sibling escape (cli reaching into cli-shadow)", () => {
    // The trap this regression pins: packages/cli-shadow starts with the string
    // packages/cli, so a naive prefix check would treat the sibling as inside
    // the package. The checker must use path-segment containment instead.
    writeTo(fx, "packages/cli-shadow/src/impl.ts", "export {};\n");
    expect(
      resolve(fx, "packages/cli-shadow/src/impl.ts").startsWith(resolve(fx, "packages/cli")),
    ).toBe(true);

    appendTo(fx, "packages/cli/src/index.ts", '\nimport "../../cli-shadow/src/impl.ts";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain("escapes its package via relative import");
  });
});
