# @sceneaxi/billing

Credits and billing for the SceneAxi identity plane: the append-only credit ledger,
metering, entitlement enforcement, the default-off hosted-AI credit gate, and the Stripe
test-mode checkout and webhook paths.

Configuration lives in [`docs/auth-credits.md`](../../docs/auth-credits.md); the
adapter-boundary decision is ADR 0021.

Dependencies: `@sceneaxi/schemas` and the `@sceneaxi/auth` seam. Nothing else.

## Why it is shaped this way

**Append-only is a property of the type, not a rule to remember.**
`appendCreditEntry` is pure: it returns a new frozen state and never touches the one it was
given, so there is no in-place mutation to forget to avoid. The database enforces the same
invariant independently — a `BEFORE UPDATE OR DELETE` trigger plus unique indexes in
`db/migrations` — so neither layer is the only thing standing between the ledger and a
rewrite. The in-memory reference store enforces those constraints too, so a bug the real
trigger would catch cannot pass the test suite.

**Balance is always derived.** `CreditAccount` has no balance column and no balance field.
`balanceAfter` on each entry is a witness of the derivation that `deriveBalance` re-checks,
not a second place the balance lives. `deriveBalance` refuses a gapped, reordered, or
duplicated history rather than totalling it — a plain `reduce` over deltas would happily
sum a corrupted list.

**A mutated replay can never top up.** Idempotency compares the *semantic* payload
(movement, delta, reason) and ignores `entryId`, because a retrying caller legitimately
generates a fresh id. An identical retry returns the existing entry with `replayed: true`;
the same key carrying different money is a conflict.

**Credits sales persist atomically.** `applyCreditsSale` computes the buyer debit,
creator grant, and share record without mutation. `persistCreditsSale` hands that complete
settlement to `CreditStore.settleCreditsSale` once, so no supported persistence path can
commit only one side.

**Admin is never debited.** The captain's unlimited allowance returns `metered: false` and
leaves the ledger untouched — reported explicitly rather than faked with a zero-credit
entry, which would pollute the ledger with meaningless rows.

**Nothing collected means nothing paid.** An uncharged sale produces no creator grant and
no share record, because paying out half of a gross nobody paid would mint credits from
nothing. `settleCreditsSale` refuses a settlement whose non-zero gross has no buyer debit,
so the rule holds at the persistence boundary too, not only in the pure path.

**Metering is a persisted effect.** `meterCredits` loads the current account history from
its injected `CreditStore`, refuses an absent or stale account, and appends the debit
before it reports success. The caller's idempotency key is scoped to the account
(`usage:<accountId>:<callerKey>`) so the ledger's per-account replay check and the store's
global `idempotency_key` uniqueness cannot disagree.

**Hosted AI is one ordering, not a convention.** `runMeteredModelCall` composes the two
pieces that already exist — `evaluateEntitlement` and `meterCredits` — into the single
sequence a hosted model call may happen in: Kids denial, route, hosted opt-in, replay,
entitlement (capability, account, **balance**), metering readiness, provider, debit. Balance
before provider is the load-bearing step: an unfunded account refuses without the provider
running and without a ledger row, so a zero balance costs nothing and appends nothing. The
provider is an **injected thunk**, never a Model Provider Port type — billing does not learn
what a model is in order to charge for one, and every credential stays outside the credit
plane.

**A retry costs nothing twice.** The account-scoped metering key is looked up *before* the
balance is judged and before the provider is entered, so a caller re-sending a timed-out
turn gets `replayed: true` with the debit it already made, instead of being refused
`CREDIT_BALANCE_INSUFFICIENT` out of the balance that very debit spent and paying the
upstream provider a second time. That lookup reads the **persisted** ledger through the
injected store rather than the `state` the caller passed, because the caller a timeout
leaves holding a pre-debit copy is exactly the one the guarantee is for; an unreadable store
therefore refuses `CREDIT_STORE_FAILED` before the provider rather than after it. The
replayed outcome carries no `response` field at all: the ledger records debits, never model
answers, and the gate will not invent one.

**Only a throw is a provider failure.** Billing charges for any value the thunk returns, so
a provider layer that reports refusals as data — the Model Provider Port's
`{ ok: false, reason }` — must be translated by the caller's own integration
(`if (!result.ok) throw new Error(result.reason)`) before it reaches the gate. Doing that
translation here would mean billing learning the shape of a model refusal, which is the one
thing the injected thunk exists to prevent. See `docs/auth-credits.md`.

**Hosted AI is off until someone says otherwise.** `HOSTED_AI_DEFAULT_CONFIG` is
`{ enabled: false }`, and the opt-in is a separate explicit switch rather than something
derived from "an adapter is configured" or "a key is present" — possessing an OpenRouter
key is not a decision to spend a user's credits. The refusal is reachable with no account
and no ledger, so "hosted AI is off here" can never be mistaken for "you cannot afford it".

**Bring-your-own keys stay free.** The `byo` route bills `byo-model-keys`, which the matrix
prices free-without-account, so it resolves before identity and never reaches metering —
even for a signed-in caller with a balance. Charging a user who is already paying their own
provider would be charging twice.

**Refusals keep their identity.** `BillingRefuseReason` includes `AuthRefuseReason`, so a
guard refusal surfaces as `KIDS_IDENTITY_SURFACE_DENIED` or `AUTH_SESSION_EXPIRED` rather
than being flattened into a generic "not permitted".

## Refusals

`BILLING_REFUSE_REASONS` is frozen and exhaustive. The refuse-matrix regression enumerates
it — together with the auth reasons it can surface — and asserts each is reachable.
