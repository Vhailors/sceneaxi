import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const output = path.join(root, "docs/api");

const temporary = await mkdtemp(path.join(tmpdir(), "sceneaxi-typedoc-"));

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
];

try {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

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
        skipErrorChecking: true,
        treatWarningsAsErrors: true,
        intentionallyNotExported: pkg.intentionallyNotExported ?? [],
        out: path.join(output, pkg.name),
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

    const contractsOutput = path.join(output, "schemas/contracts");
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
      path.join(output, "index.html"),
      `<!doctype html><meta charset="utf-8"><title>SceneAxi API reference</title><h1>SceneAxi API reference</h1><ul>${packages
        .map((pkg) => `<li><a href="${pkg.name}/index.html">@sceneaxi/${pkg.name}</a></li>`)
        .join("")}<li><a href="schemas/contracts/index.html">@sceneaxi/schemas JSON contracts</a></li></ul>\n`,
    );
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
