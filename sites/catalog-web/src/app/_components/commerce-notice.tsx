import {
  COMMERCE_NOTICE_COPY,
  createCommerceNoticeModel,
} from "@sceneaxi/site-kit/commerce-notice";
import type { CatalogSurface, SitePrincipal, SiteResult } from "@sceneaxi/site-kit";
import { StatePanel } from "./state-panel.js";

/**
 * The purchase and publish controls.
 *
 * There is no checkout, cart, or payment field anywhere on this storefront. Commerce is
 * structurally inert while tier-6b marketplace activation stays an open captain
 * decision, so this component renders the pipeline's own refusal — including its policy
 * text and registry citation — instead of a button that could never complete.
 *
 * The viewer line exists because this panel claims a future purchase "settles through
 * the shared account plane". It shows what that plane actually says about this request
 * today, rather than letting the claim go unevidenced. It is display only: no decision
 * on this page depends on it, and the role shown is the server-derived one the identity
 * port returned — a storefront never reads a role from a client.
 */
export function CommerceNotice({
  surface,
  itemId,
  viewer,
}: {
  readonly surface: CatalogSurface;
  readonly itemId: string;
  readonly viewer: SiteResult<SitePrincipal>;
}) {
  const model = createCommerceNoticeModel({ surface, itemId, viewer });

  return (
    <StatePanel
      tone={model.tone}
      title={model.title}
      reason={model.reason ?? undefined}
    >
      <p>{model.policy}</p>
      <p>{model.explanation}</p>
      <p>
        {COMMERCE_NOTICE_COPY.accountLabel}{" "}
        {model.viewer.state === "resolved" ? (
          <>
            signed in as <code>{model.viewer.email}</code> · role{" "}
            <code>{model.viewer.role}</code>
          </>
        ) : (
          <>
            no viewer resolved · <code>{model.viewer.reason}</code>
          </>
        )}
      </p>
      <p>
        {COMMERCE_NOTICE_COPY.registryLabel} <code>{model.registry}</code>
      </p>
    </StatePanel>
  );
}
