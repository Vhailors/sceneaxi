# SceneAxi v6 — BEFORE baseline (plan step 2, A1)

Captured 2026-10-06, branch `redesign-v6` at `2cef2033` (v5 merged, PR #328 + #333). Read-only on code.
Evidence root: `~/Documents/Reports/sceneaxi-redesign-v6/baseline/` (written `E/` below). 470 PNGs, raw JSON per surface.

## Method

- Sites: fresh `next build` per site (production, not `next dev`, so Lighthouse numbers mean something), served with `next start` on 127.0.0.1:3301–3304; umbrella also on :3305 with `SCENEAXI_SITE_EDITOR_PREVIEW=1` for the editor preview.
- Web shell: `tsc --build` then `node apps/web-shell/bin/sceneaxi-web-shell.mjs --port 5381 --cwd <scratch>` with a real `createDocument`/`writeDocumentFile` scene (`entities[0] = {id:"hero", x:1}`), scratch dir outside the repo.
- Browser: Playwright-core 1.59 driving Chrome for Testing 148, headless. Widths 375×812, 768×1024, 1280×800, 1920×1080, full-page.
- Contrast: in-page eval, label colour composited over the painted background chain (incl. full-size pseudo-element state layers), WCAG ratio. Per distinct control signature: rest → real mouse hover → mouse down (active) → keyboard-modality `:focus-visible`. Clips saved per state in `E/<site>/states/`.
- axe-core 4.14 per route at 1280 and 375 with CSP bypassed (`E/axe.json`). Lighthouse 12.8.2, mobile (default throttling) and desktop preset (`E/lighthouse/*.json`).
- Error/loading boundaries that cannot be reached by URL (`error.tsx`, `loading.tsx`, `global-error.tsx`) were server-rendered from the real component and injected into `<main>`; marked `injected` in JSON.
- Scripts: `E/_work/{lib,sites,kids,webshell,ws2,repro,axeall,desk}.mjs`.

## Numbers per surface

| Surface | Routes × widths (PNGs) | axe serious+critical (1280/375) | axe moderate | Min enabled-control contrast rest / hover / active / focus | Min font | Max targets <24px on one page | Overflow-x (any width) | 200% zoom overflow | Reduced-motion running anims | LH mobile perf / LCP / CLS / TBT | LH desktop perf / LCP | CSS source globals.css | CSS shipped (raw / gzip) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Umbrella | 22 states × 4 (103) | **10 nodes**: `scrollable-region-focusable` on /engine (3/5), /pricing 375 (1), /pricing?reason 375 (1), /editor preview 1280 (1) | heading-order on /account, /admin/ledger | 6.07 / 6.07 / 5.37 / 6.07 (masthead Download; quiet 15.04 hover) | **11px** | **19** | none | none | 0 | `/` **55 / 4585ms / 0 / 2015ms**; `/engine` 82 / 3062ms / 0 / 458ms | `/` 98 / 954ms; `/engine` 100 / 666ms | 126,804 B | 90,437 / 15,993 B (2 files) |
| Catalog-game | 9 states × 4 (36) | 0 | `region` ×1 every route; `page-has-heading-one` on `?sort=random` | 4.81 hover, **4.64 active** ("Browse the catalogue →", `a.button.button-xl`) | 11px | 1 | none | none | 0 | `/` 80 / 2878ms / 0 / 598ms | **BLOCKED** (Lighthouse desktop run crashed, no JSON) | 67,513 B | 45,277 / 8,299 B |
| Catalog-web | 9 states × 4 (36) | 0 | same as game | 6.37 / 7.28 / 7.00 / 6.37 | 11px | 1 | none | none | 0 | `/` 75 / 3058ms / 0 / 818ms | 100 / 638ms | 67,542 B | 45,277 / 8,303 B |
| Kids | 7 states × 4 (28) | 0 | 0 | 5.85 / 5.85 / **5.01** (selected world) / 5.85; disabled 6.10 | 16px | 0 (<44px: **0**) | none | none | 0 | `/` 98 / 1909ms / 0 / 127ms | 100 / 451ms | 21,760 B | 16,227 / 3,828 B |
| Web shell inspector | 9 states × 4 dark + 2 light (62) | 0 (all states, both schemes) | 0 | dark 15.86–18.73; disabled Accept/Reject 7.16 (dark) / 5.74 (light); ring 2px/2px offset 18.7–21:1 | 13px | — | none | — | — | n/a (loopback tool) | n/a | inline in `inspector-app.ts` (44,345 B source) | inline |
| Desktop (packaged Linux) | 1 frame × 2 | not run | — | — | — | — | — | — | — | — | — | — | 47,237 B CSSOM text |

CSS 60% budget (release gate "CSS bytes ≤ 60% of BASELINE", on source `globals.css`): umbrella ≤ **76,082 B**, each store ≤ **40,508 / 40,525 B**, kids ≤ **13,056 B**.

Lighthouse INP is not a lab metric; TBT is recorded as the proxy. The in-page Event Timing probe recorded no interaction over 16ms during the state sweeps.

Store parity: `sites/catalog-game/src/app/globals.css` vs `sites/catalog-web/src/app/globals.css` differ in **30 lines** (`diff | grep -c '^[<>]'`), and the shipped CSS is byte-equal in size (45,277). Check those 30 lines against the "store token block only" rule.

## Defect reproduction

1. **v5 hover label defect (final review fix 1): reproduced, and already patched at HEAD.**
   - HEAD has guard rules at `sites/umbrella/src/app/globals.css:298-299` (`.wordmark:hover`) and `:774-779` (`a.button:hover`, `a.button-quiet:hover`). Measured on HEAD: masthead Download rest 7.05:1, hover **6.07:1** (`rgb(7,8,10)` on `rgb(235,99,41)`).
   - Deleting those 3 rules in the live CSSOM brings back the v5 state: hover **1.20:1**, `rgb(255,138,84)` on `rgb(255,109,47)`. This matches the review figure exactly.
   - Root cause is still live in site-kit: `a:hover { color: var(--accent-hi); }` (`packages/site-kit/src/design-tokens.ts` ~:615, specificity 0,1,1). Every site has to out-specify it per component.
   - Evidence: `E/umbrella/defect-hover-head.png`, `E/umbrella/defect-hover-v5-without-guard.png`, script `E/_work/repro.mjs`.
   - **Token request to foundation (A5):** drop the global `a:hover` recolour from the base sheet, or scope it to `:where(a:not([class]))` at specificity 0,0,1, so components never have to patch it.
2. **Store refusal-panel density (fix 2): not reproducible at HEAD.**
   - `/item/harbour-diorama` on catalog-web: `.state-deny` and `.state-warn` measure 736px wide at 768 and 485px wide at 1440, with padding **24px** and gap **16px**. The compact `.buy .state` rule is gone. Only an animation rule remains at `globals.css:2682`.
   - Screenshots: `E/catalog-{web,game}/item-*.png`.
3. **Desktop accent:** the packaged app still renders Cinematic Pro `--accent: #46D8EC`. Window title: "SceneAxi Engine Desktop — Choose a project".
4. **Low-but-passing readings v6 should beat:**
   - Store primary CTA active state is 4.64:1 (catalog-game).
   - Kids selected world is 5.01:1 on press.
   - Umbrella has 11px minimum text and up to 19 targets under 24px on one page (docs/tables).
5. **Axe serious findings:** `scrollable-region-focusable` on the umbrella `.scroll-x` tables (/engine, /pricing at 375) and in the editor preview. These are keyboard-only blockers for those tables.

## Interaction states captured

Hover, active and focus clips for every distinct control are in `E/<surface>/states/*-{hover,active,focus}.png`.

- **Umbrella:**
  - pricing `?checkout=cancelled`, `?reason=IDENTITY_SESSION_ABSENT`
  - login `?reason=LOGIN_CREDENTIALS_REJECTED`
  - account `?checkout=success`
  - signed-out account, editor and admin refusals
  - 404, error boundary (injected), docs/editor loading (injected)
  - editor preview with the Change Review dock (pending "Changes 1", disabled Accept all / Reject all)
  - reduced-motion, forced-colors and 200% zoom (home, engine, profiles)
- **Stores:**
  - home, item, publish
  - 404, empty search (`?q=no-such-listing`), refused sort (`?sort=random`)
  - error boundary, loading, global-error (injected)
  - reduced-motion, forced-colors and 200% zoom
- **Kids:**
  - initial, world picked, two pieces
  - pieces full (all piece buttons disabled), refused extra piece, play mode (builder disabled), grown-ups open
  - reduced-motion, forced-colors, zoom
- **Web shell:**
  - idle, proposed/pending review (Accept and Reject enabled), rejected
  - refused bad pointer: "Refused (inspector-refused): JSON Pointer path not found: "/data/nope/9/x" Review the inputs and diagnostic before trying again."
  - refused bad JSON, refused missing doc, proposed again, accepted, recover
  - all of the above in dark and light

## Measurement caveats

- **Focus "obscured" heuristic: not trusted.** The tab walk flagged 137/874 (umbrella), 57/299 (game) and 64/300 (web) stops as covered at the element centre. Most hits are `a.skip-link` and in-flow links right after a scroll, which points to a sticky masthead or a timing artefact. Confirm by eye before calling it a defect. No tab stop lacked a visible ring.
- The axe pass inside the sweep (`baseline.json` `axe` field) was blocked by the sites' own CSP. It was superseded by `E/axe.json`, which bypasses CSP. The `errors` entries reading "Executing inline script violates … CSP" come from that injection; they are not page errors.
- Umbrella `/open` at 1280 hit `net::ERR_NETWORK_CHANGED` once. That PNG and the "Reload 4.51:1" control are Chrome's error page, not SceneAxi. The other widths of `/open` are valid.
- Web-shell `idle` after the first run shows phase `rejected`: the server keeps session state across page loads.

## BLOCKED / not done

- **Packaged desktop is stale.** The frame comes from `desktop/linux/release/linux-unpacked` built 2026-10-01; 100 files in `apps/desktop-shell/src` and `desktop/linux/src` are newer. Rebuilding with `pnpm --filter @sceneaxi/desktop-linux dist` was skipped under the conductor's 10-minute cap. Frame: `E/desktop/packaged-frame-{1280,1920}.png`.
- Desktop axe and contrast sweep: not run.
- Lighthouse desktop for catalog-game: crashed (no JSON).
- Lighthouse only covered `/` per site plus umbrella `/engine`. Other routes have no LH numbers.
- No PNG was judged by eye in this pass. The PNG sets are captured for the G1 council and visual signoff.

## Evidence paths

- `E/umbrella/*.png` (103), `E/umbrella/states/`, `E/umbrella/baseline.json`, `E/umbrella/defect-hover-*.png`
- `E/catalog-game/`, `E/catalog-web/` (36 each + states + `baseline.json`)
- `E/kids/` (28 + reduced/forced/zoom + states + `baseline.json`)
- `E/web-shell/` (62 + states + `baseline.json`)
- `E/desktop/packaged-frame-*.png`
- `E/axe.json`, `E/lighthouse/*.json`, logs in `E/_work/logs/`
