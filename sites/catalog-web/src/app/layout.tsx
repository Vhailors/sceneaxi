import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import {
  CATALOG_SITE_BRAND,
  CATALOG_SITE_FOUNDATION_SURFACE,
  CATALOG_SITE_SURFACE,
  resolveUmbrellaOrigin,
} from "../lib/site-config.js";
import { foundationsStylesheet } from "../lib/foundations.js";
import { resolveFamilyBar, resolveStoreDomain } from "../lib/family-bar.js";
import { FamilyBar } from "./_components/family-bar.js";
import "./globals.css";

/**
 * Foundations v2 names Archivo and JetBrains Mono, and a package must not inject a network
 * font, so the site loads them itself. `next/font` self-hosts both at build time, which
 * keeps the deployed storefront free of a third-party font request at runtime.
 */
const archivo = Archivo({ subsets: ["latin"], display: "swap", variable: "--site-font-ui" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--site-font-mono",
});

/**
 * The shared token layer, emitted by `@sceneaxi/site-kit` for this storefront's surface.
 *
 * Fail-closed: an unresolved surface serves no stylesheet at all rather than letting the
 * storefront render in some other surface's accent, and the named reason goes into the
 * document so the refusal is legible instead of silent. The narrowed `StorefrontSurface`
 * type means neither storefront can reach that branch, which is the point: the refusal is
 * the floor under a type, not a runtime path the site relies on.
 */
const foundations = foundationsStylesheet(CATALOG_SITE_FOUNDATION_SURFACE);

export const metadata: Metadata = {
  title: `${CATALOG_SITE_BRAND.name} — SceneAxi website assets`,
  description: CATALOG_SITE_BRAND.tagline,
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  // Ordinary cross-links, carrying no identity, session, or telemetry across the surface
  // boundary — and never pointing at Kids.
  const umbrella = resolveUmbrellaOrigin(process.env);
  const family = resolveFamilyBar(process.env, CATALOG_SITE_SURFACE);
  const domain = resolveStoreDomain(process.env, CATALOG_SITE_SURFACE);

  return (
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
      <head>
        {foundations.ok ? (
          <style
            data-sceneaxi-foundations="v2"
            // The stylesheet is generated CSS text from a frozen token table in
            // `@sceneaxi/site-kit`; no request, route parameter, or catalog value reaches it.
            dangerouslySetInnerHTML={{ __html: foundations.value }}
          />
        ) : (
          <meta name="sceneaxi-foundations-refused" content={foundations.reason} />
        )}
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to the showroom
        </a>

        <FamilyBar entries={family} domain={domain} />

        <header className="masthead">
          <div className="shell masthead-inner">
            <a className="storemark" href="/">
              <span className="storemark-glyph" aria-hidden="true" />
              <span className="storemark-text">
                <span className="storename">{CATALOG_SITE_BRAND.name}</span>
                <span className="storetag">{CATALOG_SITE_BRAND.storeTag}</span>
              </span>
            </a>
            <nav className="nav" aria-label="Primary">
              <a href="/">{CATALOG_SITE_BRAND.catalogueWord}</a>
              <a href="/publish">Submit a scene</a>
              {umbrella.ok && <a href={umbrella.value}>SceneAxi engine</a>}
            </nav>
          </div>
        </header>

        <main id="main">{children}</main>

        <footer className="footer">
          <div className="shell footer-inner">
            <div className="footer-brand">
              <p className="footer-brand-row">
                <span className="footer-glyph" aria-hidden="true" />
                {CATALOG_SITE_BRAND.name}
              </p>
              <p className="footer-blurb">
                The SceneAxi website-asset storefront. {CATALOG_SITE_BRAND.audience}
              </p>
            </div>

            <div className="footer-cols">
              <div className="footer-col">
                <p className="micro">Browse</p>
                <ul>
                  <li>
                    <a href="/">{CATALOG_SITE_BRAND.catalogueWord}</a>
                  </li>
                  <li>
                    <a href="/#pricing">How pricing reads</a>
                  </li>
                </ul>
              </div>
              <div className="footer-col">
                <p className="micro">Submit</p>
                <ul>
                  <li>
                    <a href="/publish">Submit a scene</a>
                  </li>
                  <li>
                    <a href="/publish#requirements">What submission will require</a>
                  </li>
                </ul>
              </div>
              <div className="footer-col">
                <p className="micro">SceneAxi</p>
                <ul>
                  <li>
                    {umbrella.ok ? (
                      <a href={umbrella.value}>The engine and the SDK</a>
                    ) : (
                      <span>Engine origin not configured for this deployment</span>
                    )}
                  </li>
                </ul>
              </div>
            </div>

            <div className="footer-card">
              <p>
                <strong>Show what you build</strong>
              </p>
              <p className="footer-blurb">
                Submission will be reviewed against the scene&apos;s own evidence, not
                its render. Publishing is not open yet, so the share rule and what a
                listing would pay are published ahead of it.
              </p>
              <a className="button button-quiet" href="/publish">
                Read the submission rules
              </a>
            </div>
          </div>

          <div className="shell footer-base">
            <span>© 2026 SceneAxi</span>
            <span className="footer-note">
              A separate storefront from Game assets — its own origin and its own
              catalogue.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
