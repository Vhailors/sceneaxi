import { appendFileSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MAX_LOG_BYTES = 64 * 1024;

const LOG_FILES = ["diagnostics.log", "diagnostics.log.1", "diagnostics.log.2"] as const;

const EVENT_CODES = new Map([
  ["renderer-gone", "RENDER_PROCESS_LOST"],
  ["child-gone", "CHILD_PROCESS_LOST"],
  ["window-unresponsive", "APP_UNRESPONSIVE"],
  ["main-exception", "MAIN_UNCAUGHT_EXCEPTION"],
]);

export type DiagnosticEvent =
  | "renderer-gone"
  | "child-gone"
  | "window-unresponsive"
  | "main-exception";

/**
 * What a record may add to its code: Electron's process-loss reason and exit code,
 * the lost process type, and an exception's class name. Free-form messages and
 * stacks never reach the log, since they can carry a decrypted BYOK key or a path.
 */
export type DiagnosticDetail = Readonly<{
  reason?: string;
  exitCode?: number;
  processType?: string;
  errorName?: string;
}>;

const DETAIL_TOKEN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

const MAX_CRASH_DUMPS = 5;

export function mapDesktopDiagnosticEvent(source: "renderer" | "child"): DiagnosticEvent {
  return source === "renderer" ? "renderer-gone" : "child-gone";
}

/** A process that exited cleanly did not crash, so there is nothing to recover. */
export function desktopProcessLossNeedsRecovery(reason: string | undefined): boolean {
  return reason !== "clean-exit";
}

function detailFields(detail: DiagnosticDetail | undefined): Record<string, string | number> {
  const fields: Record<string, string | number> = {};

  if (detail === undefined) return fields;

  for (const key of ["reason", "processType", "errorName"] as const) {
    const value = detail[key];

    if (typeof value === "string" && DETAIL_TOKEN.test(value)) fields[key] = value;
  }

  if (Number.isSafeInteger(detail.exitCode)) fields["exitCode"] = detail.exitCode as number;

  return fields;
}

export function recordDesktopDiagnostic(
  logsDirectory: string,
  event: DiagnosticEvent,
  detail?: DiagnosticDetail,
): void {
  const code = EVENT_CODES.get(event);

  if (!code) return;

  try {
    mkdirSync(logsDirectory, { recursive: true, mode: 0o700 });
    const logPath = join(logsDirectory, LOG_FILES[0]);
    const record = `${JSON.stringify({ timestamp: new Date().toISOString(), code, ...detailFields(detail) })}\n`;
    const currentSize = exists(logPath) ? statSync(logPath).size : 0;

    if (currentSize + Buffer.byteLength(record) > MAX_LOG_BYTES) rotate(logsDirectory);

    appendFileSync(logPath, record, { encoding: "utf8", mode: 0o600 });
  } catch {
    // Diagnostics must not turn a process-loss notification into another crash.
  }
}

function exists(path: string): boolean {
  try {
    statSync(path);

    return true;
  } catch {
    return false;
  }
}

function rotate(directory: string): void {
  rmSync(join(directory, LOG_FILES[2]), { force: true });

  for (const [sourceName, targetName] of [[LOG_FILES[1], LOG_FILES[2]], [LOG_FILES[0], LOG_FILES[1]]] as const) {
    const source = join(directory, sourceName);

    if (!exists(source)) continue;

    if (statSync(source).size > MAX_LOG_BYTES) rmSync(source);
    else renameSync(source, join(directory, targetName));
  }

  writeFileSync(join(directory, LOG_FILES[0]), "", { mode: 0o600 });
}

/**
 * Keeps only the newest local minidumps. They are never uploaded, but one can hold
 * process memory (including a decrypted BYOK key), so they must not accumulate.
 */
export function pruneDesktopCrashDumps(crashDumpsDirectory: string, keep = MAX_CRASH_DUMPS): void {
  try {
    const dumps: { path: string; modified: number }[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith(".dmp")) dumps.push({ path, modified: statSync(path).mtimeMs });
      }
    };

    walk(crashDumpsDirectory);
    dumps.sort((left, right) => right.modified - left.modified);

    for (const dump of dumps.slice(keep)) rmSync(dump.path, { force: true });
  } catch {
    // Retention is best effort; a missing directory has nothing to prune.
  }
}
