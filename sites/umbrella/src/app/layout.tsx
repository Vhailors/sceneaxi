import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { LIVE_OPEN_PATH } from "../lib/live-open.js";
import { FOOTER_COLUMNS, RELEASE_MARKER } from "../lib/site-content.js";
import { UMBRELLA_BRAND, resolveFamilyLinks } from "../lib/site-config.js";
import { SiteNav, type NavItem } from "./_components/site-nav.js";
import "./globals.css";

/**
 * Archivo carries the product voice and JetBrains Mono carries anything the machine
 * produced — a digest, a refusal reason, an exit code. `next/font` self-hosts both from
 * this origin, so the site makes no runtime request to a font CDN and the faces are
 * size-adjusted against their fallbacks rather than reflowing on load.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "SceneAxi — interactive engine and library",
  description: UMBRELLA_BRAND.summary,
};

const NAV: readonly NavItem[] = [
  { href: "/", label: "Overview" },
  { href: LIVE_OPEN_PATH, label: "Open a scene" },
  { href: "/engine", label: "Engine SDK" },
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
];

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  // Family cross-links are ordinary links: the locked topology forbids carrying
  // identity, session, or telemetry across a surface boundary. Kids is never linked.
  const family = resolveFamilyLinks(process.env);
  const catalogs = [
    { href: family.gameCatalog, label: "Game assets", tone: "var(--game)" },
    { href: family.webCatalog, label: "Web assets", tone: "var(--web)" },
  ].filter((entry): entry is { href: string; label: string; tone: string } => entry.href !== null);

  return (
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>

        <header className="masthead">
          <div className="masthead-inner">
            <a className="wordmark" href="/">
              <span className="mark" aria-hidden="true" />
              SceneAxi
            </a>

            <SiteNav items={NAV} />

            <span className="masthead-spacer" />

            <div className="masthead-actions">
              {catalogs.map((catalog) => (
                <a className="store-link" key={catalog.label} href={catalog.href}>
                  <span className="dot" style={{ background: catalog.tone }} aria-hidden="true" />
                  {catalog.label}
                </a>
              ))}
              {catalogs.length > 0 && <span className="masthead-divider" aria-hidden="true" />}
              <a className="button button-quiet button-sm" href="/account">
                Account
              </a>
              <a className="button button-sm" href="/engine">
                Get the engine
              </a>
            </div>
          </div>
        </header>

        <main id="main">{children}</main>

        <footer>
          <div className="footer-inner">
            <div className="footer-brand">
              <span className="wordmark">
                <span className="mark mark-sm" aria-hidden="true" />
                SceneAxi
              </span>
              <p>{UMBRELLA_BRAND.tagline}</p>
              <p className="footer-version">{RELEASE_MARKER}</p>
            </div>

            {FOOTER_COLUMNS.map((column) => (
              <div className="footer-col" key={column.title}>
                <h2>{column.title}</h2>
                {column.items.map((item) => (
                  <a key={item.name} href={item.href}>
                    {item.name}
                  </a>
                ))}
              </div>
            ))}

            <div className="footer-col">
              <h2>Catalogs</h2>
              {catalogs.length > 0 ? (
                catalogs.map((catalog) => (
                  <a key={catalog.label} href={catalog.href}>
                    {catalog.label}
                  </a>
                ))
              ) : (
                <p className="footer-note">
                  No catalog origin is configured for this deployment, so no catalog link
                  is rendered rather than a broken one.
                </p>
              )}
            </div>
          </div>

          <div className="footer-base">
            <span>© 2026 SceneAxi</span>
            <span className="footer-iso">
              <span className="dot" aria-hidden="true" />
              Kids runs on its own origin. This site links to it from nowhere.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
