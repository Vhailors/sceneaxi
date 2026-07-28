# @sceneaxi/billing

Credits and billing for the SceneAxi identity plane: the append-only credit ledger,
metering, entitlement enforcement, the default-off hosted-AI credit gate, the Stripe
test-mode checkout and webhook paths, and the bounded fixture-SKU commerce path over the
committed catalog.

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

**Hosted AI has one enforced ordering.** `runMeteredModelCall` composes
`evaluateEntitlement` and `meterCredits`; it requires the current persisted ledger before
provider dispatch, stays default-off, and keeps bring-your-own keys free. The provider is
an injected thunk rather than a Model Provider Port type, so billing learns no model or
credential shape. The exact ordering, replay behavior, refusal ownership, and caller-side
translation of provider refusals are owned by
[`docs/auth-credits.md`](../../docs/auth-credits.md#hosted-ai-sceneaxi139).

**An offer is a closed enumeration, not a value a caller hands in.** The primitives beneath
`fixture-commerce.ts` take a `CatalogListing` value, which is right for a mechanism and wrong
for an offer — a hand-built listing would transact against a SKU nobody published. No
exported function on that path accepts a listing value: ids are resolved from
`FIXTURE_COMMERCE_LISTING_IDS` against the committed set, so being in the catalog fixtures is
not being for sale, and every other listing refuses
`LISTING_FIXTURE_COMMERCE_NOT_ENABLED` — a distinct fact from `LISTING_UNKNOWN`. Test mode is
structural for the same reason: nothing there accepts or forwards `liveModeAuthorized`, so a
live intent has no expression rather than a default. What that path adds is only the offer:
the binding that keeps bookkeeping attached to its own verified sale belongs to
`recordMoneySale` beneath it, which accepts no gross, currency, buyer, mode, listing, or
sale id at all (sceneaxi#127). The enumeration, the entitlement row it evaluates, and the
retry ordering it shares with the hosted-AI replay step are documented in
[`docs/auth-credits.md`](../../docs/auth-credits.md) under *Fixture commerce (sceneaxi#138)*,
and the evidence rules under *Creator publish and revenue share*.

**Verified means verified at runtime, not in the type.** A `VerifiedWebhook` and a
`VerifiedCheckoutCompletion` both mean "a signature check produced me", and both have a
public shape — so a type brand stops only a TypeScript caller, while JavaScript and `as`
reach the same exported functions. Each is issued through a module-private provenance
witness and checked by object identity at every consumer: `parseCheckoutCompletedEvent`
refuses an unissued webhook with `STRIPE_WEBHOOK_NOT_VERIFIED`, and every completion
consumer refuses an unissued completion with `STRIPE_COMPLETION_NOT_VERIFIED` — *before*
reading its contents, since the value's contents are the part anyone can fake. A copy of a
genuine completion is a different object and refuses too. The consumer list and the
issuing/checking table are owned by `docs/auth-credits.md` under *Runtime provenance*.

**Refusals keep their identity.** `BillingRefuseReason` includes `AuthRefuseReason`, so a
guard refusal surfaces as `KIDS_IDENTITY_SURFACE_DENIED` or `AUTH_SESSION_EXPIRED` rather
than being flattened into a generic "not permitted".

## Refusals

`BILLING_REFUSE_REASONS` is frozen and exhaustive. The refuse-matrix regression enumerates
it — together with the auth reasons it can surface — and asserts each is reachable.
