# @sceneaxi/importers

The first external-content adapter (sceneaxi#47) accepts one full,
text-canonical SceneAxi document as recorded JSON, validates it with the public
Core document parser, and proposes replacement of an existing target document's
`/data` content through `@sceneaxi/authoring-core`. The caller can review its
unified diff before applying the same proposal through the shared service.

The adapter fails closed on parse/schema mismatch and multi-document input. It
preserves the target's local identity and has no direct engine access, binary
asset compiler, CMS, or multi-format registry.

The second adapter is the deliberately narrow offline profile
`sceneaxi.gltf-contained-triangles-v1`: contained GLB or embedded-buffer glTF 2.0
triangles only. It validates before writes, creates a digest/provenance manifest
with canonical bytes, and proposes `/data` through the same E1 service. Accepted
copies are materialized under the selected project's `assets/` directory and can
be recovered from that manifest. The exact profile, refusal boundaries, and
evidence are in [`docs/asset-ingestion.md`](../../docs/asset-ingestion.md).
