/**
 * Suspense fallback; no listing counts, prices or successful purchase are invented.
 *
 * The heading, its Dormant chip and the lede are visible at once. A 2px bar and three
 * final-size skeleton blocks (`aria-hidden`) start moving only after the loading delay,
 * so a fast response never flashes them (ruling R-1).
 */
export default function LoadingCatalog() {
  return (
    <section className="shell page page-state" role="status" aria-live="polite" aria-busy="true">
      <div className="page-head tone-dormant">
        <h1>Loading catalogue</h1>
        <p className="chip chip-dormant">
          <span className="chip-dot" aria-hidden="true" />
          Read-only catalogue
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
