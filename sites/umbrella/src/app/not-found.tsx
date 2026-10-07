import { StatusIcon } from "./_components/signal-icon.js";

/**
 * 404.
 *
 * Any path the umbrella does not route lands here, so a mistyped or stale link gets the
 * site's own chrome and a way back instead of the framework's unbranded default.
 */
export default function NotFound() {
  return (
    <div className="page page-narrow op" data-density="comfortable">
      <div className="page-head">
        <span className="sx-plate state-chip">
          <StatusIcon status="dormant" />
          Not found
        </span>
        <h1>There is no page at this address</h1>
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
