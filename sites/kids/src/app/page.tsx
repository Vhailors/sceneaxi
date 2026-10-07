import { KidsStudio } from "./_components/kids-studio.js";

export default function KidsPage() {
  return (
    <main>
      <header className="intro">
        <p className="wordmark">
          <svg className="wordmark-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
          </svg>
          SceneAxi Kids
        </p>
        <h1>Make a tiny world</h1>
        <p className="lede">Pick a place. Add a few things. Press Play when it feels ready.</p>
      </header>

      <KidsStudio />
    </main>
  );
}
