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
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  contentHash,
  createDocument,
  type JsonObject,
  writeDocumentFile,
} from "../../packages/authoring-core/src/index.ts";
import { ExitCode, runCli } from "../../packages/cli/src/index.ts";
import {
  DesktopExit,
  runDesktopShell,
  shellProposeAndApply as desktopRoundTrip,
} from "../../apps/desktop-shell/src/index.ts";
import {
  DEFAULT_HOST,
  createInspectorSession,
  shellProposeAndApply as webRoundTrip,
  startInspectorDevServer,
  type InspectorDevServer,
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
    const cliProposal = JSON.parse(
      readFileSync(join(dirCli, "edit.json"), "utf8"),
    ) as { diffs: Array<{ unifiedDiff: string }> };
    if (desktop.ok) {
      expect(desktop.unifiedDiff).toBe(cliProposal.diffs[0]?.unifiedDiff);
    }
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
    expect(contentHash(bytesDesktop.toString("utf8"))).toBe(
      contentHash(bytesCli.toString("utf8")),
    );

    if (web.ok && desktop.ok) {
      expect(web.unifiedDiff).toBe(desktop.unifiedDiff);
      expect(web.renderedDiff).toBe(desktop.renderedDiff);
    }
  });

  it("the runnable desktop command layer matches CLI bytes and hash", () => {
    // The startable surface (sceneaxi#116), not just the library wrapper:
    // `sceneaxi-desktop apply` and `sceneaxi project propose|apply` must agree.
    const dirDesktop = fixtureDir("desktop-app");
    const dirCli = fixtureDir("desktop-app-cli");
    writeScene(dirDesktop, "scene.json", { ...SAMPLE });
    writeScene(dirCli, "scene.json", { ...SAMPLE });

    const applied = runDesktopShell([
      "apply",
      "--document",
      EDIT.documentPath,
      "--pointer",
      EDIT.jsonPointer,
      "--value",
      JSON.stringify(EDIT.newValue),
      "--cwd",
      dirDesktop,
    ]);
    expect(applied.exitCode).toBe(DesktopExit.OK);
    expect(applied.result["appliedPaths"]).toEqual([EDIT.documentPath]);

    expect(
      runCli([
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
      ]).exitCode,
    ).toBe(ExitCode.OK);
    expect(
      runCli(["project", "apply", "--cwd", dirCli, "--proposal", "edit.json"])
        .exitCode,
    ).toBe(ExitCode.OK);

    const bytesDesktop = readFileSync(join(dirDesktop, "scene.json"));
    const bytesCli = readFileSync(join(dirCli, "scene.json"));
    expect(bytesDesktop.equals(bytesCli)).toBe(true);
    expect(contentHash(bytesDesktop.toString("utf8"))).toBe(
      contentHash(bytesCli.toString("utf8")),
    );
  });

  it("web-shell inspector propose → diff → apply matches CLI hash/content", () => {
    const dirShell = fixtureDir("inspector");
    const dirCli = fixtureDir("inspector-cli");
    writeScene(dirShell, "scene.json", { ...SAMPLE });
    writeScene(dirCli, "scene.json", { ...SAMPLE });

    const session = createInspectorSession({ cwd: dirShell });
    const review = session.proposeEdit({ ...EDIT });
    expect(review.phase).toBe("reviewing");
    expect(review.renderedDiff).toMatch(/"x": 7/);
    expect(review.unifiedDiff).toMatch(/^--- a\/scene\.json/m);
    expect(review.proposal).not.toBeNull();
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
    const cliProposal = JSON.parse(
      readFileSync(join(dirCli, "edit.json"), "utf8"),
    ) as { diffs: Array<{ unifiedDiff: string }> };
    expect(cliProposal.diffs[0]?.unifiedDiff).toBe(review.unifiedDiff);
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
    expect(contentHash(bytesShell.toString("utf8"))).toBe(
      contentHash(bytesCli.toString("utf8")),
    );
  });
});

describe("served web-shell ↔ CLI parity (sceneaxi#120)", () => {
  const running: InspectorDevServer[] = [];

  afterEach(async () => {
    while (running.length > 0) await running.pop()?.close();
  });

  it("the started dev server matches CLI bytes and content hash", async () => {
    // The startable surface, not the library wrapper: this drives the same edit
    // through a real loopback socket and through `sceneaxi project propose|apply`,
    // and requires the two to agree on the bytes *and* on the hash each surface
    // reports for them.
    const dirShell = fixtureDir("served");
    const dirCli = fixtureDir("served-cli");
    writeScene(dirShell, "scene.json", { ...SAMPLE });
    writeScene(dirCli, "scene.json", { ...SAMPLE });

    const server = await startInspectorDevServer({
      host: DEFAULT_HOST,
      port: 0,
      projectRoot: dirShell,
    });
    running.push(server);

    const proposedOverHttp = await fetch(new URL("/api/propose", server.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(EDIT),
    });
    expect(proposedOverHttp.status).toBe(200);
    const review = (await proposedOverHttp.json()) as {
      snapshot: { phase: string; unifiedDiff: string };
    };
    expect(review.snapshot.phase).toBe("reviewing");

    const acceptedOverHttp = await fetch(new URL("/api/accept", server.url), {
      method: "POST",
    });
    expect(acceptedOverHttp.status).toBe(200);

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
    const cliProposal = JSON.parse(
      readFileSync(join(dirCli, "edit.json"), "utf8"),
    ) as { diffs: Array<{ unifiedDiff: string }> };
    expect(review.snapshot.unifiedDiff).toBe(cliProposal.diffs[0]?.unifiedDiff);
    expect(
      runCli(["project", "apply", "--cwd", dirCli, "--proposal", "edit.json"])
        .exitCode,
    ).toBe(ExitCode.OK);

    const bytesShell = readFileSync(join(dirShell, "scene.json"));
    const bytesCli = readFileSync(join(dirCli, "scene.json"));
    expect(bytesShell.equals(bytesCli)).toBe(true);

    // The hash the served surface reports, not one recomputed beside it: the
    // claim under test is that the shell and the CLI agree, so the shell has to
    // be the one saying so.
    const status = await fetch(
      new URL("/api/document?path=scene.json", server.url),
    );
    expect(status.status).toBe(200);
    const served = (await status.json()) as { contentHash: string };
    expect(served.contentHash).toBe(contentHash(bytesCli.toString("utf8")));
    expect(served.contentHash).toBe(contentHash(bytesShell.toString("utf8")));
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
      // Enumerate the directory rather than listing filenames: a new shell
      // source file must be covered the moment it lands, not when someone
      // remembers to extend this list.
      const files = readdirSync(root).filter((name) => name.endsWith(".ts"));
      expect(files.length, `${root.pathname} has no sources`).toBeGreaterThan(0);

      for (const file of files) {
        const text = readFileSync(new URL(file, root), "utf8");
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
