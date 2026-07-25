/**
 * @sceneaxi/auth — the SceneAxi identity plane.
 *
 * Owns single-admin resolution from the environment, fail-closed role guards,
 * and the identity port. Better Auth and Neon are injected adapters, never
 * dependencies: see docs/auth-credits.md for the wiring, and ADR 0021 for why.
 *
 * The plane depends only on `@sceneaxi/schemas`. It has no engine, profile, or
 * CLI dependency, and it does not touch held-key captain policy.
 */

import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/auth",
  releaseGroup: "identity",
});

export {
  ADMIN_EMAIL_ENV_VAR,
  MULTI_ADMIN_ENV_VARS,
  isPlausibleEmail,
  normalizeEmail,
  resolveAdminIdentity,
  type AdminIdentity,
  type EnvLike,
} from "./admin.js";

export {
  AUTH_REFUSE_REASONS,
  authOk,
  authRefuse,
  type AuthOk,
  type AuthRefuse,
  type AuthRefuseReason,
  type AuthResult,
} from "./refusals.js";

export {
  SESSION_TOKEN_DIGEST_LENGTH,
  digestSessionToken,
  sessionTokenMatches,
} from "./session-token.js";

export {
  refuseUnverifiedAdmin,
  requireAuthenticated,
  requireRole,
  resolveRole,
  type GuardOptions,
  type ResolveRoleInput,
} from "./roles.js";

export {
  createInMemoryIdentityStore,
  type Awaitable,
  type IdentityStore,
  type InMemoryIdentityStore,
  type InMemoryIdentityStoreOptions,
} from "./store.js";

export {
  createBetterAuthIdentityAdapter,
  mapBetterAuthAuthentication,
  type BetterAuthAuthentication,
  type BetterAuthInstanceLike,
  type BetterAuthSessionLike,
  type BetterAuthUserLike,
  type IdentityAdapter,
  type IdentityCredentials,
  type MappedAuthentication,
} from "./better-auth-adapter.js";

export {
  createIdentityPort,
  type CreateIdentityPortOptions,
  type IdentityPort,
  type SignInRequest,
  type SignOutRequest,
  type VerifySessionRequest,
} from "./identity-port.js";

export {
  planAdminBootstrap,
  type AdminBootstrapPlan,
  type PlanAdminBootstrapInput,
} from "./bootstrap.js";
