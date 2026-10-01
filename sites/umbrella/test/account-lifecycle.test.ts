import { createServer as createTlsServer } from "node:https";
import { join } from "node:path";
import { tmpdir } from "node:os";
/** Real Better Auth + owned disposable PostgreSQL + HTTP socket; never production. */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createRecoveryContract } from "../src/provider/recovery-contract.js";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createBetterAuthHttpClient } from "../src/lib/provider-adapters.js";
import { createDeploymentPlaneHandles, bindProviderOrigin } from "../src/lib/identity-plane.js";
import { resolveAdminIdentity } from "@sceneaxi/auth";
import { ACCOUNT_LIFECYCLE_LIMITS, ACCOUNT_LIFECYCLE_POLICY, createAccountLifecycle } from "../src/provider/account-lifecycle.js";
import { createBetterAuthProviderHandler, createBetterAuthProviderRuntime, createProviderPool, ensureBetterAuthAdminBootstrap } from "../src/provider/better-auth-provider.js";

const EMAIL = ["identity-fixture", "example.invalid"].join("@");

const PASSWORD = ["Synthetic", "Identity", "42!"].join("");

const SECRET = "synthetic-only-identity-signing-material".padEnd(48, "x");

const CONTAINER = `sceneaxi-identity-fixture-${randomUUID()}`;

let ownedContainer = false;

let pool: Pool | undefined;

let server: Server | undefined;

let origin = "";

let handler: ReturnType<typeof createBetterAuthProviderHandler>;

let userId = "";

let token = "";

let providerSessionId = "";

type LifecycleRequestFields = { readonly password?: string; readonly confirm?: string; readonly email?: string; readonly surface?: string; readonly role?: string };

function isString<Value>(value: Value): value is Value & string { return typeof value === "string"; }

function isCallable<Value>(value: Value): value is Value & ((...args: never[]) => object) { return typeof value === "function"; }

function requestHeaders(source: import("node:http").IncomingHttpHeaders): Headers {
  const headers = new Headers();

  for (const [name, value] of Object.entries(source)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) { for (const entry of value) headers.append(name, entry); }
    else headers.set(name, value);
  }

  return headers;
}

function post(path: string, fields: LifecycleRequestFields = { password: PASSWORD }, headers: Record<string, string> = {}) {
  return fetch(`${origin}/api/auth/${path}`, {
    method: "POST", headers: { origin, "content-type": "application/json", authorization: `Bearer ${token}`, ...headers },
    body: JSON.stringify(fields), redirect: "manual",
  });
}

async function sql(text: string, values: unknown[] = []) {
  if (pool === undefined) throw new Error("fixture pool unavailable");

  return pool.query(text, values);
}

async function clearBudget() {
  await sql(`DELETE FROM better_auth_rate_limits WHERE "key" LIKE 'sceneaxi.lifecycle:%'`);
}

async function signIn() {
  // Independent synthetic scenarios must not spend one another's stock provider
  // sign-in window. Durable lifecycle budget assertions below remain untouched.
  await sql(`DELETE FROM better_auth_rate_limits WHERE "key" NOT LIKE 'sceneaxi.lifecycle:%'`);
  const admin = resolveAdminIdentity(Object.fromEntries([["SCENEAXI_ADMIN_EMAIL", EMAIL]]));

  if (!admin.ok) throw new Error("fixture admin resolution failed");

  const deployment = createDeploymentPlaneHandles({
    admin: admin.value,
    providers: {
      database: { query: async (text, values = []) => (await sql(text, [...values])).rows },
      betterAuth: createBetterAuthHttpClient({ origin, fetch: bindProviderOrigin(origin, (url, init) => fetch(url, init)) }),
    },
  });

  const grant = await deployment.identityPort?.signIn({ surface: "site", email: EMAIL, password: PASSWORD });
  expect(grant?.ok).toBe(true);

  if (!grant?.ok) throw new Error("fixture genuine sign-in failed");
  token = grant.value.sessionToken;
  userId = grant.value.principal.user.userId;
  providerSessionId = grant.value.principal.session.sessionId;
  expect(grant.value.principal.role.role).toBe("admin");
  expect(grant.value.principal.user.emailVerified).toBe(true);

  return { token, sessionId: providerSessionId };
}

beforeAll(async () => {
  execFileSync("docker", ["image", "inspect", "postgres:17-alpine"], { stdio: "ignore" });
  execFileSync("docker", ["run", "--pull=never", "--detach", "--name", CONTAINER,
    "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-e", "POSTGRES_DB=sceneaxi_identity_fixture",
    "-p", "127.0.0.1::5432", "postgres:17-alpine"], { stdio: "ignore" });
  ownedContainer = true;
  const port = Number(execFileSync("docker", ["port", CONTAINER, "5432/tcp"], { encoding: "utf8" }).trim().split(":").at(-1));
  expect(port).toBeGreaterThan(0);
  let ready = false;

  for (let attempt = 0; attempt < 100; attempt++) {
    try { execFileSync("docker", ["exec", CONTAINER, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], { stdio: "ignore" }); ready = true; break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }

  expect(ready).toBe(true);
  server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = [];

      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const method = request.method ?? "GET";

      const init: RequestInit = { method, headers: requestHeaders(request.headers) };

      if (method !== "GET" && method !== "HEAD") init.body = Buffer.concat(chunks);
      const target = new Request(`${origin}${request.url}`, init);

      const result = await handler(target);
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch { response.writeHead(500); response.end(); }
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (address === null || isString(address)) throw new Error("fixture socket unavailable");
  origin = `http://127.0.0.1:${address.port}`;

  const config = {
    databaseUrl: ["postgresql:", "", `postgres@127.0.0.1:${port}`, "sceneaxi_identity_fixture"].join("/"),
    origin, secret: SECRET, bootstrapEmail: EMAIL, bootstrapSecret: PASSWORD,
  };

  pool = createProviderPool(config);
  const directory = new URL("../../../db/migrations/", import.meta.url);

  for (const migration of (await readdir(fileURLToPath(directory))).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
    await pool.query(await readFile(new URL(migration, directory), "utf8"));
  }

  await ensureBetterAuthAdminBootstrap(pool, config);
  const runtime = createBetterAuthProviderRuntime({ config, database: pool, lifecycle: createAccountLifecycle(pool, config) });
  handler = createBetterAuthProviderHandler(() => ({ ok: true, value: runtime }));
  await signIn();
}, 60_000);

afterAll(async () => {
  if (server !== undefined) await new Promise<void>((resolve, reject) => server?.close((error) => error === undefined ? resolve() : reject(error)));

  try { await pool?.end(); }
  finally { if (ownedContainer) execFileSync("docker", ["rm", "--force", CONTAINER], { stdio: "ignore" }); }
});

describe.sequential("provider-owned lifecycle over real HTTP and PostgreSQL", () => {
  it("rejects missing/hostile/alias origins before genuine provider sign-in", async () => {
    for (const value of [undefined, "", "null", "https://hostile.example.invalid", "https://alias.example.invalid"]) {
      const headers = new Headers({ "content-type": "application/json" });

      if (value !== undefined) headers.set("origin", value);
      const response = await fetch(`${origin}/api/auth/sign-in/email`, { method: "POST", headers, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
      expect(response.status).toBe(403); expect(response.headers.get("set-cookie")).toBeNull(); expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("runs real browser sign-in, cookie session lookup, logout and replay against PostgreSQL", async () => {
    const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });

    try {
      const context = await browser.newContext(); const page = await context.newPage();
      await page.goto(`${origin}/api/auth/get-session`);

      const signedIn = await page.evaluate(async ({ email, password }) => {
        const response = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });

        return { status: response.status, cache: response.headers.get("cache-control") };
      }, { email: EMAIL, password: PASSWORD });

      expect(signedIn).toEqual({ status: 200, cache: "no-store" });
      const cookies = await context.cookies(); expect(cookies.length).toBeGreaterThan(0);
      expect(cookies.every(cookie => cookie.httpOnly && cookie.sameSite === "Lax")).toBe(true);
      const carried = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
      expect(await page.evaluate(async () => (await (await fetch("/api/auth/get-session")).json()).user.emailVerified)).toBe(true);

      const logout = await page.evaluate(async () => { const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });

 return { status: response.status, cache: response.headers.get("cache-control") }; });

      expect(logout).toEqual({ status: 200, cache: "no-store" });
      const replay = await fetch(`${origin}/api/auth/get-session`, { headers: { cookie: carried } });
      expect(await replay.json()).toBeNull(); expect(replay.headers.get("cache-control")).toBe("no-store");
    } finally { await browser.close(); }
  });

  it("uses actual HTTPS browser Secure HttpOnly SameSite cookies and refuses logout replay", async () => {
    if (pool === undefined) throw new Error("fixture pool unavailable");
    const directory = await mkdtemp(join(tmpdir(), "sceneaxi-https-identity-"));
    let tls: ReturnType<typeof createTlsServer> | undefined; let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

    try {
      execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(directory,"key.pem"), "-out", join(directory,"cert.pem"), "-days", "1", "-subj", "/CN=localhost"], { stdio: "ignore" });
      let tlsOrigin = "";
      tls = createTlsServer({ key: await readFile(join(directory,"key.pem")), cert: await readFile(join(directory,"cert.pem")) }, async (request,response) => {
        const chunks: Buffer[] = [];

 for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const method = request.method ?? "GET";
        const init: RequestInit = { method, headers: requestHeaders(request.headers) };

          if (method !== "GET" && method !== "HEAD") init.body = Buffer.concat(chunks);
          const result = await tlsHandler(new Request(`${tlsOrigin}${request.url}`, init));
        response.writeHead(result.status,Object.fromEntries(result.headers));response.end(Buffer.from(await result.arrayBuffer()));
      });
      await new Promise<void>(resolve => tls?.listen(0,"127.0.0.1",resolve)); const address = tls.address();

      if (address === null || isString(address)) throw new Error("TLS fixture unavailable"); tlsOrigin = `https://127.0.0.1:${address.port}`;
      const config = { databaseUrl: "fixture-unused", origin: tlsOrigin, secret: SECRET, bootstrapEmail: EMAIL, bootstrapSecret: PASSWORD };
      const runtime = createBetterAuthProviderRuntime({ config, database: pool, lifecycle: createAccountLifecycle(pool,config) });
      const tlsHandler = createBetterAuthProviderHandler(() => ({ ok:true,value:runtime }));
      browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
      const context = await browser.newContext({ ignoreHTTPSErrors:true }); const page = await context.newPage(); await page.goto(`${tlsOrigin}/api/auth/get-session`);

      const response = await page.evaluate(async ({ email,password }) => { const res = await fetch("/api/auth/sign-in/email", { method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password}) });

return {status:res.status,cache:res.headers.get("cache-control")}; }, { email:EMAIL,password:PASSWORD });

      expect(response).toEqual({status:200,cache:"no-store"}); const cookies = await context.cookies(); expect(cookies.length).toBeGreaterThan(0); expect(cookies.every(cookie=>cookie.secure && cookie.httpOnly && cookie.sameSite==="Lax")).toBe(true);
      const carried = cookies.map(cookie=>`${cookie.name}=${cookie.value}`).join("; "); expect(await page.evaluate(()=>document.cookie)).toBe("");
      expect(await page.evaluate(async()=> (await fetch("/api/auth/sign-out", {method:"POST",headers:{"content-type":"application/json"},body:"{}"})).status)).toBe(200);
      const replay = await context.request.get(`${tlsOrigin}/api/auth/get-session`, { headers:{cookie:carried} }); expect(await replay.json()).toBeNull();expect(replay.headers()["cache-control"]).toBe("no-store");
    } finally { await browser?.close();

 if(tls!==undefined)await new Promise<void>(resolve=>tls?.close(()=>resolve()));await rm(directory,{recursive:true,force:true}); }
  });

  it("per-action provider reauth requires password and immutable recent session creation", async () => {
    await clearBudget(); const before = (await sql('SELECT count(*)::int AS count FROM better_auth_sessions WHERE "userId"=$1',[userId])).rows[0]?.count;
    const valid = await post("account/reauth"); expect(valid.status).toBe(200);expect(await valid.json()).toEqual({code:"ACCOUNT_REAUTHENTICATED"});
    expect((await post("account/reauth",{password:"wrong"})).status).toBe(401);
    await sql(`UPDATE better_auth_sessions SET "createdAt"=CURRENT_TIMESTAMP-interval '10 minutes' WHERE id=$1`,[providerSessionId]);
    expect((await post("account/reauth")).status).toBe(401);
    await sql(`UPDATE better_auth_sessions SET "createdAt"=CURRENT_TIMESTAMP WHERE id=$1`,[providerSessionId]);
    expect((await sql('SELECT count(*)::int AS count FROM better_auth_sessions WHERE "userId"=$1',[userId])).rows[0]?.count).toBe(before);
    await clearBudget();
  });

  it("implements closed recovery digest, expiry, supersession, single-use and revocation contracts", async () => {
    if (pool === undefined) throw new Error("fixture pool unavailable");
    const unwired = createRecoveryContract(pool);
    expect(await unwired.issue(userId)).toEqual({ ok: false, code: "ACCOUNT_RECOVERY_MAIL_TRANSPORT_UNCONFIGURED" });
    expect(await unwired.consume("a".repeat(64), PASSWORD)).toEqual({ ok: false, code: "ACCOUNT_RECOVERY_MAIL_TRANSPORT_UNCONFIGURED" });
    let delivered = "";
    const deliver = async (email: string, value: string) => { expect(email).toBe(EMAIL); delivered = value; };

    const recovery = createRecoveryContract(pool, deliver);
    expect((await recovery.issue(userId)).ok).toBe(true); const superseded = delivered;
    const rows = (await sql(`SELECT "identifier","value" FROM better_auth_verifications WHERE "identifier" LIKE 'sceneaxi.recovery.v1:%'`)).rows;
    expect(JSON.stringify(rows)).not.toContain(delivered); expect(rows).toHaveLength(1);
    expect((await recovery.issue(userId)).ok).toBe(true);
    expect(await recovery.consume(superseded, PASSWORD)).toEqual({ ok: false, code: "ACCOUNT_RECOVERY_TOKEN_INVALID" });
    await sql(`UPDATE better_auth_verifications SET "createdAt"=CURRENT_TIMESTAMP - interval '2 hours',"expiresAt"=CURRENT_TIMESTAMP - interval '1 hour' WHERE "identifier" LIKE 'sceneaxi.recovery.v1:%'`);
    expect(await recovery.consume(delivered, PASSWORD)).toEqual({ ok: false, code: "ACCOUNT_RECOVERY_TOKEN_INVALID" });
    expect((await recovery.issue(userId)).ok).toBe(true); const valid = delivered;
    const sibling = createRecoveryContract(pool, deliver);
    const consumed = await Promise.all([recovery.consume(valid, PASSWORD), sibling.consume(valid, PASSWORD)]);
    expect(consumed.map(value => value.code).sort()).toEqual(["ACCOUNT_RECOVERY_PASSWORD_RESET", "ACCOUNT_RECOVERY_TOKEN_INVALID"]);
    expect(await recovery.consume(valid, PASSWORD)).toEqual({ ok: false, code: "ACCOUNT_RECOVERY_TOKEN_INVALID" });
    expect((await sql('SELECT id FROM better_auth_sessions WHERE "userId"=$1', [userId])).rows).toHaveLength(0);
    expect((await sql("SELECT session_id FROM sessions WHERE user_id=$1", [userId])).rows).toHaveLength(0);
    await signIn();
  });

  it("exports persisted records without passwords, tokens or role claims", async () => {
    const response = await post("account/export");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const payload = await response.json();
    expect(payload).toMatchObject({ kind: "sceneaxi.account-export", identity: { userId, email: EMAIL }, retention: ACCOUNT_LIFECYCLE_POLICY });
    const encoded = JSON.stringify(payload);

    for (const forbidden of [PASSWORD, SECRET, token, "token_digest", '"password"', '"role"']) expect(encoded).not.toContain(forbidden);
    expect(payload.creditAccounts).toHaveLength(1);
  });

  it("requires exact origin and refuses client roles and Kids", async () => {
    for (const origin of ["https://hostile.example.invalid", "https://alias.example.invalid", "null", ""]) {
      const response = await post("account/disable", { password: PASSWORD, confirm: "disable-access" }, { origin });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: "SITE_REQUEST_CROSS_ORIGIN" });
      expect(response.headers.get("set-cookie")).toBeNull();
    }

    expect((await post("account/export", { password: PASSWORD, role: "admin" })).status).toBe(400);
    expect((await post("account/export", { password: PASSWORD, surface: "kids" })).status).toBe(403);
  });

  it("refuses wrong passwords, missing, old and expired provider sessions", async () => {
    expect((await post("account/export", { password: "wrong" })).status).toBe(401);
    expect((await post("account/export", { password: PASSWORD }, { authorization: "Bearer unknown-fixture-session" })).status).toBe(401);
    await sql(`UPDATE better_auth_sessions SET "createdAt" = CURRENT_TIMESTAMP - interval '10 minutes' WHERE id=$1`, [providerSessionId]);
    expect((await post("account/export")).status).toBe(401);
    await sql(`UPDATE better_auth_sessions SET "createdAt" = CURRENT_TIMESTAMP - interval '2 hours', "expiresAt" = CURRENT_TIMESTAMP - interval '1 hour' WHERE id=$1`, [providerSessionId]);
    expect((await post("account/export")).status).toBe(401);
    await sql(`UPDATE better_auth_sessions SET "createdAt" = CURRENT_TIMESTAMP, "expiresAt" = CURRENT_TIMESTAMP + interval '1 hour' WHERE id=$1`, [providerSessionId]);
  });

  it("bounds durable password attempts, bodies and export rows", async () => {
    await clearBudget();

    for (let attempt = 0; attempt < 5; attempt++) expect((await post("account/export", { password: "wrong" })).status).toBe(401);
    const limited = await post("account/export");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("300");
    await clearBudget();
    expect((await post("account/export", { password: "x".repeat(ACCOUNT_LIFECYCLE_LIMITS.bodyBytes) })).status).toBe(400);
    expect((await post("account/disable", { password: PASSWORD, confirm: "no" })).status).toBe(400);
    const valid = JSON.stringify({ password: PASSWORD });

    for (const [size, status] of [[ACCOUNT_LIFECYCLE_LIMITS.bodyBytes, 200], [ACCOUNT_LIFECYCLE_LIMITS.bodyBytes + 1, 400]] satisfies readonly (readonly [number, number])[]) {
      const response = await fetch(`${origin}/api/auth/account/export`, { method: "POST", headers: { origin, authorization: `Bearer ${token}`, "content-type": "application/json" }, body: valid.padEnd(size, " ") });
      expect(response.status).toBe(status);
    }

    const account = (await sql("SELECT account_id FROM credit_accounts WHERE user_id=$1", [userId])).rows[0]?.account_id;
    await sql(`INSERT INTO credit_ledger_entries(entry_id,account_id,sequence,movement,delta,balance_after,reason,idempotency_key,occurred_at)
      SELECT 'fixture-entry-'||n,$1,n,'grant',1,n,'fixture','fixture:'||n,CURRENT_TIMESTAMP FROM generate_series(1,$2) n`, [account, ACCOUNT_LIFECYCLE_LIMITS.exportRowsPerCategory]);
    const atLimit = await post("account/export");
    expect(atLimit.status).toBe(200);
    expect((await atLimit.json()).creditLedger).toHaveLength(ACCOUNT_LIFECYCLE_LIMITS.exportRowsPerCategory);
    await sql(`INSERT INTO credit_ledger_entries(entry_id,account_id,sequence,movement,delta,balance_after,reason,idempotency_key,occurred_at)
      VALUES ('fixture-entry-overflow',$1,$2::integer,'grant',1,$2::integer,'fixture','fixture:overflow',CURRENT_TIMESTAMP)`, [account, ACCOUNT_LIFECYCLE_LIMITS.exportRowsPerCategory + 1]);
    const response = await post("account/export");
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ code: "ACCOUNT_EXPORT_LIMIT_EXCEEDED" });
  });

  it("rolls back a failed second-layer revocation without claiming disable success", async () => {
    await clearBudget();

    const failingPool: Pick<Pool, "connect"> = {
      async connect() {
        if (pool === undefined) throw new Error("fixture pool unavailable");
        const client = await pool.connect();

        return new Proxy(client, {
          get(target, key) {
            if (key === "query") return (text: string, values: unknown[] = []) => {
              if (text.startsWith("DELETE FROM sessions")) throw new Error("synthetic revocation storage failure");

              return target.query(text, values);
            };

            // SAFETY: the proxy reads an existing PoolClient member by its property key, including inherited methods.
              const value = target[key as keyof typeof target];

            return isCallable(value) ? Function.prototype.bind.call(value, target) : value;
          },
        });
      },
    };

    const lifecycle = createAccountLifecycle(failingPool, { origin, bootstrapEmail: EMAIL });
    const before = (await sql('SELECT id FROM better_auth_sessions WHERE "userId"=$1 ORDER BY id', [userId])).rows;
    const response = await lifecycle.dispatch(new Request(`${origin}/api/auth/account/disable`, { method: "POST", headers: { origin, authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ password: PASSWORD, confirm: "disable-access" }) }), async () => { throw new Error("unreachable stock dispatch"); });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "ACCOUNT_LIFECYCLE_STORAGE_UNAVAILABLE" });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect((await sql("SELECT disabled FROM users WHERE user_id=$1", [userId])).rows).toEqual([{ disabled: false }]);
    expect((await sql('SELECT id FROM better_auth_sessions WHERE "userId"=$1 ORDER BY id', [userId])).rows).toEqual(before);
    expect((await sql("SELECT session_id FROM sessions WHERE user_id=$1", [userId])).rows).toHaveLength(1);
  });

  it("bounds concurrent sign-in admission without pool deadlock or extra credential grants", async () => {
    const before = (await sql('SELECT count(*)::int AS count FROM better_auth_sessions WHERE "userId"=$1', [userId])).rows[0]?.count;
    const responses = await Promise.all([1, 2].map(() => fetch(`${origin}/api/auth/sign-in/email`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 429]);
    expect((await sql('SELECT count(*)::int AS count FROM better_auth_sessions WHERE "userId"=$1', [userId])).rows[0]?.count).toBe(before + 1);
  });

  it("names unavailable recovery, erasure and MFA; refuses wrong methods", async () => {
    for (const [path, code] of [["request-password-reset", "ACCOUNT_RECOVERY_MAIL_TRANSPORT_UNCONFIGURED"], ["reset-password", "ACCOUNT_RECOVERY_MAIL_TRANSPORT_UNCONFIGURED"], ["account/delete", "ACCOUNT_DELETION_RETENTION_POLICY_UNCONFIGURED"], ["account/mfa", "ACCOUNT_MFA_UNCONFIGURED"]] satisfies readonly (readonly [string, string])[]) {
      const response = await post(path);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ code });
    }

    expect((await fetch(`${origin}/api/auth/account/disable`)).status).toBe(405);
  });

  it("disables only this user, revokes both session layers, denies replay and preserves ledger bytes", async () => {
    await clearBudget();
    const second = await signIn();
    const ledgerBefore = (await sql("SELECT row_to_json(e) AS record FROM credit_ledger_entries e ORDER BY entry_id")).rows;
    await sql(`INSERT INTO users(user_id,email,email_verified,disabled,created_at) VALUES ('unrelated-fixture','unrelated@example.invalid',true,false,CURRENT_TIMESTAMP)`);
    await sql(`INSERT INTO sessions(session_id,user_id,surface,issued_at,expires_at,token_digest) VALUES ('unrelated-fixture-session','unrelated-fixture','site',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + interval '1 hour',repeat('a',64))`);
    const malformed = await post("account/disable", { password: PASSWORD, confirm: "disable-access" }, { authorization: "", cookie: `sceneaxi.session=${second.sessionId}.${second.token}` });
    expect(malformed.status).toBe(401);
    const disabled = await fetch(`${origin}/api/auth/account/disable`, { method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded", cookie: `sceneaxi.session=${second.sessionId}.${second.token}` }, body: new URLSearchParams({ password: PASSWORD, confirm: "disable-access" }) });
    expect(disabled.status).toBe(200);
    expect(await disabled.json()).toMatchObject({ code: "ACCOUNT_ACCESS_DISABLED", retention: ACCOUNT_LIFECYCLE_POLICY });
    expect(disabled.headers.get("set-cookie")).toContain("HttpOnly; SameSite=Lax; Max-Age=0");
    expect((await sql("SELECT disabled FROM users WHERE user_id=$1", [userId])).rows).toEqual([{ disabled: true }]);
    expect((await sql('SELECT id FROM better_auth_sessions WHERE "userId"=$1', [userId])).rows).toHaveLength(0);
    expect((await sql("SELECT session_id FROM sessions WHERE user_id=$1", [userId])).rows).toHaveLength(0);
    expect((await sql("SELECT session_id FROM sessions WHERE user_id='unrelated-fixture'")).rows).toHaveLength(1);
    expect((await sql("SELECT row_to_json(e) AS record FROM credit_ledger_entries e ORDER BY entry_id")).rows).toEqual(ledgerBefore);
    expect((await post("account/disable", { password: PASSWORD, confirm: "disable-access" })).status).toBe(401);
    const lookup = await fetch(`${origin}/api/auth/get-session`, { headers: { authorization: `Bearer ${second.token}` } });
    expect(await lookup.json()).toBeNull();
    const refused = await fetch(`${origin}/api/auth/sign-in/email`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
    expect(refused.status).toBe(403);
    expect((await sql('SELECT id FROM better_auth_sessions WHERE "userId"=$1', [userId])).rows).toHaveLength(0);
  });
});
