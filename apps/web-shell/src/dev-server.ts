/**
 * `sceneaxi-web-shell` — the dev command that starts the web shell and serves
 * the inspector (sceneaxi#120).
 *
 * The only module in this package that owns a socket. Everything it serves is
 * `inspector-app.ts`, which is everything `createInspectorSession` already did,
 * so "startable" adds a transport and no authoring behaviour.
 *
 * Fail-closed at launch, not only per request:
 *
 * - **Loopback only.** The inspector authenticates nobody and writes files the
 *   process can write, so binding it to a routable interface would hand
 *   unauthenticated write access to the network. A non-loopback `--host`
 *   refuses; it is not silently rewritten.
 * - **One served project root.** `--cwd` must be an existing directory, and it
 *   bounds every document path (`resolveInsideProjectRoot`).
 * - **Unknown flags refuse.** Usage exit `2`, matching the CLI protocol's map.
 *
 * Local development only: no hosting, no deployment, no domain, no TLS
 * termination, no process manager. The deployable web tier is `sites/`
 * (ADR 0018) and is not this.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { canonicalPath } from "@sceneaxi/authoring-core";
import {
  createInspectorApp,
  INSPECTOR_ACTIONS,
  MAX_REQUEST_BODY_BYTES,
  WEB_SHELL_APP,
  WEB_SHELL_REFUSALS,
  type InspectorApp,
  type WebShellRefusal,
} from "./inspector-app.js";

/** Exit codes, matching the CLI protocol's map so scripts branch identically. */
export const WebShellExit = {
  OK: 0,
  ERROR: 1,
  USAGE: 2,
} as const;

export type WebShellExitCode = (typeof WebShellExit)[keyof typeof WebShellExit];

/**
 * Hosts this server will bind. Exact addresses, not a prefix test: `127.0.0.1`
 * being loopback says nothing about a name that merely starts with it.
 */
export const LOOPBACK_HOSTS: readonly string[] = Object.freeze([
  "127.0.0.1",
  "::1",
  "localhost",
]);

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 5180;

export type DevServerOptions = {
  readonly host: string;
  /** `0` asks the OS for an ephemeral port; the bound port is reported back. */
  readonly port: number;
  /** Canonical served project root. */
  readonly projectRoot: string;
};

export type DevServerArgsOk = {
  readonly ok: true;
  readonly mode: "serve";
  readonly options: DevServerOptions;
};

export type DevServerArgsHelp = {
  readonly ok: true;
  readonly mode: "help";
  readonly lines: readonly string[];
};

export type DevServerArgsRefusal = {
  readonly ok: false;
  readonly exitCode: WebShellExitCode;
  readonly reason: WebShellRefusal;
  readonly message: string;
  readonly lines: readonly string[];
};

export type DevServerArgsResult =
  | DevServerArgsOk
  | DevServerArgsHelp
  | DevServerArgsRefusal;

export const USAGE_LINES: readonly string[] = Object.freeze([
  "Usage: sceneaxi-web-shell [--host <loopback>] [--port <n>] [--cwd <dir>]",
  "",
  "Starts the local authoring inspector and serves it over HTTP.",
  "",
  "Flags:",
  `  --host <addr>  loopback address to bind (default ${DEFAULT_HOST}; allowed: ${LOOPBACK_HOSTS.join(", ")})`,
  `  --port <n>     port to bind (default ${DEFAULT_PORT}; 0 picks a free port)`,
  "  --cwd <dir>    project root to serve (default: the current directory)",
  "  --help         print this usage",
  "",
  "Routes:",
  ...Object.values(INSPECTOR_ACTIONS).map(
    (route) => `  ${route.method.padEnd(4)} ${route.path.padEnd(14)} ${route.description}`,
  ),
  "",
  "Loopback only, and nothing is written until a proposal is accepted.",
]);

const VALUED_FLAGS: ReadonlySet<string> = new Set(["--host", "--port", "--cwd"]);

/**
 * Parse launch arguments. Pure, so the refusal table is gate-tested without
 * binding a socket.
 */
export function parseDevServerArgs(
  argv: readonly string[],
): DevServerArgsResult {
  const flags = new Map<string, string>();

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === undefined) continue;
    if (token === "--help" || token === "-h") {
      return { ok: true, mode: "help", lines: USAGE_LINES };
    }
    if (!token.startsWith("--")) {
      return argRefusal(`Unexpected argument: ${token}`);
    }
    const eq = token.indexOf("=");
    const name = eq < 0 ? token : token.slice(0, eq);
    if (!VALUED_FLAGS.has(name)) {
      return argRefusal(`Unknown flag: ${name}`);
    }
    let value: string | undefined;
    if (eq >= 0) {
      value = token.slice(eq + 1);
    } else {
      value = argv[i + 1];
      i += 1;
    }
    if (value === undefined || value.length === 0) {
      return argRefusal(`${name} requires a value`);
    }
    flags.set(name, value);
  }

  const host = flags.get("--host") ?? DEFAULT_HOST;
  if (!LOOPBACK_HOSTS.includes(host)) {
    return {
      ok: false,
      exitCode: WebShellExit.USAGE,
      reason: WEB_SHELL_REFUSALS.hostNotLoopback,
      message:
        `Refusing to bind ${host}: the inspector authenticates nobody and writes ` +
        `files, so it serves loopback only (${LOOPBACK_HOSTS.join(", ")}).`,
      lines: USAGE_LINES,
    };
  }

  const rawPort = flags.get("--port");
  let port = DEFAULT_PORT;
  if (rawPort !== undefined) {
    if (!/^\d+$/.test(rawPort)) {
      return argRefusal(`--port must be a whole number: ${rawPort}`);
    }
    port = Number.parseInt(rawPort, 10);
    if (port > 65535) {
      return argRefusal(`--port must be between 0 and 65535: ${rawPort}`);
    }
  }

  const rawCwd = flags.get("--cwd");
  const requested = resolve(rawCwd ?? ".");
  try {
    if (!statSync(requested).isDirectory()) {
      return {
        ok: false,
        exitCode: WebShellExit.USAGE,
        reason: WEB_SHELL_REFUSALS.projectRootUnusable,
        message: `--cwd is not a directory: ${requested}`,
        lines: USAGE_LINES,
      };
    }
  } catch {
    return {
      ok: false,
      exitCode: WebShellExit.USAGE,
      reason: WEB_SHELL_REFUSALS.projectRootUnusable,
      message: `--cwd does not exist: ${requested}`,
      lines: USAGE_LINES,
    };
  }

  return {
    ok: true,
    mode: "serve",
    options: { host, port, projectRoot: canonicalPath(requested) },
  };
}

function argRefusal(message: string): DevServerArgsRefusal {
  return {
    ok: false,
    exitCode: WebShellExit.USAGE,
    reason: WEB_SHELL_REFUSALS.argumentInvalid,
    message,
    lines: USAGE_LINES,
  };
}

export type InspectorDevServer = {
  readonly app: InspectorApp;
  readonly host: string;
  /** The port actually bound (resolved when `--port 0` was requested). */
  readonly port: number;
  readonly url: string;
  readonly projectRoot: string;
  close(): Promise<void>;
};

/** Format a browsable origin, bracketing IPv6 as URLs require. */
export function serverUrl(host: string, port: number): string {
  const authority = host.includes(":") ? `[${host}]` : host;
  return `http://${authority}:${port}/`;
}

/**
 * Read a request body, refusing rather than buffering past the cap.
 *
 * The app checks the same limit, but only this side can stop buffering: a served
 * surface must not retain an unbounded stream just to reject it afterwards.
 */
function readBody(request: IncomingMessage): Promise<string | null> {
  return new Promise((resolveBody) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    request.on("data", (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_REQUEST_BODY_BYTES) {
        settled = true;
        chunks.length = 0;
        request.resume();
        resolveBody(null);
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (settled) return;
      settled = true;
      resolveBody(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", () => {
      if (settled) return;
      settled = true;
      resolveBody(null);
    });
  });
}

function writeResponse(
  response: ServerResponse,
  status: number,
  contentType: string,
  body: string,
  headOnly: boolean,
  closeConnection = false,
): void {
  if (closeConnection) response.shouldKeepAlive = false;
  response.writeHead(status, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(body, "utf8"),
    // A local authoring surface must never be served from a stale cache: the
    // diff on screen has to be the diff the session is holding.
    "cache-control": "no-store",
    ...(closeConnection ? { connection: "close" } : {}),
  });
  response.end(headOnly ? undefined : body);
}

function isResolvedLoopbackAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("127.") ||
    normalized.startsWith("::ffff:127.")
  );
}

function requestBoundaryRefusal(
  request: IncomingMessage,
  method: string,
  expectedOrigin: string,
): { readonly reason: WebShellRefusal; readonly message: string } | null {
  const expectedHost = new URL(expectedOrigin).host;
  const host = request.headers.host;
  if (host === undefined || host.toLowerCase() !== expectedHost.toLowerCase()) {
    return {
      reason: WEB_SHELL_REFUSALS.requestHostInvalid,
      message: `Request Host must match the bound inspector authority: ${expectedHost}.`,
    };
  }

  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const origin = request.headers.origin;
  if (
    origin !== undefined &&
    origin.toLowerCase() !== expectedOrigin.toLowerCase()
  ) {
    return {
      reason: WEB_SHELL_REFUSALS.requestOriginInvalid,
      message: `Request Origin must match the inspector origin: ${expectedOrigin}.`,
    };
  }

  return null;
}

function requestBoundaryRefusalBody(
  reason: WebShellRefusal,
  message: string,
): string {
  return `${JSON.stringify(
    {
      app: WEB_SHELL_APP,
      ok: false,
      action: "unknown",
      reason,
      message,
    },
    null,
    2,
  )}\n`;
}

/**
 * Bind the inspector and start serving. Resolves once the socket is listening,
 * with the port the OS actually chose.
 */
export function startInspectorDevServer(
  options: DevServerOptions,
): Promise<InspectorDevServer> {
  if (!LOOPBACK_HOSTS.includes(options.host)) {
    return Promise.reject(
      new Error(
        `Refusing to bind ${options.host}: the inspector serves loopback only.`,
      ),
    );
  }

  const app = createInspectorApp({ projectRoot: options.projectRoot });

  const server: Server = createServer((request, response) => {
    const method = (request.method ?? "GET").toUpperCase();
    const url = request.url ?? "/";
    const headOnly = method === "HEAD";

    void (async () => {
      const address = server.address();
      const boundPort =
        typeof address === "object" && address !== null ? address.port : options.port;
      const expectedOrigin = new URL(serverUrl(options.host, boundPort)).origin;
      const boundaryRefusal = requestBoundaryRefusal(
        request,
        method,
        expectedOrigin,
      );
      if (boundaryRefusal !== null) {
        writeResponse(
          response,
          403,
          "application/json; charset=utf-8",
          requestBoundaryRefusalBody(
            boundaryRefusal.reason,
            boundaryRefusal.message,
          ),
          headOnly,
        );
        return;
      }

      let body: string | undefined;
      if (method === "POST" || method === "PUT" || method === "PATCH") {
        const read = await readBody(request);
        if (read === null) {
          writeResponse(
            response,
            413,
            "application/json; charset=utf-8",
            `${JSON.stringify(
              {
                app: WEB_SHELL_APP,
                ok: false,
                action: "unknown",
                reason: WEB_SHELL_REFUSALS.requestBodyTooLarge,
                message: `Request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes.`,
              },
              null,
              2,
            )}\n`,
            false,
            true,
          );
          return;
        }
        body = read;
      }

      const result = app.handle({
        method: headOnly ? "GET" : method,
        url,
        ...(body === undefined ? {} : { body }),
      });
      writeResponse(response, result.status, result.contentType, result.body, headOnly);
    })().catch(() => {
      // `app.handle` already turns a routing throw into a named refusal, so
      // reaching here means the response itself failed — a socket the client
      // dropped. Close it; never let it surface as an unhandled rejection,
      // which would end the dev server on a client's behalf.
      response.destroy();
    });
  });

  return new Promise((resolveServer, rejectServer) => {
    const onError = (error: Error): void => {
      server.removeListener("listening", onListening);
      rejectServer(error);
    };
    const onListening = (): void => {
      server.removeListener("error", onError);
      const address = server.address();
      if (
        typeof address !== "object" ||
        address === null ||
        !isResolvedLoopbackAddress(address.address)
      ) {
        const resolved =
          typeof address === "object" && address !== null
            ? address.address
            : String(address);
        server.close(() => {
          rejectServer(
            new Error(
              `Refusing resolved bind address ${resolved}: the inspector serves loopback only.`,
            ),
          );
        });
        server.closeAllConnections();
        return;
      }
      const port = address.port;
      resolveServer({
        app,
        host: options.host,
        port,
        url: serverUrl(options.host, port),
        projectRoot: options.projectRoot,
        close: () =>
          new Promise<void>((closed, failed) => {
            server.close((error) => (error ? failed(error) : closed()));
            server.closeAllConnections();
          }),
      });
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(options.port, options.host);
  });
}

/** The banner the dev command prints once the inspector is reachable. */
export function startupLines(server: InspectorDevServer): readonly string[] {
  return Object.freeze([
    `${WEB_SHELL_APP}: serving the inspector`,
    `  url:          ${server.url}`,
    `  project root: ${server.projectRoot}`,
    "  scope:        loopback only; nothing is written until a proposal is accepted",
    "Press Ctrl+C to stop.",
  ]);
}

/**
 * Process entry. Resolves with the exit code once the server stops, so the
 * binary awaits a real shutdown rather than calling `process.exit`.
 */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
): Promise<WebShellExitCode> {
  const parsed = parseDevServerArgs(argv);

  if (!parsed.ok) {
    process.stderr.write(
      `${[`refused: ${parsed.reason}`, `  ${parsed.message}`, "", ...parsed.lines].join("\n")}\n`,
    );
    process.exitCode = parsed.exitCode;
    return parsed.exitCode;
  }

  if (parsed.mode === "help") {
    process.stdout.write(`${parsed.lines.join("\n")}\n`);
    return WebShellExit.OK;
  }

  let server: InspectorDevServer;
  try {
    server = await startInspectorDevServer(parsed.options);
  } catch (error) {
    process.stderr.write(
      `refused: ${WEB_SHELL_REFUSALS.listenFailed}\n  ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    process.exitCode = WebShellExit.ERROR;
    return WebShellExit.ERROR;
  }

  process.stdout.write(`${startupLines(server).join("\n")}\n`);

  await new Promise<void>((stopped) => {
    let stopping = false;
    const stop = (): void => {
      if (stopping) return;
      stopping = true;
      void server.close().then(stopped, stopped);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });

  return WebShellExit.OK;
}
