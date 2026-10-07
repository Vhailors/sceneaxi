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

// Pin updated for the v6 light Kids palette, owner-authorized 2026-10-07 (docs/redesign-v6/RULINGS.md).
// The exact light Kids colour set (DIRECTION §5.5, concepts/a-rich/a.css kids dialect). The
// Foundations violet is not in it and is asserted absent below.
const KIDS_LIGHT_PALETTE: readonly (readonly [
    string,
    string
])[] = Object.freeze([
    ["--k-sky", "#D6ECF4"],
    ["--k-table", "#EAF5F9"],
    ["--k-tray", "#BFDDE8"],
    ["--k-plate", "#FFFFFF"],
    ["--k-plate-hi", "#EEF7FB"],
    ["--k-picked", "#E6EEFC"],
    ["--k-ink", "#13302A"],
    ["--k-ink-2", "#2F4D46"],
    ["--k-hair", "#3D6B7A"],
    ["--k-play", "#1E4FBF"],
    ["--k-play-hi", "#173F9C"],
    ["--k-on-play", "#FFFFFF"],
    ["--k-focus", "#1E4FBF"],
    ["--k-off", "#E9F3F6"],
    ["--k-off-ink", "#4A625C"],
    ["--k-off-edge", "#5C7670"],
    ["--k-refused", "#8F241C"],
    ["--k-full", "#C4362C"],
]);
/**
 * Every colour custom property the sheet ends up declaring, last one wins, the way the
 * cascade reads them. Derived rather than listed so an eleventh token cannot be added
 * without the alignment assertion below noticing it.
 */

function kidsColorTokens() {
    const tokens: Record<string, string> = {};

    for (const match of KIDS_STYLESHEET.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
        // SAFETY: the hard-coded regular expression has a mandatory capture group at this index for every successful match.
        const token = match[1] as string;
        // SAFETY: the hard-coded regular expression has a mandatory capture group at this index for every successful match.
        const value = (match[2] as string).trim();

        if (/^#[0-9a-fA-F]{6}$/.test(value))
            tokens[token] = value.toUpperCase();
        else
            Reflect.deleteProperty(tokens, token);
    }

    return tokens;
}

function kidsToken(token: string): string {
    const value = kidsColorTokens()[token];

    if (value === undefined)
        throw new Error(`The Kids stylesheet declares no colour ${token}.`);

    return value;
}
/**
 * The gradient stops a curated world actually paints, read out of its own rule.
 *
 * These are a #200 product decision rather than a token, so the sheet is their only
 * source — copying them into this file would let a repainted world drift past the
 * contrast floor while the suite kept measuring the old sky.
 */

function kidsWorldFills(worldId: string): readonly string[] {
    const rule = new RegExp(`\\.world-${worldId}\\s*\\{([^}]*)\\}`).exec(KIDS_STYLESHEET);

    if (rule?.[1] === undefined) {
        throw new Error(`The Kids stylesheet has no .world-${worldId} rule.`);
    }

    const fills = [...rule[1].matchAll(/#[0-9a-fA-F]{6}\b/g)].map((match) => match[0].toUpperCase());

    if (fills.length === 0)
        throw new Error(`.world-${worldId} paints no opaque fill.`);

    return fills;
}

function foundationHex(token: string): string {
    const color = FOUNDATION_COLORS.find((candidate) => candidate.token === token);

    if (color === undefined)
        throw new Error(`Foundations declares no ${token}.`);

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
        const profileSource = readFileSync(new URL("packages/profile-kids/src/kids-activity.ts", ROOT), "utf8");
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
    it("relaxes the policy for the development server only, and only to same-origin", () => {
        for (const phase of [
            "phase-production-build",
            "phase-production-server",
            "phase-export",
            "phase-test",
            "",
        ]) {
            expect(site.kidsSecurityHeadersForPhase(phase), phase).toEqual(site.KIDS_SECURITY_HEADERS);
        }

        const development = site.kidsSecurityHeadersForPhase(site.KIDS_DEVELOPMENT_SERVER_PHASE);
        const developmentPolicy = development.find((header) => header.key === "Content-Security-Policy")?.value;
        expect(development.filter((header) => header.key !== "Content-Security-Policy")).toEqual(site.KIDS_SECURITY_HEADERS.filter((header) => header.key !== "Content-Security-Policy"));
        // The exception is exactly two same-origin directives and nothing else.
        expect(developmentPolicy).toBe(site.KIDS_CONTENT_SECURITY_POLICY.replace("connect-src 'none'", "connect-src 'self'").replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'"));
        expect(developmentPolicy).not.toMatch(/https?:|\/\/|\*/);

        // The shipped contract is what production serves, byte for byte.
        // SAFETY: the parsed file is a checked-in repository fixture read from a fixed path, not external input.
        const shipped = JSON.parse(readFileSync(new URL("sites/kids/security-headers.json", ROOT), "utf8")) as {
            headers: {
                key: string;
                value: string;
            }[];
        };

        expect(site.kidsSecurityHeadersForPhase("phase-production-server")).toEqual(shipped.headers);
        expect(site.KIDS_CONTENT_SECURITY_POLICY).toContain("connect-src 'none'");
        expect(site.KIDS_CONTENT_SECURITY_POLICY).not.toContain("unsafe-eval");
        // `next.config.ts` cannot import this module — Next's config transpiler does not
        // resolve a relative `.ts` — so it selects the same two lists by name instead.
        const config = readFileSync(new URL("sites/kids/next.config.ts", ROOT), "utf8");
        const selection = /phase === "([a-z-]+)"\s*\?\s*securityPolicy\.(\w+)\s*:\s*securityPolicy\.(\w+)/.exec(config);
        // Which list each branch holds, not merely that both are named: swapping them
        // would bake the development policy into the deployed origin. A restructured
        // selection fails here too, because the direction must be re-pinned deliberately.
        expect(selection, "next.config.ts must select headers by phase in one ternary").not.toBeNull();
        expect([selection?.[1], selection?.[2], selection?.[3]]).toEqual([
            site.KIDS_DEVELOPMENT_SERVER_PHASE,
            "developmentServerHeaders",
            "headers",
        ]);
        expect(config.match(/securityPolicy\.\w+/g)).toEqual([
            "securityPolicy.developmentServerHeaders",
            "securityPolicy.headers",
        ]);
        expect(config).not.toMatch(/connect-src|unsafe-eval/);
    });
    it("refuses identically on both isolated copies across the whole closed reason table", () => {
        const buildOne = (apply: typeof profile.applyKidsActivityAction, create: typeof profile.createKidsActivityState, requests: readonly Parameters<typeof profile.applyKidsActivityAction>[1][]) => {
            let state = create();

            for (const request of requests) {
                const decision = apply(state, request);

                if (decision.ok)
                    state = decision.state;
            }

            return state;
        };

        const scenarios = [
            { setup: [], request: { action: "piece.undo" } },
            { setup: [], request: { action: "play.stop" } },
            { setup: [{ action: "play.start" }], request: { action: "play.start" } },
            {
                setup: [{ action: "piece.add", pieceId: "star" }, { action: "play.start" }],
                request: { action: "piece.add", pieceId: "tree" },
            },
            { setup: [], request: { action: "piece.add", pieceId: "uploaded" } },
            { setup: [], request: { action: "scene.export" } },
        ] as const;

        for (const scenario of scenarios) {
            const profileDecision = profile.applyKidsActivityAction(buildOne(profile.applyKidsActivityAction, profile.createKidsActivityState, scenario.setup), scenario.request);
            const siteDecision = site.applyKidsActivityAction(buildOne(site.applyKidsActivityAction, site.createKidsActivityState, scenario.setup), scenario.request);
            expect(profileDecision.ok, JSON.stringify(scenario)).toBe(false);
            expect(siteDecision).toEqual(profileDecision);
        }
    });
    it("has a sealed install root and an empty SceneAxi dependency edge", () => {
        // SAFETY: the parsed file is a checked-in repository fixture read from a fixed path, not external input.
        const manifest = JSON.parse(readFileSync(new URL("sites/kids/package.json", ROOT), "utf8")) as {
            dependencies: Record<string, string>;
        };

        // SAFETY: the parsed file is a checked-in repository fixture read from a fixed path, not external input.
        const matrix = JSON.parse(readFileSync(new URL("docs/dependency-matrix.json", ROOT), "utf8")) as {
            packages: Record<string, {
                allow: string[];
            }>;
            kidsBoundary: {
                allowedDependents: string[];
            };
        };

        expect(Object.keys(manifest.dependencies).sort()).toEqual(["next", "react", "react-dom"]);
        expect(matrix.packages["@sceneaxi/site-kids"]?.allow).toEqual([]);
        expect(matrix.kidsBoundary.allowedDependents).toEqual([]);
        expect(readFileSync(new URL("sites/kids/pnpm-workspace.yaml", ROOT), "utf8").trim()).toBe(['packages:', '  - "."', "allowBuilds:", "  sharp: true"].join("\n"));
    });
    it("renders only local curated controls and child-safe refusal copy", () => {
        const component = readFileSync(new URL("sites/kids/src/app/_components/kids-studio.tsx", ROOT), "utf8");
        const page = readFileSync(new URL("sites/kids/src/app/page.tsx", ROOT), "utf8");
        const shippedCopy = `${component}\n${page}`;
        expect(shippedCopy).toContain("Make a tiny world");
        expect(shippedCopy).toContain("Play my world");
        expect(shippedCopy).toContain("For grown-ups");
        expect(shippedCopy).not.toMatch(/<a\b|<form\b|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
        expect(shippedCopy).not.toMatch(/account|balance|billing|catalog|checkout|credit|identity|model|provider|session|stripe/i);
    });
    it("names the stage on a role that permits a name, so the state description survives", () => {
        const component = readFileSync(new URL("sites/kids/src/app/_components/kids-studio.tsx", ROOT), "utf8");
        const stage = /<div\b[^>]*className=\{`stage [^>]*?>/s.exec(component)?.[0];
        expect(stage).toBeDefined();
        expect(stage).toContain('role="group"');
        expect(stage).toContain("aria-label=");
    });
    // Pin updated for the v6 light Kids palette, owner-authorized 2026-10-07 (docs/redesign-v6/RULINGS.md).
    it("keeps its duplicated Foundations neutrals identical to the shared token layer", () => {
        // Exactly the light Kids set, no more and no fewer colour tokens, each at its hex.
        expect(Object.keys(kidsColorTokens()).sort()).toEqual(KIDS_LIGHT_PALETTE.map(([kids]) => kids).sort());

        for (const [kids, hex] of KIDS_LIGHT_PALETTE) {
            expect(`${kids}=${kidsToken(kids)}`).toBe(`${kids}=${hex}`);
        }

        // The retired Foundations violet does not come back, as a token or as a literal.
        expect(Object.values(kidsColorTokens())).not.toContain(foundationHex("--kids"));
        expect(KIDS_STYLESHEET).not.toMatch(new RegExp(foundationHex("--kids"), "i"));
    });
    it("measures a 4.5:1 floor on every shipped Kids text pairing", () => {
        const ink = kidsToken("--k-ink");
        const ink2 = kidsToken("--k-ink-2");
        const onPlay = kidsToken("--k-on-play");
        const surfaces = ["--k-sky", "--k-table", "--k-tray", "--k-plate", "--k-plate-hi", "--k-picked"].map(kidsToken);
        // The stage paints its hint in the real Kids ink, so the ink is what the world fills must carry.
        expect(KIDS_STYLESHEET).toMatch(/\.stage-hint\s*\{[^}]*\bcolor:\s*var\(--k-ink\);/);

        const text: readonly (readonly [
            string,
            string
        ])[] = [
            ...surfaces.map((surface) => [ink, surface] as const),
            ...surfaces.map((surface) => [ink2, surface] as const),
            // Play key, playing badge, step numbers and the Picked tag print white on Play blue.
            [onPlay, kidsToken("--k-play")],
            [onPlay, kidsToken("--k-play-hi")],
            [kidsToken("--k-play"), kidsToken("--k-on-play")],
            [kidsToken("--k-off-ink"), kidsToken("--k-off")],
            [kidsToken("--k-refused"), kidsToken("--k-plate")],
            // Every stop of every curated world board, raw and under the hint's 70% white wash.
            ...site.KIDS_ACTIVITY_WORLDS.flatMap((world) => kidsWorldFills(world.id).flatMap((fill) => [[ink, fill], [ink, composite("#FFFFFF", 0.7, fill)]] as const)),
        ];

        // Focus ring, edges and the full meter: 3:1 against every plane they sit on.
        const ui: readonly (readonly [
            string,
            string
        ])[] = [
            ...surfaces.slice(0, 4).map((surface) => [kidsToken("--k-focus"), surface] as const),
            ...surfaces.slice(0, 4).map((surface) => [kidsToken("--k-hair"), surface] as const),
            [kidsToken("--k-off-edge"), kidsToken("--k-tray")],
            [kidsToken("--k-off-edge"), kidsToken("--k-off")],
            [kidsToken("--k-full"), kidsToken("--k-tray")],
        ];

        for (const [floor, pairings] of [[4.5, text], [3, ui]] as const) {
            for (const [foreground, background] of pairings) {
                const measured = contrastRatio(foreground, background);
                expect(`${foreground} on ${background} measured ${measured.toFixed(2)}`).toBe(`${foreground} on ${background} measured ${Math.max(measured, floor).toFixed(2)}`);
            }
        }
    });
});
