import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  REVENUE_SHARE_REFUSE_CODES,
  contracts,
  validateCreatorShareRecord,
  validateMoneySplitRecord,
} from "@sceneaxi/schemas";

describe("revenue-share JSON Schema", () => {
  it("ships both versioned bookkeeping records as public artifacts", () => {
    expect(contracts.revenueShare).toBe("contracts/revenue-share.schema.json");
    const schema = JSON.parse(
      readFileSync(
        new URL("../contracts/revenue-share.schema.json", import.meta.url),
        "utf8",
      ),
    ) as {
      $id: string;
      $defs: Record<
        string,
        { required?: string[]; additionalProperties?: boolean }
      >;
    };
    expect(schema.$id).toBe(
      "https://sceneaxi.invalid/contracts/revenue-share/v1",
    );
    expect(schema.$defs.creatorShareRecord?.required).toEqual([
      "schemaVersion",
      "kind",
      "saleId",
      "listingId",
      "buyerUserId",
      "creatorUserId",
      "grossCredits",
      "creatorCredits",
      "platformCredits",
      "basisPoints",
      "occurredAt",
    ]);
    expect(schema.$defs.moneySplitRecord?.required).toEqual([
      "schemaVersion",
      "kind",
      "saleId",
      "listingId",
      "buyerUserId",
      "creatorUserId",
      "grossMinor",
      "creatorMinor",
      "platformMinor",
      "currency",
      "basisPoints",
      "mode",
      "occurredAt",
    ]);
    expect(schema.$defs.creatorShareRecord?.additionalProperties).toBe(false);
    expect(schema.$defs.moneySplitRecord?.additionalProperties).toBe(false);
  });
});

describe("revenue-share runtime split invariants", () => {
  it("refuses balanced records that do not use the fixed 50/50 split", () => {
    const credits = validateCreatorShareRecord({
      schemaVersion: 1,
      kind: "sceneaxi.creator-share-record",
      saleId: "sale_credits",
      listingId: "lantern-prop",
      buyerUserId: "usr_buyer",
      creatorUserId: "usr_creator",
      grossCredits: 101,
      creatorCredits: 1,
      platformCredits: 100,
      basisPoints: 5000,
      occurredAt: "2026-07-25T10:00:00Z",
    });
    expect(credits.ok).toBe(false);
    if (!credits.ok) {
      expect(credits.code).toBe(
        REVENUE_SHARE_REFUSE_CODES.splitDoesNotBalance,
      );
    }

    const money = validateMoneySplitRecord({
      schemaVersion: 1,
      kind: "sceneaxi.money-split-record",
      saleId: "sale_money",
      listingId: "harbour-diorama",
      buyerUserId: "usr_buyer",
      creatorUserId: "usr_creator",
      grossMinor: 101,
      creatorMinor: 1,
      platformMinor: 100,
      currency: "usd",
      basisPoints: 5000,
      mode: "test",
      occurredAt: "2026-07-25T10:00:00Z",
    });
    expect(money.ok).toBe(false);
    if (!money.ok) {
      expect(money.code).toBe(
        REVENUE_SHARE_REFUSE_CODES.splitDoesNotBalance,
      );
    }
  });
});
