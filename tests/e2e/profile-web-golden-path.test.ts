import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  WEB_EXPERIENCE_REFUSED_SCOPES,
  mvpGoldenPath,
} from "../../packages/profile-web/src/index.ts";
import {
  GOLDEN_PROJECT_DOCUMENT_INPUT,
  productManifestFrom,
} from "./fixtures/golden-project.ts";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const GOLDEN_PATH =
  "tests/e2e/fixtures/profile-web/golden-digests.json";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), "utf8")) as unknown;
}

describe("Web profile MVP golden path", () => {
  it("runs the same golden project under the fixed Web scope boundary", () => {
    const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-web-golden-"));
    const documentPath = "project.sceneaxi.json";
    try {
      expect(mvpGoldenPath.evaluateScope("interactive-experience")).toEqual({
        ok: true,
        scope: "interactive-experience",
      });
      const refusedScopes = WEB_EXPERIENCE_REFUSED_SCOPES.map((scope) => {
        const decision = mvpGoldenPath.evaluateScope(scope);
        expect(decision).toMatchObject({
          ok: false,
          requestedScope: scope,
          reason: "OUTSIDE_WEB_EXPERIENCE_SCOPE",
        });
        return scope;
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
      const replayed = mvpGoldenPath.core.kernel
        .replay(session.save(), host)
        .observe();
      expect(replayed).toEqual(terminal);

      const presenter =
        mvpGoldenPath.core.presentation.createNullPresentationRuntime();
      presenter.mount();
      presenter.present(terminal, [], 0);
      expect(presenter.capture()).toBeNull();
      presenter.dispose();

      expect({
        schemaVersion: 1,
        kind: "sceneaxi.profile-web-golden-evidence",
        status: "passed",
        profile: {
          name: mvpGoldenPath.seam.name,
          policyVersion: mvpGoldenPath.policy.version,
          shippingClaim: mvpGoldenPath.status.shippingClaim,
        },
        policy: {
          allowedScope: "interactive-experience",
          refusedScopes,
        },
        authoring: {
          documentPath,
          entityX: manifest.entities?.[0]?.x,
        },
        kernel: {
          terminalDigest: terminal.digest,
          replayDigest: replayed.digest,
        },
        presentation: {
          capture: null,
        },
      }).toEqual(readJson(GOLDEN_PATH));
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
