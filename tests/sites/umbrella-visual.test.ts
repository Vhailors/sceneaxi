/**
 * The umbrella's visual implementation (sceneaxi#157).
 *
 * The accepted design source is a marketing screen, and a marketing screen is exactly
 * where a claim the contracts do not make is easiest to ship. These tests are the
 * mechanism that stops that: they pin the restated content to its owners, assert the
 * claims the surface may not make, and assert the accessibility and responsive
 * structure the implementation depends on.
 *
 * They live here rather than in `sites/umbrella/test/` for the same reason
 * `site-seams.test.ts` does — the sites are separate install roots outside the
 * repository-root workspace, so their modules are imported by path.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REQUIRED_SCULPT_PASSES } from "@sceneaxi/schemas";
// `@sceneaxi/cli` is not a hermetic-root dependency, and the sites tier may not import
// it either. It is read by path here for the same reason the site seams are: the point
// is to compare against the shipped source, not to acquire an edge to it.
import { EXIT_CODE_TABLE } from "../../packages/cli/src/exit-codes.ts";
import {
  CREATOR_SHARE_RULE,
  FOUNDATION_COLORS,
  FOUNDATION_CONTRAST_ROLES,
  FOUNDATION_NEUTRAL_TOKENS,
  FOUNDATION_STATUSES,
  LIVE_OPEN_PRESENTATION,
  SITE_CAPABILITIES,
  SITE_CAPABILITY_IDS,
  SITE_STARTER_CREDIT_ALLOTMENT,
  meetsContrast,
} from "@sceneaxi/site-kit";
import {
  CREDIT_LEDGER_COPY,
  CREDIT_LEDGER_FACTS,
  ENGINE_NOTES,
  EXIT_CODES,
  FAMILY_CARDS,
  FOOTER_COLUMNS,
  PIPELINE,
  PRICING_FAQ,
  PROFILE_CARDS,
  REFUSAL_CODES,
  RELEASE_MARKER,
  REQUIRED_PASS_IDS,
  REVIEW_POINTS,
  SCULPT_PASSES,
  TERMINAL_LINES,
} from "../../sites/umbrella/src/lib/site-content.ts";
import {
  UMBRELLA_RECORDED_GAPS,
  umbrellaFoundationsCss,
} from "../../sites/umbrella/src/lib/foundations.ts";

const UMBRELLA = fileURLToPath(new URL("../../sites/umbrella/", import.meta.url));

const read = (relativePath: string): string =>
  readFileSync(join(UMBRELLA, relativePath), "utf8");

const CSS = read("src/app/globals.css");
const LAYOUT = read("src/app/layout.tsx");
const HOME = read("src/app/page.tsx");
const ENGINE = read("src/app/engine/page.tsx");
const DOCS = read("src/app/docs/page.tsx");
const PRICING = read("src/app/pricing/page.tsx");

/** Every committed source under the umbrella's `src`, discovered rather than listed. */
function collect(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    if (["node_modules", ".next", "dist"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) collect(path, out);
    else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const UMBRELLA_SOURCES: readonly string[] = collect(join(UMBRELLA, "src")).map((path) =>
  relative(UMBRELLA, path).split(sep).join("/"),
);

const ALL_SOURCE = UMBRELLA_SOURCES.map((path) => read(path)).join("\n");

describe("restated content stays pinned to the contract that owns it", () => {
  it("lists the required sculpt passes schemas declares, in order", () => {
    // The sites tier may not import `@sceneaxi/schemas`, so the pass order is restated
    // in site content. This is the join that keeps the restatement honest.
    expect(REQUIRED_PASS_IDS).toEqual([...REQUIRED_SCULPT_PASSES]);
  });

  it("marks exactly one pass optional rather than claiming five required ones", () => {
    const optional = SCULPT_PASSES.filter((pass) => !pass.required);
    expect(optional).toHaveLength(1);
    expect(optional[0]?.id).toBe("surface-detail");
    expect(REQUIRED_SCULPT_PASSES).not.toContain("surface-detail");
  });

  it("reproduces the CLI's own exit-code table", () => {
    expect(EXIT_CODES.map((row) => [row.code, row.name])).toEqual(
      EXIT_CODE_TABLE.map((row) => [row.code, row.name]),
    );
  });

  it("freezes every content collection so a render cannot mutate it", () => {
    for (const collection of [
      SCULPT_PASSES,
      REVIEW_POINTS,
      PROFILE_CARDS,
      TERMINAL_LINES,
      EXIT_CODES,
      FAMILY_CARDS,
      ENGINE_NOTES,
      PIPELINE,
      REFUSAL_CODES,
      PRICING_FAQ,
      FOOTER_COLUMNS,
    ]) {
      expect(Object.isFrozen(collection)).toBe(true);
    }
  });
});

describe("the marketing surface makes no claim the repository cannot stand behind", () => {
  it("invents no installer, platform build, size, or digest", () => {
    // The one downloadable artifact is the SDK archive, whose facts are read off the
    // served file. A page that spelled out a size or a digest would be inventing one.
    for (const invented of [
      ".dmg",
      ".exe",
      "AppImage",
      "Apple silicon",
      "Download for macOS",
      "Download for Windows",
    ]) {
      expect(ALL_SOURCE).not.toContain(invented);
    }
    expect(ALL_SOURCE).not.toMatch(/\b\d+\s*MB\b/);
    // Digest and byte size are read from the offer, never typed into the page.
    expect(ENGINE).toContain("sdk.sha256");
    expect(ENGINE).toContain("formatByteSize(sdk.byteSize)");
  });

  it("prices in credits and sells no seat, plan, or subscription", () => {
    expect(PRICING).toContain("listCreditPacks");
    expect(PRICING).toContain("credits");
    for (const invented of ["per seat", "/ month", "per month", "Start a trial"]) {
      expect(PRICING).not.toContain(invented);
    }
    // Pack money amounts come from the billing plane's own pack records.
    expect(PRICING).toContain("pack.unitAmount");
    expect(PRICING).toContain("pack.credits");
  });

  it("claims no registry install for private bootstrap packages", () => {
    expect(ALL_SOURCE).not.toContain("npm i -g");
    expect(ALL_SOURCE).not.toContain("npm install -g");
    expect(HOME).toContain("no registry install yet");
  });

  it("makes no shipping or general-availability claim", () => {
    for (const claim of ["generally available", "production ready", "production-ready"]) {
      expect(ALL_SOURCE.toLowerCase()).not.toContain(claim.toLowerCase());
    }
    /*
      `shippingClaim` is a real contract field, and `/profiles` mirrors it — so banning
      the identifier outright would ban carrying the contract forward. What must never
      appear is the field holding anything but `false`: the conformance contract and the
      open-path policy both type it `false`, and a surface that widened it would be
      claiming shipping in the one vocabulary the repository reserves for refusing to.
    */
    const mentions = [
      ...ALL_SOURCE.matchAll(/shippingClaim\b["'`]?\??\s*(:|=)?\s*([^,;)\n]*)/g),
    ];
    expect(mentions.length).toBeGreaterThan(0);
    /*
      A mention with no `:` or `=` after it binds nothing — it is prose in a comment, and
      prose may name the field. Every mention that *does* bind a type or a value has to
      bind `false`, in whatever form: a type position, a `false as const`, or a JSX
      `={false}`. Anything else — `true`, an identifier, an expression — fails.
    */
    const bindings = mentions.filter(([, operator]) => operator !== undefined);
    expect(bindings.length).toBeGreaterThan(0);
    for (const [, operator, bound] of bindings) {
      expect(`${operator} ${bound.trim()}`).toMatch(/^[:=] \{?\s*(readonly\s+)?false\b/);
    }
  });

  it("reads the presentation core's vocabulary rather than paraphrasing it", () => {
    expect(ENGINE).toContain("LIVE_OPEN_PRESENTATION.coreLabel");
    expect(ENGINE).toContain("LIVE_OPEN_PRESENTATION.decision");
    expect(ENGINE).toContain("LIVE_OPEN_PRESENTATION.notClaimed");
    // The retired framing scan in site-seams.test.ts covers the whole tier; this is the
    // positive half — the settled label has to actually appear on a product surface.
    expect(LIVE_OPEN_PRESENTATION.coreLabel).toBe("Three presentation core");
  });

  it("keeps every credit and share figure derived from site-kit", () => {
    for (const source of [HOME, PRICING]) {
      expect(source).toContain("SITE_STARTER_CREDIT_ALLOTMENT");
    }
    expect(HOME).toContain("CREATOR_SHARE_RULE.creatorPercent");
    // …and never spelled out beside them.
    expect(ALL_SOURCE).not.toMatch(
      new RegExp(`\\b${SITE_STARTER_CREDIT_ALLOTMENT}\\s+credits\\b`),
    );
    expect(ALL_SOURCE).not.toMatch(
      new RegExp(`\\b${CREATOR_SHARE_RULE.creatorPercent}%\\s+of`),
    );
  });

  it("counts free capabilities from the published matrix", () => {
    expect(HOME).toContain("SITE_CAPABILITIES[id].tier === \"free\"");
    const free = SITE_CAPABILITY_IDS.filter((id) => SITE_CAPABILITIES[id].tier === "free");
    expect(free.length).toBeGreaterThan(0);
    expect(free.length).toBeLessThan(SITE_CAPABILITY_IDS.length);
  });

  it("states the release marker once, from one constant", () => {
    expect(RELEASE_MARKER).toContain("0.0.0");
    for (const source of [LAYOUT, HOME, ENGINE]) {
      expect(source).toContain("RELEASE_MARKER");
    }
  });
});

describe("Kids is described and never linked", () => {
  it("gives the Kids profile card no href at all", () => {
    const kids = PROFILE_CARDS.find((card) => card.name === "Kids");
    expect(kids).toBeDefined();
    expect(kids?.href).toBeNull();
  });

  it("marks the Kids family entry unlinkable", () => {
    const kids = FAMILY_CARDS.find((card) => card.name.includes("Kids"));
    expect(kids).toBeDefined();
    expect(kids?.linkable).toBe(false);
  });

  it("names no Kids host anywhere in the umbrella's sources", () => {
    expect(ALL_SOURCE).not.toMatch(/sceneaxikids/i);
    expect(ALL_SOURCE).not.toMatch(/kids\.[a-z]+\.(dev|com|app)/i);
    // Nothing resolves a Kids origin, so no environment value can produce one.
    expect(ALL_SOURCE).not.toMatch(/KIDS_ORIGIN/);
  });

  it("renders an unlinkable card as an article, never as an anchor", () => {
    // The branch that decides this is the load-bearing line: a null href must pick the
    // non-anchor element on both card grids — the profile row and the family row.
    expect(HOME).toContain("profile.href === null ? (");
    expect(HOME).toContain("href === null ? (");
    expect(HOME.split("<article className={className}").length - 1).toBe(2);
  });
});

describe("family and footer links only ever point at routes this site serves", () => {
  it("routes every footer entry to a real umbrella path", () => {
    const routes = new Set([
      "/",
      "/open",
      "/profiles",
      "/engine",
      "/docs",
      "/pricing",
      "/account",
      "/editor",
    ]);
    for (const column of FOOTER_COLUMNS) {
      for (const item of column.items) {
        expect(routes.has(item.href)).toBe(true);
      }
    }
  });

  it("links a catalog card only when this deployment resolved that origin", () => {
    // `catalogHref` is `resolveFamilyLinks`' output, which is null for an unset or
    // insecure origin — so an unconfigured deploy renders no link rather than a broken one.
    expect(HOME).toContain("resolveFamilyLinks(process.env)");
    expect(HOME).toContain("entry.linkable ? (catalogHref[entry.name] ?? null) : null");
    expect(LAYOUT).toContain("entry.href !== null");
  });

  it("names a surface rather than a hostname on every family card", () => {
    for (const card of FAMILY_CARDS) {
      expect(card.what).not.toMatch(/\.(dev|com|app|io)\b/);
    }
  });
});

describe("accessibility structure", () => {
  it("offers a skip link into the main landmark", () => {
    expect(LAYOUT).toContain('className="skip-link" href="#main"');
    expect(LAYOUT).toContain('<main id="main">');
    expect(CSS).toContain(".skip-link:focus");
  });

  it("marks the active navigation item for assistive technology, not just visually", () => {
    const nav = read("src/app/_components/site-nav.tsx");
    expect(nav).toContain('"aria-current": "page"');
    expect(CSS).toContain('.nav a[aria-current="page"]');
  });

  it("labels every navigation landmark", () => {
    expect(read("src/app/_components/site-nav.tsx")).toContain('aria-label="Primary"');
    expect(DOCS).toContain('aria-label="Documents"');
    expect(DOCS).toContain('aria-label="On this page"');
  });

  it("keeps a visible focus ring rather than removing the outline", () => {
    expect(CSS).toContain(":focus-visible {");
    expect(CSS).toContain("outline: 2px solid var(--accent-hi)");
    expect(CSS).not.toMatch(/outline:\s*(none|0)\s*;/);
  });

  it("honours a reduced-motion preference", () => {
    expect(CSS).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("hides every decorative mark, rail, and arrow from the accessibility tree", () => {
    // Each of these is a bare span with no text; unlabelled, they would be noise.
    for (const decorative of [
      'className="panel-bar" aria-hidden="true"',
      'className="card-accent-rail" aria-hidden="true"',
      'className="family-mark" aria-hidden="true"',
    ]) {
      expect(HOME + ENGINE).toContain(decorative);
    }
    expect(LAYOUT).toContain('className="mark" aria-hidden="true"');
  });

  it("underlines links inside prose, so colour is not the only cue", () => {
    expect(CSS).toContain("main p a,");
    expect(CSS).toContain("text-decoration: underline");
  });

  it("clears the sticky masthead when an in-page anchor is jumped to", () => {
    expect(CSS).toContain("scroll-margin-top: calc(var(--masthead-h) + 24px)");
    expect(DOCS).toContain('id="governing"');
    expect(DOCS).toContain('href={`#${section.id}`}');
  });

  it("carries every text colour at the contrast role site-kit measured it for", () => {
    /*
      The palette is site-kit's now, and so is the measurement: `meetsContrast` is the
      same function the design package's own gate test uses. What this asserts is the
      *umbrella's* half — that every surface this site actually paints text on is one of
      the published neutrals, and that the two foreground tokens it uses for words clear
      the body floor on all of them. The recorded gap `--bg-band` is included, because it
      is a fill this site invented and therefore one this site has to prove.
    */
    const hexOf = (token: string): string => {
      const found = FOUNDATION_COLORS.find((color) => color.token === token);
      if (found === undefined) throw new Error(`no Foundations token ${token}`);
      return found.hex;
    };
    const bandGap = UMBRELLA_RECORDED_GAPS.find((gap) => gap.token === "--bg-band");
    expect(bandGap, "the marketing band fill must stay a recorded gap").toBeDefined();

    const surfaces = [
      ...FOUNDATION_NEUTRAL_TOKENS.map(hexOf),
      bandGap?.value ?? "#090B0E",
    ];

    const failures: string[] = [];
    for (const token of ["--fg", "--fg-2"]) {
      expect(FOUNDATION_CONTRAST_ROLES[token]).toBe("body");
      for (const surface of surfaces) {
        if (!meetsContrast(hexOf(token), surface, "body")) {
          failures.push(`${token} on ${surface}`);
        }
      }
    }
    expect(failures).toEqual([]);

    // `--fg-4` is Foundations' non-text token. This site uses it for the reason label and
    // decorative rules, never for a word that carries meaning alone.
    expect(FOUNDATION_CONTRAST_ROLES["--fg-4"]).toBe("non-text");
  });
});

describe("the token layer comes from site-kit and is not duplicated here", () => {
  it("declares no colour in the site stylesheet at all", () => {
    // A hex in `globals.css` would be a second source for a value the design package
    // already owns. There are none: every colour reaches this sheet as a custom property.
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("declares no Foundations token the shared sheet already emits", () => {
    const declared = [...CSS.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((match) => match[1]);
    const shared = new Set<string>(FOUNDATION_COLORS.map((color) => color.token));
    expect(declared.filter((token) => token !== undefined && shared.has(token))).toEqual([]);
  });

  it("serves the shared sheet, and every token the stylesheet reads resolves in it", () => {
    const sheet = umbrellaFoundationsCss();
    expect(sheet.ok).toBe(true);
    if (!sheet.ok) return;

    const emitted = new Set(
      [...sheet.value.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((match) => match[1]),
    );
    const localMetrics = new Set(["--shell", "--gutter", "--band-pad", "--masthead-h"]);
    const used = new Set(
      [...CSS.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((match) => match[1]),
    );
    const unresolved = [...used].filter(
      (token) => token !== undefined && !emitted.has(token) && !localMetrics.has(token),
    );
    expect(unresolved).toEqual([]);
  });

  it("projects the status vocabulary from site-kit rather than restating it", () => {
    const sheet = umbrellaFoundationsCss();
    expect(sheet.ok).toBe(true);
    if (!sheet.ok) return;
    for (const status of FOUNDATION_STATUSES) {
      expect(sheet.value).toContain(`--status-${status.id}-fg: ${status.fg};`);
      expect(sheet.value).toContain(`--status-${status.id}-bg: ${status.bg};`);
      expect(sheet.value).toContain(`--status-${status.id}-line: ${status.line};`);
    }
    // The projection is derived, so the module holds no status hex of its own.
    const module = read("src/lib/foundations.ts");
    for (const status of FOUNDATION_STATUSES) {
      expect(module).not.toContain(status.fg);
    }
  });

  it("keeps every invented colour in one recorded-gap list", () => {
    const module = read("src/lib/foundations.ts");
    const literals = [...module.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((match) => match[0]);
    expect(literals.sort()).toEqual(
      UMBRELLA_RECORDED_GAPS.map((gap) => gap.value).sort(),
    );
    for (const gap of UMBRELLA_RECORDED_GAPS) {
      expect(gap.gap.length).toBeGreaterThan(0);
    }
  });

  it("never redefines the two published font tokens from the framework", () => {
    // `next/font` writes its variables onto a generated class; naming them `--font-ui` or
    // `--font-mono` would race the shared sheet for the same token.
    expect(LAYOUT).toContain('variable: "--font-archivo"');
    expect(LAYOUT).toContain('variable: "--font-jetbrains"');
    expect(LAYOUT).not.toContain('variable: "--font-mono"');
    expect(LAYOUT).not.toContain('variable: "--font-ui"');
  });

  it("fails closed when the shared sheet refuses rather than serving an unthemed page", () => {
    expect(LAYOUT).toContain("if (!foundations.ok)");
    expect(LAYOUT).toContain("throw new Error(");
  });
});

describe("the hero draws a real Sculpt Artifact", () => {
  it("renders the composed scene rather than procedural marketing geometry", () => {
    expect(HOME).toContain("resolveLiveOpenScene()");
    expect(HOME).toContain("<HeroViewport");
    // The retired gradient field and its veil are gone from both the page and the sheet.
    for (const retired of ["hero-field", "hero-veil"]) {
      expect(HOME).not.toContain(retired);
      expect(CSS).not.toContain(retired);
    }
  });

  it("goes through the tier's one renderer boundary and no other", () => {
    const hero = read("src/app/_components/hero-viewport.tsx");
    expect(hero).toContain("useSculptViewport");
    expect(hero).not.toContain("createThreeSculptPresentationBackend");
    // The hero draws; it does not author. No editor operation is reachable from it.
    expect(hero).not.toContain("WEB_EDITOR_SESSION_OPERATIONS");
    expect(hero).not.toContain("renderEditorState");
  });

  it("refuses in the open when the pipeline cannot compose the scene", () => {
    expect(HOME).toContain("heroScene.ok ? (");
    expect(HOME).toContain("reason={heroScene.reason}");
    /*
      Both states of the hero slot sit directly under the page's `h1`, so both have to
      name their own heading level — a refused deploy must not be the one that jumps
      from `h1` to `h3`. The drawn branch passes it through the shared surface; the
      refused branch passes it to the panel itself.
    */
    expect(read("src/app/_components/hero-viewport.tsx")).toContain("refusalLevel={2}");
    const heroRefusal = HOME.match(/<StatePanel\b[^>]*heroScene\.reason[^>]*>/)?.[0];
    expect(heroRefusal).toContain("level={2}");
  });
});

describe("account, credits, and refusal surfaces stay truthful", () => {
  const ACCOUNT = read("src/app/account/page.tsx");
  const STATE_PANEL = read("src/app/_components/state-panel.tsx");

  it("describes an append-only ledger and no seat subscription anywhere", () => {
    expect(CREDIT_LEDGER_COPY.model).toContain("append-only");
    expect(CREDIT_LEDGER_FACTS.map((fact) => fact.title)).toContain("Append-only");
    for (const invented of [
      "per seat",
      "per-seat",
      "per month",
      "/ month",
      "subscribe",
      "Subscribe",
      "renewal date",
      "Start a trial",
      "free trial",
    ]) {
      expect(ALL_SOURCE).not.toContain(invented);
    }
    /*
      "Subscription" and "tier" may still appear — but only where the text is rejecting
      the model, never offering it. Each occurrence is checked in its own neighbourhood
      rather than its sentence, because the rejections that matter most span two clauses
      ("The accepted screen prices three subscription tiers. SceneAxi does not sell
      seats"), and a per-sentence rule would fail exactly the passage doing the work.
    */
    const denial = /never|not a|does not|no seat|rejected|instead of|rather than/i;
    for (const match of ALL_SOURCE.matchAll(/subscription/gi)) {
      const at = match.index ?? 0;
      const around = ALL_SOURCE.slice(Math.max(0, at - 220), at + 220);
      expect(around, `"subscription" near offset ${at} does not reject the model`).toMatch(
        denial,
      );
    }
  });

  it("reads a balance and never offers to write one", () => {
    expect(ACCOUNT).toContain("resolved.credits.value.balance");
    expect(ACCOUNT).toContain("CREDIT_LEDGER_COPY.balanceIsDerived");
    // No form, no input, no mutating method reaches the ledger from the account surface.
    for (const mutating of ["<form", "<input", "method=\"post\""]) {
      expect(ACCOUNT).not.toContain(mutating);
    }
  });

  it("refuses rather than showing a zero when the ledger cannot be read", () => {
    expect(CREDIT_LEDGER_COPY.unreadableLedger).toContain("never treated as a balance of zero");
    expect(ACCOUNT).toContain("CREDIT_LEDGER_COPY.unreadableLedger");
  });

  it("keeps the named refusal key visible on every refusing surface", () => {
    // The panel prints the key unconditionally whenever one exists — no disclosure, no
    // truncation, no "details" affordance standing between a reader and the reason.
    expect(STATE_PANEL).toContain("reason !== undefined &&");
    expect(STATE_PANEL).toContain('className="reason"');
    for (const source of [
      ACCOUNT,
      read("src/app/editor/page.tsx"),
      read("src/app/engine/page.tsx"),
      read("src/app/open/page.tsx"),
    ]) {
      expect(source).toMatch(/reason=\{/);
    }
  });

  it("adds no retry affordance the contracts do not define", () => {
    expect(STATE_PANEL).toContain("no re-attempt affordance");
    for (const invented of ["Try again", "Retry", "retry now", "Refresh to retry"]) {
      expect(ALL_SOURCE).not.toContain(invented);
    }
  });

  it("keeps refusal styled as a first-class state rather than a fallback", () => {
    for (const tone of ["ok", "warn", "deny", "iso"]) {
      expect(CSS).toContain(`.state-${tone} {`);
    }
    expect(CSS).toContain(".state-head {");
    expect(CSS).toContain(".reason-label {");
  });
});

describe("the layout is one responsive composition, not a desktop-only one", () => {
  it("declares a viewport-fluid type scale rather than fixed pixel headings", () => {
    expect(CSS).toMatch(/h1\s*\{[^}]*font-size:\s*clamp\(/);
    expect(CSS).toMatch(/h2\s*\{[^}]*font-size:\s*clamp\(/);
  });

  it("collapses at every breakpoint the implementation relies on", () => {
    for (const width of [1180, 1024, 860, 620]) {
      expect(CSS).toContain(`@media (max-width: ${width}px)`);
    }
  });

  it("gives every multi-column grid a single-column phone rule", () => {
    const phone = CSS.slice(CSS.indexOf("@media (max-width: 620px)"));
    for (const selector of [".grid-5", ".grid-4", ".grid-3", ".grid-2"]) {
      expect(phone).toContain(selector);
    }
    expect(phone).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("keeps wide evidence inside its own scroller so the page never scrolls sideways", () => {
    expect(CSS).toContain("overflow-x: hidden");
    expect(CSS).toMatch(/\.scroll-x\s*\{[^}]*overflow-x:\s*auto/);
    // Every grid track is minmax(0, …) or min(100%, …), so a long token cannot push a
    // column past its share of the row.
    expect(CSS).not.toMatch(/grid-template-columns:\s*repeat\(\d+,\s*1fr\)/);
  });

  it("keeps the primary navigation reachable at every width without JavaScript state", () => {
    const nav = read("src/app/_components/site-nav.tsx");
    expect(nav).not.toContain("useState");
    expect(nav).not.toContain("onClick");
    expect(CSS).toMatch(/\.nav\s*\{[^}]*overflow-x:\s*auto/);
  });
});

describe("the visual layer adds no behaviour the site did not already have", () => {
  it("constructs no renderer outside the tier's one boundary", () => {
    for (const relativePath of UMBRELLA_SOURCES) {
      if (relativePath === "src/app/_components/sculpt-viewport.tsx") continue;
      expect(read(relativePath)).not.toContain("createThreeSculptPresentationBackend");
    }
  });

  it("pins the client-component list to the reviewed set", () => {
    const clients = UMBRELLA_SOURCES.filter((relativePath) =>
      read(relativePath).startsWith('"use client"'),
    ).sort();
    expect(clients).toEqual([
      "src/app/_components/site-nav.tsx",
      "src/app/_components/sculpt-viewport.tsx",
      "src/app/_components/hero-viewport.tsx",
      "src/app/editor/_components/editor-viewport.tsx",
      "src/app/open/_components/live-viewport.tsx",
    ].sort());
  });

  it("keeps the content module free of React, Next, and every runtime import", () => {
    const content = read("src/lib/site-content.ts");
    // No import statement at all: it is data the gate can type-check on its own.
    expect(content).not.toMatch(/^import\s/m);
    for (const needle of ['from "react"', 'from "next/', 'from "@sceneaxi/']) {
      expect(content).not.toContain(needle);
    }
  });
});
