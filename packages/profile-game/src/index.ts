/**
 * @sceneaxi/profile-game — Game profile; pins a core range, compiles its policy in.
 *
 * First development consumer of the Profile Conformance suite (sceneaxi#10).
 * This is NOT a shipping/publication claim: held key `profile-rollout-order`
 * remains open. The package exposes a conformance surface so the shared suite
 * exercises kernel session + document propose/apply through this profile's
 * pinned core, plus evidence-hook presence.
 */
import {
  BOM_VERSION,
  KERNEL_VERSION,
  open,
  replay,
} from "@sceneaxi/engine-kernel";
import {
  apply,
  createDocument,
  propose,
  serializeDocument,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";
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
 * Versioned development-consumer claim. shippingClaim is false; cites
 * profile-rollout-order as open. Not a readiness or publication claim.
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
