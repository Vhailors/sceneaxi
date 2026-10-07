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
import { OPERATE_CSS_VARS, OPERATE_PENDING_PLATE_CSS } from "./operate-tokens.js";
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

  // v6 A-rich "signal box", Operate dialect (docs/redesign-v6/DIRECTION.md §4, §5, §9). CSP is default-src 'none':
  // no font, image or data: URL loads, so faces fall back to installed ones and icons are inline SVG symbols.
  // Lunar marks only what is under inspection; yellow is the commit. Comments stay out of the served CSS (byte budget).
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SceneAxi inspector — ${root}</title>
<style>
${OPERATE_CSS_VARS}
* { box-sizing: border-box; }
button[hidden], dl[hidden] { display: none; }
::selection { background: var(--ink); color: var(--panel); }
html { scrollbar-color: var(--edge) var(--iron); }
body { margin: 0; background: var(--panel); color: var(--ink); font-family: var(--font-prose); font-variant-numeric: tabular-nums; }
.shell { --pad: 12px; --gap: 8px; --control: 32px; --row-pad: 12px 14px; font-size: 14px; line-height: 1.5; }
.shell[data-density=comfortable] { --pad: 24px; --gap: 16px; --control: 44px; --row-pad: 18px 24px; font-size: 16px; }
h1, h2 { font-family: var(--font-plate); font-weight: 800; font-stretch: condensed; line-height: 1.05; text-wrap: balance; }
h1 { font-size: 1.5rem; }
h1, h2, p { margin: 0; }
h2 { font-size: 1.375rem; }
.icon { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.sr { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.sprite { position: absolute; }
.masthead { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 20px; padding: 12px clamp(16px, 3vw, 32px); background: var(--iron); border-bottom: 1px solid var(--hair); }
.root { flex: 1 1 20rem; min-width: 0; font-size: 13px; color: var(--ink-2); overflow-wrap: anywhere; }
.workbench { display: grid; }
.controls { min-width: 0; padding: var(--pad) clamp(16px, 3vw, 24px); background: var(--iron); display: grid; gap: var(--gap); align-content: start; }
form { display: grid; gap: var(--gap); min-width: 0; }
label { display: grid; gap: 4px; min-width: 0; font-size: 13px; font-weight: 700; }
input { font: 500 14px/1.3 var(--font-data); width: 100%; min-width: 0; min-height: var(--control); padding: 4px 10px; background: var(--well); color: var(--ink); border: 1px solid var(--edge); border-radius: 2px; box-shadow: var(--sink); font-variant-numeric: tabular-nums; }
:where(input):hover { border-color: var(--ink); }
.actions { display: flex; gap: 8px; flex-wrap: wrap; min-width: 0; }
button { font: 700 14px/1.2 var(--font-prose); min-height: var(--control); padding: 4px 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; max-width: 100%; white-space: normal; overflow-wrap: anywhere; background: transparent; color: var(--ink); border: 2px solid var(--btn-edge, var(--edge)); border-radius: 2px; transition: background-color 120ms linear, transform var(--catch) linear; }
.shell[data-density=comfortable] :is(button, input) { font-size: 16px; padding-inline: 18px; }
[data-density=comfortable] label { font-size: 14px; }
#propose:not(:disabled) { background: var(--enamel); color: var(--on-enamel); border-color: var(--enamel); }
#accept:not(:disabled) { background: var(--commit) linear-gradient(var(--commit), var(--commit)) no-repeat 0 0 / 100% 100%; color: var(--on-commit); border-color: var(--commit-edge); }
@media (hover: hover) { button:not(:disabled):hover { background: var(--iron-raised); border-color: var(--ink); } #propose:not(:disabled):hover { background: var(--enamel-hi); border-color: var(--enamel-hi); } #accept:not(:disabled):hover { background: var(--commit-hi); } }
button[disabled] { cursor: not-allowed; border-style: dashed; }
button:disabled { color: var(--ink-2); background: transparent; transition: none; }
[aria-busy="true"] button[disabled] { cursor: progress; }
:is(button,input,select,textarea,a[href],summary,[tabindex]):focus-visible { outline: 2px solid currentColor; outline-offset: 2px; scroll-margin: 12px; }
@media (forced-colors: none) { :is(button,input,a[href],[tabindex]):focus-visible { outline: 3px solid var(--focus); } }
@media (forced-colors: active) { :focus-visible { outline-color: Highlight; } }
[aria-invalid="true"], input:user-invalid { border-color: #b3261e; }
[aria-invalid="true"] { border-width: 2px; }
button:not(:disabled):active { transform: translateY(2px); transition-duration: 0ms; }
.status { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
.status-label, .evidence-label, .digests dt { font-size: 13px; font-weight: 700; color: var(--ink-2); }
.plate { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px 3px 7px; border-radius: 2px; font: 800 14px/1.2 var(--font-plate); font-stretch: condensed; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; background: var(--stale); color: var(--on-stale); box-shadow: inset 0 0 0 1px var(--edge); }
.plate .icon { width: 16px; height: 16px; }
.plate[data-phase=idle], .review-state[data-state=idle] { background: transparent; color: var(--ink); box-shadow: inset 0 0 0 2px var(--edge); }
.plate[data-phase=applied], .review-state[data-state=verified] { background: var(--verified); color: var(--on-verified); }
${OPERATE_PENDING_PLATE_CSS}
.review-state[data-state=refused] { background: var(--refused); color: var(--on-refused); box-shadow: 0 0 0 2px var(--edge); }
#note:not(:empty) { display: flex; gap: 8px; width: 100%; overflow-wrap: anywhere; min-width: 0; }
#note.refused:not(:empty) { padding: 8px 10px; background: var(--well); color: var(--refused-lamp); border: 1px solid currentColor; font-weight: 600; }
#note.refused:not(:empty)::before { content: ""; flex: none; width: 16px; height: 16px; margin-top: 2px; background: currentColor; clip-path: polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%); }
.refused { color: #b3261e; }
@media (prefers-color-scheme: dark) { .refused { color: #FF4D5E; } }
.review { min-width: 0; padding: var(--pad) clamp(16px, 3vw, 28px) 32px; display: grid; gap: var(--gap); align-content: start; }
.review-head { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between; }
.review-head h2:focus { outline: none; }
.rows { list-style: none; margin: 0; padding: 0; position: relative; overflow: clip; border: 1px solid var(--hair); background: var(--iron); box-shadow: var(--lift-1); }
.rows:empty { display: none; }
.row { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 4fr) minmax(0, 4fr); gap: 8px 20px; padding: var(--row-pad); border-bottom: 1px solid var(--rule); min-width: 0; }
.row:last-child { border-bottom: 0; }
.cell { display: grid; gap: 6px; align-content: start; min-width: 0; }
.cell-head { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-height: 22px; }
.cell-label { font: 800 13px/1 var(--font-plate); font-stretch: condensed; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-2); }
.tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px 2px 5px; border-radius: 2px; font: 700 13px/1.2 var(--font-prose); }
.tag .icon { width: 14px; height: 14px; }
.tag.differs { background: var(--lunar); color: var(--on-lunar); }
.tag.same { color: var(--ink-2); box-shadow: inset 0 0 0 1px var(--edge); }
.doc { font: 600 13px/1.35 var(--font-data); color: var(--ink-2); overflow-wrap: anywhere; }
.route { list-style: none; margin: 0; padding: 8px 10px 6px; display: flex; flex-wrap: wrap; row-gap: 8px; min-width: 0; background: var(--bed); box-shadow: var(--sink); border-radius: 2px; }
.route li { position: relative; flex: 0 1 auto; min-width: 0; padding: 22px 10px 0 0; }
.route li::before { content: ""; position: absolute; left: 0; right: 0; top: 7px; height: 4px; background: var(--route); }
.route li:first-child::before { left: 6px; }
.route li:last-child::before { right: auto; width: 12px; }
.route li::after { content: ""; position: absolute; left: 0; top: 2px; width: 14px; height: 14px; background: var(--bed); border: 3px solid var(--route); border-radius: 50%; }
.review[data-phase=reviewing] .route li:last-child::after { border-color: var(--lunar); box-shadow: 0 0 0 2px var(--bed), 0 0 0 4px var(--lunar); }
.review[data-phase=applied] .route { --route: var(--verified-route); }
.route .key { display: block; font: 500 13px/1.3 var(--font-data); color: var(--ink-2); overflow-wrap: anywhere; }
.route li:last-child .key { font-weight: 700; font-size: 15px; color: var(--ink); }
.val { margin: 0; font: 600 15px/1.4 var(--font-data); white-space: pre-wrap; overflow-wrap: anywhere; min-width: 0; }
.before .val, .review[data-uncertain=true] :is(.val, .route .key) { text-decoration: line-through 2px var(--ink-2); }
.after .val mark { background: var(--lunar-mark); color: var(--on-lunar-mark); box-shadow: inset 0 -2px 0 var(--lunar); padding: 0 3px; border-radius: 1px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.review[data-phase=applied] :is(.after .val mark, .tag.differs) { background: var(--verified); color: var(--on-verified); box-shadow: none; }
.review[data-uncertain=true] :is(.after .val mark, .tag.differs) { background: transparent; color: inherit; box-shadow: inset 0 0 0 1px var(--edge); }
.decision { background: var(--plate); color: var(--ink); border: 1px solid var(--hair); box-shadow: var(--lift-1); padding: var(--row-pad); display: grid; gap: 8px; min-width: 0; --btn-edge: var(--hair); }
.decision button:disabled { color: var(--ink-2-plate); }
.clause { max-width: 70ch; overflow-wrap: anywhere; }
.clause b { font-weight: 800; }
#review-help { color: var(--ink-2-plate); }
.digests { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 4px 12px; margin: 0; padding: 8px 12px; background: var(--well); box-shadow: var(--sink); border: 1px solid var(--hair); font-size: 13px; }

.digests dd { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; min-width: 0; }
.digests code { white-space: nowrap; }
.digests button { min-height: 28px; padding: 2px 10px; font-size: 13px; }

pre { border: 1px solid var(--hair); border-radius: 2px; padding: 12px 14px; min-width: 0; margin: 0; background: var(--well); box-shadow: var(--sink); font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 2; line-height: 1.65; }
pre:empty { min-height: 3rem; border-style: dashed; }
pre[aria-busy="true"] { border-inline-start-width: 3px; }
code { overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
pre, code { font-family: var(--font-data); }
footer { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; padding: 20px clamp(16px, 3vw, 28px) 32px; font-size: 13px; color: var(--ink-2); overflow-wrap: anywhere; border-top: 1px solid var(--hair); }
footer p { flex: 1 1 28rem; max-width: 70ch; }
:is(.root, footer) code { color: var(--ink); }
#density[aria-pressed=true] { background: var(--iron-raised); border-style: solid; border-color: var(--ink); }
@media (prefers-color-scheme: dark) { [aria-invalid="true"], input:user-invalid { border-color: #FF4D5E; } }
@media (forced-colors: active) { [aria-invalid="true"], input:user-invalid { border-color: Mark; } .plate, .decision, .rows, .tag { border: 1px solid CanvasText; background: Canvas; color: CanvasText; } .route li::before { background: CanvasText; } .route li::after { border-color: CanvasText; background: Canvas; } .after .val mark { forced-color-adjust: none; background: Mark; color: MarkText; } }
@media (min-width: 960px) { .workbench { grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr); min-height: calc(100vh - 60px); } .controls { border-right: 1px solid var(--hair); } }
@media (max-width: 959px) { .controls { border-bottom: 1px solid var(--hair); } }
@media (max-width: 759px) { .row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .where { grid-column: 1 / -1; } .route { flex-direction: column; row-gap: 2px; } .route li { padding: 0 0 0 24px; } .route li::before, .route li:first-child::before { left: 5px; right: auto; top: 0; bottom: -2px; width: 4px; height: auto; } .route li:first-child::before { top: 8px; } .route li:last-child::before { bottom: auto; height: 8px; width: 4px; } .route li::after { top: 2px; } }
@media (max-width: 480px) { input { font-size: 16px; } .actions button { flex: 1 1 auto; justify-content: center; } .shell[data-density=comfortable] { --pad: 16px; --gap: 10px; --row-pad: 14px 16px; } }
@media (prefers-reduced-motion: no-preference) {
[data-echo=reviewing] .route li::before { animation: wipe var(--lamp) steps(6, end) 120ms backwards; }
[data-echo=reviewing] .rows::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(90deg, transparent calc(100% - 4px), var(--lunar) 0); transform: translateX(-100%); animation: scan 640ms var(--ease-throw) 480ms backwards; }
[data-echo=reviewing] :is(.after mark, .tag.differs) { animation: wipe var(--throw) var(--ease-throw) 620ms backwards; }
[data-echo=reviewing] .row:nth-child(2) :is(mark, .tag.differs) { animation-delay: 700ms; }
[data-echo=reviewing] .row:nth-child(n+3) :is(mark, .tag.differs) { animation-delay: 780ms; }
[data-echo=reviewing] #accept:not(:disabled) { animation: commit-paint var(--lamp) var(--ease-throw) 1080ms backwards; }
[data-echo=applied] .route li::before { animation: wipe var(--lamp) steps(6, end) 80ms backwards; }
[data-echo=applied] .after mark { animation: wipe var(--settle) var(--ease-throw) 260ms backwards; }
}
@keyframes wipe { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0); } }
@keyframes scan { to { transform: none; } }
@keyframes commit-paint { from { background-color: #f1eee4; background-size: 0% 100%; } to { background-color: #f1eee4; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition-duration: 0ms !important; } button:not(:disabled):active { transform: none; } }
</style>
</head>
<body>
<svg width="0" height="0" aria-hidden="true" focusable="false" class="sprite">
  <symbol id="i-idle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /></symbol>
  <symbol id="i-pending" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></symbol>
  <symbol id="i-verified" viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5" /></symbol>
  <symbol id="i-refused" viewBox="0 0 24 24"><path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z" /><path d="M8 12h8" /></symbol>
  <symbol id="i-rejected" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M6.5 17.5l11-11" /></symbol>
  <symbol id="i-stale" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4h4" /><path d="M9 15l6-6" /></symbol>
  <symbol id="i-unknown" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.8" /><path d="M12 17.2v.1" /></symbol>
  <symbol id="i-differs" viewBox="0 0 24 24"><path d="M5 9h14M5 15h14" /><path d="M15 4L9 20" /></symbol>
</svg>
<main class="shell" data-density="compact">
<header class="masthead">
<h1>SceneAxi inspector</h1>
<p class="root">Serving <code>${root}</code> — local authoring only, loopback only.</p>
</header>

<div class="workbench">
<div class="controls">
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
  </div>
</form>
<p class="status"><span class="status-label">Phase</span> <span class="plate" data-phase="idle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-idle"/></svg><span class="phase" id="phase" data-phase="idle">idle</span></span></p>
<p><span id="note" role="status" aria-live="polite" aria-atomic="true"></span></p>
</div>

<section class="review" id="review" aria-labelledby="review-title" data-uncertain="false" data-phase="idle">
<div class="review-head">
  <h2 id="review-title" tabindex="-1">Change Review</h2>
  <span class="plate review-state" id="review-state" data-state="idle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-idle"/></svg><span id="review-state-label">No proposal</span></span>
</div>
<ol class="rows" id="rows" aria-label="Proposed edits, before and after"></ol>
<div class="decision" id="decision" aria-busy="false">
  <p class="clause"><b>Consequence.</b> <span id="consequence">Nothing is proposed, so nothing will be written.</span></p>
  <p class="clause"><b>Recovery.</b> <span id="review-help">Accept and Reject are unavailable until you Propose an edit and review its exact diff.</span></p>
  <div class="actions">
    <button type="button" id="accept" aria-describedby="consequence review-help" disabled><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-verified"/></svg>Accept</button>
    <button type="button" id="reject" aria-describedby="consequence review-help" disabled>Reject</button>
    <button type="button" id="recover" aria-describedby="review-help" hidden>Resolve pending apply</button>
    <button type="button" id="reconcile" aria-describedby="review-help" hidden>Read authoritative state</button>
  </div>
</div>
<dl class="digests" id="digests" hidden></dl>
<p class="evidence-label" aria-hidden="true">Exact diff: the bytes Accept writes</p>
<pre id="diff" aria-label="Proposal diff" aria-busy="false" tabindex="0">No current proposal.</pre>
</section>
</div>

<footer>
  <p>Nothing is written until you accept. This page is a protocol client of
  <code>@sceneaxi/authoring-core</code>; the same operation through the CLI
  produces byte-identical documents.</p>
  <button type="button" id="density" aria-pressed="false">Comfortable density</button>
</footer>
</main>

<script>
const $ = (id) => document.getElementById(id);
const state = { phase: "idle", reviewToken: null, busy: false, uncertain: false, stale: false, refused: false, recoveryPending: false };
const moves = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: no-preference)").matches;

// Visual-only motion hook: data-echo names the phase whose one-shot echo plays. Removing it and forcing a
// reflow restarts the animations on persistent elements (#accept, .rows::after). Nothing reads it back.
function echo(phase) {
  const review = $("review");
  if (!moves()) return;
  delete review.dataset.echo;
  void review.offsetWidth;
  review.dataset.echo = phase;
}
const PHASE_ICONS = { idle: "i-idle", reviewing: "i-pending", applied: "i-verified", rejected: "i-rejected" };
function showPhase(phase) {
  if ($("phase").dataset.phase === phase) return;
  $("phase").dataset.phase = phase;
  const plate = $("phase").parentElement;
  plate.dataset.phase = phase;
  plate.classList.toggle("sx-plate--pending", phase === "reviewing");
  plate.querySelector("use").setAttribute("href", "#" + (PHASE_ICONS[phase] || "i-unknown"));
}

// Density: compact by default (Operate inspector); ?density= or the footer toggle picks comfortable.
function setDensity(value, persist) {
  if (value !== "compact" && value !== "comfortable") return;
  $("density").closest("main").dataset.density = value;
  $("density").setAttribute("aria-pressed", String(value === "comfortable"));
  if (persist) { try { localStorage.setItem("sceneaxi.inspector.density", value); } catch { /* storage unavailable: density stays for this page */ } }
}
try { setDensity(new URLSearchParams(location.search).get("density") || localStorage.getItem("sceneaxi.inspector.density"), false); } catch { /* defaults stay */ }
$("density").addEventListener("click", () => setDensity($("density").getAttribute("aria-pressed") === "true" ? "compact" : "comfortable", true));

// Named review states: every state has a label and an icon; colour is never the only cue.
const STATES = {
  idle: ["No proposal", "i-idle"],
  pending: ["Pending review · unwritten", "i-pending"],
  verified: ["Verified · written", "i-verified"],
  rejected: ["Rejected · nothing written", "i-rejected"],
  refused: ["Refused · nothing written", "i-refused"],
  stale: ["Stale · not actionable", "i-stale"],
  unknown: ["Outcome unknown", "i-unknown"],
  recovery: ["Apply outcome pending", "i-unknown"],
};
function reviewState() {
  if (state.recoveryPending) return "recovery";
  if (state.uncertain) return state.stale ? "stale" : "unknown";
  if (state.refused && state.phase !== "reviewing") return "refused";
  return state.phase === "reviewing" ? "pending" : state.phase === "applied" ? "verified" : state.phase === "rejected" ? "rejected" : "idle";
}
function showState() {
  const key = reviewState();
  const plate = $("review-state");
  if (plate.dataset.state === key) return;
  plate.dataset.state = key;
  plate.classList.toggle("sx-plate--pending", key === "pending");
  plate.querySelector("use").setAttribute("href", "#" + STATES[key][1]);
  $("review-state-label").textContent = STATES[key][0];
}

// Structured review: rows come from snapshot.proposal.edits (documentPath, jsonPointer,
// oldValue, newValue, baseContentHash), which the routes already return. #diff keeps the
// exact rendered bytes; nothing here is HTML, every value goes through textContent.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#" + name);
  svg.append(use);
  return svg;
}
function shown(value) { return value === undefined ? "(absent)" : JSON.stringify(value, null, 2); }
function cell(kind, label) {
  const c = el("div", "cell " + kind);
  const head = el("div", "cell-head");
  head.append(el("span", "cell-label", label));
  c.append(head);
  return c;
}
function editRow(edit) {
  const row = el("li", "row");
  const where = cell("where", "Where");
  where.append(el("span", "doc", edit.documentPath));
  const route = el("ol", "route");
  route.setAttribute("aria-label", "JSON Pointer " + (edit.jsonPointer || "(document root)"));
  const segments = edit.jsonPointer ? edit.jsonPointer.split("/").slice(1).map((s) => "/" + s) : ["(document root)"];
  for (const segment of segments) { const li = el("li"); li.append(el("span", "key", segment)); route.append(li); }
  where.append(route);
  const before = cell("before", "Before");
  before.append(el("p", "val", shown(edit.oldValue)));
  const after = cell("after", "After");
  const same = shown(edit.oldValue) === shown(edit.newValue);
  const tag = el("span", same ? "tag same" : "tag differs");
  tag.append(icon(same ? "i-idle" : "i-differs"), same ? "Same value" : "Differs");
  after.firstChild.append(tag);
  const value = el("p", "val");
  if (same) value.textContent = shown(edit.newValue);
  else value.append(el("mark", "", shown(edit.newValue)));
  after.append(value);
  row.append(where, before, after);
  return row;
}
function shortDigest(hash) {
  const match = /^sha256:([0-9a-f]{64})$/.exec(hash);
  return match ? "sha256:" + match[1].slice(0, 12) + "\\u2026" + match[1].slice(-4) : hash;
}
function digestEntry(edit) {
  const dd = el("dd");
  const code = el("code", "", shortDigest(edit.baseContentHash));
  code.setAttribute("aria-hidden", "true");
  const copy = el("button", "", "Copy");
  copy.type = "button";
  copy.dataset.action = "copy-digest";
  copy.dataset.value = edit.baseContentHash;
  copy.setAttribute("aria-label", "Copy base digest " + edit.baseContentHash);
  dd.append(code, el("span", "sr", edit.baseContentHash), copy);
  return [el("dt", "", "Base · " + edit.documentPath), dd];
}
function consequence(edits) {
  const docs = [...new Set(edits.map((edit) => edit.documentPath))].join(", ");
  const count = edits.length === 1 ? "1 change" : edits.length + " changes";
  if (state.recoveryPending) return "An earlier apply has not been confirmed. Nothing new can be written until it is resolved.";
  if (state.phase === "reviewing" && edits.length > 0) return "Accept writes " + count + " to " + docs + ", all or nothing. If a document no longer matches its base digest, Accept refuses and writes nothing.";
  if (state.phase === "applied" && edits.length > 0) return "Written: " + docs + " now holds the After values.";
  if (state.phase === "rejected") return "Nothing was written; every document keeps its base digest.";
  return "Nothing is proposed, so nothing will be written.";
}
function renderReview(snapshot) {
  const edits = snapshot.proposal && Array.isArray(snapshot.proposal.edits) ? snapshot.proposal.edits : [];
  const previous = $("rows").textContent;
  const previousPhase = $("review").dataset.phase;
  $("review").dataset.phase = state.phase;
  if ($("review").dataset.echo !== state.phase) delete $("review").dataset.echo;
  $("rows").replaceChildren(...edits.map(editRow));
  const digests = [], seen = new Set();
  for (const edit of edits) {
    if (seen.has(edit.documentPath) || typeof edit.baseContentHash !== "string") continue;
    seen.add(edit.documentPath);
    digests.push(...digestEntry(edit));
  }
  $("digests").replaceChildren(...digests);
  $("digests").hidden = digests.length === 0;
  $("consequence").textContent = consequence(edits);
  if (edits.length > 0 && ((state.phase === "reviewing" && $("rows").textContent !== previous) || (state.phase === "applied" && previousPhase !== "applied"))) echo(state.phase);
}

// #note carries the outcome; #review-help carries the recovery. Neither repeats the other.
function outcome() {
  if (state.recoveryPending) return "Apply outcome is pending. Resolve pending apply before another edit.";
  if (state.phase === "reviewing") return "Review ready. Nothing is written yet.";
  if (state.phase === "rejected") return "Proposal rejected. No document was written.";
  if (state.phase === "applied") return "Change applied. The rows are history, not an actionable proposal.";
  return "No current proposal.";
}
function phaseExplanation() {
  if (state.recoveryPending) return "Resolve pending apply reads the journal and authoritative state first; Accept is never retried.";
  if (state.phase === "reviewing") return "Review the exact diff before Accept. Reject discards the proposal without writing.";
  if (state.phase === "rejected") return "Propose another edit when ready; it is reviewed the same way.";
  if (state.phase === "applied") return "To return, propose the Before value at the same pointer; it is reviewed the same way.";
  return "Accept and Reject are unavailable until you Propose an edit and review its exact diff.";
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
  $("decision").setAttribute("aria-busy", String(state.busy));
  $("review").dataset.uncertain = String(state.uncertain);
  if (state.uncertain) $("consequence").textContent = state.stale
    ? "This review was superseded and cannot be accepted. Nothing was written from it."
    : "Unknown whether anything was written. The review shown cannot be accepted.";
  $("diff").setAttribute("aria-busy", String(state.busy));
  $("review-help").textContent = state.busy
    ? "Actions are unavailable until the response arrives; no request will be repeated."
    : state.uncertain
      ? "Read authoritative state, then review its exact diff again before Accept. No request is repeated."
      : phaseExplanation();
  showState();
}

function render(payload) {
  const snapshot = payload.snapshot;
  if (snapshot) {
    if (Object.hasOwn(payload, "reviewToken")) state.reviewToken = payload.reviewToken;
    state.phase = snapshot.phase ?? state.phase;
    $("phase").textContent = state.phase;
    showPhase(state.phase);
    const previousDiff = $("diff").textContent;
    $("diff").textContent = snapshot.renderedDiff
      ? (state.phase === "applied" ? "Applied change (history):\\n" : "") + snapshot.renderedDiff
      : "No current proposal.";
    if ($("diff").textContent !== previousDiff) {
      $("diff").dataset.state = state.phase === "applied" ? "applied" : "update";
    }
    state.recoveryPending = snapshot.journalRecoveryPending === true;
    $("recover").hidden = !state.recoveryPending;
    renderReview(snapshot);
  }
  if (!payload.ok && payload.reason === "review-token-invalid") {
    state.uncertain = true;
    state.stale = true;
    state.reviewToken = null;
    $("diff").textContent = "This review is stale: a newer proposal replaced it. Nothing shown here is actionable.";
    $("diff").dataset.state = "update";
  }
  state.refused = !payload.ok && !state.uncertain;
  $("note").textContent = payload.ok
    ? outcome()
    : "Refused (" + (payload.reason ?? "unknown") + "): " + (payload.message ?? "No explanation received.") +
      (state.uncertain ? " Read authoritative state before another operation." :
       state.recoveryPending ? " " + outcome() : " Review the inputs and diagnostic before trying again.");
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
    if (path === "/api/state") { state.uncertain = false; state.stale = false; }
    render(payload);
  } catch {
    state.uncertain = true;
    state.stale = false;
    state.reviewToken = null;
    $("phase").textContent = "unknown";
    showPhase("unknown");
    $("diff").textContent = "Current outcome unknown. Nothing shown here is actionable.";
    $("diff").dataset.state = "update";
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

$("digests").addEventListener("click", async (event) => {
  const button = event.target instanceof Element ? event.target.closest('button[data-action="copy-digest"]') : null;
  if (!button) return;
  const value = button.dataset.value;
  try {
    await navigator.clipboard.writeText(value);
    button.textContent = "Copied";
    button.setAttribute("aria-label", "Copied base digest " + value);
  } catch {
    button.textContent = "Copy unavailable";
    button.setAttribute("aria-label", "Copy unavailable; base digest " + value);
  }
});
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
