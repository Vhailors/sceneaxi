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

export function rarityInvalidationMatches(
  displayedNamespaceDigest: string | null,
  detail: unknown,
): boolean {
  if (displayedNamespaceDigest === null || typeof detail !== "object" || detail === null) {
    return false;
  }
  const record = detail as Record<string, unknown>;
  return record["invalidated"] === true &&
    record["namespaceDigest"] === displayedNamespaceDigest;
}

export function assistantRarityInvalidation(
  displayedNamespaceDigest: string | null,
  detail: unknown,
): AssistantRaritySettlement | null {
  return rarityInvalidationMatches(displayedNamespaceDigest, detail)
    ? Object.freeze({
        activeNamespaceDigest: null,
        evidenceText: "",
        evidenceVisible: false,
        status: "Rarity evidence retired · the bound namespace is no longer active.",
      })
    : null;
}

export function assistantRaritySettlement(
  activeNamespaceDigest: string | null,
  detail: unknown,
): AssistantRaritySettlement | null {
  if (activeNamespaceDigest === null || typeof detail !== "object" || detail === null) {
    return null;
  }
  const record = detail as Record<string, unknown>;
  const settled = record["settled"];
  const retired = record["retired"];
  if (
    settled !== "applied" &&
    settled !== "rejected" &&
    retired !== "session-restarted" &&
    retired !== "undo" &&
    retired !== "namespace-replaced" &&
    retired !== "document-missing"
  ) return null;
  const evidence = record["evidence"];
  if (typeof evidence !== "object" || evidence === null) return null;
  const namespaceDigest = (evidence as Record<string, unknown>)["namespaceDigest"];
  const evidenceText = formatSafeRarityEvidence(evidence);
  if (namespaceDigest !== activeNamespaceDigest || evidenceText === null) return null;
  if (retired !== undefined) {
    const status = retired === "session-restarted"
      ? "Rarity proposal retired · the authoring session restarted before settlement was confirmed."
      : retired === "undo"
        ? "Rarity evidence retired · Undo removed the proposal or accepted namespace."
        : retired === "document-missing"
          ? "Rarity evidence retired · the bound document is gone."
          : "Rarity evidence retired · the bound namespace was replaced.";
    return Object.freeze({
      activeNamespaceDigest: null,
      evidenceText: "",
      evidenceVisible: false,
      status,
    });
  }
  if (settled === "rejected") {
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

export function assistantRarityResultEvent(
  result: DesktopAssistantJobSnapshot["result"] | null,
): Readonly<Record<string, unknown>> | null {
  if (result === null || result === undefined || !isRarityProposalResult(result)) return null;
  if (result.retirement !== undefined) {
    return Object.freeze({
      retired: result.retirement.reason,
      refreshAuthoring: true,
      evidence: result.evidence,
    });
  }
  const phase = result.authoring?.phase;
  if (phase === "applied" || phase === "rejected") {
    return Object.freeze({
      settled: phase,
      refreshAuthoring: true,
      evidence: result.evidence,
    });
  }
  return Object.freeze({
    replayed: result.replayed,
    snapshot: result.replayed ? null : result.authoring,
    evidence: result.evidence,
  });
}

export function isRarityProposalResult(
  result: NonNullable<DesktopAssistantJobSnapshot["result"]>,
): result is DesktopRarityProposalResult {
  return "kind" in result && result.kind === "rarity-proposal";
}

export function assistantRarityResultDigest(
  result: DesktopAssistantJobSnapshot["result"] | null,
): string | null {
  if (
    result === null ||
    result === undefined ||
    !isRarityProposalResult(result) ||
    result.replayed ||
    result.retirement !== undefined ||
    result.authoring?.phase === "applied" ||
    result.authoring?.phase === "rejected"
  ) {
    return null;
  }
  return typeof result.evidence.namespaceDigest === "string"
    ? result.evidence.namespaceDigest
    : null;
}

export function assistantRarityResultSettlement(
  result: DesktopAssistantJobSnapshot["result"] | null,
): AssistantRaritySettlement | null {
  if (result === null || result === undefined || !isRarityProposalResult(result)) return null;
  if (result.retirement !== undefined) {
    const status = result.retirement.reason === "session-restarted"
      ? "Rarity proposal retired · the authoring session restarted."
      : result.retirement.reason === "undo"
        ? "Rarity evidence retired · Undo removed the proposal or accepted namespace."
        : result.retirement.reason === "document-missing"
          ? "Rarity evidence retired · the bound document is gone."
          : "Rarity evidence retired · the bound namespace was replaced.";
    return Object.freeze({
      activeNamespaceDigest: null,
      evidenceText: "",
      evidenceVisible: false,
      status,
    });
  }
  const phase = result.authoring?.phase;
  if (phase !== "applied" && phase !== "rejected") return null;
  const digest = result.evidence.namespaceDigest;
  return typeof digest === "string"
    ? assistantRaritySettlement(digest, { settled: phase, evidence: result.evidence })
    : null;
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
