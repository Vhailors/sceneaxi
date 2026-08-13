/**
 * Atomic document writes: tmp-then-rename.
 * A crash never leaves a half-written document at a canonical path.
 */

import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { contentHash } from "./content-hash.js";

export type AtomicWritePlan = {
  readonly path: string;
  readonly contents: string;
  readonly expectedContentHash?: string;
  readonly mustBeAbsent?: boolean;
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

type LockSetState = {
  readonly targets: ReadonlySet<string>;
  readonly held: readonly HeldLock[];
  active: boolean;
};

declare const atomicWriteLockSetBrand: unique symbol;
export type AtomicWriteLockSet = {
  readonly [atomicWriteLockSetBrand]: true;
};

const lockSetStates = new WeakMap<object, LockSetState>();

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

export function canonicalPath(path: string): string {
  let cursor = resolve(path);
  const suffix: string[] = [];
  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) break;
    suffix.unshift(basename(cursor));
    cursor = parent;
  }
  return resolve(realpathSync.native(cursor), ...suffix);
}

function artifactStem(path: string): string {
  return createHash("sha256")
    .update(canonicalPath(path), "utf8")
    .digest("hex")
    .slice(0, 32);
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

type ProcessIdentityMethod = "linux-proc" | "posix-ps" | "windows-cim";

function processIdentity(
  pid: number,
  method?: ProcessIdentityMethod,
): string | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (
    (method === undefined || method === "linux-proc") &&
    process.platform === "linux"
  ) {
    try {
      const bootId = readFileSync(
        "/proc/sys/kernel/random/boot_id",
        "utf8",
      ).trim();
      const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      const startTicks = fields[19];
      if (startTicks !== undefined && bootId.length > 0) {
        return `linux-proc:${bootId}:${String(pid)}:${startTicks}`;
      }
    } catch {
      if (method === "linux-proc") return null;
    }
  }
  if (
    (method === undefined || method === "windows-cim") &&
    process.platform === "win32"
  ) {
    try {
      const createdAt = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter "ProcessId = ${String(pid)}").CreationDate`,
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      return createdAt.length === 0
        ? null
        : `windows-cim:${String(pid)}:${createdAt}`;
    } catch {
      return null;
    }
  }
  if (method === undefined || method === "posix-ps") {
    try {
      const createdAt = execFileSync(
        "ps",
        ["-o", "lstart=", "-p", String(pid)],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      return createdAt.length === 0
        ? null
        : `posix-ps:${String(pid)}:${createdAt}`;
    } catch {
      return null;
    }
  }
  return null;
}

const CURRENT_PROCESS_IDENTITY = processIdentity(process.pid);

function processIdentityMethod(
  identity: string,
): ProcessIdentityMethod | undefined {
  return identity.startsWith("linux-proc:")
    ? "linux-proc"
    : identity.startsWith("windows-cim:")
      ? "windows-cim"
      : identity.startsWith("posix-ps:")
        ? "posix-ps"
        : undefined;
}

function identityFingerprint(identity: string): string {
  return createHash("sha256")
    .update(identity, "utf8")
    .digest("hex")
    .slice(0, 16);
}

type LockOwner = {
  readonly pid: number;
  readonly identity: string;
  readonly token: string;
};

function readLockOwner(lockPath: string): LockOwner | null {
  try {
    const value = JSON.parse(readFileSync(lockPath, "utf8")) as unknown;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const owner = value as Record<string, unknown>;
    if (
      typeof owner["pid"] !== "number" ||
      !Number.isInteger(owner["pid"]) ||
      owner["pid"] <= 0 ||
      typeof owner["identity"] !== "string" ||
      owner["identity"].length === 0 ||
      typeof owner["token"] !== "string" ||
      owner["token"].length === 0
    ) {
      return null;
    }
    return {
      pid: owner["pid"],
      identity: owner["identity"],
      token: owner["token"],
    };
  } catch {
    return null;
  }
}

function lockOwnerIsStale(owner: LockOwner): boolean {
  if (owner.pid === process.pid) {
    return owner.identity !== CURRENT_PROCESS_IDENTITY;
  }
  if (!processIsAlive(owner.pid)) return true;
  const method = processIdentityMethod(owner.identity);
  if (method === undefined) return false;
  const liveIdentity = processIdentity(owner.pid, method);
  return liveIdentity !== null && liveIdentity !== owner.identity;
}

function reclaimWorkPrefix(lockPath: string): string {
  const digest = createHash("sha256")
    .update(lockPath, "utf8")
    .digest("hex")
    .slice(0, 16);
  return `.sceneaxi-reclaim-working-${digest}-`;
}

type ReclaimWorkOwner = {
  readonly pid: number;
  readonly method: ProcessIdentityMethod;
  readonly identityFingerprint: string;
};

function reclaimMethodCode(method: ProcessIdentityMethod): "l" | "p" | "w" {
  return method === "linux-proc" ? "l" : method === "posix-ps" ? "p" : "w";
}

function reclaimMethodFromCode(
  code: string,
): ProcessIdentityMethod | undefined {
  return code === "l"
    ? "linux-proc"
    : code === "p"
      ? "posix-ps"
      : code === "w"
        ? "windows-cim"
        : undefined;
}

function reclaimWorkOwner(
  lockPath: string,
  name: string,
): ReclaimWorkOwner | null {
  const prefix = reclaimWorkPrefix(lockPath);
  if (!name.startsWith(prefix)) return null;
  const match = /^(\d+)-([lpw])-([0-9a-f]{16})-([0-9a-f]{32})$/.exec(
    name.slice(prefix.length),
  );
  if (match === null) return null;
  const pid = Number(match[1]);
  const method = reclaimMethodFromCode(match[2] as string);
  if (!Number.isInteger(pid) || pid <= 0 || method === undefined) return null;
  return {
    pid,
    method,
    identityFingerprint: match[3] as string,
  };
}

function reclaimWorkOwnerIsStale(owner: ReclaimWorkOwner): boolean {
  if (owner.pid === process.pid) {
    return (
      CURRENT_PROCESS_IDENTITY !== null &&
      identityFingerprint(CURRENT_PROCESS_IDENTITY) !==
        owner.identityFingerprint
    );
  }
  if (!processIsAlive(owner.pid)) return true;
  const liveIdentity = processIdentity(owner.pid, owner.method);
  return (
    liveIdentity !== null &&
    identityFingerprint(liveIdentity) !== owner.identityFingerprint
  );
}

function clearStaleReclaimWork(lockPath: string): boolean {
  const directory = dirname(lockPath);
  const prefix = reclaimWorkPrefix(lockPath);
  let names: readonly string[];
  try {
    names = readdirSync(directory).filter((name) => name.startsWith(prefix));
  } catch {
    return false;
  }
  let removed = false;
  for (const name of names) {
    const owner = reclaimWorkOwner(lockPath, name);
    if (owner === null || !reclaimWorkOwnerIsStale(owner)) return false;
    try {
      unlinkSync(join(directory, name));
      removed = true;
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? (error as NodeJS.ErrnoException).code
          : undefined;
      if (code !== "ENOENT") return false;
    }
  }
  if (removed) {
    try {
      syncDirectory(directory);
    } catch {
      return false;
    }
  }
  return true;
}

function cleanReclaimWork(
  workPath: string,
  lockPath: string,
  removed: boolean,
): void {
  try {
    unlinkSync(workPath);
    syncDirectory(dirname(workPath));
  } catch {
    if (removed) throw new AtomicWriteLockError(lockPath);
  }
}

function removeStaleLock(lockPath: string): boolean {
  if (
    CURRENT_PROCESS_IDENTITY === null ||
    !clearStaleReclaimWork(lockPath)
  ) {
    return false;
  }
  const currentMethod = processIdentityMethod(CURRENT_PROCESS_IDENTITY);
  if (currentMethod === undefined) return false;
  const claimPath = `${lockPath}.reclaim`;
  if (!existsSync(claimPath)) {
    try {
      linkSync(lockPath, claimPath);
      syncDirectory(dirname(lockPath));
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? (error as NodeJS.ErrnoException).code
          : undefined;
      if (code !== "EEXIST") return false;
    }
  }
  const workPath = join(
    dirname(lockPath),
    `${reclaimWorkPrefix(lockPath)}${String(process.pid)}-${reclaimMethodCode(
      currentMethod,
    )}-${identityFingerprint(CURRENT_PROCESS_IDENTITY)}-${randomBytes(16)
      .toString("hex")}`,
  );
  try {
    renameSync(claimPath, workPath);
    syncDirectory(dirname(lockPath));
  } catch {
    return false;
  }
  let removed = false;
  try {
    const claimed = statSync(workPath);
    let current: ReturnType<typeof statSync>;
    try {
      current = statSync(lockPath);
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? (error as NodeJS.ErrnoException).code
          : undefined;
      return code === "ENOENT";
    }
    if (claimed.dev !== current.dev || claimed.ino !== current.ino) return true;
    const owner = readLockOwner(workPath);
    if (owner === null || !lockOwnerIsStale(owner)) return false;
    unlinkSync(lockPath);
    syncDirectory(dirname(lockPath));
    removed = true;
    return true;
  } catch {
    return false;
  } finally {
    cleanReclaimWork(workPath, lockPath, removed);
  }
}

function cleanLockCandidate(
  candidatePath: string,
  path: string,
  acquired: boolean,
): void {
  try {
    unlinkSync(candidatePath);
    syncDirectory(dirname(candidatePath));
  } catch {
    if (!acquired) throw new AtomicWriteLockError(path);
  }
}

function acquireLocks(paths: readonly string[]): readonly HeldLock[] {
  const held: HeldLock[] = [];
  const token = randomBytes(16).toString("hex");
  try {
    for (const path of [...new Set(paths)].sort()) {
      if (CURRENT_PROCESS_IDENTITY === null) {
        throw new AtomicWriteLockError(path);
      }
      const lockPath = lockPathFor(path);
      const claimPath = `${lockPath}.reclaim`;
      const candidatePath = `${lockPath}.candidate-${token}`;
      ensureDirectory(dirname(lockPath));
      writeDurableFile(
        candidatePath,
        JSON.stringify({
          pid: process.pid,
          identity: CURRENT_PROCESS_IDENTITY,
          token,
        }),
      );
      syncDirectory(dirname(lockPath));
      let acquired = false;
      try {
        for (let attempt = 0; attempt < 2 && !acquired; attempt += 1) {
          if (!clearStaleReclaimWork(lockPath)) {
            throw new AtomicWriteLockError(path);
          }
          if (existsSync(claimPath) && !removeStaleLock(lockPath)) {
            throw new AtomicWriteLockError(path);
          }
          try {
            linkSync(candidatePath, lockPath);
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
          syncDirectory(dirname(lockPath));
          acquired = true;
        }
      } finally {
        cleanLockCandidate(candidatePath, path, acquired);
      }
      if (!acquired) throw new AtomicWriteLockError(path);
    }
    return held;
  } catch (error) {
    releaseLocks(held, false);
    throw error;
  }
}

export function acquireAtomicWriteLocks(
  paths: readonly string[],
): AtomicWriteLockSet {
  const targets = new Set(paths.map((path) => canonicalPath(path)));
  const lockSet = Object.freeze({}) as AtomicWriteLockSet;
  lockSetStates.set(lockSet, {
    targets,
    held: acquireLocks([...targets]),
    active: true,
  });
  return lockSet;
}

export function releaseAtomicWriteLocks(lockSet: AtomicWriteLockSet): void {
  const state = lockSetStates.get(lockSet);
  if (state === undefined || !state.active) {
    throw new AtomicWriteLockError("lock capability");
  }
  state.active = false;
  releaseLocks(state.held, false);
}

export function releaseAtomicWriteLocksChecked(
  lockSet: AtomicWriteLockSet,
): readonly string[] {
  const state = lockSetStates.get(lockSet);
  if (state === undefined || !state.active) {
    throw new AtomicWriteLockError("lock capability");
  }
  const failures = releaseLocks(state.held, true);
  const remaining = state.held
    .map((lock) => lock.path)
    .filter((path) => existsSync(path));
  if (failures.length === 0 && remaining.length === 0) {
    state.active = false;
    return Object.freeze([]);
  }
  return Object.freeze([...new Set([...failures, ...remaining])].sort());
}

export function atomicWriteLockArtifactPaths(
  lockSet: AtomicWriteLockSet,
): readonly string[] {
  const state = lockSetStates.get(lockSet);
  if (state === undefined || !state.active) {
    throw new AtomicWriteLockError("lock capability");
  }
  return Object.freeze(state.held.map((lock) => lock.path));
}

function releaseLocks(
  held: readonly HeldLock[],
  verifyOwnership: boolean,
): readonly string[] {
  const syncedDirectories = new Set<string>();
  const failures = new Set<string>();
  for (const lock of [...held].reverse()) {
    let owner: { token?: unknown };
    try {
      owner = JSON.parse(readFileSync(lock.path, "utf8")) as {
        token?: unknown;
      };
    } catch (error) {
      const code = error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      if (code === "ENOENT") syncedDirectories.add(dirname(lock.path));
      else if (verifyOwnership) failures.add(lock.path);
      else {
        try {
          unlinkSync(lock.path);
          syncedDirectories.add(dirname(lock.path));
        } catch {
          failures.add(lock.path);
        }
      }
      continue;
    }
    if (owner.token !== lock.token) {
      failures.add(lock.path);
      continue;
    }
    try {
      unlinkSync(lock.path);
      syncedDirectories.add(dirname(lock.path));
    } catch (error) {
      const code = error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      if (code === "ENOENT") syncedDirectories.add(dirname(lock.path));
      else failures.add(lock.path);
    }
  }
  for (const directory of syncedDirectories) {
    try {
      syncDirectory(directory);
    } catch {
      failures.add(directory);
      continue;
    }
  }
  return Object.freeze([...failures].sort());
}

function currentHash(path: string): string | null {
  return existsSync(path) ? contentHash(readFileSync(path, "utf8")) : null;
}

function requireActiveLockSet(
  lockSet: AtomicWriteLockSet,
  targets: ReadonlySet<string>,
): LockSetState {
  const state = lockSetStates.get(lockSet);
  if (state === undefined || !state.active) {
    throw new AtomicWriteLockError("lock capability");
  }
  for (const target of targets) {
    if (!state.targets.has(target)) throw new AtomicWriteLockError(target);
  }
  for (const lock of state.held) {
    try {
      const owner = JSON.parse(readFileSync(lock.path, "utf8")) as {
        token?: unknown;
      };
      if (owner.token !== lock.token) throw new AtomicWriteLockError(lock.path);
    } catch (error) {
      if (error instanceof AtomicWriteLockError) throw error;
      throw new AtomicWriteLockError(lock.path);
    }
  }
  return state;
}

export function verifyAtomicWritePreconditions(
  plans: readonly AtomicWritePlan[],
  lockSet: AtomicWriteLockSet,
): void {
  const normalized = plans.map((plan) => ({
    ...plan,
    path: canonicalPath(plan.path),
  }));
  requireActiveLockSet(lockSet, new Set(normalized.map((plan) => plan.path)));
  for (const plan of normalized) {
    const actual = currentHash(plan.path);
    if (plan.mustBeAbsent === true && actual !== null) {
      throw new AtomicWriteConflictError(plan.path, "absent", actual);
    }
    if (plan.expectedContentHash === undefined) continue;
    if (actual !== plan.expectedContentHash) {
      throw new AtomicWriteConflictError(
        plan.path,
        plan.expectedContentHash,
        actual,
      );
    }
  }
}

export function atomicWriteFile(
  path: string,
  contents: string,
  options: {
    readonly token?: string;
    readonly expectedContentHash?: string;
    readonly mustBeAbsent?: boolean;
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
        ...(options.mustBeAbsent === undefined
          ? {}
          : { mustBeAbsent: options.mustBeAbsent }),
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

  const normalized = plans.map((plan) => ({
    ...plan,
    path: canonicalPath(plan.path),
  }));
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

  const lockSet =
    options.lockSet ??
    acquireAtomicWriteLocks(normalized.map((plan) => plan.path));
  const ownsLockSet = options.lockSet === undefined;
  const staged: Array<{
    path: string;
    tmp: string;
    bak: string | null;
    hadOriginal: boolean;
  }> = [];
  let committed = 0;

  try {
    verifyAtomicWritePreconditions(normalized, lockSet);

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
    if (ownsLockSet) releaseAtomicWriteLocks(lockSet);
  }
}

export function readTextFile(path: string): string {
  return readFileSync(path, "utf8");
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}
