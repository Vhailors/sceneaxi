"use client";

/**
 * The route-segment error boundary.
 *
 * Next requires this module to be a client component. It shows only the digest Next
 * attaches — never the message, which can carry server detail — and, like every state on
 * the storefront, offers a link rather than a re-attempt control.
 */
export default function RouteError({ error }: { readonly error: Error & { readonly digest?: string } }) {
  // A Refused chip follows the H1; the reference sits in a mono field; the link home is the
  // primary action, and there is no re-attempt control.
  return (
    <div className="shell page page-state">
      <div className="page-head tone-refused">
        <h1>This page could not be rendered</h1>
        <p className="chip chip-refused">
          <span className="chip-dot" aria-hidden="true" />
          Something went wrong
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
