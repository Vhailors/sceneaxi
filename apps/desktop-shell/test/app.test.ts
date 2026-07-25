import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DESKTOP_COMMANDS,
  DesktopExit,
  createDesktopSession,
  runDesktopShell,
} from "@sceneaxi/desktop-shell";
import { createDocument, writeDocumentFile } from "@sceneaxi/authoring-core";

/**
 * Desktop-shell command layer (sceneaxi#116). The shell is a protocol client:
 * every operation below reaches authoring-core, never a second authoring
 * implementation and never a CLI subprocess.
 */
describe("desktop shell commands", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-app-"));
    const document = createDocument({
      id: "scene",
      data: { entities: [{ id: "hero", x: 1 }] },
    });
    const written = writeDocumentFile(join(cwd, "scene.json"), document, {
      cwd,
    });
    expect(written.ok).toBe(true);
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  const run = (argv: string[]) => runDesktopShell([...argv, "--cwd", cwd]);

  it("prints usage with no command and exits 0", () => {
    const r = runDesktopShell([]);
    expect(r.exitCode).toBe(DesktopExit.OK);
    expect(r.command).toBe("help");
    expect(r.result["commands"]).toEqual(DESKTOP_COMMANDS);
  });

  it("refuses an unknown command with USAGE", () => {
    const r = run(["frobnicate"]);
    expect(r.exitCode).toBe(DesktopExit.USAGE);
    expect(r.ok).toBe(false);
    expect(r.result["message"]).toContain("Unknown command");
  });

  it("reports document status", () => {
    const r = run(["status", "--document", "scene.json"]);
    expect(r.exitCode).toBe(DesktopExit.OK);
    expect(r.result["documentId"]).toBe("scene");
    expect(r.result["dataKeys"]).toEqual(["entities"]);
    expect(r.result["contentHash"]).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("refuses status on a missing document without throwing", () => {
    const r = run(["status", "--document", "absent.json"]);
    expect(r.exitCode).toBe(DesktopExit.ERROR);
    expect(r.ok).toBe(false);
  });

  it("refuses undeclared command flags before creating a session", () => {
    for (const argv of [
      ["status", "--document", "scene.json", "--pointer", "/data/x"],
      [
        "propose",
        "--document",
        "scene.json",
        "--pointer",
        "/data/entities/0/x",
        "--value",
        "7",
        "--force",
      ],
      [
        "apply",
        "--document",
        "scene.json",
        "--pointer",
        "/data/entities/0/x",
        "--value",
        "7",
        "--dry-run=true",
      ],
      ["undo", "--document", "scene.json"],
    ]) {
      const r = runDesktopShell(argv, () => {
        throw new Error("session must not be created");
      });
      expect(r.exitCode, argv.join(" ")).toBe(DesktopExit.USAGE);
      expect(r.result["message"], argv.join(" ")).toMatch(/^Unknown flag:/);
    }
  });

  it("proposes without writing anything", () => {
    const before = readFileSync(join(cwd, "scene.json"), "utf8");
    const r = run([
      "propose",
      "--document",
      "scene.json",
      "--pointer",
      "/data/entities/0/x",
      "--value",
      "7",
    ]);
    expect(r.exitCode).toBe(DesktopExit.OK);
    expect(r.result["phase"]).toBe("reviewing");
    expect(String(r.result["renderedDiff"])).toContain("review before accept");
    expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(before);
  });

  it("applies an edit and can undo it back to the original bytes", () => {
    const before = readFileSync(join(cwd, "scene.json"), "utf8");

    const applied = run([
      "apply",
      "--document",
      "scene.json",
      "--pointer",
      "/data/entities/0/x",
      "--value",
      "7",
    ]);
    expect(applied.exitCode).toBe(DesktopExit.OK);
    expect(applied.result["phase"]).toBe("applied");
    expect(applied.result["appliedPaths"]).toEqual(["scene.json"]);

    const afterApply = readFileSync(join(cwd, "scene.json"), "utf8");
    expect(afterApply).not.toBe(before);
    expect(afterApply).toContain('"x": 7');

    const undone = run(["undo"]);
    expect(undone.exitCode).toBe(DesktopExit.OK);
    expect(undone.result["restoredPaths"]).toEqual(["scene.json"]);
    expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(before);
  });

  it("refuses undo when there is nothing to undo", () => {
    const r = run(["undo"]);
    expect(r.exitCode).toBe(DesktopExit.ERROR);
    expect(r.ok).toBe(false);
  });

  it("refuses missing flags with USAGE and never touches the document", () => {
    const before = readFileSync(join(cwd, "scene.json"), "utf8");
    for (const argv of [
      ["status"],
      ["apply", "--document", "scene.json"],
      ["apply", "--document", "scene.json", "--pointer", "/data/entities/0/x"],
    ]) {
      expect(run(argv).exitCode, argv.join(" ")).toBe(DesktopExit.USAGE);
    }
    expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(before);
  });

  it("refuses a --value that is not JSON", () => {
    const r = run([
      "apply",
      "--document",
      "scene.json",
      "--pointer",
      "/data/entities/0/x",
      "--value",
      "not json",
    ]);
    expect(r.exitCode).toBe(DesktopExit.USAGE);
    expect(String(r.result["message"])).toContain("valid JSON");
  });

  it("refuses an edit whose pointer does not exist, with typed diagnostics", () => {
    const r = run([
      "apply",
      "--document",
      "scene.json",
      "--pointer",
      "/data/nope",
      "--value",
      "1",
    ]);
    expect(r.exitCode).toBe(DesktopExit.USAGE);
    expect(Array.isArray(r.result["diagnostics"])).toBe(true);
  });

  it("refuses an invalid document rather than half-applying", () => {
    writeFileSync(join(cwd, "broken.json"), "{ not json", "utf8");
    const r = run([
      "apply",
      "--document",
      "broken.json",
      "--pointer",
      "/data/x",
      "--value",
      "1",
    ]);
    expect(r.exitCode).toBe(DesktopExit.USAGE);
  });

  it("renders a pending recovery transaction identity", () => {
    const session = createDesktopSession({ cwd });
    const pending = {
      phase: "pending" as const,
      unifiedDiff: null,
      renderedDiff: null,
      proposal: null,
      appliedPaths: null,
      journalRecoveryPending: true,
      transactionId: "0000000000000-0000000000000000",
      diagnostics: [
        {
          code: "apply-in-progress" as const,
          message: "Apply recovery is pending.",
        },
      ],
    };
    const r = runDesktopShell(
      [
        "apply",
        "--document",
        "scene.json",
        "--pointer",
        "/data/entities/0/x",
        "--value",
        "7",
      ],
      () => ({ ...session, accept: () => pending }),
    );
    expect(r.exitCode).toBe(DesktopExit.ERROR);
    expect(r.result["phase"]).toBe("pending");
    expect(r.result["journalRecoveryPending"]).toBe(true);
    expect(r.result["transactionId"]).toBe(
      "0000000000000-0000000000000000",
    );
  });

  describe("rendering", () => {
    it("emits the same data as text and as --json", () => {
      const text = run(["status", "--document", "scene.json"]);
      const json = runDesktopShell([
        "status",
        "--document",
        "scene.json",
        "--cwd",
        cwd,
        "--json",
      ]);

      expect(text.exitCode).toBe(json.exitCode);
      expect(text.result).toEqual(json.result);
      expect(text.help).toEqual(json.help);

      expect(json.format).toBe("json");
      expect(JSON.parse(json.stdout)).toEqual({
        app: "sceneaxi-desktop",
        ok: json.ok,
        command: json.command,
        result: json.result,
        help: json.help,
      });

      expect(text.format).toBe("text");
      expect(text.stdout.startsWith("{")).toBe(false);
      expect(text.stdout).toContain("ok: status");
    });
  });

  it("accepts an injected session (the app layer owns no authoring state)", () => {
    const session = createDesktopSession({ cwd });
    const r = runDesktopShell(
      ["status", "--document", "scene.json"],
      () => session,
    );
    expect(r.exitCode).toBe(DesktopExit.OK);
    expect(r.result["documentId"]).toBe("scene");
  });
});
