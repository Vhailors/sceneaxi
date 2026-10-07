import { describe, expect, it } from "vitest";
import {
  ACCENT,
  AXIS,
  AXIS_STATE,
  AXIS_TEXT,
  CATEGORY,
  DENSITY,
  DEVIATIONS,
  MOTION,
  PLAY,
  PROPOSED,
  RADIUS,
  SELECTION,
  SPACE,
  TINT,
  TYPE_SCALE,
  INERT,
  FOUNDATIONS_V2_ALIGNMENT,
  FOUNDATIONS_V2_COLORS,
  FOUNDATIONS_V2_FAMILIES,
  FOUNDATIONS_V2_SOURCE,
  LINE,
  PROFILE_DOT,
  SCRIM,
  SIGNAL,
  SUPERSEDED_V1,
  SURFACE,
  TEXT,
  TYPE,
  VIEWPORT_GRADIENT,
  VISUAL_SOURCE,
  renderDesktopChrome,
  createDesktopVisualState,
  desktopVisualView,
} from "@sceneaxi/desktop-shell";

/**
 * Token-level evidence for the accepted Engine Desktop surface (sceneaxi#158).
 *
 * The contrast block is the point: the archive spends four greys below the WCAG
 * text floor, and `visual-tokens.ts` raises them. Recomputing the ratio here —
 * rather than trusting the comment beside each hex — is what stops the floor
 * being lowered by an edit that "looked about the same".
 */

/** WCAG 2.2 relative luminance. */
function luminance(hex: string): number {
  const value = hex.replace("#", "");

  const channel = (offset: number): number => {
    const raw = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;

    return raw <= 0.04045 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  // SAFETY: a two-element array literal sorted in place still has two numbers.
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];

  return (high + 0.05) / (low + 0.05);
}

const SURFACES = Object.values(SURFACE).filter((value) => value !== SURFACE.backdrop);

const TEXT_TOKENS = [
  TEXT.primary, TEXT.secondary, TEXT.label, TEXT.dim, TEXT.faint,
  ACCENT.base, ACCENT.hover, ACCENT.noteText,
  SIGNAL.ok, SIGNAL.refuse, SIGNAL.info, SIGNAL.scene, SIGNAL.sceneText, SIGNAL.warn,
  ...Object.values(AXIS_TEXT), PROPOSED.base, INERT.text,
];

/** Evaluate the shipped sRGB mix, including its declared percentage and operands. */
function tintColor(css: string): string {
  const match = /^color-mix\(in srgb, var\((--[a-z]+)\) (\d+)%, var\((--[a-z]+)\)\)$/.exec(css);

  if (!match) throw new Error(`Unsupported tint: ${css}`);

  const colors = new Map([
    ["--play", PLAY.frame], ["--proposed", PROPOSED.base],
    ["--panel", SURFACE.panel], ["--raised", SURFACE.raised],
  ]);

  const foreground = colors.get(match[1] ?? "");
  const background = colors.get(match[3] ?? "");

  if (!foreground || !background) throw new Error(`Unknown tint operands: ${css}`);
  const fraction = Number(match[2]) / 100;

  return `#${[1, 3, 5].map((offset) => {
    const front = Number.parseInt(foreground.slice(offset, offset + 2), 16);
    const back = Number.parseInt(background.slice(offset, offset + 2), 16);

    return Math.round(front * fraction + back * (1 - fraction)).toString(16).padStart(2, "0");
  }).join("")}`;
}

describe("engine desktop visual tokens", () => {
  it("names the canonical archive it was implemented from", () => {
    expect(VISUAL_SOURCE.sha256).toBe(
      "c4ecfce14440b56342781e53abd02f915446795d8ba2bf2fdf18d895bc950b51",
    );
    expect(VISUAL_SOURCE.member).toBe("direction-1-cinematic-pro.html");
  });

  it("carries the archive's own non-text values, unrounded", () => {
    // A "nearly right" surface colour is drift, so these are asserted as digits.
    expect(SURFACE.canvas).toBe("#0A0F1A");
    expect(SURFACE.panel).toBe("#0F1624");
    expect(SURFACE.header).toBe("#182236");
    expect(LINE.strong).toBe("#243044");
    expect(ACCENT.base).toBe("#46D8EC");
    expect(ACCENT.hover).toBe("#74E3F2");
    expect(SIGNAL.ok).toBe("#5FE3C0");
    expect(SIGNAL.refuse).toBe("#FF4D5E");
    expect(SIGNAL.scene).toBe("#A78BFA");
  });

  it("keeps every text token above 4.5:1 on every chrome surface", () => {
    const textTokens = [
      TEXT.primary,
      TEXT.secondary,
      TEXT.label,
      TEXT.dim,
      TEXT.faint,
      ACCENT.base,
      ACCENT.noteText,
      SIGNAL.ok,
      SIGNAL.refuse,
      SIGNAL.info,
      SIGNAL.scene,
      SIGNAL.sceneText,
      ...TEXT_TOKENS,
    ];

    const failures = textTokens.flatMap((token) =>
      SURFACES.filter((surface) => contrast(token, surface) < 4.5).map(
        (surface) => `${token} on ${surface} = ${contrast(token, surface).toFixed(2)}:1`,
      ),
    );

    expect(failures).toEqual([]);
  });

  it("keeps every text token above 4.5:1 on the actual Play and proposed mixes", () => {
    expect(TINT).toEqual({
      play: "color-mix(in srgb, var(--play) 6%, var(--panel))",
      proposed: "color-mix(in srgb, var(--proposed) 8%, var(--raised))",
    });

    for (const tint of Object.values(TINT)) {
      const background = tintColor(tint);

      for (const text of TEXT_TOKENS) {
        expect(contrast(text, background), `${text} on ${tint}`).toBeGreaterThanOrEqual(4.5);
      }
    }

    // Removed suggestion rows are red; the rejected 10% mix would fail this pairing.
    expect(contrast(SIGNAL.refuse, tintColor(TINT.proposed.replace("8%", "10%")))).toBeLessThan(4.5);
  });

  it("keeps non-text state and category tokens above 3:1 on every surface", () => {
    for (const token of [
      ...Object.values(SELECTION), ...Object.values(AXIS_STATE),
      ...Object.values(CATEGORY), ...Object.values(PLAY),
    ]) {
      for (const surface of SURFACES) {
        expect(contrast(token, surface), `${token} on ${surface}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("carries the redesign colour roles exactly", () => {
    expect(SIGNAL.warn).toBe("#F2C94C");
    expect(SELECTION).toEqual({ outline: "#FF9D3D", child: "#5B9CFF", hover: "#FFC58A" });
    expect(AXIS_STATE).toEqual({ hoverX: "#F29590", hoverY: "#A4DD97", hoverZ: "#8DBBFF", active: "#FFD84D" });
    expect(AXIS_TEXT).toEqual({ x: "#EE7A74", y: "#8AD47A", z: "#74AEFF" });
    expect(PROPOSED).toEqual({ base: "#FF8AD0" });
    expect(PLAY).toEqual({ frame: "#4FB0FF" });
    expect(CATEGORY).toEqual({
      object: "#8DB4F7", group: "#AEB9CA", light: "#F5D37A", camera: "#B8C4FF",
      audio: "#86E0A8", effect: "#F2B279", logic: "#D6A8FF",
    });
  });

  it("defines the type scale in pixels with tabular numeric fields", () => {
    expect(TYPE_SCALE).toEqual({
      caption: { size: 11, lineHeight: 16, weight: 400 },
      small: { size: 12, lineHeight: 16, weight: 400 },
      body: { size: 13, lineHeight: 18, weight: 400 },
      "body-strong": { size: 13, lineHeight: 18, weight: 600 },
      title: { size: 14, lineHeight: 20, weight: 600 },
      heading: { size: 16, lineHeight: 22, weight: 600 },
      display: { size: 20, lineHeight: 26, weight: 600 },
      hero: { size: 24, lineHeight: 30, weight: 650 },
      mono: { size: 12, lineHeight: 16, weight: 400, fontVariantNumeric: "tabular-nums" },
    });

    for (const token of Object.values(TYPE_SCALE)) {
      expect(token.size).toBeGreaterThanOrEqual(11);
      expect(Object.isFrozen(token)).toBe(true);
    }
  });

  it("defines the four-pixel spacing grid, radius scale and two densities", () => {
    expect(SPACE).toEqual({ 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 });
    expect(RADIUS).toEqual({ xs: 2, sm: 4, md: 6, lg: 10, pill: 999 });
    expect(DENSITY).toEqual({
      comfortable: { row: 28, control: 28, toolbarIcon: 32, panelHeader: 32, panelPadding: 12, body: 13 },
      compact: { row: 24, control: 24, toolbarIcon: 28, panelHeader: 28, panelPadding: 8, body: 12 },
    });

    for (const density of Object.values(DENSITY)) {
      expect(density.row).toBeGreaterThanOrEqual(24);
      expect(density.control).toBeGreaterThanOrEqual(24);
      expect(density.toolbarIcon).toBeGreaterThanOrEqual(24);
      expect(Object.isFrozen(density)).toBe(true);
    }
  });

  it("limits motion vocabulary to the three durations and two easings", () => {
    expect(MOTION).toEqual({
      fast: 100, base: 160, slow: 220,
      in: "cubic-bezier(.2,0,0,1)", out: "cubic-bezier(.4,0,1,1)",
    });
  });

  it("freezes every new token group", () => {
    for (const group of [SELECTION, AXIS_STATE, AXIS_TEXT, PROPOSED, PLAY, CATEGORY, TINT, TYPE_SCALE, SPACE, RADIUS, DENSITY, MOTION]) {
      expect(Object.isFrozen(group)).toBe(true);
    }
  });

  it("keeps text on the accent fill above 4.5:1", () => {
    expect(contrast(ACCENT.on, ACCENT.base)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ACCENT.on, ACCENT.hover)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the focus ring above 3:1 against every surface it can land on", () => {
    for (const surface of SURFACES) {
      expect(contrast(ACCENT.base, surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it("records every raised colour, and each archive value it replaced did fail", () => {
    const raised = DEVIATIONS.filter((row) => row.id.startsWith("text-contrast-"));
    expect(raised.length).toBeGreaterThan(0);

    for (const row of raised) {
      // The archive value failed on the darkest chrome surface...
      expect(contrast(row.archive, SURFACE.canvas)).toBeLessThan(4.5);

      // ...and the shipped replacement passes on every one of them.
      for (const surface of SURFACES) {
        expect(contrast(row.shipped, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("retires fixture-review paint from the desktop token contract", () => {
    expect("superseded" in TEXT).toBe(false);
    expect("okSurface" in SIGNAL).toBe(false);
    expect("okLine" in SIGNAL).toBe(false);
    expect(DEVIATIONS.map((row) => row.id)).not.toContain("text-contrast-7A6448");
    expect(
      FOUNDATIONS_V2_ALIGNMENT.find((row) => row.token === "--stale"),
    ).toMatchObject({ disposition: "absent" });
  });

  it("never reintroduces a value the superseded v1 pass carried", () => {
    const document = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState()),
    );

    for (const retired of SUPERSEDED_V1.retiredValues) {
      expect(document).not.toContain(retired);
    }

    // The retired amber must not be a token either, only absent from one render.
    const tokens = JSON.stringify({ SURFACE, LINE, ACCENT, SIGNAL, TEXT, TYPE });

    for (const retired of SUPERSEDED_V1.retiredValues) {
      expect(tokens).not.toContain(retired);
    }
  });

  /**
   * The inert state, which the contrast block above could not see.
   *
   * Both checks that guard this surface read a *declared* colour: this file
   * compares `TEXT` against `SURFACE`, and the recorded browser sweep reads
   * `getComputedStyle().color`. Element `opacity` composites a control toward
   * its background after both of them have looked, so `opacity:.72` on an inert
   * button and `opacity:.5` on a Kids rail label shipped at 3.67:1, 4.07:1, and
   * 2.16:1 under a recorded claim of zero failures. The fix is not a larger
   * fraction — it is that the dimmed state is a painted token, so the floor is
   * measured here, on the value that actually ships.
   */
  it("dims an inert control by paint, never by compositing", () => {
    const documents = [
      createDesktopVisualState(),
      createDesktopVisualState({ profile: "kids" }),
      createDesktopVisualState({ mode: "sculpt", sculpt: "running" }),
      createDesktopVisualState({ overlay: "palette" }),
    ].map((state) => renderDesktopChrome(desktopVisualView(state)));

    for (const document of documents) {
      // `@keyframes` is the one place a fraction is a transition rather than a
      // permanent state, so it is stripped and everything else must be clean.
      const declarations = document
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");

      expect([...declarations.matchAll(/opacity\s*:[^;}]*/g)].map(([d]) => d)).toEqual(
        [],
      );
    }

    // A demotion, not a decoration: dimmer than the ordinary secondary tier...
    expect(contrast(INERT.text, SURFACE.panel)).toBeLessThan(
      contrast(TEXT.dim, SURFACE.panel),
    );

    // ...and still readable on every surface an inert control can sit on.
    const failures = SURFACES.filter(
      (surface) => contrast(INERT.text, surface) < 4.5,
    ).map((surface) => `${INERT.text} on ${surface} = ${contrast(INERT.text, surface).toFixed(2)}:1`);

    expect(failures).toEqual([]);

    // The accent fill is the one background that is not a chrome surface: a
    // primary button and a pressed assistant mode keep it while inert.
    expect(contrast(INERT.onAccent, ACCENT.base)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(INERT.onAccent, ACCENT.hover)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(INERT.onAccent, ACCENT.base)).toBeLessThan(
      contrast(ACCENT.on, ACCENT.base),
    );

    // Paint is only the resting state: a single-class `:hover` that repaints a
    // label outranks `button.is-inert`, so each control class whose hover sets a
    // colour ships the inert answer beside it. Without these an inert control
    // looks live under the pointer, which the sweep — a resting-state read —
    // cannot see.
    for (const override of [
      ".menu-command.is-inert:hover,.menu-command.is-inert:focus-visible{background:none;color:var(--inert)}",
      ".ghost-button.is-inert:hover{border-color:var(--line-control);color:var(--inert)}",
      ".primary-button.is-inert,.primary-button.is-inert:hover{color:var(--inert-on-accent)}",
    ]) {
      expect(documents[0]).toContain(override);
    }

    // The rail glyph is `aria-hidden` decoration, so it is a line value and is
    // deliberately not held to the text floor.
    expect(Object.values(LINE)).toContain(INERT.glyph);
    expect(documents[0]).toContain("--inert:");
    expect(documents[0]).toContain("--inert-on-accent:");
  });

  it("names the archive families first and requests no remote font", () => {
    expect(TYPE.sans).toContain("system-ui");
    expect(TYPE.sans).toContain("Segoe UI");
    expect(TYPE.mono).toContain("ui-monospace");
    expect(TYPE.sans).not.toContain("Archivo");
    expect(TYPE.sans).not.toContain("Space Grotesk");
    expect(
      DEVIATIONS.some((row) => row.id === "webfont-not-fetched"),
    ).toBe(true);
  });
});

/**
 * Foundations v2 alignment (captain decision D1, 2026-07-28).
 *
 * `packages/site-kit` owns the shared token layer (D2) but the dependency matrix
 * allows this package only `@sceneaxi/schemas` and `@sceneaxi/authoring-core`, so
 * the sheet's values are duplicated here rather than imported. That duplication is
 * only safe if it is *checked*, which is what this block is for: every token the
 * sheet prints is accounted for, and every one this surface carries must equal the
 * sheet's hex exactly. Editing a token on either side without the other now fails.
 */
describe("foundations v2 alignment", () => {
  const sheetTokens = Object.keys(FOUNDATIONS_V2_COLORS);

  it("is transcribed from the same archive site-kit transcribes", () => {
    expect(FOUNDATIONS_V2_SOURCE.archiveSha256).toBe(
      "ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159",
    );
    expect(FOUNDATIONS_V2_SOURCE.member).toBe("SceneAxi Foundations.dc.html");
    expect(FOUNDATIONS_V2_SOURCE.upstream).toBe(
      "packages/site-kit/src/design-tokens.ts",
    );
    // The duplication is boundary-forced, not preference. If site-kit ever becomes
    // reachable, this reason is the thing that should stop being true.
    expect(FOUNDATIONS_V2_SOURCE.duplicationReason).toBe(
      "dependency-matrix-forbids-site-kit",
    );
    expect(VISUAL_SOURCE.sha256).not.toBe(FOUNDATIONS_V2_SOURCE.archiveSha256);
  });

  it("accounts for every token the sheet prints, exactly once", () => {
    const aligned = FOUNDATIONS_V2_ALIGNMENT.map((row) => row.token);
    expect([...aligned].sort()).toEqual([...sheetTokens].sort());
    expect(new Set(aligned).size).toBe(aligned.length);
  });

  it("carries every adopted token at the sheet's exact hex", () => {
    const carried = FOUNDATIONS_V2_ALIGNMENT.filter(
      (row) => row.disposition === "carried",
    );

    expect(carried.length).toBeGreaterThan(0);

    // SAFETY: every carried row names a sheet token (FOUNDATIONS_V2_COLORS key).
    const drift = carried
      .filter(
        (row) =>
          row.value !==
          FOUNDATIONS_V2_COLORS[row.token as keyof typeof FOUNDATIONS_V2_COLORS],
      )
      .map(
        (row) =>
          `${row.token} sheet=${FOUNDATIONS_V2_COLORS[row.token as keyof typeof FOUNDATIONS_V2_COLORS]} ${row.local}=${row.value}`,
      );

    expect(drift).toEqual([]);
  });

  it("records a reason for every semantic fork from the sheet", () => {
    const semantic = FOUNDATIONS_V2_ALIGNMENT.filter(
      (row) => row.disposition === "semantic",
    );

    expect(semantic.length).toBeGreaterThan(0);

    for (const row of semantic) {
      expect(row.reason ?? "").not.toHaveLength(0);
      expect(row.value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }

    expect(DEVIATIONS.map((row) => row.id)).toContain("desktop-first-cinematic-pro");
  });

  it("raises a sheet token only where the sheet value fails the text floor", () => {
    const raised = FOUNDATIONS_V2_ALIGNMENT.filter(
      (row) => row.disposition === "raised",
    );

    expect(raised.length).toBeGreaterThan(0);

    for (const row of raised) {
      // SAFETY: alignment rows are keyed by sheet tokens.
      const sheet =
        FOUNDATIONS_V2_COLORS[row.token as keyof typeof FOUNDATIONS_V2_COLORS];

      // The raise has to be earned: the sheet value must actually fail here...
      expect(contrast(sheet, SURFACE.canvas)).toBeLessThan(4.5);

      // ...the shipped value must pass everywhere...
      for (const surface of SURFACES) {
        // SAFETY: a raised row carries the shipped hex value it raised the token to.
        expect(contrast(row.value as string, surface)).toBeGreaterThanOrEqual(4.5);
      }

      // ...and it must be a recorded deviation, not an unexplained edit.
      expect(DEVIATIONS.map((d) => d.id)).toContain(row.deviation);
    }
  });

  it("gives a reason for every sheet token it does not carry", () => {
    // The claim is about what *ships*, so the emitted document is checked too:
    // a token declared absent that the stylesheet writes as a literal hex would
    // otherwise pass the token-object check and still be on the surface.
    const document = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState()),
    );

    for (const row of FOUNDATIONS_V2_ALIGNMENT.filter(
      (entry) => entry.disposition === "absent",
    )) {
      expect(row.reason ?? "").not.toHaveLength(0);

      // An absent token must not be smuggled in under a different local name.
      // SAFETY: alignment rows are keyed by sheet tokens.
      const sheet =
        FOUNDATIONS_V2_COLORS[row.token as keyof typeof FOUNDATIONS_V2_COLORS];

      const tokens = JSON.stringify({
        SURFACE,
        LINE,
        ACCENT,
        SIGNAL,
        TEXT,
        INERT,
        SELECTION,
        AXIS_STATE,
        AXIS_TEXT,
        PROPOSED,
        PLAY,
        CATEGORY,
        PROFILE_DOT,
        VIEWPORT_GRADIENT,
      });

      expect(tokens, row.token).not.toContain(sheet);
      expect(document, row.token).not.toContain(sheet);
    }
  });

  it("draws every colour it ships from a token the alignment accounts for", () => {
    // Any raw hex left in the stylesheet is a value no disposition covers, which
    // is how a declared-absent token got shipped once already.
    const document = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState()),
    );

    const declared = new Set(
      [
        ...Object.values(SURFACE),
        ...Object.values(LINE),
        ...Object.values(ACCENT),
        ...Object.values(SIGNAL),
        ...Object.values(TEXT),
        ...Object.values(INERT),
        ...Object.values(AXIS),
        ...Object.values(SELECTION),
        ...Object.values(AXIS_STATE),
        ...Object.values(AXIS_TEXT),
        ...Object.values(PROPOSED),
        ...Object.values(PLAY),
        ...Object.values(CATEGORY),
        ...Object.values(PROFILE_DOT),
        ...Object.values(VIEWPORT_GRADIENT),
      ].map((value) => value.toUpperCase()),
    );

    const shipped = [...document.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map(([hex]) =>
      hex.toUpperCase(),
    );

    expect(shipped.length).toBeGreaterThan(0);
    expect([...new Set(shipped)].filter((hex) => !declared.has(hex))).toEqual([]);

    // Decimal notation is where this check used to be blind: an `rgba()` triple
    // one digit off a token passes a hex scan, and matching only *exact* copies
    // of a token still let `rgba(4,5,7,.68)` ship beside `SURFACE.backdrop`
    // #050607. So no `rgb()`/`rgba()` at all is allowed: a translucent value is
    // written as a `color-mix()` over the custom property of a declared token
    // (`SCRIM`), which moves when that token does.
    expect([...document.matchAll(/rgba?\([^)]*\)/g)].map(([call]) => call)).toEqual(
      [],
    );

    for (const value of Object.values(SCRIM)) {
      expect(value).toMatch(/^color-mix\(in srgb, var\(--[a-z-]+\) \d{1,3}%, transparent\)$/);
      expect(document).toContain(value);
    }
  });

  it("uses the sheet's two families as the first choice in each stack", () => {
    expect(TYPE.sans).not.toContain(FOUNDATIONS_V2_FAMILIES.sans);
    expect(TYPE.mono).not.toContain(FOUNDATIONS_V2_FAMILIES.mono);
    expect(TYPE.sans.startsWith("-apple-system")).toBe(true);
    expect(TYPE.mono.startsWith("ui-monospace")).toBe(true);
  });

  it("renders the adopted accent and near-black into the actual document", () => {
    const document = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState()),
    );

    // The decision is about what ships, so assert the emitted surface, not tokens.
    expect(document).toContain(ACCENT.base);
    expect(document).toContain(SURFACE.canvas);
    expect(document).not.toContain(FOUNDATIONS_V2_COLORS["--accent"]);
    expect(document).not.toContain(FOUNDATIONS_V2_FAMILIES.sans);
  });
});
