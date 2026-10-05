/** Closed recovery capability. No HTTP endpoint enables this without mail/approval. */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { Pool, PoolClient } from "pg";

type RecoveryInput = string | number | boolean | null | undefined | readonly RecoveryInput[] | { readonly [key: string]: RecoveryInput };

function isString<Value>(value: Value): value is Value & string { return typeof value === "string"; }

const PREFIX = "sceneaxi.recovery.v1:";

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export const RECOVERY_TOKEN_TTL_MS = 15 * 60 * 1000;

export type RecoveryOutcome = Readonly<{ ok: boolean; code: string }>;

const result = (ok: boolean, code: string): RecoveryOutcome => Object.freeze({ ok, code });

/** Delivery is trusted operator wiring, never request input. Raw tokens are never returned. */
export function createRecoveryContract(pool: Pick<Pool, "connect">, deliver?: (email: string, token: string) => Promise<void>) {
  let busy = false;

  async function transaction(effect: (client: PoolClient) => Promise<RecoveryOutcome>) {
    if (busy) return result(false, "ACCOUNT_RECOVERY_BUSY");
    busy = true; let client: PoolClient | undefined;

    try {
      client = await pool.connect(); await client.query("BEGIN"); await client.query("SET LOCAL statement_timeout = '10s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["sceneaxi.provider.account-lifecycle.v1"]);
      const outcome = await effect(client); await client.query(outcome.ok ? "COMMIT" : "ROLLBACK");

 return outcome;
    } catch { if (client !== undefined) await client.query("ROLLBACK").catch(() => undefined);

 return result(false, "ACCOUNT_RECOVERY_STORAGE_UNAVAILABLE"); }
    finally { client?.release(); busy = false; }
  }

  return Object.freeze({
    async issue(userId: string): Promise<RecoveryOutcome> {
      if (deliver === undefined) return result(false, "ACCOUNT_RECOVERY_MAIL_TRANSPORT_UNCONFIGURED");

      if (userId.length < 1 || userId.length > 128) return result(false, "ACCOUNT_RECOVERY_REQUEST_INVALID");

      return transaction(async client => {
        const users = await client.query("SELECT user_id,email FROM users WHERE user_id=$1 AND disabled=false AND email_verified=true FOR UPDATE", [userId]);
        const user = users.rows[0];

 if (user === undefined) return result(false, "ACCOUNT_RECOVERY_REQUEST_INVALID");
        const token = randomBytes(32).toString("hex");
        await client.query('DELETE FROM better_auth_verifications WHERE "identifier" LIKE $1 AND "value"=$2', [`${PREFIX}%`, userId]);
        await client.query(`INSERT INTO better_auth_verifications("id","identifier","value","createdAt","updatedAt","expiresAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+$4*interval '1 millisecond')`, [randomUUID(), `${PREFIX}${digest(token)}`, userId, RECOVERY_TOKEN_TTL_MS]);
        await deliver(String(user.email), token);

 return result(true, "ACCOUNT_RECOVERY_DELIVERY_ACCEPTED");
      });
    },
    async consume(token: RecoveryInput, password: RecoveryInput): Promise<RecoveryOutcome> {
      if (deliver === undefined) return result(false, "ACCOUNT_RECOVERY_MAIL_TRANSPORT_UNCONFIGURED");

      if (!isString(token) || !/^[a-f0-9]{64}$/.test(token) || !isString(password) || password.length < 8 || password.length > 128) return result(false, "ACCOUNT_RECOVERY_REQUEST_INVALID");

      return transaction(async client => {
        const records = await client.query('DELETE FROM better_auth_verifications WHERE "identifier"=$1 AND "createdAt"<=CURRENT_TIMESTAMP AND "expiresAt">CURRENT_TIMESTAMP RETURNING "value"', [`${PREFIX}${digest(token)}`]);
        const id = records.rows[0]?.value;

        if (records.rows.length !== 1 || !isString(id)) return result(false, "ACCOUNT_RECOVERY_TOKEN_INVALID");
        const hash = await hashPassword(password);
        const changed = await client.query(`UPDATE better_auth_accounts a SET "password"=$2,"updatedAt"=CURRENT_TIMESTAMP FROM users u WHERE a."userId"=$1 AND a."providerId"='credential' AND u.user_id=a."userId" AND u.disabled=false AND u.email_verified=true RETURNING a."id"`, [id, hash]);

        if (changed.rows.length !== 1) return result(false, "ACCOUNT_RECOVERY_TOKEN_INVALID");
        await client.query("DELETE FROM sessions WHERE user_id=$1", [id]);
        await client.query('DELETE FROM better_auth_sessions WHERE "userId"=$1', [id]);
        await client.query('DELETE FROM better_auth_verifications WHERE "identifier" LIKE $1 AND "value"=$2', [`${PREFIX}%`, id]);

        return result(true, "ACCOUNT_RECOVERY_PASSWORD_RESET");
      });
    },
  });
}
