import { KidsStudio } from "./_components/kids-studio.js";

export default function KidsPage() {
  return (
    <main>
      <header className="intro">
        <p className="wordmark">
          <span aria-hidden="true">✦</span> SceneAxi Kids
        </p>
        <h1>Make a tiny world</h1>
        <p>Pick a place. Add a few things. Press Play when it feels ready.</p>
      </header>

      <KidsStudio />
    </main>
  );
}
