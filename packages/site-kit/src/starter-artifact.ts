/**
 * The starter Sculpt Artifact a web editor session mounts.
 *
 * The site needs a real object to open, and reconstruction is deterministic for a
 * fixed seed, so this is a reproducible starting scene rather than a mock.
 */
import { reconstructSculpt } from "@sceneaxi/authoring-core";
import type { SculptArtifact } from "@sceneaxi/schemas";
import { type SiteResult, ok, refuse } from "./refusals.js";
import { WEB_EDITOR_STARTER_INTAKE } from "./starter-prop-intake.js";

/** Fixed seed, so the starter scene is byte-reproducible across deploys. */
export const WEB_EDITOR_STARTER_SEED = 8001;

let cached: SculptArtifact | null = null;

/**
 * Reconstruct a starter artifact from an arbitrary intake.
 *
 * Exported so the refuse matrix can reach `EDITOR_STARTER_ARTIFACT_INVALID` with a bad
 * intake, instead of the shipped module having to be corrupted to prove the refusal is
 * wired.
 */
export function reconstructStarter(intake: unknown): SiteResult<SculptArtifact> {
  const reconstruction = reconstructSculpt(intake, { seed: WEB_EDITOR_STARTER_SEED });
  return reconstruction.ok
    ? ok(reconstruction.artifact)
    : refuse("EDITOR_STARTER_ARTIFACT_INVALID");
}

/**
 * Reconstruct the starter artifact. Cached, because reconstruction is pure for a fixed
 * seed and every request would otherwise redo the same multi-pass work.
 */
export function webEditorStarterArtifact(): SiteResult<SculptArtifact> {
  if (cached !== null) return ok(cached);
  const reconstructed = reconstructStarter(WEB_EDITOR_STARTER_INTAKE);
  if (!reconstructed.ok) return reconstructed;
  cached = reconstructed.value;
  return ok(cached);
}
