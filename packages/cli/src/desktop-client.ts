/** Synchronous CLI adapter over the async Unix socket worker process. */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type {
  DesktopLocalBridgePermission,
  DesktopLocalBridgeResponse,
  DesktopLocalBridgeToolName,
  JsonObject,
} from "@sceneaxi/schemas";

export type DesktopLocalBridgeClientCall = Readonly<{
  descriptorPath?: string;
  id: string;
  permission: DesktopLocalBridgePermission;
  tool: DesktopLocalBridgeToolName;
  input: JsonObject;
}>;

export type DesktopLocalBridgeClientFailure = Readonly<{
  ok: false;
  code:
    | "LOCAL_BRIDGE_DISCOVERY_UNAVAILABLE"
    | "LOCAL_BRIDGE_DISCOVERY_INSECURE"
    | "LOCAL_BRIDGE_TRANSPORT_UNAVAILABLE"
    | "LOCAL_BRIDGE_RESPONSE_INVALID";
  message: string;
}>;

export type DesktopLocalBridgeClientResult =
  | Readonly<{ ok: true; response: DesktopLocalBridgeResponse }>
  | DesktopLocalBridgeClientFailure;

export type DesktopLocalBridgeClient = (
  call: DesktopLocalBridgeClientCall,
) => DesktopLocalBridgeClientResult;

function isClientResult(value: unknown): value is DesktopLocalBridgeClientResult {
  if (typeof value !== "object" || value === null || !("ok" in value)) return false;
  if ((value as { ok: unknown }).ok === true) {
    const response = (value as { response?: unknown }).response;
    return typeof response === "object" && response !== null &&
      "protocolVersion" in response && "id" in response && "ok" in response;
  }
  return (value as { ok: unknown }).ok === false &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string";
}

export const callDesktopLocalBridge: DesktopLocalBridgeClient = (call) => {
  const worker = fileURLToPath(new URL("./desktop-socket-worker.js", import.meta.url));
  const child = spawnSync(process.execPath, [worker], {
    input: JSON.stringify(call),
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    timeout: 10_000,
  });
  if (child.status !== 0 || child.error !== undefined) {
    return Object.freeze({
      ok: false as const,
      code: "LOCAL_BRIDGE_TRANSPORT_UNAVAILABLE" as const,
      message: "The SceneAxi desktop local bridge worker could not run.",
    });
  }
  try {
    const parsed = JSON.parse(child.stdout) as unknown;
    if (isClientResult(parsed)) return parsed;
  } catch {
    // Mapped to one stable error below; worker stdout is never echoed.
  }
  return Object.freeze({
    ok: false as const,
    code: "LOCAL_BRIDGE_RESPONSE_INVALID" as const,
    message: "The SceneAxi desktop local bridge worker returned an invalid response.",
  });
};
