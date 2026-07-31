# @sceneaxi/auth

The SceneAxi identity plane: single-admin resolution from the environment,
fail-closed role guards, and the identity port.

Configuration (Better Auth wiring, Neon setup, environment variables) lives in
[`docs/auth-credits.md`](../../docs/auth-credits.md). The adapter-boundary decision is
recorded in ADR 0021.

## What this package owns

| Module | Owns |
|---|---|
| `admin.ts` | `resolveAdminIdentity` — exactly one captain email from `SCENEAXI_ADMIN_EMAIL`, issued with runtime provenance |
| `roles.ts` | `resolveRole`, `createRoleGuards`, `requireRole`, `requireAuthenticated` |
| `session-token.ts` | SHA-256 digests and constant-time comparison |
| `store.ts` | the `IdentityStore` port + in-memory reference implementation |
| `better-auth-adapter.ts` | the injected Better Auth boundary and its mapping |
| `identity-port.ts` | `createIdentityPort` — `signIn` / `verifySession` / `signOut`, and the `SignInGrant` a sign-in returns |
| `principal-provenance.ts` | Object-identity witness shared by identity issuance and role guards |
| `testing/principal-issuance.ts` | The test-only `./testing/principal-issuance` subpath — genuine `Principal` fixtures, unreachable from production source |
| `bootstrap.ts` | `planAdminBootstrap` — the one admin assignment to persist |

Dependencies: `@sceneaxi/schemas` only. No engine package, no profile, no CLI.

`signOut` accepts only the exact principal capability the port issued — `signIn`'s grant
carries it as `grant.principal`, and `verifySession` returns it directly. A bare session
id is not revocation authority.

A successful `signIn` resolves a `SignInGrant` (`{ principal, sessionToken }`), not a bare
principal, because the store keeps only the token's digest: that raw token is the one
redeemable copy in existence, so a caller that needs a browser credential must take it
here or never. The caller's obligation — hand it to the authenticated client and hold it
nowhere else — is owned by
[`docs/auth-credits.md`](../../docs/auth-credits.md).

Every role guard likewise accepts only the exact `Principal` object issued by an
identity port. A hand-built value or any copy refuses `AUTH_PRINCIPAL_UNPROVEN`, even
when its public structure is valid. Tests — in this package and in every other one —
obtain genuine fixtures through the declared, visibly test-only
`@sceneaxi/auth/testing/principal-issuance` subpath, always by public package name and
never by a relative path into a foreign directory. That subpath is not re-exported from
the root barrel, and production source cannot reach it: the rule is enforced rather than
conventional, by the `testing/` subpath check in
[`docs/DEPENDENCY-MATRIX.md`](../../docs/DEPENDENCY-MATRIX.md#test-only-testing-subpaths).

## Why it is shaped this way

**Admin is unclaimable, not merely validated.** The `User` contract has no role field, so
there is no place for a client to put one. Any inbound payload carrying `role`, `roles`,
`isAdmin`, or `admin` is **refused** — checked before the adapter or store is touched.
Stripping the field instead would make an escalation attempt look like a successful login.

**Exactly one admin, resolved at deploy time.** The admin comes from an environment
variable, so there is no API, migration, or admin panel that can mint a second one. A
*plural* variable (`SCENEAXI_ADMIN_EMAILS`) refuses on presence alone — honoring it would
quietly normalize multi-admin, which needs a captain decision this package does not have.

**Every dependency is checked per call.** A port missing its adapter, store, admin
identity, or clock refuses each request rather than being unusable at construction and
subtly permissive later. There is no unauthenticated fallback path.

**Kids is refused by name, twice.** `signIn` refuses a `kids` surface before dispatch, so
no adapter can influence the outcome; `verifySession` and the role guards refuse a *stored*
`kids` session, so one written by any other path can never be redeemed. Kids never shares
identity or cookies with another SceneAxi surface.

**Only digests are stored.** Sessions hold a SHA-256 hex digest, so a leaked session table
is not a set of credentials. Comparison is `timingSafeEqual` over fixed-width buffers —
a byte-wise early return would leak how much of a guessed token was right.

**No role hierarchy.** `requireRole` is an exact match; a guard that should accept any
signed-in principal uses `requireAuthenticated`. That way "admin also counts as a user"
never has to be inferred from the guard's name.

**Identity authority is unforgeable at runtime, not just typed.** `{ email, source }` is a
public shape, so a caller supplying both the principal *and* the `admin` option would be
answering the guard's own question. Only the object `resolveAdminIdentity` issued counts —
checked by object identity, so a spread, `structuredClone`, JSON round-trip, or `Proxy` of
a real one refuses with `AUTH_ADMIN_IDENTITY_UNPROVEN`. The same rule applies to the
`Principal`: only the exact object `createIdentityPort` returned counts, and a look-alike
refuses with `AUTH_PRINCIPAL_UNPROVEN`. Prefer
`createRoleGuards(resolveAdminIdentity(env))`, which removes the argument entirely: the
answer is fixed where the guards are made, and a refused resolution makes every bound guard
return that same named refusal. The mechanism is `createProvenanceWitness` in
`@sceneaxi/schemas`; see `docs/auth-credits.md`.

## Refusals

`AUTH_REFUSE_REASONS` is frozen and exhaustive. The refuse-matrix regression enumerates it
and asserts each reason is reachable, so a reason cannot be added without a covering case.
