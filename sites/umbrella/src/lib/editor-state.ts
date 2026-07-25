/**
 * Editor state carried in the URL.
 *
 * A serverless deployment gives no reliable in-process session across requests, so the
 * editor is **stateless**: each render rebuilds a real Minimum E2 session in an
 * ephemeral workspace from the state in the query string, applies it, and reads the
 * snapshot back. Reconstruction is deterministic for a fixed seed, so the same URL
 * always produces the same scene — the surface is real engine behaviour, not a mock,
 * and it needs no storage decision to work.
 *
 * Editor state parameters are deliberately separate from the catalog deep-link
 * contract. A parameter that is neither is refused, so a link cannot smuggle a session
 * or telemetry value in past the topology rule.
 *
 * Pure TypeScript: no React, no Next, gate-typechecked and gate-tested.
 */
import {
  EDITOR_DEEP_LINK_PARAMS,
  type EditorDeepLink,
  type SculptTransform,
  type SiteResult,
  ok,
  parseEditorDeepLinkParams,
  refuse,
} from "@sceneaxi/site-kit";

/** Parameters the editor owns, on top of the deep-link contract. */
export const EDITOR_STATE_PARAMS = Object.freeze(["sel", "tx", "objects", "play"] as const);

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
 * Refuses non-finite and out-of-range values, so a hand-edited URL cannot push the
 * composition pipeline into a refusal the page would have to render as an error.
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
 * Unknown parameters refuse through the deep-link contract, which is the same rule the
 * catalogs are held to.
 */
export function readEditorState(params: SearchParams): SiteResult<EditorState> {
  const deepLinkParams: Record<string, string | readonly string[] | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    if ((EDITOR_STATE_PARAMS as readonly string[]).includes(key)) continue;
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
    instances.push({ instanceId: instanceIdAt(index), transform: defaultTransform(index) });
  }

  const selectedRaw = single(params["sel"]);
  const selectedInstanceId =
    selectedRaw !== null && instances.some((instance) => instance.instanceId === selectedRaw)
      ? selectedRaw
      : (instances[0]?.instanceId ?? instanceIdAt(0));

  // `tx` re-places the selected object only. One editable transform at a time is the
  // Minimum E2 inspector, and widening it would be general-E2 creep.
  const txRaw = single(params["tx"]);
  const translation = txRaw === null ? null : parseVector(txRaw);
  if (txRaw !== null && translation === null) return refuse("SITE_REQUEST_MALFORMED");

  const resolved =
    translation === null
      ? instances
      : instances.map((instance) =>
          instance.instanceId === selectedInstanceId
            ? { instanceId: instance.instanceId, transform: { ...identity(), translation } }
            : instance,
        );

  return ok(
    Object.freeze({
      instances: Object.freeze(resolved),
      selectedInstanceId,
      playing: single(params["play"]) === "1",
      deepLink,
    }),
  );
}

/** Rebuild the query string for a state change, preserving the deep link. */
export function editorHref(
  state: EditorState,
  change: {
    readonly sel?: string;
    readonly tx?: readonly [number, number, number];
    readonly objects?: number;
    readonly play?: boolean;
  },
): string {
  const query = new URLSearchParams();
  if (state.deepLink !== null) {
    query.set("source", state.deepLink.source);
    query.set("item", state.deepLink.itemId);
    if (state.deepLink.artifactRef !== null) query.set("artifact", state.deepLink.artifactRef);
  }
  query.set("objects", String(change.objects ?? state.instances.length));
  query.set("sel", change.sel ?? state.selectedInstanceId);
  const selected = state.instances.find(
    (instance) => instance.instanceId === (change.sel ?? state.selectedInstanceId),
  );
  const tx = change.tx ?? selected?.transform.translation ?? [0, 0, 0];
  query.set("tx", tx.join(","));
  if (change.play ?? state.playing) query.set("play", "1");
  return `/editor?${query.toString()}`;
}
