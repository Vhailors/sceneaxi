/**
 * The umbrella's token layer: SceneAxi Foundations v2, consumed from `@sceneaxi/site-kit`.
 *
 * D2 of the Step 12 visual decisions puts the shared site token and component layer in
 * `packages/site-kit`, so this site *emits* that package's sheet rather than keeping a
 * second copy of the same values. `globals.css` below it holds composition only — no
 * palette, no scale, no surface ladder — which is why it contains no colour literal
 * outside the small recorded-gap block this module owns.
 *
 * Three things live here rather than in the stylesheet, and all three are derived from
 * site-kit data rather than written down:
 *
 *   1. `foundationsCss({ surface: "umbrella" })` — the shared sheet verbatim, with the
 *      per-site accent resolved through site-kit's own refusing resolver.
 *   2. Status custom properties, projected from `FOUNDATION_STATUSES`. The published
 *      vocabulary ships as `.sx-status-*` classes; the umbrella's named-state panels are
 *      larger surfaces than a chip, so they read the same three colours as variables.
 *      No hex is repeated — a status colour changed in site-kit changes here.
 *   3. The two recorded gaps: the marketing band fill and the storefront accent's
 *      line/fill pair. `docs/design-foundations.md` records that the Foundations sheet
 *      prints neither, so they are stated once, here, as umbrella-local decisions rather
 *      than smuggled in as if the archive had specified them.
 *
 * Pure TypeScript on purpose: `src/lib/**` is type-checked and tested by the hermetic
 * gate, so the token layer is proven without a browser or a framework.
 */
import {
  FOUNDATION_STATUSES,
  foundationsCss,
  ok,
  type SiteResult,
} from "@sceneaxi/site-kit";

/** The Foundations §06 surface whose accent this site themes with. */
export const UMBRELLA_SURFACE = "umbrella" as const;

/**
 * Layout metrics. These are composition, not palette: the Foundations sheet fixes the
 * 4px spacing scale (which `foundationsCss()` emits) and says nothing about how wide
 * this particular site's shell is.
 */
export const UMBRELLA_METRICS = Object.freeze({
  shell: "1280px",
  gutter: "32px",
  bandPad: "104px",
  mastheadHeight: "60px",
});

/**
 * Visual facts the accepted Foundations sheet does not state.
 *
 * Every entry is a decision this site is making, listed so a reviewer can see the whole
 * set at once instead of finding hexes scattered through a stylesheet. Nothing may be
 * added here that the archive *does* state — that value belongs in site-kit.
 */
export const UMBRELLA_RECORDED_GAPS: readonly {
  readonly token: string;
  readonly value: string;
  readonly gap: string;
}[] = Object.freeze([
  Object.freeze({
    token: "--bg-band",
    value: "#090B0E",
    gap: "Foundations prints six neutral fills for editor chrome and none for an alternating full-bleed marketing band. This sits between --bg-base and --bg-panel so a band reads as a band without becoming a panel.",
  }),
  Object.freeze({
    token: "--store-web-line",
    value: "#1D4A52",
    gap: "Foundations fixes the storefront accents but prints a line/fill pair only for the six status colours. docs/design-foundations.md already records the storefront gap.",
  }),
  Object.freeze({
    token: "--store-web-bg",
    value: "#0C2226",
    gap: "The fill half of the same recorded gap.",
  }),
]);

/** Status custom properties, projected from site-kit's published status vocabulary. */
export function umbrellaStatusVariablesCss(): string {
  const lines = FOUNDATION_STATUSES.flatMap((status) => [
    `  --status-${status.id}-fg: ${status.fg};`,
    `  --status-${status.id}-bg: ${status.bg};`,
    `  --status-${status.id}-line: ${status.line};`,
  ]);
  return `:root {\n${lines.join("\n")}\n}\n`;
}

/**
 * The umbrella-local block: metrics, the recorded gaps, and the font chain.
 *
 * `--sans` and `--mono` *extend* site-kit's `--font-ui` / `--font-mono` rather than
 * replacing them: `next/font` self-hosts Archivo and JetBrains Mono from this origin, so
 * the local faces come first and the shared stacks are the fallback. Neither shared
 * token is redefined, so this block and site-kit's cannot disagree about the family —
 * only about which copy of it loads first.
 */
export function umbrellaLocalVariablesCss(): string {
  const gaps = UMBRELLA_RECORDED_GAPS.map((entry) => `  ${entry.token}: ${entry.value};`);
  return [
    ":root {",
    "  color-scheme: dark;",
    `  --shell: ${UMBRELLA_METRICS.shell};`,
    `  --gutter: ${UMBRELLA_METRICS.gutter};`,
    `  --band-pad: ${UMBRELLA_METRICS.bandPad};`,
    `  --masthead-h: ${UMBRELLA_METRICS.mastheadHeight};`,
    ...gaps,
    "  --sans: var(--font-archivo), var(--font-ui);",
    "  --mono: var(--font-jetbrains), var(--font-mono);",
    "}",
    "",
  ].join("\n");
}

/**
 * The whole token layer this site serves, in cascade order.
 *
 * Fail-closed: an unresolvable surface accent refuses by site-kit's name rather than
 * silently falling back to an unthemed sheet. The root layout turns that refusal into a
 * render failure, because a page whose token layer refused is not a page this site may
 * serve with its palette quietly missing.
 */
export function umbrellaFoundationsCss(): SiteResult<string> {
  const shared = foundationsCss({ surface: UMBRELLA_SURFACE });
  if (!shared.ok) return shared;
  return ok(
    [
      shared.value,
      "/* Status vocabulary, projected from @sceneaxi/site-kit FOUNDATION_STATUSES. */",
      umbrellaStatusVariablesCss(),
      "/* Umbrella-local: layout metrics, recorded Foundations gaps, self-hosted faces. */",
      umbrellaLocalVariablesCss(),
    ].join("\n"),
  );
}
