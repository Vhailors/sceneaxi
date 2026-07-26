/**
 * The open-path demo policy (v1) — one shared answer to "may this surface
 * demonstrate this profile's open path, and what does that demonstration
 * claim?" (sceneaxi#137).
 *
 * Every profile already has an open path: the Game profile opens a composed
 * multi-object scene, the Web Experience profile opens a single-object kernel
 * session, and the Kids profile deliberately opens nothing. Before this module
 * each surface described those facts in its own words, so "the CLI says X, the
 * shell says Y" was a review problem rather than a test failure.
 *
 * The policy lives in `@sceneaxi/schemas` because that is the only package
 * `docs/dependency-matrix.json` lets all five consumers name: both profiles,
 * `@sceneaxi/cli`, `@sceneaxi/desktop-shell`, and `@sceneaxi/web-shell`. Putting
 * it anywhere else would require widening the matrix, so parity would have cost
 * a boundary. The ownership map is `docs/open-path-policy.md`.
 *
 * Three properties are structural rather than documented:
 *
 * - **Demo only.** `shippingClaim` is typed `false`, and a decision that claims
 *   shipping or production readiness refuses by name. No row in this table can
 *   ever be read as "this profile is ready to ship a game".
 * - **Evidence or no level.** Every non-refusing row names the committed test
 *   that proves its level. A row without evidence refuses at validation.
 * - **Kids refuses.** The Kids row is `refuse-only` with an empty operation set,
 *   and `evaluateOpenPathDemo` refuses it by name before any other check.
 *
 * Contracts only: nothing here opens a session, draws a frame, reads a
 * credential, or spends anything. The runnable paths themselves stay in
 * `@sceneaxi/engine-kernel` and the profiles that pin it.
 */

import {
  firstMissingKey,
  firstUnexpectedKey,
  isNonEmptyString,
  refuseWith,
  snapshotPlainRecord,
  type ContractRefuse,
} from "./record-validation.js";

/** Contract major version (schema const). */
export const OPEN_PATH_POLICY_SCHEMA_VERSION = 1 as const;

export const OPEN_PATH_DEMO_DECISION_KIND =
  "sceneaxi.open-path-demo-decision" as const;

/**
 * How far a profile's open path can be driven, in the vocabulary
 * `docs/runnable-surfaces.md` already uses.
 *
 * There is no "shipping" level and there will not be one: this contract grades
 * demonstrations, and a readiness claim is a captain decision made elsewhere.
 */
export const OPEN_PATH_DEMO_LEVELS = Object.freeze([
  /** R1 — driveable through a public seam and golden-tested end to end. */
  "demo-driveable",
  /** R0 — the product *is* a refusal boundary; there is no open path to drive. */
  "refuse-only",
] as const);

export type OpenPathDemoLevel = (typeof OPEN_PATH_DEMO_LEVELS)[number];

/**
 * The kernel session a profile's demo opens (ADR 0001 / ADR 0015 vocabulary).
 * `none` is the honest value for a profile whose policy is refusal.
 */
export const OPEN_PATH_SESSION_KINDS = Object.freeze([
  "kernel-session",
  "scene-kernel-session",
  "none",
] as const);

export type OpenPathSessionKind = (typeof OPEN_PATH_SESSION_KINDS)[number];

/**
 * Operations a demo may drive — the ADR 0001 Kernel seam, nothing more. The set
 * is closed: an operation that is not named here refuses, so a surface cannot
 * quietly grow a publish, checkout, deploy, or metering step by calling it part
 * of "the open path".
 */
export const OPEN_PATH_DEMO_OPERATIONS = Object.freeze([
  "open",
  "dispatch",
  "advance",
  "observe",
  "save",
  "replay",
] as const);

export type OpenPathDemoOperation =
  (typeof OPEN_PATH_DEMO_OPERATIONS)[number];

/** One profile's row in the policy. */
export type OpenPathPolicyRow = Readonly<{
  profile: `@sceneaxi/profile-${string}`;
  demoLevel: OpenPathDemoLevel;
  sessionKind: OpenPathSessionKind;
  /** Exactly the operations this profile's demo may drive; empty when refusing. */
  operations: ReadonlyArray<OpenPathDemoOperation>;
  /** Repo-relative committed test that proves the level. Never empty. */
  evidence: string;
  /** Structurally false: this contract never authorizes shipping or publication. */
  shippingClaim: false;
  /** One sentence a surface may print verbatim. */
  summary: string;
}>;

/**
 * The policy. A closed enumeration, in canonical order, mirrored as a contract
 * fixture (`contracts/open-path-policy.fixtures.json`) that
 * `pnpm check:contracts` keeps in lockstep with the `docs/open-path-policy.md`
 * table; a seam test asserts this table and that fixture are identical, so all
 * three move together.
 */
export const OPEN_PATH_POLICY: ReadonlyArray<OpenPathPolicyRow> = Object.freeze([
  Object.freeze({
    profile: "@sceneaxi/profile-game",
    demoLevel: "demo-driveable",
    sessionKind: "scene-kernel-session",
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
    demoLevel: "demo-driveable",
    sessionKind: "kernel-session",
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
    demoLevel: "refuse-only",
    sessionKind: "none",
    operations: Object.freeze([] as const),
    evidence: "tests/e2e/profile-kids-refuse-golden.test.ts",
    shippingClaim: false as const,
    summary:
      "Refuses every open-path demo: the Kids product is an isolation boundary with no UI, commerce, identity, or third-party model route.",
  }),
]);

/** Canonical policy fixture, relative to this package root. */
export const OPEN_PATH_POLICY_FIXTURES_PATH =
  "contracts/open-path-policy.fixtures.json" as const;

/** Profiles the policy covers, in canonical order. */
export const OPEN_PATH_POLICY_PROFILES: ReadonlyArray<string> = Object.freeze(
  OPEN_PATH_POLICY.map((row) => row.profile),
);

/** The profile whose policy is refusal. Named so no surface has to infer it. */
export const OPEN_PATH_REFUSE_ONLY_PROFILE =
  "@sceneaxi/profile-kids" as const;

export const OPEN_PATH_REFUSE_CODES = Object.freeze({
  kidsRefused: "OPEN_PATH_KIDS_REFUSED",
  unknownProfile: "OPEN_PATH_PROFILE_UNKNOWN",
  operationNotInPolicy: "OPEN_PATH_OPERATION_NOT_IN_DEMO_POLICY",
  shippingClaimForbidden: "OPEN_PATH_SHIPPING_CLAIM_FORBIDDEN",
  evidenceMissing: "OPEN_PATH_EVIDENCE_MISSING",
  notObject: "OPEN_PATH_RECORD_NOT_OBJECT",
  schemaVersionMismatch: "OPEN_PATH_SCHEMA_VERSION_MISMATCH",
  kindMismatch: "OPEN_PATH_KIND_MISMATCH",
  missingProperty: "OPEN_PATH_REQUIRED_PROPERTY_MISSING",
  unexpectedProperty: "OPEN_PATH_UNEXPECTED_PROPERTY",
  invalidProperty: "OPEN_PATH_PROPERTY_INVALID",
} as const);

export type OpenPathRefuseCode =
  (typeof OPEN_PATH_REFUSE_CODES)[keyof typeof OPEN_PATH_REFUSE_CODES];

/** What a surface asks the policy. */
export type OpenPathDemoRequest = Readonly<{
  profile: string;
  operation: string;
  /**
   * True when the caller wants the demo to stand for shipping or production
   * readiness. Always refuses — the flag exists so the refusal is a test, not a
   * review convention.
   */
  claimsShipping?: boolean;
}>;

export type OpenPathDemoAllowed = Readonly<{
  ok: true;
  kind: typeof OPEN_PATH_DEMO_DECISION_KIND;
  schemaVersion: typeof OPEN_PATH_POLICY_SCHEMA_VERSION;
  profile: `@sceneaxi/profile-${string}`;
  operation: OpenPathDemoOperation;
  demoLevel: "demo-driveable";
  sessionKind: OpenPathSessionKind;
  evidence: string;
  shippingClaim: false;
}>;

export type OpenPathDemoRefusal = ContractRefuse<OpenPathRefuseCode> &
  Readonly<{ profile: string | null }>;

export type OpenPathDemoDecision = OpenPathDemoAllowed | OpenPathDemoRefusal;

function refuseDemo(
  code: OpenPathRefuseCode,
  message: string,
  profile: string | null,
): OpenPathDemoRefusal {
  return Object.freeze({ ...refuseWith(code, message), profile });
}

/**
 * The one unknown-profile refusal. Every surface reaches it through this
 * function — evaluating an operation or merely projecting the table — so no
 * surface can author a different code or a different sentence for "that profile
 * has no row".
 */
function refuseUnknownProfile(profile: string): OpenPathDemoRefusal {
  return refuseDemo(
    OPEN_PATH_REFUSE_CODES.unknownProfile,
    `Profile ${JSON.stringify(profile)} is not in the open-path demo policy; policy expansion must be explicit.`,
    profile,
  );
}

/** The policy row for a profile, or undefined when it is not in the table. */
export function openPathPolicyRowFor(
  profile: unknown,
): OpenPathPolicyRow | undefined {
  return typeof profile === "string"
    ? OPEN_PATH_POLICY.find((row) => row.profile === profile)
    : undefined;
}

export function isOpenPathDemoOperation(
  value: unknown,
): value is OpenPathDemoOperation {
  return OPEN_PATH_DEMO_OPERATIONS.some((operation) => operation === value);
}

/**
 * The one decision function every surface calls. Fail-closed at every step, and
 * in a deliberate order: Kids refuses before the operation is even considered,
 * so no future operation can be added that Kids happens to allow.
 */
export function evaluateOpenPathDemo(
  request: unknown,
): OpenPathDemoDecision {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return refuseDemo(
      OPEN_PATH_REFUSE_CODES.notObject,
      "An open-path demo request must be a plain JSON object.",
      null,
    );
  }

  const missing = firstMissingKey(
    record as Record<string, unknown>,
    ["profile", "operation"],
  );
  if (missing !== undefined) {
    return refuseDemo(
      OPEN_PATH_REFUSE_CODES.missingProperty,
      `An open-path demo request is missing required property "${missing}".`,
      null,
    );
  }

  const unexpected = firstUnexpectedKey(
    record as Record<string, unknown>,
    ["profile", "operation"],
    ["claimsShipping"],
  );
  if (unexpected !== undefined) {
    return refuseDemo(
      OPEN_PATH_REFUSE_CODES.unexpectedProperty,
      `An open-path demo request has unexpected property "${unexpected}".`,
      null,
    );
  }

  const profile = record["profile"];
  if (!isNonEmptyString(profile)) {
    return refuseDemo(
      OPEN_PATH_REFUSE_CODES.invalidProperty,
      "An open-path demo request profile must be a non-empty string.",
      null,
    );
  }

  // Kids first, unconditionally: the refusal must not depend on the rest.
  if (profile === OPEN_PATH_REFUSE_ONLY_PROFILE) {
    return refuseDemo(
      OPEN_PATH_REFUSE_CODES.kidsRefused,
      "The Kids profile has no open-path demo: it is an isolation boundary, not a product surface.",
      profile,
    );
  }

  const row = openPathPolicyRowFor(profile);
  if (row === undefined) return refuseUnknownProfile(profile);

  const claimsShipping = record["claimsShipping"];
  if (claimsShipping !== undefined && typeof claimsShipping !== "boolean") {
    return refuseDemo(
      OPEN_PATH_REFUSE_CODES.invalidProperty,
      "An open-path demo request claimsShipping must be a boolean when present.",
      profile,
    );
  }
  if (claimsShipping === true) {
    return refuseDemo(
      OPEN_PATH_REFUSE_CODES.shippingClaimForbidden,
      "The open-path demo policy grades demonstrations only; it never asserts shipping or production readiness.",
      profile,
    );
  }

  if (row.demoLevel !== "demo-driveable") {
    return refuseDemo(
      OPEN_PATH_REFUSE_CODES.operationNotInPolicy,
      `Profile ${JSON.stringify(profile)} is ${row.demoLevel}; it drives no open-path operation.`,
      profile,
    );
  }

  const operation = record["operation"];
  if (
    !isOpenPathDemoOperation(operation) ||
    !row.operations.includes(operation)
  ) {
    return refuseDemo(
      OPEN_PATH_REFUSE_CODES.operationNotInPolicy,
      `Operation ${JSON.stringify(operation)} is not in profile ${JSON.stringify(profile)}'s open-path demo policy.`,
      profile,
    );
  }

  if (!isNonEmptyString(row.evidence)) {
    return refuseDemo(
      OPEN_PATH_REFUSE_CODES.evidenceMissing,
      `Profile ${JSON.stringify(profile)} claims a demo level with no committed evidence.`,
      profile,
    );
  }

  return Object.freeze({
    ok: true,
    kind: OPEN_PATH_DEMO_DECISION_KIND,
    schemaVersion: OPEN_PATH_POLICY_SCHEMA_VERSION,
    profile: row.profile,
    operation,
    demoLevel: "demo-driveable",
    sessionKind: row.sessionKind,
    evidence: row.evidence,
    shippingClaim: false,
  });
}

/** One row as a surface renders it. */
export type OpenPathPolicyViewRow = Readonly<{
  profile: string;
  demoLevel: OpenPathDemoLevel;
  sessionKind: OpenPathSessionKind;
  operations: ReadonlyArray<OpenPathDemoOperation>;
  evidence: string;
  shippingClaim: false;
  summary: string;
}>;

export type OpenPathPolicyViewModel = Readonly<{
  schemaVersion: typeof OPEN_PATH_POLICY_SCHEMA_VERSION;
  policyCount: number;
  refuseOnlyProfile: typeof OPEN_PATH_REFUSE_ONLY_PROFILE;
  shippingClaim: false;
  rows: ReadonlyArray<OpenPathPolicyViewRow>;
  notes: ReadonlyArray<string>;
}>;

/**
 * The exact payload every surface reports.
 *
 * Parity is structural rather than a convention: the CLI verb, the desktop
 * shell command, and the web shell view all render *this* value, so a surface
 * cannot describe the policy differently without changing the policy. The root
 * parity suite asserts the three are identical.
 */
export const OPEN_PATH_POLICY_NOTES: ReadonlyArray<string> = Object.freeze([
  "Demo levels grade demonstrations only — no row is a shipping, publication, or production-readiness claim",
  "Every level names the committed test that proves it; a level without evidence refuses",
  `${OPEN_PATH_REFUSE_ONLY_PROFILE} is refuse-only: no open path, no UI, no commerce`,
]);

export function openPathPolicyView(): OpenPathPolicyViewModel {
  return Object.freeze({
    schemaVersion: OPEN_PATH_POLICY_SCHEMA_VERSION,
    policyCount: OPEN_PATH_POLICY.length,
    refuseOnlyProfile: OPEN_PATH_REFUSE_ONLY_PROFILE,
    shippingClaim: false as const,
    rows: Object.freeze(
      OPEN_PATH_POLICY.map((row) =>
        Object.freeze({
          profile: row.profile,
          demoLevel: row.demoLevel,
          sessionKind: row.sessionKind,
          operations: Object.freeze([...row.operations]),
          evidence: row.evidence,
          shippingClaim: false as const,
          summary: row.summary,
        }),
      ),
    ),
    notes: OPEN_PATH_POLICY_NOTES,
  });
}

/**
 * One profile's row rendered in the reporting shape, and marked as what it is.
 *
 * `policyCount` stays the policy's true row count and `filteredTo` names the
 * profile the projection was taken for, so a stored payload can never be read
 * back as "the policy has one row". A surface that narrows the report to one
 * profile is projecting the table, not redefining it.
 */
export type OpenPathPolicyFilteredView = Readonly<{
  schemaVersion: typeof OPEN_PATH_POLICY_SCHEMA_VERSION;
  policyCount: number;
  filteredTo: string;
  refuseOnlyProfile: typeof OPEN_PATH_REFUSE_ONLY_PROFILE;
  shippingClaim: false;
  rows: readonly [OpenPathPolicyViewRow];
  notes: ReadonlyArray<string>;
}>;

export type OpenPathPolicyProjection =
  | Readonly<{ ok: true; policy: OpenPathPolicyFilteredView }>
  | OpenPathDemoRefusal;

/**
 * The shared answer to "report the policy for just this profile".
 *
 * Reporting narrows to a row through the same closed table evaluation uses, so
 * an off-policy profile refuses here with the same `OPEN_PATH_PROFILE_UNKNOWN`
 * an evaluation would produce. The refuse-only profile is *not* refused here:
 * listing the Kids row as `refuse-only` is exactly how a surface shows that the
 * boundary exists — hiding it would be the failure mode.
 */
export function openPathPolicyViewFor(
  profile: unknown,
): OpenPathPolicyProjection {
  if (!isNonEmptyString(profile)) {
    return refuseDemo(
      OPEN_PATH_REFUSE_CODES.invalidProperty,
      "An open-path policy projection profile must be a non-empty string.",
      null,
    );
  }

  const view = openPathPolicyView();
  const row = view.rows.find((entry) => entry.profile === profile);
  if (row === undefined) return refuseUnknownProfile(profile);

  return Object.freeze({
    ok: true as const,
    policy: Object.freeze({
      ...view,
      filteredTo: profile,
      rows: Object.freeze([row] as const),
    }),
  });
}

/**
 * What a report-and-evaluate surface (the CLI verb, the desktop shell command)
 * was asked for, in the vocabulary those surfaces already have: two optional
 * flag values.
 *
 * `undefined` means the flag was **absent**. Any string — including `""` — means
 * it was **provided**, so an explicitly empty value refuses instead of quietly
 * degrading to "not provided". A caller who asked to evaluate an operation must
 * never get a successful listing back.
 */
export type OpenPathSurfaceRequest = Readonly<{
  profile?: string | undefined;
  operation?: string | undefined;
}>;

/**
 * Which branch a surface request selects, tagged so each surface maps it onto
 * its own envelope without re-deciding anything.
 */
export type OpenPathSurfaceOutcome =
  | Readonly<{ kind: "policy"; policy: OpenPathPolicyViewModel }>
  | Readonly<{
      kind: "projection";
      profile: string;
      policy: OpenPathPolicyFilteredView;
    }>
  | Readonly<{ kind: "decision"; decision: OpenPathDemoAllowed }>
  | Readonly<{
      kind: "refusal";
      /**
       * `request` — the surface's own input was malformed before the policy was
       * consulted; `policy` — the shared table refused. Surfaces whose protocol
       * distinguishes a usage fault from a validation fault branch on this.
       */
      source: "request" | "policy";
      refusal: OpenPathDemoRefusal;
      operation: string | null;
    }>;

function refuseSurface(
  source: "request" | "policy",
  refusal: OpenPathDemoRefusal,
  operation: string | null,
): OpenPathSurfaceOutcome {
  return Object.freeze({ kind: "refusal" as const, source, refusal, operation });
}

/**
 * The one branch selection every report-and-evaluate surface makes: report the
 * whole policy, project one row, evaluate one operation, or refuse.
 *
 * It lives here rather than in each surface because the surfaces are not allowed
 * to differ — the parity suite asserts they do not — and a branch table copied
 * into two packages is exactly where they drift. Fail-closed throughout: an
 * empty provided value refuses rather than selecting a wider branch than the
 * caller asked for.
 */
export function resolveOpenPathSurfaceRequest(
  request: OpenPathSurfaceRequest = {},
): OpenPathSurfaceOutcome {
  const { profile, operation } = request;

  if (profile !== undefined && !isNonEmptyString(profile)) {
    return refuseSurface(
      "request",
      refuseDemo(
        OPEN_PATH_REFUSE_CODES.invalidProperty,
        "An open-path profile was provided with an empty value; name a profile package or omit it entirely.",
        null,
      ),
      operation ?? null,
    );
  }

  if (operation !== undefined && !isNonEmptyString(operation)) {
    return refuseSurface(
      "request",
      refuseDemo(
        OPEN_PATH_REFUSE_CODES.invalidProperty,
        "An open-path operation was provided with an empty value; name a Kernel-seam operation or omit it entirely.",
        profile ?? null,
      ),
      operation,
    );
  }

  if (operation !== undefined && profile === undefined) {
    return refuseSurface(
      "request",
      refuseDemo(
        OPEN_PATH_REFUSE_CODES.missingProperty,
        "An open-path operation is only meaningful against one profile's policy row; name a profile too.",
        null,
      ),
      operation,
    );
  }

  if (profile === undefined) {
    return Object.freeze({
      kind: "policy" as const,
      policy: openPathPolicyView(),
    });
  }

  if (operation === undefined) {
    const projection = openPathPolicyViewFor(profile);
    if (!projection.ok) return refuseSurface("policy", projection, null);
    return Object.freeze({
      kind: "projection" as const,
      profile,
      policy: projection.policy,
    });
  }

  const decision = evaluateOpenPathDemo({ profile, operation });
  if (!decision.ok) return refuseSurface("policy", decision, operation);
  return Object.freeze({ kind: "decision" as const, decision });
}

/**
 * Validate an untrusted record as a recorded open-path demo decision — the
 * shape a surface, log, or fixture may hand back across a process boundary.
 */
export function validateOpenPathDemoDecision(
  value: unknown,
): OpenPathDemoAllowed | ContractRefuse<OpenPathRefuseCode> {
  const record = snapshotPlainRecord(value);
  if (record === undefined) {
    return refuseWith(
      OPEN_PATH_REFUSE_CODES.notObject,
      "An open-path demo decision must be a plain JSON object.",
    );
  }
  if (record["schemaVersion"] !== OPEN_PATH_POLICY_SCHEMA_VERSION) {
    return refuseWith(
      OPEN_PATH_REFUSE_CODES.schemaVersionMismatch,
      `open-path demo decision schemaVersion must be ${OPEN_PATH_POLICY_SCHEMA_VERSION}; silent migration is refused.`,
    );
  }
  if (record["kind"] !== OPEN_PATH_DEMO_DECISION_KIND) {
    return refuseWith(
      OPEN_PATH_REFUSE_CODES.kindMismatch,
      `open-path demo decision kind must be "${OPEN_PATH_DEMO_DECISION_KIND}".`,
    );
  }

  const required = [
    "ok",
    "kind",
    "schemaVersion",
    "profile",
    "operation",
    "demoLevel",
    "sessionKind",
    "evidence",
    "shippingClaim",
  ];
  const missing = firstMissingKey(record as Record<string, unknown>, required);
  if (missing !== undefined) {
    return refuseWith(
      OPEN_PATH_REFUSE_CODES.missingProperty,
      `open-path demo decision is missing required property "${missing}".`,
    );
  }
  const unexpected = firstUnexpectedKey(
    record as Record<string, unknown>,
    required,
  );
  if (unexpected !== undefined) {
    return refuseWith(
      OPEN_PATH_REFUSE_CODES.unexpectedProperty,
      `open-path demo decision has unexpected property "${unexpected}".`,
    );
  }

  if (record["shippingClaim"] !== false) {
    return refuseWith(
      OPEN_PATH_REFUSE_CODES.shippingClaimForbidden,
      "shippingClaim must be false. The open-path demo policy never authorizes shipping or publication.",
    );
  }
  if (record["ok"] !== true) {
    return refuseWith(
      OPEN_PATH_REFUSE_CODES.invalidProperty,
      "open-path demo decision ok must be true; refusals are not recorded decisions.",
    );
  }
  if (record["demoLevel"] !== "demo-driveable") {
    return refuseWith(
      OPEN_PATH_REFUSE_CODES.invalidProperty,
      'open-path demo decision demoLevel must be "demo-driveable".',
    );
  }

  const profile = record["profile"];
  const row = openPathPolicyRowFor(profile);
  if (row === undefined) {
    return refuseWith(
      OPEN_PATH_REFUSE_CODES.unknownProfile,
      "open-path demo decision profile is not in the policy.",
    );
  }
  if (row.profile === OPEN_PATH_REFUSE_ONLY_PROFILE) {
    return refuseWith(
      OPEN_PATH_REFUSE_CODES.kidsRefused,
      "The Kids profile has no recorded open-path demo decision.",
    );
  }

  const operation = record["operation"];
  if (
    !isOpenPathDemoOperation(operation) ||
    !row.operations.includes(operation)
  ) {
    return refuseWith(
      OPEN_PATH_REFUSE_CODES.operationNotInPolicy,
      "open-path demo decision operation is not in that profile's policy.",
    );
  }
  if (record["sessionKind"] !== row.sessionKind) {
    return refuseWith(
      OPEN_PATH_REFUSE_CODES.invalidProperty,
      "open-path demo decision sessionKind does not match the policy row.",
    );
  }
  if (record["evidence"] !== row.evidence) {
    return refuseWith(
      OPEN_PATH_REFUSE_CODES.evidenceMissing,
      "open-path demo decision evidence does not match the policy row's committed proof.",
    );
  }

  return Object.freeze({
    ok: true,
    kind: OPEN_PATH_DEMO_DECISION_KIND,
    schemaVersion: OPEN_PATH_POLICY_SCHEMA_VERSION,
    profile: row.profile,
    operation,
    demoLevel: "demo-driveable",
    sessionKind: row.sessionKind,
    evidence: row.evidence,
    shippingClaim: false,
  });
}
