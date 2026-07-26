/**
 * The storefront's identity plane, owned by `@sceneaxi/site-kit`.
 *
 * The behaviour is identical on both catalogs and is non-presentational, so it lives
 * in the package the gate tests rather than in a site-local copy per storefront. This
 * module stays as the site's named plug point: a deployment that supplies an adapter
 * still passes it to `createCatalogIdentityPlane` here, and the storefront takes no
 * second auth stack either way.
 */
export {
  CATALOG_IDENTITY_SURFACE,
  createCatalogIdentityPlane,
  resolveCatalogViewer,
  type CatalogIdentityPlane,
  type CatalogIdentityPlaneOptions,
} from "@sceneaxi/site-kit";
