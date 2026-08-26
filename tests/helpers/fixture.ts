import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const COPY_TOPS = ["docs", "packages", "apps", "sites", "desktop", "db", "scripts", "tests", ".github"];
/**
 * Root files the gate scripts read: `check-sites` reads the manifest and workspace,
 * `check-publish-ready` reads the manifest scripts and the SDK-output ignores, and
 * `check-boundaries` reads each package's tsconfig alias table — which every package
 * config inherits from the root ones, so a fixture without them models a different
 * config chain than the tree it copies.
 */
const COPY_FILES = [
  "package.json",
  "pnpm-workspace.yaml",
  ".gitignore",
  "tsconfig.json",
  "tsconfig.base.json",
  "vitest.config.ts",
];
// `release` and `dist-build` are desktop-tier packaging output (ADR 0024): heavy
// binaries the checkers never read, so copying them would only slow every fixture.
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", "release", "dist-build"]);

/**
 * Copy the parts of the repo the gate scripts read (manifests, sources, matrix,
 * scripts, and the root `tests` tree whose files contracts name as evidence)
 * into a throwaway root, so violation injections never touch the real tree.
 * node_modules is linked, not copied, so scripts keep resolving deps.
 */
export function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-gate-fixture-"));
  for (const top of COPY_TOPS) {
    cpSync(join(repoRoot, top), join(root, top), {
      recursive: true,
      filter: (src) => !SKIP_DIRS.has(basename(src)),
    });
  }
  for (const file of COPY_FILES) {
    cpSync(join(repoRoot, file), join(root, file));
  }
  symlinkSync(join(repoRoot, "node_modules"), join(root, "node_modules"), "dir");
  for (const top of ["packages", "apps", "sites", "desktop"]) {
    for (const entry of readdirSync(join(repoRoot, top), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sourceModules = join(repoRoot, top, entry.name, "node_modules");
      if (existsSync(sourceModules)) {
        symlinkSync(sourceModules, join(root, top, entry.name, "node_modules"), "dir");
      }
    }
  }
  return root;
}

export function removeFixture(root: string): void {
  rmSync(root, { recursive: true, force: true });
}

interface ManifestLike {
  name?: string;
  dependencies?: Record<string, string>;
  sceneaxi?: { releaseGroup?: string; corePin?: string };
  [key: string]: unknown;
}

export function editManifest(
  root: string,
  rel: string,
  mutate: (manifest: ManifestLike) => void,
): void {
  const path = join(root, rel);
  const manifest: ManifestLike = JSON.parse(readFileSync(path, "utf8"));
  mutate(manifest);
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
}

export function appendTo(root: string, rel: string, text: string): void {
  appendFileSync(join(root, rel), text);
}

export function writeTo(root: string, rel: string, text: string): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

export function runCheck(
  root: string,
  script:
    | "check-boundaries.mjs"
    | "check-syntax.mjs"
    | "check-sites.mjs"
    | "check-desktop.mjs"
    | "check-contracts.mjs"
    | "check-publish-ready.mjs"
    | "check-traceability.mjs",
): { status: number | null; stdout: string; stderr: string } {
  return spawnSync(process.execPath, [join(root, "scripts", script)], {
    encoding: "utf8",
  });
}
