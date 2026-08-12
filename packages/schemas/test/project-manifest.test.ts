import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PROJECT_MANIFEST_DIAGNOSTICS,
  PROJECT_MANIFEST_PATH,
  contracts,
  createDocument,
  createProjectManifest,
  deterministicProjectAssetId,
  deterministicProjectObjectId,
  parseProjectManifestText,
  serializeProjectManifest,
  validateProjectManifest,
} from "@sceneaxi/schemas";

describe("native project manifest contract", () => {
  it("ships the schema and derives stable path-independent object and asset identities", () => {
    const schema = JSON.parse(readFileSync(
      new URL(`../${contracts.projectManifest}`, import.meta.url),
      "utf8",
    )) as { $id: string };
    expect(schema.$id).toBe("https://sceneaxi.invalid/contracts/project-manifest/v1");

    const document = createDocument({ id: "world", data: {} });
    const manifest = createProjectManifest({
      document,
      assets: [{
        sourceId: "crate",
        path: "assets/crate.glb",
        mediaType: "model/gltf-binary",
        digest: `sha256:${"a".repeat(64)}`,
      }],
    });
    expect(manifest.objects[0]?.id).toBe(
      deterministicProjectObjectId(manifest.projectId, "world"),
    );
    expect(manifest.assets[0]?.id).toBe(
      deterministicProjectAssetId(manifest.projectId, "crate"),
    );
    expect(parseProjectManifestText(serializeProjectManifest(manifest))).toEqual({
      ok: true,
      manifest,
    });
    expect(PROJECT_MANIFEST_PATH).toBe("sceneaxi.project.json");
  });

  it("refuses unknown majors, duplicate identities, undeclared capabilities, traversal, and invalid chains", () => {
    const manifest = createProjectManifest({ document: createDocument({ id: "world" }) });
    expect(validateProjectManifest({
      ...manifest,
      formatVersion: { major: 2, minor: 0 },
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.versionUnsupported },
    });
    expect(validateProjectManifest({
      ...manifest,
      capabilities: [...manifest.capabilities, manifest.capabilities[0]],
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.identityDuplicate },
    });
    expect(validateProjectManifest({
      ...manifest,
      capabilities: [{ id: "network.unreviewed", version: 1 }],
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.capabilityUndeclared },
    });
    const assetManifest = createProjectManifest({
      document: createDocument({ id: "world" }),
      assets: [{
        sourceId: "crate",
        path: "assets/crate.glb",
        mediaType: "model/gltf-binary",
        digest: `sha256:${"a".repeat(64)}`,
      }],
    });
    expect(validateProjectManifest({
      ...assetManifest,
      assets: [{ ...assetManifest.assets[0], path: "assets/../escape.glb" }],
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.pathTraversal },
    });
    expect(validateProjectManifest({
      ...manifest,
      migrations: [{
        id: "legacy-contained-v0-to-native-v1",
        fromVersion: { major: 1, minor: 0 },
        toVersion: { major: 1, minor: 0 },
        sourceDigest: `sha256:${"b".repeat(64)}`,
      }],
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.migrationChainInvalid },
    });
  });
});
