# Identity lifecycle: local contracts, not deployed attestation

## Current source reconciliation (backlog id 14)

The provider is no longer a source-only signup/login stub: `better-auth-provider.ts` exposes only stock sign-in, session lookup and sign-out plus owned export/disable/reauth/refusal routes. Public signup and stock change-password, email-change, delete-user and arbitrary plugins remain unreachable; a single deployment bootstrap identity is operator-attested, not proof of a user-controlled verified-email flow.

`account-lifecycle.ts` exports bounded persisted own-user identity, credit accounts, ledger and checkout intents after exact-origin validation, both persisted session layers, verified non-disabled identity, immutable recent provider session creation and a fresh password check. Disable requires the explicit `disable-access` confirmation, revokes both session layers transactionally and preserves financial bytes; it is access disable, **not erasure**. Admin adjustment now requires a per-action password roundtrip through the same owned reauth endpoint and a second original-session/admin check; local issuance refresh, a role or a browser timestamp is not reauthentication.

`recovery-contract.ts` implements a closed trusted capability: 256-bit random tokens, digest-only persistence, database-clock 15-minute technical expiry, supersession, atomic single use, password-hash replacement and both-layer revocation. No public recovery endpoint invokes it: absent mail delivery refuses `ACCOUNT_RECOVERY_MAIL_TRANSPORT_UNCONFIGURED`; production enabling requires an approved authenticated mail transport, reviewed sender/domain/template and anti-enumeration/rate-limit policy. No real email was sent or production account changed by the fixture proof.

## Category inventory and retention specification

| Category | Local export | Access disable | Retention / erasure boundary |
| --- | --- | --- | --- |
| Own identity/address/verification | Included; no role authority | Retain disabled identity | Reviewed identity policy and verified erasure procedure required |
| Password hashes / provider credentials | Never export | Retain disabled credential; no new grants | Never disclose hashes/tokens; review credential retirement policy |
| Provider and SceneAxi sessions | Never export tokens/digests | Delete both layers in one transaction | Session expiry is operational validity, not a legal retention claim |
| Credit accounts / append-only ledger | Included, bounded; over-limit refuses instead of truncating | Preserve byte-identical ledger | Preserve accounting chain, sequence, amount, idempotency and reconciliation evidence |
| Checkout intents | Included, bounded | Preserve financial witness | Reviewed financial retention purpose/period required |
| Reconciliation, hosted usage/reservations, seller/Connect audit | Not in current export | Preserve financial witness | Category inventory and authenticated export adapter required before claiming full privacy export |
| Catalog submissions and moderation/provenance | Not in current export | Withdraw future mutation authority | Reviewed rights/moderation obligations and own-user export adapter required |
| Application logs, durable throttle/recovery working state | Never claim complete export | Do not log passwords/tokens | Minimize/redact; bounded operational sweeps are separate from reviewed legal retention |
| Backups, snapshots, provider copies | Not live-exported | May retain disabled records | Named operator must attest scope, approved retention and restoration tombstone application |

No legal period is invented. `ACCOUNT_LIFECYCLE_POLICY` accurately marks erasure, full privacy export, backup retention and mail recovery as requiring reviewed inputs; operational body/row/session/token limits do not authorize legal deletion.

## Ledger-preserving pseudonymization specification (not executed)

After a verified request, policy approval and category reconciliation, replace nonfinancial display/address fields with an opaque random subject alias in the identity projection, revoke credentials/sessions, and retain the existing immutable internal account/ledger identifiers and all financial chain bytes. Keep any necessary reversible subject mapping in a separately access-controlled audited operator vault, never in the public export, logs, catalog links or ledger entries; prefer irreversible removal when the approved obligations permit it. Reconcile checkout/support/hosted/catalog references through authorized projections rather than rewriting historical ledger rows or inventing balance witnesses. Restore must reapply approved subject tombstones before re-enabling grants, and record only redacted evidence. This specification authorizes no production deletion, pseudonymization or restoration.

## Local proof and limits

Owned real PostgreSQL and synthetic Better Auth fixtures exercise authenticated export/disable, rollback, durable password budgets, token expiry/supersession/race/replay, recent-session refusal, actual Chromium HTTP/HTTPS cookies, logout replay and no-store responses. Production Next browser oracles separately exercise unconfigured refusal, CSP, route canonicals and bounded local editor persistence; none proves a deployed provider, legal compliance, real sender delivery or production retention attestation.
