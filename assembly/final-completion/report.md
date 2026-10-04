# Comprehensive release completion

PR **#310** merged at **2026-10-03T22:12:44Z**: `3d5284c2b1ed64b75a45da85133e075f634dc4fa` ([receipt](https://github.com/Vhailors/sceneaxi/pull/310)). PR **#312** merged at **2026-10-03T22:13:07Z**: `6420f5b70fd1a21d505929c318e2ad56165dd3f2` ([receipt](https://github.com/Vhailors/sceneaxi/pull/312)). Candidate: `c6f139a546ee7f098986b8ed9ae256614bf73ea7`.

Foundation `759adfe` is a normal two-parent merge with 105 documented semantic resolutions. Subsequent ordinary merges retained contained-Git, assets, input, smoke, audio, audit (including `89c7aa5e`), cloud, maintenance, PR310 and production-snapshot ancestry. All **34 captured tips** are ancestors; all **34 native ancestry tests** passed. Detailed SHAs and receipts are in `report.json`.

All **2,475 manifest paths** and reviewed new proof files were explicitly staged. No deleted main paths, lost executable modes, private backups, `git add -A`, blanket resolution or commit-hook bypass. Full path/blob/mode inventory: `final-inventory.json`. The prior detailed preparation report remains available at candidate `c6f139a`.

## Verification — RED truthfully disclosed

- Build passed before push and again from merged main.
- Schema/site-kit/viewport: **87 tests passed**. Declaration-consumer: **1 passed**, authority-rejection assertions preserved. CLI binary smoke from merged main: **9 passed**.
- Secret scanner: **16 passed** after redacting a historical audit log's echoed Postgres deny-list marker; it was not a credential. The scanner contract was not weakened. This redaction is a post-merge follow-up.
- Recorded source guard: **446 files, zero warnings/errors**. Final edited-file oxlint and ESLint passed.
- Full `pnpm gate` invoked; syntax, boundaries, contracts, traceability, sites, desktop, publish-ready and build passed. Latest foreground run exceeded its **600-second execution budget during tests**. Earlier recorded gate exit: **1**. Latest full lint retry exceeded **120 seconds**. Neither is claimed green.
- Existing GitHub checks were red. Both merges used standing RED-CI authorization with exact pushed-head matching. `enforce_admins` was restored and verified **true after each merge**. Required `gate`/`engine-sdk` contexts and workflows remained enabled.

## CLI redeployment — BLOCKED, not published

From merged main `6420f5b7`: publish-readiness **17/17**, build, SDK generation and CLI binary smoke passed. Real `npm pack` in `packages/cli` produced:

- `/tmp/sceneaxi-cli-release-20261003/sceneaxi-cli-0.0.0.tgz`
- SHA-256: `5b2a3fe5fc630f16db9aef462bf0957c8b0118796edcb22db21ebbcaeba10465`
- SDK: `dist-sdk/sceneaxi-engine-sdk-0.0.0.zip`, SHA-256 `33b7f59f468632aa33f19082b9006e22f22d8c0965bdc5562cdb3a48ef13544f`.

**Exact credential blocker:** `npm whoami --registry=https://registry.npmjs.org` returned **ENEEDAUTH**. This machine requires an authorized npm login/token. Additionally, the repository's `PUBLISH_PLAN.registryPublishAuthorized` is false, manifests remain private, and there is no registry-publish lifecycle pipeline. Packing is not claimed as standalone registry deployability. No registry publish success is claimed.

Owner-export residuals remain in `foreign-owner-export-gaps.json`. Primary and foreign worktrees were never edited. Generated test compilation outputs remain untracked and excluded from staging.
