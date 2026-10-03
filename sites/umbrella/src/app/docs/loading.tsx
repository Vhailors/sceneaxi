/** Accessible local Suspense fallback; no completed operation is implied. */
export default function LoadingDocs() {
  return (
    <section className="shell page" role="status" aria-live="polite" aria-busy="true">
      <h1>Loading documentation</h1>
      <p>The source-backed guide is opening.</p>
    </section>
  );
}
