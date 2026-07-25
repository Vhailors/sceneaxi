/**
 * The Better Auth adapter boundary.
 *
 * Better Auth is the captain-named identity provider. It is *injected*, not
 * depended on: it needs a running HTTP host and a live database instance, and
 * SceneAxi core is a hermetic library with neither. So this module types the
 * boundary structurally against Better Auth's documented `{ user, session }`
 * result and maps it into SceneAxi contracts. A real Better Auth instance drops
 * in through `createBetterAuthIdentityAdapter`; see docs/auth-credits.md for the
 * concrete wiring.
 *
 * This mirrors the Model Provider Port (sceneaxi#45), where adapters are
 * injected and no live provider lives in core.
 */

import {
  isEpochMilliseconds,
  isIdentitySurface,
  snapshotPlainRecord,
  type IdentitySurface,
  type Session,
} from "@sceneaxi/schemas";
import { digestSessionToken } from "./session-token.js";

/** Better Auth's user shape, as much of it as SceneAxi consumes. */
export type BetterAuthUserLike = Readonly<{
  id: string;
  email: string;
  emailVerified: boolean;
}>;

/** Better Auth's session shape. `expiresAt` may be a Date or an ISO string. */
export type BetterAuthSessionLike = Readonly<{
  id: string;
  token: string;
  userId: string;
  expiresAt: Date | string;
}>;

/** What an authenticate call returns on success. */
export type BetterAuthAuthentication = Readonly<{
  user: BetterAuthUserLike;
  session: BetterAuthSessionLike;
}>;

export type IdentityCredentials = Readonly<{
  surface: IdentitySurface;
  email: string;
  password: string;
}>;

/**
 * The injected authentication port. Resolving `undefined` means "these
 * credentials do not authenticate" — a normal outcome, distinct from a thrown
 * adapter failure, so the port can tell a wrong password from a broken provider.
 */
export type IdentityAdapter = Readonly<{
  authenticate(
    credentials: IdentityCredentials,
  ): Promise<BetterAuthAuthentication | undefined> | BetterAuthAuthentication | undefined;
}>;

/** Structural view of the part of a Better Auth instance SceneAxi calls. */
export type BetterAuthInstanceLike = Readonly<{
  api: Readonly<{
    signInEmail(args: {
      body: { email: string; password: string };
    }):
      | Promise<BetterAuthAuthentication | null | undefined>
      | BetterAuthAuthentication
      | null
      | undefined;
  }>;
}>;

/**
 * Wrap a Better Auth instance as an `IdentityAdapter`.
 *
 * A `null` result is normalized to `undefined` so callers have exactly one
 * "did not authenticate" value to handle.
 */
export function createBetterAuthIdentityAdapter(
  betterAuth: BetterAuthInstanceLike,
): IdentityAdapter {
  return Object.freeze({
    async authenticate(credentials) {
      const result = await betterAuth.api.signInEmail({
        body: { email: credentials.email, password: credentials.password },
      });
      return result ?? undefined;
    },
  });
}

const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function readExpiry(value: unknown): string | undefined {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? value.toISOString() : undefined;
  }
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

export type MappedAuthentication = Readonly<{
  /** The provider's user id, cross-checked against the store's record. */
  providerUserId: string;
  email: string;
  session: Session;
}>;

/**
 * Map a Better Auth authentication onto a SceneAxi `Session`, hashing the token
 * on the way in so the raw token never reaches the store.
 *
 * Returns `undefined` on any shape the boundary does not accept; the caller
 * turns that into a named refusal.
 */
export function mapBetterAuthAuthentication(input: {
  readonly authentication: unknown;
  readonly surface: IdentitySurface;
  readonly issuedAt: number;
}): MappedAuthentication | undefined {
  const { authentication, surface, issuedAt } = input;
  if (!isIdentitySurface(surface) || !isEpochMilliseconds(issuedAt)) {
    return undefined;
  }
  const authenticationRecord = snapshotPlainRecord(authentication);
  if (authenticationRecord === undefined) return undefined;

  const user = snapshotPlainRecord(authenticationRecord["user"]);
  const session = snapshotPlainRecord(authenticationRecord["session"]);
  if (user === undefined || session === undefined) return undefined;

  const providerUserId = user["id"];
  const email = user["email"];
  const sessionId = session["id"];
  const token = session["token"];
  const sessionUserId = session["userId"];
  if (
    typeof providerUserId !== "string" ||
    !IDENTIFIER_RE.test(providerUserId) ||
    typeof email !== "string" ||
    email.trim().length === 0 ||
    typeof sessionId !== "string" ||
    !IDENTIFIER_RE.test(sessionId) ||
    typeof token !== "string" ||
    token.length === 0
  ) {
    return undefined;
  }
  // The provider must agree with itself about who this session belongs to.
  if (sessionUserId !== providerUserId) return undefined;

  const expiresAt = readExpiry(session["expiresAt"]);
  if (expiresAt === undefined) return undefined;
  const issuedAtIso = new Date(issuedAt).toISOString();
  if (Date.parse(expiresAt) <= Date.parse(issuedAtIso)) return undefined;

  return Object.freeze({
    providerUserId,
    email: email.trim().toLowerCase(),
    session: Object.freeze({
      schemaVersion: 1 as const,
      kind: "sceneaxi.session" as const,
      sessionId,
      userId: providerUserId,
      surface,
      issuedAt: issuedAtIso,
      expiresAt,
      tokenDigest: digestSessionToken(token),
    }),
  });
}
