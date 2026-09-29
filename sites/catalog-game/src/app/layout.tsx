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
import { StoreNav } from "./_components/store-nav.js";
import "./globals.css";

/**
 * Foundations v2 names Archivo and JetBrains Mono, and a package must not inject a network
 * font, so the site loads them itself. `next/font` self-hosts both at build time, which
 * keeps the deployed storefront free of a third-party font request at runtime. Archivo
 * keeps its width axis, which the Foundations display step is specified against.
 */
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--site-font-ui",
  axes: ["wdth"],
});
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

/**
 * The chrome copy this storefront words differently from its sibling. It is the only
 * part of this file that differs between the two storefronts; everything below it is the
 * shared skeleton, reading these words and `CATALOG_SITE_BRAND`.
 */
const STORE_COPY = Object.freeze({
  metadataTitle: `${CATALOG_SITE_BRAND.name} — SceneAxi game assets`,
  surfaceBlurb: "The SceneAxi game-asset storefront.",
  publishLabel: "Sell your work",
  publishGroup: "Sell",
  publishRules: "What listing will require",
  cardTitle: "Sell what you sculpt",
  cardBody:
    "Listing will be reviewed against the artifact's own evidence, not its render. Publishing is not open yet, so the share rule and what a listing would pay are published ahead of it.",
  cardAction: "Read the listing rules",
  baseNote: "A separate storefront from Web assets — its own origin and its own catalogue.",
});

export const metadata: Metadata = {
  title: STORE_COPY.metadataTitle,
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
          Skip to the {CATALOG_SITE_BRAND.catalogueWord.toLowerCase()}
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
            <StoreNav
              catalogueLabel={CATALOG_SITE_BRAND.catalogueWord}
              publishLabel={STORE_COPY.publishLabel}
              engine={umbrella.ok ? { href: umbrella.value, label: "SceneAxi engine" } : null}
            />
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
                {STORE_COPY.surfaceBlurb} {CATALOG_SITE_BRAND.audience}
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
                    <a href="/#pricing">{CATALOG_SITE_BRAND.heroSecondaryCta}</a>
                  </li>
                </ul>
              </div>
              <div className="footer-col">
                <p className="micro">{STORE_COPY.publishGroup}</p>
                <ul>
                  <li>
                    <a href="/publish">{STORE_COPY.publishLabel}</a>
                  </li>
                  <li>
                    <a href="/publish#requirements">{STORE_COPY.publishRules}</a>
                  </li>
                </ul>
              </div>
              <div className="footer-col">
                <p className="micro">SceneAxi</p>
                <ul>
                  <li>
                    {umbrella.ok ? (
                      <a href={umbrella.value}>
                        The engine and the SDK
                        <span className="glyph" aria-hidden="true">
                          ↗
                        </span>
                      </a>
                    ) : (
                      <span>Engine origin not configured for this deployment</span>
                    )}
                  </li>
                </ul>
              </div>
            </div>

            <div className="footer-card">
              <p className="footer-card-title">{STORE_COPY.cardTitle}</p>
              <p className="footer-blurb">{STORE_COPY.cardBody}</p>
              <a className="button button-quiet" href="/publish">
                {STORE_COPY.cardAction}
              </a>
            </div>
          </div>

          <div className="shell footer-base">
            <span>© 2026 SceneAxi</span>
            <span className="footer-note">{STORE_COPY.baseNote}</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
