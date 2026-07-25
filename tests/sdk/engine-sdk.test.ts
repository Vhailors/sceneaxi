/**
 * Engine SDK archive gate tests.
 *
 * The umbrella site serves this archive publicly and CI builds it independently, so
 * the published checksum is only meaningful if the build is deterministic. That is
 * the property these tests exist to hold.
 */
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
// The build scripts are dependency-free plain ESM by design, so Vercel can run them
// with no install and no tsc step. They are typed at the boundary below.
import { buildZip, readZipCentralDirectory, type ZipInputEntry } from "../../scripts/lib/zip.mjs";
import {
  SDK_DOCS,
  SDK_PACKAGES,
  buildEngineSdk,
  collectSdkEntries,
  eligibleSdkFiles,
} from "../../scripts/build-engine-sdk.mjs";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

const zip = buildZip;
const directory = readZipCentralDirectory;
const build = buildEngineSdk;

const scratch: string[] = [];
const fixtureRepo = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "sceneaxi-sdk-fixture-"));
  scratch.push(dir);
  return dir;
};

afterEach(() => {
  while (scratch.length > 0) {
    const dir = scratch.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

describe("deterministic zip writer", () => {
  it("produces byte-identical archives for identical input", () => {
    const entries: ZipInputEntry[] = [
      { name: "b.txt", data: "beta" },
      { name: "a.txt", data: "alpha" },
    ];
    expect(zip(entries).equals(zip(entries))).toBe(true);
  });

  it("sorts entries, so filesystem order never leaks into the bytes", () => {
    const forward = zip([
      { name: "a.txt", data: "alpha" },
      { name: "b.txt", data: "beta" },
    ]);
    const reverse = zip([
      { name: "b.txt", data: "beta" },
      { name: "a.txt", data: "alpha" },
    ]);
    expect(forward.equals(reverse)).toBe(true);
    expect(directory(forward).map((record) => record.name)).toEqual(["a.txt", "b.txt"]);
  });

  it("records a correct CRC-32 and size for every entry", () => {
    const payload = "the quick brown fox".repeat(40);
    const archive = zip([{ name: "fox.txt", data: payload }]);
    const [record] = directory(archive);
    expect(record?.size).toBe(Buffer.byteLength(payload));
    // Verified against an independent CRC-32 implementation, not the writer's own.
    expect(record?.crc32).toBe(crc32Reference(payload));
  });

  it("stores rather than deflates when compression would not help", () => {
    const archive = zip([{ name: "tiny.txt", data: "x" }]);
    const [record] = directory(archive);
    expect(record?.method).toBe(0);
    expect(record?.compressedSize).toBe(1);
  });

  it("deflates compressible content", () => {
    const archive = zip([{ name: "repeat.txt", data: "a".repeat(4096) }]);
    const [record] = directory(archive);
    expect(record?.method).toBe(8);
    expect(record?.compressedSize).toBeLessThan(4096);
  });

  it.each([
    ["an empty archive", []],
    ["an unnamed entry", [{ name: "", data: "x" }]],
    ["an absolute entry name", [{ name: "/etc/passwd", data: "x" }]],
    ["an escaping entry name", [{ name: "../outside.txt", data: "x" }]],
    ["a duplicate entry name", [
      { name: "dup.txt", data: "a" },
      { name: "dup.txt", data: "b" },
    ]],
  ])("refuses %s", (_label, entries) => {
    expect(() => zip(entries as readonly ZipInputEntry[])).toThrow();
  });
});

describe("engine SDK archive", () => {
  it("rebuilds to the same bytes and the same checksum", () => {
    const first = build();
    const second = build();
    expect(first.archive.equals(second.archive)).toBe(true);
    expect(first.sha256).toBe(second.sha256);
    expect(first.sha256).toBe(createHash("sha256").update(first.archive).digest("hex"));
  });

  it("is a structurally valid archive with a consistent central directory", () => {
    const built = build();
    const records = directory(built.archive);
    expect(records.length).toBe(built.entryNames.length);
    expect(records.map((record) => record.name).sort()).toEqual([...built.entryNames].sort());
    for (const record of records) {
      expect(record.size).toBeGreaterThanOrEqual(0);
      expect(record.compressedSize).toBeGreaterThan(0);
      expect([0, 8]).toContain(record.method);
    }
  });

  it("ships the public engine SDK surface, not a monorepo dump", () => {
    const built = build();
    const names = [...built.entryNames];
    for (const pkgDir of SDK_PACKAGES) {
      expect(names.some((name) => name.includes(`${pkgDir}/package.json`))).toBe(true);
      expect(names.some((name) => name.startsWith(`sceneaxi-engine-sdk/${pkgDir}/src/`))).toBe(true);
    }
    for (const doc of SDK_DOCS) {
      expect(names).toContain(`sceneaxi-engine-sdk/${doc}`);
    }
    expect(names).toContain("sceneaxi-engine-sdk/SDK-README.md");

    // Not a dump: nothing outside the SDK surface travels.
    for (const forbidden of [
      "packages/cli/",
      "packages/plugin-host/",
      "packages/importers/",
      "packages/site-kit/",
      "apps/",
      "sites/",
      "tests/",
      "scripts/",
      "pnpm-lock.yaml",
    ]) {
      expect(names.filter((name) => name.includes(forbidden))).toEqual([]);
    }
  });

  it("excludes Kids entirely — the isolation boundary holds in shared artifacts", () => {
    const built = build();
    expect(built.entryNames.filter((name) => name.includes("profile-kids"))).toEqual([]);
    expect(built.entryNames.filter((name) => name.toLowerCase().includes("kids"))).toEqual([]);
  });

  it.each(["node_modules", "/dist/", ".git/", ".env", ".tsbuildinfo"])(
    "excludes %s",
    (fragment) => {
      expect(build().entryNames.filter((name) => name.includes(fragment))).toEqual([]);
    },
  );

  it("publishes a manifest with no secret and no absolute host path", () => {
    const built = build();
    const manifest = built.manifest;
    expect(manifest.sdkVersion).toBe(built.version);
    expect(manifest.generatedFrom).toBe("Vhailors/sceneaxi");
    expect(manifest.entryCount).toBe(built.entryNames.length);
    expect(manifest.sha256).toBe(built.sha256);
    expect(manifest.packages).toContain("@sceneaxi/schemas");
    expect(manifest.packages).not.toContain("@sceneaxi/profile-kids");

    const serialized = JSON.stringify(built.manifest);
    expect(serialized).not.toContain("/home/");
    for (const secret of ["sk_test", "sk_live", "postgres://", "password", "SECRET="]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("refuses to emit a partial SDK when a required package is missing", () => {
    const repoRoot = fixtureRepo();
    cpSync(join(REPO_ROOT, "package.json"), join(repoRoot, "package.json"));
    for (const doc of SDK_DOCS) {
      cpSync(join(REPO_ROOT, doc), join(repoRoot, doc), { recursive: true });
    }
    // Only the first package is present; the rest are deliberately absent.
    const first = SDK_PACKAGES[0] as string;
    cpSync(join(REPO_ROOT, first), join(repoRoot, first), { recursive: true });

    expect(() => collectSdkEntries({ repoRoot })).toThrow(/required package .* is missing/);
  });

  it("refuses when a required doc is missing", () => {
    const repoRoot = fixtureRepo();
    cpSync(join(REPO_ROOT, "package.json"), join(repoRoot, "package.json"));
    for (const pkgDir of SDK_PACKAGES) {
      cpSync(join(REPO_ROOT, pkgDir), join(repoRoot, pkgDir), { recursive: true });
    }
    expect(() => collectSdkEntries({ repoRoot })).toThrow(/required doc/);
  });
  it("refuses a symlink that points outside its package rather than archiving it", () => {
    const repoRoot = fixtureRepo();
    cpSync(join(REPO_ROOT, "package.json"), join(repoRoot, "package.json"));
    for (const doc of SDK_DOCS) {
      cpSync(join(REPO_ROOT, doc), join(repoRoot, doc), { recursive: true });
    }
    for (const pkgDir of SDK_PACKAGES) {
      cpSync(join(REPO_ROOT, pkgDir), join(repoRoot, pkgDir), { recursive: true });
    }
    writeFileSync(join(repoRoot, "outside-secret.txt"), "leaked-by-symlink");
    symlinkSync(
      join(repoRoot, "outside-secret.txt"),
      join(repoRoot, "packages/schemas/src/leak.ts"),
    );
    expect(() => collectSdkEntries({ repoRoot })).toThrow(/symlink|escape|outside/i);
  });

  it("ships exactly the pinned public file list, plus the generated README", () => {
    const built = build();
    const list = JSON.parse(
      readFileSync(new URL("../../scripts/engine-sdk-files.json", import.meta.url), "utf8"),
    ) as readonly string[];
    const shipped = built.entryNames
      .filter((name) => name !== "sceneaxi-engine-sdk/SDK-README.md")
      .map((name) => name.replace(/^sceneaxi-engine-sdk\//, ""))
      .sort();
    expect(shipped).toEqual([...list].sort());
  });

  it("keeps the pinned list equal to the eligible public surface on disk", () => {
    const list = JSON.parse(
      readFileSync(new URL("../../scripts/engine-sdk-files.json", import.meta.url), "utf8"),
    ) as readonly string[];
    expect(eligibleSdkFiles(REPO_ROOT)).toEqual([...list].sort());
  });

  it("fails the gate when a source file is added but not pinned", () => {
    const repoRoot = fixtureRepo();
    cpSync(join(REPO_ROOT, "package.json"), join(repoRoot, "package.json"));
    for (const doc of SDK_DOCS) {
      cpSync(join(REPO_ROOT, doc), join(repoRoot, doc), { recursive: true });
    }
    for (const pkgDir of SDK_PACKAGES) {
      cpSync(join(REPO_ROOT, pkgDir), join(repoRoot, pkgDir), { recursive: true });
    }
    writeFileSync(join(repoRoot, "packages/schemas/src/unpinned.ts"), "export {};\n");
    expect(() => collectSdkEntries({ repoRoot })).toThrow(
      /pinned public surface does not match/,
    );
  });

  it("refuses a symlinked non-walk candidate such as a package README", () => {
    const repoRoot = fixtureRepo();
    cpSync(join(REPO_ROOT, "package.json"), join(repoRoot, "package.json"));
    for (const doc of SDK_DOCS) {
      cpSync(join(REPO_ROOT, doc), join(repoRoot, doc), { recursive: true });
    }
    for (const pkgDir of SDK_PACKAGES) {
      cpSync(join(REPO_ROOT, pkgDir), join(repoRoot, pkgDir), { recursive: true });
    }
    writeFileSync(join(repoRoot, "outside-secret.txt"), "leaked-by-symlink");
    rmSync(join(repoRoot, "packages/schemas/README.md"), { force: true });
    symlinkSync(
      join(repoRoot, "outside-secret.txt"),
      join(repoRoot, "packages/schemas/README.md"),
    );
    expect(() => collectSdkEntries({ repoRoot })).toThrow(/symlink/i);
  });
});

/** Independent CRC-32, so the writer's checksum is verified against another impl. */
function crc32Reference(text: string): number {
  let crc = 0xffffffff;
  const bytes = Buffer.from(text, "utf8");
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
