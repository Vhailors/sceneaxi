/**
 * Shell ↔ CLI parity conformance (sceneaxi#11).
 *
 * Same operation through web-shell, desktop-shell, and CLI → byte-identical
 * documents. Shells never import or spawn the CLI; this monorepo-level suite
 * is the cross-package conformance test over one authoring-core protocol layer.
 *
 * Imports use relative paths into package sources so the root `tests/` tree
 * does not need hoisted `@sceneaxi/*` links (pnpm isolates workspace deps).
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDocument,
  type JsonObject,
  writeDocumentFile,
} from "../../packages/authoring-core/src/index.ts";
import { ExitCode, runCli } from "../../packages/cli/src/index.ts";
import { shellProposeAndApply as desktopRoundTrip } from "../../apps/desktop-shell/src/index.ts";
import {
  createInspectorSession,
  shellProposeAndApply as webRoundTrip,
} from "../../apps/web-shell/src/index.ts";

function fixtureDir(label: string): string {
  return mkdtempSync(join(tmpdir(), `sceneaxi-parity-${label}-`));
}

function writeScene(
  dir: string,
  name: string,
  data: JsonObject,
): void {
  const path = join(dir, name);
  const doc = createDocument({ id: name.replace(/\.json$/, ""), data });
  const result = writeDocumentFile(path, doc, { cwd: dir });
  expect(result.ok).toBe(true);
}

const SAMPLE = {
  entities: [{ id: "hero", x: 1, y: 2, rz: 0 }],
  material: { roughness: 0.4 },
} as const;

const EDIT = {
  documentPath: "scene.json",
  jsonPointer: "/data/entities/0/x",
  newValue: 7,
} as const;

describe("shell ↔ CLI parity (conformance)", () => {
  it("web-shell, desktop-shell, and CLI produce byte-identical documents", () => {
    const dirWeb = fixtureDir("web");
    const dirDesktop = fixtureDir("desktop");
    const dirCli = fixtureDir("cli");
    writeScene(dirWeb, "scene.json", { ...SAMPLE });
    writeScene(dirDesktop, "scene.json", { ...SAMPLE });
    writeScene(dirCli, "scene.json", { ...SAMPLE });

    const web = webRoundTrip({ ...EDIT, cwd: dirWeb });
    expect(web.ok).toBe(true);

    const desktop = desktopRoundTrip({ ...EDIT, cwd: dirDesktop });
    expect(desktop.ok).toBe(true);

    const proposed = runCli([
      "project",
      "propose",
      "--cwd",
      dirCli,
      "--document",
      EDIT.documentPath,
      "--pointer",
      EDIT.jsonPointer,
      "--value",
      JSON.stringify(EDIT.newValue),
      "--out",
      "edit.json",
    ]);
    expect(proposed.exitCode).toBe(ExitCode.OK);
    const applied = runCli([
      "project",
      "apply",
      "--cwd",
      dirCli,
      "--proposal",
      "edit.json",
    ]);
    expect(applied.exitCode).toBe(ExitCode.OK);

    const bytesWeb = readFileSync(join(dirWeb, "scene.json"));
    const bytesDesktop = readFileSync(join(dirDesktop, "scene.json"));
    const bytesCli = readFileSync(join(dirCli, "scene.json"));

    expect(bytesWeb.equals(bytesDesktop)).toBe(true);
    expect(bytesWeb.equals(bytesCli)).toBe(true);
    expect(bytesDesktop.equals(bytesCli)).toBe(true);

    if (web.ok && desktop.ok) {
      expect(web.unifiedDiff).toBe(desktop.unifiedDiff);
      expect(web.renderedDiff).toBe(desktop.renderedDiff);
    }
  });

  it("web-shell inspector accept matches CLI apply for the same edit", () => {
    const dirShell = fixtureDir("inspector");
    const dirCli = fixtureDir("inspector-cli");
    writeScene(dirShell, "scene.json", { ...SAMPLE });
    writeScene(dirCli, "scene.json", { ...SAMPLE });

    const session = createInspectorSession({ cwd: dirShell });
    const review = session.proposeEdit({ ...EDIT });
    expect(review.phase).toBe("reviewing");
    expect(review.renderedDiff).toMatch(/"x": 7/);
    const accepted = session.accept();
    expect(accepted.phase).toBe("applied");

    const proposed = runCli([
      "project",
      "propose",
      "--cwd",
      dirCli,
      "--document",
      EDIT.documentPath,
      "--pointer",
      EDIT.jsonPointer,
      "--value",
      JSON.stringify(EDIT.newValue),
      "--out",
      "edit.json",
    ]);
    expect(proposed.exitCode).toBe(ExitCode.OK);
    const applied = runCli([
      "project",
      "apply",
      "--cwd",
      dirCli,
      "--proposal",
      "edit.json",
    ]);
    expect(applied.exitCode).toBe(ExitCode.OK);

    const bytesShell = readFileSync(join(dirShell, "scene.json"));
    const bytesCli = readFileSync(join(dirCli, "scene.json"));
    expect(bytesShell.equals(bytesCli)).toBe(true);
  });
});

describe("shell boundary discipline (source-level)", () => {
  it("web-shell and desktop-shell src never import cli or engine packages", () => {
    const forbidden = [
      "@sceneaxi/cli",
      "@sceneaxi/engine-kernel",
      "@sceneaxi/engine-presentation",
      "@sceneaxi/engine-orchestrator",
    ];
    const roots = [
      new URL("../../apps/web-shell/src/", import.meta.url),
      new URL("../../apps/desktop-shell/src/", import.meta.url),
    ];

    for (const root of roots) {
      const files = ["index.ts", "protocol-client.ts", "inspector.ts"];
      for (const file of files) {
        let text: string;
        try {
          text = readFileSync(new URL(file, root), "utf8");
        } catch {
          continue;
        }
        for (const pkg of forbidden) {
          expect(
            text,
            `${root.pathname}${file} must not import ${pkg}`,
          ).not.toContain(pkg);
        }
      }
    }
  });

  it("shell package manifests do not declare cli or engine dependencies", () => {
    for (const rel of [
      "../../apps/web-shell/package.json",
      "../../apps/desktop-shell/package.json",
    ]) {
      const manifest = JSON.parse(
        readFileSync(new URL(rel, import.meta.url), "utf8"),
      ) as { dependencies?: Record<string, string> };
      const deps = Object.keys(manifest.dependencies ?? {});
      expect(deps).not.toContain("@sceneaxi/cli");
      expect(deps.filter((d) => d.startsWith("@sceneaxi/engine-"))).toEqual([]);
      expect(deps).toContain("@sceneaxi/authoring-core");
      expect(deps).toContain("@sceneaxi/schemas");
    }
  });
});
