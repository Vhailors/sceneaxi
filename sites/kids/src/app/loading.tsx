/** Accessible local Suspense fallback; no completed operation is implied. */
export default function LoadingPlaySpace() {
  return (
    <section className="intro loading-intro" role="status" aria-live="polite" aria-busy="true">
      <h1>Opening your play space</h1>
      <p className="lede">Your local tiny world will be ready soon.</p>
      <span className="loading-bar" aria-hidden="true" />
    </section>
  );
}
