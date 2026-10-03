# Finish integration rollup

Generated from 16 lane reports (65 rows).

Status counts: DONE_IMPLEMENTED_VERIFIED 58, NOT_CLOSED_SHARED_OWNERSHIP 1, RECLASSIFIED_INTENTIONAL 2, RECLASSIFIED_EXTERNAL 4

Notes: finish-integration-audit-desktop-linux.json: no row array (keys: actions,advisories,muted,metadata); finish-integration-audit-desktop-macos.json: no row array (keys: actions,advisories,muted,metadata); finish-integration-audit-desktop-windows.json: no row array (keys: actions,advisories,muted,metadata); finish-integration-audit-root.json: no row array (keys: actions,advisories,muted,metadata); finish-integration-audit-sites-catalog-game-after.json: no row array (keys: actions,advisories,muted,metadata); finish-integration-audit-sites-catalog-game.json: no row array (keys: actions,advisories,muted,metadata); finish-integration-audit-sites-catalog-web-after.json: no row array (keys: actions,advisories,muted,metadata); finish-integration-audit-sites-catalog-web.json: no row array (keys: actions,advisories,muted,metadata); finish-integration-audit-sites-kids-after.json: no row array (keys: actions,advisories,muted,metadata); finish-integration-audit-sites-kids.json: no row array (keys: actions,advisories,muted,metadata); finish-integration-audit-sites-umbrella-after.json: no row array (keys: actions,advisories,muted,metadata); finish-integration-audit-sites-umbrella.json: no row array (keys: actions,advisories,muted,metadata)

## Verification receipts (integrator bg-44)

- pnpm -s build: pass
- pnpm gate: 294 files / 4,513 tests + 40 Node contracts, exit 0
- pnpm test:golden: 57 files / 544 tests, exit 0
- SDK generation: 163 entries, 440,273 bytes
- Four site production builds + typechecks: pass
- Browser proofs: 12+16+5 assertions; provider suites: 24+7 tests

## Residuals

- Padded-8MiB GUI reload stall — open known defect (importer unchanged; 120s stall evidence retained).
- sharp advisories remain blocked by the Next allowed range — documented triage, no fake bump.
- DR-006 native per-project build certification — RECLASSIFIED_EXTERNAL (platform runtime + signing hosts).
