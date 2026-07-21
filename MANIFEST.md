# Repository manifest

The authoritative package and app inventory, implementation status, and common
development command are maintained in `README.md`.

- `package.json` owns the executable toolchain commands and declared development
  dependencies; `pnpm-lock.yaml` owns their resolved versions.
- `docs/dependency-matrix.json` owns package boundaries, release groups, and profile
  core pins; `docs/DEPENDENCY-MATRIX.md` explains that schema-backed contract.
- `docs/held-key-enforcement.md` and `packages/schemas/contracts/*.schema.json` own
  the held-key runtime protocol and its versioned schemas.
- `docs/bootstrap.md` owns the separated authority requirements that remain in force.
