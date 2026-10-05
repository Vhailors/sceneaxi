/** Bounded structural history projection. Authentication remains in the owning plane. */
import type { SiteSurface } from "./ports.js";
import { ok, refuse, type SiteResult } from "./refusals.js";

export type SitePurchaseHistoryRequest = Readonly<{
  surface: SiteSurface; limit?: number; before?: Readonly<{ createdAt: string; intentId: string }>;
}>;

export type SitePurchaseHistoryItem = Readonly<{
  intentId: string; itemId: string; createdAt: string; credits: number; unitAmount: number;
  currency: string; mode: "test" | "live";
  status: "pending" | "granted" | "refunded" | "reconciliation-required";
  grantEntryId?: string; refundEntryId?: string;
}>;

export type SitePurchaseHistory = Readonly<{
  purchases: readonly SitePurchaseHistoryItem[]; next?: Readonly<{ createdAt: string; intentId: string }>;
  reconciliationTruncated: boolean;
}>;

export interface SitePurchaseHistoryPort {
  read(request: SitePurchaseHistoryRequest): Promise<SiteResult<SitePurchaseHistory>>;
}

const cursorValid = (value: SitePurchaseHistoryRequest["before"]) => value === undefined ||
  (value !== null && typeof value === "object" && typeof value.createdAt === "string" && value.createdAt.length <= 40 && Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.intentId === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value.intentId) &&
    Object.keys(value).every(key => key === "createdAt" || key === "intentId"));

export function createSitePurchaseHistoryPort(read?: SitePurchaseHistoryPort["read"]): SitePurchaseHistoryPort {
  return Object.freeze({ async read(request: SitePurchaseHistoryRequest): Promise<SiteResult<SitePurchaseHistory>> {
    if (request.surface === "kids") return refuse("KIDS_SURFACE_DENIED");

    if (!["site", "cli", "desktop"].includes(request.surface) || Object.keys(request).some(key => !["surface", "limit", "before"].includes(key)) ||
      !Number.isSafeInteger(request.limit ?? 50) || (request.limit ?? 50) < 1 || (request.limit ?? 50) > 50 || !cursorValid(request.before)) return refuse("SITE_REQUEST_MALFORMED");

    if (read === undefined) return refuse("BILLING_PLANE_NOT_WIRED");

    try {
      const result = await read(request);

      if (!result.ok) return result;
      const value = result.value;

      if (!Array.isArray(value.purchases) || value.purchases.length > (request.limit ?? 50) || !cursorValid(value.next) || typeof value.reconciliationTruncated !== "boolean" ||
        value.purchases.some(item => !/^[A-Za-z0-9._-]{1,128}$/.test(item.intentId) || !item.itemId || !Number.isFinite(Date.parse(item.createdAt)) ||
          !Number.isSafeInteger(item.credits) || item.credits < 0 || !Number.isSafeInteger(item.unitAmount) || item.unitAmount < 0 || !item.currency ||
          !["test", "live"].includes(item.mode) || !["pending", "granted", "refunded", "reconciliation-required"].includes(item.status))) return refuse("BILLING_ADAPTER_OUTPUT_INVALID");

      return ok(Object.freeze({ purchases: Object.freeze(value.purchases.map(item => Object.freeze({
        intentId: item.intentId, itemId: item.itemId, createdAt: item.createdAt, credits: item.credits,
        unitAmount: item.unitAmount, currency: item.currency, mode: item.mode, status: item.status,
        ...(item.grantEntryId === undefined ? {} : { grantEntryId: item.grantEntryId }),
        ...(item.refundEntryId === undefined ? {} : { refundEntryId: item.refundEntryId }),
      }))), reconciliationTruncated: value.reconciliationTruncated, ...(value.next === undefined ? {} : { next: Object.freeze({ createdAt: value.next.createdAt, intentId: value.next.intentId }) }) }));
    } catch { return refuse("BILLING_PLANE_UNAVAILABLE"); }
  } });
}
