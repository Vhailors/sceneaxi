# ADR 0020: The Minimum E2 web editor is entitled by credits or the starter allotment

- **Status:** Accepted for websites-deploy v1.
- **Date recorded:** 2026-07-25
- **Source:** captain freeze and dispatch, `sceneaxi-websites-deploy-v1`; [sceneaxi#102](https://github.com/Vhailors/sceneaxi/issues/102), [#103](https://github.com/Vhailors/sceneaxi/issues/103), [#105](https://github.com/Vhailors/sceneaxi/issues/105), [#108](https://github.com/Vhailors/sceneaxi/issues/108).
- **Lineage:** Bounded by ADR 0003 (E1 first; general E2 specified-not-built; bounded hybrid Minimum E2 exception) and ADRs 0014–0015 (scene composition). Depends on the identity plane owned by `sceneaxi-auth-credits-v1` ([#90](https://github.com/Vhailors/sceneaxi/issues/90)).

## Context

The umbrella is to offer a post-login sculpt/scene editor to entitled users. ADR 0003
keeps general E2 specified-not-built and permits only the bounded hybrid Minimum E2
surface. Composition landed on `main` ([#113](https://github.com/Vhailors/sceneaxi/pull/113)),
so multi-object scenes are available through the real pipeline.

Entitlement needs a home. It is neither an identity question nor a ledger question: it
is a product rule over a principal and a balance, and both of those are owned by
`@sceneaxi/auth` and `@sceneaxi/billing`.

## Decision

The umbrella offers the **bounded Minimum E2 sculpt/scene editor** to an entitled
user. Entitlement is a pure total function in `@sceneaxi/site-kit`:

- an **admin** is unrestricted, and the decision short-circuits **before any credit
  reading is consulted**, so the admin path does not depend on the credits plane;
- otherwise a **credit balance above zero**;
- otherwise an **unused starter allotment of 100 credits**;
- otherwise a named refusal, propagating a plane's own reason verbatim when one exists.

`site-kit` decides *eligibility* only. The idempotent starter grant append belongs to
`@sceneaxi/billing`; nothing here writes a ledger entry.

The editor surface is bounded to **exactly** the Minimum E2 checklist plus one additive
read-only projection, `composeSceneProjection()`, which reads the session's mounted
placements through `composeScene`. The operation key set is frozen and asserted, so a
general-E2 operation cannot be added without failing the gate. Placement stays a
projection: no artifact is rewritten to place it, because its evidence binds its exact
spec bytes.

Access is decided **before** a session is constructed, so an unentitled request never
reaches the engine.

Unauthenticated visitors keep everything free: product pages, documentation, the public
engine SDK download, and browsing either catalog.

**A bounded temporary affordance:** `SCENEAXI_SITE_EDITOR_PREVIEW=1`, read from the
server environment only and absent by default, grants a clearly banner-marked preview
session. It exists because the identity plane has not landed, and without it the
Minimum E2 surface would be undemonstrable on a production deploy. It attributes
nothing to an account and consumes no credits, and it is removed once entitlement can
actually be resolved.

## Consequences

- The auth/credits vertical is a dependency for real entitlement. Until it lands, the
  site's ports refuse with named reasons rather than minting a session or a balance.
- Because the editor is stateless — each render rebuilds a real session in an ephemeral
  workspace from URL state — no storage decision was needed to ship it, and none is
  implied. Edits are explicitly not persisted.
- This ADR authorizes **no** general-E2 expansion. ADR 0003 stands unchanged.
- This ADR opens **no** tier-6b marketplace activation. Catalog purchase stays inert.
- The preview flag is a deploy affordance with a stated expiry condition, not a product
  decision about who may edit.

## Rejected alternatives

- **General E2 for every signed-in user** — contradicts ADR 0003 and was never ordered.
- **An admin-only editor this wave** — the captain decision is credits-or-starter
  entitlement with admin unrestricted, not admin-only.
- **Implementing admin resolution or a credit ledger in `site-kit`** — would fork
  `@sceneaxi/auth` and `@sceneaxi/billing` while both are mid-pipeline, which the ship
  order forbids.
- **A client-supplied entitlement or role hint** — a site that accepted one would become
  a client-claimable admin path; role claims are refused before any adapter dispatch.
- **Persisting editor projects now** — needs a storage decision nobody has made;
  pretending to save work would be worse than saying it is not saved.
- **Shipping the editor unreachable until auth lands** — leaves an ordered deliverable
  undemonstrable when a server-only, default-off, clearly-labelled preview suffices.

## Settled here vs held elsewhere

**Settled:** entitlement is admin-unrestricted, else credits above zero, else the
unused 100-credit starter allotment; the editor surface is bounded to Minimum E2 plus
the composition projection; access is decided before a session exists; free capabilities
stay free; and the preview flag is bounded, default-off, and temporary.

**Held elsewhere:** general E2 (ADR 0003); marketplace activation and catalog checkout
(tier-6b); Stripe live mode; identity, role, and ledger semantics
(`sceneaxi-auth-credits-v1`); editor project persistence and storage; and hosted-AI
provider selection under the existing LLM-provider policy.
