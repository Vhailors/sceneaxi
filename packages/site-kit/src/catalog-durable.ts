/** Bounded TEST intake registry. No listing/commerce activation, no asset payload storage.
 * Directory must be private, provisioned and exclusively owned by the deployment.
 * Lock contention/stale locks refuse; operators recover locks, never this reader.
 */
import { constants } from "node:fs";
import { lstat, open, realpath, rename, unlink, mkdir, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createInMemoryCatalogTestPipelineProvider, validRecord, type CatalogTestPipelineProvider } from "./catalog-pipeline.js";
import { refuse, type SiteResult } from "./refusals.js";

export const CATALOG_REGISTRY_MAX_BYTES = 4 * 1024 * 1024;

export const CATALOG_REGISTRY_MAX_EVENTS = 512;

type Event = { kind: "submit"; input: Parameters<CatalogTestPipelineProvider["submit"]>[0] } |
  { kind: "transition"; input: Parameters<CatalogTestPipelineProvider["commitTransition"]>[0] };

export function createDurableCatalogTestPipelineProvider(directory: string): CatalogTestPipelineProvider {
  const configured = directory.trim().length > 0;
  const root = resolve(directory);
  const registry = join(root, "intake-registry.json");
  const lock = join(root, ".intake-registry.lock");

  async function operation<T>(action: (provider: CatalogTestPipelineProvider, events: Event[]) => Promise<SiteResult<T>>): Promise<SiteResult<T>> {
    if (!configured) return refuse("CATALOG_INTAKE_STORAGE_UNAVAILABLE");
    let locked = false;

    try {
      if (await realpath(root) !== root || !(await lstat(root)).isDirectory()) return refuse("CATALOG_INTAKE_STORAGE_UNAVAILABLE");
      await mkdir(lock, { mode: 0o700 }); locked = true;
      let bytes: Buffer | undefined;

      try {
        const handle = await open(registry, constants.O_RDONLY | constants.O_NOFOLLOW);

        try {
          const info = await handle.stat();

          if (!info.isFile() || info.size > CATALOG_REGISTRY_MAX_BYTES) return refuse("CATALOG_PIPELINE_READ_MODEL_INVALID");
          bytes = await handle.readFile();

          if (bytes.length > CATALOG_REGISTRY_MAX_BYTES) return refuse("CATALOG_PIPELINE_READ_MODEL_INVALID");
        } finally { await handle.close(); }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }

      const provider = createInMemoryCatalogTestPipelineProvider();
      const events: Event[] = [];

      if (bytes !== undefined) {
        try {
          const parsed = JSON.parse(bytes.toString("utf8")) as { version: number; events: Event[] };

          if (parsed.version !== 1 || !Array.isArray(parsed.events) || parsed.events.length > CATALOG_REGISTRY_MAX_EVENTS) throw new Error("invalid registry");

          for (const event of parsed.events) {
            if (event.kind === "submit") {
              if (!validRecord(event.input.record) || event.input.record.item.moderation.pipelineState !== "intake") throw new Error("invalid intake");

              if (!(await provider.submit(event.input)).ok) throw new Error("invalid replay");
            } else if (event.kind === "transition") {
              // Durable intake is quarantine-only. Curation requires a separate authenticated operator adapter.
              throw new Error("unapproved transition");
            } else throw new Error("invalid event");
            events.push(event);
          }
        } catch {
          try {
            const quarantine = await open(join(root, "quarantine-invalid.json"), "wx", 0o600);

            try { await quarantine.writeFile(bytes); await quarantine.sync(); } finally { await quarantine.close(); }
          } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }

          return refuse("CATALOG_PIPELINE_READ_MODEL_INVALID");
        }
      }

      const previousLength = events.length;
      const result = await action(provider, events);

      if (!result.ok || events.length === previousLength) return result;
      const next = Buffer.from(JSON.stringify({ version: 1, events }), "utf8");

      if (events.length > CATALOG_REGISTRY_MAX_EVENTS || next.length > CATALOG_REGISTRY_MAX_BYTES) return refuse("CATALOG_INTAKE_STORAGE_UNAVAILABLE");
      const temporary = join(root, `.intake-${randomUUID()}.tmp`);

      try {
        const handle = await open(temporary, "wx", 0o600);

        try { await handle.writeFile(next); await handle.sync(); } finally { await handle.close(); }

        await rename(temporary, registry);

        if (process.platform !== "win32") {
          const dir = await open(root, constants.O_RDONLY);

          try { await dir.sync(); } finally { await dir.close(); }
        }
      } finally { await unlink(temporary).catch(() => undefined); }

      return result;
    } catch { return refuse("CATALOG_INTAKE_STORAGE_UNAVAILABLE"); }
    finally { if (locked) await rmdir(lock).catch(() => undefined); }
  }

  return Object.freeze({ mode: "test" as const,
    submit(input: Parameters<CatalogTestPipelineProvider["submit"]>[0]) {
      return operation(async (provider, events) => {
        if (!validRecord(input.record) || input.record.item.moderation.pipelineState !== "intake") return refuse("CATALOG_PIPELINE_READ_MODEL_INVALID");
        const result = await provider.submit(input);

        if (result.ok && !result.value.replayed) events.push({ kind: "submit", input: structuredClone(input) });

        return result;
      });
    },
    read(itemId: string) { return operation(provider => provider.read(itemId)); },
    async commitTransition() { return refuse("CATALOG_PIPELINE_TRANSITION_INVALID"); },
  });
}
