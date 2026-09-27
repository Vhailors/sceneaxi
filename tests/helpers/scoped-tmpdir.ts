/**
 * Vitest global setup: every run gets its own TMPDIR and removes it on teardown.
 *
 * Many suites create `mkdtemp` fixtures (whole-tree copies for the process-level
 * checkers, scratch projects, journals) and do not delete them. Across gate runs
 * those leaks exhausted the host's /tmp inodes, which then failed unrelated work
 * with ENOSPC. Pointing TMPDIR at one run-owned directory bounds every leak to
 * the run: workers and spawned binaries inherit the variable, and `os.tmpdir()`
 * reads it on each call.
 *
 * A run killed before teardown leaves its directory behind; the next run removes
 * directories whose owning process is gone. The pid is part of the name for that.
 */
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PREFIX = "sceneaxi-vitest-";

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to someone else.
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
}

function removeAbandonedRuns(parent: string): void {
  for (const name of readdirSync(parent)) {
    const pid = Number(/^sceneaxi-vitest-([0-9]+)-/.exec(name)?.[1]);
    if (Number.isSafeInteger(pid) && pid > 0 && !processAlive(pid)) {
      rmSync(join(parent, name), { recursive: true, force: true });
    }
  }
}

export default function setup(): () => void {
  const parent = tmpdir();
  removeAbandonedRuns(parent);
  const root = mkdtempSync(join(parent, `${PREFIX}${process.pid}-`));
  const previous = process.env["TMPDIR"];
  process.env["TMPDIR"] = root;
  return () => {
    if (previous === undefined) delete process.env["TMPDIR"];
    else process.env["TMPDIR"] = previous;
    rmSync(root, { recursive: true, force: true });
  };
}
