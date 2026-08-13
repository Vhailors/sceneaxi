# First-class contained asset pipeline

The project-owned asset authority is
`packages/importers/src/contained-gltf.ts`; its name is retained for source and
public-export compatibility with the original GLB/glTF slice. Desktop, CLI,
assistant inspection, Play, and static Web packaging consume the same validated
`ProjectAssetManifestEntry`. This is not the Asset Package/Catalog policy owned
by factories-helpers#47/#48 and it adds no provider or package manager.

## Manifest v2 and admitted profiles

`scene.json.data.assetManifest` uses the contract at
`packages/schemas/contracts/project-asset-manifest.schema.json`. Every entry has
a stable `assetId`, project-relative copy path, exact media type and byte length,
SHA-256 digest, canonical base64 bytes, family/profile, explicit `game` + `web`
support, byte-derived validation and preview metadata, provenance, and copy
policy. Model entries additionally retain their existing stable
artifact/instance identities; other families carry `null` because importing an
image, sound, font, or animation-data file does not invent a scene instance.
Legacy manifest v1 GLB/glTF entries reopen through a strict compatibility
normalization and become v2 on the next reviewed asset mutation.

The bounded families are:

| Family | Admitted profile |
|---|---|
| SceneAxi | validated Scene Document, Sculpt Intake, Sculpt Artifact, or Composed Scene JSON |
| Model | `sceneaxi.gltf-contained-triangles-v1`: contained GLB or embedded-buffer glTF 2.0 |
| Image | PNG, JPEG, or VP8X WebP with validated headers and bounded dimensions |
| Audio | bounded WAV, Ogg, or MP3 container metadata |
| Font | WOFF2, WOFF, TTF, or OTF with bounded table metadata |
| Animation data | `sceneaxi.animation-data` schema v1 metadata; no timeline authoring or runtime evaluator |

Each file is at most 8 MiB and a project retains at most 16 entries. The glTF
triangle/accessor limits remain unchanged. SVG, HTML, JavaScript, unknown JSON,
archives, external glTF buffers, and unsupported codecs refuse by name. Preview
records are recomputed from validated bytes and contain primitive metadata only;
stored markup or untrusted code is never interpreted or executed.

## Review, copies, and hot reload

Before proposal or journal creation the importer checks the source is an
absolute regular non-symlink file, project/document containment, canonical
destination containment, byte limits, family-specific structure, duplicate
identity/content/path, and the current composed scene. Reject and every refusal
leave both project and journal bytes untouched.

Import stages one `/data` E1 proposal. Approval atomically commits the Scene
Document through the existing authoring journal, then materializes the exact
accepted bytes under `assets/<asset-id>.<profile-extension>`. Missing copies are
recoverable from the accepted manifest. A conflicting copy refuses.

Hot reload is the explicit one-shot `asset reload` command (or desktop bridge
`asset-import` with `hotReload: true`). The caller supplies the stable asset id
and a newly selected source file; no ambient source path is persisted. An
unchanged digest, missing or changed accepted copy, family/media-profile change,
duplicate content, or unsafe path refuses by name. A changed digest stages a
normal review whose entry binds `validation.replacesDigest`; saved document and
copy bytes remain unchanged until approval. After approval, materialization may
atomically replace only the copy whose digest equals that exact predecessor.
Source rename therefore changes descriptive provenance only: references keep
the stable id, contained path, and model composition identities.

## Consumers and evidence

- CLI: `sceneaxi asset import … --out import.json`, `sceneaxi asset reload …
  --asset-id <id> --out reload.json`, then `sceneaxi project apply`.
- Desktop: the Game/Web native picker accepts all listed formats and stages the
  same review; Kids refuses before source or project reads.
- Browser: lists family, validation, preview, provenance, and stable identity
  from the manifest entry.
- Assistant inspection: formats read-only metadata from that entry and omits
  canonical bytes.
- Play: consumes model entries only, retaining the original canonical glTF
  projection and byte parity; non-model assets do not fabricate scene nodes.
- Export Web: verifies and packages every admitted entry by its manifest media
  type, length, digest, and project-contained path.

Focused compatibility/refusal tests remain in
`packages/importers/test/contained-gltf.test.ts`. The all-family fixtures,
preview/browser/assistant parity, CLI reload, and approval boundary are in
`tests/e2e/asset-pipeline-golden.test.ts`; the original GLB/glTF
Reject/accept/Play/Three/CLI parity remains in
`tests/e2e/asset-ingestion-golden.test.ts`.

This slice adds no hierarchy, input map, Play lifecycle, animation authoring,
physics, provider, assistant mutation contract, package manager, build target,
auth/billing, deployment, publication, Kids activation, or Stage 1 proof. The
known Electron 43.2.0 host limitation is unchanged.
