import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { stageProjectAssetImport, projectAssetManifestFromDocumentData, projectAssetManifestEntry, materializeProjectAssetCopies, proposeProjectAssetImport, CONTAINED_GLTF_REFUSALS } from "@sceneaxi/importers";
import { apply, composeScene, reconstructSculpt } from "@sceneaxi/authoring-core";

// Immutable original v1 wire shape (16f312/62e84): no v2 family, preview or validation.
const source = Buffer.from(JSON.stringify({ asset: { version: "2.0" }, buffers: [{ byteLength: 36, uri: "data:application/octet-stream;base64,AACAvwAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA" }], bufferViews: [{ buffer: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3" }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 }));

const digest = "sha256:" + createHash("sha256").update(source).digest("hex");

const entry = { assetId: "legacy", sourceName: "original.gltf", relativePath: "assets/legacy.gltf", mediaType: "model/gltf+json", byteLength: source.length, digest, canonicalBytesBase64: source.toString("base64"), copyPolicy: "copy", profile: "sceneaxi.gltf-contained-triangles-v1", artifactId: "legacy-asset-artifact", instanceId: "legacy-instance", provenance: { importer: "@sceneaxi/importers", importerVersion: 1, sourceDigest: digest, formatVersion: "2.0", contained: true } };

function legacyData() {
    const staged = stageProjectAssetImport({ sourceName: "original.gltf", sourceBytes: source, documentPath: "scene.json", expectedContentHash: "sha256:" + "0".repeat(64), documentData: seedData(), assetId: "legacy" });

    if (!staged.ok || !staged.edit)
        throw Error("fixture admission: " + JSON.stringify(staged));

    return { ...staged.edit.newValue, assetManifest: { schemaVersion: 1, kind: "sceneaxi.project-asset-manifest", assets: [entry] } };
}

it("admits original v1 manifest into v2 interface without changing canonical bytes or identities", () => {
    const data = legacyData(), before = JSON.stringify(data);
    const parsed = projectAssetManifestFromDocumentData(data);
    expect(parsed.ok).toBe(true);

    if (!parsed.ok)
        throw Error(parsed.message);
    expect(parsed.value.schemaVersion).toBe(2);
    expect(parsed.value.assets[0]).toMatchObject({ family: "model", assetId: "legacy", artifactId: "legacy-asset-artifact", instanceId: "legacy-instance", canonicalBytesBase64: entry.canonicalBytesBase64, digest });
    expect(JSON.stringify(data)).toBe(before);
    const asset = parsed.value.assets[0];

    if (!asset)
        throw Error("entry");
    const projection = projectAssetManifestEntry(asset);
    expect(projection).toMatchObject({ ok: true, value: { meshes: [{ positions: [-1, 0, 0, 1, 0, 0, 0, 1, 0] }] } });
    const replay = stageProjectAssetImport({ sourceName: "renamed.gltf", sourceBytes: source, documentPath: "scene.json", expectedContentHash: "sha256:" + "0".repeat(64), documentData: data, assetId: "legacy", hotReload: false });
    expect(replay).toMatchObject({ ok: true, replayed: true, hotReload: false, edit: null });
    expect(stageProjectAssetImport({ sourceName: "renamed.gltf", sourceBytes: source, documentPath: "scene.json", expectedContentHash: "sha256:" + "0".repeat(64), documentData: data, assetId: "legacy", hotReload: true })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.sourceUnchanged });
});

it("materializes original v1 bytes and stable reload migrates only after real public E1 approval", () => {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-v1-"));

    try {
        const data = legacyData();
        writeFileSync(join(root, "scene.json"), JSON.stringify({ schemaVersion: 1, kind: "sceneaxi.document", id: "legacy-scene", data }) + "\n");
        expect(materializeProjectAssetCopies({ projectRoot: root, documentPath: "scene.json" })).toMatchObject({ ok: true });
        expect(readFileSync(join(root, entry.relativePath))).toEqual(source);
        const before = readFileSync(join(root, "scene.json"));
        const changed = JSON.parse(source.toString());
        changed.nodes[0].translation = [2, 0, 0];
        const updated = Buffer.from(JSON.stringify(changed));
        writeFileSync(join(root, "renamed.gltf"), updated);
        const reload = proposeProjectAssetImport({ projectRoot: root, documentPath: "scene.json", sourcePath: join(root, "renamed.gltf"), assetId: "legacy", hotReload: true });
        expect(reload).toMatchObject({ ok: true, hotReload: true, entry: { assetId: "legacy", relativePath: entry.relativePath, artifactId: entry.artifactId, instanceId: entry.instanceId, validation: { replacesDigest: digest } } });
        expect(readFileSync(join(root, "scene.json"))).toEqual(before);
        expect(readFileSync(join(root, entry.relativePath))).toEqual(source);

        if (!reload.ok || !reload.proposal)
            throw Error("reload");
        expect(apply({ cwd: root, proposal: reload.proposal })).toMatchObject({ ok: true });
        expect(materializeProjectAssetCopies({ projectRoot: root, documentPath: "scene.json" })).toMatchObject({ ok: true });
        expect(readFileSync(join(root, entry.relativePath))).toEqual(updated);
        const accepted = JSON.parse(readFileSync(join(root, "scene.json"), "utf8"));
        expect(accepted.data.assetManifest.schemaVersion).toBe(2);
        expect(accepted.data.assetManifest.assets[0].canonicalBytesBase64).toBe(updated.toString("base64"));
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});

it("v1 wrong digests, duplicates, unknown version, traversal, wrong identity and dangling aliases refuse", () => {
    const data = legacyData();

    for (const patch of [{ digest: "sha256:" + "0".repeat(64) }, { relativePath: "../legacy.gltf" }, { artifactId: "other" }, { canonicalBytesBase64: "AQ==" }])
        expect(projectAssetManifestFromDocumentData({ ...data, assetManifest: { ...data.assetManifest, assets: [{ ...entry, ...patch }] } })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.manifestInvalid });
    expect(projectAssetManifestFromDocumentData({ ...data, assetManifest: { ...data.assetManifest, assets: [entry, entry] } })).toMatchObject({ ok: false });
    expect(projectAssetManifestFromDocumentData({ ...data, assetManifest: { ...data.assetManifest, schemaVersion: 999 } })).toMatchObject({ ok: false });
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-v1-link-"));

    try {
        writeFileSync(join(root, "scene.json"), JSON.stringify({ schemaVersion: 1, kind: "sceneaxi.document", id: "legacy-scene", data }));
        symlinkSync(join(root, "absent"), join(root, "assets"));
        expect(materializeProjectAssetCopies({ projectRoot: root, documentPath: "scene.json" })).toMatchObject({ ok: false, reason: CONTAINED_GLTF_REFUSALS.destinationSymlink });
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});

it("public boundary keeps unknown input and refuses non-JSON values rather than narrowing old contract", () => {
    const unknownData: unknown = undefined;
    expect(projectAssetManifestFromDocumentData(unknownData)).toMatchObject({ ok: false });
    expect(projectAssetManifestFromDocumentData(42)).toMatchObject({ ok: false });
});

function seedData() {
    const artifact = reconstructSculpt({ schemaVersion: 1, kind: "sceneaxi.sculpt-intake", intakeId: "v1-base", mode: "structured-spec", structuredSpec: { schemaVersion: 1, kind: "sceneaxi.object-sculpt-spec", id: "base-spec", rootNodeId: "base-node", components: [{ id: "base-box", primitive: "box", dimensions: [2, 1, 1], materialId: "base-material" }], materials: [{ id: "base-material", baseColor: "#999999", metallic: 0, roughness: 1 }], sockets: [], hierarchy: [{ id: "base-node", parentId: null, componentId: "base-box", transform: { translation: [0, 0, 0], rotationEulerDegrees: [0, 0, 0], scale: [1, 1, 1] } }] } });

    if (!artifact.ok)
        throw Error(artifact.message);
    const scene = composeScene({ schemaVersion: 1, kind: "sceneaxi.scene-composition-intake", sceneId: "v1-base-scene", rootInstanceId: "base-root", placements: [{ instanceId: "base-root", artifactId: artifact.artifact.artifactId, parentInstanceId: null, transform: { translation: [0, 0, 0], rotationEulerDegrees: [0, 0, 0], scale: [1, 1, 1] } }, { instanceId: "base-child", artifactId: artifact.artifact.artifactId, parentInstanceId: "base-root", transform: { translation: [3, 0, 0], rotationEulerDegrees: [0, 0, 0], scale: [1, 1, 1] } }] }, [artifact.artifact]);

    if (!scene.ok)
        throw Error(scene.message);

    return scene.document.data;
}
