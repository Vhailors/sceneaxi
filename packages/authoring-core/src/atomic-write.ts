/**
 * Atomic document writes: tmp-then-rename.
 * A crash never leaves a half-written document at a canonical path.
 */

import {
  renameSync,
  writeFileSync,
  unlinkSync,
  existsSync,
  mkdirSync,
  readFileSync,
  copyFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

export type AtomicWritePlan = {
  readonly path: string;
  readonly contents: string;
};

/**
 * Write a single file atomically via tmp-then-rename in the destination directory.
 */
export function atomicWriteFile(path: string, contents: string): void {
  atomicWriteAll([{ path, contents }]);
}

/**
 * All-or-nothing multi-file atomic write.
 *
 * Strategy:
 * 1. Write every new body to a unique `.sceneaxi-tmp-*` sibling.
 * 2. Snapshot existing targets to `.sceneaxi-bak-*` (for rollback).
 * 3. Rename each tmp → target.
 * 4. On any failure after step 3 starts, restore backups and clean temps.
 * 5. Delete backups on success.
 *
 * Mid-write, the canonical path never holds a partial body (only whole renames).
 */
export function atomicWriteAll(plans: readonly AtomicWritePlan[]): void {
  if (plans.length === 0) return;

  const token = randomBytes(8).toString("hex");
  const staged: Array<{
    path: string;
    tmp: string;
    bak: string | null;
    hadOriginal: boolean;
  }> = [];

  try {
    for (const plan of plans) {
      const dir = dirname(plan.path);
      mkdirSync(dir, { recursive: true });
      const tmp = join(dir, `.sceneaxi-tmp-${token}-${basenameSafe(plan.path)}`);
      writeFileSync(tmp, plan.contents, { encoding: "utf8" });

      const hadOriginal = existsSync(plan.path);
      let bak: string | null = null;
      if (hadOriginal) {
        bak = join(dir, `.sceneaxi-bak-${token}-${basenameSafe(plan.path)}`);
        copyFileSync(plan.path, bak);
      }
      staged.push({ path: plan.path, tmp, bak, hadOriginal });
    }

    // Commit phase: rename tmp → final. If this fails mid-way, roll back.
    let committed = 0;
    try {
      for (const item of staged) {
        renameSync(item.tmp, item.path);
        committed += 1;
      }
    } catch (err) {
      // Roll back committed renames from backups / delete newly created files.
      for (let i = 0; i < committed; i++) {
        const item = staged[i];
        if (item === undefined) continue;
        if (item.bak !== null && existsSync(item.bak)) {
          copyFileSync(item.bak, item.path);
        } else if (!item.hadOriginal && existsSync(item.path)) {
          unlinkSync(item.path);
        }
      }
      throw err;
    }

    // Success: remove backups and any leftover temps.
    for (const item of staged) {
      if (item.bak !== null && existsSync(item.bak)) {
        unlinkSync(item.bak);
      }
      if (existsSync(item.tmp)) {
        unlinkSync(item.tmp);
      }
    }
  } catch (err) {
    // Best-effort cleanup of temps/backups that never committed.
    for (const item of staged) {
      if (existsSync(item.tmp)) {
        try {
          unlinkSync(item.tmp);
        } catch {
          /* ignore */
        }
      }
      if (item.bak !== null && existsSync(item.bak)) {
        try {
          // If the original is missing/corrupt after failure, restore it.
          if (!existsSync(item.path)) {
            copyFileSync(item.bak, item.path);
          }
          unlinkSync(item.bak);
        } catch {
          /* ignore */
        }
      }
    }
    throw err;
  }
}

function basenameSafe(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Read utf8 file text; throws if missing. */
export function readTextFile(path: string): string {
  return readFileSync(path, "utf8");
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}
