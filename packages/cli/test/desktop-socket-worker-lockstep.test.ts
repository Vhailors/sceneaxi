import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_LOCAL_BRIDGE_DISCOVERY_KIND,
  DESKTOP_LOCAL_BRIDGE_PERMISSIONS,
  DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
  DESKTOP_LOCAL_BRIDGE_TRANSPORT,
  parseDesktopLocalBridgeDiscovery,
} from "@sceneaxi/schemas";

const source = readFileSync(
  fileURLToPath(new URL("../src/desktop-socket-worker.ts", import.meta.url)),
  "utf8",
);

function scalarLiteral(name: string): unknown {
  const match = new RegExp(`^const ${name} = (.+);$`, "m").exec(source);
  expect(match, `${name} must stay a single-line worker constant`).not.toBeNull();
  return JSON.parse((match as RegExpExecArray)[1] as string) as unknown;
}

function stringArrayLiteral(pattern: RegExp, label: string): readonly string[] {
  const match = pattern.exec(source);
  expect(match, `${label} must stay a literal string list in the worker`).not.toBeNull();
  const body = ((match as RegExpExecArray)[1] as string).replace(/,\s*$/, "");
  return JSON.parse(`[${body}]`) as readonly string[];
}

const canonicalDiscovery = parseDesktopLocalBridgeDiscovery({
  protocolVersion: DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION,
  kind: DESKTOP_LOCAL_BRIDGE_DISCOVERY_KIND,
  transport: DESKTOP_LOCAL_BRIDGE_TRANSPORT,
  instanceId: "lockstep-instance",
  socketPath: "/tmp/sceneaxi/desktop-v1.sock",
  capability: "a".repeat(43),
  pid: 4242,
  projectRoot: "/tmp/sceneaxi/project",
  permissions: [...DESKTOP_LOCAL_BRIDGE_PERMISSIONS],
});

describe("desktop socket worker contract lockstep", () => {
  it("inlines the same protocol version, discovery kind, and transport as the schemas registry", () => {
    expect(scalarLiteral("PROTOCOL_VERSION")).toBe(DESKTOP_LOCAL_BRIDGE_PROTOCOL_VERSION);
    expect(scalarLiteral("DISCOVERY_KIND")).toBe(DESKTOP_LOCAL_BRIDGE_DISCOVERY_KIND);
    expect(scalarLiteral("TRANSPORT")).toBe(DESKTOP_LOCAL_BRIDGE_TRANSPORT);
  });

  it("inlines exactly the registered permission set", () => {
    expect(
      stringArrayLiteral(
        /const PERMISSIONS = new Set\(\[([\s\S]*?)\]\);/,
        "the worker permission set",
      ),
    ).toEqual([...DESKTOP_LOCAL_BRIDGE_PERMISSIONS]);
  });

  it("accepts exactly the discovery descriptor shape the schemas parser accepts", () => {
    expect(canonicalDiscovery).not.toBeNull();
    const expectedKeys = Object.keys(canonicalDiscovery as object);
    const countMatch = /Object\.keys\(value\)\.length !== (\d+)/.exec(source);
    expect(countMatch, "the worker must check the descriptor key count").not.toBeNull();
    expect(Number((countMatch as RegExpExecArray)[1])).toBe(expectedKeys.length);
    expect(
      stringArrayLiteral(
        /!\[([\s\S]*?)\]\.every\(\(key\) => Object\.hasOwn\(value, key\)\)/,
        "the worker descriptor key list",
      ),
    ).toEqual(expectedKeys);
  });
});
