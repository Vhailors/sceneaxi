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
  signalCss,
  type FoundationSurfaceAccentId,
  type SignalStoreId,
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
  const signal = storefrontSignalLayersCss(surface);

  if (!signal.ok) return signal;

  return ok(
    [
      sheet.value,
      foundationsStatusVariablesCss(),
      "/* v6 Interlocking layer (A-rich), from @sceneaxi/site-kit signalCss(): tokens, components, utilities. */",
      signal.value,
    ].join("\n"),
  );
}

/** The site-kit store plate each storefront surface paints its mark with (DIRECTION §8). */
export function signalStoreFor(surface: StorefrontSurface): SignalStoreId {
  return surface === "game-assets" ? "forge" : "vitrine";
}

/**
 * The v6 signal layer, minus `reset` and `base`: those restyle every element, and the
 * storefront's own sheet still owns its element rules. Same cut as the umbrella pilot
 * (`sites/umbrella/src/lib/foundations.ts`), so a redesigned rule opts in by class and
 * every token here is inert until a rule reads it. The store plate block is scoped to
 * `[data-store]`, which the layout sets on `<html>`.
 */
export function storefrontSignalLayersCss(surface: StorefrontSurface): SiteResult<string> {
  const sheet = signalCss({ scheme: "dark", store: signalStoreFor(surface) });

  if (!sheet.ok) return sheet;
  const kept: string[] = [];

  for (const layer of ["tokens", "components", "utilities"] as const) {
    const block = cascadeLayerBlock(sheet.value, layer);

    if (block === null) throw new Error(`site-kit signalCss() emitted no @layer ${layer} block`);
    kept.push(block);
  }

  return ok(kept.join("\n"));
}

/** One `@layer name { ... }` block, matched by brace depth so nested rules stay whole. */
function cascadeLayerBlock(css: string, layer: string): string | null {
  const start = css.indexOf(`@layer ${layer} {`);

  if (start === -1) return null;
  let depth = 0;

  for (let index = css.indexOf("{", start); index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;

    if (css[index] === "}") {
      depth -= 1;

      if (depth === 0) return css.slice(start, index + 1);
    }
  }

  return null;
}
