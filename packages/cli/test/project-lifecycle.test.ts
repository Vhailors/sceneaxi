import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExitCode, runCli } from "@sceneaxi/cli";

/**
 * `project new | dev | test | capture | report` (sceneaxi#115).
 * The lifecycle is free, offline, and deterministic: no verb here reads a
 * credential, opens a socket, or writes a timestamp.
 */
describe("project lifecycle verbs", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "sceneaxi-cli-lifecycle-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  const create = (extra: string[] = []) =>
    runCli([
      "project",
      "new",
      "--document",
      "scene.json",
      "--cwd",
      cwd,
      ...extra,
    ]);

  describe("project new", () => {
    it("writes a valid text-canonical document and reports its content hash", () => {
      const r = create(["--title", "Demo scene"]);
      expect(r.exitCode).toBe(ExitCode.OK);
      expect(r.envelope.ok).toBe(true);
      if (!r.envelope.ok) return;

      expect(r.envelope.result["status"]).toBe("created");
      expect(r.envelope.result["documentId"]).toBe("scene");
      expect(r.envelope.result["contentHash"]).toMatch(/^sha256:[0-9a-f]{64}$/);

      const text = readFileSync(join(cwd, "scene.json"), "utf8");
      expect(JSON.parse(text)).toEqual({
        schemaVersion: 1,
        kind: "sceneaxi.document",
        id: "scene",
        title: "Demo scene",
        data: {},
      });
      // Text-canonical form: 2-space JSON with a trailing newline.
      expect(text.endsWith("}\n")).toBe(true);
    });

    it("is deterministic — the same inputs produce identical bytes", () => {
      const first = create();
      const firstBytes = readFileSync(join(cwd, "scene.json"), "utf8");
      const again = create(["--force"]);
      expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(firstBytes);
      if (first.envelope.ok && again.envelope.ok) {
        expect(again.envelope.result["contentHash"]).toBe(
          first.envelope.result["contentHash"],
        );
      }
    });

    it("refuses to overwrite an existing document without --force", () => {
      expect(create().exitCode).toBe(ExitCode.OK);
      const r = create();
      expect(r.exitCode).toBe(ExitCode.ERROR);
      expect(r.envelope.ok).toBe(false);
      if (!r.envelope.ok) {
        expect(r.envelope.error.code).toBe("CONFLICT");
      }
    });

    it("overwrites deliberately with --force", () => {
      expect(create().exitCode).toBe(ExitCode.OK);
      expect(create(["--force"]).exitCode).toBe(ExitCode.OK);
    });

    it("accepts an explicit --id and an initial --data object", () => {
      const r = runCli([
        "project",
        "new",
        "--document",
        "out.json",
        "--id",
        "my-project",
        "--data",
        '{"entities":[]}',
        "--cwd",
        cwd,
      ]);
      expect(r.exitCode).toBe(ExitCode.OK);
      const doc = JSON.parse(readFileSync(join(cwd, "out.json"), "utf8")) as {
        id: string;
        data: unknown;
      };
      expect(doc.id).toBe("my-project");
      expect(doc.data).toEqual({ entities: [] });
    });

    it("refuses a --data value that is not a JSON object", () => {
      for (const data of ["[]", "7", "not json"]) {
        const r = runCli([
          "project",
          "new",
          "--document",
          `d-${data.length}.json`,
          "--data",
          data,
          "--cwd",
          cwd,
        ]);
        expect(r.exitCode, data).toBe(ExitCode.USAGE);
      }
    });

    it("refuses when no valid document id can be derived and none was given", () => {
      const r = runCli([
        "project",
        "new",
        "--document",
        "___.json",
        "--cwd",
        cwd,
      ]);
      expect(r.exitCode).toBe(ExitCode.USAGE);
      if (!r.envelope.ok) {
        expect(r.envelope.error.code).toBe("VALIDATION");
        expect(r.envelope.error.message).toContain("--id");
      }
    });

    it("refuses a missing --document and unknown flags", () => {
      expect(runCli(["project", "new", "--cwd", cwd]).exitCode).toBe(
        ExitCode.USAGE,
      );
      const unknown = runCli([
        "project",
        "new",
        "--document",
        "a.json",
        "--bogus",
        "x",
        "--cwd",
        cwd,
      ]);
      expect(unknown.exitCode).toBe(ExitCode.USAGE);
      if (!unknown.envelope.ok) {
        expect(unknown.envelope.error.code).toBe("UNKNOWN_FLAG");
      }
    });
  });

  describe("project dev", () => {
    it("reports one-shot status and never claims a watcher", () => {
      create();
      const r = runCli([
        "project",
        "dev",
        "--document",
        "scene.json",
        "--cwd",
        cwd,
      ]);
      expect(r.exitCode).toBe(ExitCode.OK);
      if (!r.envelope.ok) return;
      expect(r.envelope.result["mode"]).toBe("one-shot");
      expect(r.envelope.result["watchSupported"]).toBe(false);
    });

    it("refuses --watch rather than faking a hot-reload loop", () => {
      create();
      const r = runCli([
        "project",
        "dev",
        "--document",
        "scene.json",
        "--watch",
        "--cwd",
        cwd,
      ]);
      expect(r.exitCode).toBe(ExitCode.ERROR);
      if (!r.envelope.ok) {
        expect(r.envelope.error.code).toBe("NOT_IMPLEMENTED");
      }
    });
  });

  describe("project test", () => {
    it("validates a document and reports deterministic checks", () => {
      create();
      const r = runCli([
        "project",
        "test",
        "--document",
        "scene.json",
        "--cwd",
        cwd,
      ]);
      expect(r.exitCode).toBe(ExitCode.OK);
      if (!r.envelope.ok) return;
      expect(r.envelope.result["status"]).toBe("passed");
      expect(r.envelope.result["checks"]).toEqual([
        {
          name: "document-schema",
          status: "pass",
          detail: "Validated against document schema v1.",
        },
        {
          name: "text-canonical-form",
          status: "pass",
          detail: "On-disk bytes match the canonical 2-space serialization.",
        },
      ]);
    });

    it("refuses an invalid document with a typed diagnostic", () => {
      writeFileSync(join(cwd, "bad.json"), '{"schemaVersion":1}\n', "utf8");
      const r = runCli([
        "project",
        "test",
        "--document",
        "bad.json",
        "--cwd",
        cwd,
      ]);
      expect(r.exitCode).toBe(ExitCode.USAGE);
      if (!r.envelope.ok) {
        expect(r.envelope.error.code).toBe("VALIDATION");
        expect(r.envelope.error.diagnostics?.length).toBeGreaterThan(0);
      }
    });

    it("refuses unparseable JSON", () => {
      writeFileSync(join(cwd, "broken.json"), "{ not json", "utf8");
      const r = runCli([
        "project",
        "test",
        "--document",
        "broken.json",
        "--cwd",
        cwd,
      ]);
      expect(r.exitCode).toBe(ExitCode.USAGE);
    });

    it("refuses a missing document with NOT_FOUND", () => {
      const r = runCli([
        "project",
        "test",
        "--document",
        "nope.json",
        "--cwd",
        cwd,
      ]);
      expect(r.exitCode).toBe(ExitCode.ERROR);
      if (!r.envelope.ok) {
        expect(r.envelope.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("project capture / report", () => {
    const capture = () =>
      runCli([
        "project",
        "capture",
        "--document",
        "scene.json",
        "--out",
        "run.evidence.json",
        "--cwd",
        cwd,
      ]);

    it("writes a deterministic evidence packet bound to the document hash", () => {
      create();
      const r = capture();
      expect(r.exitCode).toBe(ExitCode.OK);
      if (!r.envelope.ok) return;
      expect(r.envelope.result["status"]).toBe("captured");
      expect(r.envelope.result["documentContentHash"]).toMatch(
        /^sha256:[0-9a-f]{64}$/,
      );

      const bytes = readFileSync(join(cwd, "run.evidence.json"), "utf8");
      // Re-capturing the same document reproduces the packet byte for byte.
      expect(capture().exitCode).toBe(ExitCode.OK);
      expect(readFileSync(join(cwd, "run.evidence.json"), "utf8")).toBe(bytes);
      // Deterministic means no wall-clock anywhere in the artifact.
      expect(bytes).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it("summarizes a captured packet", () => {
      create();
      capture();
      const r = runCli([
        "project",
        "report",
        "--evidence",
        "run.evidence.json",
        "--cwd",
        cwd,
      ]);
      expect(r.exitCode).toBe(ExitCode.OK);
      if (!r.envelope.ok) return;
      expect(r.envelope.result["status"]).toBe("all-checks-passed");
      expect(r.envelope.result["documentId"]).toBe("scene");
      expect(r.envelope.result["checkCount"]).toBe(2);
      expect(r.envelope.result["passedCount"]).toBe(2);
      expect(r.envelope.result["refusedChecks"]).toEqual([]);
    });

    it("refuses to report a document that is not an evidence packet", () => {
      create();
      const r = runCli([
        "project",
        "report",
        "--evidence",
        "scene.json",
        "--cwd",
        cwd,
      ]);
      expect(r.exitCode).toBe(ExitCode.USAGE);
      if (!r.envelope.ok) {
        expect(r.envelope.error.code).toBe("VALIDATION");
        expect(r.envelope.error.message).toContain("kind");
      }
    });

    it("refuses malformed evidence fields and check entries", () => {
      const validPacket = {
        schemaVersion: 1,
        kind: "sceneaxi.project-evidence",
        documentPath: "scene.json",
        documentId: "scene",
        documentContentHash: `sha256:${"a".repeat(64)}`,
        dataKeys: ["entities"],
        checks: [
          {
            name: "document-schema",
            status: "pass",
            detail: "Validated.",
          },
        ],
      };
      const invalidPackets = [
        { ...validPacket, documentContentHash: "forged" },
        { ...validPacket, documentTitle: 1 },
        { ...validPacket, dataKeys: [null] },
        { ...validPacket, checks: [] },
        { ...validPacket, checks: [null] },
        {
          ...validPacket,
          checks: [{ name: "document-schema", status: "pass", detail: null }],
        },
        { ...validPacket, unexpected: true },
      ];

      for (const [index, packet] of invalidPackets.entries()) {
        writeFileSync(
          join(cwd, "invalid.evidence.json"),
          `${JSON.stringify(
            {
              schemaVersion: 1,
              kind: "sceneaxi.document",
              id: `invalid-evidence-${String(index)}`,
              data: packet,
            },
            null,
            2,
          )}\n`,
          "utf8",
        );
        const r = runCli([
          "project",
          "report",
          "--evidence",
          "invalid.evidence.json",
          "--cwd",
          cwd,
        ]);
        expect(r.exitCode, String(index)).toBe(ExitCode.USAGE);
        if (!r.envelope.ok) {
          expect(r.envelope.error.code, String(index)).toBe("VALIDATION");
        }
      }
    });

    it("refuses capture without --out", () => {
      create();
      const r = runCli([
        "project",
        "capture",
        "--document",
        "scene.json",
        "--cwd",
        cwd,
      ]);
      expect(r.exitCode).toBe(ExitCode.USAGE);
    });
  });

  it("round-trips new → propose → apply → capture → report", () => {
    // `propose` replaces an existing pointer, so the seed document declares the
    // key the edit targets.
    expect(create(["--data", '{"entities":[]}']).exitCode).toBe(ExitCode.OK);

    const proposed = runCli([
      "project",
      "propose",
      "--document",
      "scene.json",
      "--pointer",
      "/data/entities",
      "--value",
      "[1,2]",
      "--out",
      "edit.proposal.json",
      "--cwd",
      cwd,
    ]);
    expect(proposed.exitCode).toBe(ExitCode.OK);

    const applied = runCli([
      "project",
      "apply",
      "--proposal",
      "edit.proposal.json",
      "--cwd",
      cwd,
    ]);
    expect(applied.exitCode).toBe(ExitCode.OK);

    const captured = runCli([
      "project",
      "capture",
      "--document",
      "scene.json",
      "--out",
      "after.evidence.json",
      "--cwd",
      cwd,
    ]);
    expect(captured.exitCode).toBe(ExitCode.OK);

    const reported = runCli([
      "project",
      "report",
      "--evidence",
      "after.evidence.json",
      "--cwd",
      cwd,
    ]);
    expect(reported.exitCode).toBe(ExitCode.OK);
    if (reported.envelope.ok && captured.envelope.ok) {
      // The report is bound to the bytes that were captured, post-apply.
      expect(reported.envelope.result["documentContentHash"]).toBe(
        captured.envelope.result["documentContentHash"],
      );
      expect(reported.envelope.result["status"]).toBe("all-checks-passed");
    }
  });
});
