import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mvpGoldenPath } from "../../packages/profile-web/src/index.ts";
import {
  GOLDEN_PROJECT_DOCUMENT_INPUT,
  productManifestFrom,
} from "./fixtures/golden-project.ts";

describe("Web profile MVP golden path", () => {
  it("runs the same golden project under Web policy without a CMS claim", () => {
    const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-web-golden-"));
    const documentPath = "project.sceneaxi.json";
    try {
      expect(mvpGoldenPath.evaluateScope("interactive-experience")).toEqual({
        ok: true,
        scope: "interactive-experience",
      });
      expect(mvpGoldenPath.evaluateScope("cms")).toMatchObject({
        ok: false,
        reason: "OUTSIDE_WEB_EXPERIENCE_SCOPE",
      });
      expect(mvpGoldenPath.status).toEqual({
        developmentConsumer: true,
        shippingClaim: false,
        productSurface: "not-shipped",
      });

      const document = mvpGoldenPath.core.authoring.createDocument(
        GOLDEN_PROJECT_DOCUMENT_INPUT,
      );
      expect(
        mvpGoldenPath.core.authoring.writeDocumentFile(
          documentPath,
          document,
          { cwd },
        ),
      ).toMatchObject({ ok: true });

      const proposed = mvpGoldenPath.core.authoring.propose({
        documentPath,
        jsonPointer: "/data/productManifest/entities/0/x",
        newValue: 2,
        cwd,
      });
      expect(proposed.ok).toBe(true);
      if (!proposed.ok) return;
      const applied = mvpGoldenPath.core.authoring.apply({
        proposal: proposed.proposal,
        cwd,
      });
      expect(applied.ok).toBe(true);

      const parsed = mvpGoldenPath.core.authoring.parseDocumentText(
        readFileSync(join(cwd, documentPath), "utf8"),
      );
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const manifest = productManifestFrom(parsed.document.data["productManifest"]);
      expect(manifest.entities?.[0]?.x).toBe(2);

      const host = { nowMs: () => 1_753_334_400_000 };
      const session = mvpGoldenPath.core.kernel.open(manifest, host);
      session.dispatch({ type: "move", actor: "hero", axis: [3, -1] });
      session.advance({ tick: 1, deltaMs: 16 });
      const terminal = session.observe();
      expect(terminal.entities).toEqual([{ id: "hero", x: 5, y: 0 }]);
      expect(
        mvpGoldenPath.core.kernel.replay(session.save(), host).observe(),
      ).toEqual(terminal);

      const presenter =
        mvpGoldenPath.core.presentation.createNullPresentationRuntime();
      presenter.mount();
      presenter.present(terminal, [], 0);
      expect(presenter.capture()).toBeNull();
      presenter.dispose();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
