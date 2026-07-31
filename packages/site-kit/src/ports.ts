/**
 * Site-side identity / credits / billing **ports**.
 *
 * These are the single seam between the deployable `sites/` surfaces and the
 * identity plane owned by `sceneaxi-auth-credits-v1` (`@sceneaxi/auth`,
 * `@sceneaxi/billing`). The shapes here are deliberate structural projections of
 * that ship's contracts (`Principal`, `User`, `Session`, `CreditLedgerEntry`,
 * `CreditPack`, `CheckoutSessionIntent`), so its exports satisfy these ports as
 * injected adapters.
 *
 * This module implements **no identity and no ledger**. It does not resolve an
 * admin email, does not derive a balance from ledger entries, and does not verify
 * a Stripe signature — those stay owned by `@sceneaxi/auth` / `@sceneaxi/billing`.
 * What it does own is the fail-closed boundary: unwired planes refuse, client role
 * claims refuse, the Kids surface refuses, and adapter output is validated before
 * a site is allowed to trust it.
 */
import {
  SITE_REFUSAL_REASONS,
  type SiteRefusal,
  type SiteRefusalReason,
  type SiteResult,
  ok,
  refuse,
} from "./refusals.js";
import { SITE_COOKIE_OCTET_RE } from "./site-session.js";

/**
 * Identity surfaces, in the vocabulary `sceneaxi-auth-credits-v1` (#91) defines
 * (`IDENTITY_SURFACES`). All three deployable sites map onto the `"site"` identity
 * surface; `"web-shell"` and `"desktop-shell"` are the other shells that vertical knows,
 * and `"kids"` is listed only so it can be refused before any adapter dispatch. The
 * umbrella / catalog-game / catalog-web identifiers stay for routing, branding, catalog
 * lookup, and deep links — they are not identity surfaces.
 */
export const IDENTITY_SURFACES = Object.freeze([
  "web-shell",
  "desktop-shell",
  "site",
  "kids",
] as const);

export type SiteSurface = (typeof IDENTITY_SURFACES)[number];

export const SITE_ROLES = Object.freeze(["admin", "user"] as const);

export type SiteRole = (typeof SITE_ROLES)[number];

/**
 * Property names that may never arrive from a client. A site that accepted any of
 * these would become a client-claimable admin path.
 */
export const CLIENT_ROLE_CLAIM_KEYS = Object.freeze([
  "role",
  "roles",
  "admin",
  "isAdmin",
] as const);

export type SiteUser = {
  readonly userId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly disabled: boolean;
};

export type SiteSession = {
  readonly sessionId: string;
  readonly userId: string;
  readonly surface: SiteSurface;
  readonly issuedAt: string;
  readonly expiresAt: string;
};

/** The only shape a site guard accepts. Mirrors auth-credits `Principal`. */
export type SitePrincipal = {
  readonly user: SiteUser;
  readonly role: SiteRole;
  readonly session: SiteSession;
};

export type SiteCreditBalance = {
  readonly userId: string;
  /** Derived by `@sceneaxi/billing` from the append-only ledger, never here. */
  readonly balance: number;
  readonly starterGrantConsumed: boolean;
};

export type SiteCreditPack = {
  readonly packId: string;
  readonly credits: number;
  readonly unitAmount: number;
  readonly currency: string;
};

export type SiteBillingMode = "test" | "live";

export type SiteIdentityRequest = {
  readonly surface: SiteSurface;
  readonly sessionToken?: string | null;
  /** Opaque to this package; scanned for client role claims, never interpreted. */
  readonly credentials?: unknown;
};

export type SiteCheckoutRequest = {
  readonly userId: string;
  readonly packId: string;
  readonly mode: SiteBillingMode;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly idempotencyKey: string;
};

/** Secret-free handoff a site may redirect to. Mirrors the checkout intent seam. */
export type SiteCheckoutHandoff = {
  readonly intentId: string;
  readonly redirectUrl: string;
  readonly mode: SiteBillingMode;
};

// --- adapter boundaries (satisfied by @sceneaxi/auth / @sceneaxi/billing) ---

/**
 * The identity adapter boundary.
 *
 * `null` is a first-class success: "this request carries no live session". It is
 * distinct from a refusal, because a signed-out visitor is an ordinary state and
 * must not be reported with the vocabulary of a broken plane.
 */
export interface SiteIdentityAdapter {
  resolvePrincipal(
    request: SiteIdentityRequest,
  ): Promise<SiteResult<SitePrincipal | null>>;
}

export interface SiteCreditsAdapter {
  readBalance(input: { readonly userId: string }): Promise<SiteResult<SiteCreditBalance>>;
}

export interface SiteBillingAdapter {
  listCreditPacks(): Promise<SiteResult<readonly SiteCreditPack[]>>;
  createCheckout(request: SiteCheckoutRequest): Promise<SiteResult<SiteCheckoutHandoff>>;
}

// --- ports ---

export interface SiteIdentityPort {
  resolvePrincipal(request: SiteIdentityRequest): Promise<SiteResult<SitePrincipal>>;
}

export interface SiteCreditsPort {
  readBalance(input: { readonly userId: string }): Promise<SiteResult<SiteCreditBalance>>;
}

export interface SiteBillingPort {
  readonly mode: SiteBillingMode;
  listCreditPacks(): Promise<SiteResult<readonly SiteCreditPack[]>>;
  createCheckout(
    request: Omit<SiteCheckoutRequest, "mode">,
  ): Promise<SiteResult<SiteCheckoutHandoff>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Call an adapter, turning a throw into a named refusal.
 *
 * An adapter reaches a database or a provider, so it can fail in ways neither it
 * nor this package predicted. Without this the exception would escape the port
 * and become a 500 on a page whose whole contract is to answer with a named
 * reason — and "unavailable" would be indistinguishable from "absent".
 */
async function callAdapter<Value>(
  call: () => Promise<SiteResult<Value>>,
  unavailable: SiteRefusalReason,
): Promise<SiteResult<Value> | SiteRefusal> {
  try {
    return await call();
  } catch {
    return refuse(unavailable);
  }
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isCanonicalIsoInstant = (value: unknown): value is string =>
  isNonEmptyString(value) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value);

type ClientPayloadInspection = "safe" | "role-claim" | "malformed";

function inspectClientPayload(payload: unknown): ClientPayloadInspection {
  const pending: unknown[] = [payload];
  const visited = new WeakSet<object>();
  try {
    while (pending.length > 0) {
      const current = pending.pop();
      if (
        current === null ||
        current === undefined ||
        typeof current === "boolean" ||
        (typeof current === "number" && Number.isFinite(current))
      ) {
        continue;
      }
      if (typeof current === "string") {
        const trimmed = current.trim();
        if (
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
          pending.push(JSON.parse(trimmed) as unknown);
        }
        continue;
      }
      if (typeof current !== "object" || visited.has(current)) return "malformed";
      visited.add(current);

      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) return "malformed";
        const keys = Reflect.ownKeys(current);
        if (
          keys.some(
            (key) =>
              typeof key !== "string" ||
              (key !== "length" && !/^(?:0|[1-9]\d*)$/.test(key)),
          )
        ) {
          return "malformed";
        }
        for (let index = 0; index < current.length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
          if (descriptor === undefined || !("value" in descriptor)) return "malformed";
          pending.push(descriptor.value);
        }
        continue;
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) return "malformed";
      for (const key of Reflect.ownKeys(current)) {
        if (typeof key !== "string") return "malformed";
        if ((CLIENT_ROLE_CLAIM_KEYS as readonly string[]).includes(key)) {
          return "role-claim";
        }
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (descriptor === undefined || !("value" in descriptor)) return "malformed";
        pending.push(descriptor.value);
      }
    }
  } catch {
    return "malformed";
  }
  return "safe";
}

function inspectCredentialsPayload(payload: unknown): ClientPayloadInspection {
  if (payload === undefined || payload === null) return "safe";
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (
      !(
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      )
    ) {
      return "malformed";
    }
  } else if (typeof payload !== "object") {
    return "malformed";
  }
  return inspectClientPayload(payload);
}

/**
 * Whether a payload carries a client-supplied role claim, at any depth.
 *
 * Depth matters: a nested `{ user: { isAdmin: true } }` is the same attack as a
 * top-level one, and a site must refuse both before dispatching to an adapter.
 */
export function hasClientRoleClaim(payload: unknown): boolean {
  return inspectClientPayload(payload) === "role-claim";
}

function canonicalAdapterRefusal(
  result: Record<string, unknown>,
  invalidReason:
    | "IDENTITY_ADAPTER_OUTPUT_INVALID"
    | "CREDIT_ADAPTER_OUTPUT_INVALID"
    | "BILLING_ADAPTER_OUTPUT_INVALID",
): SiteRefusal {
  const reason = result["reason"];
  if (
    result["ok"] !== false ||
    !(SITE_REFUSAL_REASONS as readonly unknown[]).includes(reason)
  ) {
    return refuse(invalidReason);
  }
  return refuse(reason as SiteRefusalReason);
}

function validateIdentityRequest(request: unknown): SiteRefusal | null {
  if (!isRecord(request)) return refuse("SITE_REQUEST_MALFORMED");
  const surface = request["surface"];
  if (!(IDENTITY_SURFACES as readonly unknown[]).includes(surface)) {
    return refuse("SITE_SURFACE_UNKNOWN");
  }
  // Kids refuses before anything else touches an adapter or a store, and no
  // option, env value, or adapter can override it.
  if (surface === "kids") return refuse("KIDS_SURFACE_DENIED");
  const token = request["sessionToken"];
  if (token !== undefined && token !== null && !isNonEmptyString(token)) {
    return refuse("SITE_REQUEST_MALFORMED");
  }
  const inspection = inspectClientPayload(request);
  if (inspection === "role-claim") return refuse("ROLE_CLAIM_FROM_CLIENT_DENIED");
  if (inspection === "malformed") return refuse("SITE_REQUEST_MALFORMED");
  const credentialsInspection = inspectCredentialsPayload(request["credentials"]);
  if (credentialsInspection === "role-claim") {
    return refuse("ROLE_CLAIM_FROM_CLIENT_DENIED");
  }
  if (credentialsInspection === "malformed") return refuse("SITE_REQUEST_MALFORMED");
  return null;
}

function validatePrincipal(
  value: unknown,
  request: SiteIdentityRequest,
  nowIso: string,
): SiteResult<SitePrincipal> {
  if (!isRecord(value)) return refuse("IDENTITY_ADAPTER_OUTPUT_INVALID");
  const user = value["user"];
  const session = value["session"];
  const role = value["role"];
  if (!isRecord(user) || !isRecord(session)) return refuse("IDENTITY_ADAPTER_OUTPUT_INVALID");
  if (
    !isNonEmptyString(user["userId"]) ||
    !isNonEmptyString(user["email"]) ||
    typeof user["emailVerified"] !== "boolean" ||
    typeof user["disabled"] !== "boolean"
  ) {
    return refuse("IDENTITY_ADAPTER_OUTPUT_INVALID");
  }
  if (
    !isNonEmptyString(session["sessionId"]) ||
    !isNonEmptyString(session["userId"]) ||
    session["userId"] !== user["userId"]
  ) {
    return refuse("IDENTITY_ADAPTER_OUTPUT_INVALID");
  }
  const issuedAt = session["issuedAt"];
  const expiresAt = session["expiresAt"];
  if (!isCanonicalIsoInstant(issuedAt) || !isCanonicalIsoInstant(expiresAt)) {
    return refuse("IDENTITY_ADAPTER_OUTPUT_INVALID");
  }
  const issuedAtMs = Date.parse(issuedAt);
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
    return refuse("IDENTITY_ADAPTER_OUTPUT_INVALID");
  }
  if (!(SITE_ROLES as readonly unknown[]).includes(role)) return refuse("IDENTITY_ROLE_UNKNOWN");
  if (user["disabled"] === true) return refuse("IDENTITY_USER_DISABLED");
  if (session["surface"] !== request.surface) return refuse("IDENTITY_SESSION_SURFACE_MISMATCH");
  const nowMs = Date.parse(nowIso);
  if (issuedAtMs > nowMs) return refuse("IDENTITY_SESSION_NOT_YET_VALID");
  if (expiresAtMs <= nowMs) return refuse("IDENTITY_SESSION_EXPIRED");
  return ok(
    Object.freeze({
      user: Object.freeze({
        userId: user["userId"],
        email: user["email"],
        emailVerified: user["emailVerified"],
        disabled: user["disabled"],
      }),
      role: role as SiteRole,
      session: Object.freeze({
        sessionId: session["sessionId"],
        userId: session["userId"],
        surface: session["surface"] as SiteSurface,
        issuedAt: issuedAt,
        expiresAt: expiresAt,
      }),
    }),
  );
}

export type IdentityPlaneOptions = {
  readonly adapter?: SiteIdentityAdapter | undefined;
  /** Injected clock so session expiry is deterministic under test. */
  readonly now?: (() => string) | undefined;
};

/**
 * Create the identity port. With no adapter every call refuses
 * `IDENTITY_PLANE_NOT_WIRED` — an unwired site is never an open site.
 */
export function createIdentityPlane(options: IdentityPlaneOptions = {}): SiteIdentityPort {
  const nowIso = options.now ?? (() => new Date().toISOString());
  return Object.freeze({
    async resolvePrincipal(request: SiteIdentityRequest): Promise<SiteResult<SitePrincipal>> {
      const invalid = validateIdentityRequest(request);
      if (invalid !== null) return invalid;
      if (options.adapter === undefined) return refuse("IDENTITY_PLANE_NOT_WIRED");
      const adapter = options.adapter;
      const result = await callAdapter(
        () => adapter.resolvePrincipal(request),
        "IDENTITY_PLANE_UNAVAILABLE",
      );
      if (!isRecord(result)) return refuse("IDENTITY_ADAPTER_OUTPUT_INVALID");
      if (result["ok"] !== true) {
        return canonicalAdapterRefusal(result, "IDENTITY_ADAPTER_OUTPUT_INVALID");
      }
      // A signed-out visitor is reported as such, never as a broken plane.
      if (result["value"] === null) return refuse("IDENTITY_SESSION_ABSENT");
      return validatePrincipal(result["value"], request, nowIso());
    },
  });
}

// --- hosted login ------------------------------------------------------------

/**
 * A sign-in submission. `email` and `password` are the only credential a
 * browser may supply — they prove who the visitor is to the injected provider,
 * while roles, sessions, and user identity stay server-derived. The password is
 * treated as opaque: it is never parsed, logged, or echoed back.
 */
export type SiteLoginRequest = {
  readonly surface: SiteSurface;
  readonly email: string;
  readonly password: string;
};

/**
 * What a successful sign-in hands the site: the server-derived principal, plus
 * the opaque browser credential the session cookie will carry. The credential's
 * format is owned by the site's identity wiring (it is what
 * `SiteIdentityRequest.sessionToken` later presents); this package only checks
 * that it is a value a cookie can actually hold.
 */
export type SiteLoginGrant = {
  readonly principal: SitePrincipal;
  readonly sessionCredential: string;
};

export interface SiteLoginAdapter {
  signIn(request: SiteLoginRequest): Promise<SiteResult<SiteLoginGrant>>;
}

export interface SiteLoginPort {
  signIn(request: SiteLoginRequest): Promise<SiteResult<SiteLoginGrant>>;
}

export type LoginPlaneOptions = {
  readonly adapter?: SiteLoginAdapter | undefined;
  /** Injected clock so session expiry is deterministic under test. */
  readonly now?: (() => string) | undefined;
};

const LOGIN_KEYS = Object.freeze(["surface", "email", "password"] as const);

function validateLoginRequest(request: unknown): SiteRefusal | null {
  if (!isRecord(request)) return refuse("SITE_REQUEST_MALFORMED");
  // A role claim beside the credentials is an escalation attempt and refuses
  // before anything else — never silently stripped, and never dispatched.
  for (const key of Object.keys(request)) {
    if ((CLIENT_ROLE_CLAIM_KEYS as readonly string[]).includes(key)) {
      return refuse("ROLE_CLAIM_FROM_CLIENT_DENIED");
    }
    if (!(LOGIN_KEYS as readonly string[]).includes(key)) {
      return refuse("SITE_REQUEST_MALFORMED");
    }
  }
  const surface = request["surface"];
  if (!(IDENTITY_SURFACES as readonly unknown[]).includes(surface)) {
    return refuse("SITE_SURFACE_UNKNOWN");
  }
  // Kids refuses before the adapter is reached, non-overridably: no Kids
  // sign-in exists, so no adapter can be consulted about one.
  if (surface === "kids") return refuse("KIDS_SURFACE_DENIED");
  const email = request["email"];
  const password = request["password"];
  if (
    !isNonEmptyString(email) ||
    typeof password !== "string" ||
    password.length === 0
  ) {
    return refuse("LOGIN_CREDENTIALS_REQUIRED");
  }
  return null;
}

/**
 * Create the login port. With no adapter every call refuses
 * `IDENTITY_PLANE_NOT_WIRED`, the same reading the identity port gives an
 * unwired deployment: sign-in that cannot reach a provider is not sign-in.
 *
 * The adapter's grant is re-validated here exactly like a resolved principal —
 * a disabled user, an expired or surface-mismatched session, or an unknown role
 * refuses with its own named reason — so an adapter cannot hand a site a
 * principal the identity plane would not have accepted.
 */
export function createLoginPlane(options: LoginPlaneOptions = {}): SiteLoginPort {
  const nowIso = options.now ?? (() => new Date().toISOString());
  return Object.freeze({
    async signIn(request: SiteLoginRequest): Promise<SiteResult<SiteLoginGrant>> {
      const invalid = validateLoginRequest(request);
      if (invalid !== null) return invalid;
      if (options.adapter === undefined) return refuse("IDENTITY_PLANE_NOT_WIRED");
      const adapter = options.adapter;
      const result = await callAdapter(
        () => adapter.signIn(request),
        "IDENTITY_PLANE_UNAVAILABLE",
      );
      if (!isRecord(result)) return refuse("IDENTITY_ADAPTER_OUTPUT_INVALID");
      if (result["ok"] !== true) {
        return canonicalAdapterRefusal(result, "IDENTITY_ADAPTER_OUTPUT_INVALID");
      }
      const grant = result["value"];
      if (!isRecord(grant)) return refuse("IDENTITY_ADAPTER_OUTPUT_INVALID");
      const principal = validatePrincipal(
        grant["principal"],
        { surface: request.surface },
        nowIso(),
      );
      if (!principal.ok) return principal;
      const credential = grant["sessionCredential"];
      if (typeof credential !== "string" || !SITE_COOKIE_OCTET_RE.test(credential)) {
        return refuse("IDENTITY_ADAPTER_OUTPUT_INVALID");
      }
      return ok(
        Object.freeze({ principal: principal.value, sessionCredential: credential }),
      );
    },
  });
}

export type CreditsPlaneOptions = { readonly adapter?: SiteCreditsAdapter | undefined };

/** Create the credits port. Balance is read from the plane, never derived here. */
export function createCreditsPlane(options: CreditsPlaneOptions = {}): SiteCreditsPort {
  return Object.freeze({
    async readBalance(input: {
      readonly userId: string;
    }): Promise<SiteResult<SiteCreditBalance>> {
      if (!isRecord(input) || !isNonEmptyString(input.userId)) {
        return refuse("SITE_REQUEST_MALFORMED");
      }
      if (options.adapter === undefined) return refuse("CREDITS_PLANE_NOT_WIRED");
      const adapter = options.adapter;
      const result = await callAdapter(
        () => adapter.readBalance({ userId: input.userId }),
        "CREDITS_PLANE_UNAVAILABLE",
      );
      if (!isRecord(result)) return refuse("CREDIT_ADAPTER_OUTPUT_INVALID");
      if (result["ok"] !== true) {
        return canonicalAdapterRefusal(result, "CREDIT_ADAPTER_OUTPUT_INVALID");
      }
      const value = result["value"];
      if (
        !isRecord(value) ||
        !isNonEmptyString(value["userId"]) ||
        value["userId"] !== input.userId ||
        typeof value["starterGrantConsumed"] !== "boolean"
      ) {
        return refuse("CREDIT_ADAPTER_OUTPUT_INVALID");
      }
      const balance = value["balance"];
      if (!Number.isSafeInteger(balance) || (balance as number) < 0) {
        return refuse("CREDIT_BALANCE_INVALID");
      }
      return ok(
        Object.freeze({
          userId: value["userId"],
          balance: balance as number,
          starterGrantConsumed: value["starterGrantConsumed"],
        }),
      );
    },
  });
}

export type BillingPlaneOptions = {
  readonly adapter?: SiteBillingAdapter | undefined;
  readonly mode?: SiteBillingMode | undefined;
  /** Live mode is inert unless a captain decision explicitly authorizes it. */
  readonly liveModeAuthorized?: boolean | undefined;
};

const isHttpsUrl = (value: unknown): boolean => {
  if (!isNonEmptyString(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Create the billing port. Default mode is `test`; `live` refuses without an
 * explicit authorization, so a production deploy cannot drift into live charges.
 */
export function createBillingPlane(options: BillingPlaneOptions = {}): SiteBillingPort {
  const mode: SiteBillingMode = options.mode ?? "test";
  const liveDenied = mode === "live" && options.liveModeAuthorized !== true;
  return Object.freeze({
    mode,
    async listCreditPacks(): Promise<SiteResult<readonly SiteCreditPack[]>> {
      if (liveDenied) return refuse("BILLING_LIVE_MODE_NOT_AUTHORIZED");
      if (options.adapter === undefined) return refuse("BILLING_PLANE_NOT_WIRED");
      const adapter = options.adapter;
      const result = await callAdapter(
        () => adapter.listCreditPacks(),
        "BILLING_PLANE_UNAVAILABLE",
      );
      if (!isRecord(result)) return refuse("BILLING_ADAPTER_OUTPUT_INVALID");
      if (result["ok"] !== true) {
        return canonicalAdapterRefusal(result, "BILLING_ADAPTER_OUTPUT_INVALID");
      }
      const packs = result["value"];
      if (!Array.isArray(packs)) return refuse("BILLING_ADAPTER_OUTPUT_INVALID");
      const canonicalPacks: SiteCreditPack[] = [];
      for (const pack of packs) {
        if (
          !isRecord(pack) ||
          !isNonEmptyString(pack["packId"]) ||
          !Number.isSafeInteger(pack["credits"]) ||
          !Number.isSafeInteger(pack["unitAmount"]) ||
          (pack["credits"] as number) <= 0 ||
          (pack["unitAmount"] as number) <= 0 ||
          !isNonEmptyString(pack["currency"])
        ) {
          return refuse("BILLING_ADAPTER_OUTPUT_INVALID");
        }
        canonicalPacks.push(
          Object.freeze({
            packId: pack["packId"],
            credits: pack["credits"] as number,
            unitAmount: pack["unitAmount"] as number,
            currency: pack["currency"],
          }),
        );
      }
      return ok(Object.freeze(canonicalPacks));
    },
    async createCheckout(
      request: Omit<SiteCheckoutRequest, "mode">,
    ): Promise<SiteResult<SiteCheckoutHandoff>> {
      if (liveDenied) return refuse("BILLING_LIVE_MODE_NOT_AUTHORIZED");
      if (
        !isRecord(request) ||
        !isNonEmptyString(request.userId) ||
        !isNonEmptyString(request.packId) ||
        !isNonEmptyString(request.idempotencyKey)
      ) {
        return refuse("BILLING_CHECKOUT_REQUEST_INVALID");
      }
      if (!isHttpsUrl(request.successUrl) || !isHttpsUrl(request.cancelUrl)) {
        return refuse("BILLING_URL_INSECURE");
      }
      if (options.adapter === undefined) return refuse("BILLING_PLANE_NOT_WIRED");
      const adapter = options.adapter;
      const result = await callAdapter(
        () => adapter.createCheckout({ ...request, mode }),
        "BILLING_PLANE_UNAVAILABLE",
      );
      if (!isRecord(result)) return refuse("BILLING_ADAPTER_OUTPUT_INVALID");
      if (result["ok"] !== true) {
        return canonicalAdapterRefusal(result, "BILLING_ADAPTER_OUTPUT_INVALID");
      }
      const handoff = result["value"];
      if (
        !isRecord(handoff) ||
        !isNonEmptyString(handoff["intentId"]) ||
        !isHttpsUrl(handoff["redirectUrl"]) ||
        handoff["mode"] !== mode
      ) {
        return refuse("BILLING_ADAPTER_OUTPUT_INVALID");
      }
      return ok(
        Object.freeze({
          intentId: handoff["intentId"],
          redirectUrl: handoff["redirectUrl"] as string,
          mode,
        }),
      );
    },
  });
}
