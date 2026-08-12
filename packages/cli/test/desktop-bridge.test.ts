import { describe, expect, it } from "vitest";
import {
  runCli,
  type DesktopLocalBridgeClient,
  type DesktopLocalBridgeClientCall,
} from "@sceneaxi/cli";
import { EDITOR_COMMAND_REGISTRY } from "@sceneaxi/schemas";

describe("CLI desktop local bridge tools", () => {
  it("publishes the shared agent tool schemas without a desktop connection", () => {
    const result = runCli(["desktop", "bridge", "tools", "--json"]);
    expect(result.exitCode).toBe(0);
    expect(result.envelope.ok).toBe(true);
    if (!result.envelope.ok) return;
    expect(result.envelope.result).toMatchObject({
      protocolVersion: 1,
      transport: "unix-ndjson",
      creditRoute: "none",
      commandSchemaVersion: 1,
    });
    const commands = result.envelope.result["commands"] as Array<Record<string, unknown>>;
    expect(commands).toEqual(EDITOR_COMMAND_REGISTRY);
    expect(commands.find((command) => command["id"] === "assistant-local-build"))
      .toMatchObject({
        permission: "assistant:run",
        mutation: "none",
        evidence: { kind: "sculpt-artifact", target: "live-viewport" },
      });
    const tools = result.envelope.result["tools"] as Array<Record<string, unknown>>;
    expect(tools.map((tool) => tool["name"])).toContain("sceneaxi.project.propose");
    expect(tools.map((tool) => tool["name"])).toContain("sceneaxi.assistant.byo.start");
    expect(
      JSON.stringify(tools.map((tool) => tool["inputSchema"])).toLowerCase(),
    ).not.toMatch(/api.?key|credential|secret/);
  });

  it("discovers and handshakes with the desktop through an injected transport adapter", () => {
    let observed: DesktopLocalBridgeClientCall | undefined;
    const client: DesktopLocalBridgeClient = (call) => {
      observed = call;
      return {
        ok: true,
        response: {
          protocolVersion: 1,
          id: call.id,
          ok: true,
          result: {
            app: "@sceneaxi/desktop-linux",
            localProtocolVersion: 1,
            transport: "unix-ndjson",
            creditRoute: "none",
          },
        },
      };
    };

    const result = runCli(
      [
        "desktop",
        "bridge",
        "status",
        "--descriptor",
        "/tmp/sceneaxi-test-descriptor.json",
        "--json",
      ],
      { desktopBridge: client },
    );
    expect(result.exitCode).toBe(0);
    expect(observed).toEqual({
      descriptorPath: "/tmp/sceneaxi-test-descriptor.json",
      id: "sceneaxi-cli-1",
      permission: "bridge:connect",
      tool: "sceneaxi.bridge.handshake",
      input: {},
    });
    expect(result.envelope).toMatchObject({
      ok: true,
      result: {
        connected: true,
        tool: "sceneaxi.bridge.handshake",
        response: { localProtocolVersion: 1, creditRoute: "none" },
      },
    });
  });

  it("requires the tool's exact permission before invoking a project operation", () => {
    const calls: DesktopLocalBridgeClientCall[] = [];
    const client: DesktopLocalBridgeClient = (call) => {
      calls.push(call);
      return {
        ok: true,
        response: {
          protocolVersion: 1,
          id: call.id,
          ok: true,
          result: { phase: "reviewing", documentPath: "scene.json" },
        },
      };
    };
    const base = [
      "desktop",
      "bridge",
      "call",
      "--tool",
      "sceneaxi.project.propose",
      "--input-json",
      JSON.stringify({
        documentPath: "scene.json",
        jsonPointer: "/data/entities/0/x",
        newValue: 7,
      }),
      "--json",
    ];

    const missingPermission = runCli(base, { desktopBridge: client });
    expect(missingPermission.exitCode).toBe(2);
    expect(missingPermission.envelope).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });
    expect(calls).toHaveLength(0);

    const allowed = runCli([...base, "--allow", "project:write"], {
      desktopBridge: client,
    });
    expect(allowed.exitCode).toBe(0);
    expect(calls).toEqual([
      {
        id: "sceneaxi-cli-1",
        permission: "project:write",
        tool: "sceneaxi.project.propose",
        input: {
          documentPath: "scene.json",
          jsonPointer: "/data/entities/0/x",
          newValue: 7,
        },
      },
    ]);
  });

  it("routes scene property staging through the shared reviewing result", () => {
    let observed: DesktopLocalBridgeClientCall | undefined;
    const client: DesktopLocalBridgeClient = (call) => {
      observed = call;
      return {
        ok: true,
        response: {
          protocolVersion: 1,
          id: call.id,
          ok: true,
          result: {
            phase: "reviewing",
            transaction: {
              commandId: "scene-property-set",
              status: "reviewing",
              progress: { phase: "reviewing", percent: 50, terminal: false },
              evidence: { kind: "scene-hierarchy", target: "change-review" },
              refusal: null,
              undo: { kind: "none", commandId: null },
            },
          },
        },
      };
    };
    const input = {
      documentPath: "scene.json",
      expectedContentHash: `sha256:${"0".repeat(64)}`,
      profile: "game",
      instanceId: "desktop-crate-beside",
      propertyId: "translation-x",
      newValue: -3.25,
    };
    const result = runCli([
      "desktop",
      "bridge",
      "call",
      "--tool",
      "sceneaxi.scene.property.set",
      "--allow",
      "project:write",
      "--input-json",
      JSON.stringify(input),
      "--json",
    ], { desktopBridge: client });

    expect(result.exitCode).toBe(0);
    expect(observed).toEqual({
      id: "sceneaxi-cli-1",
      permission: "project:write",
      tool: "sceneaxi.scene.property.set",
      input,
    });
    expect(result.envelope).toMatchObject({
      ok: true,
      result: {
        response: {
          phase: "reviewing",
          transaction: {
            commandId: "scene-property-set",
            status: "reviewing",
          },
        },
      },
    });
  });

  it("maps transport and host refusals into stable CLI envelope classes", () => {
    const unavailable = runCli(["desktop", "bridge", "status"], {
      desktopBridge: () => ({
        ok: false,
        code: "LOCAL_BRIDGE_DISCOVERY_UNAVAILABLE",
        message: "No active desktop descriptor.",
      }),
    });
    expect(unavailable.envelope).toMatchObject({
      ok: false,
      error: {
        code: "BRIDGE_UNAVAILABLE",
        details: { bridgeCode: "LOCAL_BRIDGE_DISCOVERY_UNAVAILABLE" },
      },
    });

    const incompatible = runCli(["desktop", "bridge", "status"], {
      desktopBridge: () => ({
        ok: false,
        code: "LOCAL_BRIDGE_RESPONSE_INVALID",
        message: "Protocol mismatch.",
      }),
    });
    expect(incompatible.envelope).toMatchObject({
      ok: false,
      error: { code: "BRIDGE_PROTOCOL" },
    });

    const refused = runCli(["desktop", "bridge", "status"], {
      desktopBridge: (call) => ({
        ok: true,
        response: {
          protocolVersion: 1,
          id: call.id,
          ok: false,
          error: {
            code: "LOCAL_BRIDGE_AUTHENTICATION_FAILED",
            message: "The desktop local bridge capability is invalid.",
            detail: null,
          },
        },
      }),
    });
    expect(refused.envelope).toMatchObject({
      ok: false,
      error: {
        code: "BRIDGE_REFUSED",
        details: {
          bridgeCode: "LOCAL_BRIDGE_AUTHENTICATION_FAILED",
          bridgeDetail: null,
        },
      },
    });
  });
});
