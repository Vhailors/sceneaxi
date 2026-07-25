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
  type EntitlementCapability,
  type EntitlementOutcome,
  type IdentityRole,
  type IdentitySurface,
  type Principal,
} from "@sceneaxi/schemas";
import type { AuthRefuseReason, IdentityPort } from "@sceneaxi/auth";
import {
  deriveBalance,
  evaluateEntitlement,
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
  creditsViewMissing: "PANEL_CREDITS_VIEW_MISSING",
  clockInvalid: "PANEL_CLOCK_INVALID",
  surfaceInvalid: "PANEL_SURFACE_INVALID",
  creditsUnavailable: "PANEL_CREDITS_UNAVAILABLE",
  ledgerMissing: "PANEL_LEDGER_MISSING",
} as const);

export type AccountPanelReason =
  (typeof ACCOUNT_PANEL_REASONS)[keyof typeof ACCOUNT_PANEL_REASONS];

/** What the viewer may do, and at what cost. */
export type CapabilityView = Readonly<{
  capability: EntitlementCapability;
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
  surface: IdentitySurface,
  now: number,
  principal: Principal | undefined,
  state: LedgerState | undefined,
): ReadonlyArray<CapabilityView> {
  return Object.freeze(
    PANEL_CAPABILITIES.map((capability) => {
      const decision = evaluateEntitlement({
        capability,
        now,
        surface,
        ...(principal === undefined ? {} : { principal }),
        ...(state === undefined ? {} : { state }),
        // A credit-priced capability needs an amount to quote. The panel asks
        // for one credit, which answers "may I spend at all?" without inventing
        // a price the caller has not chosen yet.
        creditAmount: 1,
        ...(capability === "catalog-asset-purchase"
          ? { payWith: "credits" as const }
          : {}),
      });
      if (!decision.ok) {
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
  if (!SURFACES.includes(options.surface)) {
    return Object.freeze({
      ok: false,
      reason: ACCOUNT_PANEL_REASONS.surfaceInvalid,
      message: "The account panel needs a known SceneAxi surface.",
    });
  }
  // Kids never shares identity with another surface, so the panel refuses to
  // exist there at all — there is no signed-in state for a renderer to reach.
  if (options.surface === "kids") {
    return Object.freeze({
      ok: false,
      reason: ACCOUNT_PANEL_REASONS.kidsSurfaceDenied,
      message:
        "Kids never shares identity or commerce with another SceneAxi surface; no account panel is offered.",
    });
  }
  if (options.identityPort === undefined) {
    return Object.freeze({
      ok: false,
      reason: ACCOUNT_PANEL_REASONS.identityPortMissing,
      message: "The account panel requires an identity port.",
    });
  }
  if (options.credits === undefined) {
    return Object.freeze({
      ok: false,
      reason: ACCOUNT_PANEL_REASONS.creditsViewMissing,
      message: "The account panel requires a credits view.",
    });
  }
  if (typeof options.clock !== "function") {
    return Object.freeze({
      ok: false,
      reason: ACCOUNT_PANEL_REASONS.clockInvalid,
      message: "The account panel requires an injected clock.",
    });
  }

  const { identityPort, credits, surface, clock } = options;
  let held: AccountPanelSnapshot;

  const readClock = (): number | undefined => {
    let now: unknown;
    try {
      now = clock();
    } catch {
      return undefined;
    }
    return typeof now === "number" && Number.isFinite(now) ? now : undefined;
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
          "The panel clock did not return finite epoch milliseconds.",
        ),
      });
    }
    return Object.freeze({
      phase: "anonymous" as const,
      surface,
      capabilities: capabilityViews(surface, now, undefined, undefined),
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
          : capabilityViews(surface, now, undefined, undefined),
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
          "The panel clock did not return finite epoch milliseconds.",
        ),
      );
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

    // Derived, not read off a field: a balance that cannot be derived is a
    // refusal, never a plausible-looking number.
    const balance = deriveBalance(state.entries);
    if (!balance.ok) {
      return refused(refusal(balance.reason, balance.message));
    }

    return Object.freeze({
      phase: "authenticated" as const,
      surface,
      email: principal.user.email,
      role: principal.role.role,
      creditBalance: balance.value,
      capabilities: capabilityViews(surface, now, principal, state),
    });
  };

  /** Retained so a refresh can re-read the balance for the same principal. */
  let heldPrincipal: Principal | undefined;

  held = anonymous();

  const panel: AccountPanel = Object.freeze({
    snapshot() {
      return held;
    },

    async submitCredentials(credentials) {
      const result = await identityPort.signIn(
        // The surface is the panel's, never the caller's, so a client cannot
        // ask to be signed in somewhere else.
        typeof credentials === "object" && credentials !== null
          ? { ...(credentials as Record<string, unknown>), surface }
          : credentials,
      );
      if (result.ok) {
        heldPrincipal = result.value;
        held = await authenticated(result.value);
      } else {
        heldPrincipal = undefined;
        held = refused(refusal(result.reason, result.message));
      }
      return held;
    },

    /**
     * Re-read the balance and entitlements for the signed-in principal.
     *
     * Session *re-verification* is the port's job and needs a token the panel
     * deliberately never holds, so a refresh recomputes the parts the panel owns
     * and nothing else.
     */
    async refresh() {
      held =
        heldPrincipal === undefined
          ? anonymous()
          : await authenticated(heldPrincipal);
      return held;
    },

    async signOut() {
      const sessionId = heldPrincipal?.session.sessionId;
      heldPrincipal = undefined;
      if (sessionId !== undefined) {
        const result = await identityPort.signOut({ sessionId });
        if (!result.ok) {
          // A server-side sign-out that failed must not look like a clean one:
          // the session may still be live.
          held = refused(refusal(result.reason, result.message));
          return held;
        }
      }
      held = anonymous();
      return held;
    },
  });

  return Object.freeze({ ok: true, panel });
}
