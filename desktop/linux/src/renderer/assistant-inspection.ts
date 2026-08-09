/**
 * The assistant result's read-only inspection text.
 *
 * Separated from the DOM that shows it so the gate can execute the projection —
 * which sections a settled job prints, and what each one says when the host
 * reported nothing — instead of reading the viewport's source for its literals.
 * A rarity proposal has no artifact to inspect and prints nothing here; its
 * provenance is rendered by the shared safe-evidence formatter instead.
 */
import type { DesktopAssistantJobSnapshot } from "../lib/bridge-contract.js";
import type { DesktopRarityProposalResult } from "../lib/bridge-contract.js";

export function isRarityProposalResult(
  result: NonNullable<DesktopAssistantJobSnapshot["result"]>,
): result is DesktopRarityProposalResult {
  return "kind" in result && result.kind === "rarity-proposal";
}

export function assistantInspectionText(job: DesktopAssistantJobSnapshot): string {
  const result = job.result;
  if (result === undefined || isRarityProposalResult(result)) return "";
  const inspection = result.inspection;
  if (inspection === undefined) return "";
  const materials = inspection.materials.values
    .map(
      (material) =>
        `${material.id}: ${material.baseColor}, metal ${material.metallic}, rough ${material.roughness}`,
    )
    .join("\n");
  const physics = inspection.physics.supported
    ? inspection.physics.colliders
        .map((collider) => `${collider.id}: ${collider.shape} collider`)
        .join("\n")
    : `${inspection.physics.reason}: ${inspection.physics.message}`;
  const settings = inspection.settings.proceduralModule;
  return [
    "MATERIALS (read-only)",
    materials || "none",
    "",
    "PHYSICS (read-only)",
    physics || "none",
    "",
    "SETTINGS (read-only)",
    `${settings.moduleId} · ${settings.exportName}`,
    inspection.settings.edit.refusal,
  ].join("\n");
}
