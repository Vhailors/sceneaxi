/**
 * Hybrid sculpt public contracts (v1).
 *
 * These payloads are backend-neutral. In particular, component and transform
 * vocabulary never exposes a renderer implementation type.
 */
import { isJsonObject, type JsonObject } from "./document.js";
import {
  SCULPT_PROCEDURAL_EXPORT_NAME,
  SCULPT_PROCEDURAL_MODULE_ID,
  SCULPT_PROCEDURAL_SOURCE_DIGEST,
  computeSculptProceduralEmit,
  type SculptProceduralEmit,
} from "./sculpt-procedural.js";
import {
  digestSculptJson,
  isDenseArray,
  sculptJsonEqual,
  snapshotSculptJson,
} from "./sculpt-json.js";

export const SCULPT_SCHEMA_VERSION = 1 as const;
export const SCULPT_INTAKE_KIND = "sceneaxi.sculpt-intake" as const;
export const OBJECT_SCULPT_SPEC_KIND = "sceneaxi.object-sculpt-spec" as const;
export const SCULPT_ARTIFACT_KIND = "sceneaxi.sculpt-artifact" as const;
export const ANIMATION_READY_HIERARCHY_VERSION = 1 as const;
export const ANIMATION_READY_HIERARCHY_KIND =
  "sceneaxi.animation-ready-hierarchy" as const;
export const REQUIRED_SCULPT_PASSES = Object.freeze([
  "blockout",
  "structure",
  "materials",
  "sockets",
] as const);
export type RequiredSculptPassId = (typeof REQUIRED_SCULPT_PASSES)[number];

export const SCULPT_INTAKE_MODES = Object.freeze([
  "image",
  "image+brief",
  "multi-view",
  "structured-spec",
] as const);
export type SculptIntakeMode = (typeof SCULPT_INTAKE_MODES)[number];

export type Vector3 = readonly [number, number, number];

export type SculptTransform = {
  readonly translation: Vector3;
  readonly rotationEulerDegrees: Vector3;
  readonly scale: Vector3;
};

export type SculptImage = {
  readonly mediaType: "image/jpeg" | "image/png" | "image/webp";
  readonly uri: string;
  readonly digest: string;
};

export type SculptMaterial = {
  readonly id: string;
  readonly baseColor: string;
  readonly metallic: number;
  readonly roughness: number;
};

export type SculptComponent = {
  readonly id: string;
  readonly primitive: "box" | "cylinder" | "sphere";
  readonly dimensions: Vector3;
  readonly materialId: string;
};

export type SculptSocket = {
  readonly id: string;
  readonly nodeId: string;
  readonly kind: "animation" | "attachment";
  readonly axis: "x" | "y" | "z";
  readonly amplitude: number;
  readonly frequencyHz: number;
};

export type SculptHierarchyNode = {
  readonly id: string;
  readonly parentId: string | null;
  readonly componentId: string;
  readonly transform: SculptTransform;
};

export type SculptPass = {
  readonly id: string;
  readonly deterministic: true;
  readonly steps: ReadonlyArray<string>;
};

export type SculptDetailInventory = {
  readonly silhouetteFeatures: ReadonlyArray<string>;
  readonly structuralFeatures: ReadonlyArray<string>;
  readonly surfaceFeatures: ReadonlyArray<string>;
  readonly materialIds: ReadonlyArray<string>;
  readonly socketIds: ReadonlyArray<string>;
};

export type ObjectSculptSpec = {
  readonly schemaVersion: typeof SCULPT_SCHEMA_VERSION;
  readonly kind: typeof OBJECT_SCULPT_SPEC_KIND;
  readonly id: string;
  readonly rootNodeId: string;
  readonly components: ReadonlyArray<SculptComponent>;
  readonly materials: ReadonlyArray<SculptMaterial>;
  readonly sockets: ReadonlyArray<SculptSocket>;
  readonly hierarchy: ReadonlyArray<SculptHierarchyNode>;
  readonly complexityClass?: "simple" | "non-trivial";
  readonly passes?: ReadonlyArray<SculptPass>;
  readonly detailInventory?: SculptDetailInventory;
};

export type LegacyObjectSculptSpec = ObjectSculptSpec & {
  readonly complexityClass?: never;
  readonly passes?: never;
  readonly detailInventory?: never;
};

export type SculptQualityObjectSculptSpec = ObjectSculptSpec &
  (
    | {
        readonly complexityClass: "simple";
        readonly passes: ReadonlyArray<SculptPass>;
        readonly detailInventory?: SculptDetailInventory;
      }
    | {
        readonly complexityClass: "non-trivial";
        readonly passes: ReadonlyArray<SculptPass>;
        readonly detailInventory: SculptDetailInventory;
      }
  );

type SculptIntakeBase = {
  readonly schemaVersion: typeof SCULPT_SCHEMA_VERSION;
  readonly kind: typeof SCULPT_INTAKE_KIND;
  readonly intakeId: string;
};

export type SculptIntake =
  | (SculptIntakeBase & {
      readonly mode: "image";
      readonly image: SculptImage;
    })
  | (SculptIntakeBase & {
      readonly mode: "image+brief";
      readonly image: SculptImage;
      readonly brief: string;
    })
  | (SculptIntakeBase & {
      readonly mode: "multi-view";
      readonly images: ReadonlyArray<SculptImage>;
      readonly brief?: string;
    })
  | (SculptIntakeBase & {
      readonly mode: "structured-spec";
      readonly structuredSpec: ObjectSculptSpec;
    });

export type SculptProceduralModuleRef = {
  readonly moduleId: string;
  readonly exportName: string;
  readonly sourceDigest: string;
  readonly seed?: number;
  readonly emitDigest?: string;
};

export type LegacySculptProceduralModuleRef = SculptProceduralModuleRef & {
  readonly seed?: never;
  readonly emitDigest?: never;
};

export type SculptQualityProceduralModuleRef = SculptProceduralModuleRef & {
  readonly moduleId: typeof SCULPT_PROCEDURAL_MODULE_ID;
  readonly exportName: typeof SCULPT_PROCEDURAL_EXPORT_NAME;
  readonly sourceDigest: typeof SCULPT_PROCEDURAL_SOURCE_DIGEST;
  readonly seed: number;
  readonly emitDigest: string;
};

export type SculptPivot = {
  readonly id: string;
  readonly nodeId: string;
  readonly origin: Vector3;
};

export type SculptCollider = {
  readonly id: string;
  readonly nodeId: string;
  readonly shape: SculptComponent["primitive"];
  readonly dimensions: Vector3;
  readonly isTrigger: boolean;
};

export type SculptMaterialBinding = {
  readonly nodeId: string;
  readonly materialId: string;
};

export type SculptAttachmentPoint = {
  readonly id: string;
  readonly nodeId: string;
  readonly socketId: string;
};

export type SculptRuntimeHierarchy = {
  readonly rootNodeId: string;
  readonly nodes: ReadonlyArray<SculptHierarchyNode>;
};

export type LegacySculptRuntimeHierarchy = SculptRuntimeHierarchy;

export type SculptQualityRuntimeHierarchy = {
  readonly schemaVersion: typeof ANIMATION_READY_HIERARCHY_VERSION;
  readonly kind: typeof ANIMATION_READY_HIERARCHY_KIND;
  readonly rootNodeId: string;
  readonly nodes: ReadonlyArray<SculptHierarchyNode>;
  readonly pivots: ReadonlyArray<SculptPivot>;
  readonly sockets: ReadonlyArray<SculptSocket>;
  readonly colliders: ReadonlyArray<SculptCollider>;
  readonly materials: ReadonlyArray<SculptMaterialBinding>;
  readonly attachments: ReadonlyArray<SculptAttachmentPoint>;
};

export type SculptQualityGateEvidence = {
  readonly id: string;
  readonly status: "passed";
  readonly digest: string;
};

export type SculptEvidence = {
  readonly method: "image-brief-reconstruction" | "structured-fixture";
  readonly intakeDigest: string;
  readonly specDigest: string;
  readonly proceduralModuleDigest: string;
  readonly qualityGates: ReadonlyArray<SculptQualityGateEvidence>;
};

type SculptArtifactBase = {
  readonly schemaVersion: typeof SCULPT_SCHEMA_VERSION;
  readonly kind: typeof SCULPT_ARTIFACT_KIND;
  readonly artifactId: string;
  readonly evidence: SculptEvidence;
};

export type SculptArtifact = SculptArtifactBase & {
  readonly spec: ObjectSculptSpec;
  readonly proceduralModule: SculptProceduralModuleRef;
  readonly runtimeHierarchy: SculptRuntimeHierarchy;
};

export type LegacySculptArtifact = SculptArtifact & {
  readonly spec: LegacyObjectSculptSpec;
  readonly proceduralModule: LegacySculptProceduralModuleRef;
  readonly runtimeHierarchy: LegacySculptRuntimeHierarchy;
};

export type SculptQualityArtifact = SculptArtifact & {
  readonly spec: SculptQualityObjectSculptSpec;
  readonly proceduralModule: SculptQualityProceduralModuleRef;
  readonly runtimeHierarchy: SculptQualityRuntimeHierarchy;
};

export type SculptDiagnosticCode =
  | "not-object"
  | "schema-major-mismatch"
  | "invalid-kind"
  | "missing-field"
  | "unexpected-field"
  | "invalid-mode"
  | "invalid-field"
  | "duplicate-id"
  | "invalid-reference"
  | "invalid-hierarchy"
  | "missing-sculpt-pass"
  | "out-of-order-sculpt-pass"
  | "empty-sculpt-pass"
  | "missing-detail-inventory"
  | "shallow-detail-inventory"
  | "shallow-sculpt-spec"
  | "missing-attachment-socket"
  | "missing-runtime-pivot"
  | "missing-runtime-socket"
  | "missing-runtime-collider"
  | "missing-runtime-material"
  | "missing-runtime-attachment";

export type SculptDiagnostic = {
  readonly code: SculptDiagnosticCode;
  readonly path: string;
  readonly message: string;
};

export type SculptValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly diagnostics: readonly SculptDiagnostic[] };

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const MODULE_ID_RE =
  /^(?:@[a-z0-9-]+\/[a-z0-9-]+|[a-z0-9][a-z0-9./-]*)$/;
const EXPORT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MODES = new Set<string>(SCULPT_INTAKE_MODES);

function refuse<T>(
  code: SculptDiagnosticCode,
  path: string,
  message: string,
): SculptValidationResult<T> {
  return { ok: false, diagnostics: [{ code, path, message }] };
}

function exactFields(
  value: JsonObject,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): SculptDiagnostic | null {
  for (const field of required) {
    if (!Object.hasOwn(value, field)) {
      return {
        code: "missing-field",
        path: `${path}.${field}`,
        message: `Missing required field "${field}".`,
      };
    }
  }
  const allowed = new Set([...required, ...optional]);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      return {
        code: "unexpected-field",
        path: `${path}.${field}`,
        message: `Unexpected field "${field}".`,
      };
    }
  }
  return null;
}

export function isSculptIdentifier(value: unknown): value is string {
  return typeof value === "string" && ID_RE.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_RE.test(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isVector3(value: unknown, positive = false): value is Vector3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    isDenseArray(value) &&
    value.every((item) => isFiniteNumber(item) && (!positive || item > 0))
  );
}

export function isSculptTransform(value: unknown): value is SculptTransform {
  if (!isJsonObject(value)) return false;
  const fields = exactFields(
    value,
    ["translation", "rotationEulerDegrees", "scale"],
    [],
    "$transform",
  );
  return (
    fields === null &&
    isVector3(value["translation"]) &&
    isVector3(value["rotationEulerDegrees"]) &&
    isVector3(value["scale"], true)
  );
}

function validateImage(value: unknown, path: string): SculptDiagnostic | null {
  if (!isJsonObject(value)) {
    return { code: "invalid-field", path, message: "Image must be an object." };
  }
  const fields = exactFields(value, ["mediaType", "uri", "digest"], [], path);
  if (fields !== null) return fields;
  if (typeof value["mediaType"] !== "string" || !MEDIA_TYPES.has(value["mediaType"])) {
    return {
      code: "invalid-field",
      path: `${path}.mediaType`,
      message: "Image mediaType must be image/jpeg, image/png, or image/webp.",
    };
  }
  if (typeof value["uri"] !== "string" || value["uri"].trim().length === 0) {
    return { code: "invalid-field", path: `${path}.uri`, message: "Image uri must be non-empty." };
  }
  if (!isDigest(value["digest"])) {
    return { code: "invalid-field", path: `${path}.digest`, message: "Image digest must be sha256:<64 lowercase hex>." };
  }
  return null;
}

function duplicate(values: readonly string[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
}

function specFailure(
  code: SculptDiagnosticCode,
  path: string,
  message: string,
): SculptValidationResult<ObjectSculptSpec> {
  return refuse(code, path, message);
}

function validateFeatureList(
  value: unknown,
  path: string,
): SculptDiagnostic | null {
  if (
    !Array.isArray(value) ||
    !isDenseArray(value) ||
    value.some(
      (feature) =>
        typeof feature !== "string" ||
        feature.trim().length === 0 ||
        feature !== feature.trim(),
    )
  ) {
    return {
      code: "invalid-field",
      path,
      message: "Detail inventory entries must be non-empty, trimmed strings.",
    };
  }
  if (duplicate(value as string[]) !== undefined) {
    return {
      code: "duplicate-id",
      path,
      message: "Detail inventory entries must be unique.",
    };
  }
  return null;
}

function hasQualityFields(value: JsonObject) {
  return (
    Object.hasOwn(value, "complexityClass") ||
    Object.hasOwn(value, "passes") ||
    Object.hasOwn(value, "detailInventory")
  );
}

export function isSculptQualityObjectSculptSpec(
  value: ObjectSculptSpec,
): value is SculptQualityObjectSculptSpec {
  return Object.hasOwn(value, "passes");
}

function passSequenceFailure(
  passIds: readonly string[],
): SculptValidationResult<ObjectSculptSpec> | null {
  const allowedSequences = [
    REQUIRED_SCULPT_PASSES,
    [
      "blockout",
      "structure",
      "materials",
      "surface-detail",
      "sockets",
    ],
  ] as const;
  if (
    allowedSequences.some(
      (sequence) =>
        sequence.length === passIds.length &&
        sequence.every((passId, index) => passIds[index] === passId),
    )
  ) {
    return null;
  }
  const missing = REQUIRED_SCULPT_PASSES.find(
    (passId) => !passIds.includes(passId),
  );
  if (missing !== undefined) {
    return specFailure(
      "missing-sculpt-pass",
      "$.passes",
      `Missing required sculpt pass "${missing}".`,
    );
  }
  return specFailure(
    "out-of-order-sculpt-pass",
    "$.passes",
    `Sculpt-quality v1 passes must be blockout -> structure -> materials -> sockets, with only the optional surface-detail pass before sockets.`,
  );
}

/** Validate components, materials, sockets, and a connected rooted hierarchy. */
export function validateObjectSculptSpec(
  value: unknown,
): SculptValidationResult<ObjectSculptSpec> {
  if (!isJsonObject(value)) return refuse("not-object", "$", "ObjectSculptSpec must be a JSON object.");
  const quality = hasQualityFields(value);
  if (quality && !Object.hasOwn(value, "passes")) {
    return specFailure(
      "missing-sculpt-pass",
      "$.passes",
      `ObjectSculptSpec must declare ${REQUIRED_SCULPT_PASSES.join(" -> ")}.`,
    );
  }
  const fields = exactFields(
    value,
    quality
      ? ["schemaVersion", "kind", "id", "rootNodeId", "complexityClass", "passes", "components", "materials", "sockets", "hierarchy"]
      : ["schemaVersion", "kind", "id", "rootNodeId", "components", "materials", "sockets", "hierarchy"],
    quality ? ["detailInventory"] : [],
    "$",
  );
  if (fields !== null) return { ok: false, diagnostics: [fields] };
  if (value["schemaVersion"] !== SCULPT_SCHEMA_VERSION) {
    return refuse("schema-major-mismatch", "$.schemaVersion", `Sculpt schema major must be ${SCULPT_SCHEMA_VERSION}.`);
  }
  if (value["kind"] !== OBJECT_SCULPT_SPEC_KIND) {
    return refuse("invalid-kind", "$.kind", `kind must be "${OBJECT_SCULPT_SPEC_KIND}".`);
  }
  if (!isSculptIdentifier(value["id"]) || !isSculptIdentifier(value["rootNodeId"])) {
    return specFailure("invalid-field", "$.id", "Spec and root node ids must use lowercase slug identifiers.");
  }
  if (
    quality &&
    value["complexityClass"] !== "simple" &&
    value["complexityClass"] !== "non-trivial"
  ) {
    return specFailure(
      "invalid-field",
      "$.complexityClass",
      'complexityClass must be "simple" or "non-trivial".',
    );
  }

  if (quality) {
    const passes = value["passes"];
    if (!Array.isArray(passes) || !isDenseArray(passes)) {
      return specFailure("invalid-field", "$.passes", "passes must be a dense array.");
    }
    const passIds: string[] = [];
    for (const [index, pass] of passes.entries()) {
      const path = `$.passes[${index}]`;
      if (!isJsonObject(pass)) {
        return specFailure("invalid-field", path, "Sculpt pass must be an object.");
      }
      const passFields = exactFields(pass, ["id", "deterministic", "steps"], [], path);
      if (passFields !== null) return { ok: false, diagnostics: [passFields] };
      if (!isSculptIdentifier(pass["id"])) {
        return specFailure("invalid-field", `${path}.id`, "Sculpt pass id is invalid.");
      }
      if (pass["deterministic"] !== true) {
        return specFailure(
          "invalid-field",
          `${path}.deterministic`,
          "Every sculpt pass must be deterministic.",
        );
      }
      const steps = pass["steps"];
      if (
        !Array.isArray(steps) ||
        steps.length === 0 ||
        !isDenseArray(steps) ||
        steps.some((step) => typeof step !== "string" || step.trim().length === 0)
      ) {
        return specFailure(
          "empty-sculpt-pass",
          `${path}.steps`,
          `Sculpt pass "${String(pass["id"])}" must contain at least one named step.`,
        );
      }
      passIds.push(pass["id"]);
    }
    const duplicatePass = duplicate(passIds);
    if (duplicatePass !== undefined) {
      return specFailure("duplicate-id", "$.passes", `Duplicate sculpt pass id "${duplicatePass}".`);
    }
    const sequenceFailure = passSequenceFailure(passIds);
    if (sequenceFailure !== null) return sequenceFailure;
  }
  const materials = value["materials"];
  if (
    !Array.isArray(materials) ||
    materials.length === 0 ||
    !isDenseArray(materials)
  ) {
    return specFailure("invalid-field", "$.materials", "materials must be a non-empty array.");
  }
  const materialIds: string[] = [];
  for (const [index, material] of materials.entries()) {
    const path = `$.materials[${index}]`;
    if (!isJsonObject(material)) return specFailure("invalid-field", path, "Material must be an object.");
    const materialFields = exactFields(material, ["id", "baseColor", "metallic", "roughness"], [], path);
    if (materialFields !== null) return { ok: false, diagnostics: [materialFields] };
    if (!isSculptIdentifier(material["id"])) return specFailure("invalid-field", `${path}.id`, "Material id is invalid.");
    if (typeof material["baseColor"] !== "string" || !COLOR_RE.test(material["baseColor"])) {
      return specFailure("invalid-field", `${path}.baseColor`, "baseColor must be #RRGGBB.");
    }
    for (const key of ["metallic", "roughness"] as const) {
      const channel = material[key];
      if (!isFiniteNumber(channel) || channel < 0 || channel > 1) {
        return specFailure("invalid-field", `${path}.${key}`, `${key} must be between 0 and 1.`);
      }
    }
    materialIds.push(material["id"]);
  }
  const duplicateMaterial = duplicate(materialIds);
  if (duplicateMaterial !== undefined) return specFailure("duplicate-id", "$.materials", `Duplicate material id "${duplicateMaterial}".`);
  const materialIdSet = new Set(materialIds);

  const components = value["components"];
  if (
    !Array.isArray(components) ||
    components.length === 0 ||
    !isDenseArray(components)
  ) {
    return specFailure("invalid-field", "$.components", "components must be a non-empty array.");
  }
  const componentIds: string[] = [];
  for (const [index, component] of components.entries()) {
    const path = `$.components[${index}]`;
    if (!isJsonObject(component)) return specFailure("invalid-field", path, "Component must be an object.");
    const componentFields = exactFields(component, ["id", "primitive", "dimensions", "materialId"], [], path);
    if (componentFields !== null) return { ok: false, diagnostics: [componentFields] };
    if (!isSculptIdentifier(component["id"])) return specFailure("invalid-field", `${path}.id`, "Component id is invalid.");
    if (!["box", "cylinder", "sphere"].includes(String(component["primitive"]))) {
      return specFailure("invalid-field", `${path}.primitive`, "primitive must be box, cylinder, or sphere.");
    }
    if (!isVector3(component["dimensions"], true)) {
      return specFailure("invalid-field", `${path}.dimensions`, "dimensions must contain three positive finite numbers.");
    }
    if (!isSculptIdentifier(component["materialId"]) || !materialIdSet.has(component["materialId"])) {
      return specFailure("invalid-reference", `${path}.materialId`, "Component must reference an existing material.");
    }
    componentIds.push(component["id"]);
  }
  const duplicateComponent = duplicate(componentIds);
  if (duplicateComponent !== undefined) return specFailure("duplicate-id", "$.components", `Duplicate component id "${duplicateComponent}".`);
  const componentIdSet = new Set(componentIds);

  const hierarchy = value["hierarchy"];
  if (
    !Array.isArray(hierarchy) ||
    hierarchy.length === 0 ||
    !isDenseArray(hierarchy)
  ) {
    return specFailure("invalid-hierarchy", "$.hierarchy", "hierarchy must be a non-empty array.");
  }
  const nodeIds: string[] = [];
  const parents = new Map<string, string | null>();
  for (const [index, node] of hierarchy.entries()) {
    const path = `$.hierarchy[${index}]`;
    if (!isJsonObject(node)) return specFailure("invalid-field", path, "Hierarchy node must be an object.");
    const nodeFields = exactFields(node, ["id", "parentId", "componentId", "transform"], [], path);
    if (nodeFields !== null) return { ok: false, diagnostics: [nodeFields] };
    if (!isSculptIdentifier(node["id"])) return specFailure("invalid-field", `${path}.id`, "Node id is invalid.");
    if (node["parentId"] !== null && !isSculptIdentifier(node["parentId"])) {
      return specFailure("invalid-field", `${path}.parentId`, "parentId must be null or a node id.");
    }
    if (!isSculptIdentifier(node["componentId"]) || !componentIdSet.has(node["componentId"])) {
      return specFailure("invalid-reference", `${path}.componentId`, "Node must reference an existing component.");
    }
    if (!isSculptTransform(node["transform"])) return specFailure("invalid-field", `${path}.transform`, "Node transform is invalid.");
    nodeIds.push(node["id"]);
    parents.set(node["id"], node["parentId"]);
  }
  const duplicateNode = duplicate(nodeIds);
  if (duplicateNode !== undefined) return specFailure("duplicate-id", "$.hierarchy", `Duplicate node id "${duplicateNode}".`);
  const nodeIdSet = new Set(nodeIds);
  if (!nodeIdSet.has(value["rootNodeId"])) return specFailure("invalid-reference", "$.rootNodeId", "rootNodeId must reference a hierarchy node.");
  if (parents.get(value["rootNodeId"]) !== null) return specFailure("invalid-hierarchy", "$.rootNodeId", "Root node parentId must be null.");
  if ([...parents.values()].filter((parent) => parent === null).length !== 1) {
    return specFailure("invalid-hierarchy", "$.hierarchy", "Hierarchy must contain exactly one root.");
  }
  for (const [nodeId, parentId] of parents) {
    if (parentId !== null && !nodeIdSet.has(parentId)) return specFailure("invalid-reference", "$.hierarchy", `Node "${nodeId}" references missing parent "${parentId}".`);
  }
  const resolvedNodeIds = new Set<string>();
  for (const nodeId of nodeIds) {
    if (resolvedNodeIds.has(nodeId)) continue;
    const path = new Set<string>();
    let cursor: string | null | undefined = nodeId;
    while (cursor !== null && cursor !== undefined && !resolvedNodeIds.has(cursor)) {
      if (path.has(cursor)) return specFailure("invalid-hierarchy", "$.hierarchy", `Hierarchy cycle includes "${cursor}".`);
      path.add(cursor);
      cursor = parents.get(cursor);
    }
    for (const resolvedNodeId of path) resolvedNodeIds.add(resolvedNodeId);
  }

  const sockets = value["sockets"];
  if (!Array.isArray(sockets) || !isDenseArray(sockets)) {
    return specFailure("invalid-field", "$.sockets", "sockets must be a dense array.");
  }
  const socketIds: string[] = [];
  for (const [index, socket] of sockets.entries()) {
    const path = `$.sockets[${index}]`;
    if (!isJsonObject(socket)) return specFailure("invalid-field", path, "Socket must be an object.");
    const socketFields = exactFields(socket, ["id", "nodeId", "kind", "axis", "amplitude", "frequencyHz"], [], path);
    if (socketFields !== null) return { ok: false, diagnostics: [socketFields] };
    if (!isSculptIdentifier(socket["id"])) return specFailure("invalid-field", `${path}.id`, "Socket id is invalid.");
    if (!isSculptIdentifier(socket["nodeId"]) || !nodeIdSet.has(socket["nodeId"])) return specFailure("invalid-reference", `${path}.nodeId`, "Socket must reference an existing node.");
    if (!["animation", "attachment"].includes(String(socket["kind"]))) return specFailure("invalid-field", `${path}.kind`, "Socket kind is invalid.");
    if (!["x", "y", "z"].includes(String(socket["axis"]))) return specFailure("invalid-field", `${path}.axis`, "Socket axis is invalid.");
    if (!isFiniteNumber(socket["amplitude"]) || socket["amplitude"] < 0 || !isFiniteNumber(socket["frequencyHz"]) || socket["frequencyHz"] < 0) {
      return specFailure("invalid-field", path, "Socket amplitude and frequencyHz must be non-negative finite numbers.");
    }
    socketIds.push(socket["id"]);
  }
  const duplicateSocket = duplicate(socketIds);
  if (duplicateSocket !== undefined) return specFailure("duplicate-id", "$.sockets", `Duplicate socket id "${duplicateSocket}".`);
  if (
    quality &&
    !sockets.some(
      (socket) => isJsonObject(socket) && socket["kind"] === "attachment",
    )
  ) {
    return specFailure(
      "missing-attachment-socket",
      "$.sockets",
      "Sculpt-quality v1 requires at least one attachment socket.",
    );
  }

  const rawInventory = value["detailInventory"];
  if (
    quality &&
    value["complexityClass"] === "non-trivial" &&
    rawInventory === undefined
  ) {
    return specFailure(
      "missing-detail-inventory",
      "$.detailInventory",
      "Non-trivial sculpts require a detail inventory.",
    );
  }
  if (rawInventory !== undefined) {
    if (!isJsonObject(rawInventory)) {
      return specFailure("invalid-field", "$.detailInventory", "detailInventory must be an object.");
    }
    const inventoryFields = exactFields(
      rawInventory,
      ["silhouetteFeatures", "structuralFeatures", "surfaceFeatures", "materialIds", "socketIds"],
      [],
      "$.detailInventory",
    );
    if (inventoryFields !== null) return { ok: false, diagnostics: [inventoryFields] };
    for (const key of [
      "silhouetteFeatures",
      "structuralFeatures",
      "surfaceFeatures",
      "materialIds",
      "socketIds",
    ] as const) {
      const featureFailure = validateFeatureList(rawInventory[key], `$.detailInventory.${key}`);
      if (featureFailure !== null) return { ok: false, diagnostics: [featureFailure] };
    }
    const inventoryMaterialIds = rawInventory["materialIds"] as string[];
    if (inventoryMaterialIds.some((materialId) => !materialIdSet.has(materialId))) {
      return specFailure(
        "invalid-reference",
        "$.detailInventory.materialIds",
        "Detail inventory materialIds must reference spec materials.",
      );
    }
    const socketIdSet = new Set(socketIds);
    const inventorySocketIds = rawInventory["socketIds"] as string[];
    if (inventorySocketIds.some((socketId) => !socketIdSet.has(socketId))) {
      return specFailure(
        "invalid-reference",
        "$.detailInventory.socketIds",
        "Detail inventory socketIds must reference spec sockets.",
      );
    }
    if (
      quality &&
      value["complexityClass"] === "non-trivial" &&
      ((rawInventory["silhouetteFeatures"] as string[]).length < 2 ||
        (rawInventory["structuralFeatures"] as string[]).length < 3 ||
        (rawInventory["surfaceFeatures"] as string[]).length < 2 ||
        inventoryMaterialIds.length < 2 ||
        inventorySocketIds.length < 1)
    ) {
      return specFailure(
        "shallow-detail-inventory",
        "$.detailInventory",
        "Non-trivial detail inventory requires 2 silhouette, 3 structural, 2 surface, 2 material, and 1 socket entries.",
      );
    }
  }
  if (
    quality &&
    value["complexityClass"] === "non-trivial" &&
    (components.length < 3 || materials.length < 2 || hierarchy.length < 3 || sockets.length < 1)
  ) {
    return specFailure(
      "shallow-sculpt-spec",
      "$",
      "Non-trivial sculpts require at least 3 components, 2 materials, 3 hierarchy nodes, and 1 socket.",
    );
  }

  return { ok: true, value: value as ObjectSculptSpec };
}

export function validateSculptProceduralEmit(
  value: unknown,
  options: { readonly seed?: number } = {},
): SculptValidationResult<SculptProceduralEmit> {
  const spec = validateObjectSculptSpec(value);
  if (!spec.ok) return spec;
  if (!isSculptQualityObjectSculptSpec(spec.value)) {
    return refuse(
      "missing-sculpt-pass",
      "$.passes",
      "Sculpt procedural emit requires a sculpt-quality ObjectSculptSpec.",
    );
  }
  const seed = options.seed ?? 0;
  if (!Number.isSafeInteger(seed) || seed < 0) {
    return refuse(
      "invalid-field",
      "$.seed",
      "Sculpt procedural seed must be a non-negative safe integer.",
    );
  }
  return {
    ok: true,
    value: computeSculptProceduralEmit(spec.value, { seed }),
  };
}

/** Validate an exact multi-modal intake envelope; mode-specific fields do not bleed across modes. */
export function validateSculptIntake(value: unknown): SculptValidationResult<SculptIntake> {
  if (!isJsonObject(value)) return refuse("not-object", "$", "Sculpt Intake must be a JSON object.");
  if (value["schemaVersion"] !== SCULPT_SCHEMA_VERSION) return refuse("schema-major-mismatch", "$.schemaVersion", `Sculpt schema major must be ${SCULPT_SCHEMA_VERSION}.`);
  if (value["kind"] !== SCULPT_INTAKE_KIND) return refuse("invalid-kind", "$.kind", `kind must be "${SCULPT_INTAKE_KIND}".`);
  if (!isSculptIdentifier(value["intakeId"])) return refuse("invalid-field", "$.intakeId", "intakeId must be a lowercase slug.");
  const mode = value["mode"];
  if (typeof mode !== "string" || !MODES.has(mode)) return refuse("invalid-mode", "$.mode", `mode must be one of ${SCULPT_INTAKE_MODES.join(", ")}.`);

  const base = ["schemaVersion", "kind", "intakeId", "mode"];
  const shapes: Record<SculptIntakeMode, { required: string[]; optional: string[] }> = {
    image: { required: [...base, "image"], optional: [] },
    "image+brief": { required: [...base, "image", "brief"], optional: [] },
    "multi-view": { required: [...base, "images"], optional: ["brief"] },
    "structured-spec": { required: [...base, "structuredSpec"], optional: [] },
  };
  const shape = shapes[mode as SculptIntakeMode];
  const fields = exactFields(value, shape.required, shape.optional, "$");
  if (fields !== null) return { ok: false, diagnostics: [fields] };

  if (mode === "image" || mode === "image+brief") {
    const imageFailure = validateImage(value["image"], "$.image");
    if (imageFailure !== null) return { ok: false, diagnostics: [imageFailure] };
  }
  if ((mode === "image+brief" || Object.hasOwn(value, "brief")) && (typeof value["brief"] !== "string" || value["brief"].trim().length === 0)) {
    return refuse("invalid-field", "$.brief", "brief must be a non-empty string when present.");
  }
  if (mode === "multi-view") {
    const images = value["images"];
    if (
      !Array.isArray(images) ||
      images.length < 2 ||
      !isDenseArray(images)
    ) {
      return refuse("invalid-field", "$.images", "multi-view requires at least two dense image entries.");
    }
    for (const [index, image] of images.entries()) {
      const failure = validateImage(image, `$.images[${index}]`);
      if (failure !== null) return { ok: false, diagnostics: [failure] };
    }
    const digests = images.map((image) => (image as JsonObject)["digest"] as string);
    if (duplicate(digests) !== undefined) return refuse("duplicate-id", "$.images", "multi-view image digests must be unique.");
  }
  if (mode === "structured-spec") {
    const spec = validateObjectSculptSpec(value["structuredSpec"]);
    if (!spec.ok) return { ok: false, diagnostics: spec.diagnostics.map((diagnostic) => ({ ...diagnostic, path: `$.structuredSpec${diagnostic.path.slice(1)}` })) };
  }
  return { ok: true, value: value as SculptIntake };
}

function legacyAttachmentId(
  spec: Pick<ObjectSculptSpec, "rootNodeId" | "sockets">,
) {
  const existing = new Set(spec.sockets.map((socket) => socket.id));
  const base = `${spec.rootNodeId}-attachment`;
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}-${String(suffix)}`)) suffix += 1;
  return `${base}-${String(suffix)}`;
}

export function normalizeObjectSculptSpec(
  spec: ObjectSculptSpec,
): SculptQualityObjectSculptSpec {
  if (isSculptQualityObjectSculptSpec(spec)) {
    return snapshotSculptJson(spec);
  }
  const sockets = spec.sockets.some((socket) => socket.kind === "attachment")
    ? spec.sockets
    : [
        ...spec.sockets,
        {
          id: legacyAttachmentId(spec),
          nodeId: spec.rootNodeId,
          kind: "attachment" as const,
          axis: "y" as const,
          amplitude: 0,
          frequencyHz: 0,
        },
      ];
  return snapshotSculptJson({
    ...spec,
    complexityClass: "simple",
    passes: [
      {
        id: "blockout",
        deterministic: true,
        steps: ["migrate-existing-volumes"],
      },
      {
        id: "structure",
        deterministic: true,
        steps: ["migrate-existing-hierarchy"],
      },
      {
        id: "materials",
        deterministic: true,
        steps: ["migrate-existing-materials"],
      },
      {
        id: "sockets",
        deterministic: true,
        steps: ["migrate-existing-sockets"],
      },
    ],
    sockets,
  });
}

export function digestObjectSculptSpec(spec: ObjectSculptSpec) {
  return digestSculptJson(spec as unknown as JsonObject);
}

/** Project a validated sculpt spec into descriptive animation-ready runtime metadata. */
export function projectAnimationReadyHierarchy(
  spec: SculptQualityObjectSculptSpec,
): SculptQualityRuntimeHierarchy {
  const components = new Map(spec.components.map((component) => [component.id, component]));
  const attachmentSockets = spec.sockets.filter((socket) => socket.kind === "attachment");
  return snapshotSculptJson({
    schemaVersion: ANIMATION_READY_HIERARCHY_VERSION,
    kind: ANIMATION_READY_HIERARCHY_KIND,
    rootNodeId: spec.rootNodeId,
    nodes: spec.hierarchy,
    pivots: spec.hierarchy.map((node) => ({
      id: `${node.id}-pivot`,
      nodeId: node.id,
      origin: [0, 0, 0],
    })),
    sockets: spec.sockets,
    colliders: spec.hierarchy.map((node) => {
      const component = components.get(node.componentId);
      if (component === undefined) {
        throw new Error(`Validated sculpt node "${node.id}" has no component.`);
      }
      return {
        id: `${node.id}-collider`,
        nodeId: node.id,
        shape: component.primitive,
        dimensions: component.dimensions,
        isTrigger: false,
      };
    }),
    materials: spec.hierarchy.map((node) => {
      const component = components.get(node.componentId);
      if (component === undefined) {
        throw new Error(`Validated sculpt node "${node.id}" has no component.`);
      }
      return { nodeId: node.id, materialId: component.materialId };
    }),
    attachments: attachmentSockets.map((socket) => ({
      id: `${socket.id}-point`,
      nodeId: socket.nodeId,
      socketId: socket.id,
    })),
  });
}

/** Validate a complete SceneAxi-owned Sculpt Artifact package. */
export function validateSculptArtifact(value: unknown): SculptValidationResult<SculptArtifact> {
  if (!isJsonObject(value)) return refuse("not-object", "$", "Sculpt Artifact must be a JSON object.");
  const fields = exactFields(value, ["schemaVersion", "kind", "artifactId", "spec", "proceduralModule", "runtimeHierarchy", "evidence"], [], "$");
  if (fields !== null) return { ok: false, diagnostics: [fields] };
  if (value["schemaVersion"] !== SCULPT_SCHEMA_VERSION) return refuse("schema-major-mismatch", "$.schemaVersion", `Sculpt schema major must be ${SCULPT_SCHEMA_VERSION}.`);
  if (value["kind"] !== SCULPT_ARTIFACT_KIND) return refuse("invalid-kind", "$.kind", `kind must be "${SCULPT_ARTIFACT_KIND}".`);
  if (!isSculptIdentifier(value["artifactId"])) return refuse("invalid-field", "$.artifactId", "artifactId must be a lowercase slug.");
  const spec = validateObjectSculptSpec(value["spec"]);
  if (!spec.ok) return { ok: false, diagnostics: spec.diagnostics.map((diagnostic) => ({ ...diagnostic, path: `$.spec${diagnostic.path.slice(1)}` })) };
  const quality = isSculptQualityObjectSculptSpec(spec.value);

  const moduleRef = value["proceduralModule"];
  if (!isJsonObject(moduleRef)) return refuse("invalid-field", "$.proceduralModule", "proceduralModule must be an object.");
  const moduleFields = exactFields(
    moduleRef,
    quality
      ? ["moduleId", "exportName", "sourceDigest", "seed", "emitDigest"]
      : ["moduleId", "exportName", "sourceDigest"],
    [],
    "$.proceduralModule",
  );
  if (moduleFields !== null) return { ok: false, diagnostics: [moduleFields] };
  if (
    typeof moduleRef["moduleId"] !== "string" ||
    !MODULE_ID_RE.test(moduleRef["moduleId"]) ||
    typeof moduleRef["exportName"] !== "string" ||
    !EXPORT_RE.test(moduleRef["exportName"]) ||
    !isDigest(moduleRef["sourceDigest"])
  ) {
    return refuse("invalid-field", "$.proceduralModule", "Procedural module reference is invalid.");
  }
  if (
    quality &&
    (moduleRef["moduleId"] !== SCULPT_PROCEDURAL_MODULE_ID ||
      moduleRef["exportName"] !== SCULPT_PROCEDURAL_EXPORT_NAME ||
      moduleRef["sourceDigest"] !== SCULPT_PROCEDURAL_SOURCE_DIGEST ||
      !Number.isSafeInteger(moduleRef["seed"]) ||
      Number(moduleRef["seed"]) < 0 ||
      !isDigest(moduleRef["emitDigest"]))
  ) {
    return refuse(
      "invalid-reference",
      "$.proceduralModule",
      "Sculpt-quality artifacts must bind the public SceneAxi procedural emitter.",
    );
  }

  const runtime = value["runtimeHierarchy"];
  if (!isJsonObject(runtime)) return refuse("invalid-field", "$.runtimeHierarchy", "runtimeHierarchy must be an object.");
  if (!quality) {
    const runtimeFields = exactFields(
      runtime,
      ["rootNodeId", "nodes"],
      [],
      "$.runtimeHierarchy",
    );
    if (runtimeFields !== null) {
      return { ok: false, diagnostics: [runtimeFields] };
    }
    if (
      runtime["rootNodeId"] !== spec.value.rootNodeId ||
      !Array.isArray(runtime["nodes"]) ||
      runtime["nodes"].length === 0 ||
      !isDenseArray(runtime["nodes"]) ||
      !sculptJsonEqual(runtime["nodes"], spec.value.hierarchy)
    ) {
      return refuse(
        "invalid-hierarchy",
        "$.runtimeHierarchy",
        "Legacy runtime hierarchy must exactly project the validated spec hierarchy.",
      );
    }
  } else {
    for (const [field, code] of [
      ["pivots", "missing-runtime-pivot"],
      ["sockets", "missing-runtime-socket"],
      ["colliders", "missing-runtime-collider"],
      ["materials", "missing-runtime-material"],
      ["attachments", "missing-runtime-attachment"],
    ] as const) {
      if (!Object.hasOwn(runtime, field)) {
        return refuse(code, `$.runtimeHierarchy.${field}`, `Animation-ready hierarchy requires ${field}.`);
      }
    }
    const runtimeFields = exactFields(
      runtime,
      ["schemaVersion", "kind", "rootNodeId", "nodes", "pivots", "sockets", "colliders", "materials", "attachments"],
      [],
      "$.runtimeHierarchy",
    );
    if (runtimeFields !== null) return { ok: false, diagnostics: [runtimeFields] };
    if (runtime["schemaVersion"] !== ANIMATION_READY_HIERARCHY_VERSION) {
      return refuse(
        "schema-major-mismatch",
        "$.runtimeHierarchy.schemaVersion",
        `Animation-ready hierarchy schema major must be ${ANIMATION_READY_HIERARCHY_VERSION}.`,
      );
    }
    if (runtime["kind"] !== ANIMATION_READY_HIERARCHY_KIND) {
      return refuse(
        "invalid-kind",
        "$.runtimeHierarchy.kind",
        `kind must be "${ANIMATION_READY_HIERARCHY_KIND}".`,
      );
    }
    if (
      runtime["rootNodeId"] !== spec.value.rootNodeId ||
      !Array.isArray(runtime["nodes"]) ||
      !isDenseArray(runtime["nodes"]) ||
      !sculptJsonEqual(runtime["nodes"], spec.value.hierarchy)
    ) {
      return refuse(
        "invalid-hierarchy",
        "$.runtimeHierarchy",
        "Runtime hierarchy must exactly project the validated spec hierarchy.",
      );
    }
    if (
      !Array.isArray(runtime["sockets"]) ||
      !isDenseArray(runtime["sockets"]) ||
      !sculptJsonEqual(runtime["sockets"], spec.value.sockets)
    ) {
      return refuse(
        "missing-runtime-socket",
        "$.runtimeHierarchy.sockets",
        "Runtime sockets must exactly project the validated spec sockets.",
      );
    }
    const expectedRuntime = projectAnimationReadyHierarchy(spec.value);
    for (const [field, code] of [
      ["pivots", "missing-runtime-pivot"],
      ["colliders", "missing-runtime-collider"],
      ["materials", "missing-runtime-material"],
      ["attachments", "missing-runtime-attachment"],
    ] as const) {
      if (
        !Array.isArray(runtime[field]) ||
        runtime[field].length === 0 ||
        !isDenseArray(runtime[field]) ||
        !sculptJsonEqual(runtime[field], expectedRuntime[field])
      ) {
        return refuse(
          code,
          `$.runtimeHierarchy.${field}`,
          `Runtime ${field} must exactly project the validated spec.`,
        );
      }
    }
  }

  const evidence = value["evidence"];
  if (!isJsonObject(evidence)) return refuse("invalid-field", "$.evidence", "evidence must be an object.");
  const evidenceFields = exactFields(evidence, ["method", "intakeDigest", "specDigest", "proceduralModuleDigest", "qualityGates"], [], "$.evidence");
  if (evidenceFields !== null) return { ok: false, diagnostics: [evidenceFields] };
  if (!["image-brief-reconstruction", "structured-fixture"].includes(String(evidence["method"]))) return refuse("invalid-field", "$.evidence.method", "Evidence method is invalid.");
  for (const field of ["intakeDigest", "specDigest", "proceduralModuleDigest"] as const) {
    if (!isDigest(evidence[field])) return refuse("invalid-field", `$.evidence.${field}`, `${field} must be sha256:<64 lowercase hex>.`);
  }
  const gates = evidence["qualityGates"];
  if (
    !Array.isArray(gates) ||
    gates.length === 0 ||
    !isDenseArray(gates)
  ) {
    return refuse("invalid-field", "$.evidence.qualityGates", "At least one dense passed quality gate is required.");
  }
  const gateIds: string[] = [];
  for (const [index, gate] of gates.entries()) {
    const path = `$.evidence.qualityGates[${index}]`;
    if (!isJsonObject(gate)) return refuse("invalid-field", path, "Quality gate evidence must be an object.");
    const gateFields = exactFields(gate, ["id", "status", "digest"], [], path);
    if (gateFields !== null) return { ok: false, diagnostics: [gateFields] };
    if (!isSculptIdentifier(gate["id"]) || gate["status"] !== "passed" || !isDigest(gate["digest"])) return refuse("invalid-field", path, "Quality gate evidence is invalid or not passed.");
    gateIds.push(gate["id"]);
  }
  if (duplicate(gateIds) !== undefined) return refuse("duplicate-id", "$.evidence.qualityGates", "Quality gate ids must be unique.");
  if (evidence["proceduralModuleDigest"] !== moduleRef["sourceDigest"]) return refuse("invalid-reference", "$.evidence.proceduralModuleDigest", "Evidence must bind the referenced procedural module digest.");
  if (quality) {
    if (
      evidence["specDigest"] !== digestObjectSculptSpec(spec.value)
    ) {
      return refuse(
        "invalid-reference",
        "$.evidence.specDigest",
        "Evidence must bind the canonical sculpt spec digest.",
      );
    }
    const expectedEmit = computeSculptProceduralEmit(spec.value, {
      seed: Number(moduleRef["seed"]),
    });
    const proceduralGate = gates.find(
      (gate) => isJsonObject(gate) && gate["id"] === "procedural-emit",
    );
    if (
      moduleRef["emitDigest"] !== expectedEmit.digest ||
      !isJsonObject(proceduralGate) ||
      proceduralGate["digest"] !== expectedEmit.digest
    ) {
      return refuse(
        "invalid-reference",
        "$.evidence.qualityGates",
        "Evidence must independently bind the deterministic procedural emit.",
      );
    }
  }
  return { ok: true, value: value as SculptArtifact };
}

export function validateSculptQualityArtifact(
  value: unknown,
): SculptValidationResult<SculptQualityArtifact> {
  const artifact = validateSculptArtifact(value);
  if (!artifact.ok) return artifact;
  if (!isSculptQualityObjectSculptSpec(artifact.value.spec)) {
    return refuse(
      "invalid-field",
      "$.spec",
      "Sculpt-quality artifacts require a sculpt-quality ObjectSculptSpec.",
    );
  }
  return { ok: true, value: artifact.value as SculptQualityArtifact };
}
