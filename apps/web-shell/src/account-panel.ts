/**
 * Login and credit-balance wiring for the web shell.
 *
 * `web-shell` is a protocol *client* of the core — there is no UI framework in
 * this repo — so this ships a **view model**, not markup. A renderer (owned by
 * the websites lane) reads snapshots; every decision it would need has already
 * been made by the identity port and the entitlement matrix.
 *
 * Two things the panel deliberately does not do:
 *
 * - It never derives a role. `role` is only ever the value the identity port
 *   returned, so a client-supplied `role` in the submitted credentials is
 *   *refused* and shown as a refusal, not rendered as an admin badge.
 * - It never substitutes a default for a failure. A balance it cannot derive
 *   becomes a named refusal rather than `0`, because "you have no credits" and
 *   "we could not read your credits" must not look identical to a buyer.
 */

import {
  ENTITLEMENT_CAPABILITIES,
  entitlementRuleFor,
  isEpochMilliseconds,
  snapshotPlainRecord,
  type EntitlementCapability,
  type EntitlementOutcome,
  type EntitlementPriceKind,
  type IdentityRole,
  type IdentitySurface,
  type Principal,
} from "@sceneaxi/schemas";
import {
  requireAuthenticated,
  type AdminIdentity,
  type AuthRefuseReason,
  type AuthResult,
  type IdentityPort,
} from "@sceneaxi/auth";
import {
  BILLING_REFUSE_REASONS,
  evaluateEntitlement,
  validateLedgerState,
  type BillingRefuseReason,
  type LedgerState,
} from "@sceneaxi/billing";

export type AccountPanelPhase = "anonymous" | "authenticated" | "refused";

export type AccountPanelRefusal = Readonly<{
  reason: AuthRefuseReason | BillingRefuseReason | AccountPanelReason;
  message: string;
}>;

/** Panel-local refusals, distinct from the ports' own vocabularies. */
export const ACCOUNT_PANEL_REASONS = Object.freeze({
  kidsSurfaceDenied: "KIDS_IDENTITY_SURFACE_DENIED",
  identityPortMissing: "PANEL_IDENTITY_PORT_MISSING",
  identityPortFailed: "PANEL_IDENTITY_PORT_FAILED",
  adminIdentityMissing: "PANEL_ADMIN_IDENTITY_MISSING",
  creditsViewMissing: "PANEL_CREDITS_VIEW_MISSING",
  clockInvalid: "PANEL_CLOCK_INVALID",
  surfaceInvalid: "PANEL_SURFACE_INVALID",
  creditsUnavailable: "PANEL_CREDITS_UNAVAILABLE",
  ledgerMissing: "PANEL_LEDGER_MISSING",
  ledgerOwnerMismatch: "PANEL_LEDGER_OWNER_MISMATCH",
  sessionRevocationFailed: "PANEL_SESSION_REVOCATION_FAILED",
} as const);

export type AccountPanelReason =
  (typeof ACCOUNT_PANEL_REASONS)[keyof typeof ACCOUNT_PANEL_REASONS];

/** What the viewer may do, and at what cost. */
export type CapabilityView = Readonly<{
  capability: EntitlementCapability;
  availability?: "available";
  price?: EntitlementPriceKind;
  outcome?: EntitlementOutcome;
  credits?: number;
  refusedReason?: AccountPanelRefusal["reason"];
}>;

export type AccountPanelSnapshot = Readonly<{
  phase: AccountPanelPhase;
  surface: IdentitySurface;
  email?: string;
  role?: IdentityRole;
  creditBalance?: number;
  capabilities: ReadonlyArray<CapabilityView>;
  refusal?: AccountPanelRefusal;
}>;

/** Where the panel reads a user's ledger. Injected; the panel owns no storage. */
export type AccountCreditsView = Readonly<{
  ledgerFor(
    userId: string,
  ): Promise<LedgerState | undefined> | LedgerState | undefined;
}>;

export type AccountPanel = Readonly<{
  snapshot(): AccountPanelSnapshot;
  submitCredentials(credentials: unknown): Promise<AccountPanelSnapshot>;
  refresh(): Promise<AccountPanelSnapshot>;
  signOut(): Promise<AccountPanelSnapshot>;
}>;

export type CreateAccountPanelOptions = Readonly<{
  identityPort?: IdentityPort | undefined;
  credits?: AccountCreditsView | undefined;
  surface: IdentitySurface;
  /**
   * The single resolved admin identity. Threaded to the entitlement guard so the
   * panel never evaluates a capability with a forgeable role.
   */
  admin: AdminIdentity;
  /** Epoch milliseconds. Injected so snapshots are deterministic. */
  clock?: (() => number) | undefined;
}>;

export type CreateAccountPanelResult =
  | Readonly<{ ok: true; panel: AccountPanel }>
  | Readonly<{ ok: false; reason: AccountPanelReason; message: string }>;

const SURFACES: ReadonlyArray<IdentitySurface> = [
  "web-shell",
  "desktop-shell",
  "site",
  "kids",
];

/** Capabilities the panel surfaces, in a stable order for rendering. */
const PANEL_CAPABILITIES: ReadonlyArray<EntitlementCapability> = [
  ...ENTITLEMENT_CAPABILITIES,
];

function refusal(
  reason: AccountPanelRefusal["reason"],
  message: string,
): AccountPanelRefusal {
  return Object.freeze({ reason, message });
}

/**
 * Build the entitlement view.
 *
 * Called with `principal` absent while anonymous, which is the point: the free
 * capabilities must be visible before anyone signs in, so a visitor can see that
 * the engine download and the CLI cost nothing.
 */
function capabilityViews(
  admin: AdminIdentity,
  surface: IdentitySurface,
  now: number,
  principal: Principal | undefined,
  state: LedgerState | undefined,
): ReadonlyArray<CapabilityView> {
  return Object.freeze(
    PANEL_CAPABILITIES.map((capability) => {
      const rule = entitlementRuleFor(capability);
      const decision = evaluateEntitlement({
        capability,
        now,
        admin,
        surface,
        ...(principal === undefined ? {} : { principal }),
        ...(state === undefined ? {} : { state }),
        ...(capability === "catalog-asset-purchase"
          ? { payWith: "credits" as const }
          : {}),
      });
      if (!decision.ok) {
        if (
          decision.reason === BILLING_REFUSE_REASONS.creditAmountRequired &&
          rule !== undefined &&
          (rule.price === "credits" || rule.price === "credits-or-money")
        ) {
          return Object.freeze({
            capability,
            availability: "available" as const,
            price: rule.price,
          });
        }
        return Object.freeze({ capability, refusedReason: decision.reason });
      }
      return Object.freeze(
        decision.value.credits === undefined
          ? { capability, outcome: decision.value.outcome }
          : {
              capability,
              outcome: decision.value.outcome,
              credits: decision.value.credits,
            },
      );
    }),
  );
}

export function createAccountPanel(
  options: CreateAccountPanelOptions,
): CreateAccountPanelResult {
  const optionRecord = snapshotPlainRecord(options);
  if (
    optionRecord === undefined ||
    !SURFACES.includes(optionRecord["surface"] as IdentitySurface)
  ) {
    return Object.freeze({
      ok: false,
      reason: ACCOUNT_PANEL_REASONS.surfaceInvalid,
      message: "The account panel needs a known SceneAxi surface.",
    });
  }
  // Kids never shares identity with another surface, so the panel refuses to
  // exist there at all — there is no signed-in state for a renderer to reach.
  if (optionRecord["surface"] === "kids") {
    return Object.freeze({
      ok: false,
      reason: ACCOUNT_PANEL_REASONS.kidsSurfaceDenied,
      message:
        "Kids never shares identity or commerce with another SceneAxi surface; no account panel is offered.",
    });
  }
  if (optionRecord["identityPort"] === undefined) {
    return Object.freeze({
      ok: false,
      reason: ACCOUNT_PANEL_REASONS.identityPortMissing,
      message: "The account panel requires an identity port.",
    });
  }
  if (optionRecord["credits"] === undefined) {
    return Object.freeze({
      ok: false,
      reason: ACCOUNT_PANEL_REASONS.creditsViewMissing,
      message: "The account panel requires a credits view.",
    });
  }
  if (typeof optionRecord["clock"] !== "function") {
    return Object.freeze({
      ok: false,
      reason: ACCOUNT_PANEL_REASONS.clockInvalid,
      message: "The account panel requires an injected clock.",
    });
  }

  const identityPort = optionRecord["identityPort"] as IdentityPort;
  const credits = optionRecord["credits"] as AccountCreditsView;
  const surface = optionRecord["surface"] as IdentitySurface;
  const clock = optionRecord["clock"] as () => number;
  const adminRecord = snapshotPlainRecord(optionRecord["admin"]);
  if (
    adminRecord === undefined ||
    typeof adminRecord["email"] !== "string" ||
    adminRecord["email"].length === 0
  ) {
    return Object.freeze({
      ok: false,
      reason: ACCOUNT_PANEL_REASONS.adminIdentityMissing,
      message: "The account panel requires the resolved admin identity.",
    });
  }
  const admin = optionRecord["admin"] as AdminIdentity;
  let held: AccountPanelSnapshot;

  const readClock = (): number | undefined => {
    let now: unknown;
    try {
      now = clock();
    } catch {
      return undefined;
    }
    return isEpochMilliseconds(now) ? now : undefined;
  };

  const anonymous = (): AccountPanelSnapshot => {
    const now = readClock();
    if (now === undefined) {
      return Object.freeze({
        phase: "refused" as const,
        surface,
        capabilities: Object.freeze([]),
        refusal: refusal(
          ACCOUNT_PANEL_REASONS.clockInvalid,
          "The panel clock did not return valid epoch milliseconds.",
        ),
      });
    }
    return Object.freeze({
      phase: "anonymous" as const,
      surface,
      capabilities: capabilityViews(admin, surface, now, undefined, undefined),
    });
  };

  const refused = (value: AccountPanelRefusal): AccountPanelSnapshot => {
    const now = readClock();
    return Object.freeze({
      phase: "refused" as const,
      surface,
      capabilities:
        now === undefined
          ? Object.freeze([])
          : capabilityViews(admin, surface, now, undefined, undefined),
      refusal: value,
    });
  };

  /** Turn a verified principal into a snapshot, or a refusal. */
  const authenticated = async (
    principal: Principal,
  ): Promise<AccountPanelSnapshot> => {
    const now = readClock();
    if (now === undefined) {
      return refused(
        refusal(
          ACCOUNT_PANEL_REASONS.clockInvalid,
          "The panel clock did not return valid epoch milliseconds.",
        ),
      );
    }

    const guarded = requireAuthenticated(principal, { now, surface, admin });
    if (!guarded.ok) {
      return refused(refusal(guarded.reason, guarded.message));
    }

    let state: LedgerState | undefined;
    try {
      state = await credits.ledgerFor(principal.user.userId);
    } catch {
      return refused(
        refusal(
          ACCOUNT_PANEL_REASONS.creditsUnavailable,
          "The credits view failed; the balance is unknown rather than zero.",
        ),
      );
    }
    if (state === undefined) {
      return refused(
        refusal(
          ACCOUNT_PANEL_REASONS.ledgerMissing,
          "No credit ledger exists for this user; the balance is unknown rather than zero.",
        ),
      );
    }
    const validatedState = validateLedgerState(state);
    if (!validatedState.ok) {
      return refused(
        refusal(validatedState.reason, validatedState.message),
      );
    }
    if (validatedState.value.account.userId !== principal.user.userId) {
      return refused(
        refusal(
          ACCOUNT_PANEL_REASONS.ledgerOwnerMismatch,
          "The credits view returned a ledger for a different user; no balance is disclosed.",
        ),
      );
    }

    return Object.freeze({
      phase: "authenticated" as const,
      surface,
      email: principal.user.email,
      role: principal.role.role,
      creditBalance: validatedState.value.balance,
      capabilities: capabilityViews(
        admin,
        surface,
        now,
        principal,
        validatedState.value,
      ),
    });
  };

  let heldPrincipal: Principal | undefined;
  const outstandingPrincipals = new Set<Principal>();
  const principalRevocations = new Map<
    Principal,
    Promise<AccountPanelRefusal | undefined>
  >();
  let operationGeneration = 0;
  let credentialSubmissionTail: Promise<void> = Promise.resolve();

  held = anonymous();

  const revokePrincipal = async (
    principal: Principal,
  ): Promise<AccountPanelRefusal | undefined> => {
    if (!outstandingPrincipals.has(principal)) return undefined;
    const pending = principalRevocations.get(principal);
    if (pending !== undefined) return pending;

    const revocation = (async () => {
      let result: AuthResult<null>;
      try {
        result = await identityPort.signOut({ principal });
      } catch {
        return refusal(
          ACCOUNT_PANEL_REASONS.sessionRevocationFailed,
          "A session could not be revoked and may still be live.",
        );
      }
      if (!result.ok) {
        return refusal(result.reason, result.message);
      }
      outstandingPrincipals.delete(principal);
      if (heldPrincipal === principal) heldPrincipal = undefined;
      return undefined;
    })();
    principalRevocations.set(principal, revocation);

    try {
      return await revocation;
    } finally {
      if (principalRevocations.get(principal) === revocation) {
        principalRevocations.delete(principal);
      }
    }
  };

  const revokeAllExcept = async (
    retained: Principal | undefined,
  ): Promise<AccountPanelRefusal | undefined> => {
    let failure: AccountPanelRefusal | undefined;
    for (const principal of [...outstandingPrincipals]) {
      if (principal === retained) continue;
      const result = await revokePrincipal(principal);
      if (result !== undefined) failure = result;
    }
    return failure;
  };

  const trackPrincipal = (principal: Principal): void => {
    for (const existing of outstandingPrincipals) {
      if (existing.session.sessionId === principal.session.sessionId) {
        outstandingPrincipals.delete(existing);
        if (heldPrincipal === existing) heldPrincipal = undefined;
      }
    }
    outstandingPrincipals.add(principal);
  };

  const submitCredentials = async (request: unknown, generation: number) => {
    let result: AuthResult<Principal>;
    try {
      result = await identityPort.signIn(request);
    } catch {
      if (generation === operationGeneration) {
        held = refused(
          refusal(
            ACCOUNT_PANEL_REASONS.identityPortFailed,
            "The identity port failed during sign-in; the prior session remains tracked.",
          ),
        );
      }
      return held;
    }
    if (generation !== operationGeneration) {
      if (result.ok) {
        trackPrincipal(result.value);
        await revokePrincipal(result.value);
      }
      return held;
    }
    if (result.ok) {
      trackPrincipal(result.value);
      const next = await authenticated(result.value);
      if (generation !== operationGeneration) {
        await revokePrincipal(result.value);
        return held;
      }
      const failure = await revokeAllExcept(result.value);
      if (generation !== operationGeneration) {
        await revokePrincipal(result.value);
        return held;
      }
      heldPrincipal = result.value;
      held = failure === undefined ? next : refused(failure);
    } else {
      held = refused(refusal(result.reason, result.message));
    }
    return held;
  };

  const panel: AccountPanel = Object.freeze({
    snapshot() {
      return held;
    },

    async submitCredentials(credentials) {
      const generation = ++operationGeneration;
      const credentialRecord = snapshotPlainRecord(credentials);
      const request =
        credentialRecord === undefined
          ? credentials
          : { ...credentialRecord, surface };
      const precedingSubmission = credentialSubmissionTail;
      let releaseSubmission = () => {};
      credentialSubmissionTail = new Promise<void>((resolve) => {
        releaseSubmission = resolve;
      });
      await precedingSubmission;
      try {
        return await submitCredentials(request, generation);
      } finally {
        releaseSubmission();
      }
    },

    /**
     * Re-read the balance and entitlements for the signed-in principal.
     *
     * Session *re-verification* is the port's job and needs a token the panel
     * deliberately never holds, so a refresh recomputes the parts the panel owns
     * and nothing else.
     */
    async refresh() {
      const generation = ++operationGeneration;
      const principal = heldPrincipal;
      const next =
        principal === undefined
          ? anonymous()
          : await authenticated(principal);
      if (generation === operationGeneration) held = next;
      return held;
    },

    async signOut() {
      const generation = ++operationGeneration;
      const failure = await revokeAllExcept(undefined);
      if (generation !== operationGeneration) return held;
      if (failure !== undefined) {
        held = refused(failure);
        return held;
      }
      held = anonymous();
      return held;
    },
  });

  return Object.freeze({ ok: true, panel });
}
