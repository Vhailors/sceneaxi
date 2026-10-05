/** Suspense fallback; no listing counts, prices or successful purchase are invented. */
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
