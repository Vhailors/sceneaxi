/**
 * 404.
 *
 * Reached when a detail route calls `notFound()` after the catalog contract refused an
 * unknown item id — so the status code and the copy both say the same thing.
 */
export default function NotFound() {
  return (
    <div className="shell page">
      <p className="eyebrow">Not found</p>
      <h1>No scene with that id</h1>
      <p className="lede">
        This showroom only publishes its own curated scenes, so an id from another
        SceneAxi surface will not resolve here either.
      </p>
      <div className="actions">
        <a className="button" href="/">
          Back to the showroom
        </a>
      </div>
    </div>
  );
}
