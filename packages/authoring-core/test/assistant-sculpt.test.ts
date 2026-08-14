import { describe, expect, it } from "vitest";
import {
  ASSISTANT_SCULPT_REFUSALS,
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  createModelProviderPort,
  runAssistantSculptAction,
  sculptArtifactFromAssistantCompletion,
  type ModelDescriptor,
} from "@sceneaxi/authoring-core";

const MODEL: ModelDescriptor = Object.freeze({
  model: "local/fixture-sculpt",
  provider: "operator-byo",
  quantization: "pinned",
  version: "1",
});

describe("assistant sculpt action", () => {
  it("turns a free local prompt into a typed, inspectable sculpt artifact", async () => {
    const progress: string[] = [];
    const result = await runAssistantSculptAction({
      route: "local",
      profile: "@sceneaxi/profile-game",
      prompt: "A tall blue service cylinder",
      onProgress: (snapshot) => progress.push(snapshot.phase),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.kind).toBe("sceneaxi.sculpt-artifact");
    expect(result.artifact.spec.components[0]).toMatchObject({
      primitive: "cylinder",
      dimensions: [1.5, 3, 1.5],
    });
    expect(result.artifact.proceduralModule.emitDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.inspection.materials.supported).toBe(true);
    expect(result.inspection.physics.supported).toBe(true);
    expect(result.inspection.settings.supported).toBe(true);
    expect(result.inspection.materials.edit.refusal).toBe(
      ASSISTANT_SCULPT_REFUSALS.inspectionEditUnsupported,
    );
    expect(progress).toEqual([
      "accepted",
      "generating-local",
      "validating-artifact",
      "ready",
    ]);
  });

  it("compiles a directed archer-and-tree prompt into one multi-part artifact", async () => {
    const result = await runAssistantSculptAction({
      route: "local",
      profile: "@sceneaxi/profile-game",
      prompt: "Make an archer shooting to the tree",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.artifact.spec.components.map((component) => component.id);
    expect(ids).toEqual([
      "anchor",
      "tree-trunk",
      "tree-crown",
      "archer-body",
      "archer-head",
      "bow",
      "arrow",
    ]);
    expect(result.artifact.spec.hierarchy).toHaveLength(7);
    expect(result.artifact.artifactId).toMatch(/^assistant-[0-9a-f]{12}-artifact$/);
  });

  it("streams a BYOK completion and reconstructs only the validated typed intake", async () => {
    const deltas: string[] = [];
    const intake = JSON.stringify({
      schemaVersion: 1,
      kind: "sceneaxi.sculpt-intake",
      intakeId: "byo-sphere",
      mode: "structured-spec",
      structuredSpec: {
        schemaVersion: 1,
        kind: "sceneaxi.object-sculpt-spec",
        id: "byo-sphere-spec",
        rootNodeId: "sphere-root",
        components: [
          {
            id: "sphere-body",
            primitive: "sphere",
            dimensions: [2, 2, 2],
            materialId: "shell",
          },
        ],
        materials: [
          {
            id: "shell",
            baseColor: "#3366cc",
            metallic: 0.2,
            roughness: 0.6,
          },
        ],
        sockets: [],
        hierarchy: [
          {
            id: "sphere-root",
            parentId: null,
            componentId: "sphere-body",
            transform: {
              translation: [0, 0, 0],
              rotationEulerDegrees: [0, 0, 0],
              scale: [1, 1, 1],
            },
          },
        ],
      },
    });
    const split = Math.floor(intake.length / 2);
    const port = createModelProviderPort({
      adapter: {
        routeKind: "third-party",
        capabilities: {
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operations: ["stream"],
        },
        stream: async () => ({
          response: (async function* () {
            yield {
              schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
              operation: "stream" as const,
              delta: intake.slice(0, split),
              done: false,
            };
            yield {
              schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
              operation: "stream" as const,
              delta: intake.slice(split),
              done: true,
            };
          })(),
          executedModel: MODEL,
        }),
      },
      profilePolicies: {
        "@sceneaxi/profile-game": () => ({ ok: true }),
      },
    });

    const result = await runAssistantSculptAction({
      route: "byo",
      operation: "stream",
      profile: "@sceneaxi/profile-game",
      prompt: "Build a blue sphere",
      model: MODEL,
      port,
      onProgress: (snapshot) => {
        if (snapshot.delta !== undefined) deltas.push(snapshot.delta);
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.spec.id).toBe("byo-sphere-spec");
    expect(deltas.join("")).toBe(intake);
    expect(result.providerEvidence?.operation).toBe("stream");
  });

  it("denies Kids before touching a BYOK provider", async () => {
    let entered = false;
    const port = createModelProviderPort({
      adapter: {
        routeKind: "third-party",
        capabilities: {
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operations: ["complete"],
        },
        complete: () => {
          entered = true;
          throw new Error("must not run");
        },
      },
      profilePolicies: {
        "@sceneaxi/profile-kids": () => ({ ok: true }),
      },
    });

    const result = await runAssistantSculptAction({
      route: "byo",
      operation: "complete",
      profile: "@sceneaxi/profile-kids",
      prompt: "Build anything",
      model: MODEL,
      port,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: ASSISTANT_SCULPT_REFUSALS.kidsDenied,
      recoverable: false,
    });
    expect(entered).toBe(false);
  });

  it("denies Kids on the public completion converter before parsing", () => {
    const result = sculptArtifactFromAssistantCompletion("not-json", {
      profile: "@sceneaxi/profile-kids",
    });
    expect(result).toMatchObject({
      ok: false,
      reason: ASSISTANT_SCULPT_REFUSALS.kidsDenied,
      recoverable: false,
    });
  });

  it("turns provider failures into a recoverable named refusal", async () => {
    const port = createModelProviderPort({
      adapter: {
        routeKind: "third-party",
        capabilities: {
          schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
          operations: ["complete"],
        },
        complete: () => {
          throw new Error("transport unavailable");
        },
      },
      profilePolicies: {
        "@sceneaxi/profile-game": () => ({ ok: true }),
      },
    });

    const result = await runAssistantSculptAction({
      route: "byo",
      operation: "complete",
      profile: "@sceneaxi/profile-game",
      prompt: "Build a crate",
      model: MODEL,
      port,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: ASSISTANT_SCULPT_REFUSALS.providerFailed,
      recoverable: true,
    });
  });
});
