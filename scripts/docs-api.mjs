import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readFile, readdir, stat, rm, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const output = path.join(root, "docs/api");

const temporary = await mkdtemp(path.join(root, "docs/.typedoc-"));

const packages = [
  {
    name: "schemas",
    directory: "packages/schemas",
    tsconfig: "packages/schemas/tsconfig.json",
    intentionallyNotExported: [
      "ContractRefuse",
      "SculptArtifactBase",
      "SculptIntakeBase",
      "selectionStale",
      "inputUnsupported",
      "adapterAbsent",
    ],
  },
  {
    name: "profile-web",
    directory: "packages/profile-web",
    tsconfig: "packages/profile-web/tsconfig.json",
  },
  {
    name: "authoring-core",
    directory: "packages/authoring-core",
    tsconfig: "packages/authoring-core/tsconfig.json",
    intentionallyNotExported: [
      "PointerGetOk",
      "PointerGetFail",
      "PointerSetOk",
      "PointerSetFail",
      "AssistantSculptCommon",
      "inspectionEditUnsupported",
    ],
  },
  ...["engine-kernel", "engine-presentation", "engine-orchestrator", "profile-game", "provider-openrouter"].map((name) => ({
    name, directory: `packages/${name}`, tsconfig: `packages/${name}/tsconfig.json`,
  })),
];

try {
  const staging = path.join(temporary, "api");
  await mkdir(staging, { recursive: true });

  for (const pkg of packages) {
    const manifest = JSON.parse(
      await readFile(path.join(root, pkg.directory, "package.json"), "utf8"),
    );

    const entryPoints = Object.values(manifest.exports)
      .filter((target) => target.endsWith(".ts"))
      .map((target) => path.join(root, pkg.directory, target));

    const optionsPath = path.join(temporary, `${pkg.name}.json`);
    await writeFile(
      optionsPath,
      JSON.stringify({
        entryPoints,
        entryPointStrategy: "resolve",
        tsconfig: path.join(root, pkg.tsconfig),
        skipErrorChecking: false,
        treatWarningsAsErrors: true,
        intentionallyNotExported: pkg.intentionallyNotExported ?? [],
        out: path.join(staging, pkg.name),
      }),
    );

    const result = spawnSync("pnpm", ["exec", "typedoc", "--options", optionsPath], {
      cwd: root,
      encoding: "utf8",
    });

    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");

    if (result.error) throw result.error;

    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }

  if (!process.exitCode) {
    const schemas = JSON.parse(
      await readFile(path.join(root, "packages/schemas/package.json"), "utf8"),
    );

    const contracts = Object.values(schemas.exports)
      .filter((target) => target.endsWith(".json"))
      .map((target) => target.replace("./contracts/", ""));

    const contractsOutput = path.join(staging, "schemas/contracts");
    await mkdir(contractsOutput, { recursive: true });

    for (const contract of contracts) {
      await copyFile(
        path.join(root, "packages/schemas/contracts", contract),
        path.join(contractsOutput, contract),
      );
    }

    await writeFile(
      path.join(contractsOutput, "index.html"),
      `<!doctype html><meta charset="utf-8"><title>Schema contracts</title><h1>Versioned JSON contracts</h1><ul>${contracts
        .map((contract) => `<li><a href="${contract}">${contract}</a></li>`)
        .join("")}</ul>\n`,
    );
    await writeFile(
      path.join(staging, "index.html"),
      `<!doctype html><meta charset="utf-8"><title>SceneAxi API reference</title><h1>SceneAxi API reference</h1><ul>${packages
        .map((pkg) => `<li><a href="${pkg.name}/index.html">@sceneaxi/${pkg.name}</a></li>`)
        .join("")}<li><a href="schemas/contracts/index.html">@sceneaxi/schemas JSON contracts</a></li></ul>\n`,
    );

    // Resolve every generated local link before replacing previously published bytes.
    async function validateLinks(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);

        if (entry.isDirectory()) { await validateLinks(file); continue; }

        if (!entry.name.endsWith(".html")) continue;
        const html = await readFile(file, "utf8");

        for (const match of html.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)) {
          const target = match[1];

          if (/^(?:https?:|mailto:|data:|javascript:|#)/.test(target)) continue;
          const resolved = path.resolve(path.dirname(file), decodeURIComponent(target.split("#")[0]));

          if (!resolved.startsWith(staging + path.sep)) throw new Error(`reference link escapes staging: ${entry.name}`);
          await stat(resolved);
        }
      }
    }

    await validateLinks(staging);
    // All checked outputs succeeded; keep old bytes until the same-filesystem swap.
    const backup = path.join(temporary, "previous-api");
    let hadOutput = false;

    try { await rename(output, backup); hadOutput = true; }
    catch (error) { if (error.code !== "ENOENT") throw error; }

    try { await rename(staging, output); }
    catch (error) { if (hadOutput) await rename(backup, output); throw error; }
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
