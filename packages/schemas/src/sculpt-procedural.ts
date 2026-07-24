import type { JsonValue } from "./document.js";
import type {
  SculptComponent,
  SculptTransform,
  SculptQualityObjectSculptSpec,
} from "./sculpt.js";
import {
  digestSculptJson,
  sculptSha256Hex,
  snapshotSculptJson,
} from "./sculpt-json.js";

export const SCULPT_PROCEDURAL_EMIT_VERSION = 1 as const;
export const SCULPT_PROCEDURAL_EMIT_KIND =
  "sceneaxi.sculpt-procedural-emit" as const;
export const SCULPT_PROCEDURAL_MODULE_ID =
  "@sceneaxi/authoring-core" as const;
export const SCULPT_PROCEDURAL_EXPORT_NAME =
  "emitSculptProcedural" as const;

const SCULPT_PROCEDURAL_PROGRAM = snapshotSculptJson({
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

export const SCULPT_PROCEDURAL_SOURCE_DIGEST = digestSculptJson(
  SCULPT_PROCEDURAL_PROGRAM as unknown as JsonValue,
);

function seededUnit(seed: number, namespace: string) {
  const hex = sculptSha256Hex(`${String(seed)}:${namespace}`);
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

export type SculptProceduralGeometry = {
  readonly componentId: string;
  readonly primitive: SculptComponent["primitive"];
  readonly dimensions: SculptComponent["dimensions"];
  readonly bevelRadius: number;
  readonly radialSegments: number;
  readonly longitudinalSegments: number;
};

export type SculptProceduralMaterial = {
  readonly materialId: string;
  readonly baseColor: string;
  readonly metallic: number;
  readonly roughness: number;
  readonly clearcoat: number;
  readonly microRoughness: number;
};

export type SculptProceduralNode = {
  readonly nodeId: string;
  readonly parentId: string | null;
  readonly componentId: string;
  readonly transform: SculptTransform;
  readonly pivotId: string;
  readonly colliderId: string;
  readonly materialId: string;
};

export type SculptProceduralEmit = {
  readonly schemaVersion: typeof SCULPT_PROCEDURAL_EMIT_VERSION;
  readonly kind: typeof SCULPT_PROCEDURAL_EMIT_KIND;
  readonly implementationDigest: string;
  readonly seed: number;
  readonly passIds: ReadonlyArray<string>;
  readonly geometry: ReadonlyArray<SculptProceduralGeometry>;
  readonly materials: ReadonlyArray<SculptProceduralMaterial>;
  readonly nodes: ReadonlyArray<SculptProceduralNode>;
  readonly digest: string;
};

export function computeSculptProceduralEmit(
  spec: SculptQualityObjectSculptSpec,
  options: { readonly seed?: number } = {},
): SculptProceduralEmit {
  const seed = options.seed ?? 0;
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new Error("Sculpt procedural seed must be a non-negative safe integer.");
  }
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
  const payload = snapshotSculptJson({
    schemaVersion: SCULPT_PROCEDURAL_EMIT_VERSION,
    kind: SCULPT_PROCEDURAL_EMIT_KIND,
    implementationDigest: SCULPT_PROCEDURAL_SOURCE_DIGEST,
    seed,
    passIds: spec.passes.map((pass) => pass.id),
    geometry,
    materials,
    nodes,
  });
  return snapshotSculptJson({
    ...payload,
    digest: digestSculptJson(payload as unknown as JsonValue),
  });
}
