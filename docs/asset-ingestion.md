# Contained GLB/glTF asset ingestion

The first normal creator asset journey is an offline, project-owned **copy** of
one contained glTF 2.0 asset. The authority is
`packages/importers/src/contained-gltf.ts`; desktop and CLI are adapters over it.
This is not the broader Asset Package/Catalog policy owned by
factories-helpers#47/#48.

## Accepted profile

The fixed profile id is `sceneaxi.gltf-contained-triangles-v1`. Input is one
`.glb` with one JSON and one BIN chunk, or one `.gltf` whose single buffer is an
embedded base64 data URI. It may contain triangle primitives with POSITION,
optional NORMAL, optional indices, node transforms, and metallic/roughness base
color material values. The limit is 8 MiB and 16 accepted assets per project.

External buffers, images, textures, animations, skins, cameras, extensions,
non-triangle modes, sparse/interleaved accessors, additional buffers/scenes, and
every format other than GLB/glTF are absent. No network fetch, archive expansion,
provider, credential, script execution, or general workspace reference semantics
exists on this path.

## Transaction and persistence

The native Linux dialog supplies an absolute local file path. Before a project
write, the importer validates the selected regular file, byte limit, extension
and magic/JSON, contained profile, source symlink refusal, project/document
containment, destination symlinks, identity replay/conflict, digest duplication,
and the existing composed scene. It computes `sha256:` provenance and stages one
typed E1 edit replacing `/data`. Change Review remains all-or-nothing.

The accepted manifest at `scene.json.data.assetManifest` owns the canonical
base64 bytes, byte length, media type, stable digest, importer/profile version,
derived artifact/instance identity, and `copy` policy. It contains no source path
and no credential. Reject writes neither document nor asset. Accept atomically
writes the Scene Document, then materializes `assets/<asset-id>.glb|gltf` from the
accepted canonical bytes with an exclusive temporary file and rename. A crash or
missing copy is recoverable on scene open/Play; conflicting target bytes refuse.

The composition carries a digest-bound Sculpt proxy so the existing scene and
kernel contracts remain unchanged. The desktop `MountableScene` additionally
projects the revalidated triangles, and the tier's one Three backend replaces
that proxy inside its existing scene root. This adds no importer authority,
project model, provider path, renderer, or protocol.

## Surfaces and evidence

- Linux: Web Experience's **Import GLB/glTF…** control invokes the native dialog,
  then the existing Change Review Save/Reject path.
- CLI: `sceneaxi asset import --source <path> --document scene.json --cwd
  <project> --out <proposal.json>`, followed by `sceneaxi project apply`.
- Behavioral refusal and manifest tests:
  `packages/importers/test/contained-gltf.test.ts`.
- Native cancel/selection adapter:
  `tests/desktop/desktop-asset-picker-host.test.ts`.
- Reject/accept/reopen/kernel/Three and desktop↔CLI byte parity:
  `tests/e2e/asset-ingestion-golden.test.ts` (part of `pnpm test:golden`).

There is no live provider/network behavior, production credential, Neon/Vercel/
Stripe LIVE use, Kids deployment, publication, Stage 1 proof, or deletion of any
unrelated temporary directory in this vertical.
