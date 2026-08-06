# Kids first-release surface

Owner: `@sceneaxi/profile-kids` and the separate `@sceneaxi/site-kids` install root.
Canonical product topology remains [`program/site-domain-topology.md`](program/site-domain-topology.md).

## Boundary

The first Kids release is a deliberately small local creative loop, not a smaller
version of the adult editor. It asks for no age band or personal data. The child
chooses a world, adds curated pieces, and starts or stops play; a grown-up can open
one short explanation that the activity stays in the tab and sends nothing.

| Area | First-release behavior |
|---|---|
| Worlds | `meadow`, `moon`, `ocean`; bundled labels and symbols only |
| Pieces | `friend`, `tree`, `star`, `rocket`; at most six placements |
| Authoring | choose world, add piece, undo last, reset |
| Play | start and stop a local CSS animation over the composed choices |
| Input | buttons only; no text, upload, URL, file, microphone, or camera |
| State | frozen in-memory state for the current tab; no persistence |
| Claims | no shipping, curriculum, age-band, jurisdiction, or unsupervised-use claim |

The shared engine open-path table remains refuse-only for Kids. The local activity
does not open a kernel session, consume an engine/site package, or create an escape
from `OPEN_PATH_KIDS_REFUSED` on the umbrella, CLI, desktop, or web shell.

## Isolation and refusals

The site is its own Next install root with an empty SceneAxi allow list. It does not
import the profile; instead the profile and site contain byte-identical copies of the
closed activity reducer, checked for source and behavior parity at the root gate.
This duplication is intentional: reuse through an import would violate the locked
empty `kidsBoundary.allowedDependents` boundary.

| Attempt | Enforcement |
|---|---|
| Unknown activity action | `KIDS_ACTIVITY_ACTION_UNSUPPORTED`; the child sees only “That tool is not part of this play space.” |
| Non-curated world or piece | `KIDS_ACTIVITY_CURATED_CHOICE_REQUIRED` |
| More than six pieces | `KIDS_ACTIVITY_SCENE_FULL` |
| Editing during play | `KIDS_ACTIVITY_BUILD_PAUSED_WHILE_PLAYING` |
| Non-Kids catalog | `NON_KIDS_CATALOG_DENIED` at the profile policy; no catalog code or link exists in the site |
| Model route | third party refuses `THIRD_PARTY_LLM_DENIED_BY_DEFAULT`; every other route refuses `KIDS_LLM_ROUTE_NOT_ALLOWED`; no provider dependency exists |
| External data | policy refuses; the site gate rejects fetch/socket/environment APIs and CSP enforces `connect-src 'none'` |
| Identity or commerce | no dependency, form, route, environment input, or state vocabulary exists; unsupported activity requests return the generic refusal |

The generic activity refusal deliberately does not echo the attempted action and
contains no balance, account, session, provider, catalog, or model detail. Internal
policy refusals remain specific for operators and tests, but are not rendered into
the child surface.

## Proof map

| Property | Evidence |
|---|---|
| Allowed build → play flow | `packages/profile-kids/test/activity.test.ts`, `tests/e2e/profile-kids-refuse-golden.test.ts`, `tests/sites/kids-surface.test.ts` |
| Complete external refusal matrix | `packages/profile-kids/test/refuse-matrix.test.ts`, `tests/e2e/profile-kids-refuse-golden.test.ts` |
| Empty dependent boundary | `docs/dependency-matrix.json`, `tests/boundary/injected-violations.test.ts`, `tests/boundary/injected-site-violations.test.ts` |
| Site has no outbound API or configuration | `scripts/check-sites.mjs`, `tests/boundary/injected-site-violations.test.ts` |
| Browser-enforced outbound denial | `sites/kids/src/lib/security-policy.ts`, `tests/sites/kids-surface.test.ts` |
| Profile/site parity without runtime coupling | `tests/sites/kids-surface.test.ts` |

## Extending safely

An extension starts with an explicit Kids safety/product decision; it does not start
by adding a dependency or a UI control. After that authority exists:

1. Add only the newly authorized curated action/value to both activity copies.
2. Keep the files byte-identical and extend allowed-flow plus malformed/refusal tests.
3. If any data leaves the tab, define the Kids-owned origin, destination allowlist,
   retention, telemetry, credentials, and refusal contract before adding transport.
4. Never reuse umbrella identity, billing, provider, catalog, cookie, telemetry, or
   environment adapters. A Kids-owned plane requires its own separately authorized
   package/site contract and new executable isolation cases.
5. Keep `kidsBoundary.allowedDependents` empty unless a new captain decision explicitly
   changes that locked boundary; ordinary feature work cannot widen it.
6. Update this document, the package/site READMEs, the matrix injections, and the full
   golden refusal table in the same change.
