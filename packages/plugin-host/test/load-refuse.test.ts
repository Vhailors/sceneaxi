import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
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
