/** Suspense fallback; no listing counts, prices or successful purchase are invented. */
export default function LoadingCatalog() {
  return (
    <section className="shell page" role="status" aria-live="polite" aria-busy="true">
      <p className="eyebrow">Read-only catalogue</p>
      <h1>Loading catalogue</h1>
      <p className="lede">The listing view is opening. No purchase is being made.</p>
    </section>
  );
}
