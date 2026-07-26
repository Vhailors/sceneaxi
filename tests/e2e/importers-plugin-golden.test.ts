/**
 * Importers + plugin-host demo golden path (sceneaxi#119).
 *
 * Both packages were real but invisible: `@sceneaxi/importers` had a working
 * external-content path no demo used, and `@sceneaxi/plugin-host` had never
 * been shown resolving a capability implementation. This drives both through a
 * path a product would actually take:
 *
 *   external content -> validate -> propose -> apply -> Product Manifest
 *   -> kernel session, with a capability-providing plugin loaded alongside.
 *
 * External content is checked-in fixture text under `fixtures/importers/`; no
 * network call happens here, and importing never bypasses review — every import
 * lands as an ordinary proposal with a unified diff.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createDocument,
  parseDocumentText,
  writeDocumentFile,
} from "../../packages/authoring-core/src/index.ts";
import {
  applySceneDocumentImport,
  proposeSceneDocumentImport,
} from "../../packages/importers/src/index.ts";
import { openPluginHost } from "../../packages/plugin-host/src/index.ts";
import {
  PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI,
  PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION,
  PLUGIN_CAPABILITY_REGISTRY_VERSION,
  validatePluginCapabilityRegistry,
  type PluginCapabilityRegistry,
} from "../../packages/schemas/src/index.ts";
import { conformance as gameProfile } from "@sceneaxi/profile-game";
import { productManifestFrom } from "./fixtures/golden-project.ts";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const IMPORTER_FIXTURES = join(REPO_ROOT, "tests/e2e/fixtures/importers");
const PLUGIN_FIXTURES = join(REPO_ROOT, "tests/e2e/fixtures/plugin-host");

const TARGET_PATH = "imported-project.sceneaxi.json";
const DEMO_CAPABILITY_ID = "test.sceneaxi.fixture.capability.golden-demo";
const CAPABILITY_PLUGIN_ID = "dev.sceneaxi.sample.capability";
const INERT_PLUGIN_ID = "dev.sceneaxi.sample.inert";
const ILLEGAL_PLUGIN_ID = "dev.sceneaxi.sample.illegal-claim";

function externalText(name: string): string {
  return readFileSync(join(IMPORTER_FIXTURES, name), "utf8");
}

/** A target document the import replaces `/data` on. */
function seedTarget(cwd: string): void {
  const written = writeDocumentFile(
    TARGET_PATH,
    createDocument({
      id: "imported-project",
      title: "Import target",
      data: { productManifest: { productId: "placeholder", seed: 0, entities: [] } },
    }),
    { cwd },
  );
  expect(written.ok).toBe(true);
}

/**
 * Test-only capability registry. The public v1 seed stays empty; this proves the
 * lookup path without registering a fixture ID in the shipped registry.
 */
function demoRegistry(): PluginCapabilityRegistry {
  const validated = validatePluginCapabilityRegistry(
    {
      $schema: PLUGIN_CAPABILITY_REGISTRY_SCHEMA_URI,
      schemaVersion: PLUGIN_CAPABILITY_REGISTRY_SCHEMA_VERSION,
      registryVersion: PLUGIN_CAPABILITY_REGISTRY_VERSION,
      entries: [
        {
          capabilityId: DEMO_CAPABILITY_ID,
          contractRef: "@sceneaxi/schemas",
          contractVersion: "1.0.0",
          owningPackage: "@sceneaxi/schemas",
          documentationRef: "docs/plugins.md",
        },
      ],
    },
    { expectedRegistryVersion: PLUGIN_CAPABILITY_REGISTRY_VERSION },
  );
  if (!validated.ok) {
    throw new Error(
      `demo registry fixture failed validation: ${validated.diagnostics[0]?.message ?? "unknown"}`,
    );
  }
  return validated.registry;
}

describe("importers golden demo", () => {
  it("imports external content and feeds it to a runnable kernel session", () => {
    const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-importers-golden-"));
    try {
      seedTarget(cwd);

      // Planning is review-first: it produces a diff and writes nothing.
      const before = readFileSync(join(cwd, TARGET_PATH), "utf8");
      const planned = proposeSceneDocumentImport({
        sourceText: externalText("external-workshop.sceneaxi.json"),
        targetDocumentPath: TARGET_PATH,
        cwd,
      });
      expect(planned.ok).toBe(true);
      if (!planned.ok) return;
      expect(planned.unifiedDiff).toContain("imported-workshop");
      expect(readFileSync(join(cwd, TARGET_PATH), "utf8")).toBe(before);

      const applied = applySceneDocumentImport({
        sourceText: externalText("external-workshop.sceneaxi.json"),
        targetDocumentPath: TARGET_PATH,
        cwd,
      });
      expect(applied.ok).toBe(true);
      if (!applied.ok) return;

      // Target identity stays local: only `/data` came from outside.
      const reopened = parseDocumentText(
        readFileSync(join(cwd, TARGET_PATH), "utf8"),
      );
      expect(reopened.ok).toBe(true);
      if (!reopened.ok) return;
      expect(reopened.document.id).toBe("imported-project");
      expect(reopened.document.title).toBe("Import target");

      // The imported data is a real Product Manifest, so it opens.
      const manifest = productManifestFrom(
        reopened.document.data["productManifest"],
      );
      expect(manifest.productId).toBe("imported-workshop");
      expect(manifest.entities).toHaveLength(2);

      const host = { nowMs: () => 1_753_334_400_000 };
      const session = gameProfile.core.kernel.open(manifest, host);
      session.dispatch({ type: "move", actor: "hero", axis: [1, 1] });
      session.advance({ tick: 1, deltaMs: 16 });
      const terminal = session.observe();
      expect(terminal.entities).toContainEqual({ id: "hero", x: 3, y: 4 });

      // Replay of the imported session reproduces the same snapshot.
      expect(gameProfile.core.kernel.replay(session.save(), host).observe()).toEqual(
        terminal,
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("refuses unsupported, ambiguous, and malformed external content", () => {
    const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-importers-refuse-"));
    try {
      seedTarget(cwd);
      const before = readFileSync(join(cwd, TARGET_PATH), "utf8");

      const cases = [
        {
          label: "future schema major",
          sourceText: externalText("unsupported-major.sceneaxi.json"),
          code: "schema-major-mismatch",
        },
        {
          label: "duplicate JSON member",
          sourceText: externalText("duplicate-member.sceneaxi.json"),
          code: "parse-error",
        },
        {
          label: "not JSON at all",
          sourceText: "{ this is not json",
          code: "parse-error",
        },
        {
          label: "JSON but not a document",
          sourceText: '{"schemaVersion":1}',
          code: "invalid-document",
        },
      ] as const;

      for (const testCase of cases) {
        const result = applySceneDocumentImport({
          sourceText: testCase.sourceText,
          targetDocumentPath: TARGET_PATH,
          cwd,
        });
        expect(result.ok, testCase.label).toBe(false);
        if (result.ok) continue;
        // Refused at validation, so nothing ever reached propose or apply.
        expect(result.stage, testCase.label).toBe("validate");
        if (result.stage !== "validate") continue;
        expect(result.diagnostics[0]?.code, testCase.label).toBe(testCase.code);
      }

      // Every refusal left the target untouched.
      expect(readFileSync(join(cwd, TARGET_PATH), "utf8")).toBe(before);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("plugin-host golden demo", () => {
  it("loads a capability-providing plugin and resolves its implementation", async () => {
    const host = openPluginHost({ registry: demoRegistry() });
    const result = await host.load([
      join(PLUGIN_FIXTURES, "sample-capability"),
      join(PLUGIN_FIXTURES, "sample-inert"),
    ]);

    expect(result.refused).toEqual([]);
    expect(result.loaded.map((plugin) => plugin.pluginId).sort()).toEqual(
      [CAPABILITY_PLUGIN_ID, INERT_PLUGIN_ID].sort(),
    );

    // Capability lookup HIT — addressed explicitly by (pluginId, capabilityId).
    const hit = host.getImplementation(CAPABILITY_PLUGIN_ID, DEMO_CAPABILITY_ID);
    expect(hit.ok).toBe(true);

    // MISS — the inert plugin declares nothing, so the host refuses rather
    // than silently falling through to the other provider.
    const miss = host.getImplementation(INERT_PLUGIN_ID, DEMO_CAPABILITY_ID);
    expect(miss.ok).toBe(false);

    // MISS — unknown plugin.
    expect(
      host.getImplementation("dev.sceneaxi.not.loaded", DEMO_CAPABILITY_ID).ok,
    ).toBe(false);
  });

  it("refuses a manifest claiming a capability the registry does not define", async () => {
    const host = openPluginHost({ registry: demoRegistry() });
    const result = await host.load([join(PLUGIN_FIXTURES, "illegal-claim")]);

    expect(result.loaded).toEqual([]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.pluginId).toBe(ILLEGAL_PLUGIN_ID);
  });

  it("refuses the capability plugin under the shipped registry", async () => {
    // The shipped seed never carries a fixture ID, so the same plugin that
    // loads above must refuse here. This is what keeps the fixture registry
    // honest: it proves the hit came from a registered ID, not a weak check.
    const host = openPluginHost();
    const result = await host.load([join(PLUGIN_FIXTURES, "sample-capability")]);

    expect(
      host.registry.entries.some(
        (entry) => entry.capabilityId === DEMO_CAPABILITY_ID,
      ),
    ).toBe(false);
    expect(result.loaded).toEqual([]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.pluginId).toBe(CAPABILITY_PLUGIN_ID);
  });
});
