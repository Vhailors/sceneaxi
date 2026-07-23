/**
 * Fixture-driven v1 Plugin Host load/refuse matrix (sceneaxi#23 / ADR 0005).
 *
 * Exercises public package seams only. Named fixtures cover every stable
 * PluginRefusalReason; multi-violation candidates pin refusal precedence;
 * execution sentinels distinguish pre- vs post-evaluation refusals.
 *
 * Test-only capability IDs live only in this suite — never in the public seed.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  openPluginHost,
  PLUGIN_HOST_API_VERSION,
  type PluginHostLoadResult,
  type PluginRefusalReason,
} from "@sceneaxi/plugin-host";
import {
  emptyPluginCapabilityRegistrySeed,
  lookupPluginCapability,
  parsePluginCapabilityRegistryText,
  PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI,
  PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION,
  PLUGIN_CAPABILITY_REGISTRY_VERSION,
  PLUGIN_MANIFEST_PATH,
  PLUGIN_MANIFEST_SCHEMA_URI,
  PLUGIN_MANIFEST_SCHEMA_VERSION,
  validatePluginCapabilityRegistry,
  type PluginCapabilityRegistry,
  type PluginManifest,
} from "@sceneaxi/schemas";

const require = createRequire(import.meta.url);
/** Public seed artifact via published contract export path (not a test fixture). */
const publicSeedPath = require.resolve(
  "@sceneaxi/schemas/contracts/plugin-capability-registry.1.0.0.json",
);

/** Unmistakably fixture-scoped capability ID — must never appear in public seed. */
const TEST_ONLY_CAPABILITY_ID =
  "test.sceneaxi.fixture.capability.refuse-matrix-alpha" as const;

/** Compile-time exhaustiveness: adding a PluginRefusalReason breaks this record. */
const REFUSAL_REASON_UNION: Record<PluginRefusalReason, true> = {
  "descriptor-missing": true,
  "descriptor-unreadable": true,
  "descriptor-invalid": true,
  "schema-version-unsupported": true,
  "host-api-incompatible": true,
  "registry-version-mismatch": true,
  "duplicate-plugin-id": true,
  "unknown-capability": true,
  "entrypoint-escape": true,
  "entrypoint-missing": true,
  "forbidden-sceneaxi-import": true,
  "isolation-unverifiable": true,
  "entrypoint-evaluation-failed": true,
  "implementation-table-mismatch": true,
};
const ALL_REFUSAL_REASONS = Object.keys(
  REFUSAL_REASON_UNION,
) as readonly PluginRefusalReason[];

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
  const dir = mkdtempSync(join(tmpdir(), `sceneaxi-refuse-matrix-${label}-`));
  fixtures.push(dir);
  return dir;
}

/**
 * Test-only registry document — validated through the public #21 schemas API.
 * Never written into the public seed artifact.
 */
function testOnlyRegistry(): PluginCapabilityRegistry {
  const candidate = {
    $schema: PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI,
    schemaVersion: PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION,
    registryVersion: PLUGIN_CAPABILITY_REGISTRY_VERSION,
    entries: [
      {
        capabilityId: TEST_ONLY_CAPABILITY_ID,
        contractRef: "@sceneaxi/schemas",
        contractVersion: "1.0.0",
        owningPackage: "@sceneaxi/schemas",
        documentationRef: "docs/plugins.md",
      },
    ],
  };
  const validated = validatePluginCapabilityRegistry(candidate, {
    expectedRegistryVersion: PLUGIN_CAPABILITY_REGISTRY_VERSION,
  });
  if (!validated.ok) {
    throw new Error(
      `test-only registry fixture failed validation: ${validated.diagnostics[0]?.message ?? "unknown"}`,
    );
  }
  return validated.registry;
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

function writePackage(options: {
  readonly root: string;
  readonly name: string;
  readonly manifestJson?: string;
  readonly manifest?: PluginManifest | Record<string, unknown>;
  readonly entrypointSource?: string;
  readonly entrypointRel?: string;
  readonly writeEntrypoint?: boolean;
  readonly packageJson?: Record<string, unknown>;
  readonly extraFiles?: Readonly<Record<string, string>>;
}): string {
  const pkgRoot = join(options.root, options.name);
  mkdirSync(pkgRoot, { recursive: true });

  if (options.manifestJson !== undefined) {
    writeFileSync(
      join(pkgRoot, PLUGIN_MANIFEST_PATH),
      options.manifestJson,
      "utf8",
    );
  } else if (options.manifest !== undefined) {
    writeFileSync(
      join(pkgRoot, PLUGIN_MANIFEST_PATH),
      `${JSON.stringify(options.manifest, null, 2)}\n`,
      "utf8",
    );
  }

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

  const writeEntrypoint = options.writeEntrypoint ?? true;
  if (writeEntrypoint && options.entrypointSource !== undefined) {
    const rel =
      options.entrypointRel ??
      (typeof options.manifest === "object" &&
      options.manifest !== null &&
      "entrypoint" in options.manifest &&
      typeof options.manifest.entrypoint === "string"
        ? options.manifest.entrypoint.startsWith("./")
          ? options.manifest.entrypoint.slice(2)
          : options.manifest.entrypoint
        : "plugin.js");
    if (!rel.startsWith("/") && !/^[A-Za-z]:/.test(rel) && !rel.includes("..")) {
      const entryAbs = join(pkgRoot, rel);
      mkdirSync(join(entryAbs, ".."), { recursive: true });
      writeFileSync(entryAbs, options.entrypointSource, "utf8");
    }
  }

  for (const [rel, body] of Object.entries(options.extraFiles ?? {})) {
    const abs = join(pkgRoot, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, body, "utf8");
  }

  return pkgRoot;
}

function sentinelSource(marker: string, tableSource: string): string {
  return `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "evaluated");
${tableSource}
`;
}

function normalizeReport(result: PluginHostLoadResult): unknown {
  return {
    loaded: result.loaded.map((p) => ({
      pluginId: p.pluginId,
      pluginVersion: p.pluginVersion,
      capabilities: [...p.capabilities],
    })),
    refused: result.refused.map((r) => ({
      reason: r.reason,
      phase: r.phase,
      entrypointEvaluated: r.entrypointEvaluated,
      pluginId: r.pluginId ?? null,
      capabilityId: r.capabilityId ?? null,
    })),
  };
}

describe("v1 refuse matrix — every ADR 0005 refusal class", () => {
  const REFUSE_FIXTURES = [
    {
      name: "descriptor-missing",
      reason: "descriptor-missing" as const,
      phase: "descriptor" as const,
      entrypointEvaluated: false,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = join(root, "missing-desc");
        mkdirSync(pkg, { recursive: true });
        writeFileSync(
          join(pkg, "package.json"),
          JSON.stringify({ name: "missing-desc", type: "module" }),
          "utf8",
        );
        // Side-channel would-be entrypoint; host must never load it.
        writeFileSync(
          join(pkg, "plugin.js"),
          sentinelSource(marker, "export const capabilities = Object.freeze({});"),
          "utf8",
        );
        return { locators: [pkg], registry: undefined as PluginCapabilityRegistry | undefined };
      },
    },
    {
      name: "descriptor-invalid-malformed-json",
      reason: "descriptor-invalid" as const,
      phase: "descriptor" as const,
      entrypointEvaluated: false,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = writePackage({
          root,
          name: "malformed",
          manifestJson: "{ not valid json\n",
          entrypointRel: "plugin.js",
          entrypointSource: sentinelSource(
            marker,
            "export const capabilities = Object.freeze({});",
          ),
        });
        return { locators: [pkg], registry: undefined };
      },
    },
    {
      name: "descriptor-invalid-duplicate-capability-claim",
      reason: "descriptor-invalid" as const,
      phase: "descriptor" as const,
      entrypointEvaluated: false,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = writePackage({
          root,
          name: "dup-cap",
          manifest: {
            ...baseManifest({
              pluginId: "dev.sceneaxi.fixture.dup-cap",
              entrypoint: "./plugin.js",
            }),
            capabilities: [TEST_ONLY_CAPABILITY_ID, TEST_ONLY_CAPABILITY_ID],
          },
          entrypointSource: sentinelSource(
            marker,
            `export const capabilities = Object.freeze({ ${JSON.stringify(TEST_ONLY_CAPABILITY_ID)}: {} });`,
          ),
        });
        return { locators: [pkg], registry: testOnlyRegistry() };
      },
    },
    {
      name: "schema-version-unsupported",
      reason: "schema-version-unsupported" as const,
      phase: "descriptor" as const,
      entrypointEvaluated: false,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = writePackage({
          root,
          name: "schema-version",
          manifest: {
            ...baseManifest({
              pluginId: "dev.sceneaxi.fixture.schema-version",
              entrypoint: "./plugin.js",
            }),
            schemaVersion: "9.9.9",
          },
          entrypointSource: sentinelSource(
            marker,
            "export const capabilities = Object.freeze({});",
          ),
        });
        return { locators: [pkg], registry: undefined };
      },
    },
    {
      name: "host-api-incompatible",
      reason: "host-api-incompatible" as const,
      phase: "descriptor" as const,
      entrypointEvaluated: false,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = writePackage({
          root,
          name: "host-api",
          manifest: baseManifest({
            pluginId: "dev.sceneaxi.fixture.host-api",
            entrypoint: "./plugin.js",
            hostApi: "^99.0.0",
          }),
          entrypointSource: sentinelSource(
            marker,
            "export const capabilities = Object.freeze({});",
          ),
        });
        return { locators: [pkg], registry: undefined };
      },
    },
    {
      name: "registry-version-mismatch",
      reason: "registry-version-mismatch" as const,
      phase: "descriptor" as const,
      entrypointEvaluated: false,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = writePackage({
          root,
          name: "registry-version",
          manifest: baseManifest({
            pluginId: "dev.sceneaxi.fixture.registry-version",
            entrypoint: "./plugin.js",
            registryVersion: "9.9.9",
          }),
          entrypointSource: sentinelSource(
            marker,
            "export const capabilities = Object.freeze({});",
          ),
        });
        return { locators: [pkg], registry: undefined };
      },
    },
    {
      name: "duplicate-plugin-id",
      reason: "duplicate-plugin-id" as const,
      phase: "descriptor" as const,
      entrypointEvaluated: false,
      withSentinel: false,
      setup(root: string) {
        const first = writePackage({
          root,
          name: "a-first",
          manifest: baseManifest({
            pluginId: "dev.sceneaxi.fixture.shared-id",
            entrypoint: "./plugin.js",
          }),
          entrypointSource: emptyCapsEntrypoint,
        });
        const second = writePackage({
          root,
          name: "b-second",
          manifest: baseManifest({
            pluginId: "dev.sceneaxi.fixture.shared-id",
            entrypoint: "./plugin.js",
          }),
          entrypointSource: emptyCapsEntrypoint,
        });
        return { locators: [first, second], registry: undefined };
      },
    },
    {
      name: "unknown-capability",
      reason: "unknown-capability" as const,
      phase: "descriptor" as const,
      entrypointEvaluated: false,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = writePackage({
          root,
          name: "unknown-cap",
          manifest: baseManifest({
            pluginId: "dev.sceneaxi.fixture.unknown-cap",
            entrypoint: "./plugin.js",
            capabilities: Object.freeze([
              "test.sceneaxi.fixture.capability.never-registered",
            ]),
          }),
          entrypointSource: sentinelSource(
            marker,
            'export const capabilities = Object.freeze({ "test.sceneaxi.fixture.capability.never-registered": {} });',
          ),
        });
        return { locators: [pkg], registry: testOnlyRegistry() };
      },
    },
    {
      name: "entrypoint-absolute",
      reason: "descriptor-invalid" as const,
      phase: "descriptor" as const,
      entrypointEvaluated: false,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = writePackage({
          root,
          name: "absolute-entry",
          manifest: {
            ...baseManifest({
              pluginId: "dev.sceneaxi.fixture.absolute-entry",
              entrypoint: "./plugin.js",
            }),
            entrypoint: "/tmp/sceneaxi-absolute-plugin.js",
          },
          writeEntrypoint: false,
          entrypointSource: emptyCapsEntrypoint,
          extraFiles: {
            "would-run.js": sentinelSource(
              marker,
              "export const capabilities = Object.freeze({});",
            ),
          },
        });
        return { locators: [pkg], registry: undefined };
      },
    },
    {
      name: "entrypoint-escape-parent-segments",
      reason: "descriptor-invalid" as const,
      phase: "descriptor" as const,
      entrypointEvaluated: false,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = writePackage({
          root,
          name: "escape-entry",
          manifest: {
            ...baseManifest({
              pluginId: "dev.sceneaxi.fixture.escape-entry",
              entrypoint: "./plugin.js",
            }),
            entrypoint: "../outside.js",
          },
          writeEntrypoint: false,
          entrypointSource: emptyCapsEntrypoint,
          extraFiles: {
            "would-run.js": sentinelSource(
              marker,
              "export const capabilities = Object.freeze({});",
            ),
          },
        });
        return { locators: [pkg], registry: undefined };
      },
    },
    {
      name: "entrypoint-missing",
      reason: "entrypoint-missing" as const,
      phase: "isolation" as const,
      entrypointEvaluated: false,
      withSentinel: false,
      setup(root: string) {
        const pkg = writePackage({
          root,
          name: "missing-entry",
          manifest: baseManifest({
            pluginId: "dev.sceneaxi.fixture.missing-entry",
            entrypoint: "./plugin.js",
          }),
          writeEntrypoint: false,
        });
        return { locators: [pkg], registry: undefined };
      },
    },
    {
      name: "forbidden-sceneaxi-import",
      reason: "forbidden-sceneaxi-import" as const,
      phase: "isolation" as const,
      entrypointEvaluated: false,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = writePackage({
          root,
          name: "forbidden-import",
          manifest: baseManifest({
            pluginId: "dev.sceneaxi.fixture.forbidden-import",
            entrypoint: "./plugin.js",
          }),
          entrypointSource: sentinelSource(
            marker,
            'import "@sceneaxi/engine-kernel";\nexport const capabilities = Object.freeze({});',
          ),
        });
        return { locators: [pkg], registry: undefined };
      },
    },
    {
      name: "isolation-unverifiable-dynamic-import",
      reason: "isolation-unverifiable" as const,
      phase: "isolation" as const,
      entrypointEvaluated: false,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = writePackage({
          root,
          name: "dynamic-import",
          manifest: baseManifest({
            pluginId: "dev.sceneaxi.fixture.dynamic-import",
            entrypoint: "./plugin.js",
          }),
          entrypointSource: sentinelSource(
            marker,
            `const target = "./helper.js";
void import(target);
export const capabilities = Object.freeze({});`,
          ),
          extraFiles: { "helper.js": emptyCapsEntrypoint },
        });
        return { locators: [pkg], registry: undefined };
      },
    },
    {
      name: "entrypoint-evaluation-failed",
      reason: "entrypoint-evaluation-failed" as const,
      phase: "evaluation" as const,
      entrypointEvaluated: true,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = writePackage({
          root,
          name: "eval-failed",
          manifest: baseManifest({
            pluginId: "dev.sceneaxi.fixture.eval-failed",
            entrypoint: "./plugin.js",
          }),
          entrypointSource: `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "evaluated");
throw new Error("intentional entrypoint failure");
`,
        });
        return { locators: [pkg], registry: undefined };
      },
    },
    {
      name: "implementation-table-mismatch-undeclared",
      reason: "implementation-table-mismatch" as const,
      phase: "integrity" as const,
      entrypointEvaluated: true,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = writePackage({
          root,
          name: "undeclared-impl",
          manifest: baseManifest({
            pluginId: "dev.sceneaxi.fixture.undeclared-impl",
            entrypoint: "./plugin.js",
          }),
          entrypointSource: sentinelSource(
            marker,
            'export const capabilities = Object.freeze({ "extra.undeclared": {} });',
          ),
        });
        return { locators: [pkg], registry: undefined };
      },
    },
    {
      name: "implementation-table-mismatch-missing-declared",
      reason: "implementation-table-mismatch" as const,
      phase: "integrity" as const,
      entrypointEvaluated: true,
      withSentinel: true,
      setup(root: string, marker: string) {
        const pkg = writePackage({
          root,
          name: "missing-declared",
          manifest: baseManifest({
            pluginId: "dev.sceneaxi.fixture.missing-declared",
            entrypoint: "./plugin.js",
            capabilities: Object.freeze([TEST_ONLY_CAPABILITY_ID]),
          }),
          entrypointSource: sentinelSource(
            marker,
            // Declared capability is absent from the exported table.
            "export const capabilities = Object.freeze({});",
          ),
          packageJson: {
            dependencies: { "@sceneaxi/schemas": "workspace:^" },
          },
        });
        return { locators: [pkg], registry: testOnlyRegistry() };
      },
    },
  ];

  it.each(REFUSE_FIXTURES)(
    "named fixture $name refuses with $reason",
    async ({ reason, phase, entrypointEvaluated, withSentinel, setup }) => {
      const root = tempRoot(reason);
      const marker = join(root, "evaluated.txt");
      const { locators, registry } = setup(root, marker);
      const host = openPluginHost(registry ? { registry } : {});
      const result = await host.load(locators);

      const match = result.refused.find((r) => r.reason === reason);
      expect(match, `expected a refusal with reason ${reason}`).toBeDefined();
      expect(match?.phase).toBe(phase);
      expect(match?.entrypointEvaluated).toBe(entrypointEvaluated);

      if (reason === "duplicate-plugin-id") {
        expect(result.loaded).toHaveLength(1);
        expect(result.refused).toHaveLength(1);
      } else {
        expect(result.loaded).toEqual([]);
      }

      if (withSentinel) {
        if (entrypointEvaluated) {
          expect(existsSync(marker)).toBe(true);
          expect(readFileSync(marker, "utf8")).toBe("evaluated");
        } else {
          expect(existsSync(marker)).toBe(false);
        }
      }

      // Refused pluginId never exposes implementations.
      if (match?.pluginId) {
        const hit = host.getImplementation(
          match.pluginId,
          TEST_ONLY_CAPABILITY_ID,
        );
        expect(hit.ok).toBe(false);
      }
    },
  );

  it("covers every PluginRefusalReason with at least one named fixture", async () => {
    // descriptor-unreadable and entrypoint-escape need specialized setup;
    // assert the table above plus these two dedicated fixtures exhaust the union.
    const covered = new Set<PluginRefusalReason>(
      REFUSE_FIXTURES.map((fixture) => fixture.reason),
    );

    // descriptor-unreadable: non-file at descriptor path (directory).
    {
      const root = tempRoot("unreadable");
      const pkg = join(root, "unreadable-desc");
      mkdirSync(join(pkg, PLUGIN_MANIFEST_PATH), { recursive: true });
      writeFileSync(
        join(pkg, "package.json"),
        JSON.stringify({ name: "unreadable", type: "module" }),
        "utf8",
      );
      const result = await openPluginHost().load([pkg]);
      expect(result.refused[0]?.reason).toBe("descriptor-unreadable");
      expect(result.refused[0]?.phase).toBe("descriptor");
      expect(result.refused[0]?.entrypointEvaluated).toBe(false);
      covered.add("descriptor-unreadable");
    }

    // entrypoint-escape: schema-valid relative entrypoint replaced by a symlink
    // whose target resolves outside the package root; isolation refuses it.
    {
      const root = tempRoot("escape-symlink");
      const outside = join(root, "outside.js");
      writeFileSync(
        outside,
        "export const capabilities = Object.freeze({});\n",
        "utf8",
      );
      const pkg = writePackage({
        root,
        name: "escape-symlink",
        manifest: baseManifest({
          pluginId: "dev.sceneaxi.fixture.escape-symlink",
          entrypoint: "./plugin.js",
        }),
        entrypointSource: emptyCapsEntrypoint,
      });
      rmSync(join(pkg, "plugin.js"));
      const { symlinkSync } = await import("node:fs");
      symlinkSync(outside, join(pkg, "plugin.js"));
      const result = await openPluginHost().load([pkg]);
      expect(result.refused[0]?.reason).toBe("entrypoint-escape");
      expect(result.refused[0]?.phase).toBe("isolation");
      expect(result.refused[0]?.entrypointEvaluated).toBe(false);
      covered.add("entrypoint-escape");
    }

    for (const reason of ALL_REFUSAL_REASONS) {
      expect(covered.has(reason), `missing fixture for ${reason}`).toBe(true);
    }
  });
});

describe("v1 refuse matrix — precedence, integrity, ordering, multi-provider", () => {
  it("reports the first ADR 0005 phase violation when a candidate multi-violates", async () => {
    const root = tempRoot("precedence");
    const marker = join(root, "evaluated.txt");

    // hostApi + unknown capability → host-api checked first.
    const hostApiWins = writePackage({
      root,
      name: "a-hostapi-and-unknown",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.prec.hostapi",
        entrypoint: "./plugin.js",
        hostApi: "^99.0.0",
        capabilities: Object.freeze([
          "test.sceneaxi.fixture.capability.never-registered",
        ]),
      }),
      entrypointSource: sentinelSource(
        marker,
        "export const capabilities = Object.freeze({});",
      ),
    });

    // unknown capability + forbidden import → descriptor phase wins.
    const unknownWins = writePackage({
      root,
      name: "b-unknown-and-forbidden",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.prec.unknown",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([
          "test.sceneaxi.fixture.capability.never-registered",
        ]),
      }),
      entrypointSource: sentinelSource(
        marker,
        'import "@sceneaxi/engine-kernel";\nexport const capabilities = Object.freeze({});',
      ),
    });

    // malformed descriptor + would-be hostApi mismatch → parse wins.
    const invalidWins = writePackage({
      root,
      name: "c-invalid-json",
      manifestJson: '{"schemaVersion":"1.0.0", hostApi: not-json}',
      entrypointSource: sentinelSource(
        marker,
        "export const capabilities = Object.freeze({});",
      ),
      entrypointRel: "plugin.js",
    });

    const result = await openPluginHost({ registry: testOnlyRegistry() }).load([
      hostApiWins,
      unknownWins,
      invalidWins,
    ]);

    expect(result.loaded).toEqual([]);
    expect(existsSync(marker)).toBe(false);

    // Refuse listings sort by locator; assert by pluginId / locator content.
    expect(
      result.refused.find((r) => r.locator === hostApiWins)?.reason,
    ).toBe("host-api-incompatible");
    expect(
      result.refused.find((r) => r.locator === unknownWins)?.reason,
    ).toBe("unknown-capability");
    expect(
      result.refused.find((r) => r.locator === invalidWins)?.reason,
    ).toBe("descriptor-invalid");
  });

  it("one refused candidate exposes nothing while unrelated valids stay deterministic", async () => {
    const root = tempRoot("partial-isolation");
    const badMarker = join(root, "bad-evaluated.txt");
    const goodMarker = join(root, "good-evaluated.txt");
    const registry = testOnlyRegistry();

    const validA = writePackage({
      root,
      name: "z-valid-a",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.valid.a",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([TEST_ONLY_CAPABILITY_ID]),
      }),
      entrypointSource: sentinelSource(
        goodMarker,
        `export const capabilities = Object.freeze({ ${JSON.stringify(TEST_ONLY_CAPABILITY_ID)}: { who: "a" } });`,
      ),
      packageJson: {
        dependencies: { "@sceneaxi/schemas": "workspace:^" },
      },
    });
    const refused = writePackage({
      root,
      name: "m-refused",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.refused.partial",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([TEST_ONLY_CAPABILITY_ID]),
      }),
      entrypointSource: sentinelSource(
        badMarker,
        `import "@sceneaxi/engine-kernel";
export const capabilities = Object.freeze({ ${JSON.stringify(TEST_ONLY_CAPABILITY_ID)}: { secret: true } });`,
      ),
    });
    const validB = writePackage({
      root,
      name: "a-valid-b",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.valid.b",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });

    const host = openPluginHost({ registry });
    const result = await host.load([refused, validA, validB]);

    expect(result.loaded.map((p) => p.pluginId)).toEqual([
      "dev.sceneaxi.fixture.valid.a",
      "dev.sceneaxi.fixture.valid.b",
    ]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.reason).toBe("forbidden-sceneaxi-import");
    expect(result.refused[0]?.entrypointEvaluated).toBe(false);
    expect(existsSync(badMarker)).toBe(false);

    expect(
      host.getImplementation(
        "dev.sceneaxi.fixture.refused.partial",
        TEST_ONLY_CAPABILITY_ID,
      ).ok,
    ).toBe(false);

    const a = host.getImplementation(
      "dev.sceneaxi.fixture.valid.a",
      TEST_ONLY_CAPABILITY_ID,
    );
    expect(a.ok).toBe(true);
    if (a.ok) {
      expect(a.implementation).toEqual({ who: "a" });
    }
  });

  it("post-evaluation integrity mismatch may execute entrypoint but exposes nothing", async () => {
    const root = tempRoot("integrity-expose");
    const undeclaredMarker = join(root, "undeclared.txt");
    const missingMarker = join(root, "missing.txt");
    const registry = testOnlyRegistry();

    const undeclared = writePackage({
      root,
      name: "undeclared",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.integrity.undeclared",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: sentinelSource(
        undeclaredMarker,
        `export const capabilities = Object.freeze({ ${JSON.stringify(TEST_ONLY_CAPABILITY_ID)}: { leak: true } });`,
      ),
    });
    const missingDeclared = writePackage({
      root,
      name: "missing-declared",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.integrity.missing",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([TEST_ONLY_CAPABILITY_ID]),
      }),
      entrypointSource: sentinelSource(
        missingMarker,
        "export const capabilities = Object.freeze({});",
      ),
      packageJson: {
        dependencies: { "@sceneaxi/schemas": "workspace:^" },
      },
    });

    const host = openPluginHost({ registry });
    const result = await host.load([undeclared, missingDeclared]);

    expect(existsSync(undeclaredMarker)).toBe(true);
    expect(existsSync(missingMarker)).toBe(true);
    expect(result.loaded).toEqual([]);
    expect(
      result.refused.every(
        (r) =>
          r.reason === "implementation-table-mismatch" &&
          r.phase === "integrity" &&
          r.entrypointEvaluated,
      ),
    ).toBe(true);

    for (const pluginId of [
      "dev.sceneaxi.fixture.integrity.undeclared",
      "dev.sceneaxi.fixture.integrity.missing",
    ]) {
      const hit = host.getImplementation(pluginId, TEST_ONLY_CAPABILITY_ID);
      expect(hit.ok).toBe(false);
      if (!hit.ok) {
        expect(hit.reason).toBe("plugin-not-loaded");
      }
    }
  });

  it("reversing and shuffling locators yields the same normalized report and list order", async () => {
    const root = tempRoot("order");
    const registry = testOnlyRegistry();

    const inert = writePackage({
      root,
      name: "m-inert",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.order.inert",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });
    const provider = writePackage({
      root,
      name: "a-provider",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.order.provider",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([TEST_ONLY_CAPABILITY_ID]),
      }),
      entrypointSource: `
export const capabilities = Object.freeze({
  ${JSON.stringify(TEST_ONLY_CAPABILITY_ID)}: { n: 1 },
});
`,
      packageJson: {
        dependencies: { "@sceneaxi/schemas": "workspace:^" },
      },
    });
    const refused = writePackage({
      root,
      name: "z-refused",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.order.refused",
        entrypoint: "./plugin.js",
        hostApi: "^99.0.0",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });

    const orders = [
      [inert, provider, refused],
      [refused, provider, inert],
      [provider, refused, inert],
      [refused, inert, provider],
    ] as const;

    const reports = [];
    for (const locators of orders) {
      const host = openPluginHost({ registry });
      const result = await host.load([...locators]);
      const listing = host.list();
      reports.push({
        report: normalizeReport(result),
        listLoaded: listing.loaded.map((p) => p.pluginId),
        listRefused: listing.refused.map((r) => r.reason),
        listRefusedLocators: listing.refused.map((r) => r.locator),
      });
    }

    for (let i = 1; i < reports.length; i++) {
      expect(reports[i]).toEqual(reports[0]);
    }
    expect(reports[0]?.listLoaded).toEqual([
      "dev.sceneaxi.fixture.order.inert",
      "dev.sceneaxi.fixture.order.provider",
    ]);
    expect(reports[0]?.listRefused).toEqual(["host-api-incompatible"]);
  });

  it("two plugins implementing one test-only capability remain separately addressable", async () => {
    const root = tempRoot("multi-provider");
    const registry = testOnlyRegistry();
    const a = writePackage({
      root,
      name: "provider-b",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.provider.b",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([TEST_ONLY_CAPABILITY_ID]),
      }),
      entrypointSource: `
export const capabilities = Object.freeze({
  ${JSON.stringify(TEST_ONLY_CAPABILITY_ID)}: { provider: "b" },
});
`,
      packageJson: {
        dependencies: { "@sceneaxi/schemas": "workspace:^" },
      },
    });
    const b = writePackage({
      root,
      name: "provider-a",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.provider.a",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([TEST_ONLY_CAPABILITY_ID]),
      }),
      entrypointSource: `
export const capabilities = Object.freeze({
  ${JSON.stringify(TEST_ONLY_CAPABILITY_ID)}: { provider: "a" },
});
`,
      packageJson: {
        dependencies: { "@sceneaxi/schemas": "workspace:^" },
      },
    });

    const host = openPluginHost({ registry });
    const result = await host.load([a, b]);
    expect(result.refused).toEqual([]);
    expect(result.loaded.map((p) => p.pluginId)).toEqual([
      "dev.sceneaxi.fixture.provider.a",
      "dev.sceneaxi.fixture.provider.b",
    ]);

    const implA = host.getImplementation(
      "dev.sceneaxi.fixture.provider.a",
      TEST_ONLY_CAPABILITY_ID,
    );
    const implB = host.getImplementation(
      "dev.sceneaxi.fixture.provider.b",
      TEST_ONLY_CAPABILITY_ID,
    );
    expect(implA.ok && implA.implementation).toEqual({ provider: "a" });
    expect(implB.ok && implB.implementation).toEqual({ provider: "b" });

    const miss = host.getImplementation(
      "dev.sceneaxi.fixture.provider.missing",
      TEST_ONLY_CAPABILITY_ID,
    );
    expect(miss.ok).toBe(false);
  });

  it("test-only capability IDs cannot appear in the public registry seed artifact", () => {
    const seedText = readFileSync(publicSeedPath, "utf8");
    expect(seedText).not.toContain(TEST_ONLY_CAPABILITY_ID);
    expect(seedText).not.toContain("test.sceneaxi.fixture");

    const seed = emptyPluginCapabilityRegistrySeed();
    expect(seed.entries).toEqual([]);
    expect(
      seed.entries.some((e) => e.capabilityId === TEST_ONLY_CAPABILITY_ID),
    ).toBe(false);

    // Host default registry remains the empty public seed.
    const host = openPluginHost();
    expect(host.registry.entries).toEqual([]);
    expect(JSON.stringify(host.registry)).not.toContain(TEST_ONLY_CAPABILITY_ID);
  });

  it("loads a valid inert manifest and lists it deterministically", async () => {
    const root = tempRoot("inert");
    const b = writePackage({
      root,
      name: "plugin-b",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.inert.b",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });
    const a = writePackage({
      root,
      name: "plugin-a",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.inert.a",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });

    const host = openPluginHost();
    const result = await host.load([b, a]);
    expect(result.refused).toEqual([]);
    expect(result.loaded.map((p) => p.pluginId)).toEqual([
      "dev.sceneaxi.fixture.inert.a",
      "dev.sceneaxi.fixture.inert.b",
    ]);
    expect(host.list().loaded.map((p) => p.pluginId)).toEqual([
      "dev.sceneaxi.fixture.inert.a",
      "dev.sceneaxi.fixture.inert.b",
    ]);
  });
});

/**
 * Captain integrated acceptance (#23): end-to-end #21 registry + #22 plugin-host.
 * Public schemas APIs validate seed/fixture registries; host load/list/refuse uses
 * only explicit locators; malformed/unauthorized refusals are deterministic and
 * expose no partial capabilities.
 */
describe("integrated acceptance: #21 registry + #22 plugin-host E2E", () => {
  it("binds the public empty seed (parsed via schemas) and refuses unauthorized claims safely", async () => {
    const seedText = readFileSync(publicSeedPath, "utf8");
    const parsed = parsePluginCapabilityRegistryText(seedText, {
      expectedRegistryVersion: PLUGIN_CAPABILITY_REGISTRY_VERSION,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.registry).toEqual(emptyPluginCapabilityRegistrySeed());
    expect(parsed.registry.entries).toEqual([]);

    // Typed lookup miss on the public seed — host must map this to unknown-capability.
    const lookupMiss = lookupPluginCapability(
      parsed.registry,
      TEST_ONLY_CAPABILITY_ID,
    );
    expect(lookupMiss).toEqual({
      ok: false,
      capabilityId: TEST_ONLY_CAPABILITY_ID,
      reason: "unknown-capability",
    });

    const root = tempRoot("e2e-seed");
    const badMarker = join(root, "unauthorized-evaluated.txt");
    const inert = writePackage({
      root,
      name: "z-inert",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.e2e.inert",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });
    const unauthorized = writePackage({
      root,
      name: "a-unauthorized",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.e2e.unauthorized",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([TEST_ONLY_CAPABILITY_ID]),
      }),
      entrypointSource: sentinelSource(
        badMarker,
        `export const capabilities = Object.freeze({
  ${JSON.stringify(TEST_ONLY_CAPABILITY_ID)}: { leak: true },
});`,
      ),
    });
    const malformed = writePackage({
      root,
      name: "m-malformed",
      manifestJson: "{ schemaVersion: not-json }",
      entrypointRel: "plugin.js",
      entrypointSource: sentinelSource(
        badMarker,
        "export const capabilities = Object.freeze({});",
      ),
    });

    const host = openPluginHost({ registry: parsed.registry });
    expect(host.registry).toEqual(emptyPluginCapabilityRegistrySeed());

    const result = await host.load([unauthorized, malformed, inert]);
    expect(result.loaded.map((p) => p.pluginId)).toEqual([
      "dev.sceneaxi.fixture.e2e.inert",
    ]);
    expect(normalizeReport(result).refused).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: "unknown-capability",
          phase: "descriptor",
          entrypointEvaluated: false,
          pluginId: "dev.sceneaxi.fixture.e2e.unauthorized",
          capabilityId: TEST_ONLY_CAPABILITY_ID,
        }),
        expect.objectContaining({
          reason: "descriptor-invalid",
          phase: "descriptor",
          entrypointEvaluated: false,
        }),
      ]),
    );
    expect(result.refused).toHaveLength(2);
    expect(existsSync(badMarker)).toBe(false);

    // No partial exposure of refused plugins.
    expect(
      host.getImplementation(
        "dev.sceneaxi.fixture.e2e.unauthorized",
        TEST_ONLY_CAPABILITY_ID,
      ).ok,
    ).toBe(false);
    expect(host.list().loaded.map((p) => p.pluginId)).toEqual([
      "dev.sceneaxi.fixture.e2e.inert",
    ]);
  });

  it("validates a test-only registry via schemas, loads providers, and keeps refusals deterministic", async () => {
    const registry = testOnlyRegistry();
    const hit = lookupPluginCapability(registry, TEST_ONLY_CAPABILITY_ID);
    expect(hit.ok).toBe(true);
    if (hit.ok) {
      expect(hit.entry.capabilityId).toBe(TEST_ONLY_CAPABILITY_ID);
      expect(hit.entry.owningPackage).toBe("@sceneaxi/schemas");
    }
    expect(
      lookupPluginCapability(
        registry,
        "test.sceneaxi.fixture.capability.never-registered",
      ).ok,
    ).toBe(false);

    // Seed artifact must remain empty / free of the test-only ID.
    const seedArtifact = parsePluginCapabilityRegistryText(
      readFileSync(publicSeedPath, "utf8"),
      { expectedRegistryVersion: PLUGIN_CAPABILITY_REGISTRY_VERSION },
    );
    expect(seedArtifact.ok).toBe(true);
    if (seedArtifact.ok) {
      expect(seedArtifact.registry.entries).toEqual([]);
      expect(
        lookupPluginCapability(seedArtifact.registry, TEST_ONLY_CAPABILITY_ID)
          .ok,
      ).toBe(false);
    }

    const root = tempRoot("e2e-registry");
    const refuseMarker = join(root, "refused-evaluated.txt");
    const integrityMarker = join(root, "integrity-evaluated.txt");

    const provider = writePackage({
      root,
      name: "provider",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.e2e.provider",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([TEST_ONLY_CAPABILITY_ID]),
      }),
      entrypointSource: `
export const capabilities = Object.freeze({
  ${JSON.stringify(TEST_ONLY_CAPABILITY_ID)}: { e2e: true },
});
`,
      packageJson: {
        dependencies: { "@sceneaxi/schemas": "workspace:^" },
      },
    });
    const inert = writePackage({
      root,
      name: "inert",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.e2e.inert2",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: emptyCapsEntrypoint,
    });
    const forbidden = writePackage({
      root,
      name: "forbidden",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.e2e.forbidden",
        entrypoint: "./plugin.js",
      }),
      entrypointSource: sentinelSource(
        refuseMarker,
        'import "@sceneaxi/engine-kernel";\nexport const capabilities = Object.freeze({});',
      ),
    });
    const integrityMismatch = writePackage({
      root,
      name: "integrity",
      manifest: baseManifest({
        pluginId: "dev.sceneaxi.fixture.e2e.integrity",
        entrypoint: "./plugin.js",
        capabilities: Object.freeze([TEST_ONLY_CAPABILITY_ID]),
      }),
      entrypointSource: sentinelSource(
        integrityMarker,
        // Declared capability missing from export table.
        "export const capabilities = Object.freeze({});",
      ),
      packageJson: {
        dependencies: { "@sceneaxi/schemas": "workspace:^" },
      },
    });
    const unsupported = writePackage({
      root,
      name: "unsupported-schema",
      manifest: {
        ...baseManifest({
          pluginId: "dev.sceneaxi.fixture.e2e.schema",
          entrypoint: "./plugin.js",
        }),
        schemaVersion: "2.0.0",
      },
      entrypointSource: sentinelSource(
        refuseMarker,
        "export const capabilities = Object.freeze({});",
      ),
    });

    const host = openPluginHost({ registry });
    const locatorsForward = [
      forbidden,
      integrityMismatch,
      provider,
      unsupported,
      inert,
    ];
    const locatorsReversed = [...locatorsForward].reverse();

    const first = await host.load(locatorsForward);
    const listFirst = host.list();
    const second = await openPluginHost({ registry }).load(locatorsReversed);

    expect(normalizeReport(first)).toEqual(normalizeReport(second));
    expect(listFirst.loaded.map((p) => p.pluginId)).toEqual([
      "dev.sceneaxi.fixture.e2e.inert2",
      "dev.sceneaxi.fixture.e2e.provider",
    ]);
    expect(
      first.refused.map((r) => r.reason).sort(),
    ).toEqual(
      [
        "forbidden-sceneaxi-import",
        "implementation-table-mismatch",
        "schema-version-unsupported",
      ].sort(),
    );

    // Pre-evaluation refusals never run; integrity may run and still expose nothing.
    expect(existsSync(refuseMarker)).toBe(false);
    expect(existsSync(integrityMarker)).toBe(true);

    const impl = host.getImplementation(
      "dev.sceneaxi.fixture.e2e.provider",
      TEST_ONLY_CAPABILITY_ID,
    );
    expect(impl.ok).toBe(true);
    if (impl.ok) {
      expect(impl.implementation).toEqual({ e2e: true });
    }

    for (const refusedId of [
      "dev.sceneaxi.fixture.e2e.forbidden",
      "dev.sceneaxi.fixture.e2e.integrity",
      "dev.sceneaxi.fixture.e2e.schema",
    ]) {
      const miss = host.getImplementation(refusedId, TEST_ONLY_CAPABILITY_ID);
      expect(miss.ok).toBe(false);
      if (!miss.ok) {
        expect(miss.reason).toBe("plugin-not-loaded");
      }
    }
  });
});

