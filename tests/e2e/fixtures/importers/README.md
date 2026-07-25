# Importer fixtures

Recorded external content for `tests/e2e/importers-plugin-golden.test.ts`.
These stand in for content arriving from outside SceneAxi; nothing here is
fetched at test time.

- `external-workshop.sceneaxi.json` — a well-formed external document whose
  `/data` carries a Product Manifest, so the import can feed a runnable kernel
  session rather than just landing on disk.
- `unsupported-major.sceneaxi.json` — a future schema major; importing it must
  refuse rather than best-effort read.
- `duplicate-member.sceneaxi.json` — ambiguous JSON (a duplicate `data` member);
  importing it must refuse rather than pick a winner.
