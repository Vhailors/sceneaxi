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
    <div className="page page-narrow page-state">
      <div className="page-head">
        <div className="title-row">
          <h1>This page could not be rendered</h1>
          <span className="chip chip-refused state-chip">
            <span className="dot" aria-hidden="true" />
            Something went wrong
          </span>
        </div>
        <p className="lede">Nothing was changed on your account.</p>
        {error.digest ? <p className="mono field-well">Reference {error.digest}</p> : null}
      </div>
      <div className="actions">
        <a className="button" href="/">
          Back to the overview
        </a>
      </div>
    </div>
  );
}
