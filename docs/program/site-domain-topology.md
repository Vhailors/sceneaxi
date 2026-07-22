# Site and domain topology

**Status:** locked product decision

**Source:** `data/threejs-bgf-ecosystem-wayfinder-v1/decisions/site-domain-topology.md`

**Resolved held keys:** `site-domain-topology`, `kids-surface-isolation`

## Decision

SceneAxi uses a hybrid site and domain topology:

- One umbrella domain owns the core SceneAxi product and its documentation.
- The game-asset storefront and website-asset storefront each use a distinct
  domain. Each storefront has its own positioning, audience, navigation, and
  content; they do not publish duplicate pages.
- Kids uses a fully separate domain and origin. Its identity, cookies, data,
  telemetry, and LLM processing boundaries are isolated from the umbrella site
  and both storefronts.
- Every surface may cross-link the SceneAxi product family, but a cross-link
  does not share authentication, session state, tracking identity, or data with
  the Kids surface.

This is a product topology decision, not publication authority. It does not
authorize buying domains, creating accounts, deploying sites, or making any
surface public.

## Canonical ownership

Each public page has one owning surface and one canonical URL on that surface:

| Surface | Canonically owns |
|---|---|
| Umbrella site | Core product, engine/library, profile, package, and documentation pages |
| Game-asset storefront | Game-asset discovery, curation, merchandising, and storefront-specific editorial content |
| Website-asset storefront | Website-asset discovery, curation, merchandising, and storefront-specific editorial content |
| Kids site | Kids product, safety, support, policy, and Kids-specific experience pages |

Family navigation and contextual summaries link to the canonical owner instead
of copying its page. Storefront offers must remain distinct in positioning and
content even when they consume the same underlying catalog pipeline. Redirects,
feeds, metadata, and sitemaps must preserve the same ownership rule when those
surfaces are implemented.

## Kids isolation boundary

The Kids surface is not a tenant, route group, or sub-site of another SceneAxi
surface. Its boundary requires:

- a separate domain and origin;
- a separate identity and session plane, with no shared login or session cookie;
- cookies scoped so no parent-domain cookie crosses into Kids;
- separate Kids data storage and access paths;
- separate telemetry collection, identifiers, configuration, and destinations;
- separate LLM routing, credentials, policy, logs, and data handling, subject to
  the existing Kids safety decisions and the prohibition on third-party LLM
  defaults without explicit authority.

Cross-links into or out of Kids are ordinary links only. They must not carry
identity, session, telemetry, prompt, or user-data context across the boundary.
This fully resolves the Kids origin, app, and identity shape. The residual 6a
Kids holds concern age, safety, curriculum, and jurisdiction policy only; they
cannot weaken this isolation boundary.

## Out of scope

- Exact domain strings, registrars, and naming selection
- Domain purchases, paid services, or account creation
- Hosting vendors, deployment, publication, DNS, or certificate operations
- Storefront activation, catalog scope, pricing, or commercial launch
- Selection or authorization of any Kids LLM provider

The held-key runtime remains governed by
[`docs/held-key-enforcement.md`](../held-key-enforcement.md). This document
records the human product decision; only a current authoritative FirstMate
registry snapshot can mark `site-domain-topology` and `kids-surface-isolation`
resolved for CLI enforcement.
