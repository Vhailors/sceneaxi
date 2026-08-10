import { build } from "esbuild";
import { realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const within = (parent, candidate) => {
  const rel = relative(parent, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

const absoluteInput = (appRoot, path) => resolve(appRoot, path);

export async function bundleDesktopRenderer({
  appRoot,
  outfile = join(appRoot, "dist/renderer.js"),
  write = true,
  logLevel = "info",
} = {}) {
  const owner = join(appRoot, "src/renderer/viewport.ts");
  const presentationRoot = realpathSync(
    join(appRoot, "node_modules/@sceneaxi/engine-presentation"),
  );
  const result = await build({
    absWorkingDir: appRoot,
    bundle: true,
    entryPoints: [owner],
    outfile,
    platform: "browser",
    format: "iife",
    target: "es2022",
    logLevel,
    metafile: true,
    write,
  });

  const presentationInputs = new Set(
    Object.keys(result.metafile.inputs)
      .map((path) => absoluteInput(appRoot, path))
      .filter((path) => within(presentationRoot, path)),
  );
  const entrants = [];
  const nodeImports = [];
  for (const [input, metadata] of Object.entries(result.metafile.inputs)) {
    const importer = absoluteInput(appRoot, input);
    for (const imported of metadata.imports) {
      if (imported.path.startsWith("node:")) {
        nodeImports.push(`${relative(appRoot, importer)} -> ${imported.path}`);
      }
      const target = absoluteInput(appRoot, imported.path);
      if (
        presentationInputs.has(target) &&
        !within(presentationRoot, importer)
      ) {
        entrants.push(importer);
      }
    }
  }

  if (nodeImports.length > 0) {
    throw new Error(`renderer graph reaches Node builtins: ${nodeImports.join(", ")}`);
  }
  const uniqueEntrants = [...new Set(entrants)];
  if (presentationInputs.size === 0 || uniqueEntrants.length !== 1 || uniqueEntrants[0] !== owner) {
    const names = uniqueEntrants.map((path) => relative(appRoot, path)).join(", ") || "none";
    throw new Error(
      `only src/renderer/viewport.ts may enter the presentation graph; resolved entrants: ${names}`,
    );
  }
  return result.metafile;
}
