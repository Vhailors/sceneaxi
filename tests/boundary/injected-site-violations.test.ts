import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendTo, editManifest, makeFixture, removeFixture, runCheck, writeTo } from "../helpers/fixture.ts";

/**
 * Injected-violation regressions for the `sites/` tier.
 *
 * `check-boundaries.mjs`, `check-syntax.mjs`, and `check-sites.mjs` were extended to
 * cover `sites/`. Extending a checker without extending its injection fixtures would
 * leave the new coverage unproven, so each test below injects exactly one forbidden
 * change into a throwaway copy of the tree and asserts the relevant checker fails on
 * that violation alone. The control tests prove the clean copy passes.
 */
describe("sites tier — injected violations", () => {
  let fx: string;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    removeFixture(fx);
  });

  it("control: the unmodified tree passes all three checkers", () => {
    for (const script of ["check-boundaries.mjs", "check-syntax.mjs", "check-sites.mjs"] as const) {
      const res = runCheck(fx, script);
      expect(res.status, `${script} stderr: ${res.stderr}`).toBe(0);
    }
  });

  it("boundary check covers sites and fails when a site is missing from the matrix", () => {
    editManifest(fx, "docs/dependency-matrix.json", (matrix) => {
      const packages = matrix["packages"] as Record<string, unknown>;
      delete packages["@sceneaxi/site-catalog-game"];
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/site-catalog-game exists on disk but is not listed in the dependency matrix",
    );
  });

  it("boundary check fails on a site depending on an engine package", () => {
    editManifest(fx, "sites/umbrella/package.json", (manifest) => {
      manifest.dependencies = {
        ...manifest.dependencies,
        "@sceneaxi/engine-kernel": "workspace:^",
      };
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/site-umbrella: dependency @sceneaxi/engine-kernel is DENIED by the matrix",
    );
  });

  it("boundary check fails on a site source importing an engine package", () => {
    appendTo(fx, "sites/umbrella/src/index.ts", '\nimport "@sceneaxi/engine-kernel";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("imports @sceneaxi/engine-kernel, DENIED by the matrix");
  });

  it("boundary check allows the umbrella's one charted engine edge — the presentation seam", () => {
    // ADR 0022: the umbrella owns the public viewport, so this edge must pass. It is
    // asserted here beside the denials so widening and its bound are proven together.
    appendTo(fx, "sites/umbrella/src/index.ts", '\nimport "@sceneaxi/engine-presentation";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status, `stderr: ${res.stderr}`).toBe(0);
  });

  it.each(["catalog-game", "catalog-web"])(
    "boundary check still denies the presentation seam to sites/%s",
    (site) => {
      appendTo(fx, `sites/${site}/src/index.ts`, '\nimport "@sceneaxi/engine-presentation";\n');
      const res = runCheck(fx, "check-boundaries.mjs");
      expect(res.status).toBe(1);
      expect(res.stderr).toContain("imports @sceneaxi/engine-presentation, DENIED by the matrix");
    },
  );

  it.each(["@sceneaxi/auth", "@sceneaxi/billing"])(
    "boundary check allows the umbrella's charted identity edge through its plug point — %s",
    (allowed) => {
      // sceneaxi#131: the umbrella is the one site wired to the identity plane, but
      // the edge terminates in the deployment-owned lib boundary. Asserted beside
      // the request-surface denials below so the widening and its bound are proven
      // together rather than separately.
      appendTo(fx, "sites/umbrella/src/lib/identity-plane.ts", `\nimport "${allowed}";\n`);
      const res = runCheck(fx, "check-boundaries.mjs");
      expect(res.status, `stderr: ${res.stderr}`).toBe(0);
    },
  );

  it.each(["@sceneaxi/auth", "@sceneaxi/billing"])(
    "boundary check denies a request route taking caller-facing authority through %s",
    (denied) => {
      appendTo(fx, "sites/umbrella/src/app/api/login/route.ts", `\nimport "${denied}";\n`);
      const res = runCheck(fx, "check-boundaries.mjs");
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(
        `imports ${denied} outside the deployment-owned lib boundary`,
      );
    },
  );

  it.each([
    ["catalog-game", "@sceneaxi/auth"],
    ["catalog-game", "@sceneaxi/billing"],
    ["catalog-web", "@sceneaxi/auth"],
    ["catalog-web", "@sceneaxi/billing"],
  ])("boundary check keeps %s from taking a second auth stack via %s", (site, denied) => {
    appendTo(fx, `sites/${site}/src/index.ts`, `\nimport "${denied}";\n`);
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`imports ${denied}, DENIED by the matrix`);
  });

  it.each([
    "@sceneaxi/engine-kernel",
    "@sceneaxi/engine-orchestrator",
    "@sceneaxi/authoring-core",
    "@sceneaxi/profile-game",
  ])("boundary check keeps %s denied to the umbrella", (denied) => {
    appendTo(fx, "sites/umbrella/src/index.ts", `\nimport "${denied}";\n`);
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`imports ${denied}, DENIED by the matrix`);
  });

  it("boundary check fails on a site importing the Kids package — the isolation boundary", () => {
    appendTo(fx, "sites/catalog-web/src/index.ts", '\nimport "@sceneaxi/profile-kids";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("Kids boundary violation");
  });

  it("boundary check fails on a site release-group mismatch", () => {
    editManifest(fx, "sites/catalog-web/package.json", (manifest) => {
      manifest.sceneaxi = { releaseGroup: "apps" };
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/site-catalog-web: sceneaxi.releaseGroup is 'apps', matrix says 'sites'",
    );
  });

  it("boundary check fails on a site source escaping its own directory", () => {
    appendTo(fx, "sites/umbrella/src/index.ts", '\nimport "../../packages/site-kit/src/index.js";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("escapes its package via relative import");
  });

  it("syntax check covers a site .tsx and fails on a parse error", () => {
    writeTo(fx, "sites/umbrella/src/app/broken-page.tsx", "export default function Broken( {\n");
    const res = runCheck(fx, "check-syntax.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("syntax FAIL sites/umbrella/src/app/broken-page.tsx");
  });

  it("syntax check accepts valid JSX in a site .tsx", () => {
    writeTo(
      fx,
      "sites/umbrella/src/app/ok-page.tsx",
      "export default function Ok() {\n  return <main>ok</main>;\n}\n",
    );
    const res = runCheck(fx, "check-syntax.mjs");
    expect(res.status).toBe(0);
  });

  it("sites check fails when a required site file is removed", () => {
    rmSync(join(fx, "sites/catalog-game/.env.example"));
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("is missing required file '.env.example'");
  });

  it("sites check fails when a required script is removed", () => {
    editManifest(fx, "sites/umbrella/package.json", (manifest) => {
      const scripts = manifest["scripts"] as Record<string, string>;
      delete scripts["typecheck"];
    });
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("is missing the 'typecheck' script");
  });

  it("sites check fails when site-kit stops being a link: dependency", () => {
    editManifest(fx, "sites/umbrella/package.json", (manifest) => {
      manifest.dependencies = { ...manifest.dependencies, "@sceneaxi/site-kit": "workspace:^" };
    });
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("must use a 'link:' specifier");
  });

  it("sites check fails when a framework dependency leaks into the hermetic root", () => {
    editManifest(fx, "package.json", (manifest) => {
      manifest.dependencies = { ...manifest.dependencies, next: "15.5.4" };
    });
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("framework and provider SDKs stay in the sites/ tier");
  });

  it("sites check fails when pnpm-workspace starts globbing sites/", () => {
    writeTo(fx, "pnpm-workspace.yaml", 'packages:\n  - "packages/*"\n  - "apps/*"\n  - "sites/*"\n');
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("sites are separate install roots");
  });

  it("sites check fails when .env.example assigns a value", () => {
    writeTo(fx, "sites/catalog-web/.env.example", "DATABASE_URL=postgres://user:pw@host/db\n");
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("names only");
  });

  it.each([
    ["a Stripe test key", 'export const key = "sk_test_51H8xQxAbCdEfGhIjKlMnOp";\n'],
    ["a webhook secret", 'export const hook = "whsec_AbCdEfGhIjKlMnOpQrStUvWx";\n'],
    ["a Postgres URL with a password", 'export const db = "postgres://user:secretpw@host:5432/db";\n'],
  ])("sites check fails on committed secret material — %s", (_label, source) => {
    writeTo(fx, "sites/umbrella/src/lib/leak.ts", source);
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("secret-shaped material");
  });

  it.each(["pem", "txt", "css", "yaml"])(
    "sites check scans secret material in .%s files",
    (extension) => {
      writeTo(
        fx,
        `sites/umbrella/src/lib/leak.${extension}`,
        "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n",
      );
      const res = runCheck(fx, "check-sites.mjs");
      expect(res.status).toBe(1);
      expect(res.stderr).toContain("secret-shaped material");
    },
  );

  it("sites check fails when a secret name is assigned a literal value", () => {
    writeFileSync(
      join(fx, "sites/umbrella/src/lib/leak.ts"),
      'const config = { STRIPE_SECRET_KEY: "not-really-a-key-but-still-committed" };\nexport default config;\n',
    );
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("secrets are env-only, never committed");
  });

  it.each([
    ["quoted JSON key", '{"SCENEAXI_ADMIN_BOOTSTRAP_SECRET":"committed-value"}\n'],
    ["unquoted env value", "STRIPE_WEBHOOK_SECRET=committed-value\n"],
    ["unquoted YAML value", "BETTER_AUTH_SECRET: committed-value\n"],
  ])("sites check fails on a secret assigned through a %s", (_label, source) => {
    writeTo(fx, "sites/umbrella/src/lib/leak.txt", source);
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("secrets are env-only, never committed");
  });

  it("sites check rejects a committed fallback after an env reference", () => {
    writeTo(
      fx,
      "sites/umbrella/src/lib/leak.ts",
      'const SCENEAXI_ADMIN_BOOTSTRAP_SECRET = process.env.ADMIN_SECRET ?? "committed-fallback";\n',
    );
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("secrets are env-only, never committed");
  });

  it("sites check rejects a committed fallback continued on the next line", () => {
    writeTo(
      fx,
      "sites/umbrella/src/lib/leak.ts",
      'const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY\n  ?? "committed-fallback";\n',
    );
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("secrets are env-only, never committed");
  });

  it("sites check rejects a committed fallback after a TypeScript non-null assertion", () => {
    writeTo(
      fx,
      "sites/umbrella/src/lib/leak.ts",
      'const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY! ?? "committed-fallback";\n',
    );
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("secrets are env-only, never committed");
  });

  it("sites check accepts a complete direct env reference", () => {
    writeTo(
      fx,
      "sites/umbrella/src/lib/env.ts",
      "const DATABASE_URL = process.env.DATABASE_URL;\nexport default DATABASE_URL;\n",
    );
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(0);
  });

  it("boundary check fails when site source imports a test-only testing/ subpath", () => {
    // The umbrella is the one site the matrix allows to name @sceneaxi/auth, so this
    // injection isolates the test-only rule rather than the allow list: the declared
    // `./testing/*` seam is for tests, and no deployable site source may reach it.
    appendTo(
      fx,
      "sites/umbrella/src/lib/identity-plane.ts",
      '\nimport "@sceneaxi/auth/testing/principal-issuance";\n',
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "imports test-only subpath @sceneaxi/auth/testing/principal-issuance — production source may not reach a testing/ seam",
    );
  });

  it("sites check fails on an empty sites tree", () => {
    for (const dir of ["umbrella", "catalog-game", "catalog-web"]) {
      rmSync(join(fx, "sites", dir), { recursive: true, force: true });
    }
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("refusing to pass on an empty surface");
  });
});
