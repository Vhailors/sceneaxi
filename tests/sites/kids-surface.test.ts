import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as profile from "../../packages/profile-kids/src/index.ts";
import * as site from "../../sites/kids/src/index.ts";

const ROOT = new URL("../../", import.meta.url);

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
});
