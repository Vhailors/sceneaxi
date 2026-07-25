/**
 * The identity port: the one way a SceneAxi surface turns credentials or a
 * session cookie into a `Principal`.
 *
 * Every dependency is checked *per call* rather than at construction, so a
 * half-wired port refuses instead of silently allowing. The check order is
 * itself the security design:
 *
 *   1. envelope shape          — cheapest, and stops malformed input early
 *   2. client role claim       — refused before any adapter or store is touched
 *   3. surface, then Kids      — refused before dispatch, non-overridably
 *   4. wiring, then dispatch   — a missing dependency can never allow
 *
 * Steps 2 and 3 come before step 4 on purpose: an escalation attempt or a Kids
 * request must never reach a provider, so no adapter can influence the outcome.
 */

import {
  claimedRoleKey,
  isEpochMilliseconds,
  isIdentitySurface,
  snapshotPlainRecord,
  validatePrincipal,
  validateSession,
  validateUser,
  type IdentitySurface,
  type Principal,
  type Session,
} from "@sceneaxi/schemas";
import type { AdminIdentity } from "./admin.js";
import {
  mapBetterAuthAuthentication,
  type IdentityAdapter,
} from "./better-auth-adapter.js";
import { resolveRole } from "./roles.js";
import {
  AUTH_REFUSE_REASONS,
  authOk,
  authRefuse,
  type AuthRefuse,
  type AuthResult,
} from "./refusals.js";
import { sessionTokenMatches } from "./session-token.js";
import type { IdentityStore } from "./store.js";

export type SignInRequest = Readonly<{
  surface: IdentitySurface;
  email: string;
  password: string;
}>;

export type VerifySessionRequest = Readonly<{
  surface: IdentitySurface;
  sessionId: string;
  token: string;
}>;

export type SignOutRequest = Readonly<{ principal: Principal }>;

export type IdentityPort = Readonly<{
  signIn(request: unknown): Promise<AuthResult<Principal>>;
  verifySession(request: unknown): Promise<AuthResult<Principal>>;
  signOut(request: unknown): Promise<AuthResult<null>>;
}>;

/**
 * Every dependency is optional *and* explicitly nullable, because the port's
 * contract is to refuse a half-wired call rather than to be unconstructable.
 * A caller assembling options dynamically can pass `undefined` and get a named
 * refusal instead of a type error that tempts a cast.
 */
export type CreateIdentityPortOptions = Readonly<{
  adapter?: IdentityAdapter | undefined;
  store?: IdentityStore | undefined;
  /** Resolved by `resolveAdminIdentity`; absent means the port refuses. */
  admin?: AdminIdentity | undefined;
  /** Epoch milliseconds. Injected so sessions and role stamps are deterministic. */
  clock?: (() => number) | undefined;
}>;

const SIGN_IN_KEYS = Object.freeze(["surface", "email", "password"]);
const VERIFY_KEYS = Object.freeze(["surface", "sessionId", "token"]);
const SIGN_OUT_KEYS = Object.freeze(["principal"]);

/**
 * Shape, role-claim, and Kids checks, in that order, for any inbound request.
 * Returns the record on success so callers read fields only after it passed.
 */
function screenRequest(
  request: unknown,
  keys: ReadonlyArray<string>,
  requireSurface: boolean,
): AuthResult<Record<string, unknown>> {
  const record = snapshotPlainRecord(request);
  if (record === undefined) {
    return authRefuse(
      AUTH_REFUSE_REASONS.requestInvalid,
      "The identity request must be a plain object.",
    );
  }

  // Before anything else that could touch a provider: a client-asserted role is
  // an escalation attempt and is refused, never stripped.
  const claimed = claimedRoleKey(record);
  if (claimed !== undefined) {
    return authRefuse(
      AUTH_REFUSE_REASONS.roleClaimFromClient,
      `The request carries a client-asserted role property ("${claimed}"); roles are derived server-side only.`,
    );
  }

  const allowed = new Set(keys);
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) {
      return authRefuse(
        AUTH_REFUSE_REASONS.requestInvalid,
        `The identity request is missing required property "${key}".`,
      );
    }
  }
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return authRefuse(
        AUTH_REFUSE_REASONS.requestInvalid,
        `The identity request has unexpected property "${key}".`,
      );
    }
  }

  if (requireSurface) {
    const surface = record["surface"];
    if (!isIdentitySurface(surface)) {
      return authRefuse(
        AUTH_REFUSE_REASONS.surfaceInvalid,
        "The identity request names an unknown surface.",
      );
    }
    if (surface === "kids") {
      return authRefuse(
        AUTH_REFUSE_REASONS.kidsSurfaceDenied,
        "Kids never shares identity with another SceneAxi surface; no session is minted or accepted.",
      );
    }
  }

  return authOk(record);
}

function readClock(clock: (() => number) | undefined): AuthResult<number> {
  if (typeof clock !== "function") {
    return authRefuse(
      AUTH_REFUSE_REASONS.clockInvalid,
      "No clock is configured; the identity port refuses rather than trusting wall time implicitly.",
    );
  }
  let now: unknown;
  try {
    now = clock();
  } catch {
    return authRefuse(
      AUTH_REFUSE_REASONS.clockInvalid,
      "The configured clock threw; the identity port refuses.",
    );
  }
  if (!isEpochMilliseconds(now)) {
    return authRefuse(
      AUTH_REFUSE_REASONS.clockInvalid,
      "The configured clock did not return valid epoch milliseconds.",
    );
  }
  return authOk(now);
}

/** Assemble and re-validate a principal, so no partly-built one escapes. */
function assemblePrincipal(input: {
  readonly user: unknown;
  readonly session: Session;
  readonly admin: AdminIdentity;
  readonly now: number;
}): AuthResult<Principal> {
  const user = validateUser(input.user);
  if (!user.ok) {
    return authRefuse(
      AUTH_REFUSE_REASONS.userRecordInvalid,
      `The stored user record is invalid (${user.code}): ${user.message}`,
    );
  }
  if (user.value.disabled) {
    return authRefuse(
      AUTH_REFUSE_REASONS.userDisabled,
      "The user is disabled; sign-in and session verification both refuse.",
    );
  }
  if (
    user.value.email.trim().toLowerCase() === input.admin.email &&
    !user.value.emailVerified
  ) {
    return authRefuse(
      AUTH_REFUSE_REASONS.adminEmailUnverified,
      "The configured admin email is not verified in the SceneAxi user record; admin elevation refuses.",
    );
  }

  const role = resolveRole({
    user: user.value,
    admin: input.admin,
    now: input.now,
  });

  const principal = validatePrincipal({
    user: user.value,
    role,
    session: input.session,
  });
  if (!principal.ok) {
    return authRefuse(
      AUTH_REFUSE_REASONS.principalInvalid,
      `The assembled principal is invalid (${principal.code}): ${principal.message}`,
    );
  }
  return authOk(principal.value);
}

/** Any store call: a throw becomes a named refusal, never an allow. */
async function callStore<Value>(
  read: () => Promise<Value> | Value,
  what: string,
): Promise<AuthResult<Value>> {
  try {
    return authOk(await read());
  } catch {
    return authRefuse(
      AUTH_REFUSE_REASONS.storeFailed,
      `The identity store failed while ${what}; the request refuses.`,
    );
  }
}

export function createIdentityPort(
  options: CreateIdentityPortOptions,
): IdentityPort {
  const issuedPrincipals = new WeakSet<object>();
  const issuePrincipal = (principal: Principal): void => {
    issuedPrincipals.add(principal);
  };
  const requireStore = (): AuthResult<IdentityStore> =>
    options.store === undefined
      ? authRefuse(
          AUTH_REFUSE_REASONS.storeMissing,
          "No identity store is configured; the identity port refuses.",
        )
      : authOk(options.store);

  const requireAdmin = (): AuthResult<AdminIdentity> =>
    options.admin === undefined
      ? authRefuse(
          AUTH_REFUSE_REASONS.adminIdentityUnresolved,
          "The single admin identity is unresolved; the identity port refuses rather than treating the captain as an ordinary user.",
        )
      : authOk(options.admin);

  return Object.freeze({
    async signIn(request) {
      const screened = screenRequest(request, SIGN_IN_KEYS, true);
      if (!screened.ok) return screened;
      const record = screened.value;
      const surface = record["surface"] as IdentitySurface;

      const email = record["email"];
      const password = record["password"];
      if (
        typeof email !== "string" ||
        email.trim().length === 0 ||
        typeof password !== "string" ||
        password.length === 0
      ) {
        return authRefuse(
          AUTH_REFUSE_REASONS.requestInvalid,
          "Sign-in requires a non-empty email and password.",
        );
      }

      const clock = readClock(options.clock);
      if (!clock.ok) return clock;
      const admin = requireAdmin();
      if (!admin.ok) return admin;
      if (options.adapter === undefined) {
        return authRefuse(
          AUTH_REFUSE_REASONS.adapterMissing,
          "No identity adapter is configured; sign-in refuses.",
        );
      }
      const store = requireStore();
      if (!store.ok) return store;

      let authentication: unknown;
      try {
        authentication = await options.adapter.authenticate({
          surface,
          email: email.trim(),
          password,
        });
      } catch {
        return authRefuse(
          AUTH_REFUSE_REASONS.adapterFailed,
          "The identity adapter failed; sign-in refuses rather than falling back.",
        );
      }
      if (authentication === undefined || authentication === null) {
        return authRefuse(
          AUTH_REFUSE_REASONS.credentialsRejected,
          "Those credentials did not authenticate.",
        );
      }

      const mapped = mapBetterAuthAuthentication({
        authentication,
        surface,
        issuedAt: clock.value,
      });
      if (mapped === undefined) {
        return authRefuse(
          AUTH_REFUSE_REASONS.adapterEnvelopeInvalid,
          "The identity adapter returned an authentication envelope this boundary does not accept.",
        );
      }
      if (mapped.email !== email.trim().toLowerCase()) {
        return authRefuse(
          AUTH_REFUSE_REASONS.adapterUserMismatch,
          "The identity provider returned a different email than the one submitted for authentication.",
        );
      }

      const session = validateSession(mapped.session);
      if (!session.ok) {
        return authRefuse(
          AUTH_REFUSE_REASONS.adapterEnvelopeInvalid,
          `The session derived from the adapter is invalid (${session.code}): ${session.message}`,
        );
      }

      const found = await callStore(
        () => store.value.findUserByEmail(mapped.email),
        "looking up the authenticated user",
      );
      if (!found.ok) return found;
      if (found.value === undefined) {
        return authRefuse(
          AUTH_REFUSE_REASONS.userNotFound,
          "The identity provider authenticated an address with no SceneAxi user record.",
        );
      }
      const storedUser = validateUser(found.value);
      if (!storedUser.ok) {
        return authRefuse(
          AUTH_REFUSE_REASONS.userRecordInvalid,
          `The stored user record is invalid (${storedUser.code}): ${storedUser.message}`,
        );
      }
      if (storedUser.value.email.trim().toLowerCase() !== mapped.email) {
        return authRefuse(
          AUTH_REFUSE_REASONS.adapterUserMismatch,
          "The identity provider's email does not match the stored SceneAxi user.",
        );
      }
      // The provider and the store must agree on identity, or the session would
      // be bound to a user the store never authorized.
      if (storedUser.value.userId !== mapped.providerUserId) {
        return authRefuse(
          AUTH_REFUSE_REASONS.adapterUserMismatch,
          "The identity provider's user id does not match the stored SceneAxi user.",
        );
      }
      if (
        storedUser.value.email.trim().toLowerCase() === admin.value.email &&
        !mapped.emailVerified
      ) {
        return authRefuse(
          AUTH_REFUSE_REASONS.adminEmailUnverified,
          "The identity provider has not verified the configured admin email; admin elevation refuses.",
        );
      }

      const principal = assemblePrincipal({
        user: storedUser.value,
        session: session.value,
        admin: admin.value,
        now: clock.value,
      });
      if (!principal.ok) return principal;

      const stored = await callStore(
        () => store.value.putSession(principal.value.session),
        "persisting the new session",
      );
      if (!stored.ok) return stored;

      issuePrincipal(principal.value);
      return principal;
    },

    async verifySession(request) {
      const screened = screenRequest(request, VERIFY_KEYS, true);
      if (!screened.ok) return screened;
      const record = screened.value;
      const surface = record["surface"] as IdentitySurface;

      const sessionId = record["sessionId"];
      const token = record["token"];
      if (
        typeof sessionId !== "string" ||
        sessionId.length === 0 ||
        typeof token !== "string" ||
        token.length === 0
      ) {
        return authRefuse(
          AUTH_REFUSE_REASONS.requestInvalid,
          "Session verification requires a non-empty session id and token.",
        );
      }

      const clock = readClock(options.clock);
      if (!clock.ok) return clock;
      const admin = requireAdmin();
      if (!admin.ok) return admin;
      const store = requireStore();
      if (!store.ok) return store;

      const found = await callStore(
        () => store.value.findSession(sessionId),
        "loading the session",
      );
      if (!found.ok) return found;
      if (found.value === undefined) {
        return authRefuse(
          AUTH_REFUSE_REASONS.sessionNotFound,
          "No such session.",
        );
      }

      const session = validateSession(found.value);
      if (!session.ok) {
        return authRefuse(
          AUTH_REFUSE_REASONS.sessionRecordInvalid,
          `The stored session record is invalid (${session.code}): ${session.message}`,
        );
      }

      // A stored Kids session is refused too, so a session written by any other
      // path can never be redeemed here.
      if (session.value.surface === "kids") {
        return authRefuse(
          AUTH_REFUSE_REASONS.kidsSurfaceDenied,
          "Kids never shares identity with another SceneAxi surface; the stored session is refused.",
        );
      }
      if (session.value.surface !== surface) {
        return authRefuse(
          AUTH_REFUSE_REASONS.sessionSurfaceMismatch,
          `The session belongs to the '${session.value.surface}' surface, not '${surface}'.`,
        );
      }
      if (Date.parse(session.value.expiresAt) <= clock.value) {
        return authRefuse(
          AUTH_REFUSE_REASONS.sessionExpired,
          "The session has expired.",
        );
      }
      if (!sessionTokenMatches(token, session.value.tokenDigest)) {
        return authRefuse(
          AUTH_REFUSE_REASONS.sessionTokenMismatch,
          "The presented session token does not match the stored digest.",
        );
      }

      const user = await callStore(
        () => store.value.findUserById(session.value.userId),
        "loading the session's user",
      );
      if (!user.ok) return user;
      if (user.value === undefined) {
        return authRefuse(
          AUTH_REFUSE_REASONS.userNotFound,
          "The session references a user that no longer exists.",
        );
      }

      const principal = assemblePrincipal({
        user: user.value,
        session: session.value,
        admin: admin.value,
        now: clock.value,
      });
      if (principal.ok) issuePrincipal(principal.value);
      return principal;
    },

    async signOut(request) {
      const screened = screenRequest(request, SIGN_OUT_KEYS, false);
      if (!screened.ok) return screened;
      const principal = screened.value["principal"];
      if (
        (typeof principal !== "object" && typeof principal !== "function") ||
        principal === null ||
        !issuedPrincipals.has(principal)
      ) {
        return authRefuse(
          AUTH_REFUSE_REASONS.principalInvalid,
          "Sign-out requires a principal issued or verified by this identity port.",
        );
      }
      const store = requireStore();
      if (!store.ok) return store;

      const issuedPrincipal = principal as Principal;
      const removed = await callStore(
        () => store.value.deleteSession(issuedPrincipal.session),
        "deleting the session",
      );
      if (!removed.ok) return removed;
      if (removed.value !== true) {
        return authRefuse(
          AUTH_REFUSE_REASONS.principalInvalid,
          "The issued principal no longer names the current stored session version.",
        );
      }
      issuedPrincipals.delete(principal);
      return authOk(null);
    },
  });
}

export type { AuthRefuse };
