/**
 * The starter Sculpt Artifact a web editor session mounts.
 *
 * The site needs *some* real object to open, and reconstruction is deterministic
 * for a fixed seed, so this is a reproducible starting scene rather than a mock.
 * The intake is a site-local fixture (`fixtures/starter-prop.intake.json`), derived
 * from the landed sculpt-quality service-crate demo so it exercises the same
 * multi-pass reconstruction path.
 */
import { readFileSync } from "node:fs";
import { reconstructSculpt } from "@sceneaxi/authoring-core";
import type { SculptArtifact } from "@sceneaxi/schemas";
import { type SiteResult, ok, refuse } from "./refusals.js";

/** Fixed seed, so the starter scene is byte-reproducible across deploys. */
export const WEB_EDITOR_STARTER_SEED = 8001;

export const WEB_EDITOR_STARTER_INTAKE_PATH = "fixtures/starter-prop.intake.json";

let cached: SculptArtifact | null = null;

/**
 * Reconstruct the starter artifact. Cached, because reconstruction is pure for a
 * fixed seed and every request would otherwise redo the same multi-pass work.
 */
export function webEditorStarterArtifact(): SiteResult<SculptArtifact> {
  if (cached !== null) return ok(cached);
  let intake: unknown;
  try {
    intake = JSON.parse(
      readFileSync(new URL(`../${WEB_EDITOR_STARTER_INTAKE_PATH}`, import.meta.url), "utf8"),
    ) as unknown;
  } catch {
    return refuse("EDITOR_WORKSPACE_INVALID");
  }
  const reconstruction = reconstructSculpt(intake, { seed: WEB_EDITOR_STARTER_SEED });
  if (!reconstruction.ok) return refuse("EDITOR_WORKSPACE_INVALID");
  cached = reconstruction.artifact;
  return ok(cached);
}
