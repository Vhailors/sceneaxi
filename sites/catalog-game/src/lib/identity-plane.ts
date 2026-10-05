/** Server deployment composition only. No ambient cookie, Host or env lookup.
 * Approved configuration is injected by the deployment; default remains unwired.
 * Call resolveCatalogViewer with an explicitly carried server session credential.
 */
import { createCatalogServerIdentityPlane, type CatalogServerFetchOptions } from "@sceneaxi/site-kit/catalog-server-fetch";
export { resolveCatalogViewer } from "@sceneaxi/site-kit/catalog-identity";

export function createCatalogRequestIdentityPlane(options: CatalogServerFetchOptions = {}) {
  return createCatalogServerIdentityPlane(options);
}
