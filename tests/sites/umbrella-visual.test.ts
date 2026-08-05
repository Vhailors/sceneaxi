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
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EDITOR_SHELL_RETIRED_COPY } from "@sceneaxi/schemas";
import {
  CREATOR_SHARE_RULE,
  EDITOR_SHELL_FABRICATED_FIGURES,
  EDITOR_SHELL_WEB_REFUSALS,
  FOUNDATION_COLORS,
  FOUNDATION_CONTRAST_ROLES,
  FOUNDATION_NEUTRAL_TOKENS,
  FOUNDATION_STATUSES,
  LIVE_OPEN_PRESENTATION,
  SITE_CAPABILITIES,
  SITE_CAPABILITY_IDS,
  SITE_STARTER_CREDIT_ALLOTMENT,
  createStatePanelModel,
  meetsContrast,
} from "@sceneaxi/site-kit";
import {
  CREDIT_LEDGER_COPY,
  CREDIT_LEDGER_FACTS,
  ENGINE_NOTES,
  FOOTER_COLUMNS,
  PIPELINE,
  PRICING_FAQ,
  PROFILE_CARDS,
  REFUSAL_CODES,
  RELEASE_MARKER,
} from "../../sites/umbrella/src/lib/site-content.ts";
import { LAUNCH_PROOFS } from "../../sites/umbrella/src/lib/launch-marketing.ts";
import {
  UMBRELLA_RECORDED_GAPS,
  umbrellaFoundationsCss,
} from "../../sites/umbrella/src/lib/foundations.ts";
import {
  UMBRELLA_RESTATED_FOUNDATION_COLORS,
  VIEWPORT_LETTERBOX,
} from "../../sites/umbrella/src/lib/viewport-letterbox.ts";

/** The published hex for a Foundations token, or a failure naming the missing token. */
const foundationHex = (token: string): string => {
  const found = FOUNDATION_COLORS.find((color) => color.token === token);
  if (found === undefined) throw new Error(`no Foundations token ${token}`);
  return found.hex;
};

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

describe("shipped content stays frozen and rendered", () => {
  it("freezes every content collection so a render cannot mutate it", () => {
    for (const collection of [
      PROFILE_CARDS,
      ENGINE_NOTES,
      PIPELINE,
      REFUSAL_CODES,
      PRICING_FAQ,
      FOOTER_COLUMNS,
    ]) {
      expect(Object.isFrozen(collection)).toBe(true);
    }
  });

  it("keeps every exported content collection on a route that renders it", () => {
    // sceneaxi#203 replaced the overview's feature tour. Copy no route renders is not
    // content the gate can hold to anything, and an assertion about it reads as a
    // guarantee about the shipped page while guarding nothing — so an export that
    // loses its render site is removed with it rather than left here.
    const content = read("src/lib/site-content.ts");
    const exported = [...content.matchAll(/^export const ([A-Z][A-Z0-9_]*)/gm)].map(
      (match) => match[1] ?? "",
    );
    expect(exported.length).toBeGreaterThan(0);
    const rendered = UMBRELLA_SOURCES.filter(
      (path) => path !== "src/lib/site-content.ts",
    ).map((path) => read(path));
    for (const name of exported) {
      expect(
        rendered.some((source) => new RegExp(`\\b${name}\\b`).test(source)),
        `${name} is exported from site-content.ts but no route reads it`,
      ).toBe(true);
    }
  });
});

describe("the marketing surface makes no claim the repository cannot stand behind", () => {
  it("invents no installer, platform build, size, or digest", () => {
    // Two downloadable artifacts exist: the SDK archive, whose facts are read off the
    // served file, and the recorded Linux desktop build, whose facts come from the
    // committed site-kit offer (lockstep with docs/desktop-linux.md). A page that
    // spelled out a size or a digest would be inventing one, and Windows/macOS
    // installers do not exist, so naming one anywhere is refused.
    for (const invented of [
      ".dmg",
      ".exe",
      "Apple silicon",
      "Download for macOS",
      "Download for Windows",
    ]) {
      expect(ALL_SOURCE).not.toContain(invented);
    }
    expect(ALL_SOURCE).not.toMatch(/\b\d+\s*MB\b/);
    // Digest and byte size are read from the offers, never typed into the page.
    expect(ENGINE).toContain("sdk.sha256");
    expect(ENGINE).toContain("formatByteSize(sdk.byteSize)");
    expect(ENGINE).toContain("artifact.sha256");
    expect(ENGINE).toContain("formatByteSize(artifact.byteSize)");
    expect(ENGINE).not.toMatch(/\b[0-9a-f]{64}\b/);
    // The desktop offer is rendered whole: the honest platform line and the
    // reproducibility note are not optional decorations.
    expect(ENGINE).toContain("desktopApp.unavailablePlatforms.map");
    expect(ENGINE).toContain("desktopApp.reproducibilityNote");
  });

  it("keeps the desktop record on the page when the SDK archive is absent", () => {
    // The two artifacts have different evidence models and fail independently: the
    // archive's facts are read off a served file, the desktop record is committed
    // data. An absent archive must therefore replace the SDK cards with the named
    // reason, not take the desktop section down with it — so the refusal is rendered
    // inline and no early `return` stands between it and the rest of the page.
    expect(ENGINE).toContain('title="No download to offer"');
    expect(ENGINE.match(/^\s*return \(/gm)).toHaveLength(1);
    // Everything that reads the archive is guarded on its presence, so the page can
    // render without one at all.
    expect(ENGINE).toContain("offer.ok ? offer.value : null");
    expect(ENGINE).toContain("{sdk !== null &&");
    expect(ENGINE).not.toMatch(/\bsdk\?\./);
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
    expect(
      LAUNCH_PROOFS.find((proof) => proof.id === "engine-access")?.body,
    ).toContain("not registry-published");
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
      expect(`${operator} ${(bound ?? "").trim()}`).toMatch(
        /^[:=] \{?\s*(readonly\s+)?false\b/,
      );
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

  it("keeps every rendered credit and share figure derived from site-kit", () => {
    expect(PRICING).toContain("SITE_STARTER_CREDIT_ALLOTMENT");
    // The launch overview states the model but prints no page-authored credit or share
    // figure. Pricing remains the route that renders those contract-owned numbers.
    expect(HOME).toContain("LAUNCH_PROOFS.map");
    expect(ALL_SOURCE).not.toMatch(
      new RegExp(`\\b${SITE_STARTER_CREDIT_ALLOTMENT}\\s+credits\\b`),
    );
    expect(ALL_SOURCE).not.toMatch(
      new RegExp(`\\b${CREATOR_SHARE_RULE.creatorPercent}%\\s+of`),
    );
  });

  it("keeps the free capability classification in the published matrix", () => {
    const free = SITE_CAPABILITY_IDS.filter((id) => SITE_CAPABILITIES[id].tier === "free");
    expect(free.length).toBeGreaterThan(0);
    expect(free.length).toBeLessThan(SITE_CAPABILITY_IDS.length);
    expect(LAUNCH_PROOFS.find((proof) => proof.id === "engine-access")?.body).toContain(
      "cost zero credits",
    );
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

  it("names no Kids host anywhere in the umbrella's sources", () => {
    expect(ALL_SOURCE).not.toMatch(/sceneaxikids/i);
    expect(ALL_SOURCE).not.toMatch(/kids\.[a-z]+\.(dev|com|app)/i);
    // Nothing resolves a Kids origin, so no environment value can produce one.
    expect(ALL_SOURCE).not.toMatch(/KIDS_ORIGIN/);
  });

  it("renders the Kids proof as text, never as an anchor", () => {
    expect(LAUNCH_PROOFS.find((proof) => proof.id === "kids-isolation")?.href).toBeNull();
    expect(HOME).toContain("proof.href === null ? proof.title");
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
      "/login",
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
    // The root layout resolves catalog origins and filters null before rendering. The
    // launch overview no longer repeats a second catalog navigation surface.
    expect(LAYOUT).toContain("resolveFamilyLinks(process.env)");
    expect(LAYOUT).toContain("entry.href !== null");
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

  it("exposes a role on every focusable scroll region, so its label is announced", () => {
    // A labelled `div` is `role=generic`, whose accessible name assistive technology
    // does not expose — a keyboard user who tabs into the scroller would hear nothing.
    let focusable = 0;
    for (const relativePath of UMBRELLA_SOURCES) {
      for (const opening of read(relativePath).matchAll(/<div\b[^>]*\bscroll-x\b[^>]*>/gs)) {
        if (!opening[0].includes("tabIndex")) continue;
        focusable += 1;
        expect(opening[0], `${relativePath} focusable scroller`).toMatch(
          /role="(region|group)"/,
        );
      }
    }
    expect(focusable).toBeGreaterThan(0);
  });

  it("hides the decorative product mark from the accessibility tree", () => {
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
    const hexOf = foundationHex;
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
    // Site-local layout metrics, declared and read in this sheet only. The
    // `--ed-narrow-*` three are the reflowed editor row's budget: the row floor
    // is their sum, so the canvas cannot be squeezed to nothing by a dock or a
    // copy band whose height the floor did not count.
    const localMetrics = new Set([
      "--shell",
      "--gutter",
      "--band-pad",
      "--masthead-h",
      "--ed-narrow-dock",
      "--ed-narrow-note",
      "--ed-narrow-canvas",
    ]);
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

  it("keeps every colour literal in the whole site down to two declared lists", () => {
    /*
      Scanned across every umbrella source rather than one module, because a hardcoded
      colour hides in whatever file the scan does not reach — this guard used to read
      `src/lib/foundations.ts` alone, and a WebGL clear colour sat outside it. A colour
      literal is a quoted hex: `sceneaxi#157` in prose is an issue reference, not a
      value, and the quotes are what tell them apart. `globals.css` is covered by its own
      no-hex assertion above, and no colour *function* is allowed in a source either.
    */
    const declared = new Set([
      ...UMBRELLA_RECORDED_GAPS.map((gap) => gap.value),
      ...Object.values(UMBRELLA_RESTATED_FOUNDATION_COLORS),
    ]);
    const undeclared: string[] = [];
    for (const relativePath of UMBRELLA_SOURCES) {
      const source = read(relativePath);
      for (const [, , literal] of source.matchAll(/(['"`])(#[0-9A-Fa-f]{3,8})\1/g)) {
        if (literal !== undefined && !declared.has(literal)) {
          undeclared.push(`${relativePath}: ${literal}`);
        }
      }
      expect(source, `${relativePath} writes a colour function`).not.toMatch(
        /\b(?:rgba?|hsla?|color-mix)\(/,
      );
    }
    expect(undeclared).toEqual([]);

    // Every literal in the first list is a value the archive does not state, and says so.
    for (const gap of UMBRELLA_RECORDED_GAPS) {
      expect(gap.gap.length).toBeGreaterThan(0);
      expect(
        FOUNDATION_COLORS.some((color) => color.hex === gap.value),
        `${gap.token} restates a published Foundations colour and is not a gap`,
      ).toBe(false);
    }

    /*
      Every literal in the second list is one it *does* state, restated only because the
      browser bundle cannot value-import site-kit. This is the join that keeps the
      restatement honest: a repalletted `--bg-base` fails here rather than leaving the
      viewport letterbox on a colour nothing publishes any more.
    */
    for (const [token, value] of Object.entries(UMBRELLA_RESTATED_FOUNDATION_COLORS)) {
      expect(value, `${token} drifted from Foundations`).toBe(foundationHex(token));
    }
    expect(VIEWPORT_LETTERBOX).toBe(foundationHex("--bg-base"));
    expect(read("src/app/_components/sculpt-viewport.tsx")).toContain(
      "background: background ?? VIEWPORT_LETTERBOX",
    );
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

  it("mounts a snapshot: no camera input, and no loop left running behind the page", () => {
    /*
      "Offers no control" has to be a property of the mount rather than a sentence about
      it. The hero is the tier's one `snapshot` surface: the shared hook attaches orbit
      and zoom only on the interactive path, and the canvas keeps `touch-action` so a
      swipe that starts on the art still scrolls the landing page. The two routed
      viewports are untouched — their "drag to orbit, scroll to zoom" copy stays true.
    */
    const hero = read("src/app/_components/hero-viewport.tsx");
    const boundary = read("src/app/_components/sculpt-viewport.tsx");
    expect(hero).toContain('presentation: "snapshot"');
    for (const routed of [
      "src/app/open/_components/live-viewport.tsx",
      "src/app/editor/_components/editor-viewport.tsx",
    ]) {
      expect(read(routed)).not.toContain("snapshot");
    }
    expect(boundary).toMatch(/if \(!snapshot\) \{\s*const detachInput = backend\.camera\.attach\(/);
    expect(CSS).toMatch(/\.viewport-canvas-static[^{]*\{[^}]*touch-action:\s*auto/);
    expect(CSS).not.toMatch(/\.viewport-canvas-static[^{]*\{[^}]*cursor:\s*grab/);

    /*
      And the loop stops once the frame settles, so a static image on the site's
      highest-traffic page is not redrawn for the rest of the visit. "Settled" is the
      core's own report — the frame reached a real drawing buffer and issued draw calls
      for what is mounted — so an unfinished frame keeps the loop running rather than
      freezing the hero part-way through opening.
    */
    expect(boundary).toContain("frame.pixelsDrawn === true");
    expect(boundary).toContain("frame.drawCalls > 0");
    expect(boundary).toMatch(/if \(!settled\) \{\s*loop\.start\(\);/);
    // A stopped loop still redraws on resize and on a density change, so stopped art
    // stays correct rather than stretched.
    expect(boundary).toMatch(/if \(snapshot\) drawFrame\(\);/);
    expect(boundary).toContain("dppx)`");

    /*
      A stopped surface has no next frame to recover on, so the rest of what can
      invalidate the settled frame has to ask for one by name. A restored WebGL context
      redraws — an interactive surface self-heals on its next frame and a snapshot would
      otherwise stay blank for the visit — and a lost one drops the frame report first,
      so the provenance line never outlives the pixels it describes. New mount intent
      asks too, so the hook's idempotent reconciliation still converges on both
      presentations rather than silently recording a mount it never draws.
    */
    expect(boundary).toContain('canvas.addEventListener("webglcontextrestored", redraw)');
    expect(boundary).toMatch(
      /const onSurfaceContextLost = \(\) => \{\s*loop\.stop\(\);\s*setStatus\(\{ kind: "starting" \}\);/,
    );
    expect(boundary).toMatch(/wantedRef\.current = wantedKey;[\s\S]{0,400}?redrawRef\.current\?\.\(\)/);

    /*
      `canvas` has no implicit ARIA role, so `aria-label` alone is not reliably an
      accessible name. Only the snapshot takes `role="img"`: on the routed surfaces the
      canvas is a genuine interactive target and calling it an image would misdescribe it.
    */
    expect(boundary).toContain('role={isSnapshot ? "img" : undefined}');
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
    expect(STATE_PANEL).toContain("model.reason !== null &&");
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

  /** The `620px` phone block — the last media block in the sheet. */
  const PHONE = CSS.slice(CSS.indexOf("@media (max-width: 620px)"));

  /**
   * The declarations of the first `selector { … }` rule in `scope`.
   *
   * Enough of a parser for this sheet: every rule here is a flat declaration block with
   * no nesting, so the first `}` after the selector ends it.
   */
  const rule = (scope: string, selector: string): string => {
    const at = scope.indexOf(`${selector} {`);
    expect(at, `no \`${selector}\` rule in this scope`).toBeGreaterThan(-1);
    return scope.slice(at, scope.indexOf("}", at));
  };

  it("cannot starve the state's own name to a zero-width column", () => {
    /*
     * The blind spot this closes. A grid track squeezed to `0px` is *tall*, not wide, so
     * it escapes nothing: a `scrollWidth === innerWidth` sweep passes it, a walk for an
     * element crossing its container's right edge passes it, and no accessibility audit
     * has a rule for a name rendered one character per line. It was a real defect on the
     * shipped default path — identity plane unwired — at 390px, and every automated check
     * this site had was structurally incapable of seeing it.
     *
     * This assertion is structural, not measured: nothing in `pnpm gate` lays out CSS, and
     * a check that claims to measure what it cannot is worse than one that says so. It
     * pins the two properties that made the collapse possible, so the shape cannot return
     * silently. The measured widths, at 390px on that same unwired path, are recorded in
     * `sites/umbrella/VISUAL-EVIDENCE.md`.
     */
    const head = rule(CSS, ".state-head");

    // Wide: three tracks, and the key's track carries an explicit `0` minimum, so the
    // key's own content can never be the reason the name has no room left.
    expect(head).toMatch(
      /grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)\s+minmax\(0,\s*[^)]+\);/,
    );
    // A bare `auto` track takes free space up to its max-content size *before* a `1fr`
    // track expands — that is exactly what collapsed the name to `0px`.
    expect(head).not.toMatch(/grid-template-columns:[^;]*\bauto\s*;/);
    // …and what the key may contribute is bounded rather than open-ended.
    expect(rule(CSS, ".reason")).toMatch(/max-width:\s*\d/);

    // Phone: two tracks, and the key moves to its own full-width row under the name
    // rather than competing with it for one.
    expect(rule(PHONE, ".state-head")).toMatch(/grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\);/);
    expect(rule(PHONE, ".state-head .reason")).toContain("grid-column: 1 / -1");
  });

  it("repairs that collapse by layout, never by letting a name or a key overflow", () => {
    // Dropping `overflow-wrap: anywhere` from the heading would trade a collapsed column
    // for a sideways scroll this site does not have at any width. The wrapping stays.
    expect(CSS).toMatch(
      /\.state-head h2,\s*\.state-head h3\s*\{[^}]*overflow-wrap:\s*anywhere/,
    );
    // And the key is still printed whole — bounded in width, never elided or clipped.
    const reason = rule(CSS, ".reason");
    expect(reason).toContain("overflow-wrap: anywhere");
    for (const eliding of ["text-overflow", "white-space: nowrap", "overflow: hidden"]) {
      expect(reason).not.toContain(eliding);
    }
    // The key's own label is a single word and is held out of the same collapse: it is a
    // flex item beside the key, and the `anywhere` the key needs would otherwise let the
    // label break between letters once its container is bounded.
    expect(rule(CSS, ".reason-label")).toContain("white-space: nowrap");
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
    // Read from the sheet rather than a list here, so a grid utility that is added or
    // retired cannot leave this assertion covering a class the stylesheet dropped.
    const declared = [...CSS.matchAll(/^\.grid-(\d+) \{/gm)].map((match) => `.grid-${match[1]}`);
    expect(declared.length).toBeGreaterThan(0);
    const phone = CSS.slice(CSS.indexOf("@media (max-width: 620px)"));
    for (const selector of declared) {
      expect(phone, `${selector} has no phone rule`).toContain(selector);
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
      "src/app/_components/download-cta.tsx",
      "src/app/editor/_components/editor-shell.tsx",
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

  it("reaches only reviewed browser-safe package entries from the client graph", () => {
    // A `"use client"` module and everything it imports is compiled for the browser.
    // The `@sceneaxi/site-kit` barrel re-exports values out of
    // `node:fs`/`node:crypto`/`node:os` modules, while its state-panel subpath is a
    // deliberately narrow browser-safe entry. `@sceneaxi/schemas`,
    // `@sceneaxi/authoring-core`, `@sceneaxi/auth`, and `@sceneaxi/billing` are server
    // planes the site reaches only from `src/lib/`. A value import of any of them from
    // the client graph would either fail the browser build on an unresolvable `node:`
    // specifier or ship that whole graph to a visitor. `@sceneaxi/engine-presentation`
    // and the state-panel entry are exempt: both are browser-safe by contract.
    // Type-only imports erase, so they stay allowed everywhere.
    /**
     * Every module a source pulls in for its *value*; `import type` is erased and skipped.
     *
     * A re-export (`export … from "…"`) and a bare side-effect `import "…"` both load the
     * target exactly like a plain import does, so all three forms are matched — matching
     * only `import … from` would let a barrel-style or side-effecting module carry a whole
     * graph past this walk. One extractor serves both walks below so they cannot disagree
     * about what reaches a bundle.
     */
    const valueSpecifiers = (source: string): readonly string[] =>
      [
        ...source.matchAll(
          /\b(?:import|export)\s+(type\s+)?[^"';]*?from\s+"([^"]+)"|\bimport\s+"([^"]+)"/g,
        ),
      ].flatMap(([, typeKeyword, fromSpecifier, sideEffectSpecifier]) => {
        if (typeKeyword !== undefined) return [];
        const specifier = fromSpecifier ?? sideEffectSpecifier;
        return specifier === undefined ? [] : [specifier];
      });

    const valueImports = (relativePath: string): readonly string[] =>
      valueSpecifiers(read(relativePath));

    const clientGraph = new Set(
      UMBRELLA_SOURCES.filter((relativePath) => read(relativePath).startsWith('"use client"')),
    );
    // A Set iterated while it grows visits what the walk appends, so this is the whole
    // transitive closure rather than one hop.
    for (const relativePath of clientGraph) {
      const dir = relativePath.split("/").slice(0, -1).join("/");
      for (const specifier of valueImports(relativePath)) {
        if (!specifier.startsWith(".")) continue;
        const resolved = join(dir, specifier).split(sep).join("/").replace(/\.js$/, "");
        for (const candidate of [`${resolved}.ts`, `${resolved}.tsx`]) {
          if (UMBRELLA_SOURCES.includes(candidate)) clientGraph.add(candidate);
        }
      }
    }

    const browserSafeValueImports = new Set([
      "@sceneaxi/engine-presentation",
      "@sceneaxi/site-kit/state-panel",
    ]);
    const offenders = [...clientGraph].flatMap((relativePath) =>
      valueImports(relativePath)
        .filter(
          (specifier) =>
            specifier.startsWith("@sceneaxi/") && !browserSafeValueImports.has(specifier),
        )
        .map((specifier) => `${relativePath} -> ${specifier}`),
    );
    expect(offenders).toEqual([]);

    // An exempt entry is only browser-safe if everything it pulls in is: the modules it
    // imports are compiled into the same bundle, and they sit in the directory the
    // Node-bearing barrel re-exports from. So the closure is walked, not just the entry.
    const siteKitSrc = fileURLToPath(new URL("../../packages/site-kit/src/", import.meta.url));
    const exemptEntries = [...browserSafeValueImports]
      .filter((specifier) => specifier.startsWith("@sceneaxi/site-kit/"))
      .map((specifier) => `${specifier.slice("@sceneaxi/site-kit/".length)}.ts`);
    expect(exemptEntries.length).toBeGreaterThan(0);

    const siteKitGraph = new Set(exemptEntries);
    const notBrowserSafe: string[] = [];
    const unresolved: string[] = [];
    for (const entry of siteKitGraph) {
      const source = readFileSync(join(siteKitSrc, entry), "utf8");
      for (const specifier of valueSpecifiers(source)) {
        if (!specifier.startsWith(".")) {
          // A bare specifier is compiled into the same bundle as the entry but cannot be
          // walked from this directory, so it is safe only when it is itself a reviewed
          // browser-safe entry. That is what catches `node:` and every Node-bearing
          // workspace package — `@sceneaxi/authoring-core` is a declared site-kit
          // dependency whose value imports are the live idiom one directory over, and the
          // barrel re-exports out of `node:fs`/`node:crypto`/`node:os`.
          if (!browserSafeValueImports.has(specifier)) {
            notBrowserSafe.push(`${entry} -> ${specifier}`);
          }
          continue;
        }
        const target = `${specifier.replace(/^\.\//, "").replace(/\.js$/, "")}.ts`;
        if (existsSync(join(siteKitSrc, target))) siteKitGraph.add(target);
        else unresolved.push(`${entry} -> ${specifier}`);
      }
    }
    expect(notBrowserSafe).toEqual([]);
    expect(unresolved).toEqual([]);
    // The walk reached past the entry itself, so the guard is as deep as the risk.
    expect(siteKitGraph.size).toBeGreaterThan(exemptEntries.length);
  });

  it("names only statuses Foundations publishes, with their published labels", () => {
    // The browser-safe shared model now reads the vocabulary directly; the site carries
    // no restated id or label that could drift.
    const expected = [
      ["ok", "validated"],
      ["warn", "needs-review"],
      ["deny", "refused"],
      ["iso", "isolated"],
    ] as const;
    for (const [tone, id] of expected) {
      const model = createStatePanelModel({ tone, title: "State" });
      expect(model.status.id).toBe(id);
      expect(model.status.label).toBe(
        FOUNDATION_STATUSES.find((status) => status.id === id)?.label,
      );
    }
    expect(read("src/app/_components/state-panel.tsx")).not.toMatch(
      /\{ id: "[a-z-]+", label: "[^"]+" \}/,
    );
  });
});

describe("the Engine Desktop editor shell stays honest (sceneaxi#184)", () => {
  const SHELL = read("src/app/editor/_components/editor-shell.tsx");
  const PAGE = read("src/app/editor/page.tsx");

  it("draws the shared editor-shell structure, not an invented dashboard", () => {
    // Title bar, mode rail, dock strip, inspector, assistant, status bar, and
    // the command palette — the archive's regions, each present as a landmark
    // or labelled region in the one shell component.
    for (const region of [
      'className="ed-titlebar"',
      'className="ed-rail"',
      'className="ed-dock"',
      'className="ed-inspector"',
      'className="ed-assistant"',
      'className="ed-status"',
      'aria-label="Command palette"',
    ]) {
      expect(SHELL).toContain(region);
    }
    // The chrome is data-driven: modes, menus, and dock tabs come from the
    // view the server built, never from a literal list in JSX.
    expect(SHELL).toContain("view.modes.map");
    expect(SHELL).toContain("view.menus.map");
    expect(SHELL).toContain("view.profiles.map");
  });

  it("keeps a document outline under the application chrome", () => {
    // The archive draws a title bar rather than a page heading, but the route is
    // still a document: without an `h1` its section titles are `h3`s under
    // nothing, which is the heading-order jump this file already gates for the
    // hero. The name is clipped rather than `display: none`, so it stays in the
    // accessibility tree, and the panel heads carry level 2 exactly as the
    // desktop chrome renders the same heads.
    expect(SHELL).toContain('<h1 className="ed-shell-title">');
    expect(SHELL).toContain('<h2 className="ed-panel-head">');
    expect(SHELL).not.toContain('<div className="ed-panel-head">');
    expect(CSS).toMatch(/\.ed-shell-title \{[^}]*clip-path: inset\(50%\)/);
    expect(CSS).not.toMatch(/\.ed-shell-title \{[^}]*display: none/);
    // Promoting a head to a heading must not repaint it: the `h2` element rule
    // carries the sheet's display weight and line box, so the panel head pins
    // its own rather than inheriting them.
    expect(CSS).toMatch(/\.ed-panel-head \{[^}]*font-weight: 400;/);
    expect(CSS).toMatch(/\.ed-panel-head \{[^}]*line-height: 1;/);
  });

  it("keeps every editor metric owned by the stylesheet, in archive values", () => {
    // The structural metrics the shared model carries (EDITOR_SHELL_METRICS):
    // title bar 36, rail 56, left dock 274, inspector 326, assistant 344,
    // view tabs 32, dock 228 (252 for animate), status bar 27.
    for (const rule of [
      ".ed-titlebar {\n  height: 36px;",
      ".ed-rail {\n  width: 56px;",
      ".ed-left {\n  width: 274px;",
      ".ed-inspector {\n  width: 326px;",
      ".ed-assistant {\n  width: 344px;",
      ".ed-viewtabs {\n  height: 32px;",
      ".ed-dock {\n  height: 228px;",
      ".ed-status {\n  height: 27px;",
    ]) {
      expect(CSS).toContain(rule);
    }
    expect(CSS).toContain('.edshell[data-mode="animate"] .ed-dock {\n  height: 252px;');
  });

  it("ships no archive fixture figure and no retired renderer copy", () => {
    // The pinned lists are read from their owners, not restated here: adding a
    // figure or a retired sentence has to extend this shipped-source check too,
    // which is what `EDITOR_SHELL_FABRICATED_FIGURES` claims about this file.
    expect(EDITOR_SHELL_FABRICATED_FIGURES.length).toBeGreaterThan(0);
    expect(EDITOR_SHELL_RETIRED_COPY.length).toBeGreaterThan(0);
    for (const source of [SHELL, PAGE, CSS]) {
      for (const pinned of [
        ...EDITOR_SHELL_FABRICATED_FIGURES,
        ...EDITOR_SHELL_RETIRED_COPY,
      ]) {
        expect(source).not.toContain(pinned);
      }
    }
  });

  it("keeps engine state server-owned: no client mutation of the session", () => {
    // Client state is view state only; every live control is a link or a GET
    // form back to /editor, so the browser can never show a scene the server
    // session did not produce.
    expect(SHELL).toContain('method="get" action="/editor"');
    expect(SHELL).not.toContain("fetch(");
    expect(SHELL).not.toContain('method="post"');
    // The one state hook family is React's, applied to chrome only.
    expect(SHELL).toContain("useState<ModeId>");
  });

  it("renders every control through the one kind-aware helper", () => {
    // A control cannot reach the document without its kind: the helper stamps
    // data-kind, and inert controls keep a focus stop with a resolving
    // describedby — the desktop chrome's accounting rule, kept here.
    expect(SHELL).toContain("function ShellButton");
    expect(SHELL).toContain('"aria-disabled": true');
    expect(SHELL).toContain("aria-describedby");
    expect(SHELL).toContain("legendId");
    // The legend prints the whole closed registry once.
    expect(SHELL).toContain("view.refusalLegend.map");
  });

  it("projects the Kids refusal as the whole editor body, exits stay live", () => {
    expect(SHELL).toContain("view.kidsLock.code");
    expect(SHELL).toContain("ed-kids-lock");
    // The profile chips are not demoted — a refuse-only state must be exitable.
    expect(SHELL).toContain("a refuse-only state is a state you can");
    // The assistant seat becomes the deny, and it is not reopenable copy. The
    // renderer prints the view's own code — the Model Provider Port's reason,
    // never respelled on the surface.
    expect(SHELL).toContain("{view.assistant.kidsDenyCode}");
    expect(SHELL).not.toContain("THIRD_PARTY_LLM_DENIED_BY_DEFAULT");
  });

  it("seats the Kids assistant deny the same way it seats an open one", () => {
    // The compact tier lifts the assistant out of flow; below it the narrow
    // tier makes `.ed-body` a grid whose placements name every other panel, so
    // a seat that stayed docked would auto-place into an implicit row inside
    // `.edshell { overflow: hidden }`.
    expect(CSS).toContain('.ed-assistant:not([data-assistant="closed"]) {');
    expect(CSS).not.toContain('.ed-assistant[data-assistant="open"] {');
  });

  it("keeps a drawing surface in the reflowed tier it declares supported", () => {
    // The tier above the shared minimum is supported, so the canvas has to keep
    // pixels there. A bare `1.6fr` row does not: its share at 900×600 is 330px
    // and the view tabs, copy band, and dock consume it whole. The row's floor
    // is therefore the sum of those three plus the canvas minimum, and the
    // canvas carries that minimum itself.
    const narrow = CSS.slice(CSS.indexOf("@media (max-width: 1179px), (max-height: 659px)"));
    const block = narrow.slice(0, narrow.indexOf("\n}\n") + 3);
    for (const declaration of [
      "--ed-narrow-dock:",
      "--ed-narrow-note:",
      "--ed-narrow-canvas:",
      "min-height: var(--ed-narrow-canvas);",
      "max-height: var(--ed-narrow-note);",
      "height: var(--ed-narrow-dock);",
    ]) {
      expect(block).toContain(declaration);
    }
    expect(block).toContain("var(--ed-narrow-note) + var(--ed-narrow-dock)");
    // The timeline dock is the specific rule, so shrinking `.ed-dock` alone
    // would leave `animate` at 252px and take the canvas back.
    expect(block).toContain('.edshell[data-mode="animate"] .ed-dock');
  });

  it("carries the active mode across a live control's own navigation", () => {
    // Every live control is a full-page navigation and its href was built in
    // the mode the URL named, so the shell rebuilds each one in the mode the
    // reader switched to — otherwise Run's own Play control returns to Build,
    // away from the panel that shows its result. Mode stays view state: the
    // parameter names no engine operation.
    expect(SHELL).toContain("const [mode, setMode] = useState<ModeId>(view.activeModeId);");
    expect(SHELL).toContain("href={hrefInMode(binding.href, activeMode)}");
    expect(SHELL).toContain("<ActiveModeContext value={mode}>");
    // A submit is a navigation too.
    expect(SHELL).toContain('<input type="hidden" name="mode" value={mode} />');
  });

  it("refuses below the shared minimum window rather than degrading", () => {
    // The block prints the view's own code and wording rather than restating
    // either, so the refusal cannot drift from the closed registry it names.
    expect(EDITOR_SHELL_WEB_REFUSALS.windowBelowMinimum).toBe(
      "EDITOR_WINDOW_BELOW_MINIMUM",
    );
    expect(SHELL).toContain("{view.windowMinimum.code}");
    expect(SHELL).toContain("{view.windowMinimum.message}");
    expect(SHELL).not.toContain("EDITOR_WINDOW_BELOW_MINIMUM");
    expect(CSS).toContain("@media (max-width: 899px), (max-height: 599px)");
  });

  it("withdraws the command palette entirely under the Kids lock", () => {
    // The palette is part of the editor body the refuse-only profile replaces,
    // so neither the opener nor ⌘K may reach it — otherwise the overlay's live
    // play row stays reachable behind a refusal that claims the body is gone.
    expect(SHELL).toContain("const paletteOpen = paletteRequested && !kids;");
    expect(SHELL).toContain("if (kids) return;");
    // And the opener itself is demoted with the policy's own code, like the rail.
    const opener = SHELL.slice(SHELL.indexOf("control={view.paletteOpener}"));
    expect(opener.slice(0, 400)).toContain(
      "demotedRefusal={kids ? view.kidsLock.code : undefined}",
    );
  });

  it("contains focus in the palette it declares modal", () => {
    // `aria-modal` promises the rest of the shell is out of reach, so every
    // sibling region the overlay covers is inert while it is open. The refusal
    // legend is deliberately not: `aria-describedby` has to keep resolving into
    // it from the palette's own inert rows.
    expect(SHELL).toContain('role="dialog" aria-modal="true"');
    for (const region of [
      '<header className="ed-titlebar" aria-label="Editor title bar" inert={paletteOpen}>',
      '<div className="ed-body" inert={paletteOpen}>',
      '<footer className="ed-status" aria-label="Editor status" inert={paletteOpen}>',
    ]) {
      expect(SHELL).toContain(region);
    }
    expect(SHELL).toContain('<div className="ed-legend" hidden>');
    // The below-minimum note is deliberately never inert: it is the only thing
    // that surface renders, and the tier hides the overlay in CSS instead.
    expect(SHELL).toContain('<div className="ed-minimum" role="note">');
  });

  it("returns palette focus after the inert regions are released", () => {
    // Restoring focus inside a close handler cannot work: the regions the return
    // target lives in still carry `inert` at that point, so `focus()` is a no-op.
    // The restore therefore lives in the effect that runs after the commit.
    expect(SHELL).toContain("onClick={() => setPaletteRequested(false)}");
    const effect = SHELL.slice(SHELL.indexOf("if (paletteOpen) {"));
    expect(effect.slice(0, 220)).toContain("paletteReturnFocus.current?.focus();");
    // Exactly one restore, and it is that one — no close handler may reintroduce
    // a synchronous one alongside it.
    expect(SHELL.split("paletteReturnFocus.current?.focus();")).toHaveLength(2);
  });

  it("withdraws the palette below the shared minimum window", () => {
    // The tier refusal claims the whole surface, and the palette is script-owned
    // with no knowledge of the tier — so the stylesheet withdraws its scrim too,
    // or one keystroke paints a live play link over a refusal.
    const tier = CSS.slice(CSS.indexOf("@media (max-width: 899px), (max-height: 599px)"));
    const block = tier.slice(0, tier.indexOf("\n}\n") + 3);
    for (const region of [
      ".ed-titlebar",
      ".ed-body",
      ".ed-status",
      ".ed-palette-scrim",
    ]) {
      expect(block).toContain(region);
    }
    expect(block).toContain("display: none !important;");
  });

  it("points every dock tab at a panel that exists", () => {
    // Only the shown tab's content renders, so a per-tab `aria-controls` would
    // name three IDREFs that resolve to nothing. One panel owns them all.
    expect(SHELL).toContain("aria-controls={DOCK_PANEL_ID}");
    expect(SHELL).toContain("id={DOCK_PANEL_ID}");
    expect(SHELL).toContain('aria-labelledby={`dock-${shownDockTab}`}');
    expect(SHELL).not.toContain("dock-panel-");
  });

  it("filters the palette it offers to filter", () => {
    // An input that advertises "Filter commands" has to filter, so the rows the
    // groups draw are the filtered ones, not the whole set.
    expect(SHELL).toContain("onChange={(event) => setPaletteQuery(event.target.value)}");
    expect(SHELL).toContain("const rows = paletteRows.filter");
  });

  it("renders the run controls the view mints, in Run mode", () => {
    // Both are `live` links back to /editor; a minted control that reaches no
    // element is a control nothing can use.
    expect(SHELL).toContain("control={view.run.playPause}");
    expect(SHELL).toContain("control={view.run.reset}");
  });

  it("keeps the viewport's own copy beside the viewport, in every mode", () => {
    // Neither line belongs to one mode's inspector: what the canvas draws and
    // what it deliberately never does is true of all seven.
    expect(SHELL).toContain("{viewportCopy.lede}");
    expect(SHELL).toContain("{viewportCopy.honesty}");
    const viewportColumn = SHELL.slice(
      SHELL.indexOf('className="ed-viewport-col"'),
      SHELL.indexOf('className="ed-dock"'),
    );
    expect(viewportColumn).toContain("{viewportCopy.lede}");
    expect(viewportColumn).toContain("{viewportCopy.honesty}");
  });

  it("states that the applied save does not survive the request", () => {
    expect(SHELL).toContain("{view.changes.savedLabel}");
    expect(SHELL).toContain("{view.changes.persistenceNote}");
    expect(SHELL).toContain("{view.changes.persistencePin}");
  });

  it("draws the archive's per-row change decisions inert, through the helper", () => {
    // Apply is E1 all-or-nothing and already happened, so the ✕/✓ the archive
    // draws per row ship refusing rather than missing.
    expect(SHELL).toContain("view.changes.rowDecisions");
    expect(SHELL).toMatch(/<ShellButton\s+control=\{decision\.reject\}/);
    expect(SHELL).toMatch(/<ShellButton\s+control=\{decision\.accept\}/);
  });

  it("gives every form control the id and kind its minted control declares", () => {
    // `view.edit.*` are minted `live`, so the elements that carry them have to
    // say so — otherwise the accounting index names four live edit controls the
    // document does not expose.
    for (const wiring of [
      "id={view.edit.selection.id}",
      'data-kind={view.edit.selection.kind}',
      "id={view.edit.translation.id}",
      'data-kind={view.edit.translation.kind}',
      "id={view.edit.objects.id}",
      'data-kind={view.edit.objects.kind}',
      "id={view.edit.apply.id}",
      'data-kind={view.edit.apply.kind}',
    ]) {
      expect(SHELL).toContain(wiring);
    }
    // The scene tree's selection links are minted controls too, drawn through
    // the same helper rather than as bare anchors.
    expect(SHELL).toContain("<ShellButton control={row.select}");
    // And every remaining interactive element on the route declares a kind.
    const viewport = read("src/app/editor/_components/editor-viewport.tsx");
    expect(viewport.match(/<button/g)?.length).toBe(
      viewport.match(/data-kind="view"/g)?.length,
    );
  });

  it("collapses the site chrome for the editor route only, by removal", () => {
    const layout = read("src/app/editor/layout.tsx");
    expect(layout).toContain(".masthead, body > footer, .skip-link { display: none; }");
    // Scoped to the root layout's own footer: the shell's status bar is a
    // <footer> too, and a type selector would reach it.
    expect(layout).not.toContain(", footer,");
  });
});
