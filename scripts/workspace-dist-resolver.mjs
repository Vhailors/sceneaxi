/**
 * ESM resolver hook mapping `@sceneaxi/*` bare specifiers onto built output.
 *
 * Shared by every runnable binary in the workspace (`packages/cli/bin`,
 * `apps/desktop-shell/bin`) so the mapping lives in exactly one place.
 *
 * Workspace packages keep source-backed `exports` (`./src/index.ts`) so the
 * type-checker and tests read one canonical source tree. Node cannot follow
 * those at runtime: type-stripping does not rewrite `./foo.js` imports back to
 * `./foo.ts`, and parts of the core train use TypeScript syntax that strip-only
 * mode rejects outright.
 *
 * So the shipped binaries run the `tsc --build` output instead, and this hook is
 * the one place that knows the mapping. Package directories come from
 * `docs/dependency-matrix.json` — the same file `pnpm check:boundaries`
 * enforces — so a new workspace package is resolvable the moment it is declared
 * there, and never needs a second hand-maintained list.
 *
 * This is launcher plumbing, not a package dependency: it grants no package
 * access the matrix denies, because it only rewrites a specifier the importing
 * package was already allowed to name.
 */

import { readFileSync } from "node:fs";

import { exportEntries } from "./lib/package-exports.mjs";

const REPO_ROOT = new URL("../", import.meta.url);

const matrix = JSON.parse(
  readFileSync(new URL("docs/dependency-matrix.json", REPO_ROOT), "utf8"),
);

/** package name → absolute file URL of its built entrypoint. */
const BUILT_ENTRYPOINTS = new Map(
  Object.entries(matrix.packages).map(([name, entry]) => [
    name,
    new URL(`${entry.dir}/dist/src/index.js`, REPO_ROOT).href,
  ]),
);

/**
 * `@sceneaxi/<pkg>/<subpath>` → the built file that subpath's source compiles to.
 *
 * A subpath is the same problem as a root import — the exports map points at
 * TypeScript — so it needs the same rewrite, and a resolver that handled only
 * bare names would send a shipped binary straight at a `.ts` file on every
 * runtime that does not strip types. The mapping is read from each package's own
 * `exports` map rather than guessed from the subpath text, because the two do not
 * have to agree: `@sceneaxi/schemas/node/profile-conformance-suite` resolves to
 * `src/profile-conformance-suite.ts`, one directory up from where its name reads.
 * Targets that are not TypeScript under `src/` — the versioned JSON contracts —
 * are left to Node, which can already load them from the path the map names.
 */
const BUILT_SUBPATHS = new Map();

for (const [name, entry] of Object.entries(matrix.packages)) {
  let manifest;
  try {
    manifest = JSON.parse(
      readFileSync(new URL(`${entry.dir}/package.json`, REPO_ROOT), "utf8"),
    );
  } catch {
    continue;
  }
  for (const [subpath, target] of exportEntries(manifest.exports)) {
    if (subpath === "." || !target.startsWith("./src/") || !/\.tsx?$/.test(target)) {
      continue;
    }
    const built = target.replace(/^\.\/src\//, "dist/src/").replace(/\.tsx?$/, ".js");
    BUILT_SUBPATHS.set(
      `${name}/${subpath.slice(2)}`,
      new URL(`${entry.dir}/${built}`, REPO_ROOT).href,
    );
  }
}

export function resolve(specifier, context, nextResolve) {
  const built = BUILT_ENTRYPOINTS.get(specifier) ?? BUILT_SUBPATHS.get(specifier);
  if (built !== undefined) {
    return { url: built, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

/** Exported for the launcher's preflight check. */
export function builtEntrypointFor(packageName) {
  return BUILT_ENTRYPOINTS.get(packageName);
}

/** This module's own URL, for the off-thread `module.register()` fallback. */
export const RESOLVER_URL = import.meta.url;
