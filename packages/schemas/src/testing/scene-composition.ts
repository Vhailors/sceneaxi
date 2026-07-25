import {
  OBJECT_SCULPT_SPEC_KIND,
  SCULPT_ARTIFACT_KIND,
  SCULPT_SCHEMA_VERSION,
  type SculptArtifact,
  type SculptTransform,
} from "../sculpt.js";

export const sceneCompositionFixtureDigest = (character: string) =>
  `sha256:${character.repeat(64)}`;

export const sceneCompositionIdentityTransform: SculptTransform = {
  translation: [0, 0, 0],
  rotationEulerDegrees: [0, 0, 0],
  scale: [1, 1, 1],
};

export function sceneCompositionTransformFixture(
  translation: readonly [number, number, number],
  scale: readonly [number, number, number] = [1, 1, 1],
  rotationEulerDegrees: readonly [number, number, number] = [0, 0, 0],
): SculptTransform {
  return { translation, rotationEulerDegrees, scale };
}

export function sceneCompositionArtifactFixture(
  artifactId: string,
): SculptArtifact {
  const rootNodeId = `${artifactId}-root`;
  const childNodeId = `${artifactId}-child`;
  const hierarchy = [
    {
      id: rootNodeId,
      parentId: null,
      componentId: "body",
      transform: sceneCompositionIdentityTransform,
    },
    {
      id: childNodeId,
      parentId: rootNodeId,
      componentId: "cap",
      transform: sceneCompositionTransformFixture([0, 1.5, 0]),
    },
  ] as const;
  const spec = {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: OBJECT_SCULPT_SPEC_KIND,
    id: `${artifactId}-spec`,
    rootNodeId,
    materials: [
      { id: "primary", baseColor: "#8899aa", metallic: 0.1, roughness: 0.7 },
    ],
    components: [
      {
        id: "body",
        primitive: "box",
        dimensions: [2, 2, 2],
        materialId: "primary",
      },
      {
        id: "cap",
        primitive: "cylinder",
        dimensions: [0.5, 1, 0.5],
        materialId: "primary",
      },
    ],
    hierarchy,
    sockets: [
      {
        id: `${artifactId}-bob`,
        nodeId: childNodeId,
        kind: "animation",
        axis: "y",
        amplitude: 0.25,
        frequencyHz: 1,
      },
    ],
  } as const;
  return {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: SCULPT_ARTIFACT_KIND,
    artifactId,
    spec,
    proceduralModule: {
      moduleId: "sceneaxi/scene-composition-test-fixture",
      exportName: "buildFixture",
      sourceDigest: sceneCompositionFixtureDigest("b"),
    },
    runtimeHierarchy: { rootNodeId, nodes: hierarchy },
    evidence: {
      method: "structured-fixture",
      intakeDigest: sceneCompositionFixtureDigest("a"),
      specDigest: sceneCompositionFixtureDigest("c"),
      proceduralModuleDigest: sceneCompositionFixtureDigest("b"),
      qualityGates: [
        {
          id: "contract",
          status: "passed",
          digest: sceneCompositionFixtureDigest("d"),
        },
      ],
    },
  } as SculptArtifact;
}
