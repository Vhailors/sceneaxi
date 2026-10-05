import { CATALOG_SITE_BRAND } from "../lib/site-config.js";

/**
 * 404.
 *
 * Reached when a detail route calls `notFound()` after the catalog contract refused an
 * unknown item id — so the status code and the copy both say the same thing.
 */
export default function NotFound() {
  const catalogue = CATALOG_SITE_BRAND.catalogueWord.toLowerCase();

  // An Operate state route: the H1 leads, its status chip follows on the same row, and a
  // 2px accent mark under the head draws once (DIRECTION row 13). Nothing rises.
  return (
    <div className="shell page page-state">
      <div className="page-head tone-accent">
        <h1>No {CATALOG_SITE_BRAND.listingWord} with that id</h1>
        <p className="chip chip-accent">
          <span className="chip-dot" aria-hidden="true" />
          Not found
        </p>
      </div>
      <p className="lede">
        This {catalogue} only publishes its own committed{" "}
        {CATALOG_SITE_BRAND.listingWordPlural}, so an id from another SceneAxi surface will
        not resolve here either.
      </p>
      <div className="actions">
        <a className="button button-xl" href="/">
          Back to the {catalogue}
        </a>
      </div>
    </div>
  );
}
