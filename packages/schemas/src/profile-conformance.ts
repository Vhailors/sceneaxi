/**
 * Profile Conformance contract (v1) — what makes "every profile consumes one
 * agent-native core" testable (sceneaxi#10).
 *
 * A claim is versioned data; the shared suite that exercises kernel session,
 * document propose/apply, and evidence-hook presence lives in
 * profile-conformance-suite.ts. Shipping / rollout order remains the open
 * held key `profile-rollout-order` — never answered here.
 */

import type {
  FrameClock,
  KernelCommand,
  KernelSessionSaveArtifact,
  KernelSnapshot,
  ProductManifest,
} from "./kernel-session.js";
import type { SceneDocument } from "./document.js";
import type { ApplyResult, Proposal } from "./proposal.js";

/** Contract major version (schema const). */
export const PROFILE_CONFORMANCE_SCHEMA_VERSION = 1 as const;

export const PROFILE_CONFORMANCE_KIND = "sceneaxi.profile-conformance" as const;

/** Shared suite major version a claim targets. */
export const PROFILE_CONFORMANCE_SUITE_VERSION = 1 as const;

/** Open held key this contract cites and never answers. */
export const PROFILE_ROLLOUT_ORDER_HELD_KEY = "profile-rollout-order" as const;

export type ProfileClaimStatus = "development-consumer" | "not-yet-claimed";

export type ProfileEvidenceHook = {
  readonly name: string;
  readonly status: "declared";
};

export type ProfileEvidenceHooks = {
  readonly present: true;
  readonly hooks: ReadonlyArray<ProfileEvidenceHook>;
};

/**
 * Versioned Profile Conformance claim document.
 * shippingClaim is structurally false — no publication authority from this slice.
 */
export type ProfileConformanceClaim = {
  readonly schemaVersion: typeof PROFILE_CONFORMANCE_SCHEMA_VERSION;
  readonly kind: typeof PROFILE_CONFORMANCE_KIND;
  readonly profile: `@sceneaxi/profile-${string}`;
  readonly claimStatus: ProfileClaimStatus;
  readonly corePin: string;
  readonly suiteVersion: typeof PROFILE_CONFORMANCE_SUITE_VERSION;
  readonly evidenceHooks: ProfileEvidenceHooks;
  readonly heldKeysCited: ReadonlyArray<string>;
  readonly shippingClaim: false;
};

/**
 * Registry row for every known profile package. Web/Kids stay not-yet-claimed
 * so they do not fail (or pass) the suite; Game is the first development
 * consumer per the program's ticketing directive — not a shipping decision.
 */
export type ProfileConformanceRegistryEntry = {
  readonly profile: `@sceneaxi/profile-${string}`;
  readonly claimStatus: ProfileClaimStatus;
  /** Always cites the open hold; never resolves it. */
  readonly openHeldKey: typeof PROFILE_ROLLOUT_ORDER_HELD_KEY;
  readonly shippingClaim: false;
};

export const profileConformanceRegistry: ReadonlyArray<ProfileConformanceRegistryEntry> =
  Object.freeze([
    Object.freeze({
      profile: "@sceneaxi/profile-game",
      claimStatus: "development-consumer",
      openHeldKey: PROFILE_ROLLOUT_ORDER_HELD_KEY,
      shippingClaim: false as const,
    }),
    Object.freeze({
      profile: "@sceneaxi/profile-web",
      claimStatus: "not-yet-claimed",
      openHeldKey: PROFILE_ROLLOUT_ORDER_HELD_KEY,
      shippingClaim: false as const,
    }),
    Object.freeze({
      profile: "@sceneaxi/profile-kids",
      claimStatus: "not-yet-claimed",
      openHeldKey: PROFILE_ROLLOUT_ORDER_HELD_KEY,
      shippingClaim: false as const,
    }),
  ]);

/** Profile seam shape required on a conformance surface (mirrors ProfileSeam). */
export type ProfileConformanceSeam = {
  readonly name: `@sceneaxi/${string}`;
  readonly releaseGroup: "profile";
  readonly corePin: string;
};

/** Kernel seam shape the suite exercises through a profile's pinned core. */
export type ProfileCoreKernel = {
  readonly open: (
    productManifest: ProductManifest,
    host: { readonly nowMs: () => number },
  ) => {
    dispatch(command: KernelCommand): void;
    advance(clock: FrameClock): void;
    observe(): KernelSnapshot;
    save(): KernelSessionSaveArtifact;
  };
  readonly replay: (
    artifact: KernelSessionSaveArtifact,
    host: { readonly nowMs: () => number },
  ) => {
    observe(): KernelSnapshot;
  };
  readonly KERNEL_VERSION: string;
  readonly BOM_VERSION: string;
};

/** Document propose/apply seam the suite exercises through the profile. */
export type ProfileCoreAuthoring = {
  readonly createDocument: (input: {
    readonly id: string;
    readonly data?: Readonly<Record<string, unknown>>;
    readonly title?: string;
  }) => SceneDocument;
  readonly serializeDocument: (document: SceneDocument) => string;
  readonly writeDocumentFile: (
    path: string,
    document: SceneDocument,
  ) => { readonly ok: boolean; readonly contentHash?: string };
  readonly propose: (input: {
    readonly documentPath: string;
    readonly jsonPointer: string;
    readonly newValue: unknown;
    readonly cwd?: string;
  }) =>
    | {
        readonly ok: true;
        readonly proposal: Proposal;
        readonly unifiedDiff: string;
      }
    | {
        readonly ok: false;
        readonly diagnostics: ReadonlyArray<{
          readonly code: string;
          readonly message: string;
        }>;
      };
  readonly apply: (input: {
    readonly proposal: Proposal | string;
    readonly cwd?: string;
  }) => ApplyResult | { readonly ok: boolean; readonly diagnostics?: ReadonlyArray<unknown> };
};

/**
 * Surface a development-consumer profile exports so the shared suite can run
 * against any future profile package without suite changes.
 */
export type ProfileConformanceSurface = {
  readonly seam: ProfileConformanceSeam;
  readonly claim: ProfileConformanceClaim;
  readonly core: {
    readonly kernel: ProfileCoreKernel;
    readonly authoring: ProfileCoreAuthoring;
    readonly evidenceHooks: ProfileEvidenceHooks;
  };
};

export type ClaimValidationOk = {
  readonly ok: true;
  readonly claim: ProfileConformanceClaim;
};

export type ClaimValidationRefuse = {
  readonly ok: false;
  readonly code:
    | "not-object"
    | "schema-major-mismatch"
    | "invalid-claim"
    | "shipping-claim-forbidden"
    | "missing-held-key-citation";
  readonly message: string;
  readonly foundSchemaVersion?: number;
};

export type ClaimValidationResult = ClaimValidationOk | ClaimValidationRefuse;

const PROFILE_NAME_RE = /^@sceneaxi\/profile-[a-z][a-z0-9-]*$/;
const CORE_PIN_RE = /^[\^~>=<0-9xX*.\s|-]+$/;
const HOOK_NAME_RE = /^[a-z][a-z0-9-]*$/;
const HELD_KEY_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Validate an unknown value as a Profile Conformance claim.
 * Fail-closed: shippingClaim true, missing profile-rollout-order citation,
 * and major mismatches all refuse.
 */
export function validateProfileConformanceClaim(
  value: unknown,
): ClaimValidationResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      code: "not-object",
      message: "Profile Conformance claim must be a JSON object.",
    };
  }

  const raw = value as Record<string, unknown>;

  if (!Object.hasOwn(raw, "schemaVersion")) {
    return {
      ok: false,
      code: "invalid-claim",
      message: 'Claim missing required property "schemaVersion".',
    };
  }

  const schemaVersion = raw["schemaVersion"];
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion)) {
    return {
      ok: false,
      code: "invalid-claim",
      message: "Claim schemaVersion must be an integer.",
    };
  }

  if (schemaVersion !== PROFILE_CONFORMANCE_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "schema-major-mismatch",
      message: `Profile Conformance schema major mismatch: found ${schemaVersion}, expected ${PROFILE_CONFORMANCE_SCHEMA_VERSION}. Silent migration is refused.`,
      foundSchemaVersion: schemaVersion,
    };
  }

  if (raw["kind"] !== PROFILE_CONFORMANCE_KIND) {
    return {
      ok: false,
      code: "invalid-claim",
      message: `Claim kind must be "${PROFILE_CONFORMANCE_KIND}".`,
    };
  }

  const profile = raw["profile"];
  if (typeof profile !== "string" || !PROFILE_NAME_RE.test(profile)) {
    return {
      ok: false,
      code: "invalid-claim",
      message: "Claim profile must be an @sceneaxi/profile-* package name.",
    };
  }

  const claimStatus = raw["claimStatus"];
  if (
    claimStatus !== "development-consumer" &&
    claimStatus !== "not-yet-claimed"
  ) {
    return {
      ok: false,
      code: "invalid-claim",
      message:
        'Claim claimStatus must be "development-consumer" or "not-yet-claimed".',
    };
  }

  const corePin = raw["corePin"];
  if (
    typeof corePin !== "string" ||
    corePin.length === 0 ||
    !CORE_PIN_RE.test(corePin)
  ) {
    return {
      ok: false,
      code: "invalid-claim",
      message: "Claim corePin must be a non-empty semver range string.",
    };
  }

  if (raw["suiteVersion"] !== PROFILE_CONFORMANCE_SUITE_VERSION) {
    return {
      ok: false,
      code: "invalid-claim",
      message: `Claim suiteVersion must be ${PROFILE_CONFORMANCE_SUITE_VERSION}.`,
    };
  }

  if (raw["shippingClaim"] !== false) {
    return {
      ok: false,
      code: "shipping-claim-forbidden",
      message:
        "shippingClaim must be false. Profile Conformance never authorizes shipping or publication.",
    };
  }

  const heldKeysCited = raw["heldKeysCited"];
  if (!Array.isArray(heldKeysCited) || heldKeysCited.length === 0) {
    return {
      ok: false,
      code: "invalid-claim",
      message: "Claim heldKeysCited must be a non-empty array.",
    };
  }
  for (const key of heldKeysCited) {
    if (typeof key !== "string" || !HELD_KEY_RE.test(key)) {
      return {
        ok: false,
        code: "invalid-claim",
        message: "Claim heldKeysCited entries must be held-key slugs.",
      };
    }
  }
  if (!heldKeysCited.includes(PROFILE_ROLLOUT_ORDER_HELD_KEY)) {
    return {
      ok: false,
      code: "missing-held-key-citation",
      message: `Claim heldKeysCited MUST include open key "${PROFILE_ROLLOUT_ORDER_HELD_KEY}".`,
    };
  }

  const evidenceHooks = raw["evidenceHooks"];
  if (
    evidenceHooks === null ||
    typeof evidenceHooks !== "object" ||
    Array.isArray(evidenceHooks)
  ) {
    return {
      ok: false,
      code: "invalid-claim",
      message: "Claim evidenceHooks must be an object.",
    };
  }
  const hooksObj = evidenceHooks as Record<string, unknown>;
  if (hooksObj["present"] !== true) {
    return {
      ok: false,
      code: "invalid-claim",
      message: "Claim evidenceHooks.present must be true.",
    };
  }
  const hooks = hooksObj["hooks"];
  if (!Array.isArray(hooks) || hooks.length === 0) {
    return {
      ok: false,
      code: "invalid-claim",
      message: "Claim evidenceHooks.hooks must be a non-empty array.",
    };
  }
  const normalizedHooks: ProfileEvidenceHook[] = [];
  for (const hook of hooks) {
    if (hook === null || typeof hook !== "object" || Array.isArray(hook)) {
      return {
        ok: false,
        code: "invalid-claim",
        message: "Each evidence hook must be an object.",
      };
    }
    const h = hook as Record<string, unknown>;
    if (typeof h["name"] !== "string" || !HOOK_NAME_RE.test(h["name"])) {
      return {
        ok: false,
        code: "invalid-claim",
        message: "Evidence hook name must be a lowercase slug.",
      };
    }
    if (h["status"] !== "declared") {
      return {
        ok: false,
        code: "invalid-claim",
        message:
          'Evidence hook status must be "declared" in this suite version.',
      };
    }
    normalizedHooks.push({ name: h["name"], status: "declared" });
  }

  const known = new Set([
    "schemaVersion",
    "kind",
    "profile",
    "claimStatus",
    "corePin",
    "suiteVersion",
    "evidenceHooks",
    "heldKeysCited",
    "shippingClaim",
  ]);
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) {
      return {
        ok: false,
        code: "invalid-claim",
        message: `Claim has unexpected property "${key}".`,
      };
    }
  }

  const claim: ProfileConformanceClaim = {
    schemaVersion: PROFILE_CONFORMANCE_SCHEMA_VERSION,
    kind: PROFILE_CONFORMANCE_KIND,
    profile: profile as `@sceneaxi/profile-${string}`,
    claimStatus,
    corePin,
    suiteVersion: PROFILE_CONFORMANCE_SUITE_VERSION,
    evidenceHooks: {
      present: true,
      hooks: Object.freeze(normalizedHooks),
    },
    heldKeysCited: Object.freeze([...heldKeysCited]) as ReadonlyArray<string>,
    shippingClaim: false,
  };

  return { ok: true, claim };
}

/** Factory for a valid claim (fixtures / profile packages). */
export function createProfileConformanceClaim(input: {
  readonly profile: `@sceneaxi/profile-${string}`;
  readonly claimStatus: ProfileClaimStatus;
  readonly corePin: string;
  readonly evidenceHooks?: ProfileEvidenceHooks;
}): ProfileConformanceClaim {
  const evidenceHooks: ProfileEvidenceHooks = input.evidenceHooks ?? {
    present: true,
    hooks: Object.freeze([
      Object.freeze({
        name: "kernel-session-save",
        status: "declared" as const,
      }),
      Object.freeze({ name: "document-apply", status: "declared" as const }),
    ]),
  };

  return Object.freeze({
    schemaVersion: PROFILE_CONFORMANCE_SCHEMA_VERSION,
    kind: PROFILE_CONFORMANCE_KIND,
    profile: input.profile,
    claimStatus: input.claimStatus,
    corePin: input.corePin,
    suiteVersion: PROFILE_CONFORMANCE_SUITE_VERSION,
    evidenceHooks: Object.freeze({
      present: true as const,
      hooks: Object.freeze([...evidenceHooks.hooks]),
    }),
    heldKeysCited: Object.freeze([PROFILE_ROLLOUT_ORDER_HELD_KEY]),
    shippingClaim: false as const,
  });
}

export function registryEntryFor(
  profile: string,
): ProfileConformanceRegistryEntry | undefined {
  return profileConformanceRegistry.find((e) => e.profile === profile);
}
