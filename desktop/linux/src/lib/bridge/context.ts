import type { DesktopDocumentStatus, DesktopSession, DesktopSnapshot } from "@sceneaxi/desktop-shell";
import type { RarityKernelResolutionInput } from "@sceneaxi/authoring-core";
import { bootstrapOpenPath } from "@sceneaxi/engine-orchestrator";
import { RARITY_REFUSE_CODES, type EditorCommandId } from "@sceneaxi/schemas";
import type { DesktopBridgeResponse } from "../bridge-contract.js";
import { DESKTOP_SCENE_NOT_COMPOSABLE } from "../desktop-scene.js";

export type DesktopBridgeContext = Readonly<{
  authoringSession: () => DesktopSession;
  containedDocumentPath: (value: unknown) => string | null;
  readActiveDocument: (
    payload: unknown,
    refusals: Readonly<{ missingMessage: string; unreadableReason: string }>,
  ) =>
    | Readonly<{ ok: true; status: Extract<DesktopDocumentStatus, { ok: true }> }>
    | Readonly<{ ok: false; reason: string; message: string }>;
  commandTransaction: (commandId: EditorCommandId, response: DesktopBridgeResponse) => DesktopBridgeResponse;
  reconcilePendingAssetImport: <T extends DesktopSnapshot>(snapshot: T) => T;
}>;

export const SCENE_DOCUMENT_REFUSALS = Object.freeze({
  missingMessage: "scene playback requires a documentPath string inside the project directory.",
  unreadableReason: DESKTOP_SCENE_NOT_COMPOSABLE,
});

export function field(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

export function rarityRefusalReason(detail: unknown): string | null {
  if (typeof detail !== "string") return null;
  return Object.values(RARITY_REFUSE_CODES).find(
    (code) => detail === code || detail.startsWith(`${code} `),
  ) ?? null;
}

export function createRarityResolver(nowMs: () => number) {
  return (input: RarityKernelResolutionInput) => {
    const bootstrapped = bootstrapOpenPath(
      {
        kind: "product",
        productManifest: {
          productId: input.productId,
          seed: input.seed,
          rarity: input.namespace,
        },
      },
      { nowMs },
    );
    if (!bootstrapped.ok) {
      const reason = rarityRefusalReason(bootstrapped.detail);
      return Object.freeze({
        ok: false as const,
        reason: reason ?? bootstrapped.reason,
        message: reason === null
          ? bootstrapped.message
          : bootstrapped.detail ?? bootstrapped.message,
      });
    }
    const handle = bootstrapped.value;
    const live = handle.session();
    if (!live.ok) {
      handle.close();
      return Object.freeze({ ok: false as const, reason: live.reason, message: live.message });
    }
    try {
      live.value.dispatch({
        type: "rarity-roll",
        eventId: input.eventId,
        request: input.request,
        providerEvidence: input.providerEvidence,
      });
      live.value.advance({ tick: 1, deltaMs: 0 });
      const rarity = live.value.observe().rarity;
      if (rarity === undefined) {
        return Object.freeze({
          ok: false as const,
          reason: RARITY_REFUSE_CODES.outcomeMismatch,
          message: "The authoritative kernel did not expose the resolved rarity namespace.",
        });
      }
      return Object.freeze({ ok: true as const, value: rarity });
    } catch (error) {
      const reason = field(error, "code") ?? field(error, "reason");
      return Object.freeze({
        ok: false as const,
        reason: typeof reason === "string" ? reason : RARITY_REFUSE_CODES.outcomeMismatch,
        message: "The authoritative kernel refused the rarity resolution.",
      });
    } finally {
      handle.close();
    }
  };
}
