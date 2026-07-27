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
 * `INSPECTOR_ACTIONS` is the whole vocabulary and each entry names the session
 * method it forwards to. No CLI spawn (matrix-denied), no engine import, no
 * hosting or deployment — that tier is `sites/` (ADR 0018).
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
} from "@sceneaxi/authoring-core";
import {
  createInspectorSession,
  type InspectorSession,
  type InspectorSnapshot,
} from "./inspector.js";

/** Stable app identifier echoed on every payload, matching the shell binaries. */
export const WEB_SHELL_APP = "sceneaxi-web-shell";

/**
 * Every named refusal the startable web shell can produce, launch included.
 *
 * One registry rather than one per module: a refusal is only fail-closed if it
 * is reachable, and `test/refuse-matrix.test.ts` asserts exactly that of every
 * entry here.
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
} as const);

export type WebShellRefusal =
  (typeof WEB_SHELL_REFUSALS)[keyof typeof WEB_SHELL_REFUSALS];

/**
 * The served vocabulary. `session` names the `InspectorSession` method the
 * action forwards to — the reason this surface cannot drift into a second
 * protocol without the mapping changing in plain sight.
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
    description: "Accept the reviewed proposal (apply via authoring-core)",
  }),
  reject: Object.freeze({
    method: "POST",
    path: "/api/reject",
    session: "reject",
    description: "Discard the reviewed proposal without writing",
  }),
  recover: Object.freeze({
    method: "POST",
    path: "/api/recover",
    session: "refreshRecovery",
    description: "Re-resolve a pending durable apply transaction",
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
  handle(request: InspectorHttpRequest): InspectorHttpResponse;
};

export type CreateInspectorAppOptions = {
  /** Project root served to the browser (default: `process.cwd()`). */
  readonly projectRoot?: string;
  /** Inspector session to drive (default: one bound to `projectRoot`). */
  readonly session?: InspectorSession;
};

const JSON_TYPE = "application/json; charset=utf-8";
const HTML_TYPE = "text/html; charset=utf-8";

function jsonBody(payload: Readonly<Record<string, unknown>>): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function okResponse(
  action: string,
  payload: Readonly<Record<string, unknown>>,
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
  reason: WebShellRefusal,
  message: string,
  extra: Readonly<Record<string, unknown>> = {},
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
  documentPath: unknown,
):
  | { readonly ok: true; readonly documentPath: string; readonly absolute: string }
  | { readonly ok: false; readonly reason: WebShellRefusal; readonly message: string } {
  if (typeof documentPath !== "string" || documentPath.length === 0) {
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
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly reason: WebShellRefusal; readonly message: string } {
  const text = body ?? "";
  if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BODY_BYTES) {
    return {
      ok: false,
      reason: WEB_SHELL_REFUSALS.requestBodyTooLarge,
      message: `Request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes.`,
    };
  }
  if (text.trim() === "") return { ok: true, value: {} };
  let parsed: unknown;
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
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      reason: WEB_SHELL_REFUSALS.requestBodyNotJson,
      message: "Request body must be a JSON object.",
    };
  }
  return { ok: true, value: parsed as Record<string, unknown> };
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
): InspectorHttpResponse {
  const payload = { projectRoot, snapshot };
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

  const documentStatus = (path: unknown): InspectorHttpResponse => {
    const resolved = resolveInsideProjectRoot(projectRoot, path);
    if (!resolved.ok) {
      return refuse(
        resolved.reason === WEB_SHELL_REFUSALS.editFieldInvalid ? 400 : 403,
        "document",
        resolved.reason,
        resolved.message,
      );
    }
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
    if (!parsed.ok) {
      return refuse(
        parsed.reason === WEB_SHELL_REFUSALS.requestBodyTooLarge ? 413 : 400,
        "propose",
        parsed.reason,
        parsed.message,
      );
    }
    const resolved = resolveInsideProjectRoot(
      projectRoot,
      parsed.value["documentPath"],
    );
    if (!resolved.ok) {
      return refuse(
        resolved.reason === WEB_SHELL_REFUSALS.editFieldInvalid ? 400 : 403,
        "propose",
        resolved.reason,
        resolved.message,
      );
    }
    const jsonPointer = parsed.value["jsonPointer"];
    if (typeof jsonPointer !== "string") {
      return refuse(
        400,
        "propose",
        WEB_SHELL_REFUSALS.editFieldInvalid,
        "jsonPointer must be a string (the empty string addresses the whole document).",
      );
    }
    if (!Object.hasOwn(parsed.value, "newValue")) {
      return refuse(
        400,
        "propose",
        WEB_SHELL_REFUSALS.editFieldInvalid,
        "newValue is required (send null explicitly to set a null value).",
      );
    }
    // The session owns cwd resolution; passing the served root keeps a request
    // from selecting a different one.
    return snapshotResponse(
      "propose",
      session.proposeEdit({
        documentPath: resolved.documentPath,
        jsonPointer,
        newValue: parsed.value["newValue"],
        cwd: projectRoot,
      }),
      projectRoot,
    );
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
        return snapshotResponse(action, session.snapshot(), projectRoot);
      case "document":
        return documentStatus(target.searchParams.get("path"));
      case "propose":
        return propose(request.body);
      case "accept":
        return snapshotResponse(action, session.accept(), projectRoot);
      case "reject":
        return snapshotResponse(action, session.reject(), projectRoot);
      case "recover":
        return snapshotResponse(action, session.refreshRecovery(), projectRoot);
    }
  };

  return {
    projectRoot,

    /**
     * Route one request.
     *
     * The catch-all is the last fail-closed rule: a served surface answers
     * every request, so an unexpected throw becomes a named refusal instead of
     * an unhandled rejection that would take the dev server down with it.
     */
    handle(request: InspectorHttpRequest): InspectorHttpResponse {
      try {
        return route(request);
      } catch (error) {
        return refuse(
          500,
          "unknown",
          WEB_SHELL_REFUSALS.handlerFailed,
          `The inspector could not serve ${request.url}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };
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
  body { font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; padding: 1.5rem; }
  h1 { font-size: 1.1rem; margin: 0 0 .25rem; }
  .root { opacity: .7; margin: 0 0 1.25rem; word-break: break-all; }
  form { display: grid; gap: .5rem; max-width: 46rem; }
  label { display: grid; gap: .2rem; }
  input { font: inherit; padding: .35rem .5rem; }
  .actions { display: flex; gap: .5rem; flex-wrap: wrap; margin: 1rem 0; }
  button { font: inherit; padding: .4rem .9rem; cursor: pointer; }
  button[disabled] { cursor: not-allowed; opacity: .45; }
  pre { border: 1px solid currentColor; padding: .75rem; overflow-x: auto; max-width: 60rem; }
  .phase { font-weight: 700; }
  .refused { color: #b3261e; }
  footer { margin-top: 2rem; opacity: .7; max-width: 46rem; }
</style>
</head>
<body>
<h1>SceneAxi inspector</h1>
<p class="root">Serving <code>${root}</code> — local authoring only, loopback only.</p>

<form id="edit">
  <label>Document path (relative to the project root)
    <input id="documentPath" value="scene.json" required />
  </label>
  <label>JSON Pointer
    <input id="jsonPointer" value="/data/entities/0/x" required />
  </label>
  <label>New value (JSON)
    <input id="newValue" value="42" required />
  </label>
  <div class="actions">
    <button type="submit" id="propose">Propose</button>
    <button type="button" id="accept" disabled>Accept</button>
    <button type="button" id="reject" disabled>Reject</button>
    <button type="button" id="recover" hidden>Resolve pending apply</button>
  </div>
</form>

<p>Phase: <span class="phase" id="phase">idle</span> <span id="note"></span></p>
<pre id="diff">No proposal yet. Propose an edit to review its diff before anything is written.</pre>

<footer>
  Nothing is written until you accept. This page is a protocol client of
  <code>@sceneaxi/authoring-core</code>; the same operation through the CLI
  produces byte-identical documents.
</footer>

<script>
const $ = (id) => document.getElementById(id);
const state = { phase: "idle" };

function render(payload) {
  const snapshot = payload.snapshot ?? { phase: state.phase, renderedDiff: null };
  state.phase = snapshot.phase ?? state.phase;
  $("phase").textContent = state.phase;
  $("note").textContent = payload.ok ? "" : " — refused: " + payload.message;
  $("note").className = payload.ok ? "" : "refused";
  if (snapshot.renderedDiff) $("diff").textContent = snapshot.renderedDiff;
  const reviewing = state.phase === "reviewing";
  $("accept").disabled = !reviewing;
  $("reject").disabled = !reviewing;
  $("recover").hidden = snapshot.journalRecoveryPending !== true;
}

async function call(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  render(await response.json());
}

$("edit").addEventListener("submit", (event) => {
  event.preventDefault();
  let newValue;
  try {
    newValue = JSON.parse($("newValue").value);
  } catch (error) {
    $("note").textContent = " — new value must be valid JSON: " + error.message;
    $("note").className = "refused";
    return;
  }
  void call("/api/propose", {
    documentPath: $("documentPath").value,
    jsonPointer: $("jsonPointer").value,
    newValue,
  });
});
$("accept").addEventListener("click", () => void call("/api/accept", {}));
$("reject").addEventListener("click", () => void call("/api/reject", {}));
$("recover").addEventListener("click", () => void call("/api/recover", {}));
void call("/api/state");
</script>
</body>
</html>
`;
}
