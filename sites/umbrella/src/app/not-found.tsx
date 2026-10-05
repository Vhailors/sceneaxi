/**
 * 404.
 *
 * Any path the umbrella does not route lands here, so a mistyped or stale link gets the
 * site's own chrome and a way back instead of the framework's unbranded default.
 */
export default function NotFound() {
  return (
    <div className="page page-narrow page-state">
      <div className="page-head">
        <div className="title-row">
          <h1>There is no page at this address</h1>
          <span className="chip chip-dormant state-chip">
            <span className="dot" aria-hidden="true" />
            Not found
          </span>
        </div>
        <p className="lede">
          The link may be mistyped or out of date. Everything the umbrella serves is reachable
          from the navigation above.
        </p>
      </div>
      <div className="actions">
        <a className="button" href="/">
          Back to the overview
        </a>
      </div>
    </div>
  );
}
