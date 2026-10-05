/**
 * 404.
 *
 * Reached when a detail route calls `notFound()` after the catalog contract refused an
 * unknown item id — so the status code and the copy both say the same thing.
 */
export default function NotFound() {
  return (
    <div className="shell page page-state">
      <div className="page-head tone-accent">
        <h1>No listing with that id</h1>
        <p className="chip chip-accent">
          <span className="chip-dot" aria-hidden="true" />
          Not found
        </p>
      </div>
      <p className="lede">
        This storefront only publishes its own committed listings, so an id from another
        SceneAxi surface will not resolve here either.
      </p>
      <div className="actions">
        <a className="button button-lg" href="/">
          Back to the catalogue
        </a>
      </div>
    </div>
  );
}
