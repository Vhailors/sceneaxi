/**
 * The in-app AI assistant surface (sceneaxi#121, S7).
 *
 * `web-shell` is the one node in the dependency matrix that may name both the
 * Model Provider Port (`@sceneaxi/authoring-core`) and the credit plane
 * (`@sceneaxi/auth` + `@sceneaxi/billing`), which is why the assistant is
 * assembled here rather than inside either of them. It is a **view model**, like
 * `createAccountPanel` beside it: there is no UI framework in this repo, so a
 * renderer reads snapshots and every decision it would need has already been
 * made by the port and by the credit gate.
 *
 * What this module deliberately does **not** contain: a provider, a transport, a
 * credential, an entitlement rule, a balance, a ledger, or a second Kids policy.
 * It owns exactly one thing — the order in which the two existing gates run for
 * an assistant turn — and it holds that order in code so no renderer can assemble
 * a different one.
 *
 * ## Three modes, one port
 *
 * | Mode | Transport | Metering | Default |
 * |---|---|---|---|
 * | `fixture` | recorded in-repo fixture | none | **the default** |
 * | `byo` | the user's own credential, direct to their provider | none | opt-in |
 * | `hosted` | SceneAxi-operated | credits, via the ledger | opt-in **and** off |
 *
 * All three reach a model through the *same* `ModelProviderPort`. The panel never
 * builds an adapter and cannot tell a recorded transport from a live one, so
 * "live OpenRouter is opt-in" is structural rather than conventional: a live
 * transport exists only if a caller wired one into `ports` for a mode it then
 * selected, and the default mode is `fixture`. A mode with no injected port
 * refuses rather than falling back to another mode's transport.
 *
 * ## The mode → billing mapping is a projection, never a second policy
 *
 * `ASSISTANT_MODE_BILLING` maps each mode onto a route and capability that
 * already exist in `HOSTED_AI_ROUTE_CAPABILITIES`; a seam test asserts exactly
 * that, so this table can never drift into a private credit policy. `fixture`
 * bills on the free `byo` route on purpose: the credit plane's only question is
 * "does this cost credits", a recorded fixture costs nothing, and putting the
 * test mode on the one gate is what makes the Kids ordering below hold in *every*
 * mode instead of every mode a charge happens to reach. Teaching billing a third
 * route would be the alternative, and it would put test-mode knowledge inside the
 * credit plane.
 *
 * ## Kids is denied three times, and always before metering and dispatch
 *
 * 1. **Here, at construction.** A `kids` surface or a `@sceneaxi/profile-kids`
 *    profile refuses to produce a panel at all, so no turn — in any mode — can be
 *    asked. This is the deny that satisfies "before metering": the port's own
 *    Kids guard runs inside the provider thunk, which the credit gate enters
 *    *after* the balance is judged, and that would be too late.
 * 2. **The credit gate**, on the `kids` surface, before identity, ledger, or
 *    provider (`KIDS_COMMERCE_DENIED`).
 * 3. **The Model Provider Port**, non-overridably, for a Kids profile.
 *
 * Each is independent, which is the repository rule: a new path adds its own
 * deny rather than relying on an upstream one.
 *
 * ## A balance is read, never remembered
 *
 * Hosted turns re-read the ledger through the injected credits view on every ask
 * and hand it to the credit gate, which judges the *persisted* ledger regardless.
 * A ledger the panel cannot read, or one that is absent, invalid, or owned by
 * another user, is a named refusal — never `0` — because "you have no credits"
 * and "we could not read your credits" must not look identical to a buyer.
 *
 * The balance a snapshot *reports* comes only from an outcome the credit gate
 * derived from persistence, never from the view the panel was handed. The
 * difference is visible precisely when it matters: a caller holding a pre-debit
 * copy is refused `CREDIT_BALANCE_INSUFFICIENT` against the real ledger, and
 * publishing the copy's number beside that refusal would tell a buyer they have
 * credits the ledger says they already spent. Until a turn has been priced
 * against persistence there is no authoritative balance here, and the panel says
 * nothing rather than something it cannot stand behind.
 */

import {
  isEpochMilliseconds,
  snapshotPlainRecord,
  type EntitlementCapability,
  type IdentitySurface,
  type ModelCompleteResponse,
  type ModelDescriptor,
  type ModelProviderCallEvidence,
  type ModelProviderProfile,
  type Principal,
} from "@sceneaxi/schemas";
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  type ModelProviderPort,
  type ModelProviderSuccess,
} from "@sceneaxi/authoring-core";
import type { AdminIdentity, AuthRefuseReason } from "@sceneaxi/auth";
import {
  BILLING_REFUSE_REASONS,
  HOSTED_AI_DEFAULT_CONFIG,
  runMeteredModelCall,
  validateLedgerState,
  type BillingRefuseReason,
  type CreditStore,
  type HostedAiConfig,
  type HostedAiRoute,
  type LedgerState,
} from "@sceneaxi/billing";

/** How an assistant turn reaches a model. A closed enumeration. */
export const ASSISTANT_MODES = Object.freeze([
  "fixture",
  "byo",
  "hosted",
] as const);

export type AssistantMode = (typeof ASSISTANT_MODES)[number];

/** Deterministic recorded data, so tests never need a credential or a network. */
export const ASSISTANT_DEFAULT_MODE: AssistantMode = "fixture";

/**
 * Which existing billing route and capability each mode is charged under.
 *
 * A projection onto `HOSTED_AI_ROUTE_CAPABILITIES`, not a policy of its own.
 */
export const ASSISTANT_MODE_BILLING = Object.freeze({
  fixture: Object.freeze({
    route: "byo",
    capability: "byo-model-keys",
  }),
  byo: Object.freeze({
    route: "byo",
    capability: "byo-model-keys",
  }),
  hosted: Object.freeze({
    route: "hosted",
    capability: "hosted-ai-assistant",
  }),
}) satisfies Readonly<
  Record<
    AssistantMode,
    Readonly<{ route: HostedAiRoute; capability: EntitlementCapability }>
  >
>;

/** Attribution written on every hosted assistant debit. */
export const ASSISTANT_DEBIT_REASON = "hosted AI assistant turn";

/** Prefix of the caller key the credit gate then scopes to the account. */
export const ASSISTANT_TURN_KEY_PREFIX = "assistant-turn";

/** Panel-local refusals, distinct from the ports' own vocabularies. */
export const ASSISTANT_PANEL_REASONS = Object.freeze({
  kidsSurfaceDenied: "KIDS_ASSISTANT_SURFACE_DENIED",
  kidsProfileDenied: "KIDS_ASSISTANT_PROFILE_DENIED",
  surfaceInvalid: "ASSISTANT_SURFACE_INVALID",
  profileInvalid: "ASSISTANT_PROFILE_INVALID",
  modelInvalid: "ASSISTANT_MODEL_INVALID",
  modeUnknown: "ASSISTANT_MODE_UNKNOWN",
  transportMissing: "ASSISTANT_TRANSPORT_MISSING",
  adminIdentityMissing: "ASSISTANT_ADMIN_IDENTITY_MISSING",
  clockInvalid: "ASSISTANT_CLOCK_INVALID",
  promptInvalid: "ASSISTANT_PROMPT_INVALID",
  creditsViewMissing: "ASSISTANT_CREDITS_VIEW_MISSING",
  creditsUnavailable: "ASSISTANT_CREDITS_UNAVAILABLE",
  ledgerMissing: "ASSISTANT_LEDGER_MISSING",
  ledgerOwnerMismatch: "ASSISTANT_LEDGER_OWNER_MISMATCH",
  turnAlreadyCharged: "ASSISTANT_TURN_ALREADY_CHARGED",
} as const);

export type AssistantPanelReason =
  (typeof ASSISTANT_PANEL_REASONS)[keyof typeof ASSISTANT_PANEL_REASONS];

export type AssistantRefusal = Readonly<{
  reason: AssistantPanelReason | BillingRefuseReason | AuthRefuseReason;
  message: string;
  /**
   * The Model Provider Port's own named refusal, when the turn failed inside the
   * provider. Billing correctly reports `HOSTED_AI_PROVIDER_FAILED` — it must not
   * learn the shape of a model refusal — so the port's reason is carried here
   * rather than flattened away, and a reader can tell "the model failed" from
   * "the port refused the route".
   */
  providerReason?: string;
}>;

/** One completed exchange. Only turns that actually reached a model appear. */
export type AssistantTurn = Readonly<{
  mode: AssistantMode;
  prompt: string;
  text: string;
  finishReason: ModelCompleteResponse["finishReason"];
  /** The port's attestation of the model that actually executed. */
  evidence: ModelProviderCallEvidence;
  /** False on the free modes and on an admin's unlimited allowance. */
  metered: boolean;
  /** Credits debited for this turn; absent when nothing was charged. */
  credits?: number;
}>;

export type AssistantPanelSnapshot = Readonly<{
  mode: AssistantMode;
  surface: IdentitySurface;
  profile: ModelProviderProfile;
  /** Whether the selected mode debits credits at all. */
  metered: boolean;
  /** Whether the SceneAxi-hosted route is switched on. Off by default. */
  hostedEnabled: boolean;
  turns: ReadonlyArray<AssistantTurn>;
  /** Last balance the ledger reported. Absent rather than defaulted to zero. */
  creditBalance?: number;
  refusal?: AssistantRefusal;
}>;

/** Where the panel reads a user's ledger. Injected; the panel owns no storage. */
export type AssistantCreditsView = Readonly<{
  ledgerFor(
    userId: string,
  ): Promise<LedgerState | undefined> | LedgerState | undefined;
}>;

export type AssistantAskRequest = Readonly<{
  prompt: string;
  /**
   * Caller-stable id for this turn, scoped to the account by the credit gate.
   *
   * Required for a hosted turn so a timed-out retry is answered from the debit it
   * already made instead of paying the provider twice. Its absence is refused by
   * the credit gate in its own vocabulary rather than pre-empted here.
   */
  turnId?: string;
}>;

export type AssistantPanel = Readonly<{
  snapshot(): AssistantPanelSnapshot;
  /** Switch transport modes. Refuses a mode with no injected port. */
  setMode(mode: unknown): AssistantPanelSnapshot;
  ask(request: AssistantAskRequest): Promise<AssistantPanelSnapshot>;
}>;

export type CreateAssistantPanelOptions = Readonly<{
  surface: IdentitySurface;
  /** Which profile's policy the port evaluates. Kids is refused outright. */
  profile: ModelProviderProfile;
  /** The exact model the injected ports are pinned to. */
  model: ModelDescriptor;
  /**
   * One Model Provider Port per offered mode. The panel builds none of them and
   * holds no credential; a mode absent from this record cannot be selected.
   */
  ports: Readonly<Partial<Record<AssistantMode, ModelProviderPort>>>;
  mode?: AssistantMode | undefined;
  /** The single resolved admin identity; threaded to the credit gate. */
  admin: AdminIdentity;
  /** Epoch milliseconds. Injected so snapshots are deterministic. */
  clock: () => number;
  /** Absent or `{ enabled: false }` keeps the SceneAxi-hosted route off. */
  hostedAi?: HostedAiConfig | undefined;
  /** The signed-in viewer, when there is one. Hosted turns need one. */
  principal?: Principal | undefined;
  /** Where hosted turns read the ledger. Hosted mode only. */
  credits?: AssistantCreditsView | undefined;
  /** Where a hosted debit is persisted. Hosted mode only. */
  store?: CreditStore | undefined;
  /** The exact integer credit price of one hosted turn. */
  hostedTurnCredits?: number | undefined;
}>;

export type CreateAssistantPanelResult =
  | Readonly<{ ok: true; panel: AssistantPanel }>
  | Readonly<{ ok: false; reason: AssistantPanelReason; message: string }>;

const SURFACES: ReadonlyArray<IdentitySurface> = [
  "web-shell",
  "desktop-shell",
  "site",
  "kids",
];

const KIDS_PROFILE = "@sceneaxi/profile-kids";
const PROFILE_PATTERN = /^@sceneaxi\/profile-[a-z][a-z0-9-]*$/;

function isAssistantMode(value: unknown): value is AssistantMode {
  return ASSISTANT_MODES.some((mode) => mode === value);
}

function isModelDescriptor(value: unknown): value is ModelDescriptor {
  const record = snapshotPlainRecord(value);
  if (record === undefined) return false;
  return (["model", "provider", "quantization", "version"] as const).every(
    (key) => typeof record[key] === "string" && record[key].length > 0,
  );
}

function refusal(
  reason: AssistantRefusal["reason"],
  message: string,
  providerReason?: string,
): AssistantRefusal {
  return Object.freeze(
    providerReason === undefined
      ? { reason, message }
      : { reason, message, providerReason },
  );
}

function createFailure(
  reason: AssistantPanelReason,
  message: string,
): CreateAssistantPanelResult {
  return Object.freeze({ ok: false, reason, message });
}

/** The ledger a hosted turn will be judged against, or the refusal that stops it. */
type LedgerResolution =
  | Readonly<{ ok: true; state: LedgerState | undefined }>
  | Readonly<{ ok: false; refusal: AssistantRefusal }>;

export function createAssistantPanel(
  options: CreateAssistantPanelOptions,
): CreateAssistantPanelResult {
  const optionRecord = snapshotPlainRecord(options);
  if (optionRecord === undefined) {
    return createFailure(
      ASSISTANT_PANEL_REASONS.surfaceInvalid,
      "The assistant panel needs a known SceneAxi surface.",
    );
  }
  if (!SURFACES.includes(optionRecord["surface"] as IdentitySurface)) {
    return createFailure(
      ASSISTANT_PANEL_REASONS.surfaceInvalid,
      "The assistant panel needs a known SceneAxi surface.",
    );
  }
  // Kids first, and before anything else is even validated: no assistant exists
  // on that surface, so no mode of it can be metered or dispatched.
  if (optionRecord["surface"] === "kids") {
    return createFailure(
      ASSISTANT_PANEL_REASONS.kidsSurfaceDenied,
      "Kids never reaches a third-party or hosted LLM through this surface; no assistant panel is offered.",
    );
  }
  if (optionRecord["profile"] === KIDS_PROFILE) {
    return createFailure(
      ASSISTANT_PANEL_REASONS.kidsProfileDenied,
      "The Kids profile has no assistant route; the panel refuses before any metering or dispatch can be attempted.",
    );
  }
  if (
    typeof optionRecord["profile"] !== "string" ||
    !PROFILE_PATTERN.test(optionRecord["profile"])
  ) {
    return createFailure(
      ASSISTANT_PANEL_REASONS.profileInvalid,
      "The assistant panel needs a SceneAxi profile the Model Provider Port can evaluate a policy for.",
    );
  }
  if (!isModelDescriptor(optionRecord["model"])) {
    return createFailure(
      ASSISTANT_PANEL_REASONS.modelInvalid,
      "The assistant panel needs the exact model descriptor its ports are pinned to.",
    );
  }
  const portRecord = snapshotPlainRecord(optionRecord["ports"]);
  if (portRecord === undefined) {
    return createFailure(
      ASSISTANT_PANEL_REASONS.transportMissing,
      "The assistant panel needs at least one Model Provider Port; it builds no adapter and holds no credential.",
    );
  }
  const initialMode =
    optionRecord["mode"] === undefined
      ? ASSISTANT_DEFAULT_MODE
      : optionRecord["mode"];
  if (!isAssistantMode(initialMode)) {
    return createFailure(
      ASSISTANT_PANEL_REASONS.modeUnknown,
      `An assistant mode must be one of: ${ASSISTANT_MODES.join(", ")}.`,
    );
  }
  if (portRecord[initialMode] === undefined) {
    return createFailure(
      ASSISTANT_PANEL_REASONS.transportMissing,
      `No Model Provider Port is wired for the '${initialMode}' assistant mode; it does not fall back to another mode's transport.`,
    );
  }
  const adminRecord = snapshotPlainRecord(optionRecord["admin"]);
  if (
    adminRecord === undefined ||
    typeof adminRecord["email"] !== "string" ||
    adminRecord["email"].length === 0
  ) {
    return createFailure(
      ASSISTANT_PANEL_REASONS.adminIdentityMissing,
      "The assistant panel requires the resolved admin identity.",
    );
  }
  if (typeof optionRecord["clock"] !== "function") {
    return createFailure(
      ASSISTANT_PANEL_REASONS.clockInvalid,
      "The assistant panel requires an injected clock.",
    );
  }

  const surface = optionRecord["surface"] as IdentitySurface;
  const profile = optionRecord["profile"] as ModelProviderProfile;
  const model = Object.freeze({
    ...(optionRecord["model"] as ModelDescriptor),
  });
  const ports = Object.freeze({ ...portRecord }) as Readonly<
    Partial<Record<AssistantMode, ModelProviderPort>>
  >;
  const admin = optionRecord["admin"] as AdminIdentity;
  const clock = optionRecord["clock"] as () => number;
  const hostedAi =
    (optionRecord["hostedAi"] as HostedAiConfig | undefined) ??
    HOSTED_AI_DEFAULT_CONFIG;
  const principal = optionRecord["principal"] as Principal | undefined;
  const credits = optionRecord["credits"] as AssistantCreditsView | undefined;
  const store = optionRecord["store"] as CreditStore | undefined;
  const hostedTurnCredits = optionRecord["hostedTurnCredits"] as
    | number
    | undefined;

  let mode: AssistantMode = initialMode;
  const turns: AssistantTurn[] = [];
  let creditBalance: number | undefined;
  let operationTail: Promise<void> = Promise.resolve();

  const view = (value?: AssistantRefusal): AssistantPanelSnapshot =>
    Object.freeze({
      mode,
      surface,
      profile,
      metered: ASSISTANT_MODE_BILLING[mode].route === "hosted",
      hostedEnabled: hostedAi.enabled === true,
      turns: Object.freeze([...turns]),
      ...(creditBalance === undefined ? {} : { creditBalance }),
      ...(value === undefined ? {} : { refusal: value }),
    });

  const readClock = (): number | undefined => {
    let now: unknown;
    try {
      now = clock();
    } catch {
      return undefined;
    }
    return isEpochMilliseconds(now) ? now : undefined;
  };

  /**
   * Read the hosted ledger the credit gate will re-derive from persistence.
   *
   * `undefined` state with no refusal means "there is no signed-in viewer": the
   * gate answers that as `ENTITLEMENT_ACCOUNT_REQUIRED`, which is the layer that
   * owns identity vocabulary, so the panel declines to say it a second time.
   */
  const resolveHostedLedger = async (): Promise<LedgerResolution> => {
    if (credits === undefined) {
      return Object.freeze({
        ok: false,
        refusal: refusal(
          ASSISTANT_PANEL_REASONS.creditsViewMissing,
          "A hosted assistant turn requires a credits view; the panel reads no ledger of its own.",
        ),
      });
    }
    if (principal === undefined) return Object.freeze({ ok: true, state: undefined });

    let state: LedgerState | undefined;
    try {
      state = await credits.ledgerFor(principal.user.userId);
    } catch {
      return Object.freeze({
        ok: false,
        refusal: refusal(
          ASSISTANT_PANEL_REASONS.creditsUnavailable,
          "The credits view failed; the balance is unknown rather than zero and the turn refuses before the provider.",
        ),
      });
    }
    if (state === undefined) {
      return Object.freeze({
        ok: false,
        refusal: refusal(
          ASSISTANT_PANEL_REASONS.ledgerMissing,
          "No credit ledger exists for this user; a hosted turn refuses rather than assuming a zero or an unlimited balance.",
        ),
      });
    }
    const validated = validateLedgerState(state);
    if (!validated.ok) {
      return Object.freeze({
        ok: false,
        refusal: refusal(validated.reason, validated.message),
      });
    }
    if (validated.value.account.userId !== principal.user.userId) {
      return Object.freeze({
        ok: false,
        refusal: refusal(
          ASSISTANT_PANEL_REASONS.ledgerOwnerMismatch,
          "The credits view returned a ledger for a different user; no hosted turn is brokered against it.",
        ),
      });
    }
    return Object.freeze({ ok: true, state: validated.value });
  };

  const ask = async (
    request: AssistantAskRequest,
    activeMode: AssistantMode,
  ): Promise<AssistantPanelSnapshot> => {
    const now = readClock();
    if (now === undefined) {
      return view(
        refusal(
          ASSISTANT_PANEL_REASONS.clockInvalid,
          "The panel clock did not return valid epoch milliseconds.",
        ),
      );
    }

    const requestRecord = snapshotPlainRecord(request);
    const prompt = requestRecord?.["prompt"];
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return view(
        refusal(
          ASSISTANT_PANEL_REASONS.promptInvalid,
          "An assistant turn requires a non-empty prompt.",
        ),
      );
    }
    const turnId = requestRecord?.["turnId"];

    const port = ports[activeMode];
    if (port === undefined) {
      return view(
        refusal(
          ASSISTANT_PANEL_REASONS.transportMissing,
          `No Model Provider Port is wired for the '${activeMode}' assistant mode.`,
        ),
      );
    }

    const billing = ASSISTANT_MODE_BILLING[activeMode];
    const hosted = billing.route === "hosted";

    let state: LedgerState | undefined;
    if (hosted) {
      const resolved = await resolveHostedLedger();
      if (!resolved.ok) return view(resolved.refusal);
      state = resolved.state;
    }

    // The documented integration obligation (docs/auth-credits.md, "Only a throw
    // is a provider failure"): the port refuses by value, and billing charges for
    // any value a thunk returns, so the refusal is translated here — in the
    // provider integration — rather than inside the credit plane. The reason is
    // kept so the reader is told which route the port refused, while billing
    // still speaks its own `HOSTED_AI_PROVIDER_FAILED`.
    let portRefusal: Readonly<{ reason: string; message: string }> | undefined;
    const call = async (): Promise<
      ModelProviderSuccess<ModelCompleteResponse>
    > => {
      const result = await port.complete({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "complete",
        profile,
        model,
        prompt,
      });
      if (!result.ok) {
        portRefusal = Object.freeze({
          reason: result.reason,
          message: result.message,
        });
        throw new Error(result.reason);
      }
      return result;
    };

    const outcome = await runMeteredModelCall<
      ModelProviderSuccess<ModelCompleteResponse>
    >({
      route: billing.route,
      capability: billing.capability,
      call,
      now,
      hostedAi,
      admin,
      surface,
      ...(principal === undefined ? {} : { principal }),
      ...(hosted
        ? {
            ...(state === undefined ? {} : { state }),
            ...(store === undefined ? {} : { store }),
            ...(hostedTurnCredits === undefined
              ? {}
              : { creditAmount: hostedTurnCredits }),
            reason: ASSISTANT_DEBIT_REASON,
            ...(typeof turnId === "string" && turnId.length > 0
              ? { idempotencyKey: `${ASSISTANT_TURN_KEY_PREFIX}:${turnId}` }
              : {}),
          }
        : {}),
    });

    if (!outcome.ok) {
      return view(
        refusal(
          outcome.reason,
          outcome.message,
          outcome.reason === BILLING_REFUSE_REASONS.hostedAiProviderFailed
            ? portRefusal?.reason
            : undefined,
        ),
      );
    }

    // The key already bought this turn. The ledger persists debits, not model
    // answers, so there is no response to replay and inventing one would be worse
    // than saying it is gone. The balance is still corrected from persistence.
    if (outcome.value.replayed) {
      creditBalance = outcome.value.balance;
      return view(
        refusal(
          ASSISTANT_PANEL_REASONS.turnAlreadyCharged,
          "This turn was already charged; the ledger records debits, not model answers, so the original response is not recoverable and nothing was charged again.",
        ),
      );
    }

    if (outcome.value.balance !== undefined) {
      creditBalance = outcome.value.balance;
    }
    const completion = outcome.value.response.response;
    turns.push(
      Object.freeze({
        mode: activeMode,
        prompt,
        text: completion.text,
        finishReason: completion.finishReason,
        evidence: outcome.value.response.evidence,
        metered: outcome.value.metered,
        ...(outcome.value.entry === undefined
          ? {}
          : { credits: -outcome.value.entry.delta }),
      }),
    );
    return view();
  };

  const panel: AssistantPanel = Object.freeze({
    snapshot() {
      return view();
    },

    setMode(next) {
      if (!isAssistantMode(next)) {
        return view(
          refusal(
            ASSISTANT_PANEL_REASONS.modeUnknown,
            `An assistant mode must be one of: ${ASSISTANT_MODES.join(", ")}.`,
          ),
        );
      }
      if (ports[next] === undefined) {
        return view(
          refusal(
            ASSISTANT_PANEL_REASONS.transportMissing,
            `No Model Provider Port is wired for the '${next}' assistant mode; it does not fall back to another mode's transport.`,
          ),
        );
      }
      mode = next;
      return view();
    },

    /**
     * Turns are serialized so the transcript order is the order they were asked
     * in, and so two concurrent asks cannot interleave a mode switch between a
     * balance read and the debit it authorized.
     *
     * The mode is pinned **here**, synchronously, rather than inside the queued
     * body: a reader who asks in hosted mode and then flips the toggle is owed
     * the turn they asked for, and pinning after the queue wait would silently
     * re-route a turn — including onto or off the metered route — between the
     * click and the call.
     */
    async ask(request) {
      const requestedMode = mode;
      const precedingOperation = operationTail;
      let releaseOperation = () => {};
      operationTail = new Promise<void>((resolve) => {
        releaseOperation = resolve;
      });
      await precedingOperation;
      try {
        return await ask(request, requestedMode);
      } finally {
        releaseOperation();
      }
    },
  });

  return Object.freeze({ ok: true, panel });
}
