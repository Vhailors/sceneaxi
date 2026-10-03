type DesktopRequest = Parameters<ReturnType<typeof import("../../desktop/linux/src/index.ts").createDesktopBridge>["handle"]>[0];

type DesktopReply = ReturnType<ReturnType<typeof import("../../desktop/linux/src/index.ts").createDesktopBridge>["handle"]>;
/** Semantic interaction coverage for the truthful desktop command registry. */

import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT_ACTION_MAP, reviewInputActionRebind, } from "@sceneaxi/schemas";
import { Window as HappyWindow, type HTMLElement as HappyHTMLElement, } from "happy-dom";
import { DESKTOP_INTERACTION_COMMANDS, DESKTOP_PALETTE_SHORTCUT, DESKTOP_PRODUCT_REFUSALS, type DesktopInteractionCommand, } from "@sceneaxi/desktop-shell";
import { ENGINE_ANSWERED_COMMANDS, commandHarness as harness, commandElement as element, settleCommands as settle, clickCommand as click, shortcut, } from "../helpers/desktop-chrome-golden.ts";

const FORM_NAVIGATION_COMMANDS = new Set([
    "package-install", "package-remove", "project-migration-commit", "extension-start",
    "input-action-rebind", "input-actions-reset",
    "scene-prefab-define", "scene-prefab-instance", "scene-prefab-override", "scene-prefab-refresh", "viewport-source-set", "physics-evaluate",
]);

function textarea(window: HappyWindow, selector: string) {
    // SAFETY: the selector or createElement call identifies the shipped form control in the same happy-dom realm; the test uses its native control properties.
    return element(window, selector) as HappyHTMLElement & {
        value: string;
    };
}

async function prepare(command: DesktopInteractionCommand, window: HappyWindow) {
    if (command.id === "project-save" || command.id === "edit-undo" || command.id === "edit-redo") {
        await click(window, "#web-stage-html");
    }

    if (command.id === "edit-undo") {
        await click(window, '#project-save[data-command="project-save"]');
    }

    if (command.id === "edit-redo") {
        await click(window, '#project-save[data-command="project-save"]');
        await click(window, '#menu-command-edit-undo');
    }

    if (command.id === "project-git-stage" || command.id === "project-git-commit-prepare") {
        await click(window, '#menu-command-project-git-status');
        // SAFETY: the selector or createElement call identifies the shipped form control in the same happy-dom realm; the test uses its native control properties.
        const path = element(window, '[data-project-git-path][value="scene.json"]') as import("happy-dom").HTMLInputElement;
        path.checked = true;
    }

    if (command.id === "project-git-commit-prepare") {
        // SAFETY: the selector or createElement call identifies the shipped form control in the same happy-dom realm; the test uses its native control properties.
        const message = element(window, "[data-project-git-message]") as import("happy-dom").HTMLInputElement;
        message.value = "feat: prepare";
    }
}

function expectedEffect(command: DesktopInteractionCommand) {
    switch (command.id) {
        case "project-new":
            return { plane: "project", action: "choose-new", op: null } as const;
        case "project-open":
            return { plane: "project", action: "choose-open", op: null } as const;
        case "project-save":
            return { plane: "engine", action: "command", op: "project-save" } as const;
        case "project-git-status":
            return { plane: "engine", action: "command", op: "project-git-status" } as const;
        case "project-git-diff":
            return { plane: "engine", action: "command", op: "project-git-diff" } as const;
        case "project-git-stage":
            return { plane: "engine", action: "command", op: "project-git-stage" } as const;
        case "project-git-commit-prepare":
            return { plane: "engine", action: "command", op: "project-git-commit-prepare" } as const;
        case "ship-export-web":
            return { plane: "engine", action: "command", op: "ship-export-web" } as const;
        case "edit-undo":
            return { plane: "engine", action: "command", op: "edit-undo" } as const;
        case "edit-redo":
            return { plane: "engine", action: "command", op: "edit-redo" } as const;
        case "run-play":
            return { plane: "engine", action: "command", op: "run-play" } as const;
        default:
            return { plane: "engine", action: "command", op: command.id } as const;
    }
}

async function invoke(path: "menu" | "palette" | "shortcut", command: DesktopInteractionCommand) {
    const { window, calls, requests } = await harness();
    await prepare(command, window);
    calls.splice(0);

    if (path === "menu") {
        await click(window, `[data-menu-trigger="${command.menu}"]`);
        await click(window, `#menu-command-${command.id}`);
    }
    else if (path === "palette") {
        shortcut(window, DESKTOP_PALETTE_SHORTCUT.key);
        expect(element(window, '.overlay[data-overlay="palette"]').hidden).toBe(false);
        await click(window, `#palette-${command.id}`);
    }
    else {
        if (command.key === null)
            throw new Error(`${command.id} has no accelerator`);
        const event = shortcut(window, command.key, undefined, command.id === "edit-redo");
        expect(event.defaultPrevented).toBe(true);
        await settle(window);
    }

    if (FORM_NAVIGATION_COMMANDS.has(command.id)) {
        expect(calls).toEqual([]);
        expect(element(window, command.id === "viewport-source-set" ? '[data-command-field="source"]' : `[data-editor-command-form="${command.id}"]`)).not.toBeNull();
        expect(element(window, "[data-outcome-code]").textContent).not.toBe("EDITOR_COMMAND_INPUT_INVALID");

        return;
    }

    expect(calls).toContainEqual(expectedEffect(command));

    if (command.id === "project-build") {
        // SAFETY: this request is emitted by the desktop protocol function exercised in this fixture; the projection reads only its documented IPC fields.
        expect(requests.find((request) => (request.payload as {
            commandId?: string;
        }).commandId === command.id))
            .toMatchObject({ payload: { input: { profile: "web", target: "linux" } } });
        expect(element(window, "[data-outcome-code]").textContent).toBe("PROJECT_BUILD_SIGNING_MISSING");
    }

    if (command.id === "workspace-layout-apply") {
        // SAFETY: this request is emitted by the desktop protocol function exercised in this fixture; the projection reads only its documented IPC fields.
        expect(requests.find((request) => (request.payload as {
            commandId?: string;
        }).commandId === command.id))
            .toMatchObject({ payload: { input: { profile: expect.any(String), leftVisible: expect.any(Boolean), inspectorVisible: expect.any(Boolean) } } });
    }

    if (ENGINE_ANSWERED_COMMANDS.has(command.id)) {
        // SAFETY: this request is emitted by the desktop protocol function exercised in this fixture; the projection reads only its documented IPC fields.
        expect(requests.some((request) => (request.payload as {
            commandId?: string;
        }).commandId === command.id)).toBe(true);
        expect(element(window, "[data-outcome-code]").textContent).toBe("DESKTOP_COMMAND_TEST_ANSWERED");
    }

    if (command.id === "run-play") {
        expect(element(window, ".shell").dataset.mode).toBe("run");
        expect(element(window, "[data-project-status]").textContent).toContain("Played composed scene");
    }

    if (command.id === "ship-export-web") {
        expect(element(window, ".shell").dataset.mode).toBe("ship");
        expect(element(window, "[data-project-status]").textContent).toContain("Exported Web bundle");
        expect(element(window, "[data-ship-bundle-digest]").textContent).toBe(`sha256:${"c".repeat(64)}`);
    }

    if (command.id === "project-git-status" || command.id === "project-git-diff" ||
        command.id === "project-git-stage" || command.id === "project-git-commit-prepare") {
        expect(element(window, ".shell").dataset.mode).toBe("ship");
        expect(element(window, "[data-project-git-evidence]").textContent).toContain('"kind": "sceneaxi.project-git-state"');
    }
}

describe("desktop command menu, palette, and accelerator parity", () => {
    for (const command of DESKTOP_INTERACTION_COMMANDS) {
        it(`invokes ${command.id} from its menu`, async () => {
            await invoke("menu", command);
        });
        it(`invokes ${command.id} from the palette`, async () => {
            await invoke("palette", command);
        });

        if (command.key !== null) {
            it(`invokes ${command.id} from ${command.accelerator}`, async () => {
                await invoke("shortcut", command);
            });
            it(`does not invoke ${command.id} from text entry`, async () => {
                const commandKey = command.key;

                if (commandKey === null)
                    throw new Error(`${command.id} has no accelerator`);
                const { window, calls } = await harness();
                await prepare(command, window);
                calls.splice(0);
                const shell = element(window, ".shell");
                // SAFETY: the selector or createElement call identifies the shipped form control in the same happy-dom realm; the test uses its native control properties.
                const input = window.document.createElement("input") as HappyHTMLElement;
                // SAFETY: the selector or createElement call identifies the shipped form control in the same happy-dom realm; the test uses its native control properties.
                const editable = window.document.createElement("div") as HappyHTMLElement;
                editable.setAttribute("contenteditable", "");
                // SAFETY: the selector or createElement call identifies the shipped form control in the same happy-dom realm; the test uses its native control properties.
                const plaintext = window.document.createElement("div") as HappyHTMLElement;
                plaintext.setAttribute("contenteditable", "plaintext-only");
                // SAFETY: the selector or createElement call identifies the shipped form control in the same happy-dom realm; the test uses its native control properties.
                const inherited = window.document.createElement("span") as HappyHTMLElement;
                editable.append(inherited);
                shell.append(input, editable, plaintext);

                for (const target of [input, editable, plaintext, inherited]) {
                    const event = shortcut(window, commandKey, target, command.id === "edit-redo");
                    await settle(window);
                    expect(event.defaultPrevented).toBe(false);
                    expect(calls).not.toContainEqual(expectedEffect(command));
                }
            });
        }
    }

    it("stages an inspector mutation through the shared Change Review proposal", async () => {
        const { window, requests } = await harness();
        await click(window, "#mode-build");
        const mutation = textarea(window, '[data-catalog-mutation="physics"]');
        mutation.value = JSON.stringify({ kind: "world-set", gravityY: -9.81, stepMs: 16, seed: 1 });
        await click(window, "#physics-stage");

        const request = requests.find((candidate) => {
            // SAFETY: this request is emitted by the desktop protocol function exercised in this fixture; the projection reads only its documented IPC fields.
            const payload = candidate["payload"] as Record<string, import("@sceneaxi/schemas").JsonValue> | undefined;

            return payload?.["commandId"] === "physics-apply";
        });

        expect(request).toMatchObject({ payload: { input: { mutation: { kind: "world-set" } } } });
        expect(element(window, "[data-change-proposal]").hidden).toBe(false);
        expect(element(window, "[data-change-diff]").textContent).toContain("Physics change staged");
    });
    it("stages all four inspector mutation types through Change Review", async () => {
        for (const kind of ["physics", "environment", "material", "effect"] as const) {
            const { window, requests } = await harness();
            await click(window, "#mode-build");
            const mutation = textarea(window, `[data-catalog-mutation="${kind}"]`);
            mutation.value = JSON.stringify({ kind: "set" });
            await click(window, `#${kind}-stage`);

            const request = requests.find((candidate) => {
                // SAFETY: this request is emitted by the desktop protocol function exercised in this fixture; the projection reads only its documented IPC fields.
                const payload = candidate["payload"] as Record<string, import("@sceneaxi/schemas").JsonValue> | undefined;

                return payload?.["commandId"] === `${kind}-apply`;
            });

            expect(request, `${kind} GUI apply command`).toMatchObject({
                payload: { input: { mutation: { kind: "set" } } },
            });
            expect(element(window, "[data-change-proposal]").hidden).toBe(false);
        }
    });
    it("restores a rebind into the emitted accelerator resolver and labels", async () => {
        const reviewed = reviewInputActionRebind(DEFAULT_INPUT_ACTION_MAP, "editor.project.save", { device: "keyboard", code: "KeyB", modifiers: ["primary"] });

        if (!reviewed.ok || !("map" in reviewed))
            throw new Error("rebind fixture refused");
        const { window, calls } = await harness("web", "unavailable", true, undefined, reviewed.map);
        await click(window, "#web-stage-html");
        calls.splice(0);
        const oldEvent = shortcut(window, "s");
        await settle(window);
        expect(oldEvent.defaultPrevented).toBe(false);
        expect(calls).toHaveLength(0);
        const reboundEvent = shortcut(window, "b");
        await settle(window);
        expect(reboundEvent.defaultPrevented).toBe(true);
        expect(calls).toContainEqual({ plane: "engine", action: "command", op: "project-save" });
        expect(element(window, "#menu-command-project-save kbd").textContent).toBe("Ctrl/Cmd+B");
    });
    it("keeps command accelerators active from the recent-project chooser", async () => {
        const { window, calls } = await harness();
        const event = shortcut(window, "o", element(window, "#project-recent-select"));
        await settle(window);
        expect(event.defaultPrevented).toBe(true);
        expect(calls).toContainEqual({ plane: "project", action: "choose-open", op: null });
    });
    it("confirms a bound profile through real DOM audio events without conflating startup commands", async () => {
        const { window, calls, requests, initializationRequests, audioProfiles } = await harness();
        expect(initializationRequests).toEqual([{ action: "profile", payload: { profile: "web" } }]);
        const before = requests.length;
        await click(window, "#profile-game");
        expect(element(window, ".shell").dataset.profile).toBe("game");
        expect(requests.slice(before)).toEqual([{ action: "profile", payload: { profile: "game" } }]);
        expect(calls).toEqual([{ plane: "engine", action: "profile", op: null }]);
        expect(audioProfiles).toEqual([null, null, null, null, "web", null, "game"]);
    });
    it("allows rootless business profile switching but never grants audio authority", async () => {
        const { window, calls, requests, initializationRequests, audioProfiles } = await harness("web", "unavailable", false);
        expect(initializationRequests).toEqual([]);
        await click(window, "#profile-game");
        expect(element(window, ".shell").dataset.profile).toBe("game");
        expect(requests).toEqual([{ action: "profile", payload: { profile: "game" } }]);
        expect(calls).toEqual([{ plane: "engine", action: "profile", op: null }]);
        expect(audioProfiles).toEqual([null]);
    });
    it("keeps the prior business profile and null audio fence when the host refuses a switch", async () => {
        const { window, calls, audioProfiles } = await harness();
        let refusedRequests = 0;
        Object.defineProperty(window, "sceneaxiDesktopLinux", {
            configurable: true,
            value: {
                request: async (request: DesktopRequest) => {
                    expect(request).toEqual({ action: "profile", payload: { profile: "game" } });
                    refusedRequests += 1;

                    return { ok: false, reason: "DESKTOP_PROFILE_REFUSED", message: "Profile refused." };
                },
            },
        });
        await click(window, "#profile-game");
        expect(refusedRequests).toBe(1);
        expect(element(window, ".shell").dataset.profile).toBe("web");
        expect(element(window, "[data-project-status]").textContent).toContain("DESKTOP_PROFILE_REFUSED");
        expect(calls).toEqual([]);
        expect(audioProfiles).toEqual([null, null, null, null, "web", null]);
    });
    it("refuses Export Web by name when no project is open", async () => {
        const { window, calls } = await harness("web", "unavailable", false);
        await click(window, "#mode-ship");
        calls.splice(0);
        await click(window, "#ship-export-web");
        expect(calls).toEqual([]);
        expect(element(window, "[data-project-status]").textContent).toContain(DESKTOP_PRODUCT_REFUSALS.projectRequired);
        expect(element(window, "[data-outcome-code]").textContent).toContain(DESKTOP_PRODUCT_REFUSALS.projectRequired);
    });
    it("refuses incomplete contained Git evidence without rendering it", async () => {
        const { window } = await harness("web", "unavailable", true, {
            schemaVersion: 1,
            kind: "sceneaxi.project-git-state",
            projectId: "project-command-test",
            branch: "main",
            head: "a".repeat(40),
            detached: false,
            canonicalFiles: ["scene.json", "sceneaxi.project.json"],
            entries: [],
            canonicalChanges: [],
            unrelatedChanges: [],
            workingTreeDiff: "",
            stagedDiff: "",
            clean: true,
            undoScope: "sceneaxi-document-only",
        });

        await click(window, '[data-menu-trigger="file"]');
        await click(window, "#menu-command-project-git-status");
        expect(element(window, "[data-project-status]").textContent).toContain(DESKTOP_PRODUCT_REFUSALS.runtimeRequestRefused);
        expect(element(window, "[data-outcome-code]").textContent).toBe(DESKTOP_PRODUCT_REFUSALS.runtimeRequestRefused);
        expect(element(window, "[data-project-git-evidence]").hidden).toBe(true);
    });
    it("stages exact evidence paths without lossy text parsing", async () => {
        const exactPath = " notes,2026.txt";

        const repositoryState = {
            schemaVersion: 1,
            kind: "sceneaxi.project-git-state",
            projectId: "project-command-test",
            branch: "main",
            head: "a".repeat(40),
            detached: false,
            canonicalFiles: ["scene.json", "sceneaxi.project.json"],
            entries: [{ path: exactPath, index: "?", worktree: "?", canonical: false, conflict: false }],
            canonicalChanges: [],
            unrelatedChanges: [{ path: exactPath, index: "?", worktree: "?", canonical: false, conflict: false }],
            conflicts: [],
            workingTreeDiff: "",
            stagedDiff: "",
            clean: false,
            undoScope: "sceneaxi-document-only",
        };

        const { window, requests } = await harness("web", "unavailable", true, repositoryState);
        await click(window, '#menu-command-project-git-status');

        // SAFETY: the selector or createElement call identifies the shipped form control in the same happy-dom realm; the test uses its native control properties.
        const path = [...window.document.querySelectorAll('[data-project-git-path]')]
            .find((candidate) => (candidate as import("happy-dom").HTMLInputElement).value === exactPath) as import("happy-dom").HTMLInputElement | undefined;

        expect(path).toBeDefined();

        if (path === undefined)
            return;
        path.checked = true;
        await click(window, '#menu-command-project-git-stage');

        const invocation = requests.find((request) => {
            // SAFETY: this request is emitted by the desktop protocol function exercised in this fixture; the projection reads only its documented IPC fields.
            const payload = request["payload"] as Record<string, import("@sceneaxi/schemas").JsonValue> | undefined;

            return payload?.["commandId"] === "project-git-stage";
        });

        expect(invocation).toMatchObject({
            payload: { input: { paths: [exactPath] } },
        });
    });
    it("retires Ship evidence when the project becomes dirty", async () => {
        const { window } = await harness();
        await click(window, "#ship-export-web");
        expect(element(window, "[data-ship-export-evidence]").hidden).toBe(false);
        await click(window, "#web-stage-html");
        expect(element(window, "[data-ship-export-evidence]").hidden).toBe(true);
        expect(element(window, "[data-ship-export-status]").textContent).toContain("No export has run for the current saved project bytes");
    });
    it("names the in-flight refusal when a command is re-invoked mid-request", async () => {
        const { window } = await harness();
        Object.defineProperty(window, "sceneaxiDesktopLinux", {
            configurable: true,
            value: { request: () => new Promise(() => { }) },
        });
        shortcut(window, "p");

        for (let turn = 0; turn < 10; turn += 1)
            await Promise.resolve();
        expect(element(window, "#project-save").getAttribute("aria-disabled")).toBe("true");
        expect(element(window, "#menu-command-project-save").getAttribute("aria-disabled")).toBe("true");
        const running = element(window, "[data-project-status]").textContent;
        const pill = element(window, "[data-project-state]").dataset.projectState;
        shortcut(window, "s");

        for (let turn = 0; turn < 10; turn += 1)
            await Promise.resolve();
        expect(element(window, '.overlay[data-overlay="outcome"]').hidden).toBe(false);
        expect(element(window, "[data-outcome-code]").textContent).toBe(DESKTOP_PRODUCT_REFUSALS.requestInFlight);
        // The collided-with operation is still running, so the project channel must
        // keep reporting the project rather than the refused command.
        expect(element(window, "[data-project-status]").textContent).toBe(running);
        expect(element(window, "[data-project-state]").dataset.projectState).toBe(pill);
    });
    it("keeps Undo refused when availability refreshes during a request", async () => {
        const { window } = await harness();
        await click(window, "#web-stage-html");
        await click(window, '#project-save[data-command="project-save"]');

        // SAFETY: commandHarness installs sceneaxiDesktopLinux on this same happy-dom window before returning it.
        const host = (window as HappyWindow & {
            sceneaxiDesktopLinux: {
                project: (request: DesktopRequest) => Promise<DesktopReply>;
                request: (request: DesktopRequest) => Promise<DesktopReply>;
            };
        }).sceneaxiDesktopLinux;

        Object.defineProperty(window, "sceneaxiDesktopLinux", {
            configurable: true,
            value: {
                project: host.project,
                request: async (request: DesktopRequest) => {
                    // SAFETY: this request is emitted by the desktop protocol function exercised in this fixture; the projection reads only its documented IPC fields.
                    const typed = request as {
                        action?: unknown;
                        payload?: {
                            commandId?: unknown;
                        };
                    };

                    if (typed.action === "command" && typed.payload?.commandId === "run-play") {
                        return new Promise(() => { });
                    }

                    return host.request(request);
                },
            },
        });
        shortcut(window, "p");

        for (let turn = 0; turn < 20; turn += 1)
            await Promise.resolve();

        for (const selector of ["#menu-command-edit-undo", "#palette-edit-undo"]) {
            const undo = element(window, selector);
            expect(undo.getAttribute("aria-disabled")).toBe("true");
            expect(undo.dataset.refusal).toBe(DESKTOP_PRODUCT_REFUSALS.requestInFlight);
            expect(undo.hasAttribute("data-busy")).toBe(true);
        }
    });
    it("refuses Undo rather than dropping a staged proposal with the Save it reverses", async () => {
        const { window, calls } = await harness();
        await click(window, "#web-stage-html");
        await click(window, '#project-save[data-command="project-save"]');
        // Stage a second edit the host is still holding for review.
        await click(window, "#web-inject-asset");
        expect(calls.filter((call) => call.op === "propose")).toHaveLength(2);
        calls.splice(0);
        const event = shortcut(window, "z");
        await settle(window);
        expect(event.defaultPrevented).toBe(true);
        expect(calls.some((call) => call.op === "undo")).toBe(false);
        expect(element(window, '.overlay[data-overlay="outcome"]').hidden).toBe(false);
        expect(element(window, "[data-outcome-code]").textContent).toBe(DESKTOP_PRODUCT_REFUSALS.undoStagedProposal);
        expect(element(window, "[data-project-status]").textContent).toContain(DESKTOP_PRODUCT_REFUSALS.undoStagedProposal);
        // The staged proposal survives: saving it still reaches the host's accept.
        await click(window, "#overlay-close-outcome-dismiss");
        await click(window, '#project-save[data-command="project-save"]');
        expect(calls).toContainEqual({ plane: "engine", action: "command", op: "project-save" });
    });
    it("exposes persisted Undo availability after a renderer relaunch", async () => {
        const { window, calls } = await harness("web", "available");
        const undo = element(window, "#menu-command-edit-undo");
        expect(undo.getAttribute("aria-disabled")).toBeNull();
        const event = shortcut(window, "z");
        await settle(window);
        expect(event.defaultPrevented).toBe(true);
        expect(calls).toContainEqual({
            plane: "engine",
            action: "command",
            op: "edit-undo",
        });
        expect(undo.getAttribute("aria-disabled")).toBe("true");
    });
    it("keeps Undo inert while journal recovery is pending", async () => {
        const { window, calls } = await harness("web", "recovery-pending");
        const undo = element(window, "#menu-command-edit-undo");
        expect(undo.getAttribute("aria-disabled")).toBe("true");
        expect(undo.dataset.refusal).toBe(DESKTOP_PRODUCT_REFUSALS.recoveryPending);
        const event = shortcut(window, "z");
        await settle(window);
        expect(event.defaultPrevented).toBe(true);
        expect(calls).toHaveLength(0);
        expect(element(window, "[data-outcome-code]").textContent).toBe(DESKTOP_PRODUCT_REFUSALS.recoveryPending);
    });
    it("names the refusal when an accelerator reaches an unavailable command", async () => {
        const { window, calls } = await harness();
        const undo = element(window, "#menu-command-edit-undo");
        expect(undo.getAttribute("aria-disabled")).toBe("true");
        const before = element(window, "[data-project-status]").textContent;
        const event = shortcut(window, "z");
        await settle(window);
        expect(event.defaultPrevented).toBe(true);
        expect(calls).toHaveLength(0);
        expect(element(window, '.overlay[data-overlay="outcome"]').hidden).toBe(false);
        expect(element(window, "[data-outcome-code]").textContent).toBe(undo.dataset.refusal);
        // Its reason is the sentence the refusal disclosure prints for that code.
        expect(element(window, "[data-outcome-message]").textContent).toBe(element(window, `#refusal-${undo.dataset.refusal}`).textContent?.replace(String(undo.dataset.refusal), "").trim());
        expect(element(window, "[data-project-status]").textContent).toBe(before);
        await click(window, "#overlay-close-outcome-dismiss");
        expect(element(window, '.overlay[data-overlay="outcome"]').hidden).toBe(true);
    });
    it("names the Kids refusal when an accelerator is pressed on that profile", async () => {
        const { window, calls } = await harness("kids");
        const save = element(window, "#menu-command-project-save");
        expect(save.getAttribute("aria-disabled")).toBe("true");
        shortcut(window, "s");
        await settle(window);
        expect(calls).toHaveLength(0);
        expect(element(window, '.overlay[data-overlay="outcome"]').hidden).toBe(false);
        expect(element(window, "[data-outcome-code]").textContent).toBe(save.dataset.refusal);
    });
    it("ignores a Shift-modified chord that no menu advertises", async () => {
        const { window, calls } = await harness();

        const event = new window.KeyboardEvent("keydown", {
            key: "o",
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
        });

        // SAFETY: the selector or createElement call identifies the shipped form control in the same happy-dom realm; the test uses its native control properties.
        (window.document.body as HappyHTMLElement).dispatchEvent(event);
        await settle(window);
        expect(event.defaultPrevented).toBe(false);
        expect(calls).toHaveLength(0);
    });
    it("shows and dismisses the real refusal returned by a command", async () => {
        const { window } = await harness();
        Object.defineProperty(window, "sceneaxiDesktopLinux", {
            configurable: true,
            value: {
                request: async () => ({
                    ok: false,
                    reason: "DESKTOP_SCENE_NOT_COMPOSABLE",
                    message: "The active composition is invalid.",
                    detail: "scene.json has no composition",
                }),
            },
        });
        shortcut(window, "p");
        await settle(window);
        const outcome = element(window, '.overlay[data-overlay="outcome"]');
        expect(outcome.hidden).toBe(false);
        expect(element(window, "[data-outcome-title]").textContent).toBe("Play refused");
        expect(element(window, "[data-outcome-code]").textContent).toBe("DESKTOP_SCENE_NOT_COMPOSABLE");
        expect(element(window, "[data-outcome-message]").textContent).toBe("scene.json has no composition");
        await click(window, "#overlay-close-outcome-dismiss");
        expect(element(window, '.overlay[data-overlay="outcome"]').hidden).toBe(true);
    });
});
