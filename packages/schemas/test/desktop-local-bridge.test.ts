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
      "sceneaxi.project.propose",
      "sceneaxi.project.accept",
      "sceneaxi.project.reject",
      "sceneaxi.project.recover",
      "sceneaxi.project.restart",
      "sceneaxi.project.undo",
      "sceneaxi.project.redo",
      "sceneaxi.run.play",
      "sceneaxi.assistant.local.start",
      "sceneaxi.assistant.byo.start",
      "sceneaxi.assistant.local.agent",
      "sceneaxi.assistant.status",
      "sceneaxi.assistant.abandon",
    ]);
    expect(schema.$defs.toolName.enum).toEqual(
      DESKTOP_LOCAL_BRIDGE_TOOLS.map((tool) => tool.name),
    );
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
      { name: "sceneaxi.project.propose", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.project.accept", permission: "project:write", mutatesProject: true },
      { name: "sceneaxi.project.reject", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.project.recover", permission: "project:write", mutatesProject: true },
      { name: "sceneaxi.project.restart", permission: "project:write", mutatesProject: false },
      { name: "sceneaxi.project.undo", permission: "project:write", mutatesProject: true },
      { name: "sceneaxi.project.redo", permission: "project:write", mutatesProject: true },
      { name: "sceneaxi.run.play", permission: "project:read", mutatesProject: false },
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
