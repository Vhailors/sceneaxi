/**
 * 404.
 *
 * Reached when a detail route calls `notFound()` after the catalog contract refused an
 * unknown item id — so the status code and the copy both say the same thing.
 */
export default function NotFound() {
  return (
    <>
      <p className="eyebrow">Not found</p>
      <h1>No listing with that id</h1>
      <p className="lede">
        This storefront only publishes its own curated listings, so an id from another
        SceneAxi surface will not resolve here either.
      </p>
      <div className="actions">
        <a className="button" href="/">
          Back to the catalogue
        </a>
      </div>
    </>
  );
}
