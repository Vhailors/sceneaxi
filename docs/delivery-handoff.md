# Delivery Handoff Contract

The SceneAxi Delivery Handoff is a public, versioned manifest for transferring a
portable product export to an independent delivery adapter. The contract is
owned by SceneAxi core and is usable by internal tooling, external consumers,
store adapters, and CI systems without a dependency on any factory or delivery
provider.

The normative machine-readable surfaces are:

- JSON Schema: `packages/schemas/contracts/delivery-handoff.schema.json`
- TypeScript types and validation helpers: `@sceneaxi/schemas`
  (`validateDeliveryHandoff`, `parseDeliveryHandoffText`)

## Contract shape

A v1 handoff records:

- `schemaVersion: 1` and `kind: "sceneaxi.delivery-handoff"`
- portable product identity (`id`, `displayName`, `version`)
- one or more abstract targets: `android`, `ios`, `desktop`, or `web`
- a non-empty artifact list with a relative POSIX `path`, abstract `role`, media
  `contentType`, and lower-case `sha256:` digest for each artifact
- `artifactSetDigest`, which binds the ordered artifact descriptors
- provenance with the handoff creation time plus optional source commit and
  build metadata
- optional human-readable `notes`

Artifact paths are relative to the export-package root. Absolute paths,
backslashes, empty path segments, `.` segments, and `..` segments refuse.

`artifactSetDigest` is `sha256:` followed by the SHA-256 digest of the RFC 8785
canonical JSON representation of the `artifacts` array, preserving array order.
Each artifact digest binds the referenced file bytes; the aggregate digest binds
their portable descriptors to the handoff. Consumers should validate the
handoff, verify every artifact digest, and recompute `artifactSetDigest` before
delivery.

Schema major mismatches, missing or malformed fields, malformed digests,
duplicate targets or artifact paths, and unknown properties refuse with typed
diagnostics. All objects are closed with `additionalProperties: false`.

## Adapter boundary

SceneAxi owns only the public handoff shape and its validation rules. A delivery
adapter owns provider selection, authentication, signing, upload, approval, and
release behavior. Those concerns must remain outside the payload.

- External consumers may implement independent adapters against this contract.
- A first-party Mobile Factory adapter is the separate later task
  `mobile-factory-sceneaxi-delivery-adapter-v1` and is not implemented here.
  SceneAxi does not depend on Mobile Factory credentials, paths, project
  identifiers, lanes, gates, or private tooling.
- `desktop` is only an abstract target. It does not select Steam or authorize a
  desktop-store workflow; desktop delivery remains case-by-case.

The handoff is data, not delivery authority. Creating or validating one never
uploads an artifact, spends money, signs a build, accesses credentials, or
approves a release.

## Minimal example

```json
{
  "schemaVersion": 1,
  "kind": "sceneaxi.delivery-handoff",
  "product": {
    "id": "demo-game",
    "displayName": "Demo Game",
    "version": "1.0.0"
  },
  "targets": ["web"],
  "artifacts": [
    {
      "path": "artifacts/demo-game.zip",
      "role": "application",
      "contentType": "application/zip",
      "digest": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  ],
  "artifactSetDigest": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "provenance": {
    "createdAt": "2026-07-22T10:30:00.000Z"
  }
}
```

The digest values above are format examples, not verified digests for a real
artifact set.
