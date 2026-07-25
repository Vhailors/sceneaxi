import type { Metadata } from "next";
import { LIVE_OPEN_PATH } from "../lib/live-open.js";
import { UMBRELLA_BRAND, resolveFamilyLinks } from "../lib/site-config.js";
import "./globals.css";

export const metadata: Metadata = {
  title: "SceneAxi — interactive engine and library",
  description: UMBRELLA_BRAND.summary,
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: LIVE_OPEN_PATH, label: "Open a scene" },
  { href: "/docs", label: "Docs" },
  { href: "/engine", label: "Engine SDK" },
  { href: "/pricing", label: "Pricing" },
  { href: "/editor", label: "Editor" },
  { href: "/account", label: "Account" },
] as const;

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  // Family cross-links are ordinary links: the locked topology forbids carrying
  // identity, session, or telemetry across a surface boundary. Kids is never linked.
  const family = resolveFamilyLinks(process.env);

  return (
    <html lang="en">
      <body>
        <header className="masthead">
          <div className="masthead-inner">
            <a className="wordmark" href="/">
              SceneAxi
            </a>
            <nav className="nav" aria-label="Primary">
              {NAV.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <main>
          <div className="shell">{children}</div>
        </main>

        <footer>
          <div className="shell">
            <p style={{ margin: 0 }}>
              SceneAxi is an interactive engine and library with versioned profiles. The
              engine SDK and the CLI are free.
            </p>
            {(family.gameCatalog !== null || family.webCatalog !== null) && (
              <p style={{ margin: "0.6rem 0 0" }}>
                Catalogs:{" "}
                {family.gameCatalog !== null && (
                  <a href={family.gameCatalog}>game assets</a>
                )}
                {family.gameCatalog !== null && family.webCatalog !== null && " · "}
                {family.webCatalog !== null && <a href={family.webCatalog}>website assets</a>}
              </p>
            )}
          </div>
        </footer>
      </body>
    </html>
  );
}
