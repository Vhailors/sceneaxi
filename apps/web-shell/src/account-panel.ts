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
  snapshotPlainRecord,
  type EntitlementCapability,
  type EntitlementOutcome,
  type EntitlementPriceKind,
  type IdentityRole,
  type IdentitySurface,
  type Principal,
} from "@sceneaxi/schemas";
import {
  AUTH_REFUSE_REASONS,
  requireAuthenticated,
  type AdminIdentity,
  type AuthRefuseReason,
  type AuthResult,
  type IdentityPort,
  type SignInGrant,
} from "@sceneaxi/auth";
import {
  BILLING_REFUSE_REASONS,
  evaluateEntitlement,
  type BillingRefuseReason,
  type LedgerState,
} from "@sceneaxi/billing";
import {
  PANEL_SURFACES,
  createOperationQueue,
  readEpochClock,
  readOwnedLedger,
} from "./panel-support.js";

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
    !PANEL_SURFACES.includes(optionRecord["surface"] as IdentitySurface)
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

  const anonymous = (): AccountPanelSnapshot => {
    const now = readEpochClock(clock);
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
    const now = readEpochClock(clock);
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
    const now = readEpochClock(clock);
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

    const read = await readOwnedLedger(credits, principal.user.userId);
    if (!read.ok) {
      if (read.failure === "invalid") {
        return refused(refusal(read.reason, read.message));
      }
      if (read.failure === "unavailable") {
        return refused(
          refusal(
            ACCOUNT_PANEL_REASONS.creditsUnavailable,
            "The credits view failed; the balance is unknown rather than zero.",
          ),
        );
      }
      if (read.failure === "missing") {
        return refused(
          refusal(
            ACCOUNT_PANEL_REASONS.ledgerMissing,
            "No credit ledger exists for this user; the balance is unknown rather than zero.",
          ),
        );
      }
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
      creditBalance: read.state.balance,
      capabilities: capabilityViews(admin, surface, now, principal, read.state),
    });
  };

  let heldPrincipal: Principal | undefined;
  const outstandingPrincipals = new Set<Principal>();
  /**
   * Sessions a revocation was attempted on and failed, each mapped to the
   * refusal that describes it. Tracked apart from `heldPrincipal` because the
   * two answer different questions: the principal is retained so the revocation
   * can be retried, while the failure is what the panel must keep telling the
   * reader. Without this, a refused sign-out would silently become a signed-in
   * snapshot again on the very next refresh.
   *
   * Only failures a retry could still clear belong here. A port that *refuses*
   * the principal has already settled the session — see `revokePrincipal`.
   */
  const unrevokedPrincipals = new Map<Principal, AccountPanelRefusal>();
  const serializeMutation = createOperationQueue();

  held = anonymous();

  const recordRevocationFailure = (
    principal: Principal,
    value: AccountPanelRefusal,
  ): AccountPanelRefusal => {
    unrevokedPrincipals.set(principal, value);
    return value;
  };

  const clearRevocationFailure = (principal: Principal): void => {
    unrevokedPrincipals.delete(principal);
  };

  const outstandingRevocationFailure = (): AccountPanelRefusal | undefined => {
    for (const value of unrevokedPrincipals.values()) return value;
    return undefined;
  };

  const settleRevoked = (principal: Principal): undefined => {
    outstandingPrincipals.delete(principal);
    clearRevocationFailure(principal);
    if (heldPrincipal === principal) heldPrincipal = undefined;
    return undefined;
  };

  const revokePrincipal = async (
    principal: Principal,
  ): Promise<AccountPanelRefusal | undefined> => {
    if (!outstandingPrincipals.has(principal)) return undefined;
    let result: AuthResult<null>;
    try {
      result = await identityPort.signOut({ principal });
    } catch {
      return recordRevocationFailure(
        principal,
        refusal(
          ACCOUNT_PANEL_REASONS.sessionRevocationFailed,
          "A session could not be revoked and may still be live.",
        ),
      );
    }
    if (!result.ok) {
      // `principalInvalid` is the port saying this principal no longer names a
      // stored session — it was rotated away or already deleted. Nothing is left
      // to revoke and a retry can only repeat the same answer, so holding the
      // panel refused would strand it on a session that is provably gone.
      if (result.reason === AUTH_REFUSE_REASONS.principalInvalid) {
        return settleRevoked(principal);
      }
      return recordRevocationFailure(
        principal,
        refusal(result.reason, result.message),
      );
    }
    return settleRevoked(principal);
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
        // The same session id is the same session, now held under a fresh
        // principal that can still be revoked, so an earlier failure against it
        // no longer describes a session the panel has lost hold of.
        clearRevocationFailure(existing);
        if (heldPrincipal === existing) heldPrincipal = undefined;
      }
    }
    outstandingPrincipals.add(principal);
  };

  const submitCredentials = async (request: unknown) => {
    let result: AuthResult<SignInGrant>;
    try {
      result = await identityPort.signIn(request);
    } catch {
      held = refused(
        refusal(
          ACCOUNT_PANEL_REASONS.identityPortFailed,
          "The identity port failed during sign-in; the prior session remains tracked.",
        ),
      );
      return held;
    }
    if (result.ok) {
      // The grant's raw session token is deliberately dropped: this panel holds
      // the issued principal itself, so it never needs a re-presentable
      // credential and must not keep one.
      const principal = result.value.principal;
      trackPrincipal(principal);
      const next = await authenticated(principal);
      const failure = await revokeAllExcept(principal);
      heldPrincipal = principal;
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
      const credentialRecord = snapshotPlainRecord(credentials);
      const request =
        credentialRecord === undefined
          ? credentials
          : { ...credentialRecord, surface };
      return serializeMutation(() => submitCredentials(request));
    },

    /**
     * Re-read the balance and entitlements for the signed-in principal.
     *
     * Session *re-verification* is the port's job and needs a token the panel
     * deliberately never holds, so a refresh recomputes the parts the panel owns
     * and nothing else.
     */
    async refresh() {
      return serializeMutation(async () => {
        // An outstanding failed revocation outranks the balance: a session the
        // reader asked to end may still be live, and re-rendering them as
        // signed-in would substitute a default for that failure.
        const revocationFailure = outstandingRevocationFailure();
        if (revocationFailure !== undefined) {
          held = refused(revocationFailure);
          return held;
        }
        const principal = heldPrincipal;
        held =
          principal === undefined
            ? anonymous()
            : await authenticated(principal);
        return held;
      });
    },

    async signOut() {
      return serializeMutation(async () => {
        const failure = await revokeAllExcept(undefined);
        if (failure !== undefined) {
          held = refused(failure);
          return held;
        }
        held = anonymous();
        return held;
      });
    },
  });

  return Object.freeze({ ok: true, panel });
}
