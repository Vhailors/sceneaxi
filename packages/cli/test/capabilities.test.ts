import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli, type DesktopLocalBridgeClientCall } from "@sceneaxi/cli";
import { COMPOSED_SCENE_DOCUMENT_DATA_KEY, createCatalogItemAtIntake, inertPluginManifestFixture, validateComposedScene } from "@sceneaxi/schemas";
import { applySceneDocumentImport, proposeSceneDocumentImport } from "@sceneaxi/importers";

const BIN = fileURLToPath(new URL("../bin/sceneaxi.mjs", import.meta.url));

describe("bounded CLI capabilities through the real binary", () => {
  let cwd: string;
  beforeEach(() => { cwd = mkdtempSync(join(tmpdir(), "sceneaxi-cap-")); });
  afterEach(() => { rmSync(cwd, { recursive: true, force: true }); });

  function call(...args: string[]) {
    const result = spawnSync(process.execPath, [BIN, ...args, "--json"], { cwd, encoding: "utf8", timeout: 10000 });
    expect(result.stderr).toBe("");
    expect(result.status).not.toBeNull();

    return { exit: result.status, envelope: JSON.parse(result.stdout) as { ok: boolean; result?: Record<string, unknown>; error?: { code: string } } };
  }

  it("covers every real command leaf and rejects inherited names at every group depth", () => {
    let leaves = 0;

    const visit = (path: string[]) => {
      const help = call(...path, "--help");
      expect(help.exit).toBe(0);
      expect(help.envelope.ok).toBe(true);
      const children = help.envelope.result?.["commands"];

      if (children !== undefined && children !== null) {
        for (const name of ["constructor", "__proto__", "toString"]) {
          expect(call(...path, name, "x")).toMatchObject({ exit: 2, envelope: { error: { code: "UNKNOWN_COMMAND" } } });
        }

        for (const child of Object.keys(children)) visit([...path, child]);

        return;
      }

      leaves += 1;
      const refused = call(...path, "--nonsense");
      expect(refused).toMatchObject(path.join(" ") === "demo gated"
        ? { exit: 3, envelope: { error: { code: "HELD_KEY" } } }
        : { exit: 2, envelope: { error: { code: "UNKNOWN_FLAG" } } });
    };

    visit([]);
    expect(leaves).toBe(30);
  }, 60000);
  it("initializes an openable admitted template; never overwrites or accepts escaping/unknown templates", () => {
    expect(call("project", "init", "--template", "workshop-bay")).toMatchObject({ exit: 0, envelope: { result: { status: "initialized", instanceCount: 3 } } });
    const before = readFileSync(join(cwd, "scene.json"), "utf8");
    const scene = JSON.parse(before).data[COMPOSED_SCENE_DOCUMENT_DATA_KEY];
    expect(validateComposedScene(scene).ok).toBe(true);
    expect(scene.instances).toHaveLength(3);
    expect(call("project", "test", "--document", "scene.json").exit).toBe(0);
    expect(call("project", "new", "--document", "imported.json").exit).toBe(0);
    const plan = proposeSceneDocumentImport({ sourceText: before, targetDocumentPath: "imported.json", cwd });
    expect(plan.ok).toBe(true);

    if (!plan.ok) throw new Error("Initialized template must be importable");
    expect(applySceneDocumentImport({ sourceText: before, targetDocumentPath: "imported.json", cwd }).ok).toBe(true);
    expect(JSON.parse(readFileSync(join(cwd, "imported.json"), "utf8")).data[COMPOSED_SCENE_DOCUMENT_DATA_KEY]).toEqual(scene);
    expect(call("project", "init", "--template", "workshop-bay").exit).toBe(1);

    for (const template of ["unknown", "../workshop-bay"]) expect(call("project", "init", "--template", template).exit).toBe(2);
    expect(call("project", "init", "--template", "workshop-bay", "--document", "../escape.json").exit).toBe(2);
    expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(before);
  });
  it("migrate validates current bytes unchanged and refuses unsupported schema", () => {
    expect(call("project", "new", "--document", "scene.json").exit).toBe(0);
    const before = readFileSync(join(cwd, "scene.json"), "utf8");
    expect(call("project", "migrate", "--document", "scene.json")).toMatchObject({ exit: 0, envelope: { result: { changed: false, status: "already-current" } } });
    expect(readFileSync(join(cwd, "scene.json"), "utf8")).toBe(before);
    writeFileSync(join(cwd, "scene.json"), before.replace('"schemaVersion": 1', '"schemaVersion": 99'));
    expect(call("project", "migrate", "--document", "scene.json").exit).toBe(2);
  });
  it("show reports recorded claims; verify rejects changed bytes, forged digests, malformed packet and escape", () => {
    call("project", "new", "--document", "scene.json");
    call("project", "capture", "--document", "scene.json", "--out", "run.evidence.json");
    expect(call("evidence", "show", "--evidence", "run.evidence.json").exit).toBe(0);
    expect(call("evidence", "verify", "--evidence", "run.evidence.json").exit).toBe(0);
    const before = readFileSync(join(cwd, "scene.json"), "utf8");
    writeFileSync(join(cwd, "scene.json"), before.replace('"data": {}', '"data": {"changed": true}'));
    expect(call("evidence", "verify", "--evidence", "run.evidence.json").exit).toBe(2);
    writeFileSync(join(cwd, "scene.json"), before);
    const original = readFileSync(join(cwd, "run.evidence.json"), "utf8");

    for (const patch of [(data: Record<string, unknown>) => { data["documentContentHash"] = `sha256:${"0".repeat(64)}`; }, (data: Record<string, unknown>) => { data["documentPath"] = "../escape.json"; }, (data: Record<string, unknown>) => { data["checks"] = []; }]) {
      const carrier = JSON.parse(original); patch(carrier.data); writeFileSync(join(cwd, "run.evidence.json"), JSON.stringify(carrier));
      expect(call("evidence", "verify", "--evidence", "run.evidence.json").exit).toBe(2);
    }

    writeFileSync(join(cwd, "run.evidence.json"), original);
    symlinkSync(tmpdir(), join(cwd, "outside"));

    for (const verb of ["show", "verify"]) {
      expect(call("evidence", verb, "--evidence", "outside/anything.json")).toMatchObject({ exit: 2, envelope: { error: { code: "VALIDATION" } } });
      expect(call("evidence", verb, "--evidence", "../escape.evidence.json")).toMatchObject({ exit: 2, envelope: { error: { code: "VALIDATION" } } });
      writeFileSync(join(cwd, "broken.evidence.json"), "{}");
      expect(call("evidence", verb, "--evidence", "broken.evidence.json").exit).toBe(2);
    }
  });
  it("lists and validates plugin contracts without executing an entrypoint; unknown capabilities refuse", () => {
    const manifest = inertPluginManifestFixture();
    writeFileSync(join(cwd, "plugin.json"), JSON.stringify(manifest));
    expect(call("plugin", "list").envelope.result).toMatchObject({ executableLoad: false });
    expect(call("plugin", "validate", "--manifest", "plugin.json").exit).toBe(0);
    writeFileSync(join(cwd, "plugin.json"), JSON.stringify({ ...manifest, capabilities: ["unknown.capability"] }));
    expect(call("plugin", "validate", "--manifest", "plugin.json").exit).toBe(2);
    expect(call("plugin", "load", "--manifest", "plugin.json").exit).toBe(2);
  });
  it("desktop play/build aliases preserve permission checks and real missing transport refusal", () => {
    for (const command of ["play", "build"]) {
      expect(call("desktop", command, "--allow", "project:read", "--input-json", command === "play" ? '{"documentPath":"scene.json"}' : '{"profile":"game","target":"linux"}', "--descriptor", join(cwd, "absent.json"))).toMatchObject({ exit: 1, envelope: { error: { code: "BRIDGE_UNAVAILABLE" } } });
    }
  });
  it("offline catalog submission validates shape and retains absent storage refusal", () => {
    writeFileSync(join(cwd, "item.json"), "{}");
    expect(call("catalog", "submit", "--item", "item.json", "--validate-only").exit).toBe(2);

    const item = createCatalogItemAtIntake({
      itemId: "fixture-item",
      assetPackage: { packageId: "fixture-pkg", contentHash: `sha256:${"0".repeat(64)}` },
      rights: { license: "CC-BY-4.0", rightsHolder: "Fixture Author", commercialUseAllowed: false },
      provenance: { origin: "fixture", ingestedAt: "2026-01-01T00:00:00.000Z", sourceDigest: `sha256:${"1".repeat(64)}` },
      aiGenerationDisclosure: { aiGenerated: false, disclosureText: "Authored by hand for tests." },
      compatibility: { profiles: ["game"], coreRange: "^0.0.0" },
    });

    const bytes = JSON.stringify(item);
    writeFileSync(join(cwd, "item.json"), bytes);
    expect(call("catalog", "submit", "--item", "item.json", "--validate-only")).toMatchObject({ exit: 0, envelope: { result: { status: "validated-offline", metadataComplete: true, approved: false, submitted: false, commerceActive: false } } });
    expect(call("catalog", "submit", "--item", "item.json")).toMatchObject({ exit: 1, envelope: { error: { code: "NOT_IMPLEMENTED" } } });
    expect(readFileSync(join(cwd, "item.json"), "utf8")).toBe(bytes);
  });
});

describe("desktop aliases delegate without widening input or permissions", () => {
  it.each([
    ["play", "sceneaxi.run.play", { documentPath: "scene.json" }],
    ["build", "sceneaxi.project.build", { profile: "game", target: "linux" }],
  ] as const)("passes admitted %s input to the exact tool and refuses wrong permission before transport", (command, tool, input) => {
    const calls: DesktopLocalBridgeClientCall[] = [];
    const desktopBridge = (call: DesktopLocalBridgeClientCall) => { calls.push(call);

 return { ok: false as const, code: "LOCAL_BRIDGE_DISCOVERY_UNAVAILABLE" as const, message: "fixture absent" }; };

    const args = ["desktop", command, "--input-json", JSON.stringify(input)];
    const tools = runCli(["desktop", "bridge", "tools"]);
    expect(tools.envelope.ok).toBe(true);

    if (!tools.envelope.ok) return;
    const permission = (tools.envelope.result["tools"] as Array<{ name: string; permission: string }>).find(t => t.name === tool)?.permission;
    expect(permission).toBeDefined();
    expect(runCli([...args, "--allow", "bridge:connect"], { desktopBridge }).exitCode).toBe(2);
    expect(calls).toHaveLength(0);
    runCli([...args, "--allow", permission ?? ""], { desktopBridge });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ tool, input, permission });
    expect(runCli([...args, "--allow", permission ?? "", "--tool", "sceneaxi.run.stop"], { desktopBridge }).exitCode).toBe(2);
  });
});
