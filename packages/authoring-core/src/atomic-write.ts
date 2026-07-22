/**
 * Atomic document writes: tmp-then-rename.
 * A crash never leaves a half-written document at a canonical path.
 */

import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { contentHash } from "./content-hash.js";

export type AtomicWritePlan = {
  readonly path: string;
  readonly contents: string;
  readonly expectedContentHash?: string;
};

export class AtomicWriteConflictError extends Error {
  readonly path: string;
  readonly expectedContentHash: string;
  readonly currentContentHash: string | null;

  constructor(
    path: string,
    expectedContentHash: string,
    currentContentHash: string | null,
  ) {
    super(`Atomic write precondition failed for ${path}.`);
    this.name = "AtomicWriteConflictError";
    this.path = path;
    this.expectedContentHash = expectedContentHash;
    this.currentContentHash = currentContentHash;
  }
}

export class AtomicWriteLockError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(`Another write is already in progress for ${path}.`);
    this.name = "AtomicWriteLockError";
    this.path = path;
  }
}

export class AtomicWriteError extends Error {
  readonly rollbackComplete: boolean;

  constructor(message: string, rollbackComplete: boolean, cause: unknown) {
    super(message, { cause });
    this.name = "AtomicWriteError";
    this.rollbackComplete = rollbackComplete;
  }
}

type HeldLock = {
  readonly path: string;
  readonly token: string;
};

export type AtomicWriteLockSet = {
  readonly targets: ReadonlySet<string>;
  readonly held: readonly HeldLock[];
};

function syncDirectory(path: string): void {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function ensureDirectory(path: string): void {
  const missing: string[] = [];
  let cursor = resolve(path);
  while (!existsSync(cursor)) {
    missing.push(cursor);
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  mkdirSync(path, { recursive: true });
  for (const created of missing.reverse()) {
    syncDirectory(dirname(created));
    syncDirectory(created);
  }
}

function writeDurableFile(path: string, contents: string): void {
  const fd = openSync(path, "w");
  try {
    writeFileSync(fd, contents, { encoding: "utf8" });
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function syncFile(path: string): void {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function basenameSafe(path: string): string {
  const base = path.split(/[/\\]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function artifactStem(path: string): string {
  const digest = createHash("sha256")
    .update(resolve(path), "utf8")
    .digest("hex")
    .slice(0, 16);
  return `${basenameSafe(path)}-${digest}`;
}

function lockPathFor(path: string): string {
  return join(dirname(path), `.sceneaxi-lock-${artifactStem(path)}`);
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ESRCH"
    );
  }
}

function processIdentity(pid: number): string | null {
  try {
    const bootId = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
    const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    const startTicks = fields[19];
    return startTicks === undefined || bootId.length === 0
      ? null
      : `${bootId}:${String(pid)}:${startTicks}`;
  } catch {
    return null;
  }
}

const CURRENT_PROCESS_IDENTITY =
  processIdentity(process.pid) ??
  `runtime:${String(process.pid)}:${randomBytes(16).toString("hex")}`;

function removeLockFile(lockPath: string): boolean {
  try {
    unlinkSync(lockPath);
    syncDirectory(dirname(lockPath));
    return true;
  } catch {
    return false;
  }
}

function lockIsOld(lockPath: string): boolean {
  try {
    return Date.now() - statSync(lockPath).mtimeMs >= 30_000;
  } catch {
    return false;
  }
}

function removeStaleLock(lockPath: string): boolean {
  let owner: unknown;
  try {
    owner = JSON.parse(readFileSync(lockPath, "utf8")) as unknown;
  } catch {
    return lockIsOld(lockPath) && removeLockFile(lockPath);
  }
  if (
    owner === null ||
    typeof owner !== "object" ||
    typeof (owner as { pid?: unknown }).pid !== "number" ||
    typeof (owner as { identity?: unknown }).identity !== "string"
  ) {
    return lockIsOld(lockPath) && removeLockFile(lockPath);
  }
  const ownerPid = (owner as { pid: number }).pid;
  const ownerIdentity = (owner as { identity: string }).identity;
  if (ownerPid === process.pid) {
    return ownerIdentity !== CURRENT_PROCESS_IDENTITY && removeLockFile(lockPath);
  }
  const liveIdentity = processIdentity(ownerPid);
  if (
    liveIdentity === ownerIdentity ||
    (liveIdentity === null && processIsAlive(ownerPid))
  ) {
    return false;
  }
  return removeLockFile(lockPath);
}

function acquireLocks(paths: readonly string[]): readonly HeldLock[] {
  const held: HeldLock[] = [];
  const token = randomBytes(16).toString("hex");
  try {
    for (const path of [...new Set(paths)].sort()) {
      const lockPath = lockPathFor(path);
      ensureDirectory(dirname(lockPath));
      let acquired = false;
      for (let attempt = 0; attempt < 2 && !acquired; attempt += 1) {
        let fd: number;
        try {
          fd = openSync(lockPath, "wx");
        } catch (error) {
          const code =
            error instanceof Error && "code" in error
              ? (error as NodeJS.ErrnoException).code
              : undefined;
          if (code !== "EEXIST" || !removeStaleLock(lockPath)) {
            throw new AtomicWriteLockError(path);
          }
          continue;
        }
        held.push({ path: lockPath, token });
        try {
          writeFileSync(
            fd,
            JSON.stringify({
              pid: process.pid,
              identity: CURRENT_PROCESS_IDENTITY,
              token,
            }),
            "utf8",
          );
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        syncDirectory(dirname(lockPath));
        acquired = true;
      }
      if (!acquired) throw new AtomicWriteLockError(path);
    }
    return held;
  } catch (error) {
    releaseLocks(held);
    throw error;
  }
}

export function acquireAtomicWriteLocks(
  paths: readonly string[],
): AtomicWriteLockSet {
  const targets = new Set(paths.map((path) => resolve(path)));
  return { targets, held: acquireLocks([...targets]) };
}

export function releaseAtomicWriteLocks(lockSet: AtomicWriteLockSet): void {
  releaseLocks(lockSet.held);
}

function releaseLocks(held: readonly HeldLock[]): void {
  const syncedDirectories = new Set<string>();
  for (const lock of [...held].reverse()) {
    try {
      const owner = JSON.parse(readFileSync(lock.path, "utf8")) as {
        token?: unknown;
      };
      if (owner.token === lock.token) {
        unlinkSync(lock.path);
        syncedDirectories.add(dirname(lock.path));
      }
    } catch {
      try {
        unlinkSync(lock.path);
        syncedDirectories.add(dirname(lock.path));
      } catch {
        continue;
      }
    }
  }
  for (const directory of syncedDirectories) {
    try {
      syncDirectory(directory);
    } catch {
      continue;
    }
  }
}

function currentHash(path: string): string | null {
  return existsSync(path) ? contentHash(readFileSync(path, "utf8")) : null;
}

export function atomicWriteFile(
  path: string,
  contents: string,
  options: {
    readonly token?: string;
    readonly expectedContentHash?: string;
    readonly lockSet?: AtomicWriteLockSet;
  } = {},
): void {
  atomicWriteAll(
    [
      {
        path,
        contents,
        ...(options.expectedContentHash === undefined
          ? {}
          : { expectedContentHash: options.expectedContentHash }),
      },
    ],
    options,
  );
}

export function atomicWriteAll(
  plans: readonly AtomicWritePlan[],
  options: {
    readonly token?: string;
    readonly lockSet?: AtomicWriteLockSet;
  } = {},
): void {
  if (plans.length === 0) return;

  const normalized = plans.map((plan) => ({ ...plan, path: resolve(plan.path) }));
  const targets = new Set<string>();
  for (const plan of normalized) {
    if (targets.has(plan.path)) {
      throw new AtomicWriteError(
        `Atomic write plans contain duplicate target ${plan.path}.`,
        true,
        undefined,
      );
    }
    targets.add(plan.path);
  }

  const token = options.token ?? randomBytes(8).toString("hex");
  if (!/^[a-zA-Z0-9-]+$/.test(token)) {
    throw new Error(
      "Atomic write token must contain only letters, digits, or hyphens.",
    );
  }

  for (const plan of normalized) {
    if (
      options.lockSet !== undefined &&
      !options.lockSet.targets.has(plan.path)
    ) {
      throw new AtomicWriteLockError(plan.path);
    }
  }
  const locks =
    options.lockSet === undefined
      ? acquireLocks(normalized.map((plan) => plan.path))
      : null;
  const staged: Array<{
    path: string;
    tmp: string;
    bak: string | null;
    hadOriginal: boolean;
  }> = [];
  let committed = 0;

  try {
    for (const plan of normalized) {
      if (plan.expectedContentHash !== undefined) {
        const actual = currentHash(plan.path);
        if (actual !== plan.expectedContentHash) {
          throw new AtomicWriteConflictError(
            plan.path,
            plan.expectedContentHash,
            actual,
          );
        }
      }
    }

    for (const plan of normalized) {
      const dir = dirname(plan.path);
      ensureDirectory(dir);
      const tmp = join(dir, `.sceneaxi-tmp-${token}-${artifactStem(plan.path)}`);
      const hadOriginal = existsSync(plan.path);
      const item = {
        path: plan.path,
        tmp,
        bak: null as string | null,
        hadOriginal,
      };
      staged.push(item);
      writeDurableFile(tmp, plan.contents);

      if (hadOriginal) {
        item.bak = join(
          dir,
          `.sceneaxi-bak-${token}-${artifactStem(plan.path)}`,
        );
        copyFileSync(plan.path, item.bak);
        syncFile(item.bak);
      }
      syncDirectory(dir);
    }

    for (const item of staged) {
      renameSync(item.tmp, item.path);
      committed += 1;
    }
    for (const directory of new Set(staged.map((item) => dirname(item.path)))) {
      syncDirectory(directory);
    }

    for (const item of staged) {
      try {
        if (item.bak !== null && existsSync(item.bak)) unlinkSync(item.bak);
        if (existsSync(item.tmp)) unlinkSync(item.tmp);
      } catch {
        continue;
      }
    }
    for (const directory of new Set(staged.map((item) => dirname(item.path)))) {
      try {
        syncDirectory(directory);
      } catch {
        continue;
      }
    }
  } catch (error) {
    if (
      error instanceof AtomicWriteConflictError ||
      error instanceof AtomicWriteLockError
    ) {
      throw error;
    }

    let rollbackComplete = true;
    for (let index = committed - 1; index >= 0; index -= 1) {
      const item = staged[index];
      if (item === undefined) continue;
      try {
        if (item.bak !== null && existsSync(item.bak)) {
          renameSync(item.bak, item.path);
        } else if (!item.hadOriginal && existsSync(item.path)) {
          unlinkSync(item.path);
        } else {
          rollbackComplete = false;
        }
        syncDirectory(dirname(item.path));
      } catch {
        rollbackComplete = false;
      }
    }

    for (const item of staged) {
      try {
        if (existsSync(item.tmp)) unlinkSync(item.tmp);
        if (rollbackComplete && item.bak !== null && existsSync(item.bak)) {
          unlinkSync(item.bak);
        }
      } catch {
        continue;
      }
    }

    throw new AtomicWriteError(
      "Atomic write failed.",
      rollbackComplete,
      error,
    );
  } finally {
    if (locks !== null) releaseLocks(locks);
  }
}

export function readTextFile(path: string): string {
  return readFileSync(path, "utf8");
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}
