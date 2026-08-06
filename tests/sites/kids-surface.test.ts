import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FOUNDATION_COLORS, contrastRatio } from "@sceneaxi/site-kit";
import * as profile from "../../packages/profile-kids/src/index.ts";
import * as site from "../../sites/kids/src/index.ts";

const ROOT = new URL("../../", import.meta.url);

const KIDS_STYLESHEET = readFileSync(new URL("sites/kids/src/app/globals.css", ROOT), "utf8");

/**
 * The Kids origin may not depend on `@sceneaxi/site-kit`, so its stylesheet carries a
 * copy of the Foundations neutrals. This root test is what keeps the copy honest —
 * the same job `FOUNDATIONS_V2_ALIGNMENT` does for the desktop shell — without giving
 * the isolated site an import edge.
 *
 * Recorded divergence: the Kids surface ships one border weight and spends it on the
 * strong one, so its `--line` carries Foundations' `--line-strong` hex.
 */
const KIDS_FOUNDATION_ALIGNMENT: readonly (readonly [string, string])[] = Object.freeze([
  ["--bg-base", "--bg-base"],
  ["--bg-panel", "--bg-panel"],
  ["--bg-raised", "--bg-raised"],
  ["--bg-control", "--bg-control"],
  ["--line", "--line-strong"],
  ["--fg", "--fg"],
  ["--fg-2", "--fg-2"],
  ["--focus", "--fg"],
  ["--kids", "--kids"],
  ["--danger", "--danger"],
]);

/** The three world gradients, whose stops are a #200 product decision, not a token. */
const KIDS_WORLD_FILLS = Object.freeze([
  "#315869",
  "#274635",
  "#22234c",
  "#202b3c",
  "#1c5b76",
  "#123b55",
]);

function kidsToken(token: string): string {
  const match = new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(KIDS_STYLESHEET);
  if (match?.[1] === undefined) throw new Error(`The Kids stylesheet declares no ${token}.`);
  return match[1].toUpperCase();
}

function foundationHex(token: string): string {
  const color = FOUNDATION_COLORS.find((candidate) => candidate.token === token);
  if (color === undefined) throw new Error(`Foundations declares no ${token}.`);
  return color.hex.toUpperCase();
}

/** Flatten `hex` at `alpha` over an opaque `background`, as the browser composites it. */
function composite(hex: string, alpha: number, background: string): string {
  const channels = [1, 3, 5].map((offset) => {
    const fg = Number.parseInt(hex.slice(offset, offset + 2), 16);
    const bg = Number.parseInt(background.slice(offset, offset + 2), 16);
    return Math.round(fg * alpha + bg * (1 - alpha));
  });
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

describe("the isolated Kids site", () => {
  it("keeps the profile and site action implementations byte-identical without an import edge", () => {
    const profileSource = readFileSync(
      new URL("packages/profile-kids/src/kids-activity.ts", ROOT),
      "utf8",
    );
    const siteSource = readFileSync(new URL("sites/kids/src/lib/kids-activity.ts", ROOT), "utf8");

    expect(siteSource).toBe(profileSource);
    expect(site.KIDS_ACTIVITY_ACTIONS).toEqual(profile.KIDS_ACTIVITY_ACTIONS);
    expect(site.KIDS_ACTIVITY_WORLDS).toEqual(profile.KIDS_ACTIVITY_WORLDS);
    expect(site.KIDS_ACTIVITY_PIECES).toEqual(profile.KIDS_ACTIVITY_PIECES);
    expect(site.KIDS_ACTIVITY_REFUSE_REASONS).toEqual(profile.KIDS_ACTIVITY_REFUSE_REASONS);
  });

  it("drives the same allowed build and play flow on both isolated copies", () => {
    let profileState = profile.createKidsActivityState();
    let siteState = site.createKidsActivityState();
    const requests = [
      { action: "world.choose", worldId: "ocean" },
      { action: "piece.add", pieceId: "friend" },
      { action: "piece.add", pieceId: "star" },
      { action: "play.start" },
      { action: "play.stop" },
      { action: "piece.undo" },
    ] as const;

    for (const request of requests) {
      const profileDecision = profile.applyKidsActivityAction(profileState, request);
      const siteDecision = site.applyKidsActivityAction(siteState, request);
      expect(siteDecision).toEqual(profileDecision);
      expect(profileDecision.ok).toBe(true);
      if (profileDecision.ok && siteDecision.ok) {
        profileState = profileDecision.state;
        siteState = siteDecision.state;
      }
    }

    expect(siteState).toEqual(profileState);
    expect(siteState).toMatchObject({ worldId: "ocean", pieceIds: ["friend"], mode: "build" });
  });

  it("enforces no outbound connection, form, embedding, or ambient browser authority", () => {
    expect(site.KIDS_CONTENT_SECURITY_POLICY).toContain("connect-src 'none'");
    expect(site.KIDS_CONTENT_SECURITY_POLICY).toContain("form-action 'none'");
    expect(site.KIDS_CONTENT_SECURITY_POLICY).toContain("frame-src 'none'");
    expect(site.KIDS_CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(site.KIDS_CONTENT_SECURITY_POLICY).toContain("worker-src 'none'");
    expect(site.KIDS_SECURITY_HEADERS).toContainEqual({
      key: "Permissions-Policy",
      value: "camera=(), geolocation=(), microphone=()",
    });
    expect(site.KIDS_SECURITY_HEADERS).toContainEqual({
      key: "Referrer-Policy",
      value: "no-referrer",
    });
  });

  it("has a sealed install root and an empty SceneAxi dependency edge", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("sites/kids/package.json", ROOT), "utf8"),
    ) as { dependencies: Record<string, string> };
    const matrix = JSON.parse(
      readFileSync(new URL("docs/dependency-matrix.json", ROOT), "utf8"),
    ) as {
      packages: Record<string, { allow: string[] }>;
      kidsBoundary: { allowedDependents: string[] };
    };

    expect(Object.keys(manifest.dependencies).sort()).toEqual(["next", "react", "react-dom"]);
    expect(matrix.packages["@sceneaxi/site-kids"]?.allow).toEqual([]);
    expect(matrix.kidsBoundary.allowedDependents).toEqual([]);
    expect(
      readFileSync(new URL("sites/kids/pnpm-workspace.yaml", ROOT), "utf8").trim(),
    ).toBe(['packages:', '  - "."', "allowBuilds:", "  sharp: true"].join("\n"));
  });

  it("renders only local curated controls and child-safe refusal copy", () => {
    const component = readFileSync(
      new URL("sites/kids/src/app/_components/kids-studio.tsx", ROOT),
      "utf8",
    );
    const page = readFileSync(new URL("sites/kids/src/app/page.tsx", ROOT), "utf8");
    const shippedCopy = `${component}\n${page}`;

    expect(shippedCopy).toContain("Make a tiny world");
    expect(shippedCopy).toContain("Play my world");
    expect(shippedCopy).toContain("For grown-ups");
    expect(shippedCopy).not.toMatch(/<a\b|<form\b|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
    expect(shippedCopy).not.toMatch(
      /account|balance|billing|catalog|checkout|credit|identity|model|provider|session|stripe/i,
    );
  });

  it("names the stage on a role that permits a name, so the state description survives", () => {
    const component = readFileSync(
      new URL("sites/kids/src/app/_components/kids-studio.tsx", ROOT),
      "utf8",
    );
    const stage = /<div\b[^>]*className=\{`stage [^>]*?>/s.exec(component)?.[0];

    expect(stage).toBeDefined();
    expect(stage).toContain('role="group"');
    expect(stage).toContain("aria-label=");
  });

  it("keeps its duplicated Foundations neutrals identical to the shared token layer", () => {
    for (const [kids, foundation] of KIDS_FOUNDATION_ALIGNMENT) {
      expect(`${kids}=${kidsToken(kids)}`).toBe(`${kids}=${foundationHex(foundation)}`);
    }
  });

  it("measures a 4.5:1 floor on every shipped Kids text pairing", () => {
    const fg = kidsToken("--fg");
    const fg2 = kidsToken("--fg-2");
    const pairings: readonly (readonly [string, string])[] = [
      [fg, kidsToken("--bg-base")],
      [fg, kidsToken("--bg-panel")],
      [fg, kidsToken("--bg-control")],
      [fg2, kidsToken("--bg-base")],
      [fg2, kidsToken("--bg-panel")],
      // Badge, play button, and selected choice print the base neutral on the accent.
      [kidsToken("--bg-base"), kidsToken("--kids")],
      // The empty-stage hint is the one alpha text in the sheet: 78% of `--fg`.
      ...KIDS_WORLD_FILLS.map(
        (fill) => [composite(fg, 0.78, fill.toUpperCase()), fill.toUpperCase()] as const,
      ),
    ];

    for (const [foreground, background] of pairings) {
      const measured = contrastRatio(foreground, background);
      expect(`${foreground} on ${background} measured ${measured.toFixed(2)}`).toBe(
        `${foreground} on ${background} measured ${Math.max(measured, 4.5).toFixed(2)}`,
      );
    }
  });
});
