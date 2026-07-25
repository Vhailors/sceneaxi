/**
 * @sceneaxi/site-catalog-game — the deployable game-asset catalog site.
 *
 * A thin view + wiring layer over `@sceneaxi/site-kit`, which owns every
 * non-presentational behaviour and is tested in `pnpm gate`. This seam and the
 * `src/lib/` modules beside it are pure TypeScript, so the hermetic gate type-checks
 * them; only `src/app/` imports React or Next.
 */
import type { PackageSeam } from "@sceneaxi/site-kit";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/site-catalog-game",
  releaseGroup: "sites",
});

export {
  CATALOG_SITE_BRAND,
  CATALOG_SITE_SURFACE,
  editorLinkFor,
  resolveUmbrellaOrigin,
  type UmbrellaOrigin,
} from "./lib/site-config.js";
