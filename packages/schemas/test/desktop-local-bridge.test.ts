import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
  DESKTOP_LOCAL_BRIDGE_TOOLS,
  contracts,
  validateDesktopLocalBridgeToolInput,
} from "@sceneaxi/schemas";

describe("desktop local bridge contract", () => {
  it("ships one versioned agent-tool registry beside its JSON Schema", () => {
    const schema = JSON.parse(
      readFileSync(
        new URL(`../${contracts.desktopLocalBridge}`, import.meta.url),
        "utf8",
      ),
    ) as {
      $id: string;
      $defs: Record<string, unknown> & {
        editorCommandId: { enum: string[] };
        permission: { enum: string[] };
        tool: {
          additionalProperties: false;
          required: string[];
          properties: {
            name: { $ref: string };
            commandId: { oneOf: [{ $ref: string }, { type: "null" }] };
            description: { type: "string"; minLength: number };
            permission: { $ref: string };
            mutatesProject: { type: "boolean" };
            providerRoute: { enum: string[] };
            creditRoute: { const: string };
            inputSchema: { type: "object" };
          };
        };
        toolName: { enum: string[] };
      };
    };

    expect(DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION).toBe(1);
    expect(schema.$id).toBe(
      "https://sceneaxi.invalid/contracts/desktop-local-bridge/v1",
    );
    expect(Object.keys(schema.$defs)).toEqual(
      expect.arrayContaining(["discovery", "request", "response", "tool"]),
    );
    expect(DESKTOP_LOCAL_BRIDGE_TOOLS.map((tool) => tool.name)).toEqual([
      "sceneaxi.bridge.handshake",
      "sceneaxi.project.status",
      "sceneaxi.project.inspect",
      "sceneaxi.project.migration.propose",
      "sceneaxi.project.migration.commit",
      "sceneaxi.project.migration.recover",
      "sceneaxi.project.git.status",
      "sceneaxi.project.git.diff",
      "sceneaxi.project.git.stage",
      "sceneaxi.project.git.commit.prepare",
      "sceneaxi.scene.hierarchy.inspect",
      "sceneaxi.scene.selection.set",
      "sceneaxi.scene.property.set",
      "sceneaxi.scene.transform.apply",
      "sceneaxi.scene.object.create",
      "sceneaxi.scene.object.remove",
      "sceneaxi.scene.object.reparent",
      "sceneaxi.scene.prefab.inspect",
      "sceneaxi.scene.prefab.define",
      "sceneaxi.scene.prefab.instance",
      "sceneaxi.scene.prefab.override",
      "sceneaxi.scene.prefab.refresh",
      "sceneaxi.input-actions.inspect",
      "sceneaxi.input-actions.rebind",
      "sceneaxi.input-actions.reset",
      "sceneaxi.project.propose",
      "sceneaxi.project.accept",
      "sceneaxi.project.reject",
      "sceneaxi.project.recover",
      "sceneaxi.project.restart",
      "sceneaxi.project.undo",
      "sceneaxi.project.redo",
      "sceneaxi.run.play",
      "sceneaxi.run.stop",
      "sceneaxi.run.reset",
      "sceneaxi.play.inspect",
      "sceneaxi.viewport.source.set",
      "sceneaxi.animation.inspect",
      "sceneaxi.animation.apply",
      "sceneaxi.animation.scrub",
      "sceneaxi.animation.evaluate",
      "sceneaxi.physics.inspect",
      "sceneaxi.physics.apply",
      "sceneaxi.physics.evaluate",
      "sceneaxi.package.inspect",
      "sceneaxi.package.install",
      "sceneaxi.package.remove",
      "sceneaxi.profile.inspect",
      "sceneaxi.assistant.ask",
      "sceneaxi.assistant.apply-build",
      "sceneaxi.assistant.local.start",
      "sceneaxi.assistant.byo.start",
      "sceneaxi.assistant.local.agent",
      "sceneaxi.assistant.status",
      "sceneaxi.assistant.abandon",
    ]);
    expect(schema.$defs.toolName.enum).toEqual(
      DESKTOP_LOCAL_BRIDGE_TOOLS.map((tool) => tool.name),
    );

    const toolContract = schema.$defs.tool;
    const requiredKeys = [...toolContract.required].sort();
    for (const tool of DESKTOP_LOCAL_BRIDGE_TOOLS) {
      expect(Object.keys(tool).sort()).toEqual(requiredKeys);
      expect(schema.$defs.toolName.enum).toContain(tool.name);
      if (tool.commandId !== null) {
        expect(schema.$defs.editorCommandId.enum).toContain(tool.commandId);
      }
      expect(typeof tool.description).toBe(toolContract.properties.description.type);
      expect(tool.description.length).toBeGreaterThanOrEqual(
        toolContract.properties.description.minLength,
      );
      expect(schema.$defs.permission.enum).toContain(tool.permission);
      expect(typeof tool.mutatesProject).toBe(
        toolContract.properties.mutatesProject.type,
      );
      expect(toolContract.properties.providerRoute.enum).toContain(tool.providerRoute);
      expect(tool.creditRoute).toBe(toolContract.properties.creditRoute.const);
      expect(typeof tool.inputSchema).toBe(toolContract.properties.inputSchema.type);
    }
  });

  it("never declares a project-mutating tool behind a read permission", () => {
    expect(
      DESKTOP_LOCAL_BRIDGE_TOOLS.map((tool) => ({
        name: tool.name,
        permission: tool.permission,
        mutatesProject: tool.mutatesProject,
      })),
    ).toEqual([
      { name: "sceneaxi.bridge.handshake", permission: "bridge:connect", mutatesProject: false },
      { name: "sceneaxi.project.status", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.project.inspect", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.project.migration.propose", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.project.migration.commit", permission: "project:write", mutatesProject: true },
      { name: "sceneaxi.project.migration.recover", permission: "project:write", mutatesProject: true },
      { name: "sceneaxi.project.git.status", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.project.git.diff", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.project.git.stage", permission: "project:write", mutatesProject: true },
      { name: "sceneaxi.project.git.commit.prepare", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.scene.hierarchy.inspect", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.scene.selection.set", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.scene.property.set", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.scene.transform.apply", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.scene.object.create", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.scene.object.remove", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.scene.object.reparent", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.scene.prefab.inspect", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.scene.prefab.define", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.scene.prefab.instance", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.scene.prefab.override", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.scene.prefab.refresh", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.input-actions.inspect", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.input-actions.rebind", permission: "project:write", mutatesProject: true },
      { name: "sceneaxi.input-actions.reset", permission: "project:write", mutatesProject: true },
      { name: "sceneaxi.project.propose", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.project.accept", permission: "project:write", mutatesProject: true },
      { name: "sceneaxi.project.reject", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.project.recover", permission: "project:write", mutatesProject: true },
      { name: "sceneaxi.project.restart", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.project.undo", permission: "project:write", mutatesProject: true },
      { name: "sceneaxi.project.redo", permission: "project:write", mutatesProject: true },
      { name: "sceneaxi.run.play", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.run.stop", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.run.reset", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.play.inspect", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.viewport.source.set", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.animation.inspect", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.animation.apply", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.animation.scrub", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.animation.evaluate", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.physics.inspect", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.physics.apply", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.physics.evaluate", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.package.inspect", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.package.install", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.package.remove", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.profile.inspect", permission: "project:read", mutatesProject: false },
      { name: "sceneaxi.assistant.ask", permission: "assistant:read", mutatesProject: false },
      { name: "sceneaxi.assistant.apply-build", permission: "assistant:run", mutatesProject: false },
      { name: "sceneaxi.assistant.local.start", permission: "assistant:run", mutatesProject: false },
      { name: "sceneaxi.assistant.byo.start", permission: "assistant:run", mutatesProject: false },
      { name: "sceneaxi.assistant.local.agent", permission: "assistant:run", mutatesProject: false },
      { name: "sceneaxi.assistant.status", permission: "assistant:read", mutatesProject: false },
      { name: "sceneaxi.assistant.abandon", permission: "assistant:run", mutatesProject: false },
    ]);

    for (const tool of DESKTOP_LOCAL_BRIDGE_TOOLS) {
      if (tool.mutatesProject) expect(tool.permission).toBe("project:write");
      if (tool.permission === "project:read") expect(tool.mutatesProject).toBe(false);
    }
  });

  it("keeps credentials and hosted credits outside every agent tool input", () => {
    for (const tool of DESKTOP_LOCAL_BRIDGE_TOOLS) {
      const encoded = JSON.stringify(tool.inputSchema).toLowerCase();
      expect(encoded).not.toMatch(/credential|api.?key|secret|token|hosted|credit/);
      expect(tool.creditRoute).toBe("none");
    }

    expect(
      validateDesktopLocalBridgeToolInput("sceneaxi.scene.hierarchy.inspect", {
        documentPath: "scene.json",
        profile: "game",
      }),
    ).toBe(true);
    expect(
      validateDesktopLocalBridgeToolInput("sceneaxi.scene.hierarchy.inspect", {
        documentPath: "scene.json",
      }),
    ).toBe(false);
    expect(
      validateDesktopLocalBridgeToolInput("sceneaxi.scene.selection.set", {
        documentPath: "scene.json",
        profile: "kids",
        instanceIds: ["root"],
      }),
    ).toBe(true);
    expect(
      validateDesktopLocalBridgeToolInput("sceneaxi.scene.property.set", {
        documentPath: "scene.json",
        expectedContentHash: `sha256:${"0".repeat(64)}`,
        profile: "game",
        instanceId: "root",
        propertyId: "translation-x",
        newValue: 2,
      }),
    ).toBe(true);

    expect(
      validateDesktopLocalBridgeToolInput("sceneaxi.assistant.byo.start", {
        prompt: "Build a blue crate",
        profile: "@sceneaxi/profile-game",
      }),
    ).toBe(true);
    expect(
      validateDesktopLocalBridgeToolInput("sceneaxi.assistant.byo.start", {
        prompt: "Build a blue crate",
        profile: "@sceneaxi/profile-game",
        apiKey: "must-not-cross-the-bridge",
      }),
    ).toBe(false);
    expect(
      validateDesktopLocalBridgeToolInput("sceneaxi.assistant.abandon", {
        jobId: "desktop-assistant-1",
      }),
    ).toBe(true);
    expect(
      validateDesktopLocalBridgeToolInput("sceneaxi.assistant.abandon", {}),
    ).toBe(false);
  });
});
