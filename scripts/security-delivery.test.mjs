/** Current-source delivery/security oracles; no build, network, production or publication. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { collectSdkEntries, buildEngineSdk } from "./build-engine-sdk.mjs";
import { exportEntries } from "./lib/package-exports.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

for (const site of ["umbrella", "catalog-game", "catalog-web", "kids"]) {
  test(`${site}: installed/locked patched sharp and real Next raster optimizations`, async () => {
    const directory = join(root, "sites", site);
    const require = createRequire(join(directory, "package.json"));
    const next = require("next/package.json");
    const optimizer = require("next/dist/server/image-optimizer.js");
    const sharp = optimizer.getSharp(1);
    assert.equal(sharp.versions.sharp, "0.35.5");
    assert.match(next.optionalDependencies.sharp, /\^0\.35\.3/);
    const lock = readFileSync(join(directory, "pnpm-lock.yaml"), "utf8");
    assert.match(lock, /sharp@0\.35\.5/);
    assert.doesNotMatch(lock, /sharp@0\.34\.5/);

    const raster = await sharp({ create: { width: 16, height: 16, channels: 4,
      background: { r: 125, g: 40, b: 230, alpha: 1 } } }).png().toBuffer();

    for (const contentType of ["image/png", "image/jpeg", "image/webp", "image/avif"]) {
      const bytes = await optimizer.optimizeImage({ buffer: raster, contentType,
        quality: 75, width: 8, concurrency: 1, limitInputPixels: 256,
        sequentialRead: true, timeoutInSeconds: 5 });

      // Next deliberately blocks the HEIF decoder; decode our generated AVIF in a fresh
      // process, without changing the optimizer's security allow list.
      const decoded = spawnSync(process.execPath, ["-e",
        "const sharp = require(process.argv[2]); sharp(Buffer.from(process.argv[1], 'base64')).metadata().then(m => console.log(JSON.stringify(m)));",
        bytes.toString("base64"), createRequire(require.resolve("next/package.json")).resolve("sharp")], { cwd: directory, encoding: "utf8", timeout: 10000 });

      assert.equal(decoded.status, 0, decoded.stderr);
      const metadata = JSON.parse(decoded.stdout);
      assert.equal(metadata.width, 8);
      assert.equal(metadata.height, 8);
    }

    await assert.rejects(optimizer.optimizeImage({ buffer: raster, contentType: "image/png",
      quality: 75, width: 8, limitInputPixels: 1 }), /pixel limit/);
    await assert.rejects(optimizer.optimizeImage({ buffer: Buffer.from("not an image"),
      contentType: "image/png", quality: 75, width: 8 }), /unsupported image format/);
  });
}

test("SDK is deterministic, source-complete, covers every export and excludes Kids", () => {
  const { entries, packages } = collectSdkEntries();
  const names = new Set(entries.map((entry) => entry.name));
  assert.equal(packages.length, 7);

  for (const entry of entries) {
    assert.ok(!entry.name.includes("profile-kids"));

    if (!entry.name.endsWith("/package.json")) continue;
    const manifest = JSON.parse(entry.data.toString("utf8"));

    for (const [, target] of exportEntries(manifest.exports)) {
      assert.ok(names.has(`${entry.name.slice(0, -"package.json".length)}${target.slice(2)}`), target);
    }
  }

  assert.equal(buildEngineSdk().sha256, buildEngineSdk().sha256);
});

test("anti-slop strict typeof policy has no type-guard bypass and retains existence probe", () => {
  const config = readJson(join(root, ".oxlintrc.json"));
  assert.equal(config.rules["anti-slop/no-runtime-typeof"], "error");
  const fixture = mkdtempSync(join(tmpdir(), "sceneaxi-policy-"));

  try {
    const cases = [
      ["guard.ts", "function isText(value: unknown): value is string { return typeof value === 'string'; }", 1],
      ["runtime.ts", "function decoded(value: unknown) { return typeof value === 'string'; }", 1],
      ["exists.ts", "const exists = typeof missingBinding !== 'undefined';", 0],
    ];

    for (const [name, source, expected] of cases) {
      const file = join(fixture, name);
      writeFileSync(file, source);

      const result = spawnSync("pnpm", ["exec", "oxlint", "--config", join(root, ".oxlintrc.json"), file],
        { cwd: root, encoding: "utf8", timeout: 20000 });

      assert.equal(result.status, expected, `${name}: ${result.stdout} ${result.stderr}`);

      if (expected === 1) assert.match(result.stdout + result.stderr, /no-runtime-typeof/);
    }
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

for (const exports of [{ ".": "./src/index.ts" }, { ".": { types: "./src/index.ts", import: "./src/index.ts" } }]) {
test(`actual docs generator preserves reference on TypeDoc failure with ${JSON.stringify(exports)}`, () => {
  const fixture = mkdtempSync(join(tmpdir(), "sceneaxi-docs-"));

  try {
    mkdirSync(join(fixture, "scripts"));
    mkdirSync(join(fixture, "docs", "api"), { recursive: true });
    mkdirSync(join(fixture, "packages", "schemas"), { recursive: true });
    mkdirSync(join(fixture, "bin"));
    const sentinel = join(fixture, "docs", "api", "index.html");
    writeFileSync(sentinel, "previous published reference");
    writeFileSync(join(fixture, "scripts", "docs-api.mjs"), readFileSync(join(root, "scripts", "docs-api.mjs")));
    // Copy the canonical walker, used by the generator's condition-aware exports flattening.
    mkdirSync(join(fixture, "scripts", "lib"));
    writeFileSync(join(fixture, "scripts", "lib", "package-exports.mjs"), readFileSync(join(root, "scripts", "lib", "package-exports.mjs")));
    writeFileSync(join(fixture, "packages", "schemas", "package.json"), JSON.stringify({ exports }));
    writeFileSync(join(fixture, "bin", "pnpm"), "#!/bin/sh\nexit 23\n", { mode: 0o755 });

    const result = spawnSync(process.execPath, [join(fixture, "scripts", "docs-api.mjs")], {
      cwd: fixture, env: { ...process.env, PATH: `${join(fixture, "bin")}:${process.env.PATH}` },
      encoding: "utf8", timeout: 20000,
    });

    assert.equal(result.status, 23, result.stderr);
    assert.equal(readFileSync(sentinel, "utf8"), "previous published reference");
    assert.deepEqual(readdirSync(join(fixture, "docs")), ["api"]);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
}
