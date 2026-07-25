/**
 * @sceneaxi/site-umbrella — the deployable umbrella site.
 *
 * A thin view + wiring layer over `@sceneaxi/site-kit`, which owns every
 * non-presentational behaviour and is tested in `pnpm gate`. This seam and the
 * `src/lib/` modules beside it are pure TypeScript, so the hermetic gate type-checks
 * them; only `src/app/` imports React or Next.
 *
 * `src/lib/identity-plane.ts` is the single documented plug point for
 * `@sceneaxi/auth` and `@sceneaxi/billing` when the identity plane lands.
 */
import type { PackageSeam } from "@sceneaxi/site-kit";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/site-umbrella",
  releaseGroup: "sites",
});

export {
  UMBRELLA_BRAND,
  resolveFamilyLinks,
  resolveUmbrellaEditorAccess,
  type FamilyLinks,
  type UmbrellaEditorAccess,
} from "./lib/site-config.js";

export {
  LIVE_OPEN_COPY,
  LIVE_OPEN_PATH,
  LIVE_OPEN_PRESENTATION,
  describePlacement,
  resolveLiveOpenScene,
  type LiveOpenInstance,
  type LiveOpenScene,
} from "./lib/live-open.js";

export {
  IDENTITY_PLANE_DOC,
  IDENTITY_PLANE_PENDING_NOTE,
  createUmbrellaIdentityPlane,
  resolveBillingMode,
  type IdentityPlaneAdapters,
  type UmbrellaIdentityPlane,
} from "./lib/identity-plane.js";
