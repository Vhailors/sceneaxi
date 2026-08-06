/**
 * The Foundations v2 stylesheet this storefront serves, sourced from `@sceneaxi/site-kit`.
 *
 * The token layer has exactly one home (captain decision D2, 2026-07-28):
 * `packages/site-kit` owns the transcribed Foundations v2 palette, scale, surfaces and
 * status vocabulary, and every site consumes its emitters. Nothing in this file states a
 * colour, a size, or a radius — `globals.css` below it declares only what this storefront
 * itself owns: the per-store accent derivations marked STORE IDENTITY and the layout
 * measures. There is no second copy of a Foundations value in the `sites/` tier.
 *
 * `foundationsCss({ surface })` is also where Foundations §06's "accent shifts only" is
 * implemented, so the storefront accent is an argument rather than a redeclaration.
 *
 * This module is pure TypeScript, like every other `src/lib/` module: it produces CSS
 * *text*, and `src/app/layout.tsx` is the only place that puts it in a document.
 */
import {
  FOUNDATION_STATUSES,
  foundationsCss,
  ok,
  type FoundationSurfaceAccentId,
  type SiteResult,
} from "@sceneaxi/site-kit";

/**
 * The two surface accents a storefront may theme with.
 *
 * Narrowed from the full accent map on purpose: `umbrella`, `engine-*` and `kids` are
 * other surfaces' themes, and `foundationsCss({ surface: "kids" })` refuses by name
 * anyway. Narrowing here means a wrong id is a type error rather than a runtime refusal.
 */
export type StorefrontSurface = Extract<
  FoundationSurfaceAccentId,
  "game-assets" | "web-assets"
>;

/**
 * The status vocabulary as custom properties.
 *
 * Foundations §04 publishes six status chips as a colour triple each, and site-kit emits
 * them as `.sx-status-*` classes. A storefront also needs those triples on surfaces that
 * are not chips — the TEST purchase notice, the listing record, the availability rail —
 * so they are re-projected here as variables. Every value is read out of
 * `FOUNDATION_STATUSES`; this function contains no hex of its own, which is what keeps
 * "one source for a token" true even for the derived form.
 */
export function foundationsStatusVariablesCss(): string {
  const lines = FOUNDATION_STATUSES.flatMap((status) => [
    `  --status-${status.id}-fg: ${status.fg};`,
    `  --status-${status.id}-bg: ${status.bg};`,
    `  --status-${status.id}-line: ${status.line};`,
  ]);
  return `:root {\n${lines.join("\n")}\n}\n`;
}

/**
 * The complete shared stylesheet for one storefront, or the named refusal to render.
 *
 * Fail-closed: an unresolvable surface returns the refusal rather than an unthemed
 * fallback, because a storefront painted in the product accent would be a different
 * store than the one it claims to be.
 */
export function foundationsStylesheet(surface: StorefrontSurface): SiteResult<string> {
  const sheet = foundationsCss({ surface });
  if (!sheet.ok) return sheet;
  return ok(`${sheet.value}\n${foundationsStatusVariablesCss()}`);
}
