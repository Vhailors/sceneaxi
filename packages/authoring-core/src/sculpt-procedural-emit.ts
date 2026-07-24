import {
  SCULPT_PROCEDURAL_EMIT_KIND,
  SCULPT_PROCEDURAL_EMIT_VERSION,
  SCULPT_PROCEDURAL_EXPORT_NAME,
  SCULPT_PROCEDURAL_MODULE_ID,
  SCULPT_PROCEDURAL_SOURCE_DIGEST,
  validateSculptQualityObjectSculptSpec,
  type JsonValue,
  type SculptComponent,
  type SculptProceduralEmit,
  type SculptProceduralGeometry,
  type SculptProceduralMaterial,
  type SculptProceduralNode,
  type SculptQualityObjectSculptSpec,
} from "@sceneaxi/schemas";
import {
  digestBytes,
  digestJson,
  snapshotJsonValue,
} from "./json-invariants.js";

export {
  SCULPT_PROCEDURAL_EMIT_KIND,
  SCULPT_PROCEDURAL_EMIT_VERSION,
  SCULPT_PROCEDURAL_EXPORT_NAME,
  SCULPT_PROCEDURAL_MODULE_ID,
  SCULPT_PROCEDURAL_SOURCE_DIGEST,
};
export type {
  SculptProceduralEmit,
  SculptProceduralGeometry,
  SculptProceduralMaterial,
  SculptProceduralNode,
};

const SCULPT_PROCEDURAL_PROGRAM = snapshotJsonValue({
  schemaVersion: SCULPT_PROCEDURAL_EMIT_VERSION,
  canonicalization: "recursive-object-keys-code-unit",
  ordering: "identifier-code-unit",
  roundingDecimalPlaces: 6,
  seedDerivation: {
    hash: "sha256",
    word: "first-u32-be",
    uint32Range: 0x1_0000_0000,
  },
  geometry: {
    seedNamespace: "geometry",
    bevelBasis: "minimum-dimension",
    bevelMinimumRatio: 0.025,
    bevelRangeRatio: 0.025,
    radialSegmentsBase: 16,
    radialSegmentsBuckets: 4,
    radialSegmentsStep: 4,
    longitudinalSegmentsBase: 2,
    longitudinalSegmentsBuckets: 3,
  },
  materials: {
    seedNamespace: "material",
    clearcoatMaximum: 0.35,
    microRoughnessRange: 0.12,
    microRoughnessMaximum: 1,
  },
  hierarchy: {
    pivotSuffix: "-pivot",
    colliderSuffix: "-collider",
    preservesParentId: true,
    preservesTransform: true,
  },
} as const);

function seededUnit(seed: number, namespace: string) {
  const hex = digestBytes(`${String(seed)}:${namespace}`).slice("sha256:".length);
  return (
    Number.parseInt(hex.slice(0, 8), 16) /
    SCULPT_PROCEDURAL_PROGRAM.seedDerivation.uint32Range
  );
}

function rounded(value: number) {
  return Number(
    value.toFixed(SCULPT_PROCEDURAL_PROGRAM.roundingDecimalPlaces),
  );
}

function compareCodeUnits(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function geometryDetail(component: SculptComponent, seed: number) {
  const unit = seededUnit(
    seed,
    `${SCULPT_PROCEDURAL_PROGRAM.geometry.seedNamespace}:${component.id}`,
  );
  const program = SCULPT_PROCEDURAL_PROGRAM.geometry;
  return {
    bevelRadius: rounded(
      Math.min(...component.dimensions) *
        (program.bevelMinimumRatio + unit * program.bevelRangeRatio),
    ),
    radialSegments:
      program.radialSegmentsBase +
      Math.floor(unit * program.radialSegmentsBuckets) *
        program.radialSegmentsStep,
    longitudinalSegments:
      program.longitudinalSegmentsBase +
      Math.floor(unit * program.longitudinalSegmentsBuckets),
  };
}

function computeSculptProceduralEmit(
  spec: SculptQualityObjectSculptSpec,
  seed: number,
): SculptProceduralEmit {
  const componentById = new Map(
    spec.components.map((component) => [component.id, component]),
  );
  const geometry = spec.components
    .map((component) => ({
      componentId: component.id,
      primitive: component.primitive,
      dimensions: [
        component.dimensions[0],
        component.dimensions[1],
        component.dimensions[2],
      ] as const,
      ...geometryDetail(component, seed),
    }))
    .sort((left, right) => compareCodeUnits(left.componentId, right.componentId));
  const materials = spec.materials
    .map((material) => {
      const unit = seededUnit(
        seed,
        `${SCULPT_PROCEDURAL_PROGRAM.materials.seedNamespace}:${material.id}`,
      );
      return {
        materialId: material.id,
        baseColor: material.baseColor,
        metallic: material.metallic,
        roughness: material.roughness,
        clearcoat: rounded(
          unit * SCULPT_PROCEDURAL_PROGRAM.materials.clearcoatMaximum,
        ),
        microRoughness: rounded(
          Math.min(
            SCULPT_PROCEDURAL_PROGRAM.materials.microRoughnessMaximum,
            material.roughness +
              unit *
                SCULPT_PROCEDURAL_PROGRAM.materials.microRoughnessRange,
          ),
        ),
      };
    })
    .sort((left, right) => compareCodeUnits(left.materialId, right.materialId));
  const nodes = spec.hierarchy
    .map((node) => {
      const component = componentById.get(node.componentId);
      if (component === undefined) {
        throw new Error(
          `Validated sculpt component "${node.componentId}" disappeared.`,
        );
      }
      return {
        nodeId: node.id,
        parentId: node.parentId,
        componentId: node.componentId,
        transform: node.transform,
        pivotId: `${node.id}${SCULPT_PROCEDURAL_PROGRAM.hierarchy.pivotSuffix}`,
        colliderId: `${node.id}${SCULPT_PROCEDURAL_PROGRAM.hierarchy.colliderSuffix}`,
        materialId: component.materialId,
      };
    })
    .sort((left, right) => compareCodeUnits(left.nodeId, right.nodeId));
  const implementationDigest = digestJson(
    SCULPT_PROCEDURAL_PROGRAM as unknown as JsonValue,
  );
  if (implementationDigest !== SCULPT_PROCEDURAL_SOURCE_DIGEST) {
    throw new Error("Sculpt procedural implementation digest is invalid.");
  }
  const payload = snapshotJsonValue({
    schemaVersion: SCULPT_PROCEDURAL_EMIT_VERSION,
    kind: SCULPT_PROCEDURAL_EMIT_KIND,
    implementationDigest,
    seed,
    passIds: spec.passes.map((pass) => pass.id),
    geometry,
    materials,
    nodes,
  });
  return snapshotJsonValue({
    ...payload,
    digest: digestJson(payload as unknown as JsonValue),
  });
}

export function emitSculptProcedural(
  spec: SculptQualityObjectSculptSpec,
  options: { readonly seed?: number } = {},
): SculptProceduralEmit {
  const validated = validateSculptQualityObjectSculptSpec(spec);
  if (!validated.ok) {
    throw new Error(
      validated.diagnostics[0]?.message ?? "Invalid ObjectSculptSpec.",
    );
  }
  const seed = options.seed ?? 0;
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new Error("Sculpt procedural seed must be a non-negative safe integer.");
  }
  return computeSculptProceduralEmit(validated.value, seed);
}
