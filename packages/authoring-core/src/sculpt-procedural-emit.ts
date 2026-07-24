/** Deterministic geometry/material factories for the sculpt-quality v1 path. */
import { createHash } from "node:crypto";
import type {
  JsonValue,
  ObjectSculptSpec,
  SculptComponent,
} from "@sceneaxi/schemas";

export const SCULPT_PROCEDURAL_EMIT_VERSION = 1 as const;
export const SCULPT_PROCEDURAL_EMIT_KIND =
  "sceneaxi.sculpt-procedural-emit" as const;
export const SCULPT_PROCEDURAL_MODULE_ID =
  "sceneaxi/authoring-core/sculpt-procedural-emit-v1" as const;
export const SCULPT_PROCEDURAL_EXPORT_NAME =
  "emitSculptProcedural" as const;

const SOURCE_DESCRIPTOR =
  "sceneaxi-owned:sculpt-procedural-emit:v1:seeded-geometry-material-hierarchy";

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const object = value as { readonly [key: string]: JsonValue };
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key] ?? null)}`)
    .join(",")}}`;
}

function digest(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export const SCULPT_PROCEDURAL_SOURCE_DIGEST = digest(SOURCE_DESCRIPTOR);

function seededUnit(seed: number, namespace: string) {
  const bytes = createHash("sha256").update(`${String(seed)}:${namespace}`).digest();
  return bytes.readUInt32BE(0) / 0xffffffff;
}

function rounded(value: number) {
  return Number(value.toFixed(6));
}

function geometryDetail(component: SculptComponent, seed: number) {
  const unit = seededUnit(seed, `geometry:${component.id}`);
  const radialSegments = 16 + Math.floor(unit * 4) * 4;
  return {
    bevelRadius: rounded(Math.min(...component.dimensions) * (0.025 + unit * 0.025)),
    radialSegments,
    longitudinalSegments: 2 + Math.floor(unit * 3),
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
  readonly componentId: string;
  readonly pivotId: string;
  readonly colliderId: string;
  readonly materialId: string;
};

export type SculptProceduralEmit = {
  readonly schemaVersion: typeof SCULPT_PROCEDURAL_EMIT_VERSION;
  readonly kind: typeof SCULPT_PROCEDURAL_EMIT_KIND;
  readonly seed: number;
  readonly passIds: ReadonlyArray<string>;
  readonly geometry: ReadonlyArray<SculptProceduralGeometry>;
  readonly materials: ReadonlyArray<SculptProceduralMaterial>;
  readonly nodes: ReadonlyArray<SculptProceduralNode>;
  readonly digest: string;
};

/** Emit a richer, byte-stable procedural plan from a validated multi-pass spec. */
export function emitSculptProcedural(
  spec: ObjectSculptSpec,
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
      dimensions: component.dimensions,
      ...geometryDetail(component, seed),
    }))
    .sort((left, right) => left.componentId.localeCompare(right.componentId));
  const materials = spec.materials
    .map((material) => {
      const unit = seededUnit(seed, `material:${material.id}`);
      return {
        materialId: material.id,
        baseColor: material.baseColor,
        metallic: material.metallic,
        roughness: material.roughness,
        clearcoat: rounded(unit * 0.35),
        microRoughness: rounded(Math.min(1, material.roughness + unit * 0.12)),
      };
    })
    .sort((left, right) => left.materialId.localeCompare(right.materialId));
  const nodes = spec.hierarchy
    .map((node) => {
      const component = componentById.get(node.componentId);
      if (component === undefined) {
        throw new Error(`Validated sculpt component "${node.componentId}" disappeared.`);
      }
      return {
        nodeId: node.id,
        componentId: node.componentId,
        pivotId: `${node.id}-pivot`,
        colliderId: `${node.id}-collider`,
        materialId: component.materialId,
      };
    })
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  const payload = {
    schemaVersion: SCULPT_PROCEDURAL_EMIT_VERSION,
    kind: SCULPT_PROCEDURAL_EMIT_KIND,
    seed,
    passIds: spec.passes.map((pass) => pass.id),
    geometry,
    materials,
    nodes,
  } as const;
  return Object.freeze({
    ...payload,
    digest: digest(canonicalJson(payload as unknown as JsonValue)),
  });
}
