/** Accessible local Suspense fallback; no completed operation is implied. */
export default function LoadingEditor() {
  return (
    <section className="shell page" role="status" aria-live="polite" aria-busy="true">
      <h1>Checking editor access</h1>
      <p>The editor opens only after its access decision succeeds.</p>
    </section>
  );
}
