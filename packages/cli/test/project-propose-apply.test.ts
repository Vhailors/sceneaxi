/**
 * Highest-seam golden tests for E1 project propose/apply (sceneaxi#9).
 * Assert through the CLI envelope — never authoring-core internals.
 */
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDocument,
  editDirect,
  proposeMany,
  serializeDocument,
  writeDocumentFile,
  writeProposalFile,
  type JsonObject,
} from "@sceneaxi/authoring-core";
import { ExitCode, runCli } from "@sceneaxi/cli";

function fixtureDir(): string {
  return mkdtempSync(join(tmpdir(), "sceneaxi-e1-"));
}

function writeScene(
  dir: string,
  name: string,
  data: JsonObject,
): string {
  const path = join(dir, name);
  const doc = createDocument({ id: name.replace(/\.json$/, ""), data });
  const result = writeDocumentFile(path, doc);
  expect(result.ok).toBe(true);
  return path;
}

describe("project propose / apply (CLI envelope)", () => {
  it("propose → unified diff + exit 0", () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", {
      entities: [{ id: "hero", x: 0, y: 0 }],
    });

    const r = runCli([
      "project",
      "propose",
      "--cwd",
      dir,
      "--document",
      "scene.json",
      "--pointer",
      "/data/entities/0/x",
      "--value",
      "10",
      "--out",
      "edit.json",
      "--json",
    ]);

    expect(r.exitCode).toBe(ExitCode.OK);
    expect(r.envelope.ok).toBe(true);
    if (!r.envelope.ok) return;
    expect(r.envelope.result["status"]).toBe("proposed");
    const diff = r.envelope.result["unifiedDiff"];
    expect(typeof diff).toBe("string");
    expect(diff as string).toMatch(/^--- a\/scene\.json/m);
    expect(diff as string).toMatch(/^\+\+\+ b\/scene\.json/m);
    expect(diff as string).toMatch(/^-.*"x": 0/m);
    expect(diff as string).toMatch(/^\+.*"x": 10/m);
    expect(r.envelope.help.length).toBeGreaterThan(0);
  });

  it("apply succeeds atomically and updates the document", () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", {
      entities: [{ id: "hero", x: 0, y: 0 }],
    });

    const proposed = runCli([
      "project",
      "propose",
      "--cwd",
      dir,
      "--document",
      "scene.json",
      "--pointer",
      "/data/entities/0/x",
      "--value",
      "42",
      "--out",
      "edit.json",
    ]);
    expect(proposed.exitCode).toBe(ExitCode.OK);

    const applied = runCli([
      "project",
      "apply",
      "--cwd",
      dir,
      "--proposal",
      "edit.json",
      "--json",
    ]);
    expect(applied.exitCode).toBe(ExitCode.OK);
    expect(applied.envelope.ok).toBe(true);
    if (!applied.envelope.ok) return;
    expect(applied.envelope.result["status"]).toBe("applied");
    expect(applied.envelope.result["appliedPaths"]).toEqual(["scene.json"]);

    const text = readFileSync(join(dir, "scene.json"), "utf8");
    const json = JSON.parse(text) as {
      data: { entities: Array<{ x: number }> };
    };
    expect(json.data.entities[0]?.x).toBe(42);

    // No leftover tmp/bak files observable after success.
    const leftovers = readdirSync(dir).filter(
      (f) => f.includes(".sceneaxi-tmp-") || f.includes(".sceneaxi-bak-"),
    );
    expect(leftovers).toEqual([]);
  });

  it("concurrent content-hash conflict → CONFLICT + re-read hint + non-zero exit", () => {
    const dir = fixtureDir();
    writeScene(dir, "scene.json", {
      entities: [{ id: "hero", x: 0, y: 0 }],
    });

    const proposed = runCli([
      "project",
      "propose",
      "--cwd",
      dir,
      "--document",
      "scene.json",
      "--pointer",
      "/data/entities/0/x",
      "--value",
      "10",
      "--out",
      "stale.json",
    ]);
    expect(proposed.exitCode).toBe(ExitCode.OK);

    // Concurrent direct edit changes the base hash.
    const concurrent = editDirect({
      documentPath: "scene.json",
      jsonPointer: "/data/entities/0/y",
      newValue: 99,
      cwd: dir,
    });
    expect(concurrent.ok).toBe(true);

    const applied = runCli([
      "project",
      "apply",
      "--cwd",
      dir,
      "--proposal",
      "stale.json",
      "--json",
    ]);

    expect(applied.exitCode).toBe(ExitCode.ERROR);
    expect(applied.exitCode).not.toBe(0);
    expect(applied.envelope.ok).toBe(false);
    if (applied.envelope.ok) return;
    expect(applied.envelope.error.code).toBe("CONFLICT");
    const diagnostics = applied.envelope.error.diagnostics;
    expect(Array.isArray(diagnostics)).toBe(true);
    expect(diagnostics?.[0]?.code).toBe("content-hash-conflict");
    expect(diagnostics?.[0]?.reReadHint).toMatch(/Re-read scene\.json/);
    // help should also surface the re-read hint
    expect(applied.envelope.help.some((h) => /re-read|Re-read/i.test(h))).toBe(
      true,
    );

    // Document remains at concurrent state, not partial proposal.
    const text = readFileSync(join(dir, "scene.json"), "utf8");
    const json = JSON.parse(text) as {
      data: { entities: Array<{ x: number; y: number }> };
    };
    expect(json.data.entities[0]?.x).toBe(0);
    expect(json.data.entities[0]?.y).toBe(99);
  });

  it("byte-identical: direct edit vs propose+apply for the same change", () => {
    const dirA = fixtureDir();
    const dirB = fixtureDir();
    const data = {
      entities: [{ id: "hero", x: 1, y: 2, rz: 0 }],
      material: { roughness: 0.4 },
    };
    writeScene(dirA, "scene.json", data);
    writeScene(dirB, "scene.json", data);

    const direct = editDirect({
      documentPath: "scene.json",
      jsonPointer: "/data/entities/0/x",
      newValue: 7,
      cwd: dirA,
    });
    expect(direct.ok).toBe(true);

    const proposed = runCli([
      "project",
      "propose",
      "--cwd",
      dirB,
      "--document",
      "scene.json",
      "--pointer",
      "/data/entities/0/x",
      "--value",
      "7",
      "--out",
      "p.json",
    ]);
    expect(proposed.exitCode).toBe(ExitCode.OK);
    const applied = runCli([
      "project",
      "apply",
      "--cwd",
      dirB,
      "--proposal",
      "p.json",
    ]);
    expect(applied.exitCode).toBe(ExitCode.OK);

    const bytesA = readFileSync(join(dirA, "scene.json"));
    const bytesB = readFileSync(join(dirB, "scene.json"));
    expect(bytesA.equals(bytesB)).toBe(true);
  });

  it("all-or-nothing multi-document: conflict on second doc leaves both unchanged", () => {
    const dir = fixtureDir();
    writeScene(dir, "a.json", { n: 1 });
    writeScene(dir, "b.json", { n: 2 });

    // Build a multi-document proposal via authoring-core, then apply through CLI.
    const multi = proposeMany([
      {
        documentPath: "a.json",
        jsonPointer: "/data/n",
        newValue: 10,
        cwd: dir,
      },
      {
        documentPath: "b.json",
        jsonPointer: "/data/n",
        newValue: 20,
        cwd: dir,
      },
    ]);
    expect(multi.ok).toBe(true);
    if (!multi.ok) return;
    writeProposalFile(join(dir, "multi.json"), multi.proposal);

    // Corrupt b.json base so apply conflicts after a would have been planned.
    editDirect({
      documentPath: "b.json",
      jsonPointer: "/data/n",
      newValue: 999,
      cwd: dir,
    });

    const beforeA = readFileSync(join(dir, "a.json"), "utf8");
    const beforeB = readFileSync(join(dir, "b.json"), "utf8");

    const applied = runCli([
      "project",
      "apply",
      "--cwd",
      dir,
      "--proposal",
      "multi.json",
      "--json",
    ]);
    expect(applied.exitCode).toBe(ExitCode.ERROR);
    if (!applied.envelope.ok) {
      expect(applied.envelope.error.code).toBe("CONFLICT");
    }

    expect(readFileSync(join(dir, "a.json"), "utf8")).toBe(beforeA);
    expect(readFileSync(join(dir, "b.json"), "utf8")).toBe(beforeB);
  });

  it("schema major-mismatch refuses on propose and apply", () => {
    const dir = fixtureDir();
    // Write a document with wrong major by hand (bypass writeDocumentFile).
    writeFileSync(
      join(dir, "old.json"),
      `${JSON.stringify(
        {
          schemaVersion: 99,
          kind: "sceneaxi.document",
          id: "old",
          data: { x: 1 },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const proposed = runCli([
      "project",
      "propose",
      "--cwd",
      dir,
      "--document",
      "old.json",
      "--pointer",
      "/data/x",
      "--value",
      "2",
      "--json",
    ]);
    expect(proposed.exitCode).toBe(ExitCode.USAGE);
    expect(proposed.envelope.ok).toBe(false);
    if (!proposed.envelope.ok) {
      expect(proposed.envelope.error.code).toBe("VALIDATION");
      expect(proposed.envelope.error.diagnostics?.[0]?.code).toBe(
        "schema-major-mismatch",
      );
    }

    // Proposal with major mismatch.
    writeFileSync(
      join(dir, "bad-proposal.json"),
      `${JSON.stringify(
        {
          schemaVersion: 99,
          kind: "sceneaxi.proposal",
          edits: [
            {
              documentPath: "old.json",
              baseContentHash:
                "sha256:0000000000000000000000000000000000000000000000000000000000000000",
              jsonPointer: "/data/x",
              oldValue: 1,
              newValue: 2,
            },
          ],
          diffs: [{ documentPath: "old.json", unifiedDiff: "" }],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const applied = runCli([
      "project",
      "apply",
      "--cwd",
      dir,
      "--proposal",
      "bad-proposal.json",
      "--json",
    ]);
    expect(applied.exitCode).toBe(ExitCode.USAGE);
    if (!applied.envelope.ok) {
      expect(applied.envelope.error.code).toBe("VALIDATION");
      expect(applied.envelope.error.diagnostics?.[0]?.code).toBe(
        "schema-major-mismatch",
      );
    }
  });

  it("missing required flags → VALIDATION (USAGE exit)", () => {
    const r = runCli(["project", "propose", "--json"]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("VALIDATION");
    }
  });

  it("project propose --help documents flags", () => {
    const r = runCli(["project", "propose", "--help", "--json"]);
    expect(r.exitCode).toBe(ExitCode.OK);
    if (r.envelope.ok) {
      expect(r.envelope.result["command"]).toBe("project propose");
      expect(r.envelope.result).toHaveProperty("flags");
    }
  });
});

describe("shared validator path (direct vs proposal)", () => {
  it("rejects the same invalid post-edit document on both paths", () => {
    const dir = fixtureDir();
    // Valid base.
    writeScene(dir, "scene.json", { ok: true });

    // Invalid id fails the shared validateDocument on both paths.
    const direct = editDirect({
      documentPath: "scene.json",
      jsonPointer: "/id",
      newValue: "NOT_A_VALID_ID",
      cwd: dir,
    });
    expect(direct.ok).toBe(false);
    if (direct.ok) return;
    expect(direct.diagnostics[0]?.code).toBe("validation-failed");

    const viaCli = runCli([
      "project",
      "propose",
      "--cwd",
      dir,
      "--document",
      "scene.json",
      "--pointer",
      "/id",
      "--value",
      JSON.stringify("NOT_A_VALID_ID"),
      "--json",
    ]);
    expect(viaCli.exitCode).not.toBe(0);
    expect(viaCli.envelope.ok).toBe(false);
    if (!viaCli.envelope.ok) {
      expect(viaCli.envelope.error.diagnostics?.[0]?.code).toBe(
        direct.diagnostics[0]?.code,
      );
    }
  });

  it("serializeDocument is the sole text form (canonical)", () => {
    const doc = createDocument({
      id: "canon",
      data: { a: 1 },
      title: "Canon",
    });
    const text = serializeDocument(doc);
    expect(text.endsWith("\n")).toBe(true);
    expect(JSON.parse(text)).toEqual(doc);
  });
});
