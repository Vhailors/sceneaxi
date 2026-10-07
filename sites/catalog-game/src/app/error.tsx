"use client";

/**
 * The route-segment error boundary.
 *
 * Next requires this module to be a client component. It shows only the digest Next
 * attaches — never the message, which can carry server detail — and, like every state on
 * the storefront, offers a link rather than a re-attempt control.
 *
 * This route imports nothing: it is rendered standalone by the pinned route-state proof.
 * The plate is the same markup `StatePlate tone="deny"` emits (site-kit `SIGNAL_ICONS.refused`).
 */
export default function RouteError({ error }: { readonly error: Error & { readonly digest?: string } }) {
  // A Refused plate (label + icon) follows the H1; the reference sits in a mono field; the link home is the
  // primary action, and there is no re-attempt control.
  return (
    <div className="shell page page-state">
      <div className="page-head tone-refused">
        <h1>This page could not be rendered</h1>
        <p className="sx-plate" data-state="refused">
          <svg className="sx-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z" />
            <path d="M8 12h8" />
          </svg>
          <span>Something went wrong</span>
        </p>
      </div>
      <p className="lede">The storefront is read-only, so nothing was changed.</p>
      {error.digest ? (
        <p className="reference">
          Reference <code>{error.digest}</code>
        </p>
      ) : null}
      <div className="actions">
        <a className="button button-xl" href="/">
          Back to the catalogue
        </a>
      </div>
    </div>
  );
}
