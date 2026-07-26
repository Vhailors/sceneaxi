/**
 * @sceneaxi/profile-game — Game profile; pins a core range, compiles its policy in.
 *
 * First development consumer of the Profile Conformance suite (sceneaxi#10).
 * This is NOT a shipping/publication claim. The package exposes a conformance
 * surface so the shared suite exercises kernel session + document propose/apply
 * through this profile's pinned core, plus evidence-hook presence.
 */
import {
  BOM_VERSION,
  KERNEL_VERSION,
  open,
  replay,
} from "@sceneaxi/engine-kernel";
import {
  bootstrapOpenPath,
  resumeOpenPath,
} from "@sceneaxi/engine-orchestrator";
import {
  apply,
  composeScene,
  createDocument,
  propose,
  serializeDocument,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";
import {
  createThreeSculptPresentationBackend,
  createNullPresentationRuntime,
  createSculptMountApi,
} from "@sceneaxi/engine-presentation";
import {
  createProfileConformanceClaim,
  type ProfileConformanceSurface,
  type ProfileEvidenceHooks,
  type ProfileSeam,
} from "@sceneaxi/schemas";

/** Core-train semver range this profile pins (must match package.json sceneaxi.corePin). */
export const CORE_PIN = "^0.0.0" as const;

export const seam: ProfileSeam = Object.freeze({
  name: "@sceneaxi/profile-game",
  releaseGroup: "profile",
  corePin: CORE_PIN,
});

/**
 * Declared evidence hooks. Full Evidence Packet emission is a later ticket;
 * the shared suite only requires presence of these declared hooks.
 */
export const evidenceHooks: ProfileEvidenceHooks = Object.freeze({
  present: true as const,
  hooks: Object.freeze([
    Object.freeze({
      name: "kernel-session-save",
      status: "declared" as const,
    }),
    Object.freeze({
      name: "document-apply",
      status: "declared" as const,
    }),
  ]),
});

/**
 * Versioned development-consumer claim. shippingClaim is false; retains the
 * profile-rollout-order decision citation. Not a readiness or publication claim.
 */
export const claim = createProfileConformanceClaim({
  profile: "@sceneaxi/profile-game",
  claimStatus: "development-consumer",
  corePin: CORE_PIN,
  evidenceHooks,
});

/**
 * Conformance surface for the shared suite. Future profiles export the same
 * shape; the suite does not change when pointed at them.
 */
export const conformance: ProfileConformanceSurface = Object.freeze({
  seam,
  claim,
  core: Object.freeze({
    kernel: Object.freeze({
      open,
      replay,
      KERNEL_VERSION,
      BOM_VERSION,
    }),
    authoring: Object.freeze({
      createDocument,
      serializeDocument,
      writeDocumentFile,
      propose,
      apply,
    }),
    evidenceHooks,
  }),
});

/**
 * Development-only multi-object scene path for the Game profile.
 *
 * The Profile Conformance surface above is a fixed contract shape and stays
 * single-object; this is the separate pin that lets the Game profile drive the
 * composition vertical (sceneaxi#113) end to end: compose Sculpt Artifacts →
 * project a document → mount N instances → open, advance, save, and replay a
 * scene kernel session.
 *
 * Like `@sceneaxi/profile-web`'s `mvpGoldenPath`, this is **not** a Profile
 * Conformance registry claim and describes no shipped product: `shippingClaim`
 * stays false. Everything reachable from here is offline and deterministic —
 * no provider, no network, no seed drawn at runtime.
 *
 * The scene session is opened through `@sceneaxi/engine-orchestrator` and no
 * kernel scene entry point is pinned beside it, so this path cannot quietly
 * revert to calling the kernel directly (sceneaxi#134, superseding the #60 stub
 * disposition). Kernel authority is unchanged: the orchestrator hands back the
 * kernel's own session.
 */
export const sceneGoldenPath = Object.freeze({
  seam,
  status: Object.freeze({
    developmentConsumer: true as const,
    shippingClaim: false as const,
    productSurface: "not-shipped" as const,
  }),
  core: Object.freeze({
    authoring: Object.freeze({
      composeScene,
      createDocument,
      writeDocumentFile,
      propose,
      apply,
    }),
    orchestrator: Object.freeze({
      bootstrapOpenPath,
      resumeOpenPath,
    }),
    kernel: Object.freeze({
      KERNEL_VERSION,
      BOM_VERSION,
    }),
    presentation: Object.freeze({
      createNullPresentationRuntime,
      createSculptMountApi,
      createThreeSculptPresentationBackend,
    }),
  }),
});
