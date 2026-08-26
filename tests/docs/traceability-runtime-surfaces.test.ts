import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WEB_EXPERIENCE_REFUSED_SCOPES,
  evaluateWebExperienceScope,
} from "../../packages/profile-web/src/index.js";
import {
  PROJECT_GIT_UNSUPPORTED_OPERATIONS,
  refuseUnsupportedProjectGitOperation,
} from "../../packages/authoring-core/src/index.js";
import {
  PROJECT_GIT_DIAGNOSTICS,
  PROJECT_MANIFEST_DIAGNOSTICS,
  validateProjectManifest,
} from "../../packages/schemas/src/index.js";
import {
  ACCOUNT_PANEL_REASONS,
  ASSISTANT_PANEL_REASONS,
  createAccountPanel,
  createAssistantPanel,
} from "../../apps/web-shell/src/index.js";
import {
  CREDIT_WEBHOOK_REASONS,
  creditWebhookHttpStatus,
} from "../../sites/umbrella/src/index.js";
import { repoRoot } from "../helpers/fixture.ts";
import {
  traceabilityPublicModulePaths,
  traceabilityRuntimeSurfaces,
} from "../helpers/traceability-runtime.ts";

function normalized(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (!Array.isArray(entry)) return [key, entry];
      if (key === "heldKeyEntries") {
        return [
          key,
          entry
            .map((item) => {
              const row = item as { command: string; heldKeys: string[] };
              return { command: row.command, heldKeys: [...row.heldKeys].sort() };
            })
            .sort((left, right) => left.command.localeCompare(right.command)),
        ];
      }
      if (key === "refusalRegistries") {
        return [
          key,
          [...entry].sort((left, right) =>
            JSON.stringify(left).localeCompare(JSON.stringify(right))),
        ];
      }
      return [key, [...entry].sort()];
    }),
  );
}

describe("traceability runtime surfaces", () => {
  it("matches every exported executable registry to the generated protocol", () => {
    const generated = JSON.parse(
      readFileSync(
        join(repoRoot, "docs/audits/initiation/runtime-surfaces.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    const runtime = traceabilityRuntimeSurfaces() as unknown as Record<string, unknown>;
    const normalizedGenerated = normalized(generated);
    const normalizedRuntime = normalized(runtime);
    for (const key of Object.keys(normalizedRuntime)) {
      expect(normalizedGenerated[key], key).toEqual(normalizedRuntime[key]);
    }

    const inventory = JSON.parse(
      readFileSync(
        join(repoRoot, "docs/audits/initiation/requirements.json"),
        "utf8",
      ),
    ) as {
      liveInventory: {
        packages: Array<{ status?: string; seam: { path: string } | null }>;
      };
    };
    const publicSeams = inventory.liveInventory.packages
      .filter((entry) => entry.status !== "delayed")
      .map((entry) => entry.seam?.path)
      .filter((path): path is string => path !== undefined)
      .sort();
    expect(traceabilityPublicModulePaths()).toEqual(publicSeams);
  });

  it("discovers the semantic Web Experience refusal registry", () => {
    const runtime = traceabilityRuntimeSurfaces();
    expect(runtime.refusalRegistries).toContainEqual({
      path: "packages/profile-web/src/index.ts",
      symbol: "WEB_EXPERIENCE_REFUSED_SCOPES",
    });
    for (const scope of WEB_EXPERIENCE_REFUSED_SCOPES) {
      expect(evaluateWebExperienceScope(scope)).toMatchObject({
        ok: false,
        requestedScope: scope,
        reason: "OUTSIDE_WEB_EXPERIENCE_SCOPE",
      });
    }
  });

  it("catalogs atypically named registries with behavioral parity", () => {
    const runtime = traceabilityRuntimeSurfaces();
    for (const entry of [
      { path: "apps/web-shell/src/index.ts", symbol: "ACCOUNT_PANEL_REASONS" },
      { path: "apps/web-shell/src/index.ts", symbol: "ASSISTANT_PANEL_REASONS" },
      { path: "packages/schemas/src/index.ts", symbol: "PROJECT_MANIFEST_DIAGNOSTICS" },
      { path: "packages/schemas/src/index.ts", symbol: "PROJECT_GIT_DIAGNOSTICS" },
      { path: "packages/authoring-core/src/index.ts", symbol: "PROJECT_GIT_UNSUPPORTED_OPERATIONS" },
    ]) {
      expect(runtime.refusalRegistries).toContainEqual(entry);
    }

    expect(createAccountPanel({} as never)).toMatchObject({
      ok: false,
      reason: ACCOUNT_PANEL_REASONS.surfaceInvalid,
    });
    expect(createAssistantPanel({} as never)).toMatchObject({
      ok: false,
      reason: ASSISTANT_PANEL_REASONS.surfaceInvalid,
    });
    expect(validateProjectManifest({})).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.malformed },
    });
    for (const operation of PROJECT_GIT_UNSUPPORTED_OPERATIONS) {
      expect(refuseUnsupportedProjectGitOperation(operation)).toMatchObject({
        ok: false,
        diagnostic: {
          code: PROJECT_GIT_DIAGNOSTICS.operationUnsupported,
          path: `$operation.${operation}`,
        },
      });
    }
  });

  it("catalogs webhook reasons with public status parity", () => {
    const runtime = traceabilityRuntimeSurfaces();
    expect(runtime.refusalRegistries).toContainEqual({
      path: "sites/umbrella/src/index.ts",
      symbol: "CREDIT_WEBHOOK_REASONS",
    });
    const requestReasons = new Set<string>([CREDIT_WEBHOOK_REASONS.eventUnrelated]);
    for (const reason of Object.values(CREDIT_WEBHOOK_REASONS)) {
      expect(creditWebhookHttpStatus(reason), reason).toBe(
        requestReasons.has(reason) ? 400 : 503,
      );
    }
  });
});
