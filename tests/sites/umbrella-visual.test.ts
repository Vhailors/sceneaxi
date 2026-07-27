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
  LIVE_OPEN_PRESENTATION,
  SITE_CAPABILITIES,
  SITE_CAPABILITY_IDS,
  SITE_STARTER_CREDIT_ALLOTMENT,
} from "@sceneaxi/site-kit";
import {
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
    for (const claim of [
      "shippingClaim",
      "generally available",
      "production ready",
      "production-ready",
    ]) {
      expect(ALL_SOURCE.toLowerCase()).not.toContain(claim.toLowerCase());
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
    const routes = new Set(["/", "/open", "/engine", "/docs", "/pricing", "/account", "/editor"]);
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
      'className="hero-field" aria-hidden="true"',
      'className="hero-veil" aria-hidden="true"',
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

  it("uses only text colours that clear 4.5:1 on every surface they sit on", () => {
    // The three mockup greys that carry text below 4.5:1 (#6E7681, #565E68, #3F464F)
    // survive as `--rule-*` and `--deco` only — never as a text colour. This asserts the
    // whole declared text ramp instead of those three by name, so a token added later is
    // checked on the day it lands.
    const surfaces = ["#07080a", "#08090b", "#090b0e", "#0b0d10", "#0d0f12", "#12151a"];
    const declared = new Map<string, string>();
    for (const [, name, value] of CSS.matchAll(/(--fg(?:-\d)?):\s*(#[0-9a-f]{6});/g)) {
      if (name !== undefined && value !== undefined) declared.set(name, value);
    }
    expect([...declared.keys()].sort()).toEqual(["--fg", "--fg-2", "--fg-3", "--fg-4", "--fg-5"]);

    const failures: string[] = [];
    for (const [name, value] of declared) {
      for (const surface of surfaces) {
        const ratio = contrast(value, surface);
        if (ratio < 4.5) failures.push(`${name} (${value}) on ${surface}: ${ratio.toFixed(2)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

/** WCAG 2.x relative luminance, for the contrast assertion above. */
function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (raw: number): number => {
    const c = raw / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((value >> 16) & 255) +
    0.7152 * channel((value >> 8) & 255) +
    0.0722 * channel(value & 255)
  );
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

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

  it("adds exactly one client component, and it only reads the pathname", () => {
    const clients = UMBRELLA_SOURCES.filter((relativePath) =>
      read(relativePath).startsWith('"use client"'),
    ).sort();
    expect(clients).toEqual([
      "src/app/_components/site-nav.tsx",
      "src/app/_components/sculpt-viewport.tsx",
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
