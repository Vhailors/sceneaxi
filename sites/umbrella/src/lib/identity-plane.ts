/**
 * The single wiring point for the identity plane.
 *
 * This is the **only** module that constructs the identity, credits, and billing
 * ports. Everything else on the umbrella consumes what it returns.
 *
 * `sceneaxi-auth-credits-v1` owns identity and billing: single-admin resolution from
 * `SCENEAXI_ADMIN_EMAIL`, fail-closed role guards, the append-only credit ledger, the
 * checkout intent, and Stripe webhook verification. This module **forks none of it**.
 * It translates in one direction only: it turns `@sceneaxi/auth` and `@sceneaxi/billing`
 * results into the structural shapes `@sceneaxi/site-kit` ports accept, and maps their
 * named refusals onto the site refusal registry. No identity is derived here, no
 * balance is computed here, and no signature is checked here.
 *
 * ## What is wired, and what still needs a provider handle
 *
 * Per ADR 0021 the provider clients — Better Auth, the Neon client, the Stripe API —
 * are **injected adapters that live outside this repository**. So the parts of the
 * plane whose implementation is entirely in-repo are live on any deployment: the
 * credit-pack list read from the committed contract fixture, single-admin resolution
 * from `SCENEAXI_ADMIN_EMAIL`, and the checkout intent, starter grant, and webhook
 * verification as behaviour.
 *
 * The parts that need a running provider stay adapter-injected and refuse by name
 * until a deployment supplies one: session verification needs an `IdentityPort` over a
 * real store, balances need a `CreditStore`, and turning an intent into a hosted
 * checkout URL needs the Stripe API. `docs/websites-deploy.md` is the procedure.
 *
 * The rule the whole module is built around: an absent dependency produces a *named*
 * refusal, never an invented session, balance, or checkout.
 */
import {
  createBillingPlane,
  createCreditsPlane,
  createIdentityPlane,
  ok,
  refuse,
  type SiteBillingAdapter,
  type SiteBillingMode,
  type SiteBillingPort,
  type SiteCheckoutHandoff,
  type SiteCheckoutRequest,
  type SiteCreditBalance,
  type SiteCreditPack,
  type SiteCreditsAdapter,
  type SiteCreditsPort,
  type SiteIdentityAdapter,
  type SiteIdentityPort,
  type SiteIdentityRequest,
  type SitePrincipal,
  type SiteRefusalReason,
  type SiteResult,
} from "@sceneaxi/site-kit";
import {
  AUTH_REFUSE_REASONS,
  resolveAdminIdentity,
  type AdminIdentity,
  type AuthRefuseReason,
  type IdentityPort,
} from "@sceneaxi/auth";
import {
  BILLING_REFUSE_REASONS,
  STARTER_IDEMPOTENCY_PREFIX,
  createCheckoutSessionIntent,
  grantStarterCredits,
  loadCreditPackCatalog,
  loadLedgerState,
  type BillingOutcome,
  type BillingRefuseReason,
  type CreditStore,
  type LedgerState,
} from "@sceneaxi/billing";
import type { CheckoutEvidencePort } from "./credit-webhook.js";

/**
 * Contract shapes reached through the two plane packages rather than imported from
 * `@sceneaxi/schemas` directly. The umbrella's matrix edge stays exactly two packages
 * wide, and these stay definitionally the shapes those ports actually return.
 */
type Ok<Result> = Extract<Result, { readonly ok: true }>;
export type AuthPrincipal = Ok<
  Awaited<ReturnType<IdentityPort["verifySession"]>>
>["value"];
export type CreditPackCatalog = Ok<
  ReturnType<typeof loadCreditPackCatalog>
>["value"];
export type CheckoutSessionIntent = Ok<
  ReturnType<typeof createCheckoutSessionIntent>
>["value"];
/** One pack from that catalog. Named so the projection below annotates its own input. */
export type CreditPackListing = CreditPackCatalog["packs"][number];

// --- refusal translation -----------------------------------------------------

/**
 * `@sceneaxi/auth` reasons that mean the plane is not wired *here*.
 *
 * A missing adapter, store, admin, or clock is a deployment fact, not a fact about
 * the visitor, so they collapse onto the one reason a reader can act on.
 */
const IDENTITY_NOT_WIRED_REASONS: ReadonlyArray<AuthRefuseReason> = Object.freeze([
  AUTH_REFUSE_REASONS.adapterMissing,
  AUTH_REFUSE_REASONS.storeMissing,
  AUTH_REFUSE_REASONS.clockInvalid,
  AUTH_REFUSE_REASONS.adminIdentityUnresolved,
  AUTH_REFUSE_REASONS.adminEmailMissing,
  AUTH_REFUSE_REASONS.adminEmailEmpty,
  AUTH_REFUSE_REASONS.adminEmailInvalid,
  AUTH_REFUSE_REASONS.adminMultipleIdentities,
  AUTH_REFUSE_REASONS.adminMultiAdminNotAuthorized,
]);

/**
 * Auth reasons that are one product state to a reader: this request carries no live
 * session. A missing session, a token that does not match, a user that no longer
 * exists, and rejected credentials are all "signed out"; telling them apart on a
 * public page would only help someone probing for valid session ids.
 */
const IDENTITY_SIGNED_OUT_REASONS: ReadonlyArray<AuthRefuseReason> = Object.freeze([
  AUTH_REFUSE_REASONS.sessionNotFound,
  AUTH_REFUSE_REASONS.sessionTokenMismatch,
  AUTH_REFUSE_REASONS.userNotFound,
  AUTH_REFUSE_REASONS.credentialsRejected,
]);

const AUTH_REASON_VALUES: ReadonlyArray<string> = Object.freeze(
  Object.values(AUTH_REFUSE_REASONS),
);

/** `BillingRefuseReason` includes every auth reason, because a role guard can refuse. */
function isAuthReason(reason: BillingRefuseReason): reason is AuthRefuseReason {
  return AUTH_REASON_VALUES.includes(reason);
}

/** Map one `@sceneaxi/auth` reason onto the site refusal registry. */
export function siteReasonForAuthReason(reason: AuthRefuseReason): SiteRefusalReason {
  if (IDENTITY_NOT_WIRED_REASONS.includes(reason)) return "IDENTITY_PLANE_NOT_WIRED";
  if (IDENTITY_SIGNED_OUT_REASONS.includes(reason)) return "IDENTITY_SESSION_ABSENT";
  switch (reason) {
    case AUTH_REFUSE_REASONS.kidsSurfaceDenied:
      return "KIDS_SURFACE_DENIED";
    case AUTH_REFUSE_REASONS.roleClaimFromClient:
      return "ROLE_CLAIM_FROM_CLIENT_DENIED";
    case AUTH_REFUSE_REASONS.surfaceInvalid:
      return "SITE_SURFACE_UNKNOWN";
    case AUTH_REFUSE_REASONS.requestInvalid:
      return "SITE_REQUEST_MALFORMED";
    case AUTH_REFUSE_REASONS.sessionExpired:
      return "IDENTITY_SESSION_EXPIRED";
    case AUTH_REFUSE_REASONS.sessionSurfaceMismatch:
      return "IDENTITY_SESSION_SURFACE_MISMATCH";
    case AUTH_REFUSE_REASONS.userDisabled:
      return "IDENTITY_USER_DISABLED";
    case AUTH_REFUSE_REASONS.roleUnknown:
      return "IDENTITY_ROLE_UNKNOWN";
    case AUTH_REFUSE_REASONS.adapterFailed:
    case AUTH_REFUSE_REASONS.storeFailed:
      return "IDENTITY_PLANE_UNAVAILABLE";
    default:
      // Envelope, record, mismatch, and unverified-admin refusals all mean one thing
      // at this boundary: what came back is not a principal a site may trust.
      return "IDENTITY_ADAPTER_OUTPUT_INVALID";
  }
}

/**
 * Which plane a `@sceneaxi/billing` refusal was read through.
 *
 * One package owns both the ledger and the checkout builder, and several of its
 * reasons are raised by both, so the reader names the plane rather than the reason
 * carrying it. Without this, a balance that could not be read reports a checkout
 * that could not be built, and the reverse.
 */
export type BillingReadPlane = "billing" | "credits";

/**
 * Billing reasons that describe the *ledger*, never a checkout.
 *
 * Grouped rather than enumerated case by case so a reason added to that group later
 * cannot fall through to a checkout-shaped message on a page that never asked for
 * a checkout.
 */
const CREDIT_LEDGER_REASONS: ReadonlyArray<BillingRefuseReason> = Object.freeze([
  BILLING_REFUSE_REASONS.accountNotOwned,
  BILLING_REFUSE_REASONS.amountInvalid,
  BILLING_REFUSE_REASONS.ledgerStateInvalid,
  BILLING_REFUSE_REASONS.ledgerOrderInvalid,
  BILLING_REFUSE_REASONS.entryInvalid,
  BILLING_REFUSE_REASONS.deltaSignMismatch,
  BILLING_REFUSE_REASONS.balanceInsufficient,
  BILLING_REFUSE_REASONS.idempotencyConflict,
]);

/** Map one `@sceneaxi/billing` reason onto the site refusal registry. */
export function siteReasonForBillingReason(
  reason: BillingRefuseReason,
  plane: BillingReadPlane = "billing",
): SiteRefusalReason {
  if (isAuthReason(reason)) return siteReasonForAuthReason(reason);
  if (CREDIT_LEDGER_REASONS.includes(reason)) return "CREDIT_ADAPTER_OUTPUT_INVALID";
  switch (reason) {
    case BILLING_REFUSE_REASONS.kidsCommerceDenied:
      return "KIDS_SURFACE_DENIED";
    case BILLING_REFUSE_REASONS.liveModeNotAuthorized:
      return "BILLING_LIVE_MODE_NOT_AUTHORIZED";
    case BILLING_REFUSE_REASONS.redirectUrlInsecure:
      return "BILLING_URL_INSECURE";
    case BILLING_REFUSE_REASONS.packUnknown:
      return "BILLING_CHECKOUT_REQUEST_INVALID";
    case BILLING_REFUSE_REASONS.storeFailed:
      return "CREDITS_PLANE_UNAVAILABLE";
    // Raised by the ledger and by the checkout builder alike, so which one is
    // unavailable is a fact about the caller, not about the reason.
    case BILLING_REFUSE_REASONS.requestInvalid:
      return plane === "credits"
        ? "CREDITS_PLANE_UNAVAILABLE"
        : "BILLING_CHECKOUT_REQUEST_INVALID";
    case BILLING_REFUSE_REASONS.clockInvalid:
      return plane === "credits" ? "CREDITS_PLANE_UNAVAILABLE" : "BILLING_PLANE_UNAVAILABLE";
    // The pack catalog is a committed contract fixture, so an unreadable or invalid
    // one is the billing plane being unavailable — the same reading the throw path
    // in `readCreditPackCatalog` already gives it, and never a checkout handoff that
    // came back malformed, which is what the default below reports.
    case BILLING_REFUSE_REASONS.catalogInvalid:
      return "BILLING_PLANE_UNAVAILABLE";
    default:
      // Any other billing reason still reaches the reader as a refusal from the
      // plane they were reading, never as a checkout that could not complete.
      return plane === "credits" ? "CREDITS_PLANE_UNAVAILABLE" : "BILLING_ADAPTER_OUTPUT_INVALID";
  }
}

// --- principal projection ----------------------------------------------------

/**
 * Project an auth `Principal` onto the site's structural principal.
 *
 * `role` flattens from the server-derived `RoleAssignment` to its role name: a site
 * renders the role, while the assignment's provenance stays owned by `@sceneaxi/auth`.
 * Nothing here can *raise* a role — the value is only ever the one the identity port
 * derived from `SCENEAXI_ADMIN_EMAIL`.
 */
export function toSitePrincipal(principal: AuthPrincipal): SitePrincipal {
  return Object.freeze({
    user: Object.freeze({
      userId: principal.user.userId,
      email: principal.user.email,
      emailVerified: principal.user.emailVerified,
      disabled: principal.user.disabled,
    }),
    role: principal.role.role === "admin" ? ("admin" as const) : ("user" as const),
    session: Object.freeze({
      sessionId: principal.session.sessionId,
      userId: principal.session.userId,
      surface: principal.session.surface,
      issuedAt: principal.session.issuedAt,
      expiresAt: principal.session.expiresAt,
    }),
  });
}

/**
 * The browser-carried session credential, split into what the identity port needs.
 *
 * The cookie is opaque to every other module; only this one knows it is
 * `<sessionId>.<token>`. The token half is never logged, never rendered, and never put
 * in a URL — `_session.ts` reads it and hands it straight here.
 */
export function parseSessionToken(
  raw: string | null | undefined,
): { readonly sessionId: string; readonly token: string } | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const separator = trimmed.indexOf(".");
  if (separator <= 0 || separator === trimmed.length - 1) return null;
  return Object.freeze({
    sessionId: trimmed.slice(0, separator),
    token: trimmed.slice(separator + 1),
  });
}

// --- injected provider handles ----------------------------------------------

/**
 * Turning a checkout *intent* into a hosted checkout URL.
 *
 * The intent is built here from the committed pack catalog; only the provider
 * round-trip is injected, so no Stripe credential ever reaches this repository.
 *
 * Returning a URL is **not** the whole contract. The webhook grant is bound to the
 * intent, not to the event, so an implementation that only creates a session takes
 * money and then refuses every grant. Two obligations come with it, both consumed by
 * `applyCreditPackWebhook`:
 *
 *   1. **Persist the intent** under `intent.intentId`, exactly as given, before the
 *      buyer is redirected. `CheckoutEvidencePort.findIntent(intentId)` must return
 *      that same record; it is the immutable price snapshot the credits are read
 *      from. Not finding it refuses `STRIPE_CHECKOUT_EVIDENCE_MISSING`.
 *   2. **Carry the identity on the session** as Stripe metadata under
 *      `CHECKOUT_METADATA_KEYS` from `@sceneaxi/billing` — `sceneaxiUserId`,
 *      `sceneaxiPurpose`, `sceneaxiItemId`, `sceneaxiIntentId`, taken from
 *      `intent.userId` / `intent.purpose` / `intent.itemId` / `intent.intentId`.
 *      `parseCheckoutCompletedEvent` cross-checks all four (and the mode) against
 *      the persisted intent; a mismatched or missing key refuses the grant.
 *
 *      Two of them are also *routing* keys, read by `applyCreditPackWebhook` from
 *      the verified body before the intent is: `sceneaxiIntentId` names the record
 *      to bind to, and `sceneaxiPurpose` decides whether this endpoint owes the
 *      completion any work before it reads the evidence the cross-check needs. Copy
 *      the purpose from `intent.purpose` and never from a literal: a credit-pack
 *      checkout stamped with a purpose that settles on the revenue-share path is
 *      acknowledged `200` with `ignored: true` before the intent is read, so it never
 *      reaches the cross-check that would refuse it.
 *
 * A key the parser refuses is retried by Stripe until it gives up, so an unmet
 * obligation is a paid-but-ungranted checkout, not a visible error at checkout time. A
 * mis-stamped purpose is worse: the acknowledgement ends the retries too, so the grant
 * is dropped silently and permanently.
 */
export type CheckoutSessionAdapter = {
  createCheckoutSession(
    intent: CheckoutSessionIntent,
  ): Promise<{ readonly redirectUrl: string }> | { readonly redirectUrl: string };
};

export type IdentityPlaneAdapters = {
  readonly identity?: SiteIdentityAdapter | undefined;
  readonly credits?: SiteCreditsAdapter | undefined;
  readonly billing?: SiteBillingAdapter | undefined;
};

/**
 * The provider handles a deployment supplies, and the one function that supplies them.
 *
 * ADR 0021 keeps the Neon client, Better Auth, and the Stripe API **outside** this
 * repository, so there is nothing here to construct and every handle is absent. That
 * absence is not an oversight — it is what makes each plane refuse with its own named
 * reason instead of inventing a session, a balance, or a checkout.
 *
 * A deployment that carries those clients returns them from here, and no other file
 * changes: `createUmbrellaIdentityPlane` folds them under any explicitly injected
 * adapter, and the webhook endpoint reads the store and evidence from the same place.
 */
export type UmbrellaPlaneHandles = {
  readonly identityPort?: IdentityPort | undefined;
  readonly creditStore?: CreditStore | undefined;
  readonly checkoutSessions?: CheckoutSessionAdapter | undefined;
  readonly checkoutEvidence?: CheckoutEvidencePort | undefined;
};

const NO_PLANE_HANDLES: UmbrellaPlaneHandles = Object.freeze({});

export function umbrellaPlaneHandles(): UmbrellaPlaneHandles {
  return NO_PLANE_HANDLES;
}

export type IdentityPlaneWiring = IdentityPlaneAdapters & {
  /** The identity port from `@sceneaxi/auth`, built over a real store and provider. */
  readonly identityPort?: IdentityPort | undefined;
  /** The credit store from `@sceneaxi/billing`; the ledger is the only balance source. */
  readonly creditStore?: CreditStore | undefined;
  /** The provider round-trip that hosts a checkout. */
  readonly checkoutSessions?: CheckoutSessionAdapter | undefined;
  /** The pack catalog. Defaults to the committed contract fixture. */
  readonly creditPacks?: CreditPackCatalog | undefined;
  /**
   * The session credential this request carries. Bound at construction because the
   * checkout path must authorize against a *server-verified* session rather than
   * against the user id a form submitted.
   */
  readonly sessionToken?: string | null | undefined;
  /** Epoch milliseconds. Injected so sessions, grants, and intents are deterministic. */
  readonly clock?: (() => number) | undefined;
};

export type UmbrellaIdentityPlane = {
  readonly identity: SiteIdentityPort;
  readonly credits: SiteCreditsPort;
  readonly billing: SiteBillingPort;
  /** Whether an adapter is present for each plane, for honest UI copy. */
  readonly wired: {
    readonly identity: boolean;
    readonly credits: boolean;
    readonly billing: boolean;
  };
  readonly billingMode: SiteBillingMode;
  /** The resolved admin identity, or `null` when the environment names none. */
  readonly admin: AdminIdentity | null;
};

/**
 * Billing mode from the environment. Anything other than an explicit `live` is
 * `test`, and `live` still refuses inside the port without separate authorization,
 * so a stray env value cannot start real charges.
 */
export function resolveBillingMode(
  env: Readonly<Record<string, string | undefined>>,
): SiteBillingMode {
  return env["SCENEAXI_BILLING_MODE"]?.trim().toLowerCase() === "live" ? "live" : "test";
}

// --- adapters over @sceneaxi/auth and @sceneaxi/billing ----------------------

/**
 * Verify the carried session through `@sceneaxi/auth`, or report a signed-out visitor.
 *
 * Only `verifySession` is reachable from a site. Sign-in — which takes a password — is
 * deliberately not exposed here: the site never handles a credential, it only presents
 * a session the provider already issued. Admin comes out of this path exactly when
 * `SCENEAXI_ADMIN_EMAIL` names the verified user, because the identity port re-derives
 * the role on every call.
 */
async function verifyCarriedSession(options: {
  readonly port: IdentityPort;
  readonly surface: SiteIdentityRequest["surface"];
  readonly sessionToken: string | null | undefined;
}): Promise<SiteResult<AuthPrincipal | null>> {
  const carried = parseSessionToken(options.sessionToken);
  // No credential at all is a signed-out visitor, not a failure, and it is answered
  // without touching the store.
  if (carried === null) return ok(null);

  const verified = await options.port.verifySession({
    surface: options.surface,
    sessionId: carried.sessionId,
    token: carried.token,
  });
  if (!verified.ok) return refuse(siteReasonForAuthReason(verified.reason));
  return ok(verified.value);
}

export function createAuthIdentityAdapter(options: {
  readonly port: IdentityPort;
  readonly sessionToken?: string | null | undefined;
}): SiteIdentityAdapter {
  return Object.freeze({
    async resolvePrincipal(
      request: SiteIdentityRequest,
    ): Promise<SiteResult<SitePrincipal | null>> {
      const verified = await verifyCarriedSession({
        port: options.port,
        surface: request.surface,
        sessionToken: request.sessionToken ?? options.sessionToken,
      });
      if (!verified.ok) return verified;
      return ok(verified.value === null ? null : toSitePrincipal(verified.value));
    },
  });
}

const starterKeyFor = (userId: string): string => `${STARTER_IDEMPOTENCY_PREFIX}${userId}`;

/** Read a user's ledger state through the injected store, or refuse by name. */
async function readLedgerState(
  store: CreditStore,
  userId: string,
): Promise<SiteResult<LedgerState>> {
  const account = await store.findAccountByUserId(userId);
  // No account is not a zero balance. Nothing in this repository provisions a credit
  // account: the schema creates the table and inserts no row, and `CreditStore` exposes
  // no account-creation method, so provisioning belongs to the deployment's own store
  // implementation — the same one `umbrellaPlaneHandles()` supplies, and a named step in
  // `docs/websites-deploy.md`. A site may not invent the account it failed to find, so
  // an absent one means the balance is unknown and every dependent surface refuses.
  if (account === undefined) return refuse("CREDITS_PLANE_UNAVAILABLE");
  const state = loadLedgerState(account, await store.listEntries(account.accountId));
  if (!state.ok) return refuse(siteReasonForBillingReason(state.reason, "credits"));
  return ok(state.value);
}

function balanceOf(state: LedgerState, userId: string): SiteCreditBalance {
  return Object.freeze({
    userId,
    balance: state.balance,
    starterGrantConsumed: state.entries.some(
      (entry) => entry.idempotencyKey === starterKeyFor(userId),
    ),
  });
}

/**
 * Derive the balance from the ledger, settling the once-per-user starter allotment on
 * the way.
 *
 * The grant is attempted on every read *because* it is idempotent — keyed
 * `starter:<userId>` by `@sceneaxi/billing`, whose ledger reports a replay rather than
 * appending a second row. "Exactly once" is therefore a property of the key, not of
 * this call site remembering whether it already ran, and a concurrent second reader is
 * stopped by the store's unique-key invariant rather than granted twice.
 */
export function createBillingCreditsAdapter(options: {
  readonly store: CreditStore;
  readonly clock: () => number;
}): SiteCreditsAdapter {
  return Object.freeze({
    async readBalance(input: {
      readonly userId: string;
    }): Promise<SiteResult<SiteCreditBalance>> {
      const loaded = await readLedgerState(options.store, input.userId);
      if (!loaded.ok) return loaded;

      const granted = grantStarterCredits({
        state: loaded.value,
        userId: input.userId,
        now: options.clock(),
      });
      if (!granted.ok) return refuse(siteReasonForBillingReason(granted.reason, "credits"));
      const entry = granted.value.entry;
      if (granted.value.replayed || entry === undefined) {
        return ok(balanceOf(granted.value.state, input.userId));
      }
      try {
        await options.store.appendEntry(entry);
      } catch {
        // Another reader won the race and appended the same starter key. The ledger
        // is the source of truth, so re-read rather than assume either outcome; a
        // second grant is impossible by construction.
        const reread = await readLedgerState(options.store, input.userId);
        if (!reread.ok) return reread;
        return ok(balanceOf(reread.value, input.userId));
      }
      return ok(balanceOf(granted.value.state, input.userId));
    },
  });
}

/**
 * The billing adapter.
 *
 * Listing packs needs nothing but the committed catalog, so it is live wherever this
 * site is. Creating a checkout needs three separate things and refuses by name for
 * each: the resolved admin (so the guard can re-derive the buyer's role), a verified
 * principal for *this* request, and the provider round-trip that hosts the session.
 *
 * The buyer is the principal `@sceneaxi/auth` verified — never the `userId` the form
 * submitted, which is only cross-checked against it. That is the whole server/client
 * trust boundary for the purchase path, and it is why the guard is handed the port's
 * own principal rather than a shape rebuilt from the site projection.
 */
export function createBillingCheckoutAdapter(options: {
  readonly catalog: () => SiteResult<CreditPackCatalog>;
  readonly admin: AdminIdentity | null;
  readonly verifyBuyer: (() => Promise<SiteResult<AuthPrincipal | null>>) | null;
  readonly sessions: CheckoutSessionAdapter | null;
  readonly mode: SiteBillingMode;
  readonly clock: () => number;
}): SiteBillingAdapter {
  return Object.freeze({
    async listCreditPacks(): Promise<SiteResult<readonly SiteCreditPack[]>> {
      const catalog = options.catalog();
      if (!catalog.ok) return catalog;
      return ok(
        Object.freeze(
          catalog.value.packs.map((pack: CreditPackListing) =>
            Object.freeze({
              packId: pack.packId,
              credits: pack.credits,
              unitAmount: pack.unitAmount,
              currency: pack.currency,
            }),
          ),
        ),
      );
    },

    async createCheckout(
      request: SiteCheckoutRequest,
    ): Promise<SiteResult<SiteCheckoutHandoff>> {
      if (options.admin === null || options.verifyBuyer === null) {
        return refuse("IDENTITY_PLANE_NOT_WIRED");
      }
      if (options.sessions === null) return refuse("BILLING_PLANE_NOT_WIRED");
      const catalog = options.catalog();
      if (!catalog.ok) return catalog;

      const buyer = await options.verifyBuyer();
      if (!buyer.ok) return buyer;
      if (buyer.value === null) return refuse("IDENTITY_SESSION_ABSENT");
      // The submitted user id is evidence to check, not an identity to act on.
      if (buyer.value.user.userId !== request.userId) {
        return refuse("BILLING_CHECKOUT_REQUEST_INVALID");
      }

      // `liveModeAuthorized` is deliberately never passed: live mode is a separate
      // captain decision, so a `live` intent refuses inside the billing package.
      const intent = createCheckoutSessionIntent({
        principal: buyer.value,
        admin: options.admin,
        catalog: catalog.value,
        packId: request.packId,
        successUrl: request.successUrl,
        cancelUrl: request.cancelUrl,
        idempotencyKey: request.idempotencyKey,
        now: options.clock(),
        surface: "site",
        mode: options.mode,
      });
      if (!intent.ok) return refuse(siteReasonForBillingReason(intent.reason));

      const hosted = await options.sessions.createCheckoutSession(intent.value);
      return ok(
        Object.freeze({
          intentId: intent.value.intentId,
          redirectUrl: hosted.redirectUrl,
          mode: options.mode,
        }),
      );
    },
  });
}

/** Read the committed credit-pack catalog, or refuse by name. */
function readCreditPackCatalog(
  injected: CreditPackCatalog | undefined,
): () => SiteResult<CreditPackCatalog> {
  return () => {
    if (injected !== undefined) return ok(injected);
    let loaded: BillingOutcome<CreditPackCatalog>;
    try {
      loaded = loadCreditPackCatalog();
    } catch {
      // The catalog is a bundled module the billing package validates in-process, so
      // a throw here is a packaging fault, not an empty or invalid catalog.
      return refuse("BILLING_PLANE_UNAVAILABLE");
    }
    if (!loaded.ok) return refuse(siteReasonForBillingReason(loaded.reason));
    return ok(loaded.value);
  };
}

/**
 * Build the umbrella's identity plane.
 *
 * Explicitly injected site adapters win, so a test can drive any port directly. Where
 * none is given, the plane is assembled from `@sceneaxi/auth` and `@sceneaxi/billing`
 * over whatever provider handles the deployment supplied — and refuses by name where
 * it supplied none.
 */
export function createUmbrellaIdentityPlane(
  env: Readonly<Record<string, string | undefined>> = {},
  wiring: IdentityPlaneWiring = {},
): UmbrellaIdentityPlane {
  const billingMode = resolveBillingMode(env);
  const clock = wiring.clock ?? (() => Date.now());
  const resolvedAdmin = resolveAdminIdentity(env);
  const admin = resolvedAdmin.ok ? resolvedAdmin.value : null;
  // Explicit wiring wins over the deployment's handles, and a slot reaches for them only
  // when nothing was injected for it, so a fully wired test drives the plane without the
  // ambient registry — and whatever provider clients a deployment builds there — ever
  // being reached.
  let deployment: UmbrellaPlaneHandles | undefined;
  const deploymentHandle = <Key extends keyof UmbrellaPlaneHandles>(
    key: Key,
  ): UmbrellaPlaneHandles[Key] => {
    deployment ??= umbrellaPlaneHandles();
    return deployment[key];
  };
  const identityPort = (): IdentityPort | undefined =>
    wiring.identityPort ?? deploymentHandle("identityPort");
  const checkoutSessions = (): CheckoutSessionAdapter | undefined =>
    wiring.checkoutSessions ?? deploymentHandle("checkoutSessions");

  const buildIdentityAdapter = (): SiteIdentityAdapter | undefined => {
    const port = identityPort();
    if (port === undefined) return undefined;
    return createAuthIdentityAdapter({
      port,
      ...(wiring.sessionToken === undefined ? {} : { sessionToken: wiring.sessionToken }),
    });
  };

  const buildCreditsAdapter = (): SiteCreditsAdapter | undefined => {
    const store = wiring.creditStore ?? deploymentHandle("creditStore");
    if (store === undefined) return undefined;
    return createBillingCreditsAdapter({ store, clock });
  };

  const buildBillingAdapter = (): SiteBillingAdapter => {
    const port = identityPort();
    return createBillingCheckoutAdapter({
      catalog: readCreditPackCatalog(wiring.creditPacks),
      admin,
      verifyBuyer:
        port === undefined
          ? null
          : () =>
              verifyCarriedSession({
                port,
                surface: "site",
                sessionToken: wiring.sessionToken,
              }),
      sessions: checkoutSessions() ?? null,
      mode: billingMode,
      clock,
    });
  };

  const identityAdapter = wiring.identity ?? buildIdentityAdapter();
  const creditsAdapter = wiring.credits ?? buildCreditsAdapter();
  const billingAdapter = wiring.billing ?? buildBillingAdapter();

  return Object.freeze({
    // The port re-checks session validity against its own clock, so it is given the
    // same one the adapters use. Two clocks would let a session the identity port
    // accepted be rejected here, or the reverse.
    identity: createIdentityPlane({
      adapter: identityAdapter,
      now: () => new Date(clock()).toISOString(),
    }),
    credits: createCreditsPlane({ adapter: creditsAdapter }),
    billing: createBillingPlane({ adapter: billingAdapter, mode: billingMode }),
    wired: Object.freeze({
      identity: identityAdapter !== undefined,
      credits: creditsAdapter !== undefined,
      // Billing counts as wired only when a checkout can actually be created.
      // Listing packs works regardless, because the catalog is committed.
      billing: wiring.billing !== undefined || checkoutSessions() !== undefined,
    }),
    billingMode,
    admin,
  });
}

/** Where a reader is sent when a plane is unwired. */
export const IDENTITY_PLANE_DOC = "docs/websites-deploy.md";

export const IDENTITY_PLANE_PENDING_NOTE =
  "Sign-in and credit balances activate when this deployment supplies the identity plane's provider handles — the session store and the Stripe checkout round-trip, which ADR 0021 keeps outside this repository. Until then these surfaces refuse with a named reason rather than showing an invented session, balance, or checkout.";
