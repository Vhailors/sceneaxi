# keyboard-ux — PARTIAL, not accepted

Exclusive auxiliary proof; no product edit, commit, install, browser launch or full-review claim. AGENTS/layout, repair integration/ledger/fix-desktop-cli and deep-review08 read. HEAD and SHA-256 fingerprints are in report.json; all 132 actually transpiled TypeScript modules are hashed in source-receipt.json. No dist is used.

## Retry hardening
`check.py:35-54` now fails closed if any recorded source fingerprint or either rendered HTML fingerprint drifts, or if the captured real refusal is not HTTP 403 with `ok:false` and `document-outside-project-root`. Mutated source hash, HTML hash and HTTP status are independent negative controls. This binds static evidence only; historical browser receipts remain unbound. `validation.json` is the latest checker result; original fingerprints below/in report.json are historical snapshots until compared.

## Executed proof
- `node docs/audits/production-swarm/capacity-work-2026-10-02/keyboard-ux/source-proof.mjs`: source public renderers emit hashed HTML; actual `createInspectorApp.handle` receives POST `/api/propose`, body `{"documentPath":"../keyboard-ux-outside.json","jsonPointer":"/data/x","newValue":42}`. Observed HTTP 403, `ok:false`, `document-outside-project-root`, exact message/body retained. Inverted success assertion rejected. No read outside root/write occurred.
- `python3 docs/audits/production-swarm/capacity-work-2026-10-02/keyboard-ux/check.py`: 23 source-rendered inert controls have uniquely resolved nonblank descriptions and no native disabled attribute. This is static DOM, NOT Tab proof. Missing IDREF, zero geometry and occlusion negative controls rejected.
- Existing repair-pass2 receipt: 980 samples, 15 fail stronger geometry. Existing web repair-pass1: 48 repeated samples, zero geometry failures. Both receipts hashed; neither is proved equivalent to current source. repair-pass3.log:5-77 independently retained failure: effect-mutation clipped/occluded, effect-stage occluded at 1280x900. No fresh browser reproduction claimed.
- `node --check .../deferred-playwright.mjs` passed. Initial path-resolution and overstrict roving-tab assumptions failed and were corrected; exact failures in report.json.

## Counting correction and scope
1795 = 581 repeated focus samples × 3 checks + 52 state predicates, NOT 1795 unique requirements (deep-review08:76). Original unique denominator cannot be recovered from aggregate. This extension defines **10 named unique criteria** in validation.json, not ten PASS claims; repeated directions/viewports remain evidence samples.

`ShellButton` is actually `sites/umbrella/src/app/editor/_components/editor-shell.tsx:158-248`, not a desktop export. Its inert branch :212-215 resolves legendId; :243 removes click handler. Static source inspected/hash captured, React rendering not executed. Desktop equivalent is `chrome.ts:218-240`; source public renderer was executed. Inspector renderer `inspector-app.ts:789`, actual refusal boundary :498-508, status region :853, form submit :921-936. Existing capture-web.mjs:24 injects a visual-only refusal: it does not demonstrate request refusal. New deferred driver submits the real form. Inspector :888 displays message rather than reason code; current expected UI assertion deliberately matches actual diagnostic text, while asserting HTTP reason separately.

## Integration packet / deferred command (NOT RUN)
After explicit serial handoff and one authorized browser slot, existing installed Playwright/Chromium, no production credentials, run:
```sh
node docs/audits/production-swarm/capacity-work-2026-10-02/keyboard-ux/deferred-playwright.mjs --run
```
Optionally set `KEYBOARD_UX_CHROMIUM` to an existing executable. Set `KEYBOARD_UX_EDITOR_URL=http://127.0.0.1:<owned-fixture-port>/editor` only for an already authorized, artifact-hashed local editor fixture with inert controls; without it ShellButton browser coverage is NOT RUN. Record its served bundle/source hashes independently; HTML hash alone cannot bind that server to current source. No service is started by this driver.

Driver uses real Tab/Shift+Tab and Enter/Space (never `.focus()`), public source-rendered chrome, genuine project-open refusal, nonzero dialog geometry and nonempty code/message text, Escape dismissal, modal containment, five-point occlusion and ancestor clipping, 900x640/1280x900 + forced colors, actual inspector form POST at 390/1440. It hashes HTML/PNG, persists failures in finally, closes contexts/browser, rejects external requests. Live negative control removes an actual focused control outline and must fail. No fabricated modal/refusal text. Roving-tab arrow navigation, actual native packaging and assistive-technology remain separate deferred criteria.

`proposal.patch` is **unapplied/unverified** minimal desktop flex-shrink mitigation at chrome.ts:1252. Current inspector is a flex column with auto overflow (:1250); historic bottom controls overlap despite being in viewport. Serial integrator must test this hypothesis against exact current source; reject mitigation if full bidirectional geometry stays red. Do not remove focus stops or weaken clipping/occlusion assertions. Source change is NOT claimed landed or necessary on current pixels.

Remaining acceptance limitations: individual diagnostic text/dismissal-control geometry, exhaustive expected inert-stop coverage, and inert activation side effects beyond URL/overlay/network are not independently asserted by the deferred driver. Its PASS is scenario-level, not complete accessibility acceptance. ShellButton without the local editor fixture remains NOT RUN. Integrator must close these gaps before promotion; do not promote the aggregate browser receipt alone.

Cleanup: no temporary fixtures/processes/ports/browser/container created. Persistent HTML, receipts, executable auxiliary scripts and proposal remain only in this directory.
