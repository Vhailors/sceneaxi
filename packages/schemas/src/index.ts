/**
 * @sceneaxi/schemas — the shared contracts home: the seam vocabulary every
 * workspace package speaks, plus the versioned JSON-schema contracts shipped
 * under contracts/. Domain contracts (documents, sessions, catalog pipeline)
 * arrive under their own tickets.
 */

/** Release groups defined by docs/dependency-matrix.json. */
export type ReleaseGroup =
  | "contracts"
  | "core-train"
  | "profile"
  | "cli-protocol"
  | "importers"
  | "apps";

/** The self-description every SceneAxi package exposes at its public seam. */
export interface PackageSeam {
  readonly name: `@sceneaxi/${string}`;
  readonly releaseGroup: ReleaseGroup;
}

/** A profile seam additionally pins the core release train (semver range). */
export interface ProfileSeam extends PackageSeam {
  readonly releaseGroup: "profile";
  readonly corePin: string;
}

/** JSON-schema contracts shipped with this package, relative to its root. */
export const contracts = Object.freeze({
  cliCommandMap: "contracts/cli-command-map.schema.json",
  heldKeyRegistry: "contracts/held-key-registry.schema.json",
});

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/schemas",
  releaseGroup: "contracts",
});
