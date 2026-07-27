import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DESKTOP_COMMANDS,
  DesktopExit,
  createDesktopSession,
  createDesktopVisualState,
  desktopVisualView,
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

  it("undoes in the working directory used by the completed apply", () => {
    const overrideCwd = mkdtempSync(
      join(tmpdir(), "sceneaxi-desktop-override-"),
    );
    try {
      const overrideDocument = createDocument({
        id: "scene",
        data: { entities: [{ id: "hero", x: 1 }] },
      });
      expect(
        writeDocumentFile(
          join(overrideCwd, "scene.json"),
          overrideDocument,
          { cwd: overrideCwd },
        ).ok,
      ).toBe(true);

      const baseBefore = readFileSync(join(cwd, "scene.json"), "utf8");
      const overrideBefore = readFileSync(
        join(overrideCwd, "scene.json"),
        "utf8",
      );
      const session = createDesktopSession({ cwd });
      expect(
        session.proposeEdit({
          documentPath: "scene.json",
          jsonPointer: "/data/entities/0/x",
          newValue: 7,
          cwd: overrideCwd,
        }).phase,
      ).toBe("reviewing");
      expect(session.accept().phase).toBe("applied");
      expect(readFileSync(join(overrideCwd, "scene.json"), "utf8")).not.toBe(
        overrideBefore,
      );

      expect(session.undo()).toEqual({
        ok: true,
        restoredPaths: ["scene.json"],
      });
      expect(readFileSync(join(overrideCwd, "scene.json"), "utf8")).toBe(
        overrideBefore,
      );
      expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(baseBefore);
    } finally {
      rmSync(overrideCwd, { recursive: true, force: true });
    }
  });

  it("undoes repeated override-root applies in LIFO root order", () => {
    const rootB = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-root-b-"));
    const rootC = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-root-c-"));
    try {
      for (const root of [rootB, rootC]) {
        expect(
          writeDocumentFile(
            join(root, "scene.json"),
            createDocument({
              id: "scene",
              data: { entities: [{ id: "hero", x: 1 }] },
            }),
            { cwd: root },
          ).ok,
        ).toBe(true);
      }

      const baseBefore = readFileSync(join(cwd, "scene.json"), "utf8");
      const beforeB = readFileSync(join(rootB, "scene.json"), "utf8");
      const beforeC = readFileSync(join(rootC, "scene.json"), "utf8");
      const session = createDesktopSession({ cwd });

      for (const [root, value] of [
        [rootB, 2],
        [rootC, 3],
      ] as const) {
        expect(
          session.proposeEdit({
            documentPath: "scene.json",
            jsonPointer: "/data/entities/0/x",
            newValue: value,
            cwd: root,
          }).phase,
        ).toBe("reviewing");
        expect(session.accept().phase).toBe("applied");
      }

      expect(session.undo()).toEqual({
        ok: true,
        restoredPaths: ["scene.json"],
      });
      expect(readFileSync(join(rootC, "scene.json"), "utf8")).toBe(beforeC);
      expect(readFileSync(join(rootB, "scene.json"), "utf8")).not.toBe(beforeB);
      expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(baseBefore);

      expect(session.undo()).toEqual({
        ok: true,
        restoredPaths: ["scene.json"],
      });
      expect(readFileSync(join(rootB, "scene.json"), "utf8")).toBe(beforeB);
      expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(baseBefore);

      expect(session.undo().ok).toBe(false);
      expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(baseBefore);
    } finally {
      rmSync(rootB, { recursive: true, force: true });
      rmSync(rootC, { recursive: true, force: true });
    }
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

  /**
   * `chrome` (sceneaxi#158) — the visual surface as a command.
   *
   * It opens no session and touches no document, so it is asserted without a
   * fixture cwd. What matters here is that a bad flag refuses instead of
   * rendering a state nobody asked for, and that text mode emits the document
   * itself so `> shell.html` works.
   */
  describe("chrome", () => {
    it("emits the document itself in text mode", () => {
      const r = runDesktopShell(["chrome"]);
      expect(r.exitCode).toBe(DesktopExit.OK);
      expect(r.stdout.startsWith("<!doctype html>")).toBe(true);
      expect(r.stdout).toBe(r.result["html"]);
    });

    it("emits the envelope with the same bytes under --json", () => {
      const r = runDesktopShell(["chrome", "--json"]);
      const parsed = JSON.parse(r.stdout) as {
        ok: boolean;
        result: { html: string; pixelsDrawn: boolean; tier: string };
      };
      expect(parsed.ok).toBe(true);
      expect(parsed.result.html).toBe(runDesktopShell(["chrome"]).stdout);
      expect(parsed.result.pixelsDrawn).toBe(false);
      expect(parsed.result.tier).toBe("regular");
    });

    it("renders each mode with that mode's own dock tab", () => {
      for (const [mode, tab] of [
        ["build", "changes"],
        ["animate", "timeline"],
        ["run", "console"],
        ["ship", "evidence"],
      ] as const) {
        const r = runDesktopShell(["chrome", "--mode", mode, "--json"]);
        expect(r.result["mode"]).toBe(mode);
        expect(r.result["dockTab"]).toBe(tab);
      }
    });

    it("refuses an unknown enum value by naming the whole set", () => {
      const r = runDesktopShell(["chrome", "--mode", "sculpting"]);
      expect(r.exitCode).toBe(DesktopExit.USAGE);
      expect(String(r.result["message"])).toContain("--mode must be one of");
      expect(String(r.result["message"])).toContain("plugins");
      expect(r.stdout).not.toContain("<!doctype html>");
    });

    it("refuses a non-integer or non-positive window size", () => {
      for (const size of ["0", "-1", "12.5", "wide"]) {
        const r = runDesktopShell(["chrome", "--width", size]);
        expect(r.exitCode, size).toBe(DesktopExit.USAGE);
      }
    });

    it("refuses an unknown flag rather than ignoring it", () => {
      const r = runDesktopShell(["chrome", "--theme", "light"]);
      expect(r.exitCode).toBe(DesktopExit.USAGE);
      expect(r.result["message"]).toBe("Unknown flag: --theme");
    });

    it("reports the window refusal below the declared minimum", () => {
      const r = runDesktopShell([
        "chrome",
        "--width",
        "800",
        "--height",
        "560",
        "--json",
      ]);
      expect(r.exitCode).toBe(DesktopExit.OK);
      expect(r.result["tier"]).toBe("minimum");
      expect(r.result["refusal"]).toBe("DESKTOP_WINDOW_BELOW_MINIMUM");
      expect(String(r.result["html"])).toContain("Window below the minimum size");
    });

    it("refuses the editor body on the refuse-only profile", () => {
      const r = runDesktopShell(["chrome", "--profile", "kids", "--json"]);
      expect(r.result["assistant"]).toBe("denied");
      expect(String(r.result["html"])).toContain("No editor on the Kids profile");
      expect(String(r.result["html"])).toContain("OPEN_PATH_KIDS_REFUSED");
    });

    it("is a projection, not a session: it never touches a document", () => {
      const before = readFileSync(join(cwd, "scene.json"), "utf8");
      runDesktopShell(["chrome", "--cwd", cwd]);
      expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(before);
    });
  });

  /**
   * Shell to CLI parity, where the behaviour is shared.
   *
   * The chrome's profile switch and the `open-path` command must report the
   * *same* open-path policy, because both read `openPathPolicyView()` from
   * `@sceneaxi/schemas` — which is also what `sceneaxi profile open-path` and
   * web-shell's `createOpenPathView()` report. Asserting the identity here is
   * what keeps the visual layer from growing a second description of a profile.
   */
  describe("chrome / open-path parity", () => {
    it("renders the same refuse-only profile the open-path command reports", () => {
      const policy = runDesktopShell(["open-path", "--json"]);
      const reported = policy.result["policy"] as {
        refuseOnlyProfile: string;
        rows: ReadonlyArray<{ profile: string; summary: string; demoLevel: string }>;
      };
      const view = desktopVisualView(createDesktopVisualState({ profile: "kids" }));

      expect(view.policy).toEqual(reported);
      expect(view.profileRefusal?.profile).toBe(reported.refuseOnlyProfile);
      expect(view.profileRefusal?.summary).toBe(
        reported.rows.find((row) => row.profile === reported.refuseOnlyProfile)
          ?.summary,
      );
    });

    it("names in the chrome exactly the profiles the policy covers", () => {
      const reported = (
        runDesktopShell(["open-path", "--json"]).result["policy"] as {
          rows: ReadonlyArray<{ profile: string }>;
        }
      ).rows.map((row) => row.profile);
      const view = desktopVisualView(createDesktopVisualState());
      expect(view.profiles.map((chip) => chip.packageName).sort()).toEqual(
        [...reported].sort(),
      );
    });

    it("keeps the desktop command map and the palette's claims in step", () => {
      // A palette row may only be driveable when it names a real command, and
      // `chrome` itself must be one of them.
      expect(Object.hasOwn(DESKTOP_COMMANDS, "chrome")).toBe(true);
      const driveable = desktopVisualView(createDesktopVisualState())
        .overlay.paletteGroups.flatMap((group) => group.items)
        .filter((item) => item.control.kind === "view");
      expect(driveable.length).toBeGreaterThan(0);
      for (const item of driveable) {
        const verb = item.cli.split(" ").at(-1) ?? "";
        expect(Object.hasOwn(DESKTOP_COMMANDS, verb)).toBe(true);
      }
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
