import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const runner = new URL("../../scripts/db-migrate.mjs", import.meta.url);

describe("database migration runner process", () => {
  it("applies once, no-ops on rerun, refuses checksum drift, and honors dry-run", () => {
    const directory = mkdtempSync(join(tmpdir(), "sceneaxi-migrations-"));
    try {
      mkdirSync(join(directory, "db/migrations"), { recursive: true });
      writeFileSync(join(directory, "db/migrations/0000_tracking.sql"), "CREATE TABLE schema_migrations (id text);");
      writeFileSync(join(directory, "db/migrations/0001_first.sql"), "CREATE TABLE first_table (id int);");
      const state = join(directory, "state.json");
      writeFileSync(state, JSON.stringify([]));
      const executor = `
        import { readFileSync, writeFileSync } from 'node:fs';
        const state = ${JSON.stringify(state)};
        const rows = JSON.parse(readFileSync(state, 'utf8'));
        globalThis.executor = {
          applied: async () => rows,
          transaction: async (work) => {
            let record;
            await work({ execute: async () => {}, record: async (id, sha256) => { record = { id, sha256 }; } });
            rows.push(record); writeFileSync(state, JSON.stringify(rows));
          },
        };
      `;
      const script = join(directory, "run.mjs");
      writeFileSync(script, `import { migrate, loadMigrations } from ${JSON.stringify(runner.href)};\n${executor}\nconst files = await loadMigrations(${JSON.stringify(join(directory, "db/migrations"))});\nconst result = await migrate({ executor: globalThis.executor, migrations: files, dryRun: process.argv.includes('--dry-run') });\nconsole.log(JSON.stringify(result));`);
      const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
      const dry = run("--dry-run");
      expect(dry.status).toBe(0);
      expect(JSON.parse(dry.stdout)).toHaveLength(2);
      expect(JSON.parse(readFileSync(state, "utf8"))).toEqual([]);
      const applied = run();
      expect(applied.status).toBe(0);
      expect(JSON.parse(readFileSync(state, "utf8"))).toHaveLength(2);
      expect(JSON.parse(run().stdout)).toEqual([]);
      writeFileSync(join(directory, "db/migrations/0001_first.sql"), "CREATE TABLE changed_table (id int);");
      const drift = run();
      expect(drift.status).toBe(1);
      expect(drift.stderr).toContain("checksum mismatch");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("adopts verified migrations only when tracking is absent or empty", () => {
    const directory = mkdtempSync(join(tmpdir(), "sceneaxi-adopt-"));
    try {
      mkdirSync(join(directory, "db/migrations"), { recursive: true });
      writeFileSync(join(directory, "db/migrations/0000_tracking.sql"), "CREATE TABLE IF NOT EXISTS schema_migrations (id text);");
      writeFileSync(join(directory, "db/migrations/0001_first.sql"), "CREATE TABLE first_table (id int);");
      const state = join(directory, "state.json");
      writeFileSync(state, JSON.stringify({ rows: [], executed: [] }));
      const script = join(directory, "adopt.mjs");
      writeFileSync(script, `
        import { readFileSync, writeFileSync } from 'node:fs';
        import { adopt, loadMigrations } from ${JSON.stringify(runner.href)};
        const statePath = ${JSON.stringify(state)};
        const state = JSON.parse(readFileSync(statePath, 'utf8'));
        const executor = {
          trackingState: async () => ({ exists: state.exists ?? false, rows: state.rows }),
          transaction: async (work) => {
            const recorded = []; const executed = [];
            await work({ execute: async (sql) => executed.push(sql), record: async (id, sha256) => recorded.push({ id, sha256 }) });
            state.rows.push(...recorded); state.executed.push(...executed);
            writeFileSync(statePath, JSON.stringify(state));
          },
        };
        try {
          const result = await adopt({ executor, migrations: await loadMigrations(${JSON.stringify(join(directory, 'db/migrations'))}), through: process.argv[2] });
          console.log(JSON.stringify(result));
        } catch (error) { console.error(error.message); process.exitCode = 1; }
      `);
      const run = (through: string) => spawnSync(process.execPath, [script, through], { encoding: "utf8" });
      const success = run("0001_first");
      expect(success.status).toBe(0);
      expect(JSON.parse(success.stdout).map((row: { id: string }) => row.id)).toEqual(["0000_tracking", "0001_first"]);
      const successfulState = JSON.parse(readFileSync(state, "utf8"));
      expect(successfulState.rows.map((row: { id: string }) => row.id)).toEqual(["0000_tracking", "0001_first"]);
      expect(successfulState.executed).toEqual(["CREATE TABLE IF NOT EXISTS schema_migrations (id text);"]);

      writeFileSync(state, JSON.stringify({ exists: true, rows: [{ id: "0009_existing", sha256: "abc" }], executed: [] }));
      const nonEmpty = run("0001_first");
      expect(nonEmpty.status).toBe(1);
      expect(nonEmpty.stderr).toContain("requires schema_migrations to be absent or empty");
      writeFileSync(state, JSON.stringify({ rows: [], executed: [] }));
      const unknown = run("9999_unknown");
      expect(unknown.status).toBe(1);
      expect(unknown.stderr).toContain("unknown migration id");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
