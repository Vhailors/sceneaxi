import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PLUGIN_HOST_API_VERSION,
  openPluginHost,
} from "@sceneaxi/plugin-host";
import {
  PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI,
  PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION,
  PLUGIN_MANIFEST_SCHEMA_URI,
  PLUGIN_MANIFEST_SCHEMA_VERSION,
  emptyPluginCapabilityRegistrySeed,
  type PluginCapabilityRegistry,
  type PluginManifest,
} from "@sceneaxi/schemas";

const fixtures: string[] = [];

afterEach(() => {
  while (fixtures.length > 0) {
    const dir = fixtures.pop();
    if (dir && existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function tempRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `sceneaxi-plugin-host-${label}-`));
  fixtures.push(dir);
  return dir;
}

function writePlugin(options: {
  readonly root: string;
  readonly name: string;
  readonly manifest: PluginManifest;
  readonly entrypointSource: string;
  readonly packageJson?: Record<string, unknown>;
  readonly extraFiles?: Readonly<Record<string, string>>;
}): string {
  const pkgRoot = join(options.root, options.name);
  mkdirSync(pkgRoot, { recursive: true });
  writeFileSync(
    join(pkgRoot, "sceneaxi.plugin.manifest.json"),
    `${JSON.stringify(options.manifest, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(pkgRoot, "package.json"),
    `${JSON.stringify(
      {
        name: options.name,
        version: "0.0.0",
        type: "module",
        private: true,
        ...(options.packageJson ?? {}),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const entry = options.manifest.entrypoint.startsWith("./")
    ? options.manifest.entrypoint.slice(2)
    : options.manifest.entrypoint;
  const entryAbs = join(pkgRoot, entry);
  mkdirSync(join(entryAbs, ".."), { recursive: true });
  writeFileSync(entryAbs, options.entrypointSource, "utf8");

  for (const [rel, body] of Object.entries(options.extraFiles ?? {})) {
    const abs = join(pkgRoot, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, body, "utf8");
  }

  return pkgRoot;
}

function baseManifest(
  overrides: Partial<PluginManifest> &
    Pick<PluginManifest, "pluginId" | "entrypoint">,
): PluginManifest {
  const { capabilities: capOverride, ...rest } = overrides;
  return {
    $schema: PLUGIN_MANIFEST_SCHEMA_URI,
    schemaVersion: PLUGIN_MANIFEST_SCHEMA_VERSION,
    pluginVersion: "0.1.0",
    hostApi: `^${PLUGIN_HOST_API_VERSION}`,
    registryVersion: "1.0.0",
    ...rest,
    capabilities: Object.freeze(capOverride ? [...capOverride] : []),
  };
}

const emptyCapsEntrypoint = `export const capabilities = Object.freeze({});\n`;

function registryWithAlpha(): PluginCapabilityRegistry {
  return {
    $schema: PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI,
    schemaVersion: PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION,
    registryVersion: "1.0.0",
    entries: Object.freeze([
      {
        capabilityId: "dev.sceneaxi.capability.alpha",
        contractRef: "@sceneaxi/schemas",
        contractVersion: "1.0.0",
        owningPackage: "@sceneaxi/schemas",
        documentationRef: "docs/plugins.md",
      },
    ]),
  };
}

describe("plugin host load / list / refuse", () => {
  it("loads an explicit inert plugin and lists it deterministically", async () => {
    const root = tempRoot("inert");
    const a = writePlugin({
      root,
      name: "plugin-b",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.b",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });
    const b = writePlugin({
      root,
      name: "plugin-a",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.a",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });

    const host = openPluginHost();
    // Pass reverse lexical order; host must process and list deterministically.
    const result = await host.load([a, b]);
    expect(result.refused).toEqual([]);
    expect(result.loaded.map((p) => p.pluginId)).toEqual([
      "dev.sceneaxi.example.a",
      "dev.sceneaxi.example.b",
    ]);
    expect(host.list().loaded.map((p) => p.pluginId)).toEqual([
      "dev.sceneaxi.example.a",
      "dev.sceneaxi.example.b",
    ]);
  });

  it("does not scan for plugins when given an empty locator set", async () => {
    const host = openPluginHost();
    const result = await host.load([]);
    expect(result.loaded).toEqual([]);
    expect(result.refused).toEqual([]);
    expect(host.registry).toEqual(emptyPluginCapabilityRegistrySeed());
  });

  it("refuses a missing descriptor without evaluating anything", async () => {
    const root = tempRoot("missing-desc");
    const pkg = join(root, "empty-pkg");
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, "package.json"),
      JSON.stringify({ name: "empty", type: "module" }),
      "utf8",
    );

    const host = openPluginHost();
    const result = await host.load([pkg]);
    expect(result.loaded).toEqual([]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.reason).toBe("descriptor-missing");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
    expect(result.refused[0]?.phase).toBe("descriptor");
  });

  it("refuses unknown capabilities before entrypoint evaluation", async () => {
    const root = tempRoot("unknown-cap");
    const marker = join(root, "evaluated.txt");
    const pkg = writePlugin({
      root,
      name: "unknown-cap",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.unknown",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze(["dev.sceneaxi.capability.not-registered"]),
      }),
      entrypointSource: `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "evaluated");
export const capabilities = { "dev.sceneaxi.capability.not-registered": {} };
`,
    });

    const host = openPluginHost();
    const result = await host.load([pkg]);
    expect(result.loaded).toEqual([]);
    expect(result.refused[0]?.reason).toBe("unknown-capability");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
    expect(existsSync(marker)).toBe(false);
  });

  it("refuses forbidden SceneAxi imports before evaluation", async () => {
    const root = tempRoot("forbidden-import");
    const marker = join(root, "evaluated.txt");
    const pkg = writePlugin({
      root,
      name: "forbidden",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.forbidden",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "evaluated");
export const capabilities = Object.freeze({});
`,
      packageJson: {
        dependencies: {
          "@sceneaxi/engine-kernel": "workspace:^",
        },
      },
    });

    const host = openPluginHost();
    const result = await host.load([pkg]);
    expect(result.loaded).toEqual([]);
    expect(result.refused[0]?.reason).toBe("forbidden-sceneaxi-import");
    expect(result.refused[0]?.phase).toBe("isolation");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
    expect(existsSync(marker)).toBe(false);
  });

  it("refuses implementation-table mismatch after intentional evaluation and exposes nothing", async () => {
    const root = tempRoot("mismatch");
    const marker = join(root, "evaluated.txt");
    const pkg = writePlugin({
      root,
      name: "mismatch",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.mismatch",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "evaluated");
export const capabilities = Object.freeze({ "extra.undeclared": {} });
`,
    });

    const host = openPluginHost();
    const result = await host.load([pkg]);
    expect(existsSync(marker)).toBe(true);
    expect(readFileSync(marker, "utf8")).toBe("evaluated");
    expect(result.loaded).toEqual([]);
    expect(result.refused[0]?.reason).toBe("implementation-table-mismatch");
    expect(result.refused[0]?.entrypointEvaluated).toBe(true);
    expect(result.refused[0]?.phase).toBe("integrity");
    expect(host.getImplementation("dev.sceneaxi.example.mismatch", "extra.undeclared").ok).toBe(
      false,
    );
  });

  it("refuses duplicate pluginId in one load set", async () => {
    const root = tempRoot("dup-id");
    const first = writePlugin({
      root,
      name: "first",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.shared",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });
    const second = writePlugin({
      root,
      name: "second",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.shared",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });

    const host = openPluginHost();
    const result = await host.load([first, second]);
    expect(result.loaded).toHaveLength(1);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.reason).toBe("duplicate-plugin-id");
  });

  it("refuses hostApi incompatibility and registry version mismatch", async () => {
    const root = tempRoot("versions");
    const hostApiBad = writePlugin({
      root,
      name: "host-api-bad",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.hostapi",
        entrypoint: "./plugin.js",
        hostApi: "^9.0.0",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });
    const registryBad = writePlugin({
      root,
      name: "registry-bad",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.registry",
        entrypoint: "./plugin.js",
        registryVersion: "9.9.9",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });

    const host = openPluginHost();
    const result = await host.load([hostApiBad, registryBad]);
    const reasons = result.refused.map((r) => r.reason).sort();
    expect(reasons).toEqual(["host-api-incompatible", "registry-version-mismatch"]);
    expect(result.loaded).toEqual([]);
  });

  it("addresses multiple providers of one capability separately with no default", async () => {
    const root = tempRoot("multi");
    const registry = registryWithAlpha();
    const capId = "dev.sceneaxi.capability.alpha";

    const providerA = writePlugin({
      root,
      name: "provider-a",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.provider.a",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([capId]),
      }),
      entrypointSource: `
export const capabilities = Object.freeze({
  ${JSON.stringify(capId)}: { provider: "a" },
});
`,
      packageJson: {
        dependencies: { "@sceneaxi/schemas": "workspace:^" },
      },
    });
    const providerB = writePlugin({
      root,
      name: "provider-b",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.provider.b",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([capId]),
      }),
      entrypointSource: `
export const capabilities = Object.freeze({
  ${JSON.stringify(capId)}: { provider: "b" },
});
`,
      packageJson: {
        dependencies: { "@sceneaxi/schemas": "workspace:^" },
      },
    });

    const host = openPluginHost({ registry });
    const result = await host.load([providerB, providerA]);
    expect(result.refused).toEqual([]);
    expect(result.loaded.map((p) => p.pluginId)).toEqual([
      "dev.sceneaxi.provider.a",
      "dev.sceneaxi.provider.b",
    ]);

    const a = host.getImplementation("dev.sceneaxi.provider.a", capId);
    const b = host.getImplementation("dev.sceneaxi.provider.b", capId);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.implementation).toEqual({ provider: "a" });
      expect(b.implementation).toEqual({ provider: "b" });
    }

    // No implicit winner: capability alone is not an address.
    const miss = host.getImplementation("dev.sceneaxi.provider.missing", capId);
    expect(miss.ok).toBe(false);
    if (!miss.ok) {
      expect(miss.reason).toBe("plugin-not-loaded");
    }
  });

  it("refuses source import of unauthorized SceneAxi packages before evaluation", async () => {
    const root = tempRoot("src-import");
    const marker = join(root, "evaluated.txt");
    const pkg = writePlugin({
      root,
      name: "src-import",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.srcimport",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
import "@sceneaxi/engine-kernel";
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "evaluated");
export const capabilities = Object.freeze({});
`,
    });

    const host = openPluginHost();
    const result = await host.load([pkg]);
    expect(result.refused[0]?.reason).toBe("forbidden-sceneaxi-import");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
    expect(existsSync(marker)).toBe(false);
  });

  it("canonicalizes entrypoint and relative-import symlinks before evaluation", async () => {
    const root = tempRoot("symlinks");
    const marker = join(root, "evaluated.txt");
    const outside = join(root, "outside.js");
    writeFileSync(
      outside,
      `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "evaluated");
export const capabilities = Object.freeze({});
`,
      "utf8",
    );

    const entrypointLink = writePlugin({
      root,
      name: "entrypoint-link",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.entrypointlink",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });
    rmSync(join(entrypointLink, "plugin.js"));
    symlinkSync(outside, join(entrypointLink, "plugin.js"));

    const importLink = writePlugin({
      root,
      name: "import-link",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.importlink",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
import "./helper.js";
export const capabilities = Object.freeze({});
`,
      extraFiles: { "helper.js": emptyCapsEntrypoint },
    });
    rmSync(join(importLink, "helper.js"));
    symlinkSync(outside, join(importLink, "helper.js"));

    const result = await openPluginHost().load([entrypointLink, importLink]);
    expect(result.loaded).toEqual([]);
    expect(result.refused.map((item) => item.reason)).toEqual([
      "entrypoint-escape",
      "entrypoint-escape",
    ]);
    expect(result.refused.every((item) => !item.entrypointEvaluated)).toBe(true);
    expect(existsSync(marker)).toBe(false);
  });

  it("inspects the complete package-local module graph before evaluation", async () => {
    const root = tempRoot("module-graph");
    const marker = join(root, "evaluated.txt");
    const transitive = writePlugin({
      root,
      name: "transitive",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.transitive",
        entrypoint: "./dist/plugin.js",
      }),
      entrypointSource: `
import "./helper.js";
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "evaluated");
export const capabilities = Object.freeze({});
`,
      extraFiles: {
        "dist/helper.js": `import "@sceneaxi/engine-kernel";\n`,
      },
    });
    const dynamic = writePlugin({
      root,
      name: "dynamic",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.dynamic",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "evaluated");
const target = "./helper.js";
void import(target);
export const capabilities = Object.freeze({});
`,
      extraFiles: { "helper.js": emptyCapsEntrypoint },
    });
    const unresolved = writePlugin({
      root,
      name: "unresolved",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.unresolved",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
import "./missing.js";
export const capabilities = Object.freeze({});
`,
    });

    const result = await openPluginHost().load([
      transitive,
      dynamic,
      unresolved,
    ]);
    expect(result.loaded).toEqual([]);
    expect(
      result.refused.map((item) => [item.pluginId, item.reason]),
    ).toEqual([
      ["dev.sceneaxi.example.dynamic", "isolation-unverifiable"],
      ["dev.sceneaxi.example.transitive", "forbidden-sceneaxi-import"],
      ["dev.sceneaxi.example.unresolved", "isolation-unverifiable"],
    ]);
    expect(result.refused.every((item) => !item.entrypointEvaluated)).toBe(true);
    expect(existsSync(marker)).toBe(false);
  });

  it("refuses direct imports of another plugin package", async () => {
    const root = tempRoot("plugin-import");
    const provider = writePlugin({
      root,
      name: "provider",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.provider",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: emptyCapsEntrypoint,
      packageJson: { main: "./plugin.js" },
    });
    const consumer = writePlugin({
      root,
      name: "consumer",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.consumer",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
import "provider";
export const capabilities = Object.freeze({});
`,
      packageJson: { dependencies: { provider: "0.0.0" } },
    });
    mkdirSync(join(consumer, "node_modules"), { recursive: true });
    symlinkSync(provider, join(consumer, "node_modules", "provider"), "dir");

    const result = await openPluginHost().load([consumer]);
    expect(result.loaded).toEqual([]);
    expect(result.refused[0]?.reason).toBe("isolation-unverifiable");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
  });

  it("resolves ESM and CJS edges with their matching conditions", async () => {
    const root = tempRoot("resolve-conditions");
    const esm = writePlugin({
      root,
      name: "esm",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.conditions-esm",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
import "#branch";
export const capabilities = Object.freeze({});
`,
      packageJson: {
        imports: {
          "#branch": {
            import: "./esm-branch.js",
            default: "./esm-branch.js",
          },
        },
      },
      extraFiles: {
        "esm-branch.js": `import "@sceneaxi/engine-kernel";\n`,
      },
    });
    const cjs = writePlugin({
      root,
      name: "cjs",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.conditions-cjs",
        entrypoint: "./plugin.cjs",
      }),
      entrypointSource: `
require("#branch");
exports.capabilities = Object.freeze({});
`,
      packageJson: {
        imports: {
          "#branch": {
            require: "./cjs-branch.cjs",
            default: "./cjs-branch.cjs",
          },
        },
      },
      extraFiles: {
        "cjs-branch.cjs": `module.exports = {};\n`,
      },
    });

    const result = await openPluginHost().load([esm, cjs]);
    expect(result.loaded.map((item) => item.pluginId)).toEqual([
      "dev.sceneaxi.example.conditions-cjs",
    ]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.pluginId).toBe(
      "dev.sceneaxi.example.conditions-esm",
    );
    expect(result.refused[0]?.reason).toBe("forbidden-sceneaxi-import");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
  });

  it("refuses aliased module-loader construction before evaluation", async () => {
    const root = tempRoot("loader-alias");
    const marker = join(root, "evaluated.txt");
    const pkg = writePlugin({
      root,
      name: "loader-alias",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.loaderalias",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
import { createRequire as makeLoader } from "node:module";
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "evaluated");
const load = makeLoader(import.meta.url);
load("@sceneaxi/engine-kernel");
export const capabilities = Object.freeze({});
`,
    });

    const result = await openPluginHost().load([pkg]);
    expect(result.loaded).toEqual([]);
    expect(result.refused[0]?.reason).toBe("isolation-unverifiable");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
    expect(existsSync(marker)).toBe(false);
  });

  it("refuses indirect require references before evaluation", async () => {
    const root = tempRoot("require-alias");
    const marker = join(root, "evaluated.txt");
    const pkg = writePlugin({
      root,
      name: "require-alias",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.requirealias",
        entrypoint: "./plugin.cjs",
      }),
      entrypointSource: `
const load = require;
load("./provider.cjs");
exports.capabilities = Object.freeze({});
`,
      extraFiles: {
        "provider.cjs": `
require("node:fs").writeFileSync(${JSON.stringify(marker)}, "evaluated");
`,
      },
    });

    const result = await openPluginHost().load([pkg]);
    expect(result.loaded).toEqual([]);
    expect(result.refused[0]?.reason).toBe("isolation-unverifiable");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
    expect(existsSync(marker)).toBe(false);
  });

  it("refuses package mappings with unsupported custom conditions", async () => {
    const root = tempRoot("custom-conditions");
    const pkg = writePlugin({
      root,
      name: "custom-conditions",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.customconditions",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
import "#branch";
export const capabilities = Object.freeze({});
`,
      packageJson: {
        imports: {
          "#branch": {
            "review-custom": "./custom.js",
            import: "./safe.js",
            default: "./safe.js",
          },
        },
      },
      extraFiles: {
        "custom.js": `import "@sceneaxi/engine-kernel";\n`,
        "safe.js": `export {};\n`,
      },
    });

    const result = await openPluginHost().load([pkg]);
    expect(result.loaded).toEqual([]);
    expect(result.refused[0]?.reason).toBe("isolation-unverifiable");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
  });

  it("resolves authorized SceneAxi imports and refuses missing targets", async () => {
    const root = tempRoot("authorized-resolution");
    const registry = registryWithAlpha();
    const capabilityId = "dev.sceneaxi.capability.alpha";
    const resolved = writePlugin({
      root,
      name: "resolved",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.authorized",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([capabilityId]),
      }),
      entrypointSource: `
import "@sceneaxi/schemas";
export const capabilities = Object.freeze({
  ${JSON.stringify(capabilityId)}: {},
});
`,
      packageJson: {
        dependencies: { "@sceneaxi/schemas": "0.0.0" },
      },
    });
    const schemasRoot = join(
      resolved,
      "node_modules",
      "@sceneaxi",
      "schemas",
    );
    mkdirSync(schemasRoot, { recursive: true });
    writeFileSync(
      join(schemasRoot, "package.json"),
      JSON.stringify({
        name: "@sceneaxi/schemas",
        type: "module",
        exports: "./index.js",
      }),
      "utf8",
    );
    writeFileSync(join(schemasRoot, "index.js"), "export {};\n", "utf8");

    const missing = writePlugin({
      root,
      name: "missing",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.missingauthorized",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([capabilityId]),
      }),
      entrypointSource: `
import "@sceneaxi/schemas/contracts/missing.schema.json";
export const capabilities = Object.freeze({
  ${JSON.stringify(capabilityId)}: {},
});
`,
      packageJson: {
        dependencies: { "@sceneaxi/schemas": "0.0.0" },
      },
    });

    const result = await openPluginHost({ registry }).load([
      resolved,
      missing,
    ]);
    expect(result.loaded.map((item) => item.pluginId)).toEqual([
      "dev.sceneaxi.example.authorized",
    ]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.pluginId).toBe(
      "dev.sceneaxi.example.missingauthorized",
    );
    expect(result.refused[0]?.reason).toBe("isolation-unverifiable");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
  });

  it("classifies package aliases by resolved identity", async () => {
    const root = tempRoot("package-alias");
    const pkg = writePlugin({
      root,
      name: "consumer",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.packagealias",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
import "safe-alias";
export const capabilities = Object.freeze({});
`,
      packageJson: {
        dependencies: {
          "safe-alias": "npm:@sceneaxi/engine-kernel@0.0.0",
        },
      },
    });
    const aliasRoot = join(pkg, "node_modules", "safe-alias");
    mkdirSync(aliasRoot, { recursive: true });
    writeFileSync(
      join(aliasRoot, "package.json"),
      JSON.stringify({
        name: "@sceneaxi/engine-kernel",
        type: "module",
        exports: "./index.js",
      }),
      "utf8",
    );
    writeFileSync(join(aliasRoot, "index.js"), "export {};\n", "utf8");

    const result = await openPluginHost().load([pkg]);
    expect(result.loaded).toEqual([]);
    expect(result.refused[0]?.reason).toBe("forbidden-sceneaxi-import");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
  });

  it("refuses nested package boundaries that hide outer identity", async () => {
    const root = tempRoot("nested-package");
    const pkg = writePlugin({
      root,
      name: "consumer",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.nestedpackage",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
import "safe-alias";
export const capabilities = Object.freeze({});
`,
      packageJson: {
        dependencies: {
          "safe-alias": "npm:@sceneaxi/engine-kernel@0.0.0",
        },
      },
    });
    const aliasRoot = join(pkg, "node_modules", "safe-alias");
    const nestedRoot = join(aliasRoot, "nested");
    mkdirSync(nestedRoot, { recursive: true });
    writeFileSync(
      join(aliasRoot, "package.json"),
      JSON.stringify({
        name: "@sceneaxi/engine-kernel",
        type: "module",
        exports: "./nested/index.js",
      }),
      "utf8",
    );
    writeFileSync(
      join(nestedRoot, "package.json"),
      JSON.stringify({
        name: "innocent-inner",
        type: "module",
      }),
      "utf8",
    );
    writeFileSync(join(nestedRoot, "index.js"), "export {};\n", "utf8");

    const result = await openPluginHost().load([pkg]);
    expect(result.loaded).toEqual([]);
    expect(result.refused[0]?.reason).toBe("isolation-unverifiable");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
  });

  it("evaluates the complete hostApi v1 range dialect", async () => {
    const cases = [
      { range: "1.x", host: "1.9.0", accepted: true },
      { range: "1.2.x", host: "1.2.9", accepted: true },
      {
        range: "1.2.x || >=2.0.0 <3.0.0",
        host: "2.5.0",
        accepted: true,
      },
      { range: ">=1.2 <2", host: "1.9.0", accepted: true },
      { range: "1.2 - 2.3.4", host: "2.3.4", accepted: true },
      { range: "1.2 - 2.3.4", host: "2.3.5", accepted: false },
      { range: "^0.2", host: "0.2.9", accepted: true },
      { range: "^0.2", host: "0.3.0", accepted: false },
      {
        range: "^1.0.0-beta.1 || ~2.4",
        host: "1.0.0",
        accepted: true,
      },
      {
        range: "^1.0.0-beta.1 || ~2.4",
        host: "2.4.9",
        accepted: true,
      },
      { range: "~1", host: "1.9.0", accepted: true },
      { range: "~1.2", host: "1.3.0", accepted: false },
      { range: ">1.2", host: "1.2.9", accepted: false },
      { range: ">1.2", host: "1.3.0", accepted: true },
      { range: "<=1.2", host: "1.2.9", accepted: true },
      { range: "<=1.2", host: "1.3.0", accepted: false },
    ] as const;

    for (const [index, testCase] of cases.entries()) {
      const root = tempRoot(`host-api-${index}`);
      const pkg = writePlugin({
        root,
        name: "plugin",
        manifest: baseManifest({
          pluginId: `dev.sceneaxi.example.range${index}`,
          entrypoint: "./plugin.js",
          hostApi: testCase.range,
        }),
        entrypointSource: emptyCapsEntrypoint,
      });
      const result = await openPluginHost({
        hostApiVersion: testCase.host,
      }).load([pkg]);
      expect(result.loaded.length === 1).toBe(testCase.accepted);
      expect(result.refused.length === 1).toBe(!testCase.accepted);
    }
  });

  it("turns throwing implementation tables into one refusal and continues", async () => {
    const root = tempRoot("throwing-table");
    const throwing = writePlugin({
      root,
      name: "a-throwing",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.throwing",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
export const capabilities = new Proxy({}, {
  ownKeys() {
    throw new Error("inspection blocked");
  },
});
`,
    });
    const healthy = writePlugin({
      root,
      name: "z-healthy",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.healthy",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });

    const result = await openPluginHost().load([healthy, throwing]);
    expect(result.loaded.map((item) => item.pluginId)).toEqual([
      "dev.sceneaxi.example.healthy",
    ]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.reason).toBe("implementation-table-mismatch");
    expect(result.refused[0]?.phase).toBe("integrity");
    expect(result.refused[0]?.entrypointEvaluated).toBe(true);
  });

  it("rejects hidden string and symbol implementation keys", async () => {
    const root = tempRoot("hidden-keys");
    const hiddenString = writePlugin({
      root,
      name: "hidden-string",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.hiddenstring",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
const capabilities = {};
Object.defineProperty(capabilities, "hidden", {
  enumerable: false,
  value: {},
});
export { capabilities };
`,
    });
    const symbol = writePlugin({
      root,
      name: "symbol",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.symbol",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: `
export const capabilities = {
  [Symbol.for("hidden")]: {},
};
`,
    });

    const result = await openPluginHost().load([symbol, hiddenString]);
    expect(result.loaded).toEqual([]);
    expect(result.refused).toHaveLength(2);
    expect(
      result.refused.every(
        (item) =>
          item.reason === "implementation-table-mismatch" &&
          item.phase === "integrity" &&
          item.entrypointEvaluated,
      ),
    ).toBe(true);
  });

  it("refused packages expose no implementations via getImplementation", async () => {
    const root = tempRoot("no-expose");
    const pkg = writePlugin({
      root,
      name: "no-expose",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.example.noexpose",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze(["dev.sceneaxi.capability.alpha"]),
      }),
      entrypointSource: `
export const capabilities = Object.freeze({
  "dev.sceneaxi.capability.alpha": { secret: true },
});
`,
    });

    // Empty seed registry → unknown capability; nothing exposed.
    const host = openPluginHost();
    await host.load([pkg]);
    const hit = host.getImplementation(
      "dev.sceneaxi.example.noexpose",
      "dev.sceneaxi.capability.alpha",
    );
    expect(hit.ok).toBe(false);
  });
});
