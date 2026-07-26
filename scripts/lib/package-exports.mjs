/**
 * The one walker that decides what an `exports` target is.
 *
 * Two owners ask that question — the publish-ready gate, which checks every export target
 * against the pinned SDK file list, and the engine-SDK archive test, which checks the
 * same targets against the real archive. Two copies could disagree about which shapes
 * even carry a root export, so the walker lives in its own module rather than inside
 * either owner.
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
