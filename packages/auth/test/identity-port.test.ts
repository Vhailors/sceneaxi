import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL_ENV_VAR,
  AUTH_REFUSE_REASONS,
  createBetterAuthIdentityAdapter,
  createIdentityPort,
  createInMemoryIdentityStore,
  digestSessionToken,
  resolveAdminIdentity,
  type IdentityAdapter,
  type IdentityStore,
} from "@sceneaxi/auth";
import type { User } from "@sceneaxi/schemas";

const NOW = Date.parse("2026-07-25T10:00:00Z");
const clock = () => NOW;
const adminResolution = resolveAdminIdentity({
  [ADMIN_EMAIL_ENV_VAR]: "captain@example.com",
});
if (!adminResolution.ok) throw new Error(adminResolution.message);
// Resolved, never hand-built: guards check the identity's runtime provenance,
// so a structurally identical `{ email, source }` literal is refused.
const admin = adminResolution.value;

const CAPTAIN = {
  schemaVersion: 1,
  kind: "sceneaxi.user",
  userId: "usr_captain",
  email: "captain@example.com",
  emailVerified: true,
  disabled: false,
  createdAt: "2026-07-25T09:00:00Z",
} as const satisfies User;

const CREW = {
  schemaVersion: 1,
  kind: "sceneaxi.user",
  userId: "usr_crew",
  email: "crew@example.com",
  emailVerified: true,
  disabled: false,
  createdAt: "2026-07-25T09:00:00Z",
} as const satisfies User;

const DISABLED = {
  schemaVersion: 1,
  kind: "sceneaxi.user",
  userId: "usr_gone",
  email: "gone@example.com",
  emailVerified: true,
  disabled: true,
  createdAt: "2026-07-25T09:00:00Z",
} as const satisfies User;

/** A Better-Auth-shaped adapter over a fixed table of credentials. */
const fixtureAdapter = (
  table: Record<string, { userId: string; token: string; expiresAt?: string }>,
): IdentityAdapter =>
  Object.freeze({
    authenticate({ email, password }) {
      const entry = table[`${email}:${password}`];
      if (entry === undefined) return undefined;
      return {
        user: { id: entry.userId, email, emailVerified: true },
        session: {
          id: `ses_${entry.userId}`,
          token: entry.token,
          userId: entry.userId,
          expiresAt: entry.expiresAt ?? "2026-07-26T10:00:00Z",
        },
      };
    },
  });

const ADAPTER = fixtureAdapter({
  "captain@example.com:pw": { userId: "usr_captain", token: "tok-captain" },
  "crew@example.com:pw": { userId: "usr_crew", token: "tok-crew" },
  "gone@example.com:pw": { userId: "usr_gone", token: "tok-gone" },
});

const makePort = (
  overrides: Partial<Parameters<typeof createIdentityPort>[0]> = {},
  store: IdentityStore = createInMemoryIdentityStore({
    users: [CAPTAIN, CREW, DISABLED],
  }),
) =>
  createIdentityPort({
    adapter: ADAPTER,
    store,
    admin,
    clock,
    ...overrides,
  });

describe("in-memory identity store", () => {
  it("validates, snapshots, and freezes preloaded and written records", async () => {
    const mutableUser = {
      ...CREW,
      email: String(CREW.email),
      disabled: false,
    };
    const mutablePreloadedSession = {
      schemaVersion: 1 as const,
      kind: "sceneaxi.session" as const,
      sessionId: "ses_preloaded",
      userId: "usr_crew",
      surface: "web-shell" as const,
      issuedAt: "2026-07-25T09:00:00Z",
      expiresAt: "2026-07-26T10:00:00Z",
      tokenDigest: digestSessionToken("tok-preloaded"),
    };
    const mutableWrittenSession = {
      ...mutablePreloadedSession,
      sessionId: "ses_written",
      tokenDigest: digestSessionToken("tok-written"),
    };
    const store = createInMemoryIdentityStore({
      users: [mutableUser as never],
      sessions: [mutablePreloadedSession],
    });
    await store.putSession(mutableWrittenSession);

    mutableUser.email = "captain@example.com";
    mutableUser.disabled = true;
    mutablePreloadedSession.userId = "usr_other";
    mutableWrittenSession.userId = "usr_other";

    const storedUser = await store.findUserByEmail("crew@example.com");
    const preloaded = await store.findSession("ses_preloaded");
    const written = await store.findSession("ses_written");
    expect(storedUser?.email).toBe("crew@example.com");
    expect(storedUser?.disabled).toBe(false);
    expect(await store.findUserByEmail("captain@example.com")).toBeUndefined();
    expect(preloaded?.userId).toBe("usr_crew");
    expect(written?.userId).toBe("usr_crew");
    expect(Object.isFrozen(storedUser)).toBe(true);
    expect(Object.isFrozen(preloaded)).toBe(true);
    expect(Object.isFrozen(written)).toBe(true);
  });

  it("rejects duplicate user identifiers and normalized emails", () => {
    expect(() =>
      createInMemoryIdentityStore({
        users: [
          CREW,
          {
            ...CAPTAIN,
            userId: CREW.userId,
          } as never,
        ],
      }),
    ).toThrow('identity store: duplicate userId "usr_crew"');

    expect(() =>
      createInMemoryIdentityStore({
        users: [
          CREW,
          {
            ...CAPTAIN,
            email: "CREW@example.com",
          } as never,
        ],
      }),
    ).toThrow(
      'identity store: duplicate normalized email "crew@example.com"',
    );
  });
});

describe("identity port — sign-in", () => {
  it("signs the captain in as admin", async () => {
    const result = await makePort().signIn({
      surface: "web-shell",
      email: "captain@example.com",
      password: "pw",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.role.role).toBe("admin");
    expect(result.value.role.source).toBe("admin-env");
    expect(result.value.session.surface).toBe("web-shell");
    expect(result.value.session.tokenDigest).toBe(digestSessionToken("tok-captain"));
  });

  it("signs an ordinary user in as user", async () => {
    const result = await makePort().signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.role.role).toBe("user");
  });

  it("requires provider and stored verification only for admin elevation", async () => {
    const unverifiedProvider: IdentityAdapter = Object.freeze({
      authenticate({ email }) {
        return {
          user: { id: "usr_captain", email, emailVerified: false },
          session: {
            id: "ses_unverified_provider",
            token: "tok",
            userId: "usr_captain",
            expiresAt: "2026-07-26T10:00:00Z",
          },
        };
      },
    });
    const providerStore = createInMemoryIdentityStore({ users: [CAPTAIN] });
    const providerResult = await makePort(
      { adapter: unverifiedProvider },
      providerStore,
    ).signIn({
      surface: "web-shell",
      email: "captain@example.com",
      password: "pw",
    });
    expect(providerResult.ok).toBe(false);
    if (!providerResult.ok) {
      expect(providerResult.reason).toBe(
        AUTH_REFUSE_REASONS.adminEmailUnverified,
      );
    }
    expect(providerStore.sessionCount()).toBe(0);

    const unverifiedCaptain = { ...CAPTAIN, emailVerified: false } as never;
    const storedResult = await makePort(
      {},
      createInMemoryIdentityStore({ users: [unverifiedCaptain] }),
    ).signIn({
      surface: "web-shell",
      email: "captain@example.com",
      password: "pw",
    });
    expect(storedResult.ok).toBe(false);
    if (!storedResult.ok) {
      expect(storedResult.reason).toBe(
        AUTH_REFUSE_REASONS.adminEmailUnverified,
      );
    }

    const unverifiedCrew = { ...CREW, emailVerified: false } as never;
    const ordinaryResult = await makePort(
      {
        adapter: Object.freeze({
          authenticate: () => ({
            user: {
              id: "usr_crew",
              email: "crew@example.com",
              emailVerified: false,
            },
            session: {
              id: "ses_unverified_crew",
              token: "tok",
              userId: "usr_crew",
              expiresAt: "2026-07-26T10:00:00Z",
            },
          }),
        }),
      },
      createInMemoryIdentityStore({ users: [unverifiedCrew] }),
    ).signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });
    expect(ordinaryResult.ok).toBe(true);
    if (ordinaryResult.ok) {
      expect(ordinaryResult.value.role.role).toBe("user");
    }
  });

  it("stores only the digest, never the raw token", async () => {
    const store = createInMemoryIdentityStore({ users: [CREW] });
    const result = await makePort({}, store).signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });
    expect(result.ok).toBe(true);
    const stored = await store.findSession("ses_usr_crew");
    expect(stored?.tokenDigest).toBe(digestSessionToken("tok-crew"));
    expect(JSON.stringify(stored)).not.toContain("tok-crew");
  });

  it("refuses a client-asserted role before touching the adapter or store", async () => {
    let adapterCalled = false;
    const spy: IdentityAdapter = Object.freeze({
      authenticate() {
        adapterCalled = true;
        return undefined;
      },
    });
    for (const key of ["role", "roles", "isAdmin", "admin"]) {
      const result = await makePort({ adapter: spy }).signIn({
        surface: "web-shell",
        email: "crew@example.com",
        password: "pw",
        [key]: "admin",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(AUTH_REFUSE_REASONS.roleClaimFromClient);
    }
    expect(adapterCalled).toBe(false);
  });

  it("refuses the Kids surface before dispatch, minting nothing", async () => {
    let adapterCalled = false;
    const store = createInMemoryIdentityStore({ users: [CREW] });
    const spy: IdentityAdapter = Object.freeze({
      authenticate() {
        adapterCalled = true;
        return {
          user: { id: "usr_crew", email: "crew@example.com", emailVerified: true },
          session: {
            id: "ses_kids",
            token: "tok-kids",
            userId: "usr_crew",
            expiresAt: "2026-07-26T10:00:00Z",
          },
        };
      },
    });
    const result = await makePort({ adapter: spy }, store).signIn({
      surface: "kids",
      email: "crew@example.com",
      password: "pw",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.kidsSurfaceDenied);
    expect(adapterCalled).toBe(false);
    expect(store.sessionCount()).toBe(0);
  });

  it("refuses even when an adapter tries to hand back a Kids session", async () => {
    const store = createInMemoryIdentityStore({ users: [CREW] });
    const result = await makePort({}, store).signIn({
      surface: "kids",
      email: "crew@example.com",
      password: "pw",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.kidsSurfaceDenied);
    expect(store.sessionCount()).toBe(0);
  });

  it("refuses an unknown surface", async () => {
    const result = await makePort().signIn({
      surface: "mobile",
      email: "crew@example.com",
      password: "pw",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.surfaceInvalid);
  });

  it("refuses a malformed request envelope", async () => {
    const port = makePort();
    for (const request of [
      null,
      "sign in",
      { surface: "web-shell" },
      { surface: "web-shell", email: "crew@example.com", password: "pw", extra: 1 },
      { surface: "web-shell", email: "", password: "pw" },
      { surface: "web-shell", email: "crew@example.com", password: "" },
    ]) {
      const result = await port.signIn(request);
      expect(result.ok).toBe(false);
    }
  });

  it("refuses accessor-bearing requests without invoking getters", async () => {
    const request = {
      email: "crew@example.com",
      password: "pw",
    } as Record<string, unknown>;
    Object.defineProperty(request, "surface", {
      enumerable: true,
      get() {
        throw new Error("untrusted getter");
      },
    });

    const result = await makePort().signIn(request);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.requestInvalid);
  });

  it("distinguishes rejected credentials from a broken provider", async () => {
    const rejected = await makePort().signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "wrong",
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.reason).toBe(AUTH_REFUSE_REASONS.credentialsRejected);
    }

    const broken = await makePort({
      adapter: Object.freeze({
        authenticate() {
          throw new Error("provider down");
        },
      }),
    }).signIn({ surface: "web-shell", email: "crew@example.com", password: "pw" });
    expect(broken.ok).toBe(false);
    if (!broken.ok) {
      expect(broken.reason).toBe(AUTH_REFUSE_REASONS.adapterFailed);
    }
  });

  it("refuses an adapter envelope this boundary does not accept", async () => {
    for (const authentication of [
      {},
      { user: {}, session: {} },
      {
        user: { id: "usr_crew", email: "crew@example.com" },
        session: {
          id: "ses_x",
          token: "t",
          userId: "usr_crew",
          expiresAt: "2026-07-26T10:00:00Z",
        },
      },
      {
        user: {
          id: "usr_crew",
          email: "crew@example.com",
          emailVerified: "yes",
        },
        session: {
          id: "ses_x",
          token: "t",
          userId: "usr_crew",
          expiresAt: "2026-07-26T10:00:00Z",
        },
      },
      { user: { id: "usr_crew", email: "crew@example.com", emailVerified: true } },
      {
        user: { id: "usr_crew", email: "crew@example.com", emailVerified: true },
        session: {
          id: "ses_x",
          token: "t",
          userId: "someone_else",
          expiresAt: "2026-07-26T10:00:00Z",
        },
      },
      {
        user: { id: "usr_crew", email: "crew@example.com", emailVerified: true },
        session: {
          id: "ses_x",
          token: "t",
          userId: "usr_crew",
          expiresAt: "2026-07-25T09:00:00Z",
        },
      },
    ]) {
      const result = await makePort({
        adapter: Object.freeze({ authenticate: () => authentication as never }),
      }).signIn({ surface: "web-shell", email: "crew@example.com", password: "pw" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(AUTH_REFUSE_REASONS.adapterEnvelopeInvalid);
    }
  });

  it("refuses when the provider's user id disagrees with the store", async () => {
    const result = await makePort({
      adapter: fixtureAdapter({
        "crew@example.com:pw": { userId: "usr_imposter", token: "tok" },
      }),
      store: createInMemoryIdentityStore({ users: [CREW] }),
    }).signIn({ surface: "web-shell", email: "crew@example.com", password: "pw" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.adapterUserMismatch);
  });

  it("refuses when the stored email disagrees with the provider", async () => {
    const baseStore = createInMemoryIdentityStore({ users: [CREW] });
    let sessionWrites = 0;
    const store: IdentityStore = Object.freeze({
      findUserByEmail: () => ({ ...CAPTAIN, userId: "usr_crew" }),
      findUserById: (userId) => baseStore.findUserById(userId),
      putSession(session) {
        sessionWrites += 1;
        return baseStore.putSession(session);
      },
      findSession: (sessionId) => baseStore.findSession(sessionId),
      deleteSession: (session) => baseStore.deleteSession(session),
    });

    const result = await makePort({}, store).signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.adapterUserMismatch);
    expect(sessionWrites).toBe(0);
    expect(baseStore.sessionCount()).toBe(0);
  });

  it("binds the provider response to the submitted email", async () => {
    const baseStore = createInMemoryIdentityStore({ users: [CAPTAIN, CREW] });
    let userLookups = 0;
    const store: IdentityStore = Object.freeze({
      findUserByEmail(email) {
        userLookups += 1;
        return baseStore.findUserByEmail(email);
      },
      findUserById: (userId) => baseStore.findUserById(userId),
      putSession: (session) => baseStore.putSession(session),
      findSession: (sessionId) => baseStore.findSession(sessionId),
      deleteSession: (session) => baseStore.deleteSession(session),
    });
    const result = await makePort(
      {
        adapter: Object.freeze({
          authenticate: () => ({
            user: {
              id: "usr_captain",
              email: "captain@example.com",
              emailVerified: true,
            },
            session: {
              id: "ses_wrong_email",
              token: "tok",
              userId: "usr_captain",
              expiresAt: "2026-07-26T10:00:00Z",
            },
          }),
        }),
      },
      store,
    ).signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.adapterUserMismatch);
    expect(userLookups).toBe(0);
    expect(baseStore.sessionCount()).toBe(0);
  });

  it("refuses an authenticated address with no SceneAxi user record", async () => {
    const result = await makePort(
      {},
      createInMemoryIdentityStore({ users: [CAPTAIN] }),
    ).signIn({ surface: "web-shell", email: "crew@example.com", password: "pw" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.userNotFound);
  });

  it("refuses a disabled user", async () => {
    const result = await makePort().signIn({
      surface: "web-shell",
      email: "gone@example.com",
      password: "pw",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.userDisabled);
  });

  it("refuses rather than allowing when a dependency is missing", async () => {
    const cases = [
      [{ adapter: undefined }, AUTH_REFUSE_REASONS.adapterMissing],
      [{ store: undefined }, AUTH_REFUSE_REASONS.storeMissing],
      [{ admin: undefined }, AUTH_REFUSE_REASONS.adminIdentityUnresolved],
      [{ clock: undefined }, AUTH_REFUSE_REASONS.clockInvalid],
    ] as const;
    for (const [overrides, reason] of cases) {
      const result = await createIdentityPort({
        adapter: ADAPTER,
        store: createInMemoryIdentityStore({ users: [CREW] }),
        admin,
        clock,
        ...overrides,
      }).signIn({ surface: "web-shell", email: "crew@example.com", password: "pw" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(reason);
    }
  });

  it("derives roles from the same admin identity whose provenance passed", async () => {
    let adminReads = 0;
    const result = await createIdentityPort({
      adapter: ADAPTER,
      store: createInMemoryIdentityStore({ users: [CREW] }),
      clock,
      get admin() {
        adminReads += 1;
        return adminReads < 3
          ? admin
          : { email: CREW.email, source: ADMIN_EMAIL_ENV_VAR };
      },
    }).signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.role.role).toBe("user");
    expect(adminReads).toBe(1);
  });

  it("refuses a clock that throws or returns nonsense", async () => {
    for (const badClock of [
      () => {
        throw new Error("no clock");
      },
      () => Number.NaN,
      () => Number.MAX_VALUE,
      () => "now" as never,
    ]) {
      const result = await makePort({ clock: badClock }).signIn({
        surface: "web-shell",
        email: "crew@example.com",
        password: "pw",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(AUTH_REFUSE_REASONS.clockInvalid);
    }
  });

  it("refuses when the store throws", async () => {
    const result = await makePort(
      {},
      Object.freeze({
        findUserByEmail() {
          throw new Error("db down");
        },
        findUserById: () => undefined,
        putSession: () => undefined,
        findSession: () => undefined,
        deleteSession: () => true,
      }),
    ).signIn({ surface: "web-shell", email: "crew@example.com", password: "pw" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.storeFailed);
  });

  it("requires an exact boolean session deletion result", async () => {
    let deletionResult: unknown = { deleted: false };
    const port = makePort(
      {},
      Object.freeze({
        findUserByEmail: () => CREW,
        findUserById: () => CREW,
        putSession: () => undefined,
        findSession: () => undefined,
        deleteSession: () => deletionResult as never,
      }),
    );
    const signIn = await port.signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });
    expect(signIn.ok).toBe(true);
    if (!signIn.ok) return;

    const malformed = await port.signOut({ principal: signIn.value });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.reason).toBe(AUTH_REFUSE_REASONS.principalInvalid);
    }

    deletionResult = true;
    expect(await port.signOut({ principal: signIn.value })).toEqual({
      ok: true,
      value: null,
    });
  });

  it("refuses malformed stored users before reading their fields", async () => {
    let getterRead = false;
    const malformedUsers = [
      null,
      Object.defineProperty({}, "userId", {
        enumerable: true,
        get() {
          getterRead = true;
          throw new Error("untrusted getter");
        },
      }),
    ];

    for (const storedUser of malformedUsers) {
      const result = await makePort(
        {},
        Object.freeze({
          findUserByEmail: () => storedUser as never,
          findUserById: () => undefined,
          putSession: () => undefined,
          findSession: () => undefined,
          deleteSession: () => true,
        }),
      ).signIn({
        surface: "web-shell",
        email: "crew@example.com",
        password: "pw",
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(AUTH_REFUSE_REASONS.userRecordInvalid);
    }
    expect(getterRead).toBe(false);
  });
});

describe("identity port — session verification", () => {
  const signedIn = async () => {
    const store = createInMemoryIdentityStore({ users: [CAPTAIN, CREW] });
    const port = makePort({}, store);
    const result = await port.signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });
    if (!result.ok) throw new Error("fixture sign-in failed");
    return { store, port, principal: result.value };
  };

  it("verifies a live session and re-derives the role", async () => {
    const { port, principal } = await signedIn();
    const result = await port.verifySession({
      surface: "web-shell",
      sessionId: principal.session.sessionId,
      token: "tok-crew",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.role.role).toBe("user");
  });

  it("refuses a wrong token", async () => {
    const { port, principal } = await signedIn();
    const result = await port.verifySession({
      surface: "web-shell",
      sessionId: principal.session.sessionId,
      token: "tok-captain",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.sessionTokenMismatch);
  });

  it("refuses an unknown session", async () => {
    const { port } = await signedIn();
    const result = await port.verifySession({
      surface: "web-shell",
      sessionId: "ses_nope",
      token: "tok-crew",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.sessionNotFound);
  });

  it("refuses a session from another surface", async () => {
    const { port, principal } = await signedIn();
    const result = await port.verifySession({
      surface: "site",
      sessionId: principal.session.sessionId,
      token: "tok-crew",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.sessionSurfaceMismatch);
  });

  it("refuses an expired session", async () => {
    const { store, principal } = await signedIn();
    const expired = makePort({ clock: () => Date.parse("2026-07-27T10:00:00Z") }, store);
    const result = await expired.verifySession({
      surface: "web-shell",
      sessionId: principal.session.sessionId,
      token: "tok-crew",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.sessionExpired);
  });

  it("refuses a stored Kids session written by any other path", async () => {
    const store = createInMemoryIdentityStore({
      users: [CREW],
      sessions: [
        {
          schemaVersion: 1,
          kind: "sceneaxi.session",
          sessionId: "ses_kids",
          userId: "usr_crew",
          surface: "kids",
          issuedAt: "2026-07-25T09:00:00Z",
          expiresAt: "2026-07-26T10:00:00Z",
          tokenDigest: digestSessionToken("tok-kids"),
        } as never,
      ],
    });
    const result = await makePort({}, store).verifySession({
      surface: "web-shell",
      sessionId: "ses_kids",
      token: "tok-kids",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.kidsSurfaceDenied);
  });

  it("refuses a corrupt stored session record", async () => {
    const store: IdentityStore = Object.freeze({
      findUserByEmail: () => undefined,
      findUserById: () => CREW,
      putSession: () => undefined,
      findSession: () => ({ sessionId: "ses_bad" }) as never,
      deleteSession: () => true,
    });
    const result = await makePort({}, store).verifySession({
      surface: "web-shell",
      sessionId: "ses_bad",
      token: "tok-crew",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.sessionRecordInvalid);
  });

  it("refuses when the session's user has gone away", async () => {
    const store = createInMemoryIdentityStore({
      users: [],
      sessions: [
        {
          schemaVersion: 1,
          kind: "sceneaxi.session",
          sessionId: "ses_orphan",
          userId: "usr_crew",
          surface: "web-shell",
          issuedAt: "2026-07-25T09:00:00Z",
          expiresAt: "2026-07-26T10:00:00Z",
          tokenDigest: digestSessionToken("tok-crew"),
        } as never,
      ],
    });
    const result = await makePort({}, store).verifySession({
      surface: "web-shell",
      sessionId: "ses_orphan",
      token: "tok-crew",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.userNotFound);
  });

  it("refuses a corrupt stored user record", async () => {
    const store: IdentityStore = Object.freeze({
      findUserByEmail: () => undefined,
      findUserById: () => ({ userId: "usr_crew" }) as never,
      putSession: () => undefined,
      findSession: () =>
        ({
          schemaVersion: 1,
          kind: "sceneaxi.session",
          sessionId: "ses_01",
          userId: "usr_crew",
          surface: "web-shell",
          issuedAt: "2026-07-25T09:00:00Z",
          expiresAt: "2026-07-26T10:00:00Z",
          tokenDigest: digestSessionToken("tok-crew"),
        }) as never,
      deleteSession: () => true,
    });
    const result = await makePort({}, store).verifySession({
      surface: "web-shell",
      sessionId: "ses_01",
      token: "tok-crew",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.userRecordInvalid);
  });
});

describe("identity port — sign-out", () => {
  it("removes the session", async () => {
    const store = createInMemoryIdentityStore({ users: [CREW] });
    const port = makePort({}, store);
    const signIn = await port.signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });
    expect(signIn.ok).toBe(true);
    expect(store.sessionCount()).toBe(1);

    if (!signIn.ok) return;
    const result = await port.signOut({ principal: signIn.value });
    expect(result.ok).toBe(true);
    expect(store.sessionCount()).toBe(0);
  });

  it("keeps every principal for the same stored session valid", async () => {
    const store = createInMemoryIdentityStore({ users: [CREW] });
    const port = makePort({}, store);
    const signIn = await port.signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });
    expect(signIn.ok).toBe(true);
    if (!signIn.ok) return;
    const verified = await port.verifySession({
      surface: "web-shell",
      sessionId: signIn.value.session.sessionId,
      token: "tok-crew",
    });
    expect(verified.ok).toBe(true);

    expect(await port.signOut({ principal: signIn.value })).toEqual({
      ok: true,
      value: null,
    });
    expect(store.sessionCount()).toBe(0);
  });

  it("cannot use an older principal to delete a rotated session", async () => {
    let token = "tok-1";
    const adapter: IdentityAdapter = Object.freeze({
      authenticate({ email }) {
        return {
          user: { id: "usr_crew", email, emailVerified: true },
          session: {
            id: "ses_rotated",
            token,
            userId: "usr_crew",
            expiresAt: "2026-07-26T10:00:00Z",
          },
        };
      },
    });
    const store = createInMemoryIdentityStore({ users: [CREW] });
    const port = makePort({ adapter }, store);
    const first = await port.signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    token = "tok-2";
    const second = await port.signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const stale = await port.signOut({ principal: first.value });
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.reason).toBe(AUTH_REFUSE_REASONS.principalInvalid);
    }
    expect(store.sessionCount()).toBe(1);
    expect((await port.signOut({ principal: second.value })).ok).toBe(true);
    expect(store.sessionCount()).toBe(0);
  });

  it("refuses a malformed request and a client role claim", async () => {
    const port = makePort();
    expect((await port.signOut({})).ok).toBe(false);
    expect((await port.signOut({ principal: {} as never })).ok).toBe(false);
    const claim = await port.signOut({ principal: {} as never, role: "admin" });
    expect(claim.ok).toBe(false);
    if (claim.ok) return;
    expect(claim.reason).toBe(AUTH_REFUSE_REASONS.roleClaimFromClient);
  });

  it("refuses when the store throws", async () => {
    const port = makePort(
      {},
      Object.freeze({
        findUserByEmail: () => CREW,
        findUserById: () => CREW,
        putSession: () => undefined,
        findSession: () => undefined,
        deleteSession() {
          throw new Error("db down");
        },
      }),
    );
    const signIn = await port.signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });
    expect(signIn.ok).toBe(true);
    if (!signIn.ok) return;
    const result = await port.signOut({ principal: signIn.value });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.storeFailed);
  });

  it("refuses a principal issued by another port", async () => {
    const first = makePort();
    const second = makePort();
    const signIn = await first.signIn({
      surface: "web-shell",
      email: "crew@example.com",
      password: "pw",
    });
    expect(signIn.ok).toBe(true);
    if (!signIn.ok) return;
    const result = await second.signOut({ principal: signIn.value });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(AUTH_REFUSE_REASONS.principalInvalid);
  });
});

describe("createBetterAuthIdentityAdapter", () => {
  it("wraps a Better Auth instance and normalizes null to undefined", async () => {
    const adapter = createBetterAuthIdentityAdapter({
      api: {
        signInEmail({ body }) {
          if (body.password !== "pw") return null;
          return {
            user: { id: "usr_crew", email: body.email, emailVerified: true },
            session: {
              id: "ses_usr_crew",
              token: "tok-crew",
              userId: "usr_crew",
              expiresAt: new Date("2026-07-26T10:00:00Z"),
            },
          };
        },
      },
    });

    expect(
      await adapter.authenticate({
        surface: "web-shell",
        email: "crew@example.com",
        password: "nope",
      }),
    ).toBeUndefined();

    const result = await makePort(
      { adapter },
      createInMemoryIdentityStore({ users: [CREW] }),
    ).signIn({ surface: "web-shell", email: "crew@example.com", password: "pw" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.session.expiresAt).toBe("2026-07-26T10:00:00.000Z");
  });
});
