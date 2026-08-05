/**
 * Deployment-neutral Web Experience editor model (sceneaxi#197).
 *
 * The URL is the durable request state for the serverless umbrella surface. A
 * fixed input therefore reconstructs one deterministic view/session id. Raw HTML
 * is never interpreted in the parent document: callers render `srcDoc` only in an
 * iframe carrying the schema-owned empty sandbox token set. The optional Three
 * scene stays outside that iframe and reaches the existing umbrella presentation
 * seam as an opaque MountableScene.
 */
import { createHash } from "node:crypto";
import {
  WEB_EXPERIENCE_AUTHORING_OPERATIONS,
  WEB_EXPERIENCE_DESKTOP_ONLY_OPERATIONS,
  WEB_EXPERIENCE_SANDBOX_POLICY,
  evaluateWebExperienceAuthoringOperation,
  type WebExperienceAuthoringDecision,
} from "@sceneaxi/schemas";
import { type SiteResult, ok, refuse } from "./refusals.js";
import type { SearchParams } from "./site-search-params.js";

export const WEB_EXPERIENCE_EDITOR_PARAMS = Object.freeze([
  "profile",
  "web-title",
  "web-layout",
  "web-html",
  "web-asset",
  "web-three",
] as const);

export const WEB_EXPERIENCE_CANVAS_LAYOUTS = Object.freeze([
  "hero",
  "split",
  "stack",
] as const);

export type WebExperienceCanvasLayout =
  (typeof WEB_EXPERIENCE_CANVAS_LAYOUTS)[number];

export const WEB_EXPERIENCE_DEFAULT_HTML =
  "<main><p>Shape one focused interactive page, then add a safe scene or asset.</p></main>";

export type WebExperienceEditorState = Readonly<{
  title: string;
  html: string;
  layout: WebExperienceCanvasLayout;
  injectStarterAsset: boolean;
  embedThree: boolean;
}>;

export type WebExperienceEditorView = Readonly<{
  sessionId: string;
  operations: typeof WEB_EXPERIENCE_AUTHORING_OPERATIONS;
  page: Readonly<{ title: string; html: string }>;
  canvas: Readonly<{
    layout: WebExperienceCanvasLayout;
    iframeSandbox: "";
    contentSecurityPolicy: string;
    srcDoc: string;
  }>;
  assets: ReadonlyArray<
    Readonly<{ id: string; kind: "sceneaxi-sculpt-artifact" }>
  >;
  threeEmbed: Readonly<{
    enabled: boolean;
    host: "umbrella-presentation-seam";
    advancesSession: false;
  }>;
  desktopRefusals: ReadonlyArray<
    Extract<WebExperienceAuthoringDecision, { readonly ok: false }>
  >;
}>;

const one = (
  value: string | readonly string[] | undefined,
): string | null | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  return value.length === 1 ? (value[0] ?? null) : null;
};

const requestedBoolean = (
  value: string | readonly string[] | undefined,
): boolean | null => {
  const parsed = one(value);
  if (parsed === undefined) return false;
  if (parsed === "1") return true;
  if (parsed === "0") return false;
  return null;
};

/** Parse and bound the authoring state a request is allowed to carry. */
export function readWebExperienceEditorState(
  params: SearchParams,
): SiteResult<WebExperienceEditorState> {
  const profile = one(params["profile"]);
  if (profile === null || (profile !== undefined && profile !== "game" && profile !== "web")) {
    return refuse("SITE_REQUEST_MALFORMED");
  }

  const title = one(params["web-title"]);
  if (
    title === null ||
    (title !== undefined &&
      (title.trim().length === 0 || title.length > 80 || title.includes("\u0000")))
  ) {
    return refuse("SITE_REQUEST_MALFORMED");
  }

  const html = one(params["web-html"]);
  if (html === null || (html !== undefined && (html.length > 5_000 || html.includes("\u0000")))) {
    return refuse("SITE_REQUEST_MALFORMED");
  }

  const layout = one(params["web-layout"]);
  if (
    layout === null ||
    (layout !== undefined &&
      !(WEB_EXPERIENCE_CANVAS_LAYOUTS as readonly string[]).includes(layout))
  ) {
    return refuse("SITE_REQUEST_MALFORMED");
  }

  const injectStarterAsset = requestedBoolean(params["web-asset"]);
  const embedThree = requestedBoolean(params["web-three"]);
  if (injectStarterAsset === null || embedThree === null) {
    return refuse("SITE_REQUEST_MALFORMED");
  }

  return ok(
    Object.freeze({
      title: title ?? "Untitled Web Experience",
      html: html ?? WEB_EXPERIENCE_DEFAULT_HTML,
      layout: (layout ?? "split") as WebExperienceCanvasLayout,
      injectStarterAsset,
      embedThree,
    }),
  );
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function pageSrcDoc(
  state: WebExperienceEditorState,
  starterArtifactId: string,
): string {
  const injectedAsset = state.injectStarterAsset
    ? `<aside data-sceneaxi-asset="${escapeHtml(starterArtifactId)}">Injected SceneAxi asset: ${escapeHtml(starterArtifactId)}</aside>`
    : "";
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${WEB_EXPERIENCE_SANDBOX_POLICY.contentSecurityPolicy}">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<title>${escapeHtml(state.title)}</title>`,
    "<style>html{font-family:system-ui,sans-serif;color:#e8e8e8;background:#141416}body{margin:0;padding:2rem}aside{margin-top:1.5rem;padding:1rem;border:1px solid #5c6b73}</style>",
    "</head>",
    `<body data-layout="${state.layout}">${state.html}${injectedAsset}</body>`,
    "</html>",
  ].join("");
}

/** Build the immutable view the authenticated umbrella route renders. */
export function buildWebExperienceEditorView(input: {
  readonly state: WebExperienceEditorState;
  readonly starterArtifactId: string;
}): WebExperienceEditorView {
  const source = JSON.stringify({
    schemaVersion: 1,
    state: input.state,
    starterArtifactId: input.state.injectStarterAsset
      ? input.starterArtifactId
      : null,
  });
  const sessionId = `web-experience:sha256:${createHash("sha256").update(source, "utf8").digest("hex")}`;
  const assets = input.state.injectStarterAsset
    ? Object.freeze([
        Object.freeze({
          id: input.starterArtifactId,
          kind: "sceneaxi-sculpt-artifact" as const,
        }),
      ])
    : Object.freeze([]);
  const desktopRefusals = Object.freeze(
    WEB_EXPERIENCE_DESKTOP_ONLY_OPERATIONS.map((operation) => {
      const decision = evaluateWebExperienceAuthoringOperation(operation);
      if (decision.ok) {
        throw new Error(`Desktop-only operation '${operation}' was unexpectedly allowed.`);
      }
      return decision;
    }),
  );

  return Object.freeze({
    sessionId,
    operations: WEB_EXPERIENCE_AUTHORING_OPERATIONS,
    page: Object.freeze({ title: input.state.title, html: input.state.html }),
    canvas: Object.freeze({
      layout: input.state.layout,
      iframeSandbox: WEB_EXPERIENCE_SANDBOX_POLICY.iframeSandbox,
      contentSecurityPolicy: WEB_EXPERIENCE_SANDBOX_POLICY.contentSecurityPolicy,
      srcDoc: pageSrcDoc(input.state, input.starterArtifactId),
    }),
    assets,
    threeEmbed: Object.freeze({
      enabled: input.state.embedThree,
      host: "umbrella-presentation-seam" as const,
      advancesSession: false as const,
    }),
    desktopRefusals,
  });
}
