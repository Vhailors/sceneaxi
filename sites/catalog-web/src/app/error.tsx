"use client";

/**
 * The route-segment error boundary.
 *
 * Next requires this module to be a client component. It shows only the digest Next
 * attaches — never the message, which can carry server detail — and, like every state on
 * the storefront, offers a link rather than a re-attempt control.
 */
export default function RouteError({ error }: { readonly error: Error & { readonly digest?: string } }) {
  return (
    <div className="shell page">
      <p className="eyebrow">Something went wrong</p>
      <h1>This page could not be rendered</h1>
      <p className="lede">The storefront is read-only, so nothing was changed.</p>
      {error.digest ? (
        <p>
          Reference <code>{error.digest}</code>
        </p>
      ) : null}
      <div className="actions">
        <a className="button" href="/">
          Back to the catalogue
        </a>
      </div>
    </div>
  );
}
