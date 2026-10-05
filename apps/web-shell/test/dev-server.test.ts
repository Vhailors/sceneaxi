/**
 * The dev command that starts the web shell (sceneaxi#120).
 *
 * Argument parsing is pure and asserted directly; the socket half is asserted
 * against a real loopback server on an ephemeral port, which is the cheapest
 * honest proof that "startable" is not just an exported function.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { Window } from "happy-dom";
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
  DEFAULT_PORT,
  LOOPBACK_HOSTS,
  USAGE_LINES,
  WEB_SHELL_REFUSALS,
  WebShellExit,
  parseDevServerArgs,
  serverUrl,
  startInspectorDevServer,
  startupLines,
  type InspectorDevServer,
} from "@sceneaxi/web-shell";

const fixtureRoots: string[] = [];

function fixtureDir(): string {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-web-shell-serve-"));
  fixtureRoots.push(root);
  const dir = join(root, "root");
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

const running: InspectorDevServer[] = [];

async function serve(projectRoot: string): Promise<InspectorDevServer> {
  const server = await startInspectorDevServer({
    host: DEFAULT_HOST,
    port: 0,
    projectRoot,
  });
  running.push(server);
  return server;
}

function rawRequest(
  server: InspectorDevServer,
  options: {
    readonly method: string;
    readonly path: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly body?: string;
  },
): Promise<{ readonly status: number; readonly body: string }> {
  return new Promise((resolveResponse, rejectResponse) => {
    const outgoing = request(
      {
        hostname: server.host,
        port: server.port,
        method: options.method,
        path: options.path,
        headers: options.headers,
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.on("end", () => {
          resolveResponse({
            status: incoming.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    outgoing.on("error", rejectResponse);
    if (options.body !== undefined) outgoing.write(options.body);
    outgoing.end();
  });
}

afterEach(async () => {
  while (running.length > 0) await running.pop()?.close();
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("dev command arguments", () => {
  it("defaults to loopback, the default port, and the current directory", () => {
    const parsed = parseDevServerArgs([]);
    expect(parsed.ok && parsed.mode).toBe("serve");
    if (!parsed.ok || parsed.mode !== "serve") return;
    expect(parsed.options.host).toBe(DEFAULT_HOST);
    expect(parsed.options.port).toBe(DEFAULT_PORT);
    expect(parsed.options.projectRoot.length).toBeGreaterThan(0);
  });

  it("accepts every loopback host, in both flag spellings", () => {
    for (const host of LOOPBACK_HOSTS) {
      for (const argv of [["--host", host], [`--host=${host}`]]) {
        const parsed = parseDevServerArgs(argv);
        expect(parsed.ok && parsed.mode === "serve" && parsed.options.host, host).toBe(
          host,
        );
      }
    }
  });

  it("refuses a non-loopback host instead of quietly rebinding it", () => {
    for (const host of ["0.0.0.0", "::", "192.168.1.20", "127.0.0.1.example.com"]) {
      const parsed = parseDevServerArgs(["--host", host]);
      expect(parsed.ok, host).toBe(false);
      if (parsed.ok) continue;
      expect(parsed.reason).toBe(WEB_SHELL_REFUSALS.hostNotLoopback);
      expect(parsed.exitCode).toBe(WebShellExit.USAGE);
      expect(parsed.message).toContain("authenticates nobody");
    }
  });

  it("refuses unknown flags, bare arguments, and valueless flags", () => {
    for (const argv of [
      ["--frobnicate"],
      ["serve"],
      ["--port"],
      ["--cwd="],
      ["--port", "not-a-number"],
      ["--port", "70000"],
    ]) {
      const parsed = parseDevServerArgs(argv);
      expect(parsed.ok, argv.join(" ")).toBe(false);
      if (parsed.ok) continue;
      expect(parsed.reason).toBe(WEB_SHELL_REFUSALS.argumentInvalid);
      expect(parsed.exitCode).toBe(WebShellExit.USAGE);
    }
  });

  it("refuses a project root that is absent or not a directory", () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [] });

    const absent = parseDevServerArgs(["--cwd", join(dir, "nowhere")]);
    expect(absent.ok).toBe(false);
    if (!absent.ok) {
      expect(absent.reason).toBe(WEB_SHELL_REFUSALS.projectRootUnusable);
    }

    const file = parseDevServerArgs(["--cwd", join(dir, "scene.json")]);
    expect(file.ok).toBe(false);
    if (!file.ok) {
      expect(file.reason).toBe(WEB_SHELL_REFUSALS.projectRootUnusable);
    }
  });

  it("prints usage that names every served route", () => {
    const parsed = parseDevServerArgs(["--help"]);
    expect(parsed.ok && parsed.mode).toBe("help");
    const usage = USAGE_LINES.join("\n");
    expect(usage).toContain("sceneaxi-web-shell");
    expect(usage).toContain("POST /api/propose");
    expect(usage).toContain("loopback");
  });

  it("brackets an IPv6 host into a browsable URL", () => {
    expect(serverUrl("::1", 5180)).toBe("http://[::1]:5180/");
    expect(serverUrl("127.0.0.1", 5180)).toBe("http://127.0.0.1:5180/");
  });
});

describe("the started server serves the inspector", () => {
  it("binds loopback and reports the port it actually got", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [{ id: "hero", x: 1 }] });
    const server = await serve(dir);

    expect(server.port).toBeGreaterThan(0);
    expect(server.url).toBe(`http://${DEFAULT_HOST}:${server.port}/`);
    expect(startupLines(server).join("\n")).toContain(server.url);

    const page = await fetch(server.url);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(page.headers.get("cache-control")).toBe("no-store");
    expect(await page.text()).toContain("SceneAxi inspector");
  });

  it("authorizes only exact static UTF8 script/style hashes independent of escaped root", async () => {
    const policies: string[] = [];
    for (const name of ["plain", "<&script>é"]) {
      const dir = join(fixtureDir(), name);
      mkdirSync(dir);
      const server = await serve(dir);
      const response = await fetch(server.url);
      const html = await response.text();
      const policy = response.headers.get("content-security-policy") ?? "";
      policies.push(policy);
      for (const tag of ["script", "style"]) {
        const blocks = [...html.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))];
        expect(blocks).toHaveLength(1);
        const bytes = blocks[0]?.[1];
        if (bytes === undefined) throw new Error("Missing trusted chrome bytes");
        const hash = createHash("sha256").update(bytes, "utf8").digest("base64");
        expect(policy.split("; ").find((rule) => rule.startsWith(`${tag}-src `)))
          .toBe(`${tag}-src 'sha256-${hash}'`);
        for (const changed of [bytes + " ", bytes.replace(/\n/, "\r\n"), bytes + "/* injected */"]) {
          expect(policy).not.toContain(createHash("sha256").update(changed, "utf8").digest("base64"));
        }
      }
      for (const rule of ["default-src 'none'", "connect-src 'self'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'", "script-src-attr 'none'", "style-src-attr 'none'"]) expect(policy).toContain(rule);
      for (const allowance of ["unsafe-inline", "unsafe-eval", "https:", "http:", "*"]) expect(policy).not.toContain(allowance);
      const head = await fetch(server.url, { method: "HEAD" });
      expect(head.headers.get("content-security-policy")).toBe(policy);
      expect(await head.text()).toBe("");
    }
    expect(policies[0]).toBe(policies[1]);
  });

  for (const mutation of [
    { name: "script whitespace", apply: (html: string) => html.replace("<script>", "<script> ") },
    { name: "style byte", apply: (html: string) => html.replace("<style>", "<style> ") },
    { name: "extra script", apply: (html: string) => html.replace("</body>", "<script>throw 1</script></body>") },
    { name: "extra style", apply: (html: string) => html.replace("</head>", "<style>body{display:none}</style></head>") },
    { name: "external script", apply: (html: string) => html.replace("</body>", '<script src="https://invalid.example/"></script></body>') },
    { name: "event handler", apply: (html: string) => html.replace("<body>", '<body onload="throw 1">') },
  ]) it(`refuses changed chrome before delivery: ${mutation.name}`, async () => {
    const server = await serve(fixtureDir());
    const trusted = await fetch(server.url);
    const policy = trusted.headers.get("content-security-policy");
    const html = await trusted.text();
    server.app.handleAsync = async () => ({ status: 200, contentType: "text/html; charset=utf-8", body: mutation.apply(html) });
    const refused = await fetch(server.url);
    expect(refused.status).toBe(500);
    expect(refused.headers.get("content-type")).toContain("application/json");
    expect(refused.headers.get("content-security-policy")).toBe(policy);
    expect(await refused.json()).toMatchObject({ ok: false, reason: "WEB_SHELL_CHROME_INTEGRITY_INVALID" });
  });

  it("does not bypass chrome refusal with MIME case or optional whitespace", async () => {
    const server = await serve(fixtureDir());
    const html = await (await fetch(server.url)).text();
    for (const contentType of ["TEXT/HTML; charset=utf-8", "text/html ; charset=utf-8"]) {
      server.app.handleAsync = async () => ({ status: 200, contentType, body: html + "<script>throw 1</script>" });
      const refused = await fetch(server.url);
      expect(refused.status).toBe(500);
      expect(await refused.json()).toMatchObject({ ok: false, reason: "WEB_SHELL_CHROME_INTEGRITY_INVALID" });
    }
  });

  it("keeps the hash-authorized served inspector interactive with invalid/reject focus return and no write", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [{ id: "hero", x: 1 }] });
    const before = readFileSync(join(dir, "scene.json"));
    const server = await serve(dir);
    const response = await fetch(server.url);
    const html = await response.text();
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
    if (script === undefined) throw new Error("Missing inspector script");
    expect(response.headers.get("content-security-policy")).toContain(
      `'sha256-${createHash("sha256").update(script, "utf8").digest("base64")}'`,
    );
    // Interaction only: Happy DOM does NOT enforce browser CSP or prove geometry.
    const window = new Window({ url: server.url, settings: { enableJavaScriptEvaluation: true } });
    try {
      window.fetch = async (url, options) => {
        const result = await fetch(new URL(String(url), server.url), {
          method: options?.method ?? "GET",
          ...(typeof options?.body === "string" ? { body: options.body } : {}),
        });
        return new window.Response(await result.text(), { status: result.status });
      };
      window.document.write(html);
      await window.happyDOM.waitUntilComplete();
      await expect.poll(() => window.document.getElementById("edit")?.getAttribute("aria-busy")).toBe("false");
      const field = window.document.getElementById("newValue");
      const propose = window.document.getElementById("propose");
      const form = window.document.getElementById("edit");
      const reject = window.document.getElementById("reject");
      if (!(field instanceof window.HTMLInputElement) || !(propose instanceof window.HTMLButtonElement) ||
          !(reject instanceof window.HTMLButtonElement) || form === null) throw new Error("Missing controls");
      field.value = "{broken";
      propose.focus();
      form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await window.happyDOM.waitUntilComplete();
      expect(window.document.activeElement).toBe(field);
      expect(field.getAttribute("aria-invalid")).toBe("true");
      field.value = "12";
      field.dispatchEvent(new window.Event("input", { bubbles: true }));
      propose.focus();
      form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await window.happyDOM.waitUntilComplete();
      await expect.poll(() => window.document.getElementById("phase")?.textContent).toBe("reviewing");
      expect(window.document.getElementById("diff")?.textContent).toContain('"x": 12');
      reject.focus();
      reject.click();
      await window.happyDOM.waitUntilComplete();
      await expect.poll(() => window.document.getElementById("phase")?.textContent).toBe("rejected");
      expect(window.document.activeElement).toBe(propose);
      expect(readFileSync(join(dir, "scene.json"))).toEqual(before);
    } finally { window.close(); }
  });

  it("denies framing on every response, page and API alike", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [] });
    const server = await serve(dir);

    for (const target of [server.url, `${server.url}api/state`]) {
      const response = await fetch(target);
      await response.text();
      expect(response.headers.get("x-frame-options"), target).toBe("DENY");
      expect(response.headers.get("content-security-policy"), target).toContain(
        "frame-ancestors 'none'",
      );
      expect(response.headers.get("x-content-type-options"), target).toBe("nosniff");
    }
  });

  it("refuses a non-loopback host at the exported server boundary", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [] });

    await expect(
      startInspectorDevServer({
        host: "0.0.0.0",
        port: 0,
        projectRoot: dir,
      }),
    ).rejects.toThrow("serves loopback only");
  });

  it("drives propose → rendered diff → accept over the socket", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [{ id: "hero", x: 1 }] });
    const server = await serve(dir);
    const before = readFileSync(join(dir, "scene.json"));

    const proposed = await fetch(`${server.url}api/propose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documentPath: "scene.json",
        jsonPointer: "/data/entities/0/x",
        newValue: 12,
      }),
    });
    expect(proposed.status).toBe(200);
    const review = (await proposed.json()) as {
      reviewToken: string;
      snapshot: { phase: string; renderedDiff: string };
    };
    expect(review.snapshot.phase).toBe("reviewing");
    expect(review.snapshot.renderedDiff).toContain('"x": 12');
    expect(readFileSync(join(dir, "scene.json")).equals(before)).toBe(true);

    const accepted = await fetch(`${server.url}api/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reviewToken: review.reviewToken }),
    });
    expect(accepted.status).toBe(200);
    expect(
      ((await accepted.json()) as { snapshot: { phase: string } }).snapshot.phase,
    ).toBe("applied");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toContain('"x": 12');
  });

  it("rejects an unexpected Host before serving the inspector", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [{ id: "hero", x: 1 }] });
    const server = await serve(dir);

    const response = await rawRequest(server, {
      method: "GET",
      path: "/",
      headers: { host: "attacker.example" },
    });

    expect(response.status).toBe(403);
    expect((JSON.parse(response.body) as { reason: string }).reason).toBe(
      WEB_SHELL_REFUSALS.requestHostInvalid,
    );
  });

  it("rejects a cross-origin accept without changing the pending proposal", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [{ id: "hero", x: 1 }] });
    const server = await serve(dir);
    const before = readFileSync(join(dir, "scene.json"));

    const proposed = await fetch(`${server.url}api/propose`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: new URL(server.url).origin,
      },
      body: JSON.stringify({
        documentPath: "scene.json",
        jsonPointer: "/data/entities/0/x",
        newValue: 12,
      }),
    });
    expect(proposed.status).toBe(200);

    const refused = await fetch(`${server.url}api/accept`, {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { reason: string }).reason).toBe(
      WEB_SHELL_REFUSALS.requestOriginInvalid,
    );

    const state = await fetch(`${server.url}api/state`);
    expect(
      ((await state.json()) as { snapshot: { phase: string } }).snapshot.phase,
    ).toBe("reviewing");
    expect(readFileSync(join(dir, "scene.json")).equals(before)).toBe(true);
  });

  it("refuses an escaping document path over the socket too", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [{ x: 1 }] });
    writeScene(dirname(dir), "outside.json", { entities: [{ x: 1 }] });
    const server = await serve(dir);

    const response = await fetch(`${server.url}api/propose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documentPath: "../outside.json",
        jsonPointer: "/data/entities/0/x",
        newValue: 2,
      }),
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { reason: string }).reason).toBe(
      WEB_SHELL_REFUSALS.documentOutsideProjectRoot,
    );
  });

  it("stops reading an oversized body instead of buffering it", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [{ x: 1 }] });
    const server = await serve(dir);

    const response = await fetch(`${server.url}api/propose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(256 * 1024),
    });
    expect(response.status).toBe(413);
    expect(((await response.json()) as { reason: string }).reason).toBe(
      WEB_SHELL_REFUSALS.requestBodyTooLarge,
    );
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toContain('"x": 1');
  });

  it("serves a HEAD request without a body", async () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", { entities: [] });
    const server = await serve(dir);

    const response = await fetch(server.url, { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});
