# @sceneaxi/billing

Credits and billing for the SceneAxi identity plane: the append-only credit ledger,
metering, entitlement enforcement, and the Stripe test-mode checkout and webhook paths.

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

**Refusals keep their identity.** `BillingRefuseReason` includes `AuthRefuseReason`, so a
guard refusal surfaces as `KIDS_IDENTITY_SURFACE_DENIED` or `AUTH_SESSION_EXPIRED` rather
than being flattened into a generic "not permitted".

## Refusals

`BILLING_REFUSE_REASONS` is frozen and exhaustive. The refuse-matrix regression enumerates
it — together with the auth reasons it can surface — and asserts each is reachable.
