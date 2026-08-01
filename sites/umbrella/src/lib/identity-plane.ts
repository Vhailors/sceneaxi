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
 * named refusals onto the site refusal registry. No identity policy is reimplemented
 * here, no balance is computed here, and no signature is checked here.
 *
 * ## Provider-backed deployment wiring
 *
 * Per ADR 0021 the provider clients — Better Auth, the Neon client, and the Stripe API —
 * remain deployment-owned. `provider-adapters.ts` maps those clients onto the existing
 * `IdentityStore`, `CreditStoreAdapter`, and checkout evidence seams; it adds no auth,
 * ledger, issuance, or live-mode policy. The pure site plane below only projects their
 * results and maps named refusals.
 *
 * Missing configuration still refuses by name: session verification needs Better Auth
 * and Neon, balances need a provisioned Neon account, and checkout/grants need Stripe
 * TEST mode plus persisted evidence. `docs/websites-deploy.md` owns activation.
 *
 * The rule the whole module is built around: an absent dependency produces a *named*
 * refusal, never an invented session, balance, or checkout.
 */
import {
  createBillingPlane,
  createCreditsPlane,
  createIdentityPlane,
  createLoginPlane,
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
  type SiteLoginAdapter,
  type SiteLoginGrant,
  type SiteLoginPort,
  type SiteLoginRequest,
  type SitePrincipal,
  type SiteRefusalReason,
  type SiteResult,
} from "@sceneaxi/site-kit";
import {
  AUTH_REFUSE_REASONS,
  createBetterAuthIdentityAdapter,
  createIdentityPort,
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
import {
  STRIPE_WEBHOOK_SECRET_ENV,
  applyCreditPackWebhook,
  type CheckoutEvidencePort,
  type CreditWebhookOutcome,
} from "./credit-webhook.js";
import {
  createBetterAuthHttpClient,
  createNeonCheckoutIntentStore,
  createNeonCreditStore,
  createNeonDatabase,
  createNeonIdentityStore,
  createProvisioningIdentityAdapter,
  createStripeCheckoutEvidenceAdapter,
  createStripeCheckoutSessionAdapter,
  createStripeClient,
  providerFetch,
  resolveBetterAuthOrigin,
  resolveNonEmptyEnv,
  type DeploymentProviderOverrides,
  type NeonDatabase,
} from "./provider-adapters.js";

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
 * Site reasons whose named access state describes a credential this browser
 * *presented* — a session that was carried, read back, and then not trusted.
 *
 * On the verify path each of them is exactly true. On the issuance path none of
 * them can be: no session was carried, nothing was discarded, and signing in
 * again reaches the same fault. They are therefore renamed at the one boundary
 * that knows which path it is on, rather than being softened downstream where a
 * page can no longer tell an issued session from a presented one.
 */
const LOGIN_ISSUANCE_FAULT_REASONS: ReadonlyArray<SiteRefusalReason> = Object.freeze([
  "IDENTITY_SESSION_ABSENT",
  "IDENTITY_ADAPTER_OUTPUT_INVALID",
  "IDENTITY_ROLE_UNKNOWN",
  "IDENTITY_SESSION_EXPIRED",
  "IDENTITY_SESSION_NOT_YET_VALID",
  "IDENTITY_SESSION_SURFACE_MISMATCH",
]);

/**
 * Map one `@sceneaxi/auth` reason raised while *issuing* a session.
 *
 * It is the verify mapping with one substitution, so a reason added there is
 * carried here by construction: rejected credentials are the visitor's own named
 * outcome, every reason that would have described a presented credential becomes
 * `LOGIN_SESSION_NOT_ISSUED`, and everything that is equally true at issuance —
 * Kids, a disabled account, an unwired or unavailable plane — keeps its own name.
 */
export function siteReasonForLoginAuthReason(reason: AuthRefuseReason): SiteRefusalReason {
  if (reason === AUTH_REFUSE_REASONS.credentialsRejected) return "LOGIN_CREDENTIALS_REJECTED";
  const verified = siteReasonForAuthReason(reason);
  return LOGIN_ISSUANCE_FAULT_REASONS.includes(verified)
    ? "LOGIN_SESSION_NOT_ISSUED"
    : verified;
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
 *      that same price snapshot, with `credits`, `unit_amount`, `currency`, and
 *      `stripe_price_id` immutable once written, while columns the deployment adds for
 *      its own operations — the hosted session id it stamps on after creating the
 *      session — stay writable. Not finding the row refuses
 *      `STRIPE_CHECKOUT_EVIDENCE_MISSING`; at grant time the billing package anchors the
 *      tuple to the committed archive before it can issue credits. `docs/websites-deploy.md`
 *      owns the full adapter obligation.
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
  readonly login?: SiteLoginAdapter | undefined;
};

/**
 * The provider handles a deployment supplies, and the one function that supplies them.
 *
 * ADR 0021 keeps provider ownership in the deployment tier. This site constructs only
 * the narrow provider adapters in `provider-adapters.ts`; the contracts and policy stay
 * in `@sceneaxi/auth` and `@sceneaxi/billing`. A deployment with missing env or provider
 * clients returns absent handles, so each plane refuses by name instead of inventing a
 * session, account, balance, grant, or checkout.
 *
 * `createUmbrellaIdentityPlane` folds these handles under any explicitly injected adapter,
 * and the webhook endpoint reads the credit store and checkout evidence from this same
 * registry.
 */
export type UmbrellaPlaneHandles = {
  /** The deployment-issued single-admin evidence. Never resolved from a route argument. */
  readonly admin: AdminIdentity | null;
  /** Billing mode is deployment configuration; `live` still refuses in core. */
  readonly billingMode: SiteBillingMode;
  /** One deployment-owned clock shared by every issued port and capability. */
  readonly clock: () => number;
  readonly identityPort?: IdentityPort | undefined;
  readonly creditStore?: CreditStore | undefined;
  readonly checkoutSessions?: CheckoutSessionAdapter | undefined;
  readonly checkoutEvidence?: CheckoutEvidencePort | undefined;
  /** Secret-holding webhook effect. The route can supply only request evidence. */
  readonly creditWebhook?: CreditWebhookCapability | undefined;
};

export type CreditWebhookCapability = Readonly<{
  apply(input: {
    readonly payload: string;
    readonly signatureHeader: string | null;
  }): Promise<CreditWebhookOutcome>;
}>;

export type DeploymentPlaneOptions = Readonly<{
  /** Already-issued evidence; this builder never reads an environment. */
  readonly admin?: AdminIdentity | null | undefined;
  readonly billingMode?: SiteBillingMode | undefined;
  readonly providers?: DeploymentProviderOverrides;
  readonly clock?: (() => number) | undefined;
}>;

/**
 * Build provider handles from typed deployment evidence and injected clients.
 *
 * This is the hermetic half of the boundary: it receives no environment object,
 * connection string, Stripe key, webhook secret, or network default. Tests inject
 * synthetic providers here; production resolves configuration only in the private
 * builder behind `umbrellaPlaneHandles()`.
 */
export function createDeploymentPlaneHandles(
  options: DeploymentPlaneOptions = {},
): UmbrellaPlaneHandles {
  const providers = options.providers ?? {};
  const clock = options.clock ?? (() => Date.now());
  const admin = options.admin ?? null;
  const billingMode = options.billingMode ?? "test";
  const database = providers.database;
  if (database === undefined) {
    return Object.freeze({ admin, billingMode, clock });
  }

  const identityStore = createNeonIdentityStore(database);
  const creditStore = createNeonCreditStore(database);
  const intentStore = createNeonCheckoutIntentStore(database);

  const betterAuth = providers.betterAuth;
  const stripe = providers.stripe;

  const identityPort =
    betterAuth === undefined || admin === null
      ? undefined
      : createIdentityPort({
          adapter: createProvisioningIdentityAdapter({
            adapter: createBetterAuthIdentityAdapter(betterAuth),
            clock,
            provision: (authentication) =>
              identityStore.ensureUserAndCreditAccount(authentication, clock()),
          }),
          store: identityStore,
          admin,
          clock,
        });
  const checkoutSessions =
    stripe === undefined
      ? undefined
      : createStripeCheckoutSessionAdapter({ stripe, intents: intentStore });
  const checkoutEvidence =
    stripe === undefined
      ? undefined
      : createStripeCheckoutEvidenceAdapter({ stripe, intents: intentStore });

  return Object.freeze({
    admin,
    billingMode,
    clock,
    identityPort,
    creditStore,
    checkoutSessions,
    checkoutEvidence,
  });
}

function providerClientsFromEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): DeploymentProviderOverrides {
  const databaseUrl = resolveNonEmptyEnv(env, "DATABASE_URL");
  let database: NeonDatabase | undefined;
  if (databaseUrl !== undefined) {
    try {
      database = createNeonDatabase(databaseUrl);
    } catch {
      database = undefined;
    }
  }

  const authOrigin = resolveBetterAuthOrigin(resolveNonEmptyEnv(env, "BETTER_AUTH_ORIGIN"));
  const fetcher = providerFetch();
  const betterAuth =
    authOrigin === undefined || fetcher === undefined
      ? undefined
      : createBetterAuthHttpClient({ origin: authOrigin, fetch: fetcher });

  const stripeKey = resolveNonEmptyEnv(env, "STRIPE_SECRET_KEY");
  let stripe: DeploymentProviderOverrides["stripe"];
  if (stripeKey !== undefined) {
    try {
      stripe = createStripeClient(stripeKey);
    } catch {
      stripe = undefined;
    }
  }

  return Object.freeze({ database, betterAuth, stripe });
}

function createCreditWebhookCapability(options: {
  readonly secret: string | undefined;
  readonly store: CreditStore;
  readonly evidence: CheckoutEvidencePort;
  readonly clock: () => number;
}): CreditWebhookCapability {
  return Object.freeze({
    apply(input) {
      return applyCreditPackWebhook({
        payload: input.payload,
        signatureHeader: input.signatureHeader,
        secret: options.secret,
        store: options.store,
        evidence: options.evidence,
        now: options.clock(),
      });
    },
  });
}

function buildUmbrellaPlaneHandles(
  env: Readonly<Record<string, string | undefined>>,
): UmbrellaPlaneHandles {
  const resolvedAdmin = resolveAdminIdentity(env);
  const base = createDeploymentPlaneHandles({
    admin: resolvedAdmin.ok ? resolvedAdmin.value : null,
    billingMode: resolveBillingMode(env),
    providers: providerClientsFromEnvironment(env),
  });
  const creditWebhook =
    base.creditStore === undefined || base.checkoutEvidence === undefined
      ? undefined
      : createCreditWebhookCapability({
          secret: resolveNonEmptyEnv(env, STRIPE_WEBHOOK_SECRET_ENV),
          store: base.creditStore,
          evidence: base.checkoutEvidence,
          clock: base.clock,
        });
  return Object.freeze({ ...base, creditWebhook });
}

let deploymentHandles: UmbrellaPlaneHandles | undefined;

/**
 * The production plug point. It accepts no environment, issuer, provider, clock, or
 * secret from its caller: the server resolves and holds those exactly once here.
 */
export function umbrellaPlaneHandles(): UmbrellaPlaneHandles {
  deploymentHandles ??= buildUmbrellaPlaneHandles(process.env);
  return deploymentHandles;
}

export type IdentityPlaneWiring = IdentityPlaneAdapters & {
  /** Typed test/deployment evidence; production routes obtain it from the plug point. */
  readonly admin?: AdminIdentity | null | undefined;
  /** A complete capability registry. Explicit only for deterministic tests. */
  readonly deployment?: UmbrellaPlaneHandles | undefined;
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
  readonly login: SiteLoginPort;
  /**
   * Delete the stored session this request's credential names, if any.
   *
   * `ok(null)` means "no live session remains for that credential" — including the
   * case where it was already gone — so the caller's next move is always the same:
   * clear the browser cookie. A named refusal means the store could not answer and
   * the session may still be live server-side.
   */
  readonly signOut: () => Promise<SiteResult<null>>;
  /** Whether an adapter is present for each plane, for honest UI copy. */
  readonly wired: {
    readonly identity: boolean;
    readonly credits: boolean;
    readonly billing: boolean;
    /** Sign-in needs the identity port itself, not just a resolve adapter. */
    readonly login: boolean;
  };
  readonly billingMode: SiteBillingMode;
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
 * Admin comes out of this path exactly when `SCENEAXI_ADMIN_EMAIL` names the verified
 * user, because the identity port re-derives the role on every call. Sign-in lives on
 * its own port (`createAuthLoginAdapter` below): this path only presents a session the
 * provider already issued, and never sees a password.
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

/**
 * Sign in through `@sceneaxi/auth`, handing back the browser credential.
 *
 * This is the umbrella end of the hosted login route (sceneaxi#185). The password
 * transits this call and is gone: the identity port hands it to the injected Better
 * Auth adapter, the store keeps only the session token's digest, and what comes back
 * out is the one redeemable copy of the raw token — composed here into the same
 * `<sessionId>.<token>` credential `parseSessionToken` reads back on every later
 * request, because this module owns that format in both directions.
 *
 * Refusals are read through `siteReasonForLoginAuthReason` rather than the verify
 * mapping, because this is the only place that knows the refusal happened while a
 * session was being *issued*: rejected credentials are the visitor's own named
 * outcome rather than the generic "signed out", and a provider fault is named as
 * one instead of blaming a credential no browser presented. An empty submission is
 * refused by the site login plane before this adapter is reached at all.
 */
export function createAuthLoginAdapter(options: {
  readonly port: IdentityPort;
}): SiteLoginAdapter {
  return Object.freeze({
    async signIn(request: SiteLoginRequest): Promise<SiteResult<SiteLoginGrant>> {
      const granted = await options.port.signIn({
        surface: request.surface,
        email: request.email,
        password: request.password,
      });
      if (!granted.ok) {
        return refuse(siteReasonForLoginAuthReason(granted.reason));
      }
      const principal = granted.value.principal;
      const sessionCredential = `${principal.session.sessionId}.${granted.value.sessionToken}`;
      const readBack = parseSessionToken(sessionCredential);
      if (
        readBack === null ||
        readBack.sessionId !== principal.session.sessionId ||
        readBack.token !== granted.value.sessionToken
      ) {
        return refuse("LOGIN_SESSION_NOT_ISSUED");
      }
      return ok(
        Object.freeze({
          principal: toSitePrincipal(principal),
          sessionCredential,
        }),
      );
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
  const deployment = wiring.deployment;
  const billingMode = deployment?.billingMode ?? resolveBillingMode(env);
  const clock = wiring.clock ?? deployment?.clock ?? (() => Date.now());
  const admin = wiring.admin ?? deployment?.admin ?? null;
  // Explicit wiring wins over the supplied capability registry. This pure builder never
  // reaches for ambient deployment state; production uses createUmbrellaDeploymentPlane.
  const deploymentHandle = <Key extends keyof UmbrellaPlaneHandles>(
    key: Key,
  ): UmbrellaPlaneHandles[Key] | undefined => {
    return deployment?.[key];
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

  const buildLoginAdapter = (): SiteLoginAdapter | undefined => {
    const port = identityPort();
    if (port === undefined) return undefined;
    return createAuthLoginAdapter({ port });
  };

  /**
   * Sign out the session this plane's bound credential names.
   *
   * The principal handed to `port.signOut` must be the identity-port-issued object
   * itself — the runtime-provenance witness refuses a rebuilt lookalike — which is
   * why this lives here, where `verifyCarriedSession` still holds it, rather than
   * downstream of the structural site projection.
   */
  const signOutBoundSession = async (): Promise<SiteResult<null>> => {
    const port = identityPort();
    if (port === undefined) return refuse("IDENTITY_PLANE_NOT_WIRED");
    const verified = await verifyCarriedSession({
      port,
      surface: "site",
      sessionToken: wiring.sessionToken,
    });
    // A credential that names no live session — absent, expired, or already
    // deleted — has nothing left to revoke: the signed-out end state holds.
    if (!verified.ok) {
      return verified.reason === "IDENTITY_SESSION_ABSENT" ||
        verified.reason === "IDENTITY_SESSION_EXPIRED"
        ? ok(null)
        : verified;
    }
    if (verified.value === null) return ok(null);
    const removed = await port.signOut({ principal: verified.value });
    if (!removed.ok) {
      // `principalInvalid` here means the stored session rotated or vanished
      // between the verify and the delete; either way it is provably not the
      // session this credential names any more.
      return removed.reason === AUTH_REFUSE_REASONS.principalInvalid
        ? ok(null)
        : refuse(siteReasonForAuthReason(removed.reason));
    }
    return ok(null);
  };

  const identityAdapter = wiring.identity ?? buildIdentityAdapter();
  const creditsAdapter = wiring.credits ?? buildCreditsAdapter();
  const billingAdapter = wiring.billing ?? buildBillingAdapter();
  const loginAdapter = wiring.login ?? buildLoginAdapter();

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
    login: createLoginPlane({
      adapter: loginAdapter,
      now: () => new Date(clock()).toISOString(),
    }),
    signOut: signOutBoundSession,
    wired: Object.freeze({
      identity: identityAdapter !== undefined,
      credits: creditsAdapter !== undefined,
      // Billing counts as wired only when a checkout can actually be created.
      // Listing packs works regardless, because the catalog is committed.
      billing: wiring.billing !== undefined || checkoutSessions() !== undefined,
      login: loginAdapter !== undefined,
    }),
    billingMode,
  });
}

export type UmbrellaDeploymentRequest = Readonly<{
  readonly sessionToken?: string | null | undefined;
}>;

/**
 * Build one request plane from the deployment-owned capability registry.
 *
 * The request may supply only its carried session credential. It cannot replace the
 * admin evidence, provider clients, stores, clock, billing mode, or webhook authority.
 */
export function createUmbrellaDeploymentPlane(
  request: UmbrellaDeploymentRequest = {},
): UmbrellaIdentityPlane {
  return createUmbrellaIdentityPlane(
    {},
    {
      deployment: umbrellaPlaneHandles(),
      ...(request.sessionToken === undefined ? {} : { sessionToken: request.sessionToken }),
    },
  );
}

/** Where a reader is sent when a plane is unwired. */
export const IDENTITY_PLANE_DOC = "docs/websites-deploy.md";

export const IDENTITY_PLANE_PENDING_NOTE =
  "Signing in is not open on this deployment yet. The sign-in route ships here (sceneaxi#185), but this deployment has not configured the provider handles it runs on, so no session can be issued or verified and no balance can be read from its own Neon and Stripe test handles. Until those handles are configured these surfaces refuse with a named reason rather than showing an invented session, balance, or checkout.";

/**
 * The billing half of the same fact, for surfaces that only found the checkout
 * plane missing.
 *
 * It says nothing about identity, because the two planes are configured
 * independently: a deployment can carry Better Auth and Neon without a Stripe
 * test key, and telling a signed-in visitor that sign-in is closed would be
 * false on exactly that deployment.
 */
export const BILLING_PLANE_PENDING_NOTE =
  "Buying is not open on this deployment yet. It has not configured the Stripe test handle the hosted checkout round-trip runs on, so no checkout session can be created. Prices shown here are the committed catalog's own; nothing is invented to fill the gap, and signing in is unaffected — it is configured separately.";
