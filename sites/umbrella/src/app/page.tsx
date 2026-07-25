import {
  CREATOR_SHARE_ROUNDING_NOTE,
  CREATOR_SHARE_RULE,
  SITE_STARTER_CREDIT_ALLOTMENT,
} from "@sceneaxi/site-kit";
import { UMBRELLA_BRAND, resolveFamilyLinks } from "../lib/site-config.js";
import { CapabilityTable } from "./_components/capability-table.js";

export default function OverviewPage() {
  const family = resolveFamilyLinks(process.env);

  return (
    <>
      <p className="eyebrow">Interactive engine · versioned profiles</p>
      <h1>{UMBRELLA_BRAND.tagline}</h1>
      <p className="lede">{UMBRELLA_BRAND.summary}</p>

      <div className="actions">
        <a className="button" href="/engine">
          Download the engine SDK
        </a>
        <a className="button button-quiet" href="/docs">
          Read the contracts
        </a>
      </div>

      <h2>What the engine is</h2>
      <div className="grid">
        <article className="panel">
          <h3>Sculpt artifacts</h3>
          <p>
            An object is authored as a multi-pass sculpt and reconstructed
            deterministically for a fixed seed. The artifact&rsquo;s evidence binds its
            exact spec bytes, so nothing downstream may rewrite it.
          </p>
        </article>
        <article className="panel">
          <h3>Scene composition</h3>
          <p>
            Several artifacts compose into one openable scene. Placement is a
            projection: a child transform reads relative to its parent, and no artifact
            is edited to place it.
          </p>
        </article>
        <article className="panel">
          <h3>Profiles</h3>
          <p>
            A profile is a versioned policy over the core train, pinned by semver. Game
            and Web Experience ship here; Kids stays a fully separate origin with its own
            identity, data, and model routing.
          </p>
        </article>
        <article className="panel">
          <h3>Contracts, not conventions</h3>
          <p>
            Every artifact is validated against a versioned JSON contract. A different
            major is a refusal, never an implicit conversion.
          </p>
        </article>
      </div>

      <h2>What is free and what costs credits</h2>
      <p>
        The engine SDK download, the CLI, and bringing your own AI provider are free.
        Hosted AI and catalog assets are paid. New accounts receive{" "}
        <strong>{SITE_STARTER_CREDIT_ALLOTMENT} credits once</strong>.
      </p>
      <CapabilityTable />

      <h2>Catalogs</h2>
      <p>
        Two storefronts consume the same catalog pipeline with distinct positioning and
        content. Listings show a price in credits, in money, or both, and creators
        receive {CREATOR_SHARE_RULE.creatorPercent}% of the credits on a sale.
      </p>
      <p style={{ color: "var(--ink-faint)", fontSize: "0.9rem" }}>
        {CREATOR_SHARE_ROUNDING_NOTE}
      </p>
      {family.gameCatalog === null && family.webCatalog === null ? (
        <p style={{ color: "var(--ink-faint)" }}>
          Catalog origins are not configured for this deployment, so no catalog link is
          rendered rather than a broken one.
        </p>
      ) : (
        <div className="actions">
          {family.gameCatalog !== null && (
            <a className="button button-quiet" href={family.gameCatalog}>
              Game assets
            </a>
          )}
          {family.webCatalog !== null && (
            <a className="button button-quiet" href={family.webCatalog}>
              Website assets
            </a>
          )}
        </div>
      )}
    </>
  );
}
