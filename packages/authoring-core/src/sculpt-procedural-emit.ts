import {
  SCULPT_PROCEDURAL_EMIT_KIND,
  SCULPT_PROCEDURAL_EMIT_VERSION,
  SCULPT_PROCEDURAL_EXPORT_NAME,
  SCULPT_PROCEDURAL_MODULE_ID,
  SCULPT_PROCEDURAL_SOURCE_DIGEST,
  validateSculptProceduralEmit,
  type SculptProceduralEmit,
  type SculptProceduralGeometry,
  type SculptProceduralMaterial,
  type SculptProceduralNode,
  type SculptQualityObjectSculptSpec,
} from "@sceneaxi/schemas";

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

export function emitSculptProcedural(
  spec: SculptQualityObjectSculptSpec,
  options: { readonly seed?: number } = {},
): SculptProceduralEmit {
  const validated = validateSculptProceduralEmit(spec, options);
  if (!validated.ok) {
    throw new Error(
      validated.diagnostics[0]?.message ?? "Invalid ObjectSculptSpec.",
    );
  }
  return validated.value;
}
