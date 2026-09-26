#!/usr/bin/env node
/** Apply ordered SQL migrations with transactional checksum tracking; adoption only records operator-verified history. */
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationDir = resolve(root, "db/migrations");
const idPattern = /^(\d{4})_[a-z0-9_]+\.sql$/;
const TOP_LEVEL_TRANSACTION = /^\s*(?:BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK)\s*;/im;
/** Serializes concurrent runs against one database; held for each migration's transaction. */
const MIGRATION_LOCK_KEY = 70_227_001;

/**
 * libpq connection variables for a postgres:// URL, so the password never appears in the
 * psql argument vector (visible to any local user through `ps`).
 */
export function psqlConnectionEnv(databaseUrl) {
  const url = new URL(databaseUrl);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("DATABASE_URL must be a postgres:// URL");
  const env = {
    PGHOST: decodeURIComponent(url.hostname),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")),
  };
  if (url.port) env.PGPORT = url.port;
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode) env.PGSSLMODE = sslmode;
  const channelBinding = url.searchParams.get("channel_binding");
  if (channelBinding) env.PGCHANNELBINDING = channelBinding;
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));
}

export async function loadMigrations(directory = migrationDir) {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  const migrations = [];
  for (const name of names) {
    const match = idPattern.exec(name);
    if (!match) throw new Error(`invalid migration filename: ${name}`);
    const sql = await readFile(resolve(directory, name), "utf8");
    // The runner owns the transaction: a file that opens or ends its own would commit its
    // schema before the tracking row is written, so a failure leaves it applied but unrecorded.
    if (TOP_LEVEL_TRANSACTION.test(sql)) throw new Error(`migration manages its own transaction: ${name}`);
    migrations.push({ id: name.slice(0, -4), number: Number(match[1]), sql });
  }
  for (let index = 0; index < migrations.length; index += 1) {
    if (migrations[index].number !== index) throw new Error(`migration gap or out-of-order id at ${migrations[index].id}`);
  }
  return migrations.map((migration) => ({ id: migration.id, sql: migration.sql, sha256: createHash("sha256").update(migration.sql).digest("hex") }));
}

export async function adopt({ executor, migrations, through }) {
  const files = migrations ?? await loadMigrations();
  const targetIndex = files.findIndex(({ id }) => id === through);
  if (targetIndex < 0) throw new Error(`unknown migration id: ${through}`);
  const state = await executor.trackingState();
  if (state.rows.length > 0) throw new Error("adoption requires schema_migrations to be absent or empty");
  const prefix = files.slice(0, targetIndex + 1);
  if (prefix.at(-1)?.id !== through) throw new Error(`migration sequence is not contiguous through ${through}`);
  await executor.transaction(async (tx) => {
    await tx.execute(files[0].sql);
    for (const migration of prefix) await tx.record(migration.id, migration.sha256);
  });
  return prefix.map(({ id, sha256 }) => ({ id, sha256, applied: true }));
}

export async function migrate({ executor, migrations, dryRun = false, status = false }) {
  const files = migrations ?? await loadMigrations();
  const applied = await executor.applied();
  const byId = new Map(applied.map((row) => [row.id, row]));
  for (const row of applied) {
    const file = files.find((migration) => migration.id === row.id);
    if (!file || file.sha256 !== row.sha256) throw new Error(`checksum mismatch or unknown applied migration: ${row.id}`);
  }
  const expectedPrefix = files.slice(0, applied.length).map(({ id }) => id);
  if (expectedPrefix.some((id, index) => applied[index]?.id !== id)) throw new Error("applied migrations contain a gap or are out of order");
  if (status) return files.map(({ id, sha256 }) => ({ id, sha256, applied: byId.has(id) }));
  const pending = files.slice(applied.length);
  if (!dryRun) for (const migration of pending) await executor.transaction(async (tx) => {
    await tx.execute(migration.sql);
    await tx.record(migration.id, migration.sha256);
  });
  return pending.map(({ id, sha256 }) => ({ id, sha256, applied: false }));
}

function psqlExecutor(databaseUrl) {
  const connection = psqlConnectionEnv(databaseUrl);
  const run = (sql) => {
    const result = spawnSync("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], {
      encoding: "utf8",
      env: { ...process.env, ...connection },
    });
    if (result.status !== 0) throw new Error(result.stderr.trim() || "psql failed");
    return result.stdout.trim();
  };
  return {
    async trackingState() {
      if (run("SELECT COALESCE(to_regclass('schema_migrations')::text, '')") === "") return { exists: false, rows: [] };
      const rows = run("SELECT id || E'\\t' || rtrim(sha256) FROM schema_migrations ORDER BY id").split("\n").filter(Boolean);
      return { exists: true, rows: rows.map((line) => { const [id, sha256] = line.split("\t"); return { id, sha256 }; }) };
    },
    async applied() {
      const state = await this.trackingState();
      if (!state.exists && run("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'") !== "0") {
        throw new Error("database has tables but no migration tracking; reconcile or explicitly adopt verified migrations");
      }
      return state.rows;
    },
    async transaction(work) {
      const statements = [];
      await work({ execute: async (sql) => statements.push(sql), record: async (id, sha256) => statements.push(`INSERT INTO schema_migrations (id, sha256) VALUES ('${id}', '${sha256}')`) });
      run(`BEGIN;\nSELECT pg_advisory_xact_lock(${MIGRATION_LOCK_KEY});\n${statements.join(";\n")};\nCOMMIT`);
    },
  };
}

async function main(args) {
  const [flag, value, ...rest] = args;
  const adoption = flag === "--adopt-through";
  if (rest.length || (adoption ? !value : value !== undefined) || ![undefined, "--dry-run", "--status", "--adopt-through"].includes(flag)) {
    throw new Error("usage: node scripts/db-migrate.mjs [--dry-run|--status|--adopt-through <id>]");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const executor = psqlExecutor(databaseUrl);
  const rows = adoption
    ? await adopt({ executor, through: value })
    : await migrate({ executor, dryRun: flag === "--dry-run", status: flag === "--status" });
  for (const row of rows) console.log(`${adoption ? "recorded" : row.applied ? "applied" : flag === "--status" ? "pending" : "would apply"} ${row.id} ${row.sha256}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
