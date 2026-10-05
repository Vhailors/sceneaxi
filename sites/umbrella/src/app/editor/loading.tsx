/** Accessible local Suspense fallback; no completed operation is implied. */
export default function LoadingEditor() {
  return (
    <section className="shell page page-loading page-narrow" role="status" aria-live="polite" aria-busy="true">
      <h1>Checking editor access</h1>
      <span className="loading-bar" aria-hidden="true" />
      <p className="lede">The editor opens only after its access decision succeeds.</p>
    </section>
  );
}
