import type { Metadata } from "next";
import { CATALOG_SITE_BRAND, resolveUmbrellaOrigin } from "../lib/site-config.js";
import "./globals.css";

export const metadata: Metadata = {
  title: `${CATALOG_SITE_BRAND.name} — SceneAxi game assets`,
  description: CATALOG_SITE_BRAND.tagline,
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  // An ordinary cross-link, carrying no identity, session, or telemetry across the
  // surface boundary — and never pointing at Kids.
  const umbrella = resolveUmbrellaOrigin(process.env);

  return (
    <html lang="en">
      <body>
        <header className="masthead">
          <div className="masthead-inner">
            <a className="wordmark" href="/">
              {CATALOG_SITE_BRAND.name}
            </a>
            <nav className="nav" aria-label="Primary">
              <a href="/">Catalogue</a>
              <a href="/publish">Sell your work</a>
              {umbrella.ok && <a href={umbrella.value}>SceneAxi engine</a>}
            </nav>
          </div>
        </header>

        <main>
          <div className="shell">{children}</div>
        </main>

        <footer>
          <div className="shell">
            <p style={{ margin: 0 }}>
              {CATALOG_SITE_BRAND.name} is the SceneAxi game-asset storefront.{" "}
              {CATALOG_SITE_BRAND.audience}
            </p>
            {umbrella.ok ? (
              <p style={{ margin: "0.6rem 0 0" }}>
                The engine, its documentation, and the free SDK download live on{" "}
                <a href={umbrella.value}>the SceneAxi umbrella site</a>.
              </p>
            ) : (
              <p style={{ margin: "0.6rem 0 0" }}>
                The umbrella origin is not configured for this deployment, so no engine
                link is shown rather than a broken one.
              </p>
            )}
          </div>
        </footer>
      </body>
    </html>
  );
}
