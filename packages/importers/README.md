# @sceneaxi/importers

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
