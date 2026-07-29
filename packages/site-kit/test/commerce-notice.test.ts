import { describe, expect, it } from "vitest";
import { COMMERCE_ACTIVATION_GATE } from "@sceneaxi/site-kit";
import {
  COMMERCE_NOTICE_COPY,
  commerceNoticeElement,
  createCommerceNoticeModel,
} from "@sceneaxi/site-kit/commerce-notice";
import { ok, refuse, renderSiteElementHtml } from "@sceneaxi/site-kit";

const principal = Object.freeze({
  user: Object.freeze({
    userId: "user-1",
    email: "viewer@example.com",
    emailVerified: true,
    disabled: false,
  }),
  role: "user" as const,
  session: Object.freeze({
    sessionId: "session-1",
    userId: "user-1",
    surface: "site" as const,
    issuedAt: "2026-07-29T08:00:00.000Z",
    expiresAt: "2026-07-29T09:00:00.000Z",
  }),
});

describe("shared commerce notice", () => {
  it("carries the catalog gate and signed-out refusal from the owning contracts", () => {
    const model = createCommerceNoticeModel({
      surface: "catalog-game",
      itemId: "game-lantern-prop",
      viewer: refuse("IDENTITY_PLANE_NOT_WIRED"),
    });
    expect(model).toMatchObject({
      tone: "warn",
      title: COMMERCE_NOTICE_COPY.title,
      reason: "CATALOG_COMMERCE_INERT",
      policy: COMMERCE_ACTIVATION_GATE.policy,
      viewer: { state: "refused", reason: "IDENTITY_PLANE_NOT_WIRED" },
      registry: COMMERCE_ACTIVATION_GATE.registry,
    });
    expect(Object.isFrozen(model)).toBe(true);
  });

  it("projects only the server-resolved viewer facts the notice displays", () => {
    const model = createCommerceNoticeModel({
      surface: "catalog-web",
      itemId: "web-hero-diorama",
      viewer: ok(principal),
    });
    expect(model.viewer).toEqual({
      state: "resolved",
      email: "viewer@example.com",
      role: "user",
    });
    expect(Object.isFrozen(model.viewer)).toBe(true);
  });

  it("preserves earlier catalog refusals instead of relabeling them as inert commerce", () => {
    const model = createCommerceNoticeModel({
      surface: "catalog-game",
      itemId: "unknown-item",
      viewer: refuse("IDENTITY_PLANE_NOT_WIRED"),
    });
    expect(model.reason).toBe("CATALOG_ITEM_NOT_FOUND");
  });

  it("emits the complete neutral element tree", () => {
    const html = renderSiteElementHtml(
      commerceNoticeElement({
        surface: "catalog-game",
        itemId: "game-lantern-prop",
        viewer: ok(principal),
      }),
    );
    expect(html).toContain(COMMERCE_NOTICE_COPY.title);
    expect(html).toContain(COMMERCE_ACTIVATION_GATE.policy);
    expect(html).toContain("viewer@example.com");
    expect(html).toContain("CATALOG_COMMERCE_INERT");
    expect(html).toContain(COMMERCE_ACTIVATION_GATE.registry);
  });
});
