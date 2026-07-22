import { describe, expect, it } from "vitest";
import {
  ROOT_COMMANDS,
  SHIPPED_COMMAND_MAP,
  SYNTHETIC_DEMO_KEYS,
  validateCommandMap,
  type CliCommandMap,
  type CommandNode,
} from "@sceneaxi/cli";

/** Walk the live command tree and collect every full verb path. */
function collectVerbPaths(): string[] {
  const paths: string[] = [];
  const walk = (
    children: Readonly<Record<string, CommandNode>>,
    prefix: string[],
  ): void => {
    for (const [name, node] of Object.entries(children)) {
      if (node.kind === "verb") {
        paths.push([...prefix, name].join(" "));
      } else {
        walk(node.children, [...prefix, name]);
      }
    }
  };
  walk(ROOT_COMMANDS, []);
  return paths.sort();
}

describe("shipped CLI command map", () => {
  it("is schema-valid", () => {
    const validation = validateCommandMap(SHIPPED_COMMAND_MAP);
    expect(validation.ok).toBe(true);
    if (!validation.ok) {
      expect.fail(validation.errors.join("\n"));
    }
  });

  it("declares every verb in the live command tree (undeclared verb = refuse)", () => {
    const declared = SHIPPED_COMMAND_MAP.commands.map((c) => c.command).sort();
    expect(declared).toEqual(collectVerbPaths());
  });

  it("gates the demo verb with synthetic keys only", () => {
    const demo = SHIPPED_COMMAND_MAP.commands.find(
      (c) => c.command === "demo gated",
    );
    expect(demo).toBeDefined();
    expect(demo?.heldKeys).toEqual(SYNTHETIC_DEMO_KEYS);
    expect(SYNTHETIC_DEMO_KEYS.length).toBeGreaterThan(0);
    for (const key of SYNTHETIC_DEMO_KEYS) {
      // Fixtures use synthetic keys; no real captain hold may be named here.
      expect(key).toMatch(/^synthetic-/);
    }
  });

  it("declares every non-demo verb explicitly ungated (heldKeys: []) — skeletons encode no product policy", () => {
    for (const entry of SHIPPED_COMMAND_MAP.commands) {
      if (entry.command === "demo gated") continue;
      expect(entry.heldKeys, entry.command).toEqual([]);
    }
  });
});

describe("command map validator (fail-closed)", () => {
  const base: CliCommandMap = {
    schemaVersion: 1,
    builtForRegistryEpoch: 2,
    cliVersion: "0.0.0",
    commands: [
      { command: "demo gated", heldKeys: ["synthetic-demo-alpha"] },
      { command: "protocol version", heldKeys: [] },
    ],
  };

  it("accepts a well-formed map", () => {
    expect(validateCommandMap(base).ok).toBe(true);
  });

  it("refuses non-object inputs and missing required fields", () => {
    expect(validateCommandMap(undefined).ok).toBe(false);
    expect(validateCommandMap("map").ok).toBe(false);
    const withoutEpoch: Record<string, unknown> = { ...base };
    delete withoutEpoch["builtForRegistryEpoch"];
    expect(validateCommandMap(withoutEpoch).ok).toBe(false);
  });

  it("refuses duplicate command declarations", () => {
    const dup = {
      ...base,
      commands: [...base.commands, { command: "demo gated", heldKeys: [] }],
    };
    expect(validateCommandMap(dup).ok).toBe(false);
  });

  it("refuses malformed held-key names", () => {
    const bad = {
      ...base,
      commands: [{ command: "demo gated", heldKeys: ["Not-A-Valid-Key!"] }],
    };
    expect(validateCommandMap(bad).ok).toBe(false);
  });

  it("refuses composedOf references to undeclared verbs", () => {
    const bad = {
      ...base,
      commands: [
        {
          command: "demo all",
          heldKeys: ["synthetic-demo-alpha"],
          composedOf: ["no such verb"],
        },
      ],
    };
    expect(validateCommandMap(bad).ok).toBe(false);
  });

  it("refuses a composed verb whose heldKeys are not a superset of its parts (dependency closure)", () => {
    const bad = {
      ...base,
      commands: [
        ...base.commands,
        // Composes "demo gated" (gated by synthetic-demo-alpha) but declares no keys.
        { command: "demo all", heldKeys: [], composedOf: ["demo gated"] },
      ],
    };
    const validation = validateCommandMap(bad);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errors.join("\n")).toMatch(/superset|composed/i);
    }

    const good = {
      ...base,
      commands: [
        ...base.commands,
        {
          command: "demo all",
          heldKeys: ["synthetic-demo-alpha"],
          composedOf: ["demo gated"],
        },
      ],
    };
    expect(validateCommandMap(good).ok).toBe(true);
  });

  it("refuses unknown extra properties (additionalProperties: false)", () => {
    expect(validateCommandMap({ ...base, vendorExtension: true }).ok).toBe(
      false,
    );
  });
});
