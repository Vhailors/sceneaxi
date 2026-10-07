/**
 * Suspense fallback; no listing counts, prices or successful purchase are invented.
 *
 * The heading, its Isolated plate (label + icon) and the lede are visible at once. A 2px bar and three
 * final-size skeleton blocks (`aria-hidden`) start moving only after the loading delay,
 * so a fast response never flashes them (ruling R-1).
 *
 * This route imports nothing: it is rendered standalone by the pinned route-state proof.
 * The plate is the same markup `StatePlate tone="iso"` emits (site-kit `SIGNAL_ICONS.empty`).
 */
export default function LoadingCatalog() {
  return (
    <section className="shell page page-state" role="status" aria-live="polite" aria-busy="true">
      <div className="page-head tone-dormant">
        <h1>Loading catalogue</h1>
        <p className="sx-plate" data-state="isolated">
          <svg className="sx-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 4h16v16H4z" />
          </svg>
          <span>Read-only catalogue</span>
        </p>
      </div>
      <p className="lede">The listing view is opening. No purchase is being made.</p>
      <div className="loading-bar" aria-hidden="true" />
      <div className="skeleton-grid" aria-hidden="true">
        <span className="skeleton" />
        <span className="skeleton" />
        <span className="skeleton" />
      </div>
    </section>
  );
}
