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
import { formatSafeRarityEvidence } from "@sceneaxi/authoring-core/rarity-evidence";

export type AssistantRaritySettlement = Readonly<{
  activeNamespaceDigest: null;
  evidenceText: string;
  evidenceVisible: boolean;
  status: string;
}>;

export function assistantRaritySettlement(
  activeNamespaceDigest: string | null,
  detail: unknown,
): AssistantRaritySettlement | null {
  if (activeNamespaceDigest === null || typeof detail !== "object" || detail === null) {
    return null;
  }
  const record = detail as Record<string, unknown>;
  if (record["settled"] !== "applied" && record["settled"] !== "rejected") return null;
  const evidence = record["evidence"];
  if (typeof evidence !== "object" || evidence === null) return null;
  const namespaceDigest = (evidence as Record<string, unknown>)["namespaceDigest"];
  const evidenceText = formatSafeRarityEvidence(evidence);
  if (namespaceDigest !== activeNamespaceDigest || evidenceText === null) return null;
  if (record["settled"] === "rejected") {
    return Object.freeze({
      activeNamespaceDigest: null,
      evidenceText: "",
      evidenceVisible: false,
      status: "Rarity proposal rejected · project bytes and kernel state unchanged.",
    });
  }
  return Object.freeze({
    activeNamespaceDigest: null,
    evidenceText,
    evidenceVisible: true,
    status: "Rarity proposal accepted · canonical project bytes saved.",
  });
}

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
