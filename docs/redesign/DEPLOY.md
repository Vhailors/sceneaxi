# Redesign deploy — HELD before any deploy

Date: 2026-10-05. Status: **not deployed.** No candidate was built, nothing was promoted, no alias moved, no env/domain/Stripe/Neon change.

## Working tree

- Branch `production-swarm`, HEAD `4e532e2fbf43e9948741578ab6208a3277870405` (2026-09-27).
- `git status --porcelain`: 547 paths uncommitted (pre-existing work plus the redesign).

## Why it is held

1. **Production runs a newer code line than this tree.** `GET https://sceneaxi-umbrella.vercel.app/api/health` reports commit `dffefbab837d488261700a1f88b6feda2c5cf5f2`. That commit is not in the local repo. The local `origin/main` (`8a0d57ae`) is already 50 commits ahead of HEAD and is not an ancestor of HEAD. 1756 of the 2015 files changed between HEAD and `origin/main` differ in the working tree from `origin/main` (349 files under `sites/` and `packages/site-kit`). Deploying this tree would replace that live code with an older base plus the redesign.
2. **The projects' recorded build command cannot run on this tree.** All three projects use `cd ../.. && node scripts/vercel-build-site.mjs <site>`, with install `cd ../.. && pnpm install --frozen-lockfile --ignore-scripts`. `scripts/vercel-build-site.mjs`, `hoist-site-deploy.mjs` and `restore-workspace-links.mjs` exist only on `origin/main` (commits `0e3bae28`, `2c2738b9`). They are not in this tree, so a candidate build would fail. Making it build means editing the tree or overriding project settings, and neither is authorized.
3. **Production identity, credits and billing are live.** Health shows `identity`, `credits` and `billing` all `wired`, and `SCENEAXI_SITE_EDITOR_PREVIEW` is present. The docs Verification block expects the not-wired state (`IDENTITY_PLANE_NOT_WIRED`, no `/login` form), so it no longer matches production. A stale-base umbrella could also regress live sign-in and Stripe TEST checkout and webhook handling.

## Previous production (recorded for rollback)

From `vercel inspect https://<project>.vercel.app --scope vhailpers-projects`. Also saved in `E/deploy/previous.json`.

| Project | Deployment id | URL |
|---|---|---|
| sceneaxi-umbrella | `dpl_eCzSEqokNL4ZpNK4WkDN3x5TjF1e` | https://sceneaxi-umbrella-guu8ubtci-vhailpers-projects.vercel.app |
| sceneaxi-catalog-game | `dpl_AR3SqmTYMwaCdweRB9wWyYo3q7H9` | https://sceneaxi-catalog-game-fezdwqw7a-vhailpers-projects.vercel.app |
| sceneaxi-catalog-web | `dpl_C7fj1XmFMYou2RBv9KQsHdT5d3cR` | https://sceneaxi-catalog-46j75v0l6-vhailpers-projects.vercel.app |

Rollback command (not needed, since nothing moved): `vercel promote <url above> --scope vhailpers-projects --yes`.

## Not run

Local `pnpm build` (R-8 records an exit-0 build for both catalogs only), candidate deploys, the candidate and production Verification block, screenshots, and promote.

## Needed to proceed (user decision)

Port the redesign onto the code line production runs (fetch `main` at `dffefbab` or later, apply the redesign diff there, re-run the gate), then deploy that through the recorded build command. The other option is an explicit user decision to replace production with this older tree, accepting the regression and a changed build command.
