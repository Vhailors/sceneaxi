/**
 * The two Asset Storefronts, as implemented from the accepted design archive.
 *
 * These live under `tests/` for the same reason the other site suites do: the sites are
 * separate single-package workspaces outside the repository-root workspace, so their
 * seams are imported by path rather than by public package name.
 *
 * What is asserted here is what the design's own words demand and what the archive got
 * wrong. The design says *"same skeleton, different accent and merchandising"*, so the
 * shared stylesheet and the shared modules are held byte-identical and only the store
 * identity block may differ. The archive is measurably not responsive (`scrollWidth 984`
 * against `innerWidth 390`), pairs 8.5px type with a 2.1:1 colour, animates with no
 * reduced-motion alternative, and merchandises invented digests, download counts and a
 * cart — so each of those is a case below rather than a promise in a comment.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FOUNDATION_COLORS,
  FOUNDATION_STATUSES,
  listSiteCatalog,
  resolveSurfaceAccent,
} from "@sceneaxi/site-kit";
import * as game from "../../sites/catalog-game/src/index.ts";
import * as web from "../../sites/catalog-web/src/index.ts";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const siteDir = (site: string): string => join(REPO_ROOT, "sites", site);
const readSite = (site: string, relative: string): string =>
  readFileSync(join(siteDir(site), relative), "utf8");

const STOREFRONTS = ["catalog-game", "catalog-web"] as const;

const IDENTITY_OPEN =
  "/* --- STORE IDENTITY — the only block that differs between the two storefronts --- */";
const IDENTITY_CLOSE = "/* --- END STORE IDENTITY --- */";

const css = Object.freeze({
  "catalog-game": readSite("catalog-game", "src/app/globals.css"),
  "catalog-web": readSite("catalog-web", "src/app/globals.css"),
});

/** The stylesheet below the store identity block — the part that must not diverge. */
function sharedSkeleton(text: string): string {
  const end = text.indexOf(IDENTITY_CLOSE);
  expect(end).toBeGreaterThan(-1);
  return text.slice(end + IDENTITY_CLOSE.length);
}

function identityBlock(text: string): string {
  const start = text.indexOf(IDENTITY_OPEN);
  const end = text.indexOf(IDENTITY_CLOSE);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return text.slice(start, end);
}

/**
 * Source with its comments removed.
 *
 * Every scan below asks what the storefront *ships*, and these files explain at length
 * which parts of the archive were deliberately left out — so scanning the raw text would
 * find "Add to cart" in the comment that says there is no Add to cart. Block comments go
 * entirely; a line comment is only recognised when it starts the line, so a `https://`
 * inside an expression survives.
 */
const stripComments = (text: string): string =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => (line.trimStart().startsWith("//") ? "" : line))
    .join("\n");

/**
 * Every colour literal in a stylesheet, in any notation, normalised to `#rrggbb`.
 *
 * `rgba(7, 8, 10, 0.9)` is the same copy of `--bg-base` that `#07080a` would be, so a
 * scan that reads only hexes leaves the functional notation open as the way a palette
 * value comes back. Both spellings are decoded here before anything is compared, and
 * alpha is dropped on purpose: a translucent overlay of a Foundations colour is still
 * that colour, and it still goes stale when site-kit moves the token.
 */
function colorLiterals(text: string): readonly string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const digits = match[0].slice(1).toLowerCase();
    const rgb =
      digits.length <= 4
        ? [...digits.slice(0, 3)].map((digit) => `${digit}${digit}`).join("")
        : digits.slice(0, 6);
    found.push(`#${rgb}`);
  }
  for (const match of text.matchAll(/rgba?\(([^)]*)\)/gi)) {
    const channels = (match[1] as string)
      .split(/[\s,/]+/)
      .filter((part) => part.length > 0)
      .slice(0, 3)
      .map((part) =>
        part.endsWith("%")
          ? Math.round((Number.parseFloat(part) / 100) * 255)
          : Number.parseInt(part, 10),
      );
    if (channels.length !== 3 || channels.some((channel) => !Number.isInteger(channel))) {
      continue;
    }
    found.push(`#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`);
  }
  return found;
}

/** `--token: value;` declarations, last one wins, the way the cascade reads them. */
function cssTokens(text: string): Readonly<Record<string, string>> {
  const tokens: Record<string, string> = {};
  for (const match of text.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1] as string] = (match[2] as string).trim();
  }
  return tokens;
}

/**
 * Everything one selector is declared to be in a stretch of stylesheet, as a property map.
 *
 * Parsed rather than string-matched so an assertion is about the declaration a browser
 * ends up with: grouped selectors count, a later rule wins, and reformatting the source
 * cannot turn a held property into a failure.
 */
function declarationsFor(text: string, selector: string): Readonly<Record<string, string>> {
  const declarations: Record<string, string> = {};
  for (const rule of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (rule[1] as string).split(",").map((part) => part.trim());
    if (!selectors.includes(selector)) continue;
    for (const declaration of (rule[2] as string).split(";")) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      declarations[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
    }
  }
  return declarations;
}

const relativeLuminance = (raw: string): number => {
  const hex = raw.toLowerCase();
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

/** WCAG 2.1 contrast ratio for two `#rrggbb` values. */
const contrastRatio = (a: string, b: string): number => {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const [high, low] = first > second ? [first, second] : [second, first];
  return (high + 0.05) / (low + 0.05);
};

/** Every committed source file under a site's `src`, discovered rather than listed. */
function collectSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) collectSources(path, out);
    else out.push(path);
  }
  return out;
}

const sourcesFor = (site: string): readonly { path: string; text: string }[] =>
  collectSources(join(siteDir(site), "src")).map((path) => ({
    path,
    text: stripComments(readFileSync(path, "utf8")),
  }));

/** The shared component directory AGENTS.md holds identical, read rather than listed. */
const componentFiles = (site: string): readonly string[] =>
  readdirSync(join(siteDir(site), "src/app/_components")).sort();

/** Every shared module a storefront could paint a colour from, with its site path. */
const sharedModules = (site: string): readonly { relative: string; text: string }[] =>
  collectSources(join(siteDir(site), "src/lib")).map((path) => ({
    relative: relative(siteDir(site), path),
    text: readFileSync(path, "utf8"),
  }));

describe("the two storefronts share one skeleton and differ only in store identity", () => {
  it("keeps every rule below the store identity block byte-identical", () => {
    expect(sharedSkeleton(css["catalog-web"])).toBe(sharedSkeleton(css["catalog-game"]));
  });

  it("gives each store its own identity block", () => {
    expect(identityBlock(css["catalog-web"])).not.toBe(identityBlock(css["catalog-game"]));
  });

  it("names a Foundations surface instead of restating an accent", () => {
    expect(game.CATALOG_SITE_FOUNDATION_SURFACE).toBe("game-assets");
    expect(web.CATALOG_SITE_FOUNDATION_SURFACE).toBe("web-assets");
    // The accent the sites resolve is the one the sheet assigns to that surface.
    expect(resolveSurfaceAccent("game-assets")).toMatchObject({
      ok: true,
      value: { accent: "#E8544E" },
    });
    expect(resolveSurfaceAccent("web-assets")).toMatchObject({
      ok: true,
      value: { accent: "#3FB8C9" },
    });
  });

  // The mark is a shape, not a colour: the archive states it and Foundations does not, so
  // it stays a per-store fact and the stylesheet and the seam are held in lockstep on it.
  it("holds the store mark in lockstep between the stylesheet and the seam", () => {
    for (const [site, brand] of [
      ["catalog-game", game.CATALOG_SITE_BRAND],
      ["catalog-web", web.CATALOG_SITE_BRAND],
    ] as const) {
      expect(cssTokens(identityBlock(css[site]))["--mark-radius"]).toBe(brand.markRadius);
    }
  });

  it("keeps the two stores distinct in surface, mark, and merchandising vocabulary", () => {
    expect(game.CATALOG_SITE_FOUNDATION_SURFACE).not.toBe(
      web.CATALOG_SITE_FOUNDATION_SURFACE,
    );
    expect(game.CATALOG_SITE_BRAND.markRadius).not.toBe(web.CATALOG_SITE_BRAND.markRadius);
    expect(game.CATALOG_SITE_BRAND.catalogueWord).not.toBe(
      web.CATALOG_SITE_BRAND.catalogueWord,
    );
    expect(game.CATALOG_SITE_BRAND.heroKicker).not.toBe(web.CATALOG_SITE_BRAND.heroKicker);
  });

  it("holds the same component files on both storefronts", () => {
    // The identity claim is about the whole directory, so the directory *listings* are
    // compared before the bytes are: a component added to one store and not the other
    // would otherwise be a file no case below happens to name.
    expect(componentFiles("catalog-web")).toEqual(componentFiles("catalog-game"));
  });

  it.each([
    "src/lib/family-bar.ts",
    "src/lib/digest-sigil.ts",
    "src/lib/catalog-facts.ts",
    "src/lib/foundations.ts",
    ...componentFiles("catalog-game").map((entry) => `src/app/_components/${entry}`),
  ])("keeps %s identical on both storefronts", (relative) => {
    expect(readSite("catalog-web", relative)).toBe(readSite("catalog-game", relative));
  });
});

/**
 * Captain decision D2 (2026-07-28): the shared token layer lives in `packages/site-kit`.
 *
 * The point of these cases is that a storefront cannot go back to carrying its own copy.
 * They assert the negative — no Foundations token is declared in a site — and the
 * positive — the site serves site-kit's emitter and every colour it paints with is one the
 * shared layer publishes.
 */
describe("the token layer comes from site-kit and is not copied into either site", () => {
  /** Every token name `foundationsCss()` publishes, so a redeclaration is detectable. */
  const FOUNDATION_TOKEN_NAMES = new Set<string>([
    ...FOUNDATION_COLORS.map((color) => color.token),
    "--font-ui",
    "--font-mono",
    "--radius-xs",
    "--radius-sm",
    "--radius-md",
    "--radius-lg",
    "--radius-xl",
    "--radius-full",
  ]);

  it.each(STOREFRONTS)("%s declares no Foundations v2 token of its own", (site) => {
    const redeclared = Object.keys(cssTokens(stripComments(css[site]))).filter((token) =>
      FOUNDATION_TOKEN_NAMES.has(token),
    );
    expect(redeclared).toEqual([]);
  });

  it.each(STOREFRONTS)("%s ships no Foundations colour as a literal, in any notation", (site) => {
    // The palette values may appear in exactly one place in the repository. A site that
    // pastes `#07080a` back in has recreated the duplication D2 removed, even if it also
    // consumes the emitter — and so has one that writes the same colour as
    // `rgba(7, 8, 10, 0.9)`, which is why the scan decodes rather than string-matches.
    //
    // The stylesheet is not the only place a palette value fits. A `src/lib` module that
    // hardcodes an accent paints the same pixels and goes stale the same way, with the
    // added reach of being a *seam* export, so every shared module is scanned here too.
    const scanned: readonly (readonly [string, string])[] = [
      ["src/app/globals.css", css[site]] as const,
      ...sharedModules(site).map((module) => [module.relative, module.text] as const),
    ];
    const offenders = scanned.flatMap(([path, text]) => {
      const shipped = new Set(colorLiterals(stripComments(text)));
      return FOUNDATION_COLORS.filter((color) => shipped.has(color.hex.toLowerCase())).map(
        (color) => `${path}: ${color.hex}`,
      );
    });
    expect(offenders).toEqual([]);
  });

  it.each(STOREFRONTS)("%s serves site-kit's emitted sheet from its layout", (site) => {
    const layout = readSite(site, "src/app/layout.tsx");
    expect(layout).toContain("foundationsStylesheet");
    expect(layout).toContain("CATALOG_SITE_FOUNDATION_SURFACE");
    // Fail-closed: a refusal must not fall through to an unthemed render.
    expect(layout).toContain("foundations.ok");
  });

  it.each([
    ["catalog-game", "game-assets"],
    ["catalog-web", "web-assets"],
  ] as const)("%s composes the sheet for its own surface", (site, surface) => {
    const seam = site === "catalog-game" ? game : web;
    const sheet = seam.foundationsStylesheet(surface);
    expect(sheet.ok).toBe(true);
    if (!sheet.ok) return;
    const accent = resolveSurfaceAccent(surface);
    expect(accent.ok).toBe(true);
    if (!accent.ok) return;
    expect(cssTokens(sheet.value)["--accent"]).toBe(accent.value.accent);
    // Every status triple is projected, and none of them is written by the site.
    for (const status of FOUNDATION_STATUSES) {
      expect(sheet.value).toContain(`--status-${status.id}-fg: ${status.fg};`);
      expect(sheet.value).toContain(`--status-${status.id}-bg: ${status.bg};`);
      expect(sheet.value).toContain(`--status-${status.id}-line: ${status.line};`);
    }
  });

  it("refuses a surface outside the storefront pair rather than theming it", () => {
    // `kids` and an unknown id are the two ways this can be wrong, and both refuse in
    // site-kit. The storefront type narrows them out, so this asserts the runtime floor.
    expect(
      game.foundationsStylesheet("kids" as unknown as game.StorefrontSurface),
    ).toMatchObject({ ok: false, reason: "KIDS_SURFACE_DENIED" });
    expect(
      game.foundationsStylesheet("nope" as unknown as game.StorefrontSurface),
    ).toMatchObject({ ok: false, reason: "FOUNDATION_SURFACE_UNKNOWN" });
  });

  /**
   * The only hexes the shared skeleton may still write, each with its reason.
   *
   * A literal is allowed only where the Foundations sheet publishes no token for what is
   * being painted. Every one of these is transcribed from the Asset Storefronts screen or
   * is a pure-black shadow, and none of them is a Foundations colour — that is asserted
   * separately, so this list cannot be used to smuggle a palette value back in.
   */
  const ALLOWED_LITERALS: Readonly<Record<string, string>> = Object.freeze({
    "#0a0c0e": "the family bar's own bar fill, between --bg-base and --bg-panel",
    "#191e25": "the top stop of the digest sigil's radial wash",
    "#000000": "a pure-black drop shadow under the sigil chip, not a surface colour",
    "#ffffff": "the sigil grid rule and the button's inner top highlight, both at low alpha",
  });

  it.each(STOREFRONTS)("%s writes a colour literal only where no token exists", (site) => {
    // Normalised the same way as the Foundations scan above, so a value cannot escape
    // this list by being spelled `rgba(...)` or as a three-digit hex.
    const literals = colorLiterals(stripComments(sharedSkeleton(css[site])));
    const unexplained = [...new Set(literals)].filter((hex) => !(hex in ALLOWED_LITERALS));
    expect(unexplained).toEqual([]);
  });
});

describe("the storefronts are responsive, which the archive is not", () => {
  it.each(STOREFRONTS)("%s declares mobile-first breakpoints only", (site) => {
    expect(css[site]).toContain("@media (min-width: 48rem)");
    expect(css[site]).toContain("@media (min-width: 64rem)");
    // A max-width query would mean the wide layout is the default and the narrow one an
    // exception, which is how the archive's fixed grids overflow a phone in the first place.
    expect(css[site]).not.toMatch(/@media[^{]*max-width/);
  });

  it.each(STOREFRONTS)("%s never masks horizontal overflow", (site) => {
    expect(stripComments(css[site])).not.toMatch(/overflow-x:\s*hidden/);
  });

  it.each(STOREFRONTS)("%s ships no unconditional fixed-column grid", (site) => {
    // The archive's browse grid is `repeat(4,1fr)` and its thumb strip `repeat(5,1fr)`,
    // declared once with no narrow alternative. Every fixed track count here must be
    // auto-sizing, and the one fixed pixel column must sit inside a breakpoint.
    expect(css[site]).not.toMatch(/grid-template-columns:\s*repeat\(\s*\d/);
    const desktop = css[site].slice(css[site].indexOf("@media (min-width: 64rem)"));
    expect(desktop).toContain("216px minmax(0, 1fr)");
    expect(css[site].slice(0, css[site].indexOf("@media (min-width: 48rem)"))).not.toContain(
      "216px",
    );
  });

  /**
   * A sticky column may not be taller than the space it pins into.
   *
   * Once a sticky box reaches its offset it stops moving with the page, so any part of it
   * below the viewport edge is unreachable however far the document scrolls — at a 768px
   * desktop height the detail column loses the end of the commerce notice and all of
   * "Works with", and the missing-editor-link state adds a refusal panel above them. Being
   * bounded and scrolling internally are one repair: a `max-height` with no `overflow-y`
   * clips the tail outright instead, so the pair is asserted together, per column, per
   * store — and both are expressed against the same offset token as `top`, so the height
   * cannot be left behind when the offset moves.
   */
  it.each(STOREFRONTS)("%s bounds each sticky column instead of clipping it", (site) => {
    const desktop = stripComments(css[site]).slice(
      stripComments(css[site]).indexOf("@media (min-width: 64rem)"),
    );
    const offset = "var(--sticky-top)";
    expect(cssTokens(css[site])["--sticky-top"]).toBe("5.5rem");
    for (const selector of [".rail", ".detail-side"]) {
      const rule = declarationsFor(desktop, selector);
      expect(rule["position"], `${selector} keeps the archive's sticky column`).toBe("sticky");
      expect(rule["top"], `${selector} pins below the masthead`).toBe(offset);
      expect(rule["max-height"], `${selector} is bounded by the viewport`).toContain("dvh");
      expect(rule["max-height"], `${selector} is bounded by the same offset it pins at`).toContain(
        offset,
      );
      expect(rule["overflow-y"], `${selector} scrolls inside itself`).toBe("auto");
    }
  });

  it.each(STOREFRONTS)("%s keeps each bounded column reachable from the keyboard", (site) => {
    // Neither column ends in a focusable element, so an inner scroll that only a pointer
    // can move would put the same content out of reach for a keyboard. A tab stop is only
    // legible once the thing it lands on is a named region: focus on a nameless generic
    // container is the case a screen reader answers by reading the whole subtree out. So
    // the stop, the role and the name are asserted together, per column, per store — the
    // rail carries its own role as an <aside>, the detail column has to declare one. The
    // rail's name is store copy ("catalogue" / "showroom"), so it is asserted as present
    // and non-empty rather than as one string.
    expect(readSite(site, "src/app/page.tsx")).toMatch(
      /<aside\s+className="rail"[^>]*aria-label="[^"]+"[^>]*tabIndex=\{0\}/,
    );
    const detail = readSite(site, "src/app/item/[itemId]/page.tsx");
    expect(detail).toMatch(/className="detail-side"[^>]*tabIndex=\{0\}/);
    expect(detail).toMatch(/className="detail-side"[^>]*role="region"/);
    expect(detail, "the focusable detail column is named, not a nameless blob").toMatch(
      /className="detail-side"[^>]*aria-label="Pricing and listing record"/,
    );
  });

  /**
   * The anchor offset has to clear the masthead it is compensating for, at every width.
   *
   * `.masthead-inner` wraps the nav onto a second row once the storemark and the links stop
   * fitting on one, so the masthead is 102px there against 60px for a single row — while a
   * fragment target scrolls to `y = 0`. An offset pinned at the one-row height puts `#main`,
   * which the skip link is the only way to reach, back underneath it on a phone. So the
   * wrapped height is the default and the one-row value is the widened exception, and the
   * default is asserted against the measured wrapped height rather than against itself.
   */
  it.each(STOREFRONTS)("%s clears a wrapped masthead at every anchor", (site) => {
    const WRAPPED_MASTHEAD_PX = 102;
    expect(declarationsFor(stripComments(css[site]), "html")["scroll-padding-top"]).toBe(
      "var(--sticky-top)",
    );

    const base = css[site].slice(0, css[site].indexOf("@media"));
    const narrow = cssTokens(base)["--sticky-top"] as string;
    expect(narrow, "the narrow default is the wrapped-masthead offset").toMatch(/^[\d.]+rem$/);
    expect(Number.parseFloat(narrow) * 16).toBeGreaterThanOrEqual(WRAPPED_MASTHEAD_PX);

    // ...and released to the one-row offset only where the nav fits, rather than charging
    // every anchor on every viewport space no masthead occupies.
    const oneRow = css[site].slice(
      css[site].indexOf("@media (min-width: 36rem)"),
      css[site].indexOf("@media (min-width: 60rem)"),
    );
    const released = declarationsFor(oneRow, ":root")["--sticky-top"] as string;
    expect(released).toBe("5.5rem");
    expect(Number.parseFloat(released) * 16).toBeLessThan(Number.parseFloat(narrow) * 16);
  });

  /**
   * Recorded prose may not be placed in a track sized for an ordinal.
   *
   * `.record-row` is two tracks below `48rem` with four children, so auto placement puts the
   * curation reason in the 2rem ordinal column, where `overflow-wrap: anywhere` breaks it to
   * a few characters a line. That never widens the document, so the `scrollWidth` probe the
   * README records cannot see it — the placement is asserted here instead, in both
   * directions, since an unreset span would collapse the four-track tablet row the same way.
   */
  it.each(STOREFRONTS)("%s gives the curation reason a full row when narrow", (site) => {
    const sheet = stripComments(css[site]);
    const stacked = sheet.slice(0, sheet.indexOf("@media (min-width: 64rem)"));
    const columns = sheet.slice(sheet.indexOf("@media (min-width: 64rem)"));

    expect(
      declarationsFor(stacked, ".record-row")["grid-template-columns"],
      "the ordinal track stays an ordinal track",
    ).toBe("2rem minmax(0, 1fr)");
    for (const selector of [".record-detail", ".record-at"]) {
      expect(declarationsFor(stacked, selector)["grid-column"], `${selector} takes the row`).toBe(
        "1 / -1",
      );
      expect(
        declarationsFor(columns, selector)["grid-column"],
        `${selector} is a column again once the row has four tracks`,
      ).toBe("auto");
    }
    // The four-column row belongs to the breakpoint that gives it the width, not to the one
    // that halves `.detail-main` around it — at `48rem` the reason's `1fr` track resolves to
    // nothing at all.
    expect(
      declarationsFor(
        sheet.slice(
          sheet.indexOf("@media (min-width: 48rem)"),
          sheet.indexOf("@media (min-width: 64rem)"),
        ),
        ".record-row",
      )["grid-template-columns"],
    ).toBeUndefined();
  });
});

describe("accessibility corrections the archive needs", () => {
  it.each(STOREFRONTS)("%s answers prefers-reduced-motion", (site) => {
    const marker = "@media (prefers-reduced-motion: reduce)";
    expect(css[site]).toContain(marker);
    const block = css[site].slice(css[site].indexOf(marker));
    expect(block).toContain("animation-duration: 0.001ms !important");
    expect(block).toContain("animation-iteration-count: 1 !important");
    // Every animation the sheet defines has to be inside the reach of that override.
    for (const [, name] of css[site].matchAll(/@keyframes\s+([\w-]+)/g)) {
      expect(css[site]).toContain(`animation: ${name as string}`);
    }
  });

  it.each([
    ["catalog-game", "game-assets"],
    ["catalog-web", "web-assets"],
  ] as const)("%s meets 4.5:1 on every shipped text pairing", (site, surface) => {
    // Both halves of every pairing are resolved the way a browser resolves them: the shared
    // tokens out of site-kit's emitted sheet for this surface, the storefront's own
    // derivations out of its identity block. Measuring the sheet the site actually serves
    // is what makes this a contrast check rather than a check of a copied table.
    const seam = site === "catalog-game" ? game : web;
    const sheet = seam.foundationsStylesheet(surface);
    expect(sheet.ok).toBe(true);
    if (!sheet.ok) return;
    const tokens: Record<string, string> = {
      ...cssTokens(sheet.value),
      ...cssTokens(identityBlock(css[site])),
    };
    const pairs: readonly (readonly [string, string])[] = [
      ["--fg", "--bg-base"],
      ["--fg-2", "--bg-base"],
      ["--fg", "--bg-panel"],
      ["--fg-2", "--bg-panel"],
      ["--fg-2", "--bg-raised"],
      ["--fg-2", "--bg-field"],
      ["--fg-2", "--bg-row"],
      ["--fg-2", "--bg-control"],
      ["--ok", "--bg-panel"],
      ["--ok", "--status-validated-bg"],
      ["--status-needs-review-fg", "--status-needs-review-bg"],
      ["--danger", "--status-refused-bg"],
      ["--fg-2", "--status-validated-bg"],
      ["--fg-2", "--status-needs-review-bg"],
      ["--fg-2", "--status-refused-bg"],
      ["--accent", "--bg-base"],
      ["--accent", "--accent-bg"],
      ["--fg-2", "--accent-bg"],
      // The primary button paints base-on-accent, so it is judged the same way.
      ["--bg-base", "--accent"],
    ];
    for (const [fg, bg] of pairs) {
      const foreground = tokens[fg];
      const background = tokens[bg];
      expect(foreground, `${fg} is declared`).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(background, `${bg} is declared`).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(
        contrastRatio(foreground as string, background as string),
        `${fg} on ${bg}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(STOREFRONTS)("%s never paints text with the sub-threshold --fg-4", (site) => {
    // The archive's micro labels are `--fg-4` on a panel, about 2.1:1. site-kit still
    // publishes the token — it is the sheet's disabled/units level — but nothing here may
    // read through it, and the measurement is what keeps it demoted.
    const sheet = game.foundationsStylesheet("game-assets");
    expect(sheet.ok).toBe(true);
    if (!sheet.ok) return;
    const tokens = cssTokens(sheet.value);
    expect(
      contrastRatio(tokens["--fg-4"] as string, tokens["--bg-base"] as string),
    ).toBeLessThan(4.5);
    expect(css[site]).not.toMatch(/color:\s*var\(--fg-4\)/);
  });

  it.each(STOREFRONTS)("%s offers a skip link and a visible focus ring", (site) => {
    expect(css[site]).toContain(":focus-visible");
    expect(css[site]).toContain(".skip-link");
    expect(readSite(site, "src/app/layout.tsx")).toContain('className="skip-link"');
  });

  it.each(STOREFRONTS)("%s keeps micro type at 11px, not the archive's 8.5px", (site) => {
    expect(cssTokens(css[site])["--micro"]).toBe("0.6875rem");
  });
});

describe("the family bar resolves the archive's store switch into two origins", () => {
  const ORIGINS = Object.freeze({
    NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "https://umbrella.vercel.app",
    NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN: "https://game.vercel.app",
    NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN: "https://web.vercel.app",
  });

  it("has no Kids key to configure, so no env can produce a Kids link", () => {
    expect([...game.FAMILY_KEYS]).toEqual(["engine", "catalog-game", "catalog-web"]);
    expect(JSON.stringify(game.FAMILY_DOTS).toLowerCase()).not.toContain("kids");
    const bar = game.resolveFamilyBar(
      { ...ORIGINS, NEXT_PUBLIC_SCENEAXI_KIDS_ORIGIN: "https://kids.vercel.app" },
      "catalog-game",
    );
    expect(JSON.stringify(bar).toLowerCase()).not.toContain("kids");
  });

  it("marks the current store rather than linking it", () => {
    const bar = game.resolveFamilyBar(ORIGINS, "catalog-game");
    const current = bar.find((entry) => entry.current);
    expect(current?.key).toBe("catalog-game");
    expect(current?.href).toBeNull();
    expect(bar.filter((entry) => entry.current)).toHaveLength(1);
    expect(bar.find((entry) => entry.key === "catalog-web")?.href).toBe(
      "https://web.vercel.app",
    );
    expect(bar.find((entry) => entry.key === "engine")?.href).toBe(
      "https://umbrella.vercel.app",
    );
  });

  it("marks the other store current on the other storefront", () => {
    const bar = web.resolveFamilyBar(ORIGINS, "catalog-web");
    expect(bar.find((entry) => entry.current)?.key).toBe("catalog-web");
    expect(bar.find((entry) => entry.key === "catalog-game")?.href).toBe(
      "https://game.vercel.app",
    );
  });

  it("renders an unconfigured or insecure sibling as text instead of a broken link", () => {
    const bar = game.resolveFamilyBar(
      { NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN: "http://insecure.example" },
      "catalog-game",
    );
    expect(bar.every((entry) => entry.href === null)).toBe(true);
  });

  it("prints a domain only for a configured own origin", () => {
    expect(game.resolveStoreDomain(ORIGINS, "catalog-game")).toBe("game.vercel.app");
    expect(web.resolveStoreDomain(ORIGINS, "catalog-web")).toBe("web.vercel.app");
    expect(game.resolveStoreDomain({}, "catalog-game")).toBeNull();
    expect(
      game.resolveStoreDomain(
        { NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN: "http://insecure.example" },
        "catalog-game",
      ),
    ).toBeNull();
  });
});

describe("the card figure is a mark of a real digest, never a fake render", () => {
  const DIGEST = listSiteCatalog("catalog-game")[0]?.item.assetPackage.contentHash as string;

  it("is deterministic for one digest", () => {
    expect(game.digestSigil(DIGEST)).toEqual(game.digestSigil(DIGEST));
  });

  it("differs between the digests the catalogue actually holds", () => {
    const marks = [...listSiteCatalog("catalog-game"), ...listSiteCatalog("catalog-web")].map(
      (listing) => JSON.stringify(game.digestSigil(listing.item.assetPackage.contentHash)),
    );
    expect(new Set(marks).size).toBe(marks.length);
  });

  it("refuses a digest it cannot read rather than defaulting one", () => {
    for (const bad of ["", "not-a-digest", "sha256:", "sha256:zzzz1234", "sha512:abcdef12", "abcdef1234"]) {
      expect(game.digestSigil(bad), bad).toBeNull();
    }
  });

  it("bounds every field, so a hostile digest cannot reshape the layout", () => {
    for (const listing of listSiteCatalog("catalog-game")) {
      const sigil = game.digestSigil(listing.item.assetPackage.contentHash);
      expect(sigil).not.toBeNull();
      expect(sigil?.rotateDeg).toBeGreaterThanOrEqual(-9);
      expect(sigil?.rotateDeg).toBeLessThanOrEqual(9);
      expect(sigil?.widthPercent).toBeGreaterThanOrEqual(40);
      expect(sigil?.widthPercent).toBeLessThanOrEqual(51);
      expect(sigil?.heightPercent).toBeGreaterThanOrEqual(36);
      expect(sigil?.heightPercent).toBeLessThanOrEqual(45);
    }
  });

  it("shortens a real digest and leaves an unreadable one alone", () => {
    expect(game.shortenDigest(DIGEST)).toMatch(/^[0-9a-f]{4}…[0-9a-f]{4}$/);
    expect(game.shortenDigest("not-a-digest")).toBe("not-a-digest");
  });

  it("says on the page that the mark is not a render", () => {
    for (const site of STOREFRONTS) {
      expect(readSite(site, "src/app/page.tsx")).toContain("not a render of the");
    }
  });
});

describe("the rail counts real listings instead of the archive's invented facets", () => {
  it.each(STOREFRONTS)("%s counts only the listings on its own surface", (surface) => {
    const listings = listSiteCatalog(surface);
    const facets = game.catalogFacets(listings);
    expect(facets.length).toBeGreaterThan(0);
    for (const facet of facets) {
      const total = facet.rows.reduce((sum, row) => sum + row.count, 0);
      expect(total).toBeGreaterThanOrEqual(listings.length);
      expect(facet.rows.every((row) => row.count > 0)).toBe(true);
    }
    const licence = facets.find((facet) => facet.title === "Licence");
    expect(licence?.rows.reduce((sum, row) => sum + row.count, 0)).toBe(listings.length);
  });

  it("drops every facet when there is nothing to describe", () => {
    expect(game.catalogFacets([])).toEqual([]);
  });

  it("reads the curation trail off the contract's own history", () => {
    const listing = listSiteCatalog("catalog-game")[0];
    expect(listing).toBeDefined();
    const trail = game.curationTrail((listing as NonNullable<typeof listing>).item);
    expect(trail).toHaveLength(
      (listing as NonNullable<typeof listing>).item.moderation.history.length,
    );
    expect(trail.map((step) => step.ordinal)).toEqual(
      trail.map((_step, index) => String(index + 1).padStart(2, "0")),
    );
    expect(trail.at(-1)?.state).toBe(
      (listing as NonNullable<typeof listing>).item.moderation.pipelineState,
    );
  });

  it("relates only same-creator listings on the same surface, never itself", () => {
    // Fed the two surfaces at once, on purpose: every fixture listing shares one creator,
    // so a list that is already single-surface would prove the fixture rather than the
    // filter, and a caller that merged the catalogues would reach the other store's items
    // through hrefs that only name this one.
    const merged = [...listSiteCatalog("catalog-game"), ...listSiteCatalog("catalog-web")];
    const current = merged[0] as NonNullable<(typeof merged)[number]>;
    expect(current.surface).toBe("catalog-game");
    expect(merged.some((listing) => listing.surface === "catalog-web")).toBe(true);
    const related = game.sameCreatorListings(merged, current);
    expect(related.length).toBeGreaterThan(0);
    expect(related.some((listing) => listing.itemId === current.itemId)).toBe(false);
    expect(related.every((listing) => listing.creatorId === current.creatorId)).toBe(true);
    expect(related.every((listing) => listing.surface === "catalog-game")).toBe(true);
  });
});

describe("commerce stays inert and the archive's merchandising does not ship", () => {
  const ALL_SOURCES = STOREFRONTS.flatMap((site) => sourcesFor(site));

  it.each([
    ["a cart", /\bcarts?\b/i],
    ["a checkout", /checkout/i],
    ["a seller application", /apply as a seller/i],
    ["a refund window", /refund/i],
    ["a download count", /downloads/i],
  ])("ships no %s anywhere in either storefront", (_label, pattern) => {
    const offenders = ALL_SOURCES.filter((source) => pattern.test(source.text)).map(
      (source) => source.path,
    );
    expect(offenders).toEqual([]);
  });

  it.each([
    ["an invented digest", /9f31|a4f2|b7d0|20740/],
    ["an invented price", /\$\d/],
    ["an invented triangle count", /\d+(\.\d+)?k\b\s*(tris|triangles)/i],
  ])("copies no %s out of the archive", (_label, pattern) => {
    const offenders = ALL_SOURCES.filter((source) => pattern.test(source.text)).map(
      (source) => source.path,
    );
    expect(offenders).toEqual([]);
  });

  it("renders the inert-commerce refusal where the design puts its cart button", () => {
    for (const site of STOREFRONTS) {
      const detail = readSite(site, "src/app/item/[itemId]/page.tsx");
      expect(detail).toContain("<CommerceNotice");
      expect(readSite(site, "src/app/_components/commerce-notice.tsx")).toContain(
        "attemptCatalogPurchase",
      );
    }
  });

  it("keeps the detail page's only working action the editor deep link", () => {
    for (const site of STOREFRONTS) {
      const detail = readSite(site, "src/app/item/[itemId]/page.tsx");
      expect(detail).toContain("Open in the SceneAxi editor");
      expect(detail).toContain("editorLinkFor");
      expect(detail).toContain("Editor link unavailable");
    }
  });
});
