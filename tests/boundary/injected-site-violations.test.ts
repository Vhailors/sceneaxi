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

  it("the Kids site passes only with an empty SceneAxi edge", () => {
    editManifest(fx, "sites/kids/package.json", (manifest) => {
      manifest.dependencies = {
        ...manifest.dependencies,
        "@sceneaxi/site-kit": "link:../../packages/site-kit",
      };
    });
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/site-kids: the isolated Kids runtime may declare only next, react, and react-dom",
    );
  });

  it.each([
    ["fetch", "fetch('/outside')"],
    ["WebSocket", "new WebSocket('wss' + '://outside')"],
    ["environment access", "process.env.OUTSIDE"],
    ["form", "const markup = '<form action=/outside>'"],
    ["link", "const markup = '<a href=/outside>'"],
  ])("sites check rejects Kids source with %s authority", (label, source) => {
    writeTo(fx, "sites/kids/src/lib/authority-leak.ts", `${source};\n`);
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      `sites/kids/src/lib/authority-leak.ts names ${label} — the first-release Kids site has no external data path`,
    );
  });

  it("sites check rejects an external URL added outside the Kids src tree", () => {
    appendTo(
      fx,
      "sites/kids/next.config.ts",
      '\nexport const outside = "https://third-party.example";\n',
    );
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "sites/kids/next.config.ts names external URL — the first-release Kids site has no external data path",
    );
  });

  it.each([
    ["a request rewrite", "async rewrites() { return []; }"],
    ["a redirect", "async redirects() { return []; }"],
    ["a remote image pattern", "export const images = { remotePatterns: [] };"],
    ["an image host allow list", "export const images = { domains: [] };"],
    ["an asset prefix", 'export const assetPrefix = "/cdn";'],
    ["a proxy destination", 'export const route = { destination: "/elsewhere" };'],
    ["build-time environment injection", "export const config = { env: {} };"],
  ])("sites check rejects a Kids config granting %s", (label, source) => {
    appendTo(fx, "sites/kids/next.config.ts", `\n${source}\n`);
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      `sites/kids/next.config.ts configures ${label} — the first-release Kids site serves only its own bundled activity`,
    );
  });

  it("sites check rejects any Kids environment input, even without a value", () => {
    writeTo(fx, "sites/kids/.env.example", "KIDS_DATA_ORIGIN=\n");
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "sites/kids/.env.example:1 declares 'KIDS_DATA_ORIGIN' — the first-release Kids site accepts no environment inputs",
    );
  });

  it("sites check rejects a second Kids dependency build approval", () => {
    appendTo(fx, "sites/kids/pnpm-workspace.yaml", "  another-package: true\n");
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/site-kids: pnpm build approval must allow only sharp in the isolated site workspace",
    );
  });

  it("sites check rejects a deployed site whose npmrc omits the hoisted linker", () => {
    // The workspace-file setting alone is silently ignored by pnpm below 10.6, which
    // neither Vercel nor CI pins away from, so `.npmrc` is the load-bearing source.
    rmSync(join(fx, "sites/catalog-game/.npmrc"));
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/site-catalog-game: deployable serverless sites must set 'node-linker=hoisted' in .npmrc",
    );
  });

  it("sites check rejects an npmrc that selects a non-hoisted linker", () => {
    writeTo(fx, "sites/catalog-web/.npmrc", "node-linker=isolated\n");
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/site-catalog-web: deployable serverless sites must set 'node-linker=hoisted' in .npmrc",
    );
  });

  function writeWorkspaceLinker(site: string, declaration: string): void {
    writeTo(
      fx,
      `sites/${site}/pnpm-workspace.yaml`,
      ["packages:", '  - "."', declaration, "allowBuilds:", "  sharp: true", ""].join("\n"),
    );
  }

  it.each([
    ["a bare value", "nodeLinker: isolated"],
    // The workspace file wins over `.npmrc` on pnpm >= 10.6, so a declaration hidden
    // behind a trailing comment restores the exact symlink graph this tier forbids.
    ["a value behind a trailing comment", "nodeLinker: isolated # keep the old graph"],
    ["a quoted value", 'nodeLinker: "isolated"'],
  ])("sites check rejects a workspace linker overriding the npmrc — %s", (_case, declaration) => {
    writeWorkspaceLinker("umbrella", declaration);
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/site-umbrella: pnpm-workspace.yaml declares the 'isolated' linker, which overrides .npmrc on pnpm 10.6 and later",
    );
  });

  it.each([
    ["a quoted workspace value", 'nodeLinker: "hoisted"'],
    ["a commented workspace value", "nodeLinker: hoisted # the deployable linker"],
  ])("sites check accepts an agreeing workspace linker — %s", (_case, declaration) => {
    writeWorkspaceLinker("umbrella", declaration);
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status, `stderr: ${res.stderr}`).toBe(0);
  });

  it("sites check accepts an npmrc linker followed by an inline comment", () => {
    // pnpm's own ini reader drops the comment and honours the setting, so refusing
    // here would fail a site whose linker is in fact hoisted.
    writeTo(fx, "sites/catalog-game/.npmrc", "node-linker=hoisted # deployable linker\n");
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status, `stderr: ${res.stderr}`).toBe(0);
  });

  it("sites check rejects removal of the Vercel package postbuild", () => {
    editManifest(fx, "sites/catalog-web/package.json", (manifest) => {
      const scripts = manifest.scripts as Record<string, string>;
      delete scripts.postbuild;
    });
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/site-catalog-web: postbuild must validate the emitted Vercel function package traces",
    );
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
        `imports ${denied} outside its exact deployment owner files`,
      );
    },
  );

  it.each(["@sceneaxi/auth", "@sceneaxi/billing"])(
    "boundary check denies an unauthorized umbrella lib importing %s",
    (denied) => {
      writeTo(fx, "sites/umbrella/src/lib/authority-leak.ts", `import "${denied}";\n`);
      const res = runCheck(fx, "check-boundaries.mjs");
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(
        `sites/umbrella/src/lib/authority-leak.ts imports ${denied} outside its exact deployment owner files`,
      );
    },
  );

  it.each([
    ["../../../lib/identity-plane.js", "sites/umbrella/src/lib/identity-plane"],
    ["../../../lib/provider-adapters.js", "sites/umbrella/src/lib/provider-adapters"],
    ["../../../lib/credit-webhook.js", "sites/umbrella/src/lib/credit-webhook"],
    ["../../../index.js", "sites/umbrella/src/index"],
  ])(
    "boundary check denies a route bypassing the request facade through %s",
    (specifier, target) => {
      appendTo(fx, "sites/umbrella/src/app/api/login/route.ts", `\nimport "${specifier}";\n`);
      const res = runCheck(fx, "check-boundaries.mjs");
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(
        `imports deployment authority module ${target} outside the request-authority facade`,
      );
    },
  );

  it.each([
    ["@/lib/identity-plane", "sites/umbrella/src/lib/identity-plane"],
    ["@/lib/provider-adapters", "sites/umbrella/src/lib/provider-adapters"],
    ["@/lib/credit-webhook", "sites/umbrella/src/lib/credit-webhook"],
    ["@/index", "sites/umbrella/src/index"],
  ])(
    "boundary check denies a route bypassing the request facade through alias %s",
    (specifier, target) => {
      appendTo(fx, "sites/umbrella/src/app/api/login/route.ts", `\nimport "${specifier}";\n`);
      const res = runCheck(fx, "check-boundaries.mjs");
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(
        `imports deployment authority module ${target} outside the request-authority facade`,
      );
    },
  );

  it("boundary check models every alias the umbrella's tsconfig declares, not one hardcoded pair", () => {
    // The `@/*` mapping is not special: any alias a bundler would resolve is a path to
    // the deployment owners, so adding one to the site's tsconfig must not open a route
    // around the facade with no checker change and no failing test.
    editManifest(fx, "sites/umbrella/tsconfig.json", (config) => {
      const options = config["compilerOptions"] as Record<string, unknown>;
      options["paths"] = { ...(options["paths"] as object), "~deploy/*": ["./src/lib/*"] };
    });
    appendTo(fx, "sites/umbrella/src/app/api/login/route.ts", '\nimport "~deploy/identity-plane";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "imports deployment authority module sites/umbrella/src/lib/identity-plane outside the request-authority facade",
    );
  });

  it("boundary check follows a longer alias prefix that shadows an earlier one", () => {
    // TypeScript and webpack resolve the longest matching prefix, not the first declared
    // one, so checking only the first match would hand `@/deploy/*` a path around the
    // facade while the bundler loaded the deployment owner.
    editManifest(fx, "sites/umbrella/tsconfig.json", (config) => {
      const options = config["compilerOptions"] as Record<string, unknown>;
      options["paths"] = { ...(options["paths"] as object), "@/deploy/*": ["./src/lib/*"] };
    });
    appendTo(fx, "sites/umbrella/src/app/api/login/route.ts", '\nimport "@/deploy/identity-plane";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "imports deployment authority module sites/umbrella/src/lib/identity-plane outside the request-authority facade",
    );
  });

  it("boundary check checks every target of a multi-target alias, not just the first", () => {
    // A resolver takes the first target that resolves, so a leading target that resolves
    // to nothing must not hide the one that lands on the deployment owner.
    editManifest(fx, "sites/umbrella/tsconfig.json", (config) => {
      const options = config["compilerOptions"] as Record<string, unknown>;
      options["paths"] = { "@/*": ["./generated/*", "./src/*"] };
    });
    appendTo(fx, "sites/umbrella/src/app/api/login/route.ts", '\nimport "@/lib/identity-plane";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "imports deployment authority module sites/umbrella/src/lib/identity-plane outside the request-authority facade",
    );
  });

  it("boundary check resolves a bare specifier through a baseUrl that declares no alias", () => {
    // Next.js absolute imports need no `paths` entry: `"baseUrl": "."` alone makes
    // `src/lib/identity-plane` load the deployment owner, so a checker that models only
    // the alias table would pass a route that reaches it.
    editManifest(fx, "sites/umbrella/tsconfig.json", (config) => {
      const options = config["compilerOptions"] as Record<string, unknown>;
      options["baseUrl"] = ".";
      delete options["paths"];
    });
    appendTo(fx, "sites/umbrella/src/app/api/login/route.ts", '\nimport "src/lib/identity-plane";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "imports deployment authority module sites/umbrella/src/lib/identity-plane outside the request-authority facade",
    );
  });

  it("boundary check leaves a real dependency a package import under a declared baseUrl", () => {
    // The baseUrl root only claims specifiers that land on a file that exists, so adding
    // one must not turn `react` or `next` into a phantom package-local module and fail
    // the clean tree.
    editManifest(fx, "sites/umbrella/tsconfig.json", (config) => {
      const options = config["compilerOptions"] as Record<string, unknown>;
      options["baseUrl"] = ".";
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status, `stderr: ${res.stderr}`).toBe(0);
  });

  it("boundary check models an alias table inherited through tsconfig extends", () => {
    // `paths` declared in an extended base still maps specifiers, so inheriting the
    // alias must not be a way to declare one the checker never sees.
    writeTo(
      fx,
      "sites/umbrella/tsconfig.aliases.json",
      `${JSON.stringify(
        { compilerOptions: { paths: { "@/*": ["./src/*"], "~deploy/*": ["./src/lib/*"] } } },
        null,
        2,
      )}\n`,
    );
    editManifest(fx, "sites/umbrella/tsconfig.json", (config) => {
      config["extends"] = "./tsconfig.aliases.json";
      delete (config["compilerOptions"] as Record<string, unknown>)["paths"];
    });
    appendTo(fx, "sites/umbrella/src/app/api/login/route.ts", '\nimport "~deploy/identity-plane";\n');
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "imports deployment authority module sites/umbrella/src/lib/identity-plane outside the request-authority facade",
    );
  });

  it("boundary check refuses a tsconfig base it cannot resolve instead of ignoring its aliases", () => {
    // An unresolvable base may declare any `paths` at all, so passing over it would be
    // passing on an unknown alias table.
    editManifest(fx, "sites/umbrella/tsconfig.json", (config) => {
      config["extends"] = "@tsconfig/absent/tsconfig.json";
    });
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "sites/umbrella/tsconfig.json extends '@tsconfig/absent/tsconfig.json', which does not resolve, so its path aliases cannot be modelled",
    );
  });

  it("boundary check does not read a dynamic specifier off a same-named outer const", () => {
    // Static resolution is evidence, not a name match: a parameter shadowing an unrelated
    // module-scope const means the import is genuinely dynamic, and reporting the const's
    // value would name a module this file never imports.
    appendTo(
      fx,
      "sites/umbrella/src/app/api/login/route.ts",
      [
        "",
        'const authorityPath = "../../../lib/identity-plane.js";',
        "export const declaredAuthorityPath = authorityPath;",
        "export async function loadModule(authorityPath: string) {",
        "  return import(authorityPath);",
        "}",
        "",
      ].join("\n"),
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status, `stderr: ${res.stderr}`).toBe(0);
  });

  it("boundary check denies an unauthorized lib re-exporting deployment authority", () => {
    writeTo(
      fx,
      "sites/umbrella/src/lib/authority-leak.ts",
      'export { createUmbrellaIdentityPlane } from "./identity-plane.js";\n',
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "sites/umbrella/src/lib/authority-leak.ts imports deployment authority module sites/umbrella/src/lib/identity-plane outside the request-authority facade",
    );
  });

  it("boundary check denies a static template dynamic import of deployment authority", () => {
    appendTo(
      fx,
      "sites/umbrella/src/app/api/login/route.ts",
      '\nawait import(`../../../lib/identity-plane.js`);\n',
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "sites/umbrella/src/app/api/login/route.ts imports deployment authority module sites/umbrella/src/lib/identity-plane outside the request-authority facade",
    );
  });

  it("boundary check denies a constant-concatenated dynamic import of deployment authority", () => {
    appendTo(
      fx,
      "sites/umbrella/src/app/api/login/route.ts",
      '\nawait import("../../../lib/" + "identity-plane.js");\n',
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "sites/umbrella/src/app/api/login/route.ts imports deployment authority module sites/umbrella/src/lib/identity-plane outside the request-authority facade",
    );
  });

  it.each([
    [
      "same-file const binding",
      'const authorityPath = "../../../lib/identity-plane.js";\nawait import(authorityPath);',
    ],
    [
      "constant conditional binding",
      'const authorityPath = true ? "../../../lib/identity-plane.js" : "../../../lib/request-authority.js";\nawait import(authorityPath);',
    ],
    [
      "constant logical binding",
      'const authorityPath = false || "../../../lib/identity-plane.js";\nawait import(authorityPath);',
    ],
    [
      "destructured object const binding",
      'const { path: authorityPath } = { path: "../../../lib/identity-plane.js" };\nawait import(authorityPath);',
    ],
    [
      "destructured array const binding",
      'const [authorityPath] = ["../../../lib/identity-plane.js"];\nawait import(authorityPath);',
    ],
    // Member access is the same lookup destructuring performs, so it must refuse the
    // same way rather than falling through to an unknown specifier.
    [
      "const object property access",
      'const authority = { path: "../../../lib/identity-plane.js" };\nawait import(authority.path);',
    ],
    [
      "const object element access",
      'const authority = { path: "../../../lib/identity-plane.js" };\nawait import(authority["path"]);',
    ],
    [
      "const array element access",
      'const authority = ["../../../lib/identity-plane.js"];\nawait import(authority[0]);',
    ],
    [
      "nested const member access",
      'const authority = { lib: { path: "../../../lib/identity-plane.js" } };\nawait import(authority.lib.path);',
    ],
  ])("boundary check denies deployment authority through a %s", (_label, source) => {
    appendTo(fx, "sites/umbrella/src/app/api/login/route.ts", `\n${source}\n`);
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "sites/umbrella/src/app/api/login/route.ts imports deployment authority module sites/umbrella/src/lib/identity-plane outside the request-authority facade",
    );
  });

  it.each([
    ["a relative resource query", "./identity-plane.js?authority"],
    ["a relative resource fragment", "./identity-plane.js#authority"],
    ["an aliased resource query", "@/lib/identity-plane?authority"],
    ["an aliased resource fragment", "@/lib/identity-plane#authority"],
  ])("boundary check denies deployment authority through %s", (_label, specifier) => {
    writeTo(
      fx,
      "sites/umbrella/src/lib/authority-leak.jsx",
      `await import("${specifier}");\n`,
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "sites/umbrella/src/lib/authority-leak.jsx imports deployment authority module sites/umbrella/src/lib/identity-plane outside the request-authority facade",
    );
  });

  it("boundary check scans a JSX intermediary that re-exports deployment authority", () => {
    writeTo(
      fx,
      "sites/umbrella/src/lib/authority-leak.jsx",
      'export { createUmbrellaIdentityPlane } from "./identity-plane.js";\n',
    );
    appendTo(
      fx,
      "sites/umbrella/src/app/api/login/route.ts",
      '\nimport { createUmbrellaIdentityPlane } from "../../../lib/authority-leak.jsx";\n',
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "sites/umbrella/src/lib/authority-leak.jsx imports deployment authority module sites/umbrella/src/lib/identity-plane outside the request-authority facade",
    );
  });

  it("boundary check resolves a directory barrel that re-exports deployment authority", () => {
    appendTo(
      fx,
      "sites/umbrella/src/app/api/login/route.ts",
      '\nimport { createUmbrellaIdentityPlane } from "../../../";\n',
    );
    const res = runCheck(fx, "check-boundaries.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "sites/umbrella/src/app/api/login/route.ts imports deployment authority module sites/umbrella/src/index outside the request-authority facade",
    );
  });

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

  it("sites check keeps Better Auth at the umbrella provider seam", () => {
    editManifest(fx, "sites/catalog-web/package.json", (manifest) => {
      manifest.dependencies = { ...manifest.dependencies, "better-auth": "1.6.26" };
    });
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/site-catalog-web: provider dependency 'better-auth' belongs only to the umbrella deployment seam",
    );
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
    for (const dir of ["umbrella", "catalog-game", "catalog-web", "kids"]) {
      rmSync(join(fx, "sites", dir), { recursive: true, force: true });
    }
    const res = runCheck(fx, "check-sites.mjs");
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("refusing to pass on an empty surface");
  });
});
