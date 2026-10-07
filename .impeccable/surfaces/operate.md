# Surface brief: Operate dialect (comfortable / compact)

Mode brief for the v6 "Interlocking" world. World tokens and rules: `DESIGN.md` (keys = the properties `signalCss()` emits in `packages/site-kit/src/design-tokens.ts`; `-light` keys = the same property under `prefers-color-scheme: light`). Source of truth: `docs/redesign-v6/DIRECTION.md` §3, §4, §5.3, §9, §10.

**Tokens:** `signalCss({ scheme: "system" })` for web shell, desktop and account surfaces that follow the system scheme. Density is `data-density="comfortable" | "compact"` on the placing element (`--density-*` properties). Classes: `.sx-btn`, `.sx-plate[data-state]`, `.sx-interlock[data-density]` (`-head`, `-reason`, `-evidence`), `.sx-visually-hidden`. The web shell (CSP `default-src 'none'`) and desktop (no site-kit import) carry copies of these values, not imports.

**Comfortable:** umbrella `/login`, `/account`, `/pricing` panels, 404/error; the **store acquire block** (even inside a compact grid); store error/loading/global-error (inline literals only in `global-error`). Lanes A6, A7.
**Compact:** web-shell inspector (pilot A9, Change Review flagship), umbrella `/editor` dock and `/admin/ledger` (A6), desktop chrome and docks (A10; comfortable + compact per pinned `DENSITY`).

## Direction contract

THESIS: The frame as an instrument. Change Review in its densest honest form: status plate first, one row per edit, consequence, one recovery sentence, actions, then digests and the exact diff. It refuses the category default of a git red/green diff, toasts for outcomes, and colour-only status pills.

OWN-WORLD: Same materials as Persuade without spectacle: iron mast (52px compact), raised-iron decision block, well inputs with `--edge` boundaries, enamel primary, plate-face state plates with label + icon, mono only for pointers, digests and codes. Web shell and desktop follow the system light/dark scheme; light re-binds the same token names (`--iron`, `--panel`, `--ink`, `--edge`, `--enamel`/`--on-enamel`, `--focus`, `--disabled-ink`, `--route`, `--refused-lamp` …; values in `DESIGN.md` `*-light` keys).

STORY: The operator proposes an edit, reads exactly what will be written where, and commits or rejects. A refusal names its code verbatim and the way forward. An unknown outcome offers "Resolve pending apply" and never retries Accept.

FIRST VIEWPORT (inspector, 390×844): after Propose, the status plate and the first complete WHERE / BEFORE / AFTER row are visible without manual scroll; focus is on the review heading (`tabindex=-1`); Accept is ≤ 5 Tab stops away; the status is announced first.

FORM: Change Review rows + compact interlock (the only form; no alternative was ranked for Operate). Seed key: `concept-a-interlocking` (G2 lock; no impeccable roll was run for this lock).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Dialect rules

| | Comfortable | Compact |
|---|---|---|
| Body (`--density-body`) | 16px / 1.55 | 14px / 1.45 |
| Controls (`--density-control`) | 44px | 28px tall, target ≥ 24×24 |
| Button padding (`--density-button-pad`) | 22px | 12px |
| Interlock (`--density-pad-block` / `-inline`, `--density-title`, `--density-evidence`) | 24/32 padding, lever drawn, 24px plate-face title, 14px evidence | 12/14 padding, no lever, 16px prose title inline with plate, 13px mono evidence |
| Gaps (`--density-gap`) | 16px | 8px |

- **Placement Rule:** density comes from where the component sits, never from a global `.state` class.
- Motion: none ambient; plates switch instantly (`--state` 0ms). The lever is never drawn in compact.
- Refusal text on dark: `--refused-lamp` only on iron/raised/well (≥ 6.19), `--refused-lamp-hi` on panel (5.62). `#FF4D5E` is retired, including `:user-invalid`. Light re-binds both to 5.77–7.06.
- BEFORE strike: stale on dark, ink-2 on light. Never red.
- Disabled: `--iron-raised` fill, `--disabled-ink` text (pair 7.85 dark, 6.92 light; light must stay ≥ 5.74, the baseline), dashed `--edge` border, `not-allowed`.
- Web shell: keep every id (`edit`, `documentPath`, `jsonPointer`, `newValue`, `propose`, `accept`, `reject`, `recover`, `reconcile`, `review-help`, `phase`, `note`, `diff`, `rows`, `consequence`, `digests`, `decision`), `data-action` hooks and CSP `default-src 'none'` (system font fallbacks are the reviewed design). `[hidden]` rule is page-local.
- Desktop: never scales, does not import site-kit; tokens copied to `apps/desktop-shell/src/visual-tokens.ts`; `main.ts` `backgroundColor` → `#1E2B28`; `opacity:` only inside keyframes; packaged Linux Electron must launch in the new chrome.
- `/admin/ledger`: right-aligned tabular figures.
