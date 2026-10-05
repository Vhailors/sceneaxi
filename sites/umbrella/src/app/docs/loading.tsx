/** Accessible local Suspense fallback; no completed operation is implied. */
export default function LoadingDocs() {
  return (
    <section className="shell page page-loading page-measure" role="status" aria-live="polite" aria-busy="true">
      <h1>Loading documentation</h1>
      <span className="loading-bar" aria-hidden="true" />
      <p className="lede">The source-backed guide is opening.</p>
    </section>
  );
}
