/**
 * Foundations v2 tokens: transcription fidelity, CSS emission, and the
 * accessibility contract.
 *
 * The contrast assertions are the point of this file. The palette is fixed by the
 * design source, so the useful check is not "is this hex right" but "is each
 * foreground token measured against every neutral surface it can land on, at the
 * WCAG floor its declared role claims". A token cannot be promoted to `body` by
 * editing a table — only by contrast.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FOUNDATIONS_SOURCE,
  FOUNDATIONS_VERSION,
  FOUNDATION_COLORS,
  FOUNDATION_COLOR_LAWS,
  FOUNDATION_CONTRAST_MINIMUMS,
  FOUNDATION_CONTRAST_ROLES,
  FOUNDATION_NEUTRAL_TOKENS,
  FOUNDATION_RADII,
  FOUNDATION_SPACING,
  FOUNDATION_STATUSES,
  FOUNDATION_SURFACES,
  FOUNDATION_SURFACE_ACCENTS,
  FOUNDATION_TYPE_SCALE,
  SIGNAL_COLORS,
  SIGNAL_DENSITIES,
  SIGNAL_LAYER_ORDER,
  SIGNAL_MOTION,
  SIGNAL_PAIRS,
  SIGNAL_PENDING_PLATE,
  SIGNAL_STATES,
  contrastRatio,
  foundationsMotionCss,
  signalColor,
  signalCss,
  signalPairRatio,
  signalPendingPlateCss,
  signalStoreBlockCss,
  foundationsBaseCss,
  foundationsCss,
  foundationsStatusCss,
  foundationsSurfacesCss,
  foundationsVariablesCss,
  meetsContrast,
  operateCssVars,
  resolveSurfaceAccent,
} from "@sceneaxi/site-kit";
import type { FoundationContrastRole, SiteResult } from "@sceneaxi/site-kit";

const hexOf = (token: string): string => {
  const color = FOUNDATION_COLORS.find((entry) => entry.token === token);

  if (color === undefined) throw new Error(`no such token: ${token}`);

  return color.hex;
};

const unwrap = (result: SiteResult<string>): string => {
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);

  return result.value;
};

describe("Foundations v2 transcription", () => {
  it("names the archive it was transcribed from", () => {
    expect(FOUNDATIONS_VERSION).toBe("v2");
    expect(FOUNDATIONS_SOURCE.archiveSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(FOUNDATIONS_SOURCE.file).toBe("SceneAxi Foundations.dc.html");
  });

  it("carries the four printed colour groups and 24 tokens", () => {
    expect(FOUNDATION_COLORS).toHaveLength(24);
    expect([...new Set(FOUNDATION_COLORS.map((color) => color.group))]).toEqual([
      "neutral",
      "line-text",
      "accent-semantic",
      "axis-surface",
    ]);
  });

  it("uses every token name exactly once, in CSS custom-property form", () => {
    const tokens = FOUNDATION_COLORS.map((color) => color.token);
    expect(new Set(tokens).size).toBe(tokens.length);

    for (const token of tokens) expect(token).toMatch(/^--[a-z0-9-]+$/);
  });

  it("pins the load-bearing semantic hexes", () => {
    expect(hexOf("--accent")).toBe("#F1EEE4");
    expect(hexOf("--ok")).toBe("#5EEAD4");
    expect(hexOf("--danger")).toBe("#FF4D5E");
    expect(hexOf("--stale")).toBe("#7A6448");
    expect(hexOf("--bg-base")).toBe("#07080A");
  });

  it("does not invent the unprinted --fg-3 level", () => {
    expect(FOUNDATION_COLORS.some((color) => color.token === "--fg-3")).toBe(false);
    expect(FOUNDATION_COLORS.filter((color) => color.token.startsWith("--fg"))).toHaveLength(3);
  });

  it("keeps the three colour laws with their rails", () => {
    expect(FOUNDATION_COLOR_LAWS.map((law) => law.id)).toEqual([
      "accent-means-pending",
      "mint-means-verified",
      "red-means-refused",
    ]);
    // v6: pending is lever yellow (`SIGNAL_COLORS` --pending), no longer the accent.
    expect(FOUNDATION_COLOR_LAWS.map((law) => law.rail)).toEqual([
      signalColor("--pending", "dark"),
      hexOf("--ok"),
      hexOf("--danger"),
    ]);
  });

  it("keeps the type scale to two families and the printed weights", () => {
    expect(FOUNDATION_TYPE_SCALE).toHaveLength(10);

    for (const step of FOUNDATION_TYPE_SCALE) {
      expect(["archivo", "mono"]).toContain(step.family);
      expect([400, 500, 600, 700]).toContain(step.weight);
    }

    // "Never for prose": every prose-sized step is Archivo.
    for (const token of ["lead", "body", "display-xl", "display-l", "heading", "subhead"]) {
      expect(FOUNDATION_TYPE_SCALE.find((step) => step.token === token)?.family).toBe("archivo");
    }
  });

  it("keeps spacing on the 4px base with no invented in-between step", () => {
    expect(FOUNDATION_SPACING.map((step) => step.px)).toEqual([4, 8, 12, 16, 24, 32, 44, 72]);

    for (const step of FOUNDATION_SPACING) expect(step.px % 4).toBe(0);
  });

  it("keeps 16px radius marked Kids-only", () => {
    const xl = FOUNDATION_RADII.find((radius) => radius.token === "radius-xl");
    expect(xl?.px).toBe(16);
    expect(xl?.use).toBe("Kids only");
  });

  it("gives a shadow only to the floating layer", () => {
    for (const surface of FOUNDATION_SURFACES) {
      if (surface.id === "float") expect(surface.shadow).not.toBe("none");
      else expect(surface.shadow.startsWith("inset") || surface.shadow === "none").toBe(true);
    }
  });

  it("is frozen all the way down", () => {
    expect(Object.isFrozen(FOUNDATION_COLORS)).toBe(true);
    expect(Object.isFrozen(FOUNDATION_COLORS[0])).toBe(true);
    expect(() => {
      // SAFETY: arrays have a numeric length; removing readonly here intentionally attempts a write to the frozen array.
      (FOUNDATION_COLORS as { length: number }).length = 0;
    }).toThrow();
  });
});

describe("accessibility: measured contrast, not asserted", () => {
  const neutrals = FOUNDATION_NEUTRAL_TOKENS.map((token) => ({ token, hex: hexOf(token) }));

  it("classifies every non-neutral colour token", () => {
    const classified = new Set(Object.keys(FOUNDATION_CONTRAST_ROLES));

    const foregrounds = FOUNDATION_COLORS.filter(
      (color) => !FOUNDATION_NEUTRAL_TOKENS.includes(color.token) && !color.token.startsWith("--line"),
    );

    expect(foregrounds.map((color) => color.token).sort()).toEqual([...classified].sort());
  });

  it.each(
    Object.entries(FOUNDATION_CONTRAST_ROLES).map(
      ([token, role]): ContrastCase => [token, role],
    ),
  )("%s clears the %s floor on every neutral surface", (token, role) => {
    for (const neutral of neutrals) {
      expect(
        meetsContrast(hexOf(token), neutral.hex, role),
        `${token} on ${neutral.token} measured ${contrastRatio(hexOf(token), neutral.hex).toFixed(2)}:1`,
      ).toBe(true);
    }
  });

  it("holds --fg-4 below the large-text floor, which is why it is non-text only", () => {
    // Recorded honestly: the sheet's disabled/units level is decorative contrast.
    // Classifying it as `body` or `large` would be a false accessibility claim.
    for (const neutral of neutrals) {
      expect(contrastRatio(hexOf("--fg-4"), neutral.hex)).toBeLessThan(
        FOUNDATION_CONTRAST_MINIMUMS.large,
      );
    }
  });

  it("keeps every status chip readable on its own fill", () => {
    for (const status of FOUNDATION_STATUSES) {
      expect(contrastRatio(status.fg, status.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the accent button's near-black label readable", () => {
    expect(contrastRatio(hexOf("--bg-base"), hexOf("--accent"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hexOf("--bg-base"), hexOf("--accent-hi"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("surface accents", () => {
  it("records every archive surface, including the ones this repo does not host", () => {
    expect(FOUNDATION_SURFACE_ACCENTS.map((surface) => surface.id)).toEqual([
      "umbrella",
      "engine-desktop",
      "engine-web",
      "game-assets",
      "web-assets",
      "kids",
    ]);
  });

  it("states a hover shade only where the sheet prints one", () => {
    const withHover = FOUNDATION_SURFACE_ACCENTS.filter((surface) => surface.accentHi !== null);
    expect(withHover.map((surface) => surface.id)).toEqual(["umbrella", "engine-desktop"]);

    for (const surface of withHover) expect(surface.accentHi).toBe("#FFFFFF");
  });

  it("resolves the storefront accents and repeats the accent as its own hover", () => {
    const game = resolveSurfaceAccent("game-assets");
    expect(game.ok && game.value).toEqual({ accent: "#E8544E", accentHi: "#E8544E" });
    const web = resolveSurfaceAccent("web-assets");
    expect(web.ok && web.value).toEqual({ accent: "#3FB8C9", accentHi: "#3FB8C9" });
  });

  it("refuses Kids by name rather than theming a surface this repo does not host", () => {
    const kids = resolveSurfaceAccent("kids");
    expect(kids.ok).toBe(false);
    expect(kids.ok ? null : kids.reason).toBe("KIDS_SURFACE_DENIED");
  });

  it("refuses an unknown surface", () => {
    const unknown = resolveSurfaceAccent("marketplace");
    expect(unknown.ok ? null : unknown.reason).toBe("FOUNDATION_SURFACE_UNKNOWN");
  });
});

describe("CSS emission", () => {
  it("emits every colour token into :root under its published name", () => {
    const css = unwrap(foundationsVariablesCss());
    expect(css.startsWith(":root {")).toBe(true);

    for (const color of FOUNDATION_COLORS) {
      expect(css).toContain(`${color.token}: ${color.hex};`);
    }

    for (const step of FOUNDATION_SPACING) expect(css).toContain(`--${step.token}: ${step.px}px;`);
    expect(css).toContain("--radius-full: 999px;");
    expect(css).toContain("--font-mono: 'JetBrains Mono'");
  });

  it("shifts only the accent pair for a storefront surface", () => {
    const base = unwrap(foundationsVariablesCss());
    const store = unwrap(foundationsVariablesCss({ surface: "game-assets" }));
    expect(store).toContain("--accent: #E8544E;");
    expect(store).toContain("--accent-hi: #E8544E;");

    // Same skeleton, same neutrals: nothing but the accent pair moves.
    for (const token of FOUNDATION_NEUTRAL_TOKENS) {
      expect(store).toContain(`${token}: ${hexOf(token)};`);
    }

    expect(store.split("\n")).toHaveLength(base.split("\n").length + 2);
  });

  it("refuses to emit a Kids theme", () => {
    const kids = foundationsVariablesCss({ surface: "kids" });
    expect(kids.ok ? null : kids.reason).toBe("KIDS_SURFACE_DENIED");
    const full = foundationsCss({ surface: "kids" });
    expect(full.ok ? null : full.reason).toBe("KIDS_SURFACE_DENIED");
  });

  it("emits the sheet's own document rules through variables, not raw hexes", () => {
    const css = foundationsBaseCss();
    expect(css).toContain("background: var(--bg-base)");
    expect(css).toContain("font-family: var(--font-ui)");
    // v6 (DIRECTION §2.5): the global link-hover ink rule is deleted (BASELINE defect 1).
    expect(css).not.toMatch(/a:hover[^{]*\{[^}]*\bcolor\s*:/);
    expect(css).toContain(":where(a) { color: var(--accent); text-decoration: none; }");
  });

  it("emits one class per surface step and one per status", () => {
    const surfaces = foundationsSurfacesCss();

    for (const surface of FOUNDATION_SURFACES) expect(surfaces).toContain(`.sx-surface-${surface.id} {`);
    const statuses = foundationsStatusCss();

    for (const status of FOUNDATION_STATUSES) expect(statuses).toContain(`.sx-status-${status.id} {`);
  });

  it("composes one stylesheet with a generated-by banner", () => {
    const css = unwrap(foundationsCss());
    expect(css).toContain("SceneAxi Foundations v2 — generated by @sceneaxi/site-kit.");
    expect(css).toContain(":root {");
    expect(css).toContain(".sx-surface-float {");
    expect(css).toContain(".sx-status-refused {");
    expect(css).toContain(SIGNAL_LAYER_ORDER);
  });

  it("keeps the package framework-free: the emitters return plain strings", () => {
    expect(isCssText(foundationsBaseCss())).toBe(true);
    expect(isCssText(foundationsSurfacesCss())).toBe(true);
  });
});

describe("D-4 motion: stated, not transcribed", () => {
  /**
   * The sheet states no motion, so these lines are recorded decision D-4 in
   * `docs/design-foundations.md`, pinned value for value: changing one changes it.
   */
  const motionDeclarations = [
    "  --motion-fast: 120ms;",
    "  --motion-base: 200ms;",
    "  --ease-standard: cubic-bezier(0.2, 0, 0, 1);",
  ];

  /** Every line declaring a motion duration or an easing curve, in emission order. */
  const motionLines = (css: string): string[] =>
    css.split("\n").filter((line) => /^\s*--(?:motion|ease)-/.test(line));

  it("declares exactly two durations and one easing curve in :root", () => {
    expect(motionLines(unwrap(foundationsVariablesCss()))).toEqual(motionDeclarations);
  });

  it.each(["umbrella", "game-assets", "web-assets"] as const)(
    "serves the %s sheet the same motion, since a surface shifts only its accent",
    (surface) => {
      expect(motionLines(unwrap(foundationsCss({ surface })))).toEqual(motionDeclarations);
    },
  );
});

describe("v6 Interlocking tokens (docs/redesign-v6/DIRECTION.md)", () => {
  const sheet = unwrap(signalCss({ scheme: "system" }));

  it("measures every sanctioned fg/bg pair in each scheme at its floor", () => {
    expect(SIGNAL_PAIRS.length).toBeGreaterThanOrEqual(40);

    for (const pair of SIGNAL_PAIRS) {
      for (const scheme of pair.schemes) {
        expect(signalPairRatio(pair, scheme), `${scheme} ${pair.fg} on ${pair.bg}`).toBeGreaterThanOrEqual(pair.min);
      }
    }
  });

  it("pairs every state with a label and an icon, never paint alone", () => {
    for (const state of SIGNAL_STATES) {
      expect(state.label.length).toBeGreaterThan(0);
      expect(state.icon.length).toBeGreaterThan(0);
      expect(sheet).toContain(`.sx-plate[data-state="${state.id}"]`);
    }

    for (const id of ["pending", "verified", "refused"]) expect(SIGNAL_STATES.map((state) => state.id)).toContain(id);
  });

  it("declares the five cascade layers first, and every emitted colour token", () => {
    expect(sheet.split("\n")[1]).toBe("@layer reset, tokens, base, components, utilities;");

    for (const color of SIGNAL_COLORS) expect(sheet).toContain(`${color.token}: ${color.light};`);
  });

  it("lets no hover rule change ink except a button's own --b-ink", () => {
    for (const rule of sheet.match(/[^{}]*:hover[^{]*\{[^}]*\}/g) ?? []) {
      const color = /(?:^|[;{\s])color\s*:\s*([^;]+);/.exec(rule.slice(rule.indexOf("{")));

      if (color !== null) expect(color[1]?.trim(), rule).toBe("var(--b-ink)");
    }

    expect(sheet).toContain(":where(a:hover) { text-decoration-thickness: 3px; }");
  });

  it("writes density custom properties per placement and motion tokens zeroed under reduce", () => {
    for (const density of SIGNAL_DENSITIES.filter((entry) => entry.emitted)) {
      expect(sheet).toContain(`--density-control: ${density.controlPx}px;`);
      expect(density.targetMinPx).toBeGreaterThanOrEqual(24);
    }

    expect(sheet).toContain('[data-density="compact"]');
    expect(sheet).not.toMatch(/(^|\n)\.state\s*\{/);

    for (const motion of SIGNAL_MOTION) expect(sheet).toContain(`${motion.token}: ${motion.value};`);
    expect(sheet).toMatch(/prefers-reduced-motion: reduce\) \{ :root \{ --catch: 0ms;/);
  });

  it("differs between the two stores only in the store token block", () => {
    const forge = unwrap(signalCss({ store: "forge" }));
    const vitrine = unwrap(signalCss({ store: "vitrine" }));

    expect(forge.replace(signalStoreBlockCss("forge"), "")).toBe(vitrine.replace(signalStoreBlockCss("vitrine"), ""));
    expect(forge).not.toBe(vitrine);
  });

  it("refuses to theme Kids", () => {
    const kids = signalCss({ surface: "kids" });
    expect(kids.ok ? null : kids.reason).toBe("KIDS_SURFACE_DENIED");
  });

  it("layers the legacy motion sheet too", () => {
    expect(foundationsMotionCss()).toContain(SIGNAL_LAYER_ORDER);
  });

  it("keeps the web-shell Operate token snapshot byte-identical to operateCssVars()", () => {
    // web-shell cannot import site-kit (docs/dependency-matrix.json), so it inlines a generated
    // copy; this read is the drift alarm. Regenerate per the snapshot's header.
    const snapshot = readFileSync(new URL("../../../apps/web-shell/src/operate-tokens.ts", import.meta.url), "utf8");
    const literal = /export const OPERATE_CSS_VARS: string = (".*");\n/.exec(snapshot)?.[1];

    expect(literal === undefined ? null : JSON.parse(literal)).toBe(operateCssVars());

    const plate = /export const OPERATE_PENDING_PLATE_CSS: string = (".*");\n/.exec(snapshot)?.[1];
    expect(plate === undefined ? null : JSON.parse(plate)).toBe(signalPendingPlateCss());
  });

  it("ships the yellow pending fill only together with its boundary line, in both schemes", () => {
    const { fill, ink, line } = SIGNAL_PENDING_PLATE;
    const components = sheet.slice(sheet.indexOf("@layer components {"));
    expect(components).toContain(signalPendingPlateCss());

    for (const rule of components.match(/[^{}]+\{[^{}]*background: var\((?:--pending|--commit)\)[^{}]*\}/g) ?? []) {
      expect(rule, rule).toContain(`var(${line})`);
    }

    for (const scheme of ["light", "dark"] as const) {
      expect(contrastRatio(signalColor(ink, scheme), signalColor(fill, scheme))).toBeGreaterThanOrEqual(4.5);

      for (const plane of ["--panel", "--panel-band", "--iron", "--iron-raised", "--well", "--bed", "--plate"]) {
        expect(contrastRatio(signalColor(line, scheme), signalColor(plane, scheme)), `${scheme} ${line} on ${plane}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

function isCssText(value: unknown): value is string {
  return typeof value === "string";
}

type ContrastCase = [string, FoundationContrastRole];
