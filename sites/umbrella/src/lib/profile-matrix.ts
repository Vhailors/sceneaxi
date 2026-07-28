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
 * ## Why the contract data is mirrored here
 *
 * Both owners live in `@sceneaxi/schemas`
 * (`src/profile-conformance.ts`, `src/open-path-policy.ts`), and
 * `docs/dependency-matrix.json` allows this site four edges — `@sceneaxi/site-kit`,
 * `@sceneaxi/engine-presentation`, `@sceneaxi/auth`, `@sceneaxi/billing` — none of which
 * re-exports either table. So this module carries a **bundled mirror**, the same shape
 * `packages/schemas/src/credit-packs.data.ts` uses for the same reason, and
 * `tests/sites/umbrella-profile-matrix.test.ts` holds it in lockstep with both contracts
 * from the repository root, where naming `@sceneaxi/schemas` is allowed. A drifted
 * mirror fails the gate; it does not reach a page.
 *
 * The durable home for this projection is a re-export from `@sceneaxi/site-kit`, which is
 * how every other contract shape reaches the sites tier. That package is a shared seam
 * this lane may not edit, so the mirror plus its lockstep test is the in-lane form of the
 * same guarantee. `sites/umbrella/VISUAL-EVIDENCE.md` records the divergence.
 *
 * ## Why a hand edit here cannot overclaim
 *
 * The mirror carries only what the contracts state; it carries **no cell**. Every cell is
 * computed by `profileCapabilityStatus()` below, whose branches make `proven` unreachable
 * for a refuse-only profile and for a profile that is not a development consumer — so
 * granting a tick would take editing the derivation, not the data, and the derivation is
 * what the test exercises.
 */

/** Mirrors `ProfileClaimStatus` in `@sceneaxi/schemas`. */
export type ProfileClaimStatus = "development-consumer" | "not-yet-claimed";

/** Mirrors `OpenPathDemoLevel` in `@sceneaxi/schemas`. */
export type ProfileDemoLevel = "demo-driveable" | "refuse-only";

/** Mirrors `OpenPathSessionKind` in `@sceneaxi/schemas`. */
export type ProfileSessionKind = "kernel-session" | "scene-kernel-session" | "none";

/** Mirrors `OpenPathDemoOperation` in `@sceneaxi/schemas` — the ADR 0001 Kernel seam. */
export type ProfileOperation =
  | "open"
  | "dispatch"
  | "advance"
  | "observe"
  | "save"
  | "replay";

/**
 * The six operations, in the contract's canonical order. This is the whole column set:
 * the matrix has no column for a capability no contract grades.
 */
export const PROFILE_OPERATIONS: readonly ProfileOperation[] = Object.freeze([
  "open",
  "dispatch",
  "advance",
  "observe",
  "save",
  "replay",
]);

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
export type ProfileMatrixSource = {
  readonly profile: string;
  /** Display name. Presentation only — it decides nothing. */
  readonly name: string;
  readonly claimStatus: ProfileClaimStatus;
  readonly demoLevel: ProfileDemoLevel;
  readonly sessionKind: ProfileSessionKind;
  readonly operations: readonly ProfileOperation[];
  /** Repo-relative committed test that proves the level. Never empty for a graded row. */
  readonly evidence: string;
  readonly shippingClaim: false;
  readonly summary: string;
};

/**
 * The bundled mirror. Held in lockstep with `profileConformanceRegistry` and
 * `OPEN_PATH_POLICY` by `tests/sites/umbrella-profile-matrix.test.ts`.
 */
export const PROFILE_MATRIX_SOURCE: readonly ProfileMatrixSource[] = Object.freeze([
  Object.freeze({
    profile: "@sceneaxi/profile-game",
    name: "Game",
    claimStatus: "development-consumer" as const,
    demoLevel: "demo-driveable" as const,
    sessionKind: "scene-kernel-session" as const,
    operations: Object.freeze([
      "open",
      "dispatch",
      "advance",
      "observe",
      "save",
      "replay",
    ] as const),
    evidence: "tests/e2e/profile-game-scene-golden.test.ts",
    shippingClaim: false as const,
    summary:
      "Opens a composed multi-object scene kernel session offline; a development demo, not a shippable game.",
  }),
  Object.freeze({
    profile: "@sceneaxi/profile-web",
    name: "Web experience",
    claimStatus: "not-yet-claimed" as const,
    demoLevel: "demo-driveable" as const,
    sessionKind: "kernel-session" as const,
    operations: Object.freeze([
      "open",
      "dispatch",
      "advance",
      "observe",
      "save",
      "replay",
    ] as const),
    evidence: "tests/e2e/profile-web-golden-path.test.ts",
    shippingClaim: false as const,
    summary:
      "Opens a single-object kernel session inside the locked Web Experience scope; a development demo, not a shipped website.",
  }),
  Object.freeze({
    profile: "@sceneaxi/profile-kids",
    name: "Kids",
    claimStatus: "not-yet-claimed" as const,
    demoLevel: "refuse-only" as const,
    sessionKind: "none" as const,
    operations: Object.freeze([] as const),
    evidence: "tests/e2e/profile-kids-refuse-golden.test.ts",
    shippingClaim: false as const,
    summary:
      "Refuses every open-path demo: the Kids product is an isolation boundary with no UI, commerce, identity, or third-party model route.",
  }),
]);

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
  const refuseOnly = rows.find((row) => row.demoLevel === "refuse-only");
  return Object.freeze({
    rows: Object.freeze(rows),
    operations: PROFILE_OPERATIONS,
    shippingClaim: false as const,
    refuseOnlyProfile: refuseOnly?.profile ?? "@sceneaxi/profile-kids",
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
