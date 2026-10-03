import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mvpGoldenPath } from "@sceneaxi/profile-web";
import type { ProductManifest, JsonValue } from "@sceneaxi/schemas";

const projectInput = {
  id: "golden-project",
  title: "Bounded Web experience scenarios",
  data: { productManifest: { productId: "golden-game", seed: 51, entities: [{ id: "hero", x: 0, y: 1 }] } },
};

// These are bounded offline scene interactions, not a CMS, live data source,
// site renderer or a conformance/launch claim. Real HTML/canvas proofs have separate owners.
const scenarios = [
  { name: "hero-scene", authoredX: 2, steps: [[3, -1]], position: [5, 0] },
  { name: "configurator", authoredX: 4, steps: [[0, 2], [-1, 0]], position: [3, 3] },
  { name: "storytelling", authoredX: 1, steps: [[1, 0], [1, 1], [1, -1]], position: [4, 1] },
  { name: "microsite", authoredX: 0, steps: [[2, 0], [-2, 0]], position: [0, 1] },
] as const;

// Filled from independently observed public workflows, then pinned as regression oracles.
const digests = {
  "hero-scene": "sha256:1dae7ae847365be08467f923350f1a164b3cf29849fc4180a4907bf96dbace90",
  configurator: "sha256:d42c01fecbe616d7e711ac574917b2c096d741054e05f0cec4f58dd82b5caf9c",
  storytelling: "sha256:8c70de258db0b984a1f0352a10b958cf4c9c5a5ca6da29e9375ad4b399d5382d",
  microsite: "sha256:24059a5464d5835ae17939092e11cfc15314c4aba978e0f60444a8225fbb2278",
};

describe("bounded offline Web experience scene workflows", () => {
  it.each(scenarios)("authors, advances, saves and replays $name", (scenario) => {
    const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-web-scenario-"));
    const documentPath = "experience.sceneaxi.json";

    try {
      const authoring = mvpGoldenPath.core.authoring;
      expect(mvpGoldenPath.evaluateScope("interactive-experience").ok).toBe(true);
      const document = authoring.createDocument(projectInput);
      expect(authoring.writeDocumentFile(documentPath, document, { cwd }).ok).toBe(true);
      const original = readFileSync(join(cwd, documentPath), "utf8");
      const proposed = authoring.propose({ documentPath, jsonPointer: "/data/productManifest/entities/0/x", newValue: scenario.authoredX, cwd });
      expect(proposed.ok).toBe(true);

      if (!proposed.ok) throw new Error("Scenario proposal refused.");
      expect(readFileSync(join(cwd, documentPath), "utf8")).toBe(original);
      expect(authoring.apply({ proposal: proposed.proposal, cwd }).ok).toBe(true);
      const parsed = authoring.parseDocumentText(readFileSync(join(cwd, documentPath), "utf8"));
      expect(parsed.ok).toBe(true);

      if (!parsed.ok) throw new Error("Scenario document refused.");
      const authoredManifest = parsed.document.data["productManifest"];
      expect(authoredManifest).toEqual({ productId: "golden-game", seed: 51, entities: [{ id: "hero", x: scenario.authoredX, y: 1 }] });

      // SAFETY: the deep equality assertion above verifies every ProductManifest field against the authored fixture before the kernel call.
      if (!isScenarioManifest(authoredManifest)) throw new Error("Authored scenario manifest has invalid fields.");
      const manifest = authoredManifest;
      const host = { nowMs: () => 1_753_334_400_000 };
      const session = mvpGoldenPath.core.kernel.open(manifest, host);
      scenario.steps.forEach((axis, index) => {
        const before = session.observe();
        session.dispatch({ type: "move", actor: "hero", axis });
        expect(session.observe()).toEqual(before);
        session.advance({ tick: index + 1, deltaMs: 16 });
      });
      const terminal = session.observe();
      expect(terminal.entities).toEqual([{ id: "hero", x: scenario.position[0], y: scenario.position[1] }]);
      expect(mvpGoldenPath.core.kernel.replay(session.save(), host).observe()).toEqual(terminal);
      expect(terminal.digest).toBe(digests[scenario.name]);
      const before = session.observe();
      expect(() => session.dispatch({ type: "move", actor: "hero", axis: [Number.NaN, 0] })).toThrow();
      expect(session.observe()).toEqual(before);
      expect(authoring.parseDocumentText("{invalid").ok).toBe(false);
      expect(mvpGoldenPath.status.shippingClaim).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("does not infer a live-data or script capability from an offline interaction", () => {
    expect(mvpGoldenPath.evaluateScope("data-driven-real-time").ok).toBe(false);
    expect(mvpGoldenPath.evaluateScope("cms")).toMatchObject({ ok: false, reason: "OUTSIDE_WEB_EXPERIENCE_SCOPE" });
    expect(mvpGoldenPath.evaluateScope({ scope: "interactive-experience" }).ok).toBe(false);
  });
});

type ScenarioManifestInput = JsonValue | ProductManifest | undefined;

function isScenarioManifest(value: ScenarioManifestInput): value is ProductManifest {
  return value !== null && typeof value === "object" && "productId" in value && value.productId === "golden-game" && "seed" in value && value.seed === 51 && "entities" in value && Array.isArray(value.entities) && value.entities.length === 1 && value.entities.every(isHeroEntity);
}

function isHeroEntity(value: unknown): value is { id: string; x: number; y: number } {
  return value !== null && isBoundaryObjectValue(value) && "id" in value && value.id === "hero" && "x" in value && isBoundaryNumericValue(value.x) && "y" in value && value.y === 1;
}

type BoundaryObjectValue = object | null;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}

function isBoundaryNumericValue<Input>(value: Input): value is Input & number {
  return typeof value === "number";
}
