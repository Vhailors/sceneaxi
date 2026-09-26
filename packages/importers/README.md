# @sceneaxi/importers

## Purpose

Imports text-canonical SceneAxi documents and bounded project assets through the authoring-core proposal and apply service. The importer has no direct engine access.

## Public exports

`src/index.ts` exports the package `seam`, document-import planning and apply functions and result types, and project-asset and contained GLB/glTF import functions, profiles, limits, manifest types, and refusal data.

## Refusals

Document imports refuse invalid or ambiguous JSON, schema mismatches, and unsupported multi-document input. Asset imports validate bounded formats before writes. Hot reload creates a reviewable proposal and writes no saved bytes before approval. The importer does not provide a binary asset compiler, CMS, or multi-format registry.

## Ownership and tests

The contained GLB/glTF profile is owned by [`docs/asset-ingestion.md`](../../docs/asset-ingestion.md). Repository rules are in [`AGENTS.md`](../../AGENTS.md), and package ownership is mapped in [`docs/agents/layout.md`](../../docs/agents/layout.md). Tests include `packages/importers/test/` and the asset-ingestion and asset-pipeline end-to-end goldens in `tests/e2e/`.

The first external-content adapter (sceneaxi#47) accepts one full,
text-canonical SceneAxi document as recorded JSON, validates it with the public
Core document parser, and proposes replacement of an existing target document's
`/data` content through `@sceneaxi/authoring-core`. The caller can review its
unified diff before applying the same proposal through the shared service.

The adapter fails closed on parse/schema mismatch and multi-document input. It
preserves the target's local identity and has no direct engine access, binary
asset compiler, CMS, or multi-format registry.

The project-asset adapter admits bounded SceneAxi JSON artifacts, contained
GLB/glTF, common raster images, audio, fonts, and animation-data metadata into
one v2 digest/provenance/preview manifest. It validates before writes and stages
`/data` through the same E1 service. Accepted copies materialize under the
selected project's `assets/` directory; explicit hot reload stages a digest
replacement against the stable asset identity and writes no saved byte before
approval. The original `sceneaxi.gltf-contained-triangles-v1` geometry and
canonical-byte behavior remain the model profile. Exact formats, refusals, and
evidence are in [`docs/asset-ingestion.md`](../../docs/asset-ingestion.md).
