/**
 * Editor state carried in the URL.
 *
 * A serverless deployment gives no reliable in-process session across requests, so the
 * editor is **stateless**: each render rebuilds a real Minimum E2 session in an
 * ephemeral workspace from the state in the query string, applies it, and reads the
 * snapshot back. Reconstruction is deterministic for a fixed seed, so the same URL
 * always produces the same scene.
 *
 * Selection and transform are deliberately decoupled. Every edited instance carries its
 * own translation under a `tx-<instanceId>` parameter, so switching selection can never
 * clobber another object's transform: each instance's translation is bound to its own
 * id, not to whichever instance happens to be selected.
 *
 * Editor state parameters are separate from the catalog deep-link contract. A parameter
 * that is neither is refused, so a link cannot smuggle a session or telemetry value in
 * past the topology rule.
 *
 * Pure TypeScript: no React, no Next, gate-typechecked and gate-tested.
 */
import type { SculptTransform } from "@sceneaxi/schemas";
import {
  EDITOR_DEEP_LINK_PARAMS,
  parseEditorDeepLinkParams,
  type EditorDeepLink,
} from "./deep-link.js";
import { type SiteResult, ok, refuse } from "./refusals.js";

/** Non-transform parameters the editor owns, on top of the deep-link contract. */
export const EDITOR_STATE_PARAMS = Object.freeze(["sel", "objects", "play"] as const);

/**
 * Per-instance transforms ride under `tx-<instanceId>` parameters. The instance id is the
 * editor's own `object-N` identifier, so a transform is always bound to a concrete
 * instance rather than to the current selection.
 */
const TRANSFORM_PARAM_PREFIX = "tx-";
const isTransformParam = (key: string): boolean => /^tx-object-[1-9]\d*$/.test(key);

/** How many objects the bounded editor will mount. Two is the composition minimum. */
export const EDITOR_MIN_OBJECTS = 2;
export const EDITOR_MAX_OBJECTS = 4;

export type EditorInstanceState = {
  readonly instanceId: string;
  readonly transform: SculptTransform;
};

export type EditorState = {
  readonly instances: readonly EditorInstanceState[];
  readonly selectedInstanceId: string;
  readonly playing: boolean;
  /** The deep link that opened the editor, when the request carried one. */
  readonly deepLink: EditorDeepLink | null;
};

export type SearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

const single = (value: string | readonly string[] | undefined): string | null =>
  typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? null) : null;

const instanceIdAt = (index: number): string => `object-${index + 1}`;

const identity = (): SculptTransform => ({
  translation: [0, 0, 0],
  rotationEulerDegrees: [0, 0, 0],
  scale: [1, 1, 1],
});

/** Default placement: a row along x, so a composed scene is visibly multi-object. */
const defaultTransform = (index: number): SculptTransform =>
  index === 0 ? identity() : { ...identity(), translation: [index * 2, 0, 0] };

/**
 * Parse three comma-separated numbers.
 *
 * Refuses non-finite and out-of-range values, and rejects partial components such as
 * `1junk`, so a hand-edited URL cannot push the composition pipeline into a refusal the
 * page would have to render as an error.
 */
function parseVector(raw: string): readonly [number, number, number] | null {
  const parts = raw.split(",");
  if (parts.length !== 3) return null;
  const numbers = parts.map((part) => {
    const component = part.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(component)) {
      return Number.NaN;
    }
    return Number(component);
  });
  if (!numbers.every((value) => Number.isFinite(value) && Math.abs(value) <= 1000)) return null;
  return [numbers[0] as number, numbers[1] as number, numbers[2] as number];
}

/**
 * Read editor state from the query string.
 *
 * Each instance's translation is read from its own `tx-<instanceId>` parameter and
 * defaults when absent, so changing the selection cannot move or reset another object.
 * Unknown parameters refuse through the deep-link contract, which is the same rule the
 * catalogs are held to.
 */
export function readEditorState(params: SearchParams): SiteResult<EditorState> {
  const deepLinkParams: Record<string, string | readonly string[] | undefined> = {};
  const transformsByInstance: Record<string, readonly [number, number, number]> = {};
  for (const [key, value] of Object.entries(params)) {
    if ((EDITOR_STATE_PARAMS as readonly string[]).includes(key)) continue;
    if (isTransformParam(key)) {
      const raw = single(value);
      const vec = raw === null ? null : parseVector(raw);
      if (raw !== null && vec === null) return refuse("SITE_REQUEST_MALFORMED");
      if (vec !== null) transformsByInstance[key.slice(TRANSFORM_PARAM_PREFIX.length)] = vec;
      continue;
    }
    if (!(EDITOR_DEEP_LINK_PARAMS as readonly string[]).includes(key)) {
      return refuse("DEEP_LINK_UNKNOWN_PARAMETER");
    }
    deepLinkParams[key] = value;
  }

  let deepLink: EditorDeepLink | null = null;
  if (Object.keys(deepLinkParams).length > 0) {
    const parsed = parseEditorDeepLinkParams(deepLinkParams);
    if (!parsed.ok) return parsed;
    deepLink = parsed.value;
  }

  const requested = Number(single(params["objects"]) ?? "");
  const count = Number.isSafeInteger(requested)
    ? Math.min(Math.max(requested, EDITOR_MIN_OBJECTS), EDITOR_MAX_OBJECTS)
    : EDITOR_MIN_OBJECTS;

  const instances: EditorInstanceState[] = [];
  for (let index = 0; index < count; index += 1) {
    const instanceId = instanceIdAt(index);
    const override = transformsByInstance[instanceId];
    const transform =
      override === undefined ? defaultTransform(index) : { ...identity(), translation: override };
    instances.push({ instanceId, transform });
  }

  const selectedRaw = single(params["sel"]);
  const selectedInstanceId =
    selectedRaw !== null && instances.some((instance) => instance.instanceId === selectedRaw)
      ? selectedRaw
      : (instances[0]?.instanceId ?? instanceIdAt(0));

  return ok(
    Object.freeze({
      instances: Object.freeze(instances),
      selectedInstanceId,
      playing: single(params["play"]) === "1",
      deepLink,
    }),
  );
}

/**
 * Rebuild the query string for a state change, preserving the deep link and every
 * instance's own translation. Only the play state is varied here; selection and
 * transforms are carried verbatim from the authoritative state, so this link never
 * mutates an object's transform.
 */
export function editorHref(
  state: EditorState,
  change: { readonly play?: boolean },
): string {
  const query = new URLSearchParams();
  if (state.deepLink !== null) {
    query.set("source", state.deepLink.source);
    query.set("item", state.deepLink.itemId);
    if (state.deepLink.artifactRef !== null) query.set("artifact", state.deepLink.artifactRef);
  }
  query.set("objects", String(state.instances.length));
  query.set("sel", state.selectedInstanceId);
  for (const instance of state.instances) {
    query.set(`tx-${instance.instanceId}`, instance.transform.translation.join(","));
  }
  if (change.play ?? state.playing) query.set("play", "1");
  return `/editor?${query.toString()}`;
}
