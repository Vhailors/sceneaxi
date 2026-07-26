/**
 * The one walker that decides what an `exports` target is.
 *
 * Three owners ask that question — the publish-ready gate, the engine-SDK archive and its
 * test, and the readiness statement generated into that archive. Two copies could
 * disagree about which shapes even carry a root export, so the walker lives here rather
 * than inside any one of them: `check-publish-ready.mjs` already imports the archive
 * builder, so it cannot be the home without closing an import cycle.
 *
 * Dependency-free plain ESM, like every other script beside it.
 */

/**
 * Flatten an `exports` map to `[subpath, target]` pairs.
 *
 * String sugar (`"exports": "./src/index.ts"`) and condition sugar
 * (`"exports": { "import": "./src/index.ts" }`) both declare a root export without ever
 * putting a `"."` key in the map, so both normalize to the `"."` subpath here.
 *
 * @param {unknown} exportsField
 * @returns {Array<[string, string]>}
 */
export function exportEntries(exportsField) {
  const pairs = [];
  const walk = (value, subpath) => {
    if (typeof value === "string") pairs.push([subpath, value]);
    else if (value !== null && typeof value === "object") {
      for (const [key, nested] of Object.entries(value)) {
        walk(nested, key.startsWith(".") ? key : subpath);
      }
    }
  };
  walk(exportsField ?? {}, ".");
  return pairs;
}
