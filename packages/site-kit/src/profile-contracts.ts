/**
 * Browser-safe profile contract values for the first-party sites tier.
 *
 * Keep this as a narrow entry point: the site-kit root barrel also exports
 * server-only helpers, while these values are plain frozen data owned by
 * `@sceneaxi/schemas`.
 */
export {
  OPEN_PATH_DEMO_OPERATIONS,
  OPEN_PATH_POLICY,
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  profileConformanceRegistry,
} from "@sceneaxi/schemas";

export type {
  OpenPathDemoLevel,
  OpenPathDemoOperation,
  OpenPathPolicyRow,
  OpenPathSessionKind,
  ProfileClaimStatus,
} from "@sceneaxi/schemas";
