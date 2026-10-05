# Deploy review (independent)

Date: 2026-10-05 (about 04:10 UTC). Reviewer: independent deploy reviewer. I did not deploy anything.
Scope: R/docs/redesign/DEPLOY.md, plus the live production state of the three sites.

## What DEPLOY.md says

The deploy was **HELD**. No candidate was built and nothing was promoted. I checked its three reasons myself:

- The production health commit is `dffefbab837d488261700a1f88b6feda2c5cf5f2`. `git cat-file` cannot find that object in R.
- `vercel project inspect sceneaxi-umbrella` shows the build command `cd ../.. && node scripts/vercel-build-site.mjs umbrella`. `scripts/vercel-build-site.mjs`, `hoist-site-deploy.mjs` and `restore-workspace-links.mjs` are missing from the working tree.
- Health shows identity, credits and billing all `wired`.

## Checks run (all against production)

**Aliases.** I ran `vercel ls <project> --prod --scope vhailpers-projects` and `vercel inspect`. Each alias points at its own project, and the deployment is the *previous* one recorded in DEPLOY.md:

- umbrella: `dpl_eCzSEqokNL4ZpNK4WkDN3x5TjF1e`, created 2026-10-04 16:02 CEST
- catalog-game: `dpl_AR3SqmTYMwaCdweRB9wWyYo3q7H9`
- catalog-web: `dpl_C7fj1XmFMYou2RBv9KQsHdT5d3cR`

No newer deployment exists on any of the three projects.

**`/api/health`.** `ok:true`. Identity, credits and billing are all `wired`, and no plane is misconfigured. `NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN` is `absent`, which is allowed because it is optional.

**Verification block** (`docs/websites-deploy.md`):

| Check | Expected | Got |
|---|---|---|
| Umbrella `/ /open /docs /engine /pricing /profiles /account /login /editor` | 200 | all 200 |
| `/open` "Three presentation core" | ≥1 | 2 |
| `/open` digest | present | `sha256:de28c08a…53ac2` |
| `/open` "Experimental Three preview" | 0 | 0 |
| `/editor` "The editor is not open for this request" | ≥1 | **0** |
| `/editor` `IDENTITY_PLANE_NOT_WIRED` | ≥1 | **0** |
| `/editor` `viewport-canvas` | 0 | **1** (preview flag set) |
| `/login` "Sign-in is not activated…" | ≥1 | **0** |
| `/login` `<form` | 0 | **1** (identity wired) |
| `/engine` SDK zip hash = first digest | equal | **no zip**: page refuses `ENGINE_SDK_ARTIFACT_MISSING`. The first digest `a7fa0189…` is a desktop artifact |
| GAME `/` | 200 | 200 |
| GAME `/item/lantern-prop` | 200 | 200 |
| GAME `/item/nope` | 404 | **200** (streamed not-found under a loading boundary, `noindex`) |
| WEB `/item/lantern-prop` | 404 | **200** (same streamed not-found) |

**Screenshots.** No browser-tab tool exists in this session, so I used headless Chromium 1223 through playwright-core instead (`E/deploy/live/shot.mjs`).

- Captured 48 full-page shots in `E/deploy/live/<site>/`:
  - umbrella: 10 routes including a 404
  - each catalog: home, one item, publish and 404
  - every route at 390 and 1440
  - reduced motion on 2 routes per site: umbrella home and docs; game home and item; web home and item
- Raw data is in `E/deploy/live/results.json`.
- Console errors: none, except the umbrella 404 route, which logs its own 404 document load.
- No CSS or font request failed. Archivo and JetBrains Mono loaded.
- Horizontal overflow is 0 everywhere.

**Comparison with E/final.** Results are in `E/deploy/live/compare.txt`:

- In the top 900px, 4.7–26.6% of pixels differ, and page heights differ on every route. For example, umbrella home at 1440 is 4505px live against 3189px in final.
- The live CSS lacks the redesign's Display XL `clamp(2.5rem, 1.6rem + 3.6vw, 4.125rem)`, which is present in all three working-tree `globals.css` files.
- The live CSS has 1 `@keyframes` per site. The tree has 8.
- `document.getAnimations()` found 0 running animations on every route.

**Kids.** Project `sceneaxi-kids` has a Ready production deployment, `dpl_CAYdcAsLEAx1Jf87bwpDcFqmMjzo`, created 2026-10-04 10:15 CEST. https://sceneaxi-kids.vercel.app returns 200. None of the three site homes links to it.

**Env and domains.** I read names, targets and timestamps through `vercel api /v10/projects/<p>/env`. No values were read.

- umbrella: every name in the docs table that is assigned to the umbrella is present, except the optional `NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN` and the do-not-set `SCENEAXI_STRIPE_LIVE_AUTHORIZED`.
- catalogs: `DATABASE_URL` and `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN` are present on both; game also has `NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN`.
- All three projects also have `ENABLE_COREPACK`, which the docs table does not list.
- The newest env change on any project is 2026-10-04 08:36 UTC. That is before this run, so this run changed nothing.
- Domains are `*.vercel.app` only.

## Fixes

1. **(blocking)** The redesign is not deployed. All three production aliases still point at the previous deployments. Proceeding needs the user decision DEPLOY.md names: port the redesign onto the `main` line production runs (`dffefbab` or later) and re-gate, or explicitly accept replacing production with this older tree and a changed build command.
2. **(blocking)** Live pages do not show the redesign. They differ from E/final on every route at 390 and 1440, and the redesign type and motion CSS is missing from the live stylesheets.
3. **(blocking)** The redesign's microanimations are not live: 0 running animations, and 1 keyframe block against 8 in the tree. Under reduced motion no animation ran on the 6 checked routes, but that is the old design, so the redesign's reduced-motion handling is unverified live.
4. **(blocking)** These Verification checks do not match production: the `/editor` three-check set and the `/login` two-check set (the docs expect an unwired plane, but production is wired and has the preview flag), the `/engine` SDK archive (missing, so there is nothing to hash), and both catalog 404 checks (HTTP 200). Fix by updating the docs expectations to the wired state, shipping the SDK archive in the umbrella build, and making unknown item ids return a real 404 status.
5. **(blocking)** Kids is deployed (`sceneaxi-kids`, `dpl_CAYdcAsLEAx1Jf87bwpDcFqmMjzo`, created 2026-10-04 08:15 UTC). That predates this run and is outside its deploy scope, so removing it is a user decision.
6. **(advisory)** `ENABLE_COREPACK` (created 2026-10-04 08:36 UTC, before this run) is on all three projects but is not in the docs env table. Add it to the docs.
7. **(advisory)** The `docs/websites-deploy.md` project-settings table (install `… && pnpm install` in the site dir, build `pnpm run build`) no longer matches the real project settings (`node scripts/vercel-build-site.mjs <site>`).
8. **(advisory)** I could not open a browser tab, so all browser checks used headless Chromium with SwiftShader.

VERDICT: FAIL
