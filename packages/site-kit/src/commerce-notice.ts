/** Shared inert-commerce notice for the two storefront install roots. */
import { COMMERCE_ACTIVATION_GATE } from "@sceneaxi/schemas";
import {
  attemptCatalogPurchase,
  type CatalogSurface,
} from "./catalog.js";
import { el, type SiteElement } from "./site-element.js";
import { statePanelElement } from "./state-panel.js";
import type { SitePrincipal } from "./ports.js";
import type { SiteResult } from "./refusals.js";

export const COMMERCE_NOTICE_COPY = Object.freeze({
  title: "Buying is not open yet",
  explanation:
    "Prices and the creator share are shown so listings can be evaluated now. When activation opens, purchases settle in credits through the shared account plane — nothing on this page collects payment details in the meantime.",
  accountLabel: "Account plane:",
  registryLabel: "Registry:",
});

export type CommerceNoticeInput = {
  readonly surface: CatalogSurface;
  readonly itemId: string;
  readonly viewer: SiteResult<SitePrincipal>;
};

export type CommerceNoticeViewer =
  | {
      readonly state: "resolved";
      readonly email: string;
      readonly role: SitePrincipal["role"];
    }
  | {
      readonly state: "refused";
      readonly reason: string;
    };

export type CommerceNoticeModel = {
  readonly tone: "warn";
  readonly title: string;
  readonly reason: string | null;
  readonly policy: string;
  readonly explanation: string;
  readonly viewer: CommerceNoticeViewer;
  readonly registry: string;
};

/** Resolve all contract copy and refusal facts before a framework renders them. */
export function createCommerceNoticeModel(input: CommerceNoticeInput): CommerceNoticeModel {
  const attempt = attemptCatalogPurchase({
    surface: input.surface,
    itemId: input.itemId,
    payWith: "credits",
  });
  const viewer: CommerceNoticeViewer = input.viewer.ok
    ? Object.freeze({
        state: "resolved",
        email: input.viewer.value.user.email,
        role: input.viewer.value.role,
      })
    : Object.freeze({ state: "refused", reason: input.viewer.reason });

  return Object.freeze({
    tone: "warn" as const,
    title: COMMERCE_NOTICE_COPY.title,
    reason: attempt.ok ? null : attempt.reason,
    policy: COMMERCE_ACTIVATION_GATE.policy,
    explanation: COMMERCE_NOTICE_COPY.explanation,
    viewer,
    registry: COMMERCE_ACTIVATION_GATE.registry,
  });
}

/** Build the complete framework-neutral storefront notice tree. */
export function commerceNoticeElement(input: CommerceNoticeInput): SiteElement {
  const model = createCommerceNoticeModel(input);
  const viewer =
    model.viewer.state === "resolved"
      ? [
          el("span", { text: "signed in as " }),
          el("code", { text: model.viewer.email }),
          el("span", { text: " · role " }),
          el("code", { text: model.viewer.role }),
        ]
      : [
          el("span", { text: "no viewer resolved · " }),
          el("code", { text: model.viewer.reason }),
        ];

  return statePanelElement(
    {
      tone: model.tone,
      title: model.title,
      ...(model.reason === null ? {} : { reason: model.reason }),
    },
    [
      el("p", { text: model.policy }),
      el("p", { text: model.explanation }),
      el("p", {}, [el("span", { text: `${COMMERCE_NOTICE_COPY.accountLabel} ` }), ...viewer]),
      el("p", {}, [
        el("span", { text: `${COMMERCE_NOTICE_COPY.registryLabel} ` }),
        el("code", { text: model.registry }),
      ]),
    ],
  );
}
