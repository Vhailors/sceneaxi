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

import type { Session, User } from "@sceneaxi/schemas";

export type Awaitable<Value> = Value | Promise<Value>;

export type IdentityStore = Readonly<{
  findUserByEmail(normalizedEmail: string): Awaitable<User | undefined>;
  findUserById(userId: string): Awaitable<User | undefined>;
  putSession(session: Session): Awaitable<void>;
  findSession(sessionId: string): Awaitable<Session | undefined>;
  deleteSession(sessionId: string): Awaitable<void>;
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

  for (const user of options.users ?? []) {
    usersById.set(user.userId, user);
    usersByEmail.set(user.email.trim().toLowerCase(), user);
  }
  for (const session of options.sessions ?? []) {
    sessions.set(session.sessionId, session);
  }

  return Object.freeze({
    findUserByEmail(normalizedEmail) {
      return usersByEmail.get(normalizedEmail);
    },
    findUserById(userId) {
      return usersById.get(userId);
    },
    putSession(session) {
      sessions.set(session.sessionId, session);
    },
    findSession(sessionId) {
      return sessions.get(sessionId);
    },
    deleteSession(sessionId) {
      sessions.delete(sessionId);
    },
    sessionCount() {
      return sessions.size;
    },
  });
}
