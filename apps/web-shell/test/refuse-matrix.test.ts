/**
 * Every named refusal of the startable web shell is reachable (sceneaxi#120).
 *
 * A refusal registry is only fail-closed if each entry can actually be produced;
 * an unreachable one is documentation. Adding a `WEB_SHELL_REFUSALS` entry means
 * adding its case here, exactly as `tests/e2e/auth-credits-refuse-matrix.test.ts`
 * requires of the billing plane.
 */
import { mkdirSync, mkdtempSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDocument,
  writeDocumentFile,
  type JsonObject,
} from "@sceneaxi/authoring-core";
import {
  DEFAULT_HOST,
  MAX_REQUEST_BODY_BYTES,
  WEB_SHELL_REFUSALS,
  WebShellExit,
  createInspectorApp,
  main,
  parseDevServerArgs,
  startInspectorDevServer,
  type InspectorDevServer,
  type WebShellRefusal,
} from "@sceneaxi/web-shell";

function fixtureDir(): string {
  const dir = join(mkdtempSync(join(tmpdir(), "sceneaxi-web-shell-refuse-")), "root");
  mkdirSync(dir);
  return dir;
}

function writeScene(dir: string, name: string, data: JsonObject): void {
  const result = writeDocumentFile(
    join(dir, name),
    createDocument({ id: name.replace(/\.json$/, ""), data }),
    { cwd: dir },
  );
  expect(result.ok).toBe(true);
}

function project() {
  const dir = fixtureDir();
  writeScene(dir, "scene.json", { entities: [{ id: "hero", x: 1 }] });
  return { dir, app: createInspectorApp({ projectRoot: dir }) };
}

function reasonOf(response: { body: string }): string {
  return (JSON.parse(response.body) as { reason?: string }).reason ?? "";
}

const EDIT = {
  documentPath: "scene.json",
  jsonPointer: "/data/entities/0/x",
  newValue: 3,
} as const;

async function serveHeldProject(): Promise<InspectorDevServer> {
  const { dir } = project();
  const server = await startInspectorDevServer({
    host: DEFAULT_HOST,
    port: 0,
    projectRoot: dir,
  });
  holding.push(server);
  return server;
}

function rawRequestReason(
  server: InspectorDevServer,
  headers: Readonly<Record<string, string>>,
): Promise<string> {
  return new Promise((resolveReason, rejectReason) => {
    const outgoing = request(
      {
        hostname: server.host,
        port: server.port,
        method: "POST",
        path: "/api/accept",
        headers,
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.on("end", () => {
          resolveReason(
            reasonOf({ body: Buffer.concat(chunks).toString("utf8") }),
          );
        });
      },
    );
    outgoing.on("error", rejectReason);
    outgoing.end();
  });
}

/** Run `build` with the identity environment replaced, then restore it exactly. */
function withEnv<T>(
  overrides: Readonly<Record<string, string | undefined>>,
  build: () => T,
): T {
  const saved = Object.keys(overrides).map(
    (name) => [name, process.env[name]] as const,
  );
  const restore = (entries: ReadonlyArray<readonly [string, string | undefined]>) => {
    for (const [name, value] of entries) {
      if (value === undefined) Reflect.deleteProperty(process.env, name);
      else process.env[name] = value;
    }
  };
  restore(Object.entries(overrides));
  try {
    return build();
  } finally {
    restore(saved);
  }
}

/**
 * One producer per reason. Async because the two launch-side reasons that need a
 * real bind cannot be produced any other way.
 */
const PRODUCERS: Readonly<Record<WebShellRefusal, () => Promise<string>>> = {
  [WEB_SHELL_REFUSALS.routeUnknown]: async () =>
    reasonOf(project().app.handle({ method: "GET", url: "/api/nope" })),

  [WEB_SHELL_REFUSALS.methodNotAllowed]: async () =>
    reasonOf(project().app.handle({ method: "PUT", url: "/api/state" })),

  [WEB_SHELL_REFUSALS.requestBodyNotJson]: async () =>
    reasonOf(project().app.handle({ method: "POST", url: "/api/propose", body: "{" })),

  [WEB_SHELL_REFUSALS.requestBodyTooLarge]: async () =>
    reasonOf(
      project().app.handle({
        method: "POST",
        url: "/api/propose",
        body: "x".repeat(MAX_REQUEST_BODY_BYTES + 1),
      }),
    ),

  [WEB_SHELL_REFUSALS.requestHostInvalid]: async () => {
    const server = await serveHeldProject();
    return rawRequestReason(server, { host: "attacker.example" });
  },

  [WEB_SHELL_REFUSALS.requestOriginInvalid]: async () => {
    const server = await serveHeldProject();
    return rawRequestReason(server, {
      host: new URL(server.url).host,
      origin: "https://attacker.example",
    });
  },

  [WEB_SHELL_REFUSALS.reviewTokenInvalid]: async () =>
    reasonOf(
      project().app.handle({
        method: "POST",
        url: "/api/accept",
        body: "{}",
      }),
    ),

  [WEB_SHELL_REFUSALS.editFieldInvalid]: async () =>
    reasonOf(
      project().app.handle({
        method: "POST",
        url: "/api/propose",
        body: JSON.stringify({ jsonPointer: "/data", newValue: 1 }),
      }),
    ),

  [WEB_SHELL_REFUSALS.documentOutsideProjectRoot]: async () => {
    const { dir, app } = project();
    writeScene(dirname(dir), "outside.json", { entities: [] });
    return reasonOf(
      app.handle({
        method: "POST",
        url: "/api/propose",
        body: JSON.stringify({ ...EDIT, documentPath: "../outside.json" }),
      }),
    );
  },

  [WEB_SHELL_REFUSALS.documentUnreadable]: async () =>
    reasonOf(
      project().app.handle({ method: "GET", url: "/api/document?path=absent.json" }),
    ),

  [WEB_SHELL_REFUSALS.inspectorRefused]: async () =>
    reasonOf(
      project().app.handle({
        method: "POST",
        url: "/api/propose",
        body: JSON.stringify({
          ...EDIT,
          jsonPointer: "/data/entities/0/missing/deeper",
        }),
      }),
    ),

  [WEB_SHELL_REFUSALS.argumentInvalid]: async () => {
    const parsed = parseDevServerArgs(["--frobnicate"]);
    return parsed.ok ? "" : parsed.reason;
  },

  [WEB_SHELL_REFUSALS.projectRootUnusable]: async () => {
    const parsed = parseDevServerArgs(["--cwd", join(fixtureDir(), "nowhere")]);
    return parsed.ok ? "" : parsed.reason;
  },

  [WEB_SHELL_REFUSALS.hostNotLoopback]: async () => {
    const parsed = parseDevServerArgs(["--host", "0.0.0.0"]);
    return parsed.ok ? "" : parsed.reason;
  },

  [WEB_SHELL_REFUSALS.handlerFailed]: async () => {
    // An injected session that throws stands in for any unexpected failure
    // while routing: the surface must answer, not die.
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [] });
    const app = createInspectorApp({
      projectRoot: dir,
      session: {
        snapshot: () => {
          throw new Error("boom");
        },
        proposeEdit: () => {
          throw new Error("boom");
        },
        accept: () => {
          throw new Error("boom");
        },
        reject: () => {
          throw new Error("boom");
        },
        refreshRecovery: () => {
          throw new Error("boom");
        },
      },
    });
    const response = app.handle({ method: "GET", url: "/api/state" });
    expect(response.status).toBe(500);
    return reasonOf(response);
  },

  [WEB_SHELL_REFUSALS.assistantUnavailable]: async () => {
    // A plural admin spelling is refused by the identity package itself, which
    // is the reachable instance of "the panel could not be wired". The route
    // must say so rather than report it as an unexpected throw.
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [] });
    const app = withEnv({ SCENEAXI_ADMIN_EMAILS: "one@example.test" }, () =>
      createInspectorApp({ projectRoot: dir }),
    );
    const response = await app.handleAsync({
      method: "POST",
      url: "/api/assistant",
      body: JSON.stringify({ prompt: "hello" }),
    });
    expect(response.status).toBe(503);
    return reasonOf(response);
  },

  [WEB_SHELL_REFUSALS.listenFailed]: async () => {
    // A port already bound is the reachable instance of a failed bind.
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [] });
    const held = await startInspectorDevServer({
      host: DEFAULT_HOST,
      port: 0,
      projectRoot: dir,
    });
    holding.push(held);

    const stderr: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    const previousExitCode = process.exitCode;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    try {
      const code = await main([
        "--host",
        DEFAULT_HOST,
        "--port",
        String(held.port),
        "--cwd",
        dir,
      ]);
      expect(code).toBe(WebShellExit.ERROR);
    } finally {
      process.stderr.write = write;
      // `main` sets process.exitCode on refusal; leaving it set would fail the
      // whole vitest run on a passing assertion.
      process.exitCode = previousExitCode;
    }
    return /refused: ([\w-]+)/.exec(stderr.join(""))?.[1] ?? "";
  },
};

const holding: InspectorDevServer[] = [];

afterEach(async () => {
  while (holding.length > 0) await holding.pop()?.close();
});

describe("web-shell refuse matrix", () => {
  it("covers every declared refusal reason", () => {
    expect(Object.keys(PRODUCERS).sort()).toEqual(
      Object.values(WEB_SHELL_REFUSALS).slice().sort(),
    );
  });

  for (const [reason, produce] of Object.entries(PRODUCERS)) {
    it(`${reason} is reachable`, async () => {
      expect(await produce()).toBe(reason);
    });
  }
});
