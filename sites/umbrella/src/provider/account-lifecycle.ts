/** Provider-owned lifecycle: genuine persisted sessions + password reauthentication.
 * Access disable is not erasure. No financial, identity or backup retention period
 * is invented here; deletion stays unavailable until a reviewed policy exists.
 */
import { randomUUID, createHash } from "node:crypto";
import { verifyPassword } from "better-auth/crypto";
import type { Pool, PoolClient } from "pg";

export const ACCOUNT_LIFECYCLE_POLICY = Object.freeze({
  version: 1,
  mode: "access-disable-not-erasure",
  identity: "retain-disabled-record-pending-reviewed-policy",
  finance: "preserve-append-only-ledger-and-related-records",
  sessions: "revoke-all-provider-and-sceneaxi-sessions-on-disable",
  backups: "reviewed-retention-policy-required",
  deletion: "unavailable-retention-policy-required",
  emailRecovery: "unavailable-mail-transport-required",
  exportScope: ["identity", "credit-account", "credit-ledger", "checkout-intents"],
  fullPrivacyExport: "reviewed-category-inventory-required",
} as const);

export const ACCOUNT_LIFECYCLE_LIMITS = Object.freeze({
  bodyBytes: 4096,
  exportRowsPerCategory: 1000,
  exportBytes: 1024 * 1024,
  recentSessionMs: 5 * 60 * 1000,
});

export type AccountLifecycle = Readonly<{
  dispatch(request: Request, stock: () => Promise<Response>): Promise<Response>;
}>;

function result(code: string, status: number, value?: unknown): Response {
  return Response.json(value === undefined ? { code } : value, {
    status,
    headers: { "cache-control": "no-store", "pragma": "no-cache", "x-content-type-options": "nosniff" },
  });
}

async function body(request: Request): Promise<Record<string, unknown> | undefined> {
  if (request.body === null) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;

  try {
    while (true) {
      const part = await reader.read();

      if (part.done) break;
      length += part.value.byteLength;

      if (length > ACCOUNT_LIFECYCLE_LIMITS.bodyBytes) {
        await reader.cancel();

        return undefined;
      }

      chunks.push(part.value);
    }

    const bytes = new Uint8Array(length);
    let offset = 0;

    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }

    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const type = request.headers.get("content-type")?.split(";", 1)[0];
    let parsed: unknown;

    if (type === "application/json") parsed = JSON.parse(text);
    else if (type === "application/x-www-form-urlencoded") {
      const entries = [...new URLSearchParams(text)];

      if (new Set(entries.map(([key]) => key)).size !== entries.length) return undefined;
      parsed = Object.fromEntries(entries);
    } else return undefined;

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;

    return parsed as Record<string, unknown>;
  } catch { return undefined; }
  finally { reader.releaseLock(); }
}

function credential(request: Request): { token: string; sessionId?: string } | undefined {
  const authorization = request.headers.get("authorization");

  if (authorization !== null) {
    const match = /^Bearer ([^\s]{1,512})$/.exec(authorization);

    return match?.[1] === undefined ? undefined : { token: match[1] };
  }

  const cookies = (request.headers.get("cookie") ?? "").split(";")
    .map((part) => part.trim()).filter((part) => part.startsWith("sceneaxi.session="));

  if (cookies.length !== 1) return undefined;
  const value = cookies[0]?.slice("sceneaxi.session=".length) ?? "";
  const dot = value.indexOf(".");

  if (dot < 1 || dot === value.length - 1 || value.length > 641) return undefined;

  return { sessionId: value.slice(0, dot), token: value.slice(dot + 1) };
}

const LOCK = "sceneaxi.provider.account-lifecycle.v1";

/** Same advisory lock as sign-in: no provider credential grant can race disable.
 * Only one lock-holding call per instance (no unbounded queue or pool deadlock).
 * Different instances serialize in PostgreSQL. Pool remains bounded by its owner.
 */
export function createAccountLifecycle(
  pool: Pick<Pool, "connect">,
  config: Readonly<{ origin: string; bootstrapEmail: string }>,
): AccountLifecycle {
  let busy = false;

  return Object.freeze({
    async dispatch(request, stock) {
      const path = new URL(request.url).pathname;

      if (request.method === "POST" && (path === "/api/auth/sign-in/email" || path === "/api/auth/sign-out") &&
          (request.headers.get("origin") !== config.origin || new URL(request.url).origin !== config.origin || request.headers.get("sec-fetch-site") === "cross-site")) return result("SITE_REQUEST_CROSS_ORIGIN", 403);
      const action = path.startsWith("/api/auth/account/") ? path.slice("/api/auth/account/".length) : undefined;
      const recovery = path === "/api/auth/request-password-reset" || path === "/api/auth/reset-password";

      if (action !== undefined || recovery) {
        if (request.method !== "POST") return result("METHOD_NOT_ALLOWED", 405);

        if (request.headers.get("origin") !== config.origin || new URL(request.url).origin !== config.origin ||
            request.headers.get("sec-fetch-site") === "cross-site") return result("SITE_REQUEST_CROSS_ORIGIN", 403);

        if (recovery) return result("ACCOUNT_RECOVERY_MAIL_TRANSPORT_UNCONFIGURED", 503);

        if (action === "delete") return result("ACCOUNT_DELETION_RETENTION_POLICY_UNCONFIGURED", 503);

        if (action === "mfa") return result("ACCOUNT_MFA_UNCONFIGURED", 503);

        if (action !== "export" && action !== "disable" && action !== "reauth") return result("NOT_FOUND", 404);
      }

      const signIn = path === "/api/auth/sign-in/email";

      if (action === undefined && !signIn) {
        const response = await stock();

        if (path !== "/api/auth/get-session" || !response.ok) return response;
        const payload = await response.clone().json() as { user?: { id?: unknown } } | null;

        if (typeof payload?.user?.id !== "string") return response;
        const client = await pool.connect();

        try {
          const rows = await client.query("SELECT disabled FROM users WHERE user_id = $1", [payload.user.id]);

          if (rows.rows[0]?.disabled === true) return result("IDENTITY_USER_DISABLED", 200, null);

          return response;
        } finally { client.release(); }
      }

      if (busy) {
        const response = result("ACCOUNT_LIFECYCLE_BUSY", 429);
        response.headers.set("retry-after", "1");

        return response;
      }

      busy = true;
      let client: PoolClient | undefined;

      try {
        client = await pool.connect();
        await client.query("BEGIN");
        await client.query("SET LOCAL statement_timeout = '10s'");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [LOCK]);
        let response: Response;

        if (signIn) {
          const fields = await body(request.clone());

          if (typeof fields?.email !== "string" || fields.email.trim().toLowerCase() !== config.bootstrapEmail) {
            response = result("LOGIN_CREDENTIALS_REJECTED", 401);
          } else {
            const rows = await client.query("SELECT disabled FROM users WHERE email = $1", [config.bootstrapEmail]);
            response = rows.rows[0]?.disabled === true ? result("IDENTITY_USER_DISABLED", 403) : await stock();
          }
        } else {
          response = await execute(client, request, action as "export" | "disable" | "reauth");
        }

        await client.query("COMMIT");

        return response;
      } catch {
        if (client !== undefined) await client.query("ROLLBACK").catch(() => undefined);

        return result("ACCOUNT_LIFECYCLE_STORAGE_UNAVAILABLE", 503);
      } finally { client?.release(); busy = false; }
    },
  });
}

async function execute(client: PoolClient, request: Request, action: "export" | "disable" | "reauth"): Promise<Response> {
  const carried = credential(request);

  if (carried === undefined) return result("IDENTITY_SESSION_ABSENT", 401);
  const fields = await body(request);

  if (fields?.surface === "kids") return result("KIDS_SURFACE_DENIED", 403);

  if (fields === undefined || Object.keys(fields).some((key) => key !== "password" && key !== "confirm") ||
      typeof fields.password !== "string" || fields.password.length < 1 || fields.password.length > 128 ||
      (action === "disable" && fields.confirm !== "disable-access")) return result("SITE_REQUEST_MALFORMED", 400);

  const rows = await client.query(`
    SELECT u.user_id, u.email, u.email_verified, u.disabled, u.created_at,
           a."password", p."createdAt" AS provider_created_at
      FROM users u
      JOIN better_auth_users b ON b."id" = u.user_id AND b."email" = u.email
      JOIN better_auth_sessions p ON p."userId" = u.user_id
      JOIN sessions s ON s.session_id = p."id" AND s.user_id = u.user_id
      JOIN better_auth_accounts a ON a."userId" = u.user_id AND a."providerId" = 'credential'
     WHERE p."token" = $1 AND s.token_digest = $2 AND ($3::text IS NULL OR s.session_id = $3)
       AND s.surface = 'site' AND s.expires_at > CURRENT_TIMESTAMP AND p."expiresAt" > CURRENT_TIMESTAMP
       AND s.issued_at <= CURRENT_TIMESTAMP AND p."createdAt" <= CURRENT_TIMESTAMP
       AND b."emailVerified" = true AND u.email_verified = true AND u.disabled = false
     FOR UPDATE OF u, b, p, s, a`,
    [carried.token, createHash("sha256").update(carried.token).digest("hex"), carried.sessionId ?? null]);

  const user = rows.rows[0] as Record<string, unknown> | undefined;

  if (user === undefined) return result("IDENTITY_SESSION_ABSENT", 401);

  // Use the database clock, not caller-supplied timestamps or the local session
  // issuance time (which verification can refresh). Password is checked again.
  const recent = await client.query("SELECT CURRENT_TIMESTAMP - $1::timestamptz <= $2 * interval '1 millisecond' AS recent",
    [user.provider_created_at, ACCOUNT_LIFECYCLE_LIMITS.recentSessionMs]);

  if (recent.rows[0]?.recent !== true) return result("ACCOUNT_REAUTHENTICATION_REQUIRED", 401);

  const budget = await client.query(`INSERT INTO better_auth_rate_limits ("id", "key", "count", "lastRequest")
    VALUES ($1, $2, 1, floor(extract(epoch FROM CURRENT_TIMESTAMP) * 1000)::bigint)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN better_auth_rate_limits."lastRequest" < floor(extract(epoch FROM CURRENT_TIMESTAMP) * 1000)::bigint - 300000 THEN 1 ELSE better_auth_rate_limits."count" + 1 END,
      "lastRequest" = CASE WHEN better_auth_rate_limits."lastRequest" < floor(extract(epoch FROM CURRENT_TIMESTAMP) * 1000)::bigint - 300000 THEN floor(extract(epoch FROM CURRENT_TIMESTAMP) * 1000)::bigint ELSE better_auth_rate_limits."lastRequest" END
    RETURNING "count"`, [randomUUID(), `sceneaxi.lifecycle:${String(user.user_id)}`]);

  if (Number(budget.rows[0]?.count) > 5) {
    const response = result("ACCOUNT_REAUTHENTICATION_RATE_LIMITED", 429);
    response.headers.set("retry-after", "300");

    return response;
  }

  if (typeof user.password !== "string" || !(await verifyPassword({ hash: user.password, password: fields.password }))) {
    return result("ACCOUNT_REAUTHENTICATION_REQUIRED", 401);
  }

  if (action === "reauth") return result("ACCOUNT_REAUTHENTICATED", 200, { code: "ACCOUNT_REAUTHENTICATED" });

  if (action === "disable") {
    await client.query("UPDATE users SET disabled = true WHERE user_id = $1", [user.user_id]);
    await client.query("DELETE FROM sessions WHERE user_id = $1", [user.user_id]);
    await client.query('DELETE FROM better_auth_sessions WHERE "userId" = $1', [user.user_id]);
    const response = result("ACCOUNT_ACCESS_DISABLED", 200, { code: "ACCOUNT_ACCESS_DISABLED", retention: ACCOUNT_LIFECYCLE_POLICY });
    response.headers.set("set-cookie", `sceneaxi.session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`);

    return response;
  }

  const limit = ACCOUNT_LIFECYCLE_LIMITS.exportRowsPerCategory + 1;
  const accounts = await client.query("SELECT account_id, user_id, created_at FROM credit_accounts WHERE user_id = $1 LIMIT $2", [user.user_id, limit]);

  const ledger = await client.query(`SELECT e.entry_id, e.account_id, e.sequence, e.movement, e.delta::text, e.balance_after::text, e.reason, e.occurred_at
    FROM credit_ledger_entries e JOIN credit_accounts c ON c.account_id = e.account_id WHERE c.user_id = $1 ORDER BY e.account_id, e.sequence LIMIT $2`, [user.user_id, limit]);

  const checkout = await client.query(`SELECT intent_id, purpose, item_id, credits::text, unit_amount::text, currency, mode, created_at
    FROM checkout_session_intents WHERE user_id = $1 ORDER BY created_at, intent_id LIMIT $2`, [user.user_id, limit]);

  if ([accounts, ledger, checkout].some((category) => category.rows.length >= limit)) return result("ACCOUNT_EXPORT_LIMIT_EXCEEDED", 413);

  const payload = {
    schemaVersion: 1, kind: "sceneaxi.account-export", retention: ACCOUNT_LIFECYCLE_POLICY,
    identity: { userId: user.user_id, email: user.email, emailVerified: user.email_verified, disabled: user.disabled, createdAt: user.created_at },
    creditAccounts: accounts.rows, creditLedger: ledger.rows, checkoutIntents: checkout.rows,
  };

  if (new TextEncoder().encode(JSON.stringify(payload)).length > ACCOUNT_LIFECYCLE_LIMITS.exportBytes) return result("ACCOUNT_EXPORT_LIMIT_EXCEEDED", 413);
  const response = result("ACCOUNT_EXPORTED", 200, payload);
  response.headers.set("content-disposition", 'attachment; filename="sceneaxi-account.json"');

  return response;
}
