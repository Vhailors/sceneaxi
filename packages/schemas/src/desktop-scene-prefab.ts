/**
 * Bounded prefab-like reusable content: a versioned catalog of definitions,
 * deterministic instances, and explicit per-instance overrides.
 *
 * The catalog never imports an external file or plugin. Definitions snapshot
 * already-validated hierarchy nodes. Instancing mints stable child ids from
 * the definition id plus an explicit instance key.
 */
import { digestSculptJson } from "./sculpt-json.js";
import { isSculptIdentifier, type SculptTransform } from "./sculpt.js";
import {
  DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS,
  desktopSceneTransformProperty,
  type DesktopSceneTransformPropertyId,
} from "./desktop-scene-edit.js";

export const SCENE_PREFAB_SCHEMA_VERSION = 1 as const;
export const SCENE_PREFAB_CATALOG_KIND = "sceneaxi.scene-prefab-catalog" as const;
export const SCENE_PREFAB_CATALOG_KEY = "scenePrefabs" as const;

export const SCENE_PREFAB_REFUSALS = Object.freeze({
  catalogInvalid: "SCENE_PREFAB_CATALOG_INVALID",
  definitionUnknown: "SCENE_PREFAB_DEFINITION_UNKNOWN",
  sourceMissing: "SCENE_PREFAB_SOURCE_MISSING",
  sourceConflict: "SCENE_PREFAB_SOURCE_CONFLICT",
  overrideUnsupported: "SCENE_PREFAB_OVERRIDE_UNSUPPORTED",
  identityCollision: "SCENE_PREFAB_IDENTITY_COLLISION",
  instanceUnknown: "SCENE_PREFAB_INSTANCE_UNKNOWN",
  inputUnsupported: "SCENE_PREFAB_INPUT_UNSUPPORTED",
  kidsDenied: "SCENE_PREFAB_KIDS_DENIED",
  capabilityMissing: "SCENE_PREFAB_CAPABILITY_MISSING",
} as const);

export type ScenePrefabRefusal =
  (typeof SCENE_PREFAB_REFUSALS)[keyof typeof SCENE_PREFAB_REFUSALS];

export type ScenePrefabNode = Readonly<{
  sourceInstanceId: string;
  artifactId: string;
  parentSourceInstanceId: string | null;
  localTransform: SculptTransform;
}>;

export type ScenePrefabDefinition = Readonly<{
  schemaVersion: typeof SCENE_PREFAB_SCHEMA_VERSION;
  definitionId: string;
  sourceDigest: string;
  nodes: readonly ScenePrefabNode[];
}>;

export type ScenePrefabOverride = Readonly<{
  sourceInstanceId: string;
  propertyId: DesktopSceneTransformPropertyId;
  value: number;
}>;

export type ScenePrefabInstanceLink = Readonly<{
  instanceId: string;
  definitionId: string;
  definitionDigest: string;
  instanceKey: string;
  overrides: readonly ScenePrefabOverride[];
}>;

export type ScenePrefabCatalog = Readonly<{
  schemaVersion: typeof SCENE_PREFAB_SCHEMA_VERSION;
  kind: typeof SCENE_PREFAB_CATALOG_KIND;
  definitions: readonly ScenePrefabDefinition[];
  instances: readonly ScenePrefabInstanceLink[];
}>;

export type ScenePrefabSourceNode = Readonly<{
  instanceId: string;
  artifactId: string;
  parentInstanceId: string | null;
  localTransform: SculptTransform;
}>;

export type ScenePrefabPlacement = Readonly<{
  instanceId: string;
  artifactId: string;
  parentInstanceId: string | null;
  localTransform: SculptTransform;
  sourceInstanceId: string;
}>;

export type ScenePrefabInspection = Readonly<{
  schemaVersion: typeof SCENE_PREFAB_SCHEMA_VERSION;
  kind: "sceneaxi.scene-prefab-inspection";
  catalog: ScenePrefabCatalog;
  resolved: readonly Readonly<{
    instanceId: string;
    definitionId: string;
    sourceDigest: string;
    stale: boolean;
    placements: readonly ScenePrefabPlacement[];
    overrides: readonly ScenePrefabOverride[];
  }>[];
}>;

type ScenePrefabFailure = Readonly<{
  ok: false;
  reason: ScenePrefabRefusal;
  message: string;
}>;

const failure = (reason: ScenePrefabRefusal, message: string): ScenePrefabFailure =>
  Object.freeze({ ok: false as const, reason, message });

const freezeTransform = (transform: SculptTransform): SculptTransform => Object.freeze({
  translation: Object.freeze([...transform.translation]) as SculptTransform["translation"],
  rotationEulerDegrees: Object.freeze([
    ...transform.rotationEulerDegrees,
  ]) as SculptTransform["rotationEulerDegrees"],
  scale: Object.freeze([...transform.scale]) as SculptTransform["scale"],
});

export function emptyScenePrefabCatalog(): ScenePrefabCatalog {
  return Object.freeze({
    schemaVersion: 1,
    kind: SCENE_PREFAB_CATALOG_KIND,
    definitions: Object.freeze([]),
    instances: Object.freeze([]),
  });
}

export function scenePrefabChildInstanceId(
  rootInstanceId: string,
  sourceInstanceId: string,
): string {
  return `${rootInstanceId}--${sourceInstanceId}`;
}

export function scenePrefabRootInstanceId(
  definitionId: string,
  instanceKey: string,
): string {
  return `pf-${definitionId}-${instanceKey}`;
}

export function scenePrefabDefinitionDigest(definition: ScenePrefabDefinition): string {
  return digestSculptJson({
    definitionId: definition.definitionId,
    nodes: definition.nodes.map((node) => ({
      sourceInstanceId: node.sourceInstanceId,
      artifactId: node.artifactId,
      parentSourceInstanceId: node.parentSourceInstanceId,
      localTransform: node.localTransform,
    })),
  });
}

function connectedSubtree(
  sources: readonly ScenePrefabSourceNode[],
  selectedIds: readonly string[],
): ScenePrefabSourceNode[] | null {
  const byId = new Map(sources.map((node) => [node.instanceId, node]));
  const selected = new Set(selectedIds);
  if (selectedIds.some((id) => !byId.has(id))) return null;
  const roots = selectedIds.filter((id) => {
    const parent = byId.get(id)?.parentInstanceId;
    return parent === null || parent === undefined || !selected.has(parent);
  });
  if (roots.length !== 1) return null;
  const rootId = roots[0];
  if (rootId === undefined) return null;
  const ordered: ScenePrefabSourceNode[] = [];
  const visit = (id: string) => {
    const node = byId.get(id);
    if (node === undefined) return;
    ordered.push(node);
    for (const child of sources) {
      if (child.parentInstanceId === id && selected.has(child.instanceId)) {
        visit(child.instanceId);
      }
    }
  };
  visit(rootId);
  if (ordered.length !== selected.size) return null;
  return ordered;
}

function snapshotNodes(
  subtree: readonly ScenePrefabSourceNode[],
): readonly ScenePrefabNode[] {
  const rootId = subtree[0]?.instanceId;
  return Object.freeze(subtree.map((node) => Object.freeze({
    sourceInstanceId: node.instanceId,
    artifactId: node.artifactId,
    parentSourceInstanceId: node.instanceId === rootId
      ? null
      : node.parentInstanceId,
    localTransform: freezeTransform(node.localTransform),
  })));
}

export function parseScenePrefabCatalog(value: unknown): ScenePrefabCatalog | null {
  if (value === undefined || value === null) return emptyScenePrefabCatalog();
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record["schemaVersion"] !== 1 ||
    record["kind"] !== SCENE_PREFAB_CATALOG_KIND ||
    !Array.isArray(record["definitions"]) ||
    !Array.isArray(record["instances"])
  ) {
    return null;
  }
  return value as ScenePrefabCatalog;
}

export function defineScenePrefab(input: Readonly<{
  catalog: ScenePrefabCatalog;
  sources: readonly ScenePrefabSourceNode[];
  selectedIds: readonly string[];
  definitionId: string;
}>):
  | Readonly<{ ok: true; catalog: ScenePrefabCatalog; definition: ScenePrefabDefinition }>
  | ScenePrefabFailure {
  if (!isSculptIdentifier(input.definitionId)) {
    return failure(
      SCENE_PREFAB_REFUSALS.inputUnsupported,
      "A prefab definition id must be a lowercase slug.",
    );
  }
  if (input.selectedIds.length === 0 || !input.selectedIds.every((id) => isSculptIdentifier(id))) {
    return failure(
      SCENE_PREFAB_REFUSALS.inputUnsupported,
      "A prefab definition must snapshot one connected selection of canonical instance ids.",
    );
  }
  const subtree = connectedSubtree(input.sources, input.selectedIds);
  if (subtree === null) {
    return failure(
      SCENE_PREFAB_REFUSALS.sourceMissing,
      "The selected nodes are missing or are not one connected hierarchy subtree.",
    );
  }
  const nodes = snapshotNodes(subtree);
  const definition: ScenePrefabDefinition = Object.freeze({
    schemaVersion: 1,
    definitionId: input.definitionId,
    sourceDigest: "",
    nodes,
  });
  const withDigest: ScenePrefabDefinition = Object.freeze({
    ...definition,
    sourceDigest: scenePrefabDefinitionDigest(definition),
  });
  const remaining = input.catalog.definitions.filter(
    (candidate) => candidate.definitionId !== input.definitionId,
  );
  return Object.freeze({
    ok: true as const,
    definition: withDigest,
    catalog: Object.freeze({
      ...input.catalog,
      definitions: Object.freeze([...remaining, withDigest]),
    }),
  });
}

function resolvePlacements(
  definition: ScenePrefabDefinition,
  rootInstanceId: string,
  parentInstanceId: string,
  overrides: readonly ScenePrefabOverride[],
): readonly ScenePrefabPlacement[] | ScenePrefabFailure {
  const applied = new Map<string, Map<DesktopSceneTransformPropertyId, number>>();
  for (const override of overrides) {
    if (desktopSceneTransformProperty(override.propertyId) === null) {
      return failure(
        SCENE_PREFAB_REFUSALS.overrideUnsupported,
        `Override property "${override.propertyId}" is not a supported transform component.`,
      );
    }
    if (!definition.nodes.some((node) => node.sourceInstanceId === override.sourceInstanceId)) {
      return failure(
        SCENE_PREFAB_REFUSALS.sourceConflict,
        `Override source "${override.sourceInstanceId}" is absent from definition "${definition.definitionId}".`,
      );
    }
    const byProperty = applied.get(override.sourceInstanceId) ?? new Map();
    byProperty.set(override.propertyId, override.value);
    applied.set(override.sourceInstanceId, byProperty);
  }
  return Object.freeze(definition.nodes.map((node) => {
    const instanceId = node.parentSourceInstanceId === null
      ? rootInstanceId
      : scenePrefabChildInstanceId(rootInstanceId, node.sourceInstanceId);
    const parent = node.parentSourceInstanceId === null
      ? parentInstanceId
      : node.parentSourceInstanceId === definition.nodes[0]?.sourceInstanceId
        ? rootInstanceId
        : scenePrefabChildInstanceId(rootInstanceId, node.parentSourceInstanceId);
    const transform = { ...freezeTransform(node.localTransform) };
    const values = applied.get(node.sourceInstanceId);
    if (values !== undefined) {
      for (const definitionProperty of DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS) {
        const value = values.get(definitionProperty.id);
        if (value === undefined) continue;
        const next = [...transform[definitionProperty.field]] as [number, number, number];
        next[definitionProperty.axis] = value;
        transform[definitionProperty.field] = Object.freeze(next) as SculptTransform["translation"];
      }
    }
    return Object.freeze({
      instanceId,
      artifactId: node.artifactId,
      parentInstanceId: parent,
      localTransform: freezeTransform(transform),
      sourceInstanceId: node.sourceInstanceId,
    });
  }));
}

export function instanceScenePrefab(input: Readonly<{
  catalog: ScenePrefabCatalog;
  occupiedInstanceIds: readonly string[];
  definitionId: string;
  parentInstanceId: string;
  instanceKey: string;
}>):
  | Readonly<{
      ok: true;
      catalog: ScenePrefabCatalog;
      rootInstanceId: string;
      placements: readonly ScenePrefabPlacement[];
    }>
  | ScenePrefabFailure {
  if (!isSculptIdentifier(input.instanceKey) || !isSculptIdentifier(input.parentInstanceId)) {
    return failure(
      SCENE_PREFAB_REFUSALS.inputUnsupported,
      "Prefab instancing requires a lowercase instance key and parent id.",
    );
  }
  const definition = input.catalog.definitions.find(
    (candidate) => candidate.definitionId === input.definitionId,
  );
  if (definition === undefined) {
    return failure(
      SCENE_PREFAB_REFUSALS.definitionUnknown,
      `Prefab definition "${input.definitionId}" is not in the project catalog.`,
    );
  }
  const rootInstanceId = scenePrefabRootInstanceId(input.definitionId, input.instanceKey);
  const placements = resolvePlacements(definition, rootInstanceId, input.parentInstanceId, []);
  if (!("length" in placements)) return placements;
  const occupied = new Set(input.occupiedInstanceIds);
  if (placements.some((placement) => occupied.has(placement.instanceId))) {
    return failure(
      SCENE_PREFAB_REFUSALS.identityCollision,
      `Prefab instance key "${input.instanceKey}" collides with an existing instance identity.`,
    );
  }
  if (input.catalog.instances.some((link) => link.instanceId === rootInstanceId)) {
    return failure(
      SCENE_PREFAB_REFUSALS.identityCollision,
      `Prefab instance "${rootInstanceId}" is already recorded.`,
    );
  }
  const link: ScenePrefabInstanceLink = Object.freeze({
    instanceId: rootInstanceId,
    definitionId: definition.definitionId,
    definitionDigest: definition.sourceDigest,
    instanceKey: input.instanceKey,
    overrides: Object.freeze([]),
  });
  return Object.freeze({
    ok: true as const,
    rootInstanceId,
    placements,
    catalog: Object.freeze({
      ...input.catalog,
      instances: Object.freeze([...input.catalog.instances, link]),
    }),
  });
}

export function overrideScenePrefab(input: Readonly<{
  catalog: ScenePrefabCatalog;
  instanceId: string;
  sourceInstanceId: string;
  propertyId: string;
  value: number;
}>):
  | Readonly<{ ok: true; catalog: ScenePrefabCatalog }>
  | ScenePrefabFailure {
  const property = desktopSceneTransformProperty(input.propertyId);
  if (property === null || !Number.isFinite(input.value)) {
    return failure(
      SCENE_PREFAB_REFUSALS.overrideUnsupported,
      "Prefab overrides accept only a finite transform-component value.",
    );
  }
  const link = input.catalog.instances.find((candidate) => candidate.instanceId === input.instanceId);
  if (link === undefined) {
    return failure(
      SCENE_PREFAB_REFUSALS.instanceUnknown,
      `Prefab instance "${input.instanceId}" is not recorded.`,
    );
  }
  const definition = input.catalog.definitions.find(
    (candidate) => candidate.definitionId === link.definitionId,
  );
  if (definition === undefined) {
    return failure(
      SCENE_PREFAB_REFUSALS.definitionUnknown,
      `Prefab definition "${link.definitionId}" is not in the project catalog.`,
    );
  }
  if (!definition.nodes.some((node) => node.sourceInstanceId === input.sourceInstanceId)) {
    return failure(
      SCENE_PREFAB_REFUSALS.overrideUnsupported,
      `Structural or unknown member "${input.sourceInstanceId}" cannot be overridden.`,
    );
  }
  const overrides = Object.freeze([
    ...link.overrides.filter((override) =>
      override.sourceInstanceId !== input.sourceInstanceId || override.propertyId !== property.id
    ),
    Object.freeze({
      sourceInstanceId: input.sourceInstanceId,
      propertyId: property.id,
      value: input.value,
    }),
  ]);
  const nextLink: ScenePrefabInstanceLink = Object.freeze({ ...link, overrides });
  return Object.freeze({
    ok: true as const,
    catalog: Object.freeze({
      ...input.catalog,
      instances: Object.freeze(input.catalog.instances.map((candidate) =>
        candidate.instanceId === link.instanceId ? nextLink : candidate
      )),
    }),
  });
}

export function refreshScenePrefab(input: Readonly<{
  catalog: ScenePrefabCatalog;
  sources: readonly ScenePrefabSourceNode[];
  definitionId: string;
}>):
  | Readonly<{
      ok: true;
      catalog: ScenePrefabCatalog;
      conflicts: readonly string[];
    }>
  | ScenePrefabFailure {
  const current = input.catalog.definitions.find(
    (candidate) => candidate.definitionId === input.definitionId,
  );
  if (current === undefined) {
    return failure(
      SCENE_PREFAB_REFUSALS.definitionUnknown,
      `Prefab definition "${input.definitionId}" is not in the project catalog.`,
    );
  }
  const selectedIds = current.nodes.map((node) => node.sourceInstanceId);
  const defined = defineScenePrefab({
    catalog: input.catalog,
    sources: input.sources,
    selectedIds,
    definitionId: input.definitionId,
  });
  if (!defined.ok) return defined;
  const nextDefinition = defined.definition;
  const conflicts: string[] = [];
  const instances = input.catalog.instances.map((link) => {
    if (link.definitionId !== input.definitionId) return link;
    const missing = link.overrides.filter((override) =>
      !nextDefinition.nodes.some((node) => node.sourceInstanceId === override.sourceInstanceId)
    );
    if (missing.length > 0) {
      conflicts.push(link.instanceId);
      return link;
    }
    return Object.freeze({ ...link, definitionDigest: nextDefinition.sourceDigest });
  });
  if (conflicts.length > 0) {
    return failure(
      SCENE_PREFAB_REFUSALS.sourceConflict,
      `Definition "${input.definitionId}" changed members that still have overrides on ${conflicts.join(", ")}.`,
    );
  }
  return Object.freeze({
    ok: true as const,
    conflicts: Object.freeze(conflicts),
    catalog: Object.freeze({
      ...defined.catalog,
      instances: Object.freeze(instances),
    }),
  });
}

export function inspectScenePrefab(
  catalog: ScenePrefabCatalog,
  parentByRoot: Readonly<Record<string, string>> = {},
): ScenePrefabInspection {
  return Object.freeze({
    schemaVersion: 1,
    kind: "sceneaxi.scene-prefab-inspection",
    catalog,
    resolved: Object.freeze(catalog.instances.map((link) => {
      const definition = catalog.definitions.find(
        (candidate) => candidate.definitionId === link.definitionId,
      );
      const parentInstanceId = parentByRoot[link.instanceId] ?? link.instanceId;
      const placements = definition === undefined
        ? Object.freeze([])
        : resolvePlacements(
            definition,
            link.instanceId,
            parentInstanceId,
            link.overrides,
          );
      return Object.freeze({
        instanceId: link.instanceId,
        definitionId: link.definitionId,
        sourceDigest: definition?.sourceDigest ?? "",
        stale: definition === undefined || definition.sourceDigest !== link.definitionDigest,
        placements: "length" in placements ? placements : Object.freeze([]),
        overrides: link.overrides,
      });
    })),
  });
}
