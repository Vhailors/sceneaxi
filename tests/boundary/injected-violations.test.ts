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

  it("fails on a forbidden source import (plugin-host src imports engine-kernel)", () => {
    appendTo(
      fx,
      "packages/plugin-host/src/index.ts",
      '\nimport "@sceneaxi/engine-kernel";\n',
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain(
      "imports @sceneaxi/engine-kernel, DENIED by the matrix",
    );
  });

  it("fails on a forbidden source import (plugin-host src imports another plugin package)", () => {
    // plugin-host may only depend on schemas; any other SceneAxi package is denied.
    appendTo(
      fx,
      "packages/plugin-host/src/index.ts",
      '\nimport "@sceneaxi/cli";\n',
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain(
      "imports @sceneaxi/cli, DENIED by the matrix",
    );
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

  it("fails when production source imports a test-only testing/ subpath (billing src)", () => {
    // The matrix allows billing -> auth, so this injection isolates the test-only rule:
    // the declared `@sceneaxi/auth/testing/principal-issuance` seam exists for tests, and
    // no production source may reach an issuance authority through it.
    appendTo(
      fx,
      "packages/billing/src/index.ts",
      '\nimport "@sceneaxi/auth/testing/principal-issuance";\n',
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain(
      "imports test-only subpath @sceneaxi/auth/testing/principal-issuance — production source may not reach a testing/ seam",
    );
  });

  it("fails when an app's production source imports a test-only testing/ subpath", () => {
    appendTo(
      fx,
      "apps/web-shell/src/index.ts",
      '\nimport "@sceneaxi/auth/testing/principal-issuance";\n',
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain(
      "imports test-only subpath @sceneaxi/auth/testing/principal-issuance — production source may not reach a testing/ seam",
    );
  });

  it("fails when production source imports the DesktopSession Git authority", () => {
    appendTo(
      fx,
      "packages/cli/src/index.ts",
      '\nimport "@sceneaxi-internal/project-git-authority";\n',
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain(
      "imports the Git mutation authority outside its live DesktopSession owner",
    );
  });

  it("fails when a package's own production source reaches its src/testing seam relatively", () => {
    // Renaming the public specifier away is not an escape: the owning package is the one
    // place a relative path into `src/testing` resolves, so that form is refused too.
    appendTo(fx, "packages/auth/src/index.ts", '\nimport "./testing/principal-issuance.js";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("boundary check FAILED");
    expect(res.stderr).toContain(
      "imports test-only module './testing/principal-issuance.js' — production source may not reach a testing/ seam",
    );
  });

  it("allows a test-only seam to name a sibling inside the same src/testing tree", () => {
    writeTo(fx, "packages/auth/src/testing/helper.ts", "export const helper = 1;\n");
    appendTo(
      fx,
      "packages/auth/src/testing/principal-issuance.ts",
      '\nimport "./helper.js";\n',
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.stderr).toBe("");
    expect(res.status).toBe(0);
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
