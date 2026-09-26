import { appendFileSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
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

export function mapDesktopDiagnosticEvent(source: "renderer" | "child"): DiagnosticEvent {
  return source === "renderer" ? "renderer-gone" : "child-gone";
}

export function recordDesktopDiagnostic(
  logsDirectory: string,
  event: DiagnosticEvent,
): void {
  const code = EVENT_CODES.get(event);

  if (!code) return;

  try {
    mkdirSync(logsDirectory, { recursive: true });
    const logPath = join(logsDirectory, LOG_FILES[0]);
    const record = `${JSON.stringify({ timestamp: new Date().toISOString(), code })}\n`;
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
