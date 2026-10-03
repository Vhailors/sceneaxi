# Umbrella visual loop

**Visual work complete; three unrelated/concurrent source/header test oracles remain red.** Only `sites/umbrella/src/app/globals.css` changed. Foundations v2 palette, semantic variants, engine admission, provider APIs and the 900×600 editor minimum remain unchanged. Read `FINAL.md`, all five finish Markdown reports, design foundations and existing tokens first. No dependencies, commit or push.

## Before → after

- Mobile responsive token rules were losing to inline Foundations CSS: gutter **32 → 20px**. Four-column wrapped navigation retains all eight destinations with **44px** targets; header **157 → 155px**, no sticky mobile screen obstruction.
- Mobile editor minimum refusal previously occupied y355–489 while fixed notices occupied y393–806: actual overlap. Refusal now occupies y24–169; notices begin y185, in normal document flow. Neither message is hidden or shortened.
- Named states: 16px human headings, 14px explanatory text, 24px desktop/20px mobile padding; refusal keys remain machine typography. Cards use the same 4px rhythm and larger prose.
- Docs: wider reading column, restrained 20px help-card titles, two-column mobile navigation groups. Purchase-history list gets bounded readable presentation without data changes.
- Removed perpetual decorative badge pulsing; 120ms pressed feedback confirms interaction and respects reduced motion.

## Real browser evidence

Installed Playwright + `/usr/bin/chromium` used because a dedicated browser tool was not exposed. Fresh **Next 15.5.24 build + start**, loopback port46231; existing server-only preview flag enabled to exercise real editor chrome. Identity providers remain unconfigured: account/login screenshots show genuine named refusal states, not fabricated sessions. Full-page desktop **1440×1000** and mobile **390×844** before/after PNGs for all six pages; hashes and byte lengths are in the JSON report. Rendered source SHA256: `93d8c050f3ec40b28650f200c68863aa165733834363f33dfd705d3faa254ed6`. Final source SHA256: `adc8024cdf26249884d087f8fa4b0eb8e210338e8874b433229fa1e138ad1636` after removing only extra EOF blank lines; visual declarations unchanged.

| Page | Desktop screenshots | Mobile screenshots |
| --- | --- | --- |
| Landing | [before](finish-visual-umbrella-before-landing-desktop.png) · [after](finish-visual-umbrella-after-landing-desktop.png) | [before](finish-visual-umbrella-before-landing-mobile.png) · [after](finish-visual-umbrella-after-landing-mobile.png) |
| /open | [before](finish-visual-umbrella-before-open-desktop.png) · [after](finish-visual-umbrella-after-open-desktop.png) | [before](finish-visual-umbrella-before-open-mobile.png) · [after](finish-visual-umbrella-after-open-mobile.png) |
| /editor | [before](finish-visual-umbrella-before-editor-desktop.png) · [after](finish-visual-umbrella-after-editor-desktop.png) | [before](finish-visual-umbrella-before-editor-mobile.png) · [after](finish-visual-umbrella-after-editor-mobile.png) |
| /account | [before](finish-visual-umbrella-before-account-desktop.png) · [after](finish-visual-umbrella-after-account-desktop.png) | [before](finish-visual-umbrella-before-account-mobile.png) · [after](finish-visual-umbrella-after-account-mobile.png) |
| /login | [before](finish-visual-umbrella-before-login-desktop.png) · [after](finish-visual-umbrella-after-login-desktop.png) | [before](finish-visual-umbrella-before-login-mobile.png) · [after](finish-visual-umbrella-after-login-mobile.png) |
| /docs | [before](finish-visual-umbrella-before-docs-desktop.png) · [after](finish-visual-umbrella-after-docs-desktop.png) | [before](finish-visual-umbrella-before-docs-mobile.png) · [after](finish-visual-umbrella-after-docs-mobile.png) |

**Contrast:** 39 browser-composited text/background samples across the six routes clear WCAG AA normal text; lowest **5.16:1**. No palette additions or fg-4 promotion. Focus remains a visible 2px solid ring. Reduced-motion duration resolves to 0.001ms. Production browser **81 assertions pass**: all 12 responses200, no page errors/sideways overflow, nonoverlapping mobile editor notices, contrast, focus, reduced motion and an additional320px navigation check.

## Executed owning checks

- Root umbrella visual + site-kit token suites initially **122 pass**, two files. Latest rerun **121 pass / 1 fail**: `umbrella-visual.test.ts:1187` expects literal `"aria-disabled": true` in concurrently refactored `editor-shell.tsx`; this CSS-only lane did not edit it. Reported to integration; no test weakened.
- Umbrella provider suites: **24 pass**; integration: **7 pass**.
- Umbrella typecheck and fresh final production build: **exit0**. An intermediate build failed on concurrent engine typing (`gameplay.ts170 pressed on {}`); engine owner repaired it, final build/typecheck passed.
- Existing owning browser suite: **6 visual pass / 1 identity fail**. Failure at `identity.visual.spec.ts:32`: expected `no-store`, received `private, no-store`; API untouched. Log: `finish-visual-umbrella-owning-browser.log`.
- Additional root hardening run: **93 pass / 1 fail** (includes umbrella visual tests, not additive). `site-response-hardening.test.ts:103`: expected `verifyLoginRequestOrigin(` lexical occurrence, received index-1 in untouched checkout route. All failures reported to integration; no oracle weakened. Final owned `git diff --check` passed after removing extra EOF blank lines.
- Formatter not independently certified: local `pnpm exec prettier` unavailable/exit254 despite wrapper summary. CSS-only anti-slop review: no assertions/coercions/fallbacks or disables added; SAFETY scope comment retained. Shared TS files untouched.

Limits: no authenticated/purchase-history provider-browser attestation, exhaustive accessibility certification, physical GPU proof or production approval. The existing desktop notice-overlay pattern remains; the demonstrated mobile overlap is repaired. Screenshots are captured evidence, not an independent human aesthetic certification.
