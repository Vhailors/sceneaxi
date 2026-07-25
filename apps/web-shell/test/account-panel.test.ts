import { describe, expect, it } from "vitest";
import {
  ACCOUNT_PANEL_REASONS,
  createAccountPanel,
  type AccountCreditsView,
  type AccountPanel,
} from "@sceneaxi/web-shell";
import {
  ADMIN_EMAIL_ENV_VAR,
  AUTH_REFUSE_REASONS,
  createIdentityPort,
  createInMemoryIdentityStore,
  type IdentityAdapter,
  type IdentityPort,
  type IdentityStore,
} from "@sceneaxi/auth";
import {
  appendCreditEntry,
  BILLING_REFUSE_REASONS,
  createLedgerState,
  type LedgerState,
} from "@sceneaxi/billing";
import type { CreditAccount } from "@sceneaxi/schemas";

const NOW = Date.parse("2026-07-25T10:00:00Z");
const clock = () => NOW;
const admin = {
  email: "captain@example.com",
  source: ADMIN_EMAIL_ENV_VAR,
} as const;

const user = (userId: string, email: string) =>
  ({
    schemaVersion: 1,
    kind: "sceneaxi.user",
    userId,
    email,
    emailVerified: true,
    disabled: false,
    createdAt: "2026-07-25T09:00:00Z",
  }) as never;

const CREW = user("usr_crew", "crew@example.com");
const CAPTAIN = user("usr_captain", "captain@example.com");

const ADAPTER: IdentityAdapter = Object.freeze({
  authenticate({ email, password }) {
    if (password !== "pw") return undefined;
    const userId = email === "captain@example.com" ? "usr_captain" : "usr_crew";
    return {
      user: { id: userId, email, emailVerified: true },
      session: {
        id: `ses_${userId}`,
        token: "tok",
        userId,
        expiresAt: "2026-07-26T10:00:00Z",
      },
    };
  },
});

const ledgerFor = (userId: string, credits: number): LedgerState => {
  const account = Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.credit-account",
    accountId: `acc_${userId}`,
    userId,
    createdAt: "2026-07-25T09:00:00Z",
  }) as CreditAccount;
  if (credits === 0) return createLedgerState(account);
  const appended = appendCreditEntry(createLedgerState(account), {
    entryId: "ent_fund",
    movement: "grant",
    delta: credits,
    reason: "test funding",
    idempotencyKey: "fixture:fund",
    now: NOW,
  });
  if (!appended.ok) throw new Error("fixture funding failed");
  return appended.value.state;
};

const creditsView = (
  ledgers: Record<string, LedgerState>,
): AccountCreditsView =>
  Object.freeze({
    ledgerFor(userId) {
      return ledgers[userId];
    },
  });

const makePanel = (
  overrides: Partial<Parameters<typeof createAccountPanel>[0]> = {},
  ledgers: Record<string, LedgerState> = { usr_crew: ledgerFor("usr_crew", 250) },
): AccountPanel => {
  const result = createAccountPanel({
    identityPort: createIdentityPort({
      adapter: ADAPTER,
      store: createInMemoryIdentityStore({ users: [CREW, CAPTAIN] }),
      admin,
      clock,
    }),
    credits: creditsView(ledgers),
    surface: "web-shell",
    admin,
    clock,
    ...overrides,
  });
  if (!result.ok) throw new Error(`panel construction failed: ${result.reason}`);
  return result.panel;
};

describe("account panel construction", () => {
  it("refuses the Kids surface, so no signed-in state exists there", () => {
    const result = createAccountPanel({
      identityPort: createIdentityPort({
        adapter: ADAPTER,
        store: createInMemoryIdentityStore({ users: [CREW] }),
        admin,
        clock,
      }),
      credits: creditsView({}),
      surface: "kids",
      admin,
      clock,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe(ACCOUNT_PANEL_REASONS.kidsSurfaceDenied);
  });

  it("refuses rather than degrading when a dependency is missing", () => {
    const cases = [
      [{ identityPort: undefined }, ACCOUNT_PANEL_REASONS.identityPortMissing],
      [{ credits: undefined }, ACCOUNT_PANEL_REASONS.creditsViewMissing],
      [{ clock: undefined }, ACCOUNT_PANEL_REASONS.clockInvalid],
      [{ surface: "mobile" }, ACCOUNT_PANEL_REASONS.surfaceInvalid],
    ] as const;
    for (const [overrides, reason] of cases) {
      const result = createAccountPanel({
        identityPort: createIdentityPort({
          adapter: ADAPTER,
          store: createInMemoryIdentityStore({ users: [CREW] }),
          admin,
          clock,
        }),
        credits: creditsView({}),
        surface: "web-shell",
        clock,
        ...(overrides as Record<string, unknown>),
      } as never);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe(reason);
    }
  });
});

describe("anonymous phase", () => {
  it("starts anonymous with no email, role, or balance", () => {
    const snapshot = makePanel().snapshot();
    expect(snapshot.phase).toBe("anonymous");
    expect(snapshot.email).toBeUndefined();
    expect(snapshot.role).toBeUndefined();
    expect(snapshot.creditBalance).toBeUndefined();
  });

  it("shows the free capabilities before anyone signs in", () => {
    const snapshot = makePanel().snapshot();
    for (const capability of [
      "engine-sdk-download",
      "cli-authoring",
      "byo-model-keys",
    ]) {
      const view = snapshot.capabilities.find(
        (held) => held.capability === capability,
      );
      expect(view?.outcome).toBe("allow-free");
    }
  });

  it("shows paid capabilities as account-required, not as free", () => {
    const snapshot = makePanel().snapshot();
    const paid = snapshot.capabilities.find(
      (held) => held.capability === "hosted-ai-assistant",
    );
    expect(paid?.outcome).toBeUndefined();
    expect(paid?.refusedReason).toBe("ENTITLEMENT_ACCOUNT_REQUIRED");
  });

  it("freezes every snapshot", () => {
    const snapshot = makePanel().snapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.capabilities)).toBe(true);
  });
});

describe("authenticated phase", () => {
  it("shows email, role, and the derived credit balance", async () => {
    const panel = makePanel();
    const snapshot = await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    expect(snapshot.phase).toBe("authenticated");
    expect(snapshot.email).toBe("crew@example.com");
    expect(snapshot.role).toBe("user");
    expect(snapshot.creditBalance).toBe(250);
  });

  it("shows the balance derived from the ledger, not read off a field", async () => {
    const panel = makePanel({}, { usr_crew: ledgerFor("usr_crew", 33) });
    const snapshot = await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    expect(snapshot.creditBalance).toBe(33);
  });

  it("refuses a ledger belonging to another user", async () => {
    const panel = makePanel({
      credits: Object.freeze({
        ledgerFor: () => ledgerFor("usr_other", 900),
      }),
    });
    const snapshot = await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    expect(snapshot.phase).toBe("refused");
    expect(snapshot.refusal?.reason).toBe(
      ACCOUNT_PANEL_REASONS.ledgerOwnerMismatch,
    );
    expect(snapshot.creditBalance).toBeUndefined();
  });

  it("refuses another account's entries under the user's account", async () => {
    const own = ledgerFor("usr_crew", 0);
    const foreign = ledgerFor("usr_other", 900);
    const mixed = {
      account: own.account,
      entries: foreign.entries,
      balance: foreign.balance,
    } as LedgerState;
    const panel = makePanel({}, { usr_crew: mixed });
    const snapshot = await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    expect(snapshot.phase).toBe("refused");
    expect(snapshot.refusal?.reason).toBe(
      BILLING_REFUSE_REASONS.ledgerStateInvalid,
    );
    expect(snapshot.creditBalance).toBeUndefined();
  });

  it("shows admin as unlimited rather than quoting a credit cost", async () => {
    const panel = makePanel(
      {},
      { usr_captain: ledgerFor("usr_captain", 0) },
    );
    const snapshot = await panel.submitCredentials({
      email: "captain@example.com",
      password: "pw",
    });
    expect(snapshot.phase).toBe("authenticated");
    expect(snapshot.role).toBe("admin");
    const paid = snapshot.capabilities.find(
      (held) => held.capability === "hosted-ai-assistant",
    );
    expect(paid?.outcome).toBe("allow-unlimited");
    expect(paid?.credits).toBeUndefined();
  });

  it("shows credit-priced availability without inventing an exact quote", async () => {
    const panel = makePanel();
    const snapshot = await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    const paid = snapshot.capabilities.find(
      (held) => held.capability === "hosted-ai-assistant",
    );
    expect(paid?.availability).toBe("available");
    expect(paid?.price).toBe("credits");
    expect(paid?.outcome).toBeUndefined();
    expect(paid?.credits).toBeUndefined();
  });

  it("re-reads the balance on refresh", async () => {
    let ledger = ledgerFor("usr_crew", 100);
    const view: AccountCreditsView = Object.freeze({
      ledgerFor: () => ledger,
    });
    const panel = makePanel({ credits: view });
    const first = await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    expect(first.creditBalance).toBe(100);

    ledger = ledgerFor("usr_crew", 40);
    const refreshed = await panel.refresh();
    expect(refreshed.creditBalance).toBe(40);
  });
});

describe("role is never client-claimable", () => {
  it("refuses a client-supplied role and never displays it", async () => {
    for (const key of ["role", "roles", "isAdmin", "admin"]) {
      const panel = makePanel();
      const snapshot = await panel.submitCredentials({
        email: "crew@example.com",
        password: "pw",
        [key]: "admin",
      });
      expect(snapshot.phase).toBe("refused");
      expect(snapshot.refusal?.reason).toBe(
        AUTH_REFUSE_REASONS.roleClaimFromClient,
      );
      expect(snapshot.role).toBeUndefined();
    }
  });

  it("uses the panel's own surface, not one the caller asks for", async () => {
    const panel = makePanel();
    const snapshot = await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
      surface: "kids",
    });
    // The panel overrides the caller's surface with its own, so the request is
    // served on web-shell rather than refused as Kids.
    expect(snapshot.phase).toBe("authenticated");
    expect(snapshot.surface).toBe("web-shell");
  });

  it("refuses accessor-bearing credentials without invoking getters", async () => {
    const credentials = { password: "pw" } as Record<string, unknown>;
    Object.defineProperty(credentials, "email", {
      enumerable: true,
      get() {
        throw new Error("untrusted getter");
      },
    });

    const snapshot = await makePanel().submitCredentials(credentials);
    expect(snapshot.phase).toBe("refused");
    expect(snapshot.refusal?.reason).toBe(AUTH_REFUSE_REASONS.requestInvalid);
  });
});

describe("refused phase", () => {
  it("carries the identity port's named reason", async () => {
    const panel = makePanel();
    const snapshot = await panel.submitCredentials({
      email: "crew@example.com",
      password: "wrong",
    });
    expect(snapshot.phase).toBe("refused");
    expect(snapshot.refusal?.reason).toBe(
      AUTH_REFUSE_REASONS.credentialsRejected,
    );
  });

  it("reports an unknown balance as a refusal, never as zero", async () => {
    const panel = makePanel({}, {});
    const snapshot = await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    expect(snapshot.phase).toBe("refused");
    expect(snapshot.refusal?.reason).toBe(ACCOUNT_PANEL_REASONS.ledgerMissing);
    expect(snapshot.creditBalance).toBeUndefined();
  });

  it("reports a throwing credits view as a refusal", async () => {
    const panel = makePanel({
      credits: Object.freeze({
        ledgerFor() {
          throw new Error("db down");
        },
      }),
    });
    const snapshot = await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    expect(snapshot.phase).toBe("refused");
    expect(snapshot.refusal?.reason).toBe(
      ACCOUNT_PANEL_REASONS.creditsUnavailable,
    );
  });

  it("reports a corrupted ledger as a refusal, never as a plausible number", async () => {
    const corrupt = ledgerFor("usr_crew", 100);
    const tampered = {
      ...corrupt,
      entries: [{ ...corrupt.entries[0], balanceAfter: 999_999 }],
    } as unknown as LedgerState;
    const panel = makePanel({}, { usr_crew: tampered });
    const snapshot = await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    expect(snapshot.phase).toBe("refused");
    expect(snapshot.creditBalance).toBeUndefined();
  });

  it("reports a clock failure", async () => {
    const panel = makePanel({
      clock: () => Number.MAX_VALUE,
    });
    const snapshot = panel.snapshot();
    expect(snapshot.phase).toBe("refused");
    expect(snapshot.refusal?.reason).toBe(ACCOUNT_PANEL_REASONS.clockInvalid);
  });
});

describe("sign out", () => {
  it("returns to anonymous and clears the identity", async () => {
    const panel = makePanel();
    await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    const snapshot = await panel.signOut();
    expect(snapshot.phase).toBe("anonymous");
    expect(snapshot.email).toBeUndefined();
    expect(snapshot.role).toBeUndefined();
    expect(snapshot.creditBalance).toBeUndefined();
  });

  it("retains the session for retry when server-side sign-out fails", async () => {
    let deleteAttempts = 0;
    const panel = makePanel({
      identityPort: createIdentityPort({
        adapter: ADAPTER,
        store: Object.freeze({
          findUserByEmail: () => CREW,
          findUserById: () => CREW,
          putSession: () => undefined,
          findSession: () => undefined,
          deleteSession() {
            deleteAttempts += 1;
            if (deleteAttempts === 1) throw new Error("db down");
            return true;
          },
        }),
        admin,
        clock,
      }),
    });
    const signedIn = await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    expect(signedIn.phase).toBe("authenticated");

    const snapshot = await panel.signOut();
    expect(snapshot.phase).toBe("refused");
    expect(snapshot.refusal?.reason).toBe(AUTH_REFUSE_REASONS.storeFailed);

    const retried = await panel.signOut();
    expect(retried.phase).toBe("anonymous");
    expect(deleteAttempts).toBe(2);
  });

  it("converts thrown identity-port calls into retryable refusals", async () => {
    const base = createIdentityPort({
      adapter: ADAPTER,
      store: createInMemoryIdentityStore({ users: [CREW] }),
      admin,
      clock,
    });
    let signInCalls = 0;
    let signOutCalls = 0;
    const identityPort: IdentityPort = Object.freeze({
      signIn(request) {
        signInCalls += 1;
        if (signInCalls === 2) throw new Error("transport down");
        return base.signIn(request);
      },
      verifySession: (request) => base.verifySession(request),
      signOut(request) {
        signOutCalls += 1;
        if (signOutCalls === 1) throw new Error("transport down");
        return base.signOut(request);
      },
    });
    const panel = makePanel({ identityPort });
    expect(
      (
        await panel.submitCredentials({
          email: "crew@example.com",
          password: "pw",
        })
      ).phase,
    ).toBe("authenticated");
    const failedSignIn = await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    expect(failedSignIn.refusal?.reason).toBe(
      ACCOUNT_PANEL_REASONS.identityPortFailed,
    );
    const failedSignOut = await panel.signOut();
    expect(failedSignOut.refusal?.reason).toBe(
      ACCOUNT_PANEL_REASONS.sessionRevocationFailed,
    );
    expect((await panel.signOut()).phase).toBe("anonymous");
  });

  it("revokes every superseded session and retains failed revocations", async () => {
    let sessionNumber = 0;
    const adapter: IdentityAdapter = Object.freeze({
      authenticate({ email }) {
        sessionNumber += 1;
        return {
          user: { id: "usr_crew", email, emailVerified: true },
          session: {
            id: `ses_${sessionNumber}`,
            token: `tok_${sessionNumber}`,
            userId: "usr_crew",
            expiresAt: "2026-07-26T10:00:00Z",
          },
        };
      },
    });
    const baseStore = createInMemoryIdentityStore({ users: [CREW] });
    let deleteAttempts = 0;
    const store: IdentityStore = Object.freeze({
      findUserByEmail: (email) => baseStore.findUserByEmail(email),
      findUserById: (userId) => baseStore.findUserById(userId),
      putSession: (session) => baseStore.putSession(session),
      findSession: (sessionId) => baseStore.findSession(sessionId),
      deleteSession(session) {
        deleteAttempts += 1;
        if (deleteAttempts === 1) throw new Error("db down");
        return baseStore.deleteSession(session);
      },
    });
    const panel = makePanel({
      identityPort: createIdentityPort({ adapter, store, admin, clock }),
    });
    await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    const second = await panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    expect(second.phase).toBe("refused");
    expect(baseStore.sessionCount()).toBe(2);
    expect((await panel.signOut()).phase).toBe("anonymous");
    expect(baseStore.sessionCount()).toBe(0);
    expect(deleteAttempts).toBe(3);
  });

  it("is a no-op from anonymous", async () => {
    const panel = makePanel();
    const snapshot = await panel.signOut();
    expect(snapshot.phase).toBe("anonymous");
  });

  it("prevents a stale sign-in from restoring identity after sign-out", async () => {
    let release!: () => void;
    const delayedAdapter: IdentityAdapter = Object.freeze({
      async authenticate(credentials) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return ADAPTER.authenticate(credentials);
      },
    });
    const panel = makePanel({
      identityPort: createIdentityPort({
        adapter: delayedAdapter,
        store: createInMemoryIdentityStore({ users: [CREW] }),
        admin,
        clock,
      }),
    });

    const pending = panel.submitCredentials({
      email: "crew@example.com",
      password: "pw",
    });
    await Promise.resolve();
    const signedOut = await panel.signOut();
    expect(signedOut.phase).toBe("anonymous");

    release();
    const stale = await pending;
    expect(stale.phase).toBe("anonymous");
    expect(panel.snapshot().phase).toBe("anonymous");
  });
});
