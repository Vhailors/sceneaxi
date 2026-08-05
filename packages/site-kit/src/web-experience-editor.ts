/**
 * Deployment-neutral Web Experience editor model (sceneaxi#197).
 *
 * The URL carries bounded request inputs for the serverless umbrella surface.
 * Those inputs project one text-canonical SceneDocument whose digest identifies
 * the stable session. Raw HTML is never interpreted in the parent document:
 * callers render `srcDoc` only in an iframe carrying the schema-owned empty
 * sandbox token set. The optional Three scene stays outside that iframe and
 * reaches the existing umbrella presentation seam as an opaque MountableScene.
 */
import { createHash } from "node:crypto";
import {
  WEB_EXPERIENCE_AUTHORING_OPERATIONS,
  WEB_EXPERIENCE_AUTHORING_REFUSALS,
  WEB_EXPERIENCE_DESKTOP_ONLY_OPERATIONS,
  WEB_EXPERIENCE_SANDBOX_POLICY,
  createDocument,
  evaluateWebExperienceAuthoringOperation,
  serializeDocument,
  type SceneDocument,
  type WebExperienceAuthoringDecision,
  type WebExperienceAuthoringOperation,
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

export const WEB_EXPERIENCE_TITLE_MAX_LENGTH = 80;
export const WEB_EXPERIENCE_HTML_MAX_LENGTH = 2_000;

/** The title a request that names none — or names a blank one — authors under. */
export const WEB_EXPERIENCE_DEFAULT_TITLE = "Untitled Web Experience";

/**
 * The bound on the whole `/editor?…` request target this surface submits.
 *
 * The session lives in the URL, so the submission path has a size a platform can
 * answer before this code ever runs — a 414 or 431 from an edge is the one
 * failure on this surface that would not explain itself. The budget is therefore
 * self-imposed and deliberately far below the ceilings it must sit under (an
 * 8 KiB request line at the narrowest edge, a 16 KiB header block in Node), so
 * an oversized state refuses **by name** here, with room left over for the
 * method, the version, and the session cookie beside it.
 *
 * `readWebExperienceEditorState` enforces it on the reconstructed target rather
 * than on any one field, because it is the target — not the HTML — that a
 * platform measures. The field bounds above are what keep a browser submission
 * of this form inside it for ordinary authored markup.
 */
export const WEB_EXPERIENCE_REQUEST_TARGET_MAX_LENGTH = 4_000;

export type WebExperienceEditorState = Readonly<{
  title: string;
  html: string;
  layout: WebExperienceCanvasLayout;
  injectStarterAsset: boolean;
  embedThree: boolean;
}>;

export type WebExperienceEditorView = Readonly<{
  sessionId: string;
  document: SceneDocument;
  documentDigest: `sha256:${string}`;
  operations: typeof WEB_EXPERIENCE_AUTHORING_OPERATIONS;
  form: Readonly<{
    action: "/editor";
    method: "get";
    profile: Readonly<{ name: "profile"; value: "web" }>;
    title: WebExperienceFormControl & Readonly<{ maxLength: number }>;
    layout: WebExperienceFormControl &
      Readonly<{
        options: ReadonlyArray<Readonly<{ value: WebExperienceCanvasLayout; label: string }>>;
      }>;
    html: WebExperienceFormControl & Readonly<{ maxLength: number }>;
    asset: WebExperienceFormControl & Readonly<{ value: "1" }>;
    three: WebExperienceFormControl & Readonly<{ value: "1" }>;
    submit: Readonly<{
      kind: "web-authoring";
      operations: typeof WEB_EXPERIENCE_AUTHORING_OPERATIONS;
    }>;
  }>;
  page: Readonly<{ title: string; html: string }>;
  /** The bounded request target this state submits to, and the budget it fits. */
  submission: Readonly<{ target: string; maxLength: number }>;
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
  /**
   * The one refusal a Web-profile projection applies to desktop chrome it
   * demotes rather than to an operation it was asked for. It is projected here,
   * with the schema's own sentence, so a renderer states neither the code nor
   * the message itself and the legend it anchors cannot drift from the contract.
   */
  desktopOnlyRefusal: Readonly<{
    code: "WEB_EXPERIENCE_DESKTOP_ONLY_OPERATION";
    message: string;
  }>;
}>;

const WEB_EXPERIENCE_DESKTOP_ONLY_REFUSAL = Object.freeze({
  code: "WEB_EXPERIENCE_DESKTOP_ONLY_OPERATION" as const,
  message: WEB_EXPERIENCE_AUTHORING_REFUSALS.WEB_EXPERIENCE_DESKTOP_ONLY_OPERATION,
});

type WebExperienceFormControl = Readonly<{
  id: string;
  name: string;
  kind: "web-authoring";
  operation: WebExperienceAuthoringOperation;
}>;

const webControl = (
  id: string,
  name: string,
  operation: WebExperienceAuthoringOperation,
): WebExperienceFormControl => Object.freeze({ id, name, kind: "web-authoring", operation });

const WEB_EXPERIENCE_LAYOUT_OPTIONS = Object.freeze([
  Object.freeze({ value: "hero" as const, label: "Hero" }),
  Object.freeze({ value: "split" as const, label: "Split" }),
  Object.freeze({ value: "stack" as const, label: "Stack" }),
]);

const WEB_EXPERIENCE_FORM = Object.freeze({
  action: "/editor" as const,
  method: "get" as const,
  profile: Object.freeze({ name: "profile" as const, value: "web" as const }),
  title: Object.freeze({
    ...webControl("webxp-title", "web-title", "page.set-html"),
    maxLength: WEB_EXPERIENCE_TITLE_MAX_LENGTH,
  }),
  layout: Object.freeze({
    ...webControl("webxp-layout", "web-layout", "site-canvas.configure"),
    options: WEB_EXPERIENCE_LAYOUT_OPTIONS,
  }),
  html: Object.freeze({
    ...webControl("webxp-html", "web-html", "page.set-html"),
    maxLength: WEB_EXPERIENCE_HTML_MAX_LENGTH,
  }),
  asset: Object.freeze({
    ...webControl("webxp-asset", "web-asset", "asset.inject"),
    value: "1" as const,
  }),
  three: Object.freeze({
    ...webControl("webxp-three", "web-three", "three.embed"),
    value: "1" as const,
  }),
  submit: Object.freeze({
    kind: "web-authoring" as const,
    operations: WEB_EXPERIENCE_AUTHORING_OPERATIONS,
  }),
});

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
      (title.length > WEB_EXPERIENCE_TITLE_MAX_LENGTH ||
        title.includes("\u0000")))
  ) {
    return refuse("SITE_REQUEST_MALFORMED");
  }

  const html = one(params["web-html"]);
  if (
    html === null ||
    (html !== undefined &&
      (html.length > WEB_EXPERIENCE_HTML_MAX_LENGTH || html.includes("\u0000")))
  ) {
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

  /**
   * A text input always submits, so an emptied title arrives as `web-title=`.
   * That is the author clearing one field, not a malformed request — refusing it
   * would discard the HTML, layout, asset, and Three selections the very same
   * request carries. A blank title takes the fallback an absent one takes.
   */
  const named = title === undefined || title.trim().length === 0 ? undefined : title;

  const state = Object.freeze({
    title: named ?? WEB_EXPERIENCE_DEFAULT_TITLE,
    html: html ?? WEB_EXPERIENCE_DEFAULT_HTML,
    layout: (layout ?? "split") as WebExperienceCanvasLayout,
    injectStarterAsset,
    embedThree,
  });

  if (
    webExperienceRequestTarget(state).length > WEB_EXPERIENCE_REQUEST_TARGET_MAX_LENGTH
  ) {
    return refuse("SITE_REQUEST_TARGET_TOO_LONG");
  }

  return ok(state);
}

/**
 * The canonical `/editor?…` target one Web Experience state submits to.
 *
 * It is the bounded quantity: every live control on this surface is a GET that
 * rebuilds this string, the login round trip carries it, and a platform measures
 * it long before this package sees the request. Building it in one place is what
 * lets the bound be checked against the thing that is actually transmitted
 * instead of against a field that only contributes to it.
 */
export function webExperienceRequestTarget(state: WebExperienceEditorState): string {
  const query = new URLSearchParams();
  query.set("profile", "web");
  if (state.title !== WEB_EXPERIENCE_DEFAULT_TITLE) query.set("web-title", state.title);
  query.set("web-layout", state.layout);
  query.set("web-html", state.html);
  if (state.injectStarterAsset) query.set("web-asset", "1");
  if (state.embedThree) query.set("web-three", "1");
  return `/editor?${query.toString()}`;
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
  const assets = input.state.injectStarterAsset
    ? Object.freeze([
        Object.freeze({
          id: input.starterArtifactId,
          kind: "sceneaxi-sculpt-artifact" as const,
        }),
      ])
    : Object.freeze([]);
  const documentData = Object.freeze({
    webExperience: Object.freeze({
      authoringContract: "sceneaxi.web-experience-authoring.v1",
      page: Object.freeze({ html: input.state.html }),
      canvas: Object.freeze({ layout: input.state.layout }),
      assets,
      threeEmbed: Object.freeze({
        enabled: input.state.embedThree,
        host: "umbrella-presentation-seam" as const,
        advancesSession: false as const,
      }),
    }),
  });
  const document = Object.freeze(
    createDocument({
      id: "umbrella-web-experience",
      title: input.state.title,
      data: documentData,
    }),
  );
  const digest = createHash("sha256")
    .update(serializeDocument(document), "utf8")
    .digest("hex");
  const documentDigest = `sha256:${digest}` as const;
  const sessionId = `web-experience:${documentDigest}`;
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
    document,
    documentDigest,
    operations: WEB_EXPERIENCE_AUTHORING_OPERATIONS,
    form: WEB_EXPERIENCE_FORM,
    page: Object.freeze({ title: input.state.title, html: input.state.html }),
    submission: Object.freeze({
      target: webExperienceRequestTarget(input.state),
      maxLength: WEB_EXPERIENCE_REQUEST_TARGET_MAX_LENGTH,
    }),
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
    desktopOnlyRefusal: WEB_EXPERIENCE_DESKTOP_ONLY_REFUSAL,
  });
}
