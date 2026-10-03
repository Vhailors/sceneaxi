// Source-backed package exports use .ts with emitted .js relative imports.
// Resolve only missing relative source extensions; never substitute a package barrel.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../../../../", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (error.code !== "ERR_MODULE_NOT_FOUND" || !context.parentURL ||
          !/^(?:\.\.?\/).+\.js$/.test(specifier)) throw error;
      const source = new URL(specifier.replace(/\.js$/, ".ts"), context.parentURL);

      if (!source.href.startsWith(root.href) || !existsSync(fileURLToPath(source))) throw error;

      return nextResolve(source.href, context);
    }
  },
});
