import { describe, expect, it } from "vitest";
import {
  ACCENT,
  DEVIATIONS,
  LINE,
  SIGNAL,
  SUPERSEDED_V1,
  SURFACE,
  TEXT,
  TYPE,
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
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (high + 0.05) / (low + 0.05);
}

const SURFACES = Object.values(SURFACE).filter((value) => value !== SURFACE.backdrop);

describe("engine desktop visual tokens", () => {
  it("names the canonical archive it was implemented from", () => {
    expect(VISUAL_SOURCE.sha256).toBe(
      "ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159",
    );
    expect(VISUAL_SOURCE.member).toBe("Engine Desktop.dc.html");
  });

  it("carries the archive's own non-text values, unrounded", () => {
    // A "nearly right" surface colour is drift, so these are asserted as digits.
    expect(SURFACE.canvas).toBe("#07080A");
    expect(SURFACE.panel).toBe("#0D0F12");
    expect(SURFACE.header).toBe("#12151A");
    expect(LINE.strong).toBe("#1A1F26");
    expect(ACCENT.base).toBe("#FF6B2C");
    expect(ACCENT.hover).toBe("#FF8A54");
    expect(SIGNAL.ok).toBe("#5EEAD4");
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
      TEXT.superseded,
      ACCENT.base,
      ACCENT.noteText,
      SIGNAL.ok,
      SIGNAL.refuse,
      SIGNAL.info,
      SIGNAL.scene,
      SIGNAL.sceneText,
    ];
    const failures = textTokens.flatMap((token) =>
      SURFACES.filter((surface) => contrast(token, surface) < 4.5).map(
        (surface) => `${token} on ${surface} = ${contrast(token, surface).toFixed(2)}:1`,
      ),
    );
    expect(failures).toEqual([]);
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

  it("names the archive families first and requests no remote font", () => {
    expect(TYPE.sans).toContain("Archivo");
    expect(TYPE.mono).toContain("JetBrains Mono");
    expect(TYPE.sans).toContain("system-ui");
    expect(
      DEVIATIONS.some((row) => row.id === "webfont-not-fetched"),
    ).toBe(true);
  });
});
