/**
 * The `/profiles` capability matrix — derived from the contracts, never written down.
 *
 * The accepted screen draws a full 3 × 10 Game/Web/Kids capability grid with ticks in
 * most cells. Drawing that would overclaim: `profileConformanceRegistry` marks Web and
 * Kids `not-yet-claimed`, `shippingClaim` is structurally `false` on every row of both
 * contracts, and `docs/open-path-policy.md` holds Kids `refuse-only`. So the matrix that
 * ships is the reduced, truthful one (decision D3): the six ADR 0001 Kernel-seam
 * operations, each cell answered by the policy rather than by a page author.
 *
 * ## Why the contract data cannot drift here
 *
 * Both owners live in `@sceneaxi/schemas`, and the umbrella may reach them only through
 * the narrow, browser-safe `@sceneaxi/site-kit/profile-contracts` entry. That entry
 * re-exports the canonical frozen objects rather than copying them. This module joins
 * those objects into the page projection and refuses module initialization if the two
 * profile sets disagree, so contract drift cannot leave a stale page-local table behind.
 *
 * ## Why a hand edit here cannot overclaim
 *
 * The projection carries **no cell**. Every cell is computed by
 * `profileCapabilityStatus()` below, whose branches make `proven` unreachable for a
 * refuse-only profile and for a profile that is not a development consumer — so granting
 * a tick would take editing the derivation, not the data, and the derivation is what the
 * test exercises.
 */

import {
  OPEN_PATH_DEMO_OPERATIONS,
  OPEN_PATH_POLICY,
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  profileConformanceRegistry,
  type OpenPathDemoLevel,
  type OpenPathDemoOperation,
  type OpenPathPolicyRow,
  type OpenPathSessionKind,
  type ProfileClaimStatus,
} from "@sceneaxi/site-kit/profile-contracts";

export type ProfileDemoLevel = OpenPathDemoLevel;
export type ProfileSessionKind = OpenPathSessionKind;
export type ProfileOperation = OpenPathDemoOperation;
export type { ProfileClaimStatus };

/**
 * The six operations, in the contract's canonical order. This is the whole column set:
 * the matrix has no column for a capability no contract grades.
 */
export const PROFILE_OPERATIONS: readonly ProfileOperation[] =
  OPEN_PATH_DEMO_OPERATIONS;

/** What each column means, in the vocabulary ADR 0001 already uses. */
export const PROFILE_OPERATION_COPY: Readonly<Record<ProfileOperation, string>> =
  Object.freeze({
    open: "Open a session from a product manifest",
    dispatch: "Dispatch a command into the session",
    advance: "Advance one frame — the only mutating call",
    observe: "Observe an immutable snapshot",
    save: "Save a session artifact",
    replay: "Replay an artifact and refuse on digest drift",
  });

/** One profile, exactly as the two contracts state it. No cell, no verdict. */
export type ProfileMatrixSource = Readonly<
  OpenPathPolicyRow & {
    /** Display name. Presentation only — it decides nothing. */
    readonly name: string;
    readonly claimStatus: ProfileClaimStatus;
  }
>;

/**
 * Presentation-only display labels, pinned one per profile id. They decide no claim, and
 * they are written down rather than derived from the package id: a label munged from an
 * id would silently invent copy for a profile nobody has written copy for. A profile the
 * contracts carry but this map does not refuses at module initialization, so adding a
 * policy row means deciding its label rather than shipping a guess.
 */
const PROFILE_DISPLAY_NAMES: ReadonlyMap<string, string> = new Map([
  ["@sceneaxi/profile-game", "Game"],
  ["@sceneaxi/profile-web", "Web experience"],
  ["@sceneaxi/profile-kids", "Kids"],
]);

export function profileDisplayName(profile: string) {
  const name = PROFILE_DISPLAY_NAMES.get(profile);
  if (name === undefined) {
    throw new Error(
      `The /profiles matrix refuses an unknown profile: ${profile} has no pinned display name.`,
    );
  }
  return name;
}

const registryByProfile = new Map(
  profileConformanceRegistry.map((entry) => [entry.profile, entry] as const),
);
const policyProfiles = new Set(OPEN_PATH_POLICY.map((row) => row.profile));

if (
  registryByProfile.size !== OPEN_PATH_POLICY.length ||
  profileConformanceRegistry.some((entry) => !policyProfiles.has(entry.profile))
) {
  throw new Error(
    "The /profiles matrix refuses contract drift: profile conformance and open-path policy profile sets differ.",
  );
}

/** The page source is computed directly from the canonical contracts; no mirror remains. */
export const PROFILE_MATRIX_SOURCE: readonly ProfileMatrixSource[] = Object.freeze(
  OPEN_PATH_POLICY.map((policy) => {
    const registryEntry = registryByProfile.get(policy.profile);
    if (registryEntry === undefined) {
      throw new Error(
        `The /profiles matrix refuses contract drift: ${policy.profile} has policy but no conformance registry row.`,
      );
    }
    return Object.freeze({
      ...policy,
      name: profileDisplayName(policy.profile),
      claimStatus: registryEntry.claimStatus,
    });
  }),
);

/**
 * What one cell may say. There is no fourth value, and in particular no value that means
 * "supported" or "available" — the strongest thing this matrix can say about a capability
 * is that a committed test drives it in a development demo.
 */
export type ProfileCapabilityStatus =
  /** A development consumer drives it, and a committed test proves the level. */
  | "proven"
  /** The profile is in the policy but has made no conformance claim yet. */
  | "not-yet-claimed"
  /** The profile refuses the open path outright. */
  | "refused";

/**
 * The cell rule, in one place and in a deliberate order.
 *
 * Refusal is answered first and unconditionally, so no operation added to the policy
 * later can become a Kids tick by being added to a list. A profile that has not claimed
 * conformance answers second, so a `demo-driveable` policy row on its own never reads as
 * a claim. Only then is the operation list consulted, and a row with no committed
 * evidence still cannot reach `proven`.
 */
export function profileCapabilityStatus(
  row: ProfileMatrixSource,
  operation: ProfileOperation,
): ProfileCapabilityStatus {
  if (row.demoLevel === "refuse-only") return "refused";
  if (row.claimStatus !== "development-consumer") return "not-yet-claimed";
  if (!row.operations.includes(operation)) return "not-yet-claimed";
  if (row.evidence.length === 0) return "not-yet-claimed";
  return "proven";
}

/** How each cell reads, and which Foundations status vocabulary it borrows. */
export const PROFILE_CAPABILITY_COPY: Readonly<
  Record<
    ProfileCapabilityStatus,
    { readonly label: string; readonly tone: "validated" | "dormant" | "isolated" }
  >
> = Object.freeze({
  proven: Object.freeze({ label: "Proven in a demo", tone: "validated" as const }),
  "not-yet-claimed": Object.freeze({ label: "Not yet claimed", tone: "dormant" as const }),
  refused: Object.freeze({ label: "Refused", tone: "isolated" as const }),
});

export type ProfileMatrixRow = ProfileMatrixSource & {
  readonly cells: readonly {
    readonly operation: ProfileOperation;
    readonly status: ProfileCapabilityStatus;
  }[];
};

export type ProfileMatrixView = {
  readonly rows: readonly ProfileMatrixRow[];
  readonly operations: readonly ProfileOperation[];
  /** Structurally false: nothing on this page is a shipping or availability claim. */
  readonly shippingClaim: false;
  /** The profile whose policy is refusal, named so the page does not have to infer it. */
  readonly refuseOnlyProfile: string;
  readonly provenCount: number;
};

/** The matrix the page renders. Every cell comes from `profileCapabilityStatus`. */
export function profileMatrix(): ProfileMatrixView {
  const rows = PROFILE_MATRIX_SOURCE.map((row) =>
    Object.freeze({
      ...row,
      cells: Object.freeze(
        PROFILE_OPERATIONS.map((operation) =>
          Object.freeze({ operation, status: profileCapabilityStatus(row, operation) }),
        ),
      ),
    }),
  );
  return Object.freeze({
    rows: Object.freeze(rows),
    operations: PROFILE_OPERATIONS,
    shippingClaim: false as const,
    refuseOnlyProfile: OPEN_PATH_REFUSE_ONLY_PROFILE,
    provenCount: rows.reduce(
      (total, row) => total + row.cells.filter((cell) => cell.status === "proven").length,
      0,
    ),
  });
}

/** The sentences the page prints beside the matrix, kept out of JSX. */
export const PROFILE_MATRIX_COPY = Object.freeze({
  eyebrow: "Profiles",
  title: "One runtime, three profiles — and only the claims the contracts prove.",
  lede: "A profile is a versioned product scope over one engine core. This table is generated from the profile conformance registry and the open-path demo policy, so a capability appears here only when a committed test drives it. Nothing on this page is a shipping, availability, or production-readiness claim.",
  claimNote:
    "Conformance is a development claim, not a release. Only the Game profile is a development consumer of the shared conformance suite today; the Web Experience profile has not yet made a claim, and the Kids profile is an isolation boundary that refuses the open path outright.",
  evidenceNote:
    "Every graded row names the committed test that proves it. A level without evidence refuses at validation rather than rendering as an unproven tick.",
  kidsNote:
    "Kids is refuse-only by policy, has no open path to grade, and is linked from nowhere on this site. Nothing in this repository may depend on the Kids profile.",
});
