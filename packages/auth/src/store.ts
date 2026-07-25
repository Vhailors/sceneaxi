/**
 * The identity persistence port and an in-memory reference implementation.
 *
 * The store — not the identity provider — owns the SceneAxi `User` record, and
 * therefore owns `disabled`. That split matters: disabling a user must take
 * effect even if the upstream provider would still happily authenticate them.
 *
 * The real implementation is Neon Postgres (`db/migrations`). The in-memory one
 * exists so the gate, and consumers' tests, can exercise the whole plane with
 * no database and no network.
 */

import {
  validateSession,
  validateUser,
  type Session,
  type User,
} from "@sceneaxi/schemas";

export type Awaitable<Value> = Value | Promise<Value>;

export type IdentityStore = Readonly<{
  findUserByEmail(normalizedEmail: string): Awaitable<User | undefined>;
  findUserById(userId: string): Awaitable<User | undefined>;
  putSession(session: Session): Awaitable<void>;
  findSession(sessionId: string): Awaitable<Session | undefined>;
  deleteSession(session: Session): Awaitable<boolean>;
}>;

export type InMemoryIdentityStoreOptions = Readonly<{
  users?: ReadonlyArray<User>;
  sessions?: ReadonlyArray<Session>;
}>;

export type InMemoryIdentityStore = IdentityStore &
  Readonly<{
    /** Sessions currently held, for assertions. */
    sessionCount(): number;
  }>;

function sameSession(left: Session, right: Session): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.kind === right.kind &&
    left.sessionId === right.sessionId &&
    left.userId === right.userId &&
    left.surface === right.surface &&
    left.issuedAt === right.issuedAt &&
    left.expiresAt === right.expiresAt &&
    left.tokenDigest === right.tokenDigest
  );
}

function fail(message: string): never {
  throw new Error(`identity store: ${message}`);
}

function snapshotUser(candidate: unknown): User {
  const validated = validateUser(candidate);
  if (!validated.ok) {
    return fail(`invalid user (${validated.code}): ${validated.message}`);
  }
  return validated.value;
}

function snapshotSession(candidate: unknown): Session {
  const validated = validateSession(candidate);
  if (!validated.ok) {
    return fail(`invalid session (${validated.code}): ${validated.message}`);
  }
  return validated.value;
}

/**
 * Reference store. Emails are keyed in normalized form so lookup matches the
 * one normalization the admin comparison uses.
 */
export function createInMemoryIdentityStore(
  options: InMemoryIdentityStoreOptions = {},
): InMemoryIdentityStore {
  const usersById = new Map<string, User>();
  const usersByEmail = new Map<string, User>();
  const sessions = new Map<string, Session>();

  for (const candidate of options.users ?? []) {
    const user = snapshotUser(candidate);
    const normalizedEmail = user.email.trim().toLowerCase();
    if (usersById.has(user.userId)) {
      fail(`duplicate userId "${user.userId}"`);
    }
    if (usersByEmail.has(normalizedEmail)) {
      fail(`duplicate normalized email "${normalizedEmail}"`);
    }
    usersById.set(user.userId, user);
    usersByEmail.set(normalizedEmail, user);
  }
  for (const candidate of options.sessions ?? []) {
    const session = snapshotSession(candidate);
    sessions.set(session.sessionId, session);
  }

  return Object.freeze({
    findUserByEmail(normalizedEmail) {
      return usersByEmail.get(normalizedEmail);
    },
    findUserById(userId) {
      return usersById.get(userId);
    },
    putSession(candidate) {
      const session = snapshotSession(candidate);
      sessions.set(session.sessionId, session);
    },
    findSession(sessionId) {
      return sessions.get(sessionId);
    },
    deleteSession(session) {
      const current = sessions.get(session.sessionId);
      if (current === undefined || !sameSession(current, session)) return false;
      return sessions.delete(session.sessionId);
    },
    sessionCount() {
      return sessions.size;
    },
  });
}
