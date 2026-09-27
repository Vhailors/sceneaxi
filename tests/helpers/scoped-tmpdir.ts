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
 * A run killed before teardown leaves its directory behind; a later run removes
 * run directories untouched for a day. Age, not pid liveness, decides: sandboxed
 * runs live in separate pid namespaces, so a live run's pid can look dead from
 * another run and its directory would be deleted under it.
 */
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PREFIX = "sceneaxi-vitest-";
const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

function removeAbandonedRuns(parent: string): void {
  const cutoff = Date.now() - ABANDONED_AFTER_MS;
  for (const name of readdirSync(parent)) {
    if (!name.startsWith(PREFIX)) continue;
    const path = join(parent, name);
    try {
      if (statSync(path).mtimeMs < cutoff) rmSync(path, { recursive: true, force: true });
    } catch {
      // Another run removed it first; nothing to clean.
    }
  }
}

export default function setup(): () => void {
  const parent = tmpdir();
  removeAbandonedRuns(parent);
  const root = mkdtempSync(join(parent, PREFIX));
  const previous = process.env["TMPDIR"];
  process.env["TMPDIR"] = root;
  return () => {
    if (previous === undefined) delete process.env["TMPDIR"];
    else process.env["TMPDIR"] = previous;
    rmSync(root, { recursive: true, force: true });
  };
}
