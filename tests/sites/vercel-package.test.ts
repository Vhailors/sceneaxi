import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateVercelPackage } from "../../scripts/check-vercel-package.mjs";

const fixtures: string[] = [];

function write(path: string, contents: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-vercel-package-"));
  fixtures.push(root);
  const site = join(root, "sites", "umbrella");
  const linkedPackage = join(root, "packages", "site-kit");
  const trace = join(site, ".next", "server", "app", "route.js.nft.json");
  const linkedManifest = join(linkedPackage, "package.json");
  const linkedModule = join(site, "node_modules", "@sceneaxi", "site-kit");

  write(
    join(site, "package.json"),
    JSON.stringify({ dependencies: { "@sceneaxi/site-kit": "link:../../packages/site-kit" } }),
  );
  write(linkedManifest, JSON.stringify({ name: "@sceneaxi/site-kit" }));
  mkdirSync(dirname(linkedModule), { recursive: true });
  symlinkSync(linkedPackage, linkedModule, "dir");
  declareServerExternals(site, []);

  return { root, site, trace, linkedManifest, linkedModule };
}

/** Next's emitted deployment contract, the resolved config Vercel reads. */
function declareServerExternals(site: string, serverExternalPackages: string[]) {
  write(
    join(site, ".next", "required-server-files.json"),
    JSON.stringify({ version: 1, config: { serverExternalPackages } }),
  );
}

function emitTrace(trace: string, files: string[]) {
  write(
    trace,
    JSON.stringify({
      version: 1,
      files: files.map((file) => relative(dirname(trace), file)),
    }),
  );
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

describe("Vercel function package traces", () => {
  it("accepts linked monorepo source with physical server dependencies", () => {
    const fx = makeFixture();
    const physicalDependency = join(fx.site, "node_modules", "server-only", "index.js");
    write(physicalDependency, "export {};");
    emitTrace(fx.trace, [fx.linkedModule, fx.linkedManifest, physicalDependency]);

    expect(validateVercelPackage(fx.site, fx.root)).toEqual([]);
  });

  it("refuses pnpm's isolated dependency symlink graph", () => {
    const fx = makeFixture();
    const storedPackage = join(
      fx.site,
      "node_modules",
      ".pnpm",
      "server-only@1.0.0",
      "node_modules",
      "server-only",
    );
    const dependencyLink = join(fx.site, "node_modules", "server-only");
    write(join(storedPackage, "index.js"), "export {};");
    symlinkSync(storedPackage, dependencyLink, "dir");
    emitTrace(fx.trace, [fx.linkedModule, fx.linkedManifest, join(dependencyLink, "index.js")]);

    expect(validateVercelPackage(fx.site, fx.root)).toContainEqual(
      expect.stringContaining("reaches pnpm package symlink 'sites/umbrella/node_modules/server-only'"),
    );
  });

  it("accepts the repository root's own isolated pnpm store links", () => {
    // The tracing root is the monorepo root, whose hermetic install keeps pnpm's
    // isolated linker by design. Those links are outside the site install root, so the
    // hoisted-linker remediation this refusal names cannot be applied to them.
    const fx = makeFixture();
    const storedPackage = join(
      fx.root,
      "node_modules",
      ".pnpm",
      "three@0.185.1",
      "node_modules",
      "three",
    );
    const rootWorkspaceLink = join(fx.root, "packages", "site-kit", "node_modules", "three");
    write(join(storedPackage, "index.js"), "export {};");
    mkdirSync(dirname(rootWorkspaceLink), { recursive: true });
    symlinkSync(storedPackage, rootWorkspaceLink, "dir");
    emitTrace(fx.trace, [
      fx.linkedModule,
      fx.linkedManifest,
      join(rootWorkspaceLink, "index.js"),
    ]);

    expect(validateVercelPackage(fx.site, fx.root)).toEqual([]);
  });

  it("refuses a server-external package the traces do not carry", () => {
    // An external package is required from node_modules at runtime, so an untraced one
    // deploys and then reports its provider absent — the same state as unconfigured.
    const fx = makeFixture();
    declareServerExternals(fx.site, ["stripe", "@neondatabase/serverless"]);
    write(join(fx.site, "node_modules", "stripe", "package.json"), JSON.stringify({}));
    emitTrace(fx.trace, [
      fx.linkedModule,
      fx.linkedManifest,
      join(fx.site, "node_modules", "stripe", "package.json"),
    ]);

    expect(validateVercelPackage(fx.site, fx.root)).toEqual([
      "server-external package '@neondatabase/serverless' is absent from the Next.js traces; the deployed function would resolve it at runtime and report the provider as unconfigured",
    ]);
  });

  it("accepts a valid tree reached through a symlinked checkout root", () => {
    // Containment is decided against realpath'd link targets, so a root carrying a
    // symlinked ancestor — an aliased checkout, or macOS's `/var` -> `/private/var`
    // temp directory — must not make every in-repository package link read external.
    const fx = makeFixture();
    const physicalDependency = join(fx.site, "node_modules", "server-only", "index.js");
    write(physicalDependency, "export {};");
    emitTrace(fx.trace, [fx.linkedModule, fx.linkedManifest, physicalDependency]);

    const aliasedRoot = join(dirname(fx.root), `${basename(fx.root)}-alias`);
    symlinkSync(fx.root, aliasedRoot, "dir");
    fixtures.push(aliasedRoot);

    expect(validateVercelPackage(join(aliasedRoot, "sites", "umbrella"), aliasedRoot)).toEqual([]);
  });

  it("refuses a site-root trace that omits the linked package source", () => {
    const fx = makeFixture();
    emitTrace(fx.trace, [fx.linkedModule]);

    expect(validateVercelPackage(fx.site, fx.root)).toContain(
      "@sceneaxi/site-kit package source is absent from the Next.js traces; outputFileTracingRoot must be the monorepo root",
    );
  });
});
