/**
 * The one rendering of safe rarity provenance, shared by every surface required
 * to display matching evidence.
 *
 * This module is its own package entry point (`@sceneaxi/authoring-core/rarity-evidence`)
 * and imports nothing at all. Both are load-bearing. The packaged Linux renderer
 * is bundled for the browser, so reaching this function through the root barrel
 * would drag `node:fs`, `node:crypto`, `node:path`, and `node:child_process` into
 * a bundle that cannot resolve them. And because the Engine Desktop chrome embeds
 * this exact function into its emitted browser script with `String()` — the way it
 * already embeds the web staging decision — a single module binding here would
 * emit a reference the browser cannot resolve.
 *
 * It validates the value it is handed and answers `null` rather than printing a
 * partially-known descriptor.
 */
export function formatSafeRarityEvidence(evidence: unknown): string | null {
  const record = evidence as Record<string, unknown> | null | undefined;
  const provider = record === null || record === undefined
    ? undefined
    : (record["providerEvidence"] as Record<string, unknown> | undefined);
  const model = provider === null || provider === undefined
    ? undefined
    : (provider["model"] as Record<string, unknown> | undefined);
  const strings = [
    "eventId", "tier", "candidateId", "scope", "algorithmId", "policyDigest",
    "requestDigest", "outcomeDigest", "provenanceDigest", "namespaceDigest",
    "tierRollDigest", "candidateRollDigest",
  ];
  if (
    record === null || record === undefined || typeof record !== "object" ||
    !strings.every((field) => typeof record[field] === "string") ||
    model === null || model === undefined || typeof model !== "object" ||
    !["provider", "model", "quantization", "version"].every(
      (field) => typeof model[field] === "string",
    )
  ) {
    return null;
  }
  return [
    "RARITY " + String(record["tier"]) + " · " + String(record["candidateId"]),
    "event " + String(record["eventId"]) + " · scope " + String(record["scope"]) +
      " · seed " + String(record["projectSeed"]),
    "algorithm " + String(record["algorithmId"]),
    "policy " + String(record["policyDigest"]),
    "request " + String(record["requestDigest"]),
    "outcome " + String(record["outcomeDigest"]),
    "provenance " + String(record["provenanceDigest"]),
    "namespace " + String(record["namespaceDigest"]),
    "tier draw " + String(record["tierDraw"]) + " / " + String(record["tierTotalWeight"]),
    "candidate draw " + String(record["candidateDraw"]) + " / " +
      String(record["candidateTotalWeight"]),
    "tier roll " + String(record["tierRollDigest"]),
    "candidate roll " + String(record["candidateRollDigest"]),
    "provider " + String(model["provider"]) + " · model " + String(model["model"]) +
      " · quantization " + String(model["quantization"]) +
      " · version " + String(model["version"]),
  ].join("\n");
}
