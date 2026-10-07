# Surface brief: Persuade dialect

Mode brief for the v6 "Interlocking" world. World tokens and rules: `DESIGN.md` (keys = the properties `signalCss()` emits in `packages/site-kit/src/design-tokens.ts`). Source of truth: `docs/redesign-v6/DIRECTION.md` §3, §7, §10.

**Tokens:** `signalCss()` (default `scheme: "dark"`; Persuade is dark only). Stores add `signalCss({ store: "forge" | "vitrine" })`. Classes: `.sx-btn` (+ `data-variant="quiet"`), `.sx-plate[data-state]` + `.sx-icon`, `.sx-interlock[data-density="comfortable"]`. Never build on the legacy `foundationsCss()` sheet (`--accent`, `--bg-*`, `--fg-*`).

**Surfaces:** umbrella `/`, `/engine`, `/profiles`, `/pricing` (top), `/open` (chrome only; the WebGL canvas leads), `/docs/**` (reading measure 65–75ch); store home `/`, store `/item/[itemId]` (page; the acquire block is Operate comfortable), `/publish`.
**Lanes:** pilot A6 (umbrella `/`), A6 (other umbrella routes), A7 (both stores, one agent).

## Direction contract

THESIS: The hero is the product's own Change Review, static and server-rendered: a route set, read as WHERE / BEFORE / AFTER, committed by one lever throw. It refuses the category default of a dark hero with a neon accent, a 3D render, and a feature-card grid below.

OWN-WORLD: Matte slate-green panel (`--panel`), cast-iron frames (`--iron`), cream enamel plates and the primary button (`--enamel` / `--on-enamel`), the condensed plate face at 56→96px, 2px cast corners, saturation only in the four state paints with label + icon. No glass, glow, gradient or blur.

STORY: The visitor sees that SceneAxi proposes a change, shows the exact difference, and writes only on Accept, with the consequence and recovery named. They believe the source stays theirs ("Build scenes. / Keep the source.") and they Download.

FIRST VIEWPORT: Iron mast (wordmark, nav, Download always visible; Menu disclosure below an em width). H1 "Build scenes. / Keep the source." in the plate face, EARLY ACCESS plate, lede (`p.il-lede`, the mobile LCP element, 34ch), Download primary. Beside it at ≥ 960px, below it at 390: the `scene.json · PENDING REVIEW` demo with status plate and the first complete row inside 390×844. Demo digests are labelled synthetic.

FORM: Static Change Review hero (first on the ordered list: static review > 3D diorama, which is deferred and must prove 60fps, LCP < 2.5s and ship this hero as fallback). Seed key: `concept-a-interlocking` (G2 lock, `docs/redesign-v6/RULINGS.md`; no impeccable roll was run for this lock).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Dialect rules

- Scale: display 56→96px (`--t-display`), sections 72–112px (`--sp-72`/`--sp-112`), wrap 1320px, buttons at comfortable density (`--density-control` 44px).
- Motion: one detented throw in the hero, once per commit, only with `[data-armed]` and motion allowed (`--catch` 90ms → `--throw` 260ms `--ease-throw` → `--lamp` 360ms `--lamp-steps` steps(6) → `--settle` 420ms). Reduced motion: the token block zeroes every duration; final state in place.
- Refusals on Persuade pages use the **comfortable** interlock (24/32 padding, lever drawn, 24px title). Stop red never sits bare on `--panel`.
- Stores: the digest figure ("not a render") leads the item page; TEST plate in the first viewport of store home; `catalog-game` and `catalog-web` CSS differ only in the `[data-store]` block (`--store-plate`, `--store-mark-radius`). Tagline copy from data.
- Evidence tables (`/engine`, `/profiles`, `/pricing` capability table) sit in focusable scrollers. Kids appears only as an *Isolated* plate with no link.
- Copy: product claims with their limits shown as plates. Real product copy only. No eyebrows, no icon-card grids, no hero metrics.

## Acceptance (from the task)

Contrast ≥ 4.5 text / 3 UI in default, hover, focus, active, disabled (browser-computed with `~/Documents/Reports/sceneaxi-redesign-v6/baseline/_work/lib.mjs`); axe 0 serious/critical; nav reachable at 1280@200% and 320px with no overflow-x; mobile LCP < 2.5s, CLS < 0.1, TBT ≤ 2,015ms (pilot gate), 3-run median at load < 4; umbrella CSS ≤ 76,082 B, stores ≤ 40,508 / 40,525 B.
