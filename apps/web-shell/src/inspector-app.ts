/**
 * The served web-shell inspector — an HTTP-shaped surface over the *existing*
 * `createInspectorSession` phases (sceneaxi#120).
 *
 * This module is transport-free on purpose: it maps one request onto one
 * session method and renders the resulting snapshot. `dev-server.ts` is the only
 * thing that owns a socket, so every route below is gate-tested without one.
 *
 * What it deliberately is not: a second authoring implementation. Every state
 * transition is `InspectorSession`'s, which is `@sceneaxi/authoring-core`'s;
 * every authoring entry in `INSPECTOR_ACTIONS` names the session method it
 * forwards to, while document status is explicitly read-only. No CLI spawn
 * (matrix-denied), no engine import, no hosting or deployment — that tier is
 * `sites/` (ADR 0018).
 *
 * Fail-closed everywhere a served surface differs from a local library call: a
 * request body that is not a JSON object, an oversized body, a malformed edit,
 * and — the one rule the library below has no reason to enforce — a
 * `documentPath` that resolves outside the served project root.
 */

import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  canonicalPath,
  contentHash,
  parseDocumentText,
  type ApplyDiagnostic,
  type JsonObject,
  type JsonValue,
} from "@sceneaxi/authoring-core";
import {
  createInspectorSession,
  type InspectorSession,
  type InspectorSnapshot,
} from "./inspector.js";
import { createDefaultAssistantPanel } from "./assistant-default.js";
import type {
  AssistantPanel,
  AssistantAskRequest,
  AssistantPanelReason,
  AssistantPanelSnapshot,
  AssistantRefusal,
  CreateAssistantPanelResult,
} from "./assistant-panel.js";

/** Stable app identifier echoed on every payload, matching the shell binaries. */
export const WEB_SHELL_APP = "sceneaxi-web-shell";

/**
 * Every named refusal the startable web shell **owns**, launch included.
 *
 * One registry rather than one per module: a refusal is only fail-closed if it
 * is reachable, and `test/refuse-matrix.test.ts` asserts exactly that of every
 * entry here.
 *
 * The assistant route additionally forwards the panel's own refusal reason
 * verbatim — `ASSISTANT_PANEL_REASONS`, plus billing's and auth's vocabularies
 * through it — because a transport that renamed a panel refusal would be making
 * a second decision. Those reasons stay owned and matrix-covered where they are
 * produced; `ServedRefusalReason` is the union this surface can answer with.
 */
export const WEB_SHELL_REFUSALS = Object.freeze({
  /** No route serves this path. */
  routeUnknown: "route-unknown",
  /** The route exists but not for this method. */
  methodNotAllowed: "method-not-allowed",
  /** The body did not parse as a JSON object. */
  requestBodyNotJson: "request-body-not-json",
  /** The body exceeded `MAX_REQUEST_BODY_BYTES`. */
  requestBodyTooLarge: "request-body-too-large",
  /** The request Host does not name the server's bound loopback authority. */
  requestHostInvalid: "request-host-invalid",
  /** An unsafe request names an Origin other than the server's own origin. */
  requestOriginInvalid: "request-origin-invalid",
  /** Accept or reject did not name the exact proposal rendered for review. */
  reviewTokenInvalid: "review-token-invalid",
  /** A required edit field is missing or the wrong type. */
  editFieldInvalid: "edit-field-invalid",
  /** The document path resolves outside the served project root. */
  documentOutsideProjectRoot: "document-outside-project-root",
  /** The document could not be read or is not a SceneAxi document. */
  documentUnreadable: "document-unreadable",
  /** The inspector session refused with typed authoring-core diagnostics. */
  inspectorRefused: "inspector-refused",
  /** A launch argument was unknown, empty, or unparseable. */
  argumentInvalid: "argument-invalid",
  /** `--cwd` is not an existing directory. */
  projectRootUnusable: "project-root-unusable",
  /** `--host` is not a loopback address; this surface authenticates nobody. */
  hostNotLoopback: "host-not-loopback",
  /** The port could not be bound. */
  listenFailed: "listen-failed",
  /** An unexpected throw while routing; the surface answers, never dies. */
  handlerFailed: "handler-failed",
  /** The assistant panel could not be wired, so no turn can be served. */
  assistantUnavailable: "assistant-unavailable",
} as const);

export type WebShellRefusal =
  (typeof WEB_SHELL_REFUSALS)[keyof typeof WEB_SHELL_REFUSALS];

/**
 * What a served response's `reason` may be: this surface's own registry, or the
 * assistant panel's reason forwarded unchanged.
 */
export type ServedRefusalReason = WebShellRefusal | AssistantRefusal["reason"];

/**
 * The served vocabulary. `session` names the `InspectorSession` method the
 * authoring action forwards to. The read-only document projection declares
 * `null`, so it cannot masquerade as an authoring transition.
 */
export const INSPECTOR_ACTIONS = Object.freeze({
  state: Object.freeze({
    method: "GET",
    path: "/api/state",
    session: "snapshot",
    description: "Report the current inspector snapshot",
  }),
  document: Object.freeze({
    method: "GET",
    path: "/api/document",
    session: null,
    description: "Report a document's id, content hash, and top-level data keys",
  }),
  propose: Object.freeze({
    method: "POST",
    path: "/api/propose",
    session: "proposeEdit",
    description: "Propose a JSON Pointer edit and render its diff for review",
  }),
  accept: Object.freeze({
    method: "POST",
    path: "/api/accept",
    session: "accept",
    description: "Accept the exact reviewed proposal (apply via authoring-core)",
  }),
  reject: Object.freeze({
    method: "POST",
    path: "/api/reject",
    session: "reject",
    description: "Discard the exact reviewed proposal without writing",
  }),
  recover: Object.freeze({
    method: "POST",
    path: "/api/recover",
    session: "refreshRecovery",
    description: "Re-resolve a pending durable apply transaction",
  }),
  assistant: Object.freeze({
    method: "POST",
    path: "/api/assistant",
    session: null,
    description: "Complete one assistant turn through the configured panel",
  }),
} as const);

export type InspectorAction = keyof typeof INSPECTOR_ACTIONS;

/**
 * Request bodies are small edits, never uploads. The cap is here as well as in
 * the server so it holds whatever drives the app; the server additionally stops
 * reading at this size instead of buffering an unbounded stream.
 */
export const MAX_REQUEST_BODY_BYTES = 64 * 1024;

export type InspectorHttpRequest = {
  readonly method: string;
  /** Request target as received, query string included. */
  readonly url: string;
  readonly body?: string;
};

export type InspectorHttpResponse = {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
};

export type InspectorApp = {
  /** Canonical served project root; every document path resolves inside it. */
  readonly projectRoot: string;
  /** Synchronous authoring/document routes. */
  handle(request: InspectorHttpRequest): InspectorHttpResponse;
  /** The same surface with the asynchronous assistant turn included. */
  handleAsync(request: InspectorHttpRequest): Promise<InspectorHttpResponse>;
};

export type CreateInspectorAppOptions = {
  /** Project root served to the browser (default: `process.cwd()`). */
  readonly projectRoot?: string;
  /** Inspector session to drive (default: one bound to `projectRoot`). */
  readonly session?: InspectorSession;
  /** Existing assistant panel to expose (default: the deterministic fixture panel). */
  readonly assistant?: AssistantPanel;
};

const JSON_TYPE = "application/json; charset=utf-8";

const HTML_TYPE = "text/html; charset=utf-8";

type AssistantTurnRequest = { -readonly [K in keyof AssistantAskRequest]: AssistantAskRequest[K] };

type InspectorResponsePayload = Readonly<{
  app?: string;
  ok?: boolean;
  action?: string;
  reason?: ServedRefusalReason;
  message?: string;
  projectRoot?: string;
  reviewToken?: string | null;
  snapshot?: InspectorSnapshot | AssistantPanelSnapshot;
  documentPath?: string;
  documentId?: string;
  contentHash?: string;
  dataKeys?: string[];
  routes?: string[];
  assistantReason?: AssistantPanelReason;
}>;

function isText(value: JsonValue | undefined): value is string {
  return typeof value === "string";
}

function isJsonObject(value: JsonValue): value is JsonObject {
  // The caller supplies JSON.parse output, so only the root object/array distinction remains.
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonBody(payload: InspectorResponsePayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function okResponse(
  action: string,
  payload: InspectorResponsePayload,
): InspectorHttpResponse {
  return {
    status: 200,
    contentType: JSON_TYPE,
    body: jsonBody({ app: WEB_SHELL_APP, ok: true, action, ...payload }),
  };
}

function refuse(
  status: number,
  action: string,
  reason: ServedRefusalReason,
  message: string,
  extra: InspectorResponsePayload = {},
): InspectorHttpResponse {
  return {
    status,
    contentType: JSON_TYPE,
    body: jsonBody({
      app: WEB_SHELL_APP,
      ok: false,
      action,
      reason,
      message,
      ...extra,
    }),
  };
}

/**
 * The refusals the request-shaped checks below produce, and the one place each
 * becomes an HTTP status.
 *
 * The mapping is a property of the reason, not of the call site: inlining it
 * per caller is what lets two of them answer the same refusal differently.
 */
export type RequestRefusalReason =
  | typeof WEB_SHELL_REFUSALS.requestBodyNotJson
  | typeof WEB_SHELL_REFUSALS.requestBodyTooLarge
  | typeof WEB_SHELL_REFUSALS.editFieldInvalid
  | typeof WEB_SHELL_REFUSALS.documentOutsideProjectRoot;

export type RequestRefusal = {
  readonly reason: RequestRefusalReason;
  readonly message: string;
};

const REQUEST_REFUSAL_STATUS: Readonly<Record<RequestRefusalReason, number>> =
  Object.freeze({
    [WEB_SHELL_REFUSALS.requestBodyNotJson]: 400,
    [WEB_SHELL_REFUSALS.requestBodyTooLarge]: 413,
    [WEB_SHELL_REFUSALS.editFieldInvalid]: 400,
    [WEB_SHELL_REFUSALS.documentOutsideProjectRoot]: 403,
  });

function refuseRequest(
  action: string,
  refusal: RequestRefusal,
): InspectorHttpResponse {
  return refuse(
    REQUEST_REFUSAL_STATUS[refusal.reason],
    action,
    refusal.reason,
    refusal.message,
  );
}

/**
 * Resolve a caller-supplied document path inside the served root.
 *
 * The library path below has no reason to bound this — a local caller already
 * chose its own working directory — but a served surface does: the root is the
 * only thing standing between an HTTP request and an arbitrary file write. The
 * root and the target are both canonicalized, so a symlink inside the project
 * pointing outward is refused like a literal `../`.
 */
export function resolveInsideProjectRoot(
  projectRoot: string,
  documentPath: JsonValue | undefined,
):
  | { readonly ok: true; readonly documentPath: string; readonly absolute: string }
  | ({ readonly ok: false } & RequestRefusal) {
  if (!isText(documentPath) || documentPath.length === 0) {
    return {
      ok: false,
      reason: WEB_SHELL_REFUSALS.editFieldInvalid,
      message: "documentPath must be a non-empty string.",
    };
  }

  if (isAbsolute(documentPath)) {
    return {
      ok: false,
      reason: WEB_SHELL_REFUSALS.documentOutsideProjectRoot,
      message: `documentPath must be relative to the served project root: ${documentPath}`,
    };
  }

  const absolute = canonicalPath(resolve(projectRoot, documentPath));
  const rel = relative(projectRoot, absolute);

  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return {
      ok: false,
      reason: WEB_SHELL_REFUSALS.documentOutsideProjectRoot,
      message: `documentPath resolves outside the served project root: ${documentPath}`,
    };
  }

  return { ok: true, documentPath, absolute };
}

function parseJsonObject(
  body: string | undefined,
):
  | { readonly ok: true; readonly value: JsonObject }
  | ({ readonly ok: false } & RequestRefusal) {
  const text = body ?? "";

  if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BODY_BYTES) {
    return {
      ok: false,
      reason: WEB_SHELL_REFUSALS.requestBodyTooLarge,
      message: `Request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes.`,
    };
  }

  if (text.trim() === "") return { ok: true, value: {} };
  let parsed: JsonValue;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      reason: WEB_SHELL_REFUSALS.requestBodyNotJson,
      message: `Request body is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  if (!isJsonObject(parsed)) {
    return {
      ok: false,
      reason: WEB_SHELL_REFUSALS.requestBodyNotJson,
      message: "Request body must be a JSON object.",
    };
  }

  return { ok: true, value: parsed };
}

/**
 * Render one inspector snapshot as a response.
 *
 * The rule is the snapshot's own: diagnostics mean the action was refused, so
 * the transport says so with a non-2xx rather than returning `200 ok` beside a
 * refusal a browser would have to notice on its own.
 */
function snapshotResponse(
  action: InspectorAction,
  snapshot: InspectorSnapshot,
  projectRoot: string,
  reviewToken: string | null,
): InspectorHttpResponse {
  const payload = { projectRoot, reviewToken, snapshot };

  if (snapshot.diagnostics !== null && snapshot.diagnostics.length > 0) {
    return refuse(
      409,
      action,
      WEB_SHELL_REFUSALS.inspectorRefused,
      primaryMessage(snapshot.diagnostics),
      payload,
    );
  }

  return okResponse(action, payload);
}

function primaryMessage(diagnostics: readonly ApplyDiagnostic[]): string {
  return diagnostics[0]?.message ?? "The inspector refused with typed diagnostics.";
}

function assistantSnapshotResponse(
  action: InspectorAction,
  snapshot: AssistantPanelSnapshot,
): InspectorHttpResponse {
  if (snapshot.refusal === undefined) {
    return okResponse(action, { snapshot });
  }

  return refuse(409, action, snapshot.refusal.reason, snapshot.refusal.message, {
    snapshot,
  });
}

/**
 * Create the served inspector application over one session.
 *
 * One session per app, exactly as the library surface documents: a single
 * pending proposal reviewed before it is accepted. The session is injectable so
 * tests can prove the routes forward to it rather than re-deriving anything.
 */
export function createInspectorApp(
  options: CreateInspectorAppOptions = {},
): InspectorApp {
  const projectRoot = canonicalPath(options.projectRoot ?? ".");

  const session =
    options.session ?? createInspectorSession({ cwd: projectRoot });

  const assistantSetup: CreateAssistantPanelResult =
    options.assistant === undefined
      ? createDefaultAssistantPanel()
      : Object.freeze({ ok: true, panel: options.assistant });

  let reviewGeneration = 0;
  let activeReviewToken: string | null = null;

  const documentStatus = (path: JsonValue | undefined): InspectorHttpResponse => {
    const resolved = resolveInsideProjectRoot(projectRoot, path);

    if (!resolved.ok) return refuseRequest("document", resolved);
    let text: string;

    try {
      text = readFileSync(resolved.absolute, "utf8");
    } catch {
      return refuse(
        404,
        "document",
        WEB_SHELL_REFUSALS.documentUnreadable,
        `Document not found: ${resolved.documentPath}`,
        { documentPath: resolved.documentPath },
      );
    }

    const validation = parseDocumentText(text);

    if (!validation.ok) {
      return refuse(
        422,
        "document",
        WEB_SHELL_REFUSALS.documentUnreadable,
        `${resolved.documentPath}: ${validation.message}`,
        { documentPath: resolved.documentPath },
      );
    }

    return okResponse("document", {
      projectRoot,
      documentPath: resolved.documentPath,
      documentId: validation.document.id,
      contentHash: contentHash(text),
      dataKeys: Object.keys(validation.document.data).sort(),
    });
  };

  const propose = (body: string | undefined): InspectorHttpResponse => {
    const parsed = parseJsonObject(body);

    if (!parsed.ok) return refuseRequest("propose", parsed);

    const resolved = resolveInsideProjectRoot(
      projectRoot,
      parsed.value["documentPath"],
    );

    if (!resolved.ok) return refuseRequest("propose", resolved);
    const jsonPointer = parsed.value["jsonPointer"];

    if (!isText(jsonPointer)) {
      return refuseRequest("propose", {
        reason: WEB_SHELL_REFUSALS.editFieldInvalid,
        message:
          "jsonPointer must be a string (the empty string addresses the whole document).",
      });
    }

    if (!Object.hasOwn(parsed.value, "newValue")) {
      return refuseRequest("propose", {
        reason: WEB_SHELL_REFUSALS.editFieldInvalid,
        message: "newValue is required (send null explicitly to set a null value).",
      });
    }

    // The session owns cwd resolution; passing the served root keeps a request
    // from selecting a different one.
    const snapshot = session.proposeEdit({
      documentPath: resolved.documentPath,
      jsonPointer,
      newValue: parsed.value["newValue"],
      cwd: projectRoot,
    });

    if (
      snapshot.phase === "reviewing" &&
      snapshot.proposal !== null &&
      snapshot.diagnostics === null
    ) {
      reviewGeneration += 1;
      activeReviewToken = contentHash(
        JSON.stringify({
          generation: reviewGeneration,
          proposal: snapshot.proposal,
        }),
      );
    } else {
      activeReviewToken = null;
    }

    return snapshotResponse("propose", snapshot, projectRoot, activeReviewToken);
  };

  const reviewAction = (
    action: "accept" | "reject",
    body: string | undefined,
  ): InspectorHttpResponse => {
    const parsed = parseJsonObject(body);

    if (!parsed.ok) return refuseRequest(action, parsed);
    const reviewToken = parsed.value["reviewToken"];

    if (
      !isText(reviewToken) ||
      activeReviewToken === null ||
      reviewToken !== activeReviewToken
    ) {
      return refuse(
        409,
        action,
        WEB_SHELL_REFUSALS.reviewTokenInvalid,
        "reviewToken must match the exact proposal rendered for this review.",
      );
    }

    const snapshot = action === "accept" ? session.accept() : session.reject();

    if (snapshot.phase !== "reviewing" || snapshot.proposal === null) {
      activeReviewToken = null;
    }

    return snapshotResponse(action, snapshot, projectRoot, activeReviewToken);
  };

  const assistantTurn = async (
    body: string | undefined,
  ): Promise<InspectorHttpResponse> => {
    if (!assistantSetup.ok) {
      return refuse(
        503,
        "assistant",
        WEB_SHELL_REFUSALS.assistantUnavailable,
        `The assistant panel could not be wired: ${assistantSetup.message}`,
        { assistantReason: assistantSetup.reason },
      );
    }

    const panel = assistantSetup.panel;

    const parsed = parseJsonObject(body);

    if (!parsed.ok) return refuseRequest("assistant", parsed);

    if (Object.hasOwn(parsed.value, "mode")) {
      const selected = panel.setMode(parsed.value["mode"]);

      if (selected.refusal !== undefined) {
        return assistantSnapshotResponse("assistant", selected);
      }
    }

    const prompt = parsed.value["prompt"];
    const turnId = parsed.value["turnId"];

    const request: AssistantTurnRequest = {
      prompt: isText(prompt) ? prompt : "",
    };

    if (isText(turnId)) request.turnId = turnId;

    const snapshot = await panel.ask(request);

    return assistantSnapshotResponse("assistant", snapshot);
  };

  const route = (request: InspectorHttpRequest): InspectorHttpResponse => {
    const target = new URL(request.url, "http://localhost");
    const path = target.pathname;
    const method = request.method.toUpperCase();

    if (path === "/" || path === "/index.html") {
      if (method !== "GET" && method !== "HEAD") {
        return refuse(
          405,
          "page",
          WEB_SHELL_REFUSALS.methodNotAllowed,
          `${method} is not allowed on ${path}; use GET.`,
        );
      }

      return {
        status: 200,
        contentType: HTML_TYPE,
        body: inspectorPageHtml(projectRoot),
      };
    }

    const entry = Object.entries(INSPECTOR_ACTIONS).find(
      ([, candidate]) => candidate.path === path,
    );

    if (entry === undefined) {
      return refuse(
        404,
        "unknown",
        WEB_SHELL_REFUSALS.routeUnknown,
        `No inspector route serves ${path}.`,
        {
          routes: Object.values(INSPECTOR_ACTIONS).map(
            (candidate) => `${candidate.method} ${candidate.path}`,
          ),
        },
      );
    }

    // SAFETY: entry comes from Object.entries of the closed INSPECTOR_ACTIONS registry, preserving its key/value pairs.
  const [action, matched] = entry as [
      InspectorAction,
      (typeof INSPECTOR_ACTIONS)[InspectorAction],
    ];

    if (method !== matched.method) {
      return refuse(
        405,
        action,
        WEB_SHELL_REFUSALS.methodNotAllowed,
        `${method} is not allowed on ${path}; use ${matched.method}.`,
      );
    }

    switch (action) {
      case "state":
        return snapshotResponse(
          action,
          session.snapshot(),
          projectRoot,
          activeReviewToken,
        );
      case "document":
        return documentStatus(target.searchParams.get("path"));
      case "propose":
        return propose(request.body);
      case "accept":
      case "reject":
        return reviewAction(action, request.body);
      case "recover":
        return snapshotResponse(
          action,
          session.refreshRecovery(),
          projectRoot,
          activeReviewToken,
        );
      case "assistant":
        return refuse(
          500,
          action,
          WEB_SHELL_REFUSALS.handlerFailed,
          "The assistant route requires asynchronous request handling.",
        );
    }
  };

  /**
   * Route one request.
   *
   * The catch-all is the last fail-closed rule: a served surface answers every
   * request, so an unexpected throw becomes a named refusal instead of an
   * unhandled rejection that would take the dev server down with it.
   *
   * A closure, not a method: both members below call it, so routing cannot
   * depend on how a caller obtained the function it invoked.
   */
  const handleSync = (request: InspectorHttpRequest): InspectorHttpResponse => {
    try {
      return route(request);
    } catch {
      return refuse(
        500,
        "unknown",
        WEB_SHELL_REFUSALS.handlerFailed,
        "The inspector could not serve the request. No operation was automatically retried.",
      );
    }
  };

  /**
   * The same surface, with the one asynchronous route intercepted.
   *
   * Only an exact path *and* method match is intercepted; everything else —
   * unknown routes and a wrong method on the assistant path included — falls
   * through to the one router above rather than re-deriving its refusals.
   */
  const handleAsync = async (
    request: InspectorHttpRequest,
  ): Promise<InspectorHttpResponse> => {
    try {
      const target = new URL(request.url, "http://localhost");
      const method = request.method.toUpperCase();

      if (
        target.pathname !== INSPECTOR_ACTIONS.assistant.path ||
        method !== INSPECTOR_ACTIONS.assistant.method
      ) {
        return handleSync(request);
      }

      return await assistantTurn(request.body);
    } catch {
      return refuse(
        500,
        "assistant",
        WEB_SHELL_REFUSALS.handlerFailed,
        "The inspector could not serve the request. No operation was automatically retried.",
      );
    }
  };

  return { projectRoot, handle: handleSync, handleAsync };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The inspector page.
 *
 * Self-contained by necessity and by choice: this package may depend on
 * `schemas` and `authoring-core` (plus `auth`/`billing`) and nothing else, so
 * there is no framework, no bundler, and no external asset to fetch. It is also
 * the honest shape for the surface — the page holds no authoring logic, it
 * posts to the routes above and prints what comes back, which is why the
 * shell↔CLI parity claim is about the served routes rather than about markup.
 */
export function inspectorPageHtml(projectRoot: string): string {
  const root = escapeHtml(projectRoot);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SceneAxi inspector — ${root}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; padding: 24px; background: Canvas; color: CanvasText; }
  h1 { font-size: 1.1rem; margin: 0 0 4px; }
  .root { margin: 0 0 20px; overflow-wrap: anywhere; }
  form { display: grid; gap: 12px; max-width: 46rem; min-width: 0; }
  label { display: grid; gap: 4px; min-width: 0; }
  input { font: inherit; width: 100%; min-width: 0; padding: 8px 12px; background: Field; color: FieldText; border: 1px solid currentColor; border-radius: 4px; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; }
  button { font: inherit; min-height: 36px; padding: 8px 12px; cursor: pointer; background: ButtonFace; color: ButtonText; border: 1px solid currentColor; border-radius: 4px; }
  button[disabled] { cursor: not-allowed; border-style: dashed; }
  :is(button,input,select,textarea,a[href],summary,[tabindex]):focus-visible { outline: 2px solid currentColor; outline-offset: 2px; scroll-margin: 12px; }
  @media (forced-colors: active) { :focus-visible { outline-color: Highlight; } }
  :is(input,select,textarea):user-invalid { border-color: #b3261e; }
  [aria-invalid="true"] { border-color: #b3261e; border-width: 2px; }
  button:not(:disabled):active { box-shadow: inset 0 0 0 2px currentColor; }
  button:not(:disabled):hover { text-decoration: underline; text-underline-offset: 4px; }
  button:not(:disabled):active { box-shadow: inset 0 0 0 2px currentColor; }
  pre { border: 1px solid currentColor; border-radius: 4px; padding: 16px; max-width: 60rem; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; tab-size: 2; line-height: 1.65; }
  pre:empty { min-height: 3rem; border-style: dashed; }
  pre[aria-busy="true"] { border-inline-start-width: 3px; }
  code { overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
  @media (prefers-color-scheme: dark) { :is(input,select,textarea):user-invalid { border-color: #FF4D5E; } [aria-invalid="true"] { border-color: #FF4D5E; } }
  @media (forced-colors: active) { :is(input,select,textarea):user-invalid, [aria-invalid="true"] { border-color: Mark; } }
  #review-help { max-width: 46rem; overflow-wrap: anywhere; }
  .actions button { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
  .phase { font-weight: 700; }
  #note:not(:empty) { display: block; margin-top: 8px; padding: 8px 12px; border-left: 2px solid currentColor; overflow-wrap: anywhere; }
  .refused { color: #b3261e; }
  /* Foundations danger paint remains legible on the browser's dark Canvas. */
  @media (prefers-color-scheme: dark) { .refused { color: #FF4D5E; } }
  footer { margin-top: 32px; max-width: 46rem; overflow-wrap: anywhere; }
  @media (max-width: 480px) { body { padding: 16px; } .actions button { flex: 1 1 auto; } }
</style>
</head>
<body>
<h1>SceneAxi inspector</h1>
<p class="root">Serving <code>${root}</code> — local authoring only, loopback only.</p>

<form id="edit" aria-busy="false">
  <label>Document path (relative to the project root)
    <input id="documentPath" value="scene.json" required />
  </label>
  <label>JSON Pointer
    <input id="jsonPointer" value="/data/entities/0/x" />
  </label>
  <label>New value (JSON)
    <input id="newValue" value="42" required aria-describedby="note" />
  </label>
  <div class="actions">
    <button type="submit" id="propose">Propose</button>
    <button type="button" id="accept" aria-describedby="review-help" disabled>Accept</button>
    <button type="button" id="reject" aria-describedby="review-help" disabled>Reject</button>
    <button type="button" id="recover" aria-describedby="review-help" hidden>Resolve pending apply</button>
    <button type="button" id="reconcile" aria-describedby="review-help" hidden>Read authoritative state</button>
  </div>
</form>

<p id="review-help">Accept and Reject are unavailable until you Propose an edit and review its exact diff.</p>
<p>Phase: <span class="phase" id="phase">idle</span> <span id="note" role="status" aria-live="polite" aria-atomic="true"></span></p>
<pre id="diff" aria-label="Proposal diff" aria-busy="false" tabindex="0">No proposal yet. Propose an edit to review its diff before anything is written.</pre>

<footer>
  Nothing is written until you accept. This page is a protocol client of
  <code>@sceneaxi/authoring-core</code>; the same operation through the CLI
  produces byte-identical documents.
</footer>

<script>
const $ = (id) => document.getElementById(id);
const state = { phase: "idle", reviewToken: null, busy: false, uncertain: false, recoveryPending: false };

function phaseExplanation() {
  if (state.recoveryPending) return "Apply outcome is pending. Resolve pending apply before another edit; do not retry Accept.";
  if (state.phase === "reviewing") return "Review the exact diff before Accept. Reject discards the proposal without writing.";
  if (state.phase === "rejected") return "Proposal rejected. No document was written. Propose another edit when ready.";
  if (state.phase === "applied") return "Change applied. The diff below is history, not an actionable proposal.";
  return "No current proposal. Propose an edit to review before anything is written.";
}

function controls() {
  const blocked = state.busy || state.uncertain;
  const reviewing = !state.recoveryPending && state.phase === "reviewing" && typeof state.reviewToken === "string";
  $("propose").disabled = blocked || state.recoveryPending;
  $("accept").disabled = blocked || !reviewing;
  $("reject").disabled = blocked || !reviewing;
  $("recover").disabled = blocked;
  $("reconcile").hidden = !state.uncertain;
  $("reconcile").disabled = state.busy;
  $("edit").setAttribute("aria-busy", String(state.busy));
  $("diff").setAttribute("aria-busy", String(state.busy));
  $("review-help").textContent = state.busy
    ? "Waiting for authoritative response. Actions are unavailable until it arrives; no request will be repeated."
    : state.uncertain
      ? "The displayed review is not actionable. Read authoritative state, then review its exact diff again before Accept."
      : phaseExplanation();
}

function render(payload) {
  const snapshot = payload.snapshot;
  if (snapshot) {
    if (Object.hasOwn(payload, "reviewToken")) state.reviewToken = payload.reviewToken;
    state.phase = snapshot.phase ?? state.phase;
    $("phase").textContent = state.phase;
    $("diff").textContent = snapshot.renderedDiff
      ? (state.phase === "applied" ? "Applied change (history):\\n" : "") + snapshot.renderedDiff
      : "No current proposal. Propose an edit to review before anything is written.";
    state.recoveryPending = snapshot.journalRecoveryPending === true;
    $("recover").hidden = !state.recoveryPending;
  }
  if (!payload.ok && payload.reason === "review-token-invalid") {
    state.uncertain = true;
    state.reviewToken = null;
    $("diff").textContent = "This review is stale. Read authoritative state and review the current diff before accepting.";
  }
  $("note").textContent = payload.ok
    ? phaseExplanation()
    : "Refused (" + (payload.reason ?? "unknown") + "): " + (payload.message ?? "No explanation received.") +
      (state.uncertain ? " Read authoritative state before another operation." :
       state.recoveryPending ? " " + phaseExplanation() : " Review the inputs and diagnostic before trying again.");
  $("note").className = payload.ok ? "" : "refused";
  controls();
}

async function call(path, body) {
  if (state.busy || (state.uncertain && path !== "/api/state")) return;
  const initiator = document.activeElement;
  const restoreFocus = initiator && initiator.matches("button");
  state.busy = true;
  $("note").textContent = "Waiting for authoritative response. No operation will be retried automatically.";
  $("note").className = "";
  controls();
  try {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    if (!payload || typeof payload.ok !== "boolean" ||
        (path === "/api/state" && !payload.snapshot)) throw new Error("Invalid response");
    if (path === "/api/state") state.uncertain = false;
    render(payload);
  } catch {
    state.uncertain = true;
    state.reviewToken = null;
    $("phase").textContent = "unknown";
    $("diff").textContent = "Current outcome unknown. Read authoritative state before another operation.";
    $("note").textContent = " — connection or response failed; outcome unknown. No write was retried. Read authoritative state.";
    $("note").className = "refused";
  } finally {
    state.busy = false;
    controls();
    // Do not steal focus if the user moved to a field or diff while waiting.
    if (restoreFocus && (document.activeElement === initiator || document.activeElement === document.body)) {
      const target = state.uncertain ? $("reconcile")
        : state.recoveryPending ? $("recover")
        : state.phase === "reviewing" ? $("accept") : $("propose");
      target.focus();
    }
  }
}

$("newValue").addEventListener("input", () => {
  if ($("newValue").hasAttribute("aria-invalid")) {
    $("newValue").removeAttribute("aria-invalid");
    $("newValue").setCustomValidity("");
    $("note").textContent = "";
    $("note").className = "";
  }
});
$("edit").addEventListener("submit", (event) => {
  event.preventDefault();
  let newValue;
  try {
    newValue = JSON.parse($("newValue").value);
  } catch (error) {
    $("note").textContent = " — new value must be valid JSON: " + error.message;
    $("note").className = "refused";
    $("newValue").setAttribute("aria-invalid", "true");
    $("newValue").setCustomValidity("New value must be valid JSON.");
    $("newValue").focus();
    return;
  }
  void call("/api/propose", {
    documentPath: $("documentPath").value,
    jsonPointer: $("jsonPointer").value,
    newValue,
  });
});
$("accept").addEventListener("click", () => void call("/api/accept", {
  reviewToken: state.reviewToken,
}));
$("reject").addEventListener("click", () => void call("/api/reject", {
  reviewToken: state.reviewToken,
}));
$("recover").addEventListener("click", () => void call("/api/recover", {}));
$("reconcile").addEventListener("click", () => void call("/api/state"));
void call("/api/state");
</script>
</body>
</html>
`;
}
