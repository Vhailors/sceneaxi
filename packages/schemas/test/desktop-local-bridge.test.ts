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
      "sceneaxi.project.propose",
      "sceneaxi.project.accept",
      "sceneaxi.project.reject",
      "sceneaxi.project.recover",
      "sceneaxi.project.restart",
      "sceneaxi.project.undo",
      "sceneaxi.assistant.local.start",
      "sceneaxi.assistant.byo.start",
      "sceneaxi.assistant.status",
      "sceneaxi.assistant.abandon",
    ]);
    expect(schema.$defs.toolName.enum).toEqual(
      DESKTOP_LOCAL_BRIDGE_TOOLS.map((tool) => tool.name),
    );
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
  });
});
