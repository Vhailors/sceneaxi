import { createDesktopBridge } from "../src/lib/bridge.js";
import { createEditorCommandInvocation, EDITOR_COMMAND_REFUSALS } from "@sceneaxi/schemas";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_INPUT_ACTION_MAP, INPUT_ACTION_REFUSALS, resolveInputAction } from "@sceneaxi/schemas";
import { createDesktopInputActionHost, PROJECT_INPUT_ACTIONS_PATH, WORKSPACE_INPUT_ACTIONS_FILE } from "../src/lib/input-action-host.js";

const legacy = {
    "schemaVersion": 1,
    "kind": "sceneaxi.input-action-map",
    "bindings": [
        {
            "actionId": "editor.palette.open",
            "binding": {
                "device": "keyboard",
                "code": "KeyK",
                "modifiers": [
                    "primary"
                ]
            }
        },
        {
            "actionId": "editor.project.open",
            "binding": {
                "device": "keyboard",
                "code": "KeyO",
                "modifiers": [
                    "primary"
                ]
            }
        },
        {
            "actionId": "editor.project.save",
            "binding": {
                "device": "keyboard",
                "code": "KeyS",
                "modifiers": [
                    "primary"
                ]
            }
        },
        {
            "actionId": "editor.edit.undo",
            "binding": {
                "device": "keyboard",
                "code": "KeyZ",
                "modifiers": [
                    "primary"
                ]
            }
        },
        {
            "actionId": "editor.edit.redo",
            "binding": {
                "device": "keyboard",
                "code": "KeyZ",
                "modifiers": [
                    "primary",
                    "shift"
                ]
            }
        },
        {
            "actionId": "editor.run.play",
            "binding": {
                "device": "keyboard",
                "code": "KeyP",
                "modifiers": [
                    "primary"
                ]
            }
        },
        {
            "actionId": "editor.focus.next",
            "binding": {
                "device": "keyboard",
                "code": "Tab",
                "modifiers": []
            }
        },
        {
            "actionId": "editor.overlay.dismiss",
            "binding": {
                "device": "keyboard",
                "code": "Escape",
                "modifiers": []
            }
        },
        {
            "actionId": "viewport.orbit",
            "binding": {
                "device": "pointer",
                "button": 0,
                "gesture": "drag"
            }
        },
        {
            "actionId": "viewport.zoom",
            "binding": {
                "device": "wheel",
                "axis": "y",
                "direction": "any"
            }
        },
        {
            "actionId": "play.primary",
            "binding": {
                "device": "controller",
                "controller": 0,
                "input": "button",
                "control": 0,
                "direction": "any"
            }
        }
    ]
} as const;

const roots: string[] = [];

afterEach(() => { for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true }); });

function setup() { const root = mkdtempSync(join(tmpdir(), "sceneaxi-legacy-input-")); roots.push(root); const project = join(root, "project"); const workspace = join(root, "workspace"); mkdirSync(join(project, ".sceneaxi"), { recursive: true }); mkdirSync(workspace);

 return { project, workspace, host: createDesktopInputActionHost({ projectRoot: project, workspaceDirectory: workspace }) }; }

describe("EF-INPUT public desktop settings migration", () => {
    it.each(["project", "workspace"] as const)("loads legacy %s bytes and only writes migration on exact approved review", scope => {
        const { project, workspace, host } = setup();
        const path = scope === "project" ? join(project, PROJECT_INPUT_ACTIONS_PATH) : join(workspace, WORKSPACE_INPUT_ACTIONS_FILE);
        const bytes = JSON.stringify(legacy);
        writeFileSync(path, bytes);
        const inspected = host.inspect();
        expect(inspected.ok).toBe(true);

        if (!inspected.ok)
            throw Error(inspected.reason);
        expect(inspected.data.map.bindings).toHaveLength(DEFAULT_INPUT_ACTION_MAP.bindings.length);
        expect(inspected.data.map.bindings[10]).toEqual(legacy.bindings[10]);
        expect(resolveInputAction(inspected.data.map, "play", legacy.bindings[10]?.binding)).toMatchObject({ ok: true, action: { id: "play.primary" } });
        expect(readFileSync(path, "utf8")).toBe(bytes);
        const input = { scope, expectedBaseVersion: inspected.data.baseVersions[scope], actionId: "editor.project.save", binding: { device: "keyboard", code: "F8", modifiers: [] }, approved: false, reviewDigest: null };
        const reviewed = host.rebind(input);
        expect(reviewed.ok).toBe(true);

        if (!reviewed.ok)
            throw Error(reviewed.reason);
        expect(readFileSync(path, "utf8")).toBe(bytes);
        expect(host.rebind({ ...input, approved: true, reviewDigest: "sha256:wrong" })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.reviewMismatch });
        expect(readFileSync(path, "utf8")).toBe(bytes);
        expect(host.rebind({ ...input, approved: true, reviewDigest: reviewed.data.reviewDigest })).toMatchObject({ ok: true, data: { status: "committed", documentUndoAffected: false, layoutStateAffected: false } });
        expect(JSON.parse(readFileSync(path, "utf8"))).toMatchObject({ kind: "sceneaxi.input-action-overrides", scope });
        const restarted = createDesktopInputActionHost({ projectRoot: project, workspaceDirectory: workspace }).inspect();
        expect(restarted).toEqual(host.inspect());
        expect(host.rebind({ ...input, approved: true, reviewDigest: reviewed.data.reviewDigest })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.staleBase });
    });
    it("refuses corrupted historical full maps instead of substituting modern defaults", () => {
        const { project, host } = setup();
        writeFileSync(join(project, PROJECT_INPUT_ACTIONS_PATH), JSON.stringify({ ...legacy, bindings: legacy.bindings.slice(0, 10) }));
        expect(host.inspect()).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.persistedStateInvalid });
    });
});

it("retains legacy controller range, project precedence and explicit reset semantics", () => {
    const { project, workspace, host } = setup();
    const workspaceMap = { ...legacy, bindings: legacy.bindings.map(row => row.actionId === "play.primary" ? { ...row, binding: { device: "controller", controller: 3, input: "button", control: 31, direction: "positive" } } : row) };
    writeFileSync(join(workspace, WORKSPACE_INPUT_ACTIONS_FILE), JSON.stringify(workspaceMap));
    writeFileSync(join(project, PROJECT_INPUT_ACTIONS_PATH), JSON.stringify(legacy));
    const first = host.inspect();
    expect(first.ok).toBe(true);

    if (!first.ok)
        throw Error(first.reason);
    expect(first.data.map.bindings[10]).toEqual(legacy.bindings[10]);
    const reset = { scope: "project" as const, expectedBaseVersion: first.data.baseVersions.project, approved: false, reviewDigest: null };
    const reviewed = host.reset(reset);
    expect(reviewed.ok).toBe(true);

    if (!reviewed.ok)
        throw Error(reviewed.reason);
    expect(reviewed.data.after.bindings[10]).toEqual(workspaceMap.bindings[10]);
    expect(host.reset({ ...reset, approved: true, reviewDigest: reviewed.data.reviewDigest })).toMatchObject({ ok: true, data: { status: "committed" } });
    const after = host.inspect();
    expect(after.ok).toBe(true);

    if (!after.ok)
        throw Error(after.reason);
    expect(resolveInputAction(after.data.map, "play", workspaceMap.bindings[10]?.binding)).toMatchObject({ ok: true, action: { id: "play.primary" } });
    const resetWorkspace = { scope: "workspace" as const, expectedBaseVersion: after.data.baseVersions.workspace, approved: false, reviewDigest: null };
    const workspaceReview = host.reset(resetWorkspace);
    expect(workspaceReview.ok).toBe(true);

    if (!workspaceReview.ok)
        throw Error(workspaceReview.reason);
    expect(host.reset({ ...resetWorkspace, approved: true, reviewDigest: workspaceReview.data.reviewDigest })).toMatchObject({ ok: true });
    expect(host.inspect()).toMatchObject({ ok: true, data: { map: DEFAULT_INPUT_ACTION_MAP } });
});

it("refuses Kids and missing capabilities through the actual bridge before migrated-file mutation", () => {
    const { project, host } = setup();
    const path = join(project, PROJECT_INPUT_ACTIONS_PATH);
    const bytes = JSON.stringify(legacy);
    writeFileSync(path, bytes);
    const inspected = host.inspect();
    expect(inspected.ok).toBe(true);

    if (!inspected.ok)
        throw Error(inspected.reason);
    const input = { scope: "project", expectedBaseVersion: inspected.data.baseVersions.project, approved: true, reviewDigest: "sha256:" + "1".repeat(64) };
    const bridge = createDesktopBridge({ cwd: project, inputActions: host, commandCapabilities: ["input.actions"] });
    expect(bridge.handle({ action: "command", payload: createEditorCommandInvocation("input-actions-reset", "local-agent", input, "kids") })).toMatchObject({ ok: false, reason: EDITOR_COMMAND_REFUSALS.kidsDenied });
    const noCapability = createDesktopBridge({ cwd: project, inputActions: host, commandCapabilities: [] });
    expect(noCapability.handle({ action: "command", payload: createEditorCommandInvocation("input-actions-reset", "local-agent", input, "game") })).toMatchObject({ ok: false, reason: EDITOR_COMMAND_REFUSALS.capabilityDenied });
    expect(readFileSync(path, "utf8")).toBe(bytes);
});
