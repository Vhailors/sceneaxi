# Go-live gap list — 2026-09-26

**What this is:** a read-only audit of what stands between `main` (`5698f78`, PR #305)
and a public, paying launch. It grants no authority — no publish, spend, account,
issue creation, Stripe LIVE, Kids, marketplace, proof run, or deploy. Where this list
and an owning doc, ADR, or issue disagree, the owner wins and this file is stale.

It complements, and does not replace, the earlier
[initiation gap register](initiation/Gap-Register.md) (2026-08-26), which tracks
requirement-traceability defects rather than launch readiness.

**Method:** four parallel read-only area audits (sites, identity/billing, engine/CLI,
desktop/editor), plus direct probes of the production URLs on 2026-09-26. Blocker
claims marked ✔ were re-verified by hand against source.

Severity: 🔴 blocker · 🟠 high · 🟡 medium · ⚪ low.

## A. Captain decisions that gate everything else

1. 🔴 **Licence** — `UNLICENSED`, no `LICENSE` file (`package.json:30`, `docs/publish-readiness.md:32`).
2. 🔴 **Trademark clearance** for "SceneAxi" — SPEC "Naming residuals" (Axi/AxiCorp/ARM AXI).
3. 🔴 **Open public sign-up** — ✔ `disableSignUp: true` (`sites/umbrella/src/provider/better-auth-provider.ts:245`); single-admin design per ADR 0021 amendment 2026-08-07.
4. 🔴 **Stripe LIVE go-live** — ADR 0021 hold + authority 10; `docs/stripe-live-activation.md` is "NOT AUTHORIZED".
5. 🔴 **Execute `docs/production-activation.md`** — every box unchecked (sceneaxi#201).
6. 🟠 **Tier-6b marketplace activation** — catalog purchase/publish refuse `CATALOG_COMMERCE_INERT`.
7. 🟠 **npm publication** — every package `private`, `0.0.0`; `docs/web-consumer.md` tells consumers to wait.
8. 🟠 **Kids in or out of launch** — R0 refuse-only; `sites/kids` undeployed.
9. 🟡 **Proof stages** — none executed; Stage 1/6 double-gated (`docs/program/spec-41.md`).
10. 🟡 **Hosted AI in launch scope** — `HOSTED_AI_DEFAULT_CONFIG.enabled: false`.

## B. Identity and accounts

11. 🔴 No sign-up, email verification, forgot/reset or change password/email. Only `POST sign-in/email` and `GET get-session` are exposed (`better-auth-provider.ts:578-583`).
12. 🔴 No email transport configured anywhere.
13. 🔴 No account deletion / GDPR data export; ledger `ON DELETE RESTRICT` + append-only trigger (`db/migrations/0002_credits_billing.sql:25,74`) need a retention/pseudonymisation policy first.
14. 🟡 Sign-out deletes only the SceneAxi `sessions` row; the Better Auth session/bearer stays valid until expiry (`packages/auth/src/identity-port.ts:531-560`).
15. 🟡 Email verification enforced only for the admin (`identity-port.ts:402-410`).
16. ⚪ No OAuth/social login, no MFA.
17. 🟡 Production `/editor` still renders "Preview — the server-side editor preview flag is set" (probed 2026-09-26); remove `SCENEAXI_SITE_EDITOR_PREVIEW` once sign-in is proven (`production-activation.md:279`).

## C. Payments, credits, billing

18. 🔴 LIVE is blocked in code: `sk_test_`-only client (`sites/umbrella/src/lib/provider-adapters.ts:553`), `liveModeAuthorized` never passed (`identity-plane.ts:882`), credit-pack fixture has only `price_test_*` revisions.
19. 🔴 No tax/VAT, invoices, or receipts — checkout sets no `automatic_tax`, `invoice_creation`, customer email, or address collection.
20. 🔴 Disputes/chargebacks unhandled — ✔ webhook handles only `checkout.session.completed` and `charge.refunded` (`sites/umbrella/src/lib/credit-webhook.ts:362-363`); everything else is acknowledged as `unhandledType`.
21. 🟠 Refunds reconcile only when full and unspent; `STRIPE_REFUND_NOT_FULL` and spent-credit refunds are acknowledged without ledger movement (`packages/billing/src/stripe-webhook.ts:864`, `docs/auth-credits.md:533-575`). No operator procedure.
22. 🟠 Recorded Stripe endpoint subscribes only to `checkout.session.completed`; `charge.refunded` must be added (`docs/websites-deploy.md:641`).
23. 🟠 No admin/support tooling: ledger lookup, goodwill adjustment, support refund.
24. 🟠 Checkout UX: refusal is raw JSON `402` to an HTML form; no success/pending/cancel pages; no purchase history on `/account` (`sites/umbrella/src/app/api/checkout/route.ts:9-49`, `account/page.tsx:113-142`).
25. 🟡 `/api/checkout` falls back to a random attempt UUID → a new intent and Stripe session per POST; no rate limit (`route.ts:21-24`).
26. 🟡 USD only.
27. ⚪ `stripe_customer_links` table is created but never used.

## D. Hosted AI

28. 🟠 Advertised on `/login`, `/account`, and marketing copy, but no site calls `runMeteredModelCall`; the editor assistant composer is a static `<p>` (`sites/umbrella/src/app/editor/_components/editor-shell.tsx:1165`).
29. 🟠 `@sceneaxi/provider-openrouter` ships only `createFixtureTransport`; there is no live hosted transport.
30. 🟠 No credit price table; `creditAmount` is caller-supplied (`packages/billing/src/hosted-ai.ts:190`).

## E. Data and operations

31. 🟠 No migration runner and no applied-migrations tracking; `db/README.md` says to apply by hand.
32. 🟠 No backup/PITR/restore policy or drill, while rollback is "forward-fix only" (`production-activation.md:250`).
33. 🟠 Neon adapters have only been tested against a mock (`tests/sites/provider-adapters.test.ts`); replay, transaction, and concurrency behaviour are unproven on real Postgres.
34. 🟠 No observability: no logging in `sites/*/src`, Better Auth `logger.disabled`, no error tracking, analytics, health endpoint, or alerting.
35. 🟡 No startup env validation; misconfiguration silently becomes "not wired".
36. 🟡 `ConnectStore` is in-memory only (`packages/billing/src/stripe-connect.ts:284`) despite migration 0004's tables.
37. 🟡 No live-mode audit-sink implementation (`packages/billing/src/live-mode.ts:120-131`).

## F. Websites

38. 🔴 No legal pages — `/terms` and `/privacy` return `404` in production (probed); no cookie notice, imprint, refund policy, or contact/support page.
39. 🟠 No security headers on the umbrella or catalogs (no CSP, `frame-ancestors`, Referrer-/Permissions-Policy; `poweredByHeader` on). Only `sites/kids` ships a policy.
40. 🟠 Cross-site identity can't work: custom domains parked, so the umbrella cookie never reaches the catalogs; catalog identity is always `wired: false` (`packages/site-kit/src/catalog-identity.ts:45-55`).
41. 🟠 No automated `next build` of any site (`gate.yml` runs only umbrella `test:provider` + typecheck).
42. 🟡 `robots.txt` and `sitemap.xml` return `404` (probed); no OG images, favicon, catalog-item metadata, or `noindex` on `/login`, `/account`, `/editor`.
43. 🟡 Umbrella has no `not-found.tsx`; no site has `error.tsx`, `global-error.tsx`, or `loading.tsx`.
44. 🟡 Operator internals shown to users ("Identity plane: not wired", "Checkout: not wired", a doc path on `/login`).
45. 🟡 `/api/checkout` has no origin check, unlike login, logout, and intake.
46. 🟡 No editor project persistence; all state lives in the URL.
47. ⚪ `/docs` is a single page; no help, FAQ, or status page.

## G. Storefronts and marketplace

48. 🟠 Buy and publish are inert; no download or delivery path for any listing.
49. 🟠 `POST /api/editor/catalog-intake` always refuses `CATALOG_INTAKE_STORAGE_UNAVAILABLE` (`sites/umbrella/src/lib/catalog-submission.ts:108-110`); no production intake store and no moderation tooling.
50. 🟡 Four TEST fixture listings; no search, filter, or sort.
51. 🟡 Connect payouts are TEST-only; LIVE is "not implemented" (`stripe-connect.ts:463,1034`).

## H. Desktop apps and distribution

52. 🔴 ✔ The offered Linux build is stale and expiring: workflow run 31629556282, source `364b666` (2026-08-12), expires **2026-11-10** (`docs/desktop-linux.md:413-425`). It predates #254–#270, and a workflow artifact is not a public Release.
53. 🔴 ✔ Registered editor commands that declare the `desktop-control` client have no desktop GUI dispatch path: `run-stop`, `run-reset`, `physics-apply`, `environment-apply`, `material-apply`, `effect-apply`, `scene-prefab-*`, `package-install`, `workspace-layout-*`, `project-build`, `input-action-rebind`, and `input-actions-reset` (`packages/schemas/src/editor-command-registry.ts`; each lists `["desktop-control","cli","local-agent"]`). The host implements them (`desktop/linux/src/lib/bridge.ts`, e.g. `run-stop` ~2947, `physics-apply` ~3040). Traced 2026-09-26, the chrome has four dispatch paths, and none reaches these IDs:
    - the palette/menu `commandHandlers` map, which is fed by `DESKTOP_INTERACTION_COMMANDS` (12 IDs: project new/open/save, undo/redo, palette, Git ×4, `run-play`, `ship-export-web`);
    - `data-editor-command` controls (`assistant-cancel`, `change-review-accept`/`-reject`, `assistant-local-build`);
    - literal `commandRequest()` calls (`scene-hierarchy-inspect`, `scene-property-set`, `scene-selection-set`, undo/redo, `run-play`, `ship-export-web`, `change-review-reject`);
    - computed `commandRequest()` calls: `stageSceneCommand` (`scene-object-create`/`-remove`, `scene-transform-apply`, `scene-object-reparent`), `saveProject`, and the Git inspect/mutate helpers.

    No file under `apps/desktop-shell/src` or `desktop/linux/src/renderer` names any of the listed IDs, so no desktop GUI control dispatches them. Outside the host (`bridge.ts`) and the registry, the only non-test code that names them is the local-bridge tool registry (`packages/schemas/src/desktop-local-bridge.ts`), which `sceneaxi desktop bridge call` and local agents use. (`run-reset` in `packages/site-kit/src/editor-shell.ts` is an unrelated web-editor link control.)
54. 🟠 No crash reporting or telemetry; no `render-process-gone` / `child-process-gone` handling.
55. 🟠 macOS: no signed or notarized artifact. Windows: no signing certificate and **no CI workflow**.
56. 🟠 No auto-update, no release/tag workflow, unsigned Linux packages.
57. 🟠 Fake controls: the Hosted assistant chip (`DESKTOP_ASSISTANT_HOSTED_METERING_UNAVAILABLE`), project-browser rename/delete, Compose and Plugins modes, and the Console dock (`docs/full-editor-v1-capability-matrix.md:68,81,92,96,100`).
58. 🟠 User project builds refuse on every OS (`PROJECT_BUILD_SIGNING_MISSING` on Linux; host/signing missing on macOS/Windows); Web export refuses on macOS/Windows.
59. 🟡 BYOK is live only via OpenCode DeepSeek; OpenRouter is offered but fixture-only. Linux `basic_text` keyrings refuse key storage.
60. 🟡 Electron 43.2.0 GPU process SIGSEGV in the current-host smoke (matrix :152).
61. 🟡 The packaged smoke does not exercise the #254–#270 features.

## I. Engine runtime

62. 🔴 ✔ No scripting or game logic — the `KernelCommand` union is `spawn`, `move`, and `rarity-roll` (`packages/schemas/src/kernel-session.ts:37-51`).
63. 🟠 Physics is contract-only: a 1-D toy adapter, no Rapier adapter, and scene physics is evaluated outside the kernel (ADR 0027, `packages/schemas/src/physics-world-host.ts`).
64. 🟠 No audio playback; audio is metadata-only (`docs/asset-ingestion.md:31`).
65. 🟠 Only export target is the desktop's static Web viewer; no native, mobile, or PWA target and no CLI export.
66. 🟡 Imported models are untextured: no UVs, textures, skins, or morphs (`packages/engine-presentation/src/three-sculpt.ts:133-165`).
67. 🟡 No imported-animation playback or skeletal animation (`docs/asset-ingestion.md:33`).
68. 🟡 Post-processing, particles, and material overrides are in schemas only and never drawn (ADRs 0025, 0026, 0028).
69. 🟡 No gamepad support; the kernel consumes no input.
70. 🟡 Axis-aligned placement only (`docs/scene-composition.md:17-23`).
71. 🟡 Spec'd packages `engine-asset-compiler`, `engine-platform-host`, and `engine-evidence` are absent, as are the F1 stage, Asset Package, Evidence Packet, and Ship Event contracts.
72. ⚪ WebGL only; no networking.

## J. Authoring model and plugins

73. 🟠 General E2 is specified, not built (`docs/authoring-contracts.md:15-17,99-120`, ADR 0003).
74. 🟡 `project dev --watch` refuses `NOT_IMPLEMENTED` (`packages/cli/src/project-lifecycle.ts:191-216`).
75. 🟠 The plugin registry has one capability (`sceneaxi.sculpt.intake-source.v1`), and the host is not a sandbox (`docs/plugins.md:273-274`).
76. 🟡 Web profile not conformance-claimed; `shippingClaim` is `false` for every profile.

## K. CLI and packaging

77. 🟠 Missing verbs: play/run, build/export, `asset remove`, plugin list/load/validate, evidence show/verify, `catalog submit`, `project migrate`, and template init.
78. 🟡 The held-key runtime always refuses (no live epoch authority); exit code `3` is still "reserved/skeleton" (`packages/cli/src/exit-codes.ts:24`).
79. 🟠 Exports point at `.ts` source; a published tarball would not run in Node without a build/export rework.

## L. Documentation

80. 🟠 No getting-started guide, tutorial, or `examples/`.
81. 🟠 No generated API reference.
82. 🟡 No root `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, or `CODE_OF_CONDUCT`.
83. 🟡 Docs are governance-heavy, not user guides; the canonical spec lives in issue #1 and cites an out-of-tree archive.
84. 🟡 Stale docs:
    - `docs/program/NEXT-STEP.md` is pinned to `203eb53` (July).
    - `docs/websites-deploy.md:648` says production `/login` is `404`, but it returns `200` and rejects bad credentials with `LOGIN_CREDENTIALS_REJECTED` (probed 2026-09-26).
    - `sites/umbrella/src/lib/identity-plane.ts:757-762` says nothing provisions a credit account, which contradicts `provider-adapters.ts:420-437`.
    - Matrix rows for Play and the assistant still cite #258/#261 as pending.
    - `docs/desktop-local-bridge.md:160` claims OpenRouter support.
    - Some package descriptions still say "(bootstrap stub)".
85. ⚪ Thin READMEs: `importers`, `profile-kids`, `provider-openrouter`.

## M. CI and tracking

86. 🟠 No alert or scheduled job before the 2026-11-10 artifact expiry.
87. 🟡 The "Actions budget-blocked" operator note is outdated: all four workflows succeeded on 2026-09-25/26.
88. ⚪ Zero open GitHub issues, so none of the above is tracked.

## Addressed in the working tree (2026-09-26, uncommitted)

| Item | Change | Proof |
|---|---|---|
| 39 | `security-headers.json` + `headers()` + `poweredByHeader: false` for umbrella, catalog-game, catalog-web | `tests/sites/site-response-hardening.test.ts`; live `next start` probes of both builds |
| 41 | `sites-build` matrix job in `.github/workflows/gate.yml` (install, typecheck, `next build` + Vercel package check) | local `pnpm build` of umbrella and catalog-game passes; the CI job itself has not run yet |
| 42 (part) | umbrella `robots.ts`, `sitemap.ts` (origin from `NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN` only), `noindex` on `/login`, `/account`, `/editor` | hardening test; probed `/robots.txt`, `/sitemap.xml`, meta tags |
| 43 (part) | umbrella `not-found.tsx` and `error.tsx` (digest only, no re-attempt control) | hardening test; probed 404 |
| 45 | `/api/checkout` requires the same-origin form proof before reading the form, `403 SITE_REQUEST_CROSS_ORIGIN` otherwise | hardening test; probed cross-site `403`, same-origin reaches the billing step |
| 84 (part) | `websites-deploy.md` dated `/login` observation, `identity-plane.ts` provisioning comment, `desktop-local-bridge.md` provider sentence, three package descriptions | review only |

Still open from those rows: OG images/favicon/catalog metadata (42), catalog `error.tsx` (43),
`NEXT-STEP.md` re-pin and capability-matrix row drift (84).

## Loop tracking

Item status lives in [`go-live-backlog.json`](go-live-backlog.json): `class` is one of autonomous, decision, external, or gated; `status` is one of open, in-progress, done, or parked, with a `parkedReason`. The graphmap is [`surface-map.md`](surface-map.md) (Mermaid) and [`surface-map.html`](surface-map.html) (every node). Regenerate both with:

```sh
node scripts/probe-surfaces.mjs [--build]   # needs each site's install root; writes surface-probe.json
node scripts/surface-map.mjs                # needs `pnpm build`; writes surface-map.{json,html,md}
```

Found while building the map (owned by item 53): the capability matrix marked `dock-timeline` as **real** before any GUI code named `animation-apply`. Item 53 added that dispatch (`apps/desktop-shell/src/chrome.ts` `stageSceneCommand('animation-apply', …)`); the branch review then reopened 53 for the 12 commands that still have no GUI control (backlog `progress`).

## Loop result (2026-09-27, `go-live-loop`)

- **Done: 38 items** — 14, 20, 21, 23, 24, 25, 31, 32, 33, 34, 35, 36, 37, 39, 41, 42, 43, 44, 45, 47, 54, 57, 60, 63, 66, 67, 68, 69, 74, 80, 81, 82, 83, 84, 85, 86, 89, 90. Items 89 and 90 were found during the loop and added.
- **Open: 3** — 53 (reopened by the branch review: 14 desktop-accepted commands still lack a GUI control that can send their input; exact list in the backlog `progress`); 61 (worker interrupted; not resumed without an explicit request); 64 (worker interrupted; not resumed without an explicit request).
- **Parked: 49** — each needs a captain decision or external authority (`parkedReason` in the backlog).
- **Final gate:** `pnpm gate` exit 0 on `468b461` (272 files, 4,140 tests, lint clean); `sites/umbrella` `pnpm test:integration` 7/7 against PGlite with every migration. The run logs are local, not checked in.
- **Graphmap:** working 318 · partial 31 · unconfigured 10 · refused 15 · gap 17 · parked 49 · unknown 2 (routes from probe `e61b51b`; catalog-web and kids not probed — no local install root — so they count as `unknown`). The review found the earlier "working 333" headline counted desktop-accepted commands without a GUI as working; `scripts/surface-map.mjs` no longer does.

Decisions the done items surfaced (implemented only up to the fail-closed part):

- #20: Clawback amount, access restrictions, and dispute-resolution policy (records only; no money policy chosen)
- #21: Clawback amount, access restrictions, and dispute-resolution policy (records only; no money policy chosen)
- #36: LIVE activation stays held (D5); the sink records audits only
- #37: LIVE activation stays held (D5); the sink records audits only
- #53: project-build targets Linux only; broader targets future work
- #54: Retention/sharing policy for local minidumps (never uploaded)
- #60: Historical SIGSEGV not reproduced; cause unresolved and recorded
- #63: ADR 0027 pose/animation/joint-frame contract; nonzero Rapier animation offsets refuse
- #66: Async JPEG/WebP decoding is a follow-up; browser texture pixels not yet recorded
- #67: Skinning (JOINTS_0/WEIGHTS_0) and CUBICSPLINE refuse; browser pixel proof pending
- #68: Rendering layer only; product wiring is item 90
- #69: No built-in gameplay consumer of play.primary; choosing gameplay behavior is an operator decision
- #90: ADR 0026 asset-to-texture contract (pixel transport, UV set, colour space, sampler); non-null texture slots refuse

## Loop 2 result (2026-09-27, branch `bb/opus-go-live-loop-2-for-sceneaxi-the-previous-lo-thr_cgpu4vbkib`)

- **Done: 44 items** — the 38 above plus 53, 61, and 64, and three found during the loop: 91 (Vitest fixtures leaked into the shared TMPDIR until the host ran out of /tmp inodes), 92 (an imported model whose id sorts before a sibling made the project unplayable), and 93 (profiling lost its frame metrics after a project switch).
  - 53: all 14 desktop-accepted commands have GUI forms fed by real inspection state. `tests/e2e/desktop-editor-command-forms-golden.test.ts` drives them into a real bridge, and `tests/e2e/desktop-control-dispatch-real-bridge-golden.test.ts` proves 29 more GUI dispatches. The Electron smoke fills and clicks the 14 forms with real pointer input.
  - 61: the Electron smoke asserts specific per-feature values for #254–#270 (`proof.features`). #267/#268 record host absence. The README and capability matrix say which older steps still click through the DOM.
  - 64: desktop Game/Web Play plays ingested clips through Web Audio. The smoke measures the live output level (it follows the pointer-set gain) and silence after Stop. Kids audio stays refused.
- **Open: 3** — 94 (a profile switch refuses DESKTOP_PROFILE_SWITCH_DIRTY after the full smoke flow with no review badge; root cause not confirmed), 95 (assistant-ask/apply-build GUI dispatch not golden-proven), 96 (per-project form-state reset lacks a root-change test; an inspect answered after a switch can refill old choices).
- **Parked: 49**, unchanged; each needs a captain decision or external authority.
- **Final gate:** `pnpm gate` on `2944f1c` passed every static stage and 4,192 of 4,193 tests. The failure, a `queueMicrotask` reference in a vm-hosted golden, was fixed in `f5f98e5`. Its five affected goldens pass 228/228. The run on the final commit is recorded in the PR. It needs a real, short TMPDIR outside the command sandbox, because the local-RPC suites bind Unix sockets. The Electron smoke passed 5/5 locally at about 50 s per run.
- **Graphmap:** working 372 · partial 31 · unconfigured 10 · refused 15 · gap 3 · parked 49 · unknown 4. "Working" now needs a golden that validates the GUI dispatch; a mention in the GUI source no longer counts. The 11 unused Approve controls were removed.
- **Captain questions surfaced:** Kids audio (enabling it is a policy decision); 53's Linux-only project-build target is unchanged.

## Suggested sequencing

1. Decisions A1–A5.
2. Minimum paid-web launch: 11–13, 17–24, 31–35, 38, 39, 41, 42.
3. Desktop: fresh Linux Release before 2026-11-10 (52), GUI for bridge features (53), crash reporting (54).
4. Engine credibility: 62–64, 66–67, then 80–81.
