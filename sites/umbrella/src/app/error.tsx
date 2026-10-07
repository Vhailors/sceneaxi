"use client";

/**
 * The route-segment error boundary.
 *
 * Next requires this module to be a client component. An uncaught render error below the
 * root layout lands here instead of on the framework's unbranded default. It shows only
 * the digest Next attaches — never the message, which can carry server detail — so a
 * visitor can quote it and an operator can match it to the server log. Like every state
 * panel on the site it adds no re-attempt affordance: the way forward is a link.
 */
export default function RouteError({
  error,
}: {
  readonly error: Error & { readonly digest?: string };
}) {
  return (
    <div className="page page-narrow op" data-density="comfortable">
      <div className="page-head">
        <span className="sx-plate state-chip" data-state="refused">
          {/* The refused glyph, inlined: a client boundary keeps its import graph to itself. */}
          <svg className="sx-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z" />
            <path d="M8 12h8" />
          </svg>
          Something went wrong
        </span>
        <h1>This page could not be rendered</h1>
        <p className="lede">Nothing was changed on your account.</p>
        {error.digest ? (
          <p className="reason">
            <span className="reason-label">Reference</span>
            {error.digest}
          </p>
        ) : null}
      </div>
      <div className="actions">
        <a className="button" href="/">
          Back to the overview
        </a>
      </div>
    </div>
  );
}
