import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editManifest, makeFixture, removeFixture, runCheck, writeTo } from "../helpers/fixture.ts";

const CHECK = "check-traceability.mjs" as const;
const INVENTORY = "docs/audits/initiation/requirements.json";

type TraceLink = {
  resolved: string[];
};

type Requirement = {
  id: string;
  classification: string;
  liveImplementation: TraceLink[];
  liveProofs: TraceLink[];
};

type Inventory = {
  requirements: Requirement[];
  liveInventory: {
    editor: {
      controls: string[];
    };
  };
};

function readInventory(root: string): Inventory {
  return JSON.parse(readFileSync(join(root, INVENTORY), "utf8")) as Inventory;
}

function writeInventory(root: string, inventory: Inventory): void {
  writeFileSync(join(root, INVENTORY), `${JSON.stringify(inventory, null, 2)}\n`);
}

function mutateInventory(root: string, mutate: (inventory: Inventory) => void): void {
  const inventory = readInventory(root);
  mutate(inventory);
  writeInventory(root, inventory);
}

function requirement(inventory: Inventory, id: string): Requirement {
  const row = inventory.requirements.find((candidate) => candidate.id === id);
  if (row === undefined) throw new Error(`missing fixture requirement ${id}`);
  return row;
}
function firstLink(links: TraceLink[]): TraceLink {
  const link = links.at(0);
  if (link === undefined) throw new Error("expected a traceability link");
  return link;
}

describe("traceability check — injected violations", () => {
  let fixture: string;

  beforeEach(() => {
    fixture = makeFixture();
  });

  afterEach(() => {
    removeFixture(fixture);
  });

  it("control: the unmodified tree passes", () => {
    const result = runCheck(fixture, CHECK);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("traceability check OK");
    expect(result.status).toBe(0);
  });

  it("fails when a requirement disappears", () => {
    mutateInventory(fixture, (inventory) => {
      inventory.requirements.pop();
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[requirements-accounting]");
  });

  it("fails when a real implementation link loses its resolved path", () => {
    mutateInventory(fixture, (inventory) => {
      firstLink(requirement(inventory, "TOPO-001").liveImplementation).resolved = [];
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[implementation-link]");
  });

  it("fails when a real proof link loses its resolved path", () => {
    mutateInventory(fixture, (inventory) => {
      firstLink(requirement(inventory, "TOPO-001").liveProofs).resolved = [];
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[proof-link]");
  });

  it("fails when a requirement uses an unknown classification", () => {
    mutateInventory(fixture, (inventory) => {
      requirement(inventory, "TOPO-001").classification = "future";
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[classification]");
  });

  it("fails when a resolved proof path goes stale", () => {
    mutateInventory(fixture, (inventory) => {
      firstLink(requirement(inventory, "TOPO-001").liveProofs).resolved[0] = "tests/e2e/missing-proof.test.ts";
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[proof-path]");
  });

  it("fails when a held requirement is changed to real", () => {
    mutateInventory(fixture, (inventory) => {
      requirement(inventory, "IDENT-007").classification = "real";
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[classification-drift]");
  });

  it("fails when a public CLI verb is added without inventory coverage", () => {
    const path = join(fixture, "packages/cli/src/commands.ts");
    const source = readFileSync(path, "utf8");
    writeFileSync(path, `${source}\nconst injected = argVerb("injected", "injected", () => ({}), () => ({}));\n`);
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CLI verb inventory");
  });

  it("fails when an editor command is added without inventory coverage", () => {
    const path = join(fixture, "packages/schemas/src/editor-command-registry.ts");
    const source = readFileSync(path, "utf8");
    writeFileSync(path, source.replace("export const EDITOR_COMMAND_REGISTRY", 'id: "injected-command",\n  export const EDITOR_COMMAND_REGISTRY'));
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("editor command inventory");
  });

  it("fails when a desktop control is added without inventory coverage", () => {
    const path = join(fixture, "apps/desktop-shell/src/visual-model.ts");
    const source = readFileSync(path, "utf8");
    writeFileSync(path, `${source}\nconst injected = mint("injected-control", "Injected", "view");\n`);
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unaccounted IDs");
  });

  it("fails when a site route is added without inventory coverage", () => {
    writeTo(fixture, "sites/umbrella/src/app/injected-route/page.tsx", "export default function Page() { return null; }\n");
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("routes inventory");
  });

  it("fails when a public package export is added without inventory coverage", () => {
    writeTo(fixture, "packages/schemas/src/testing/injected.ts", "export const injected = true;\n");
    editManifest(fixture, "packages/schemas/package.json", (manifest) => {
      manifest.exports = { ...(manifest.exports as Record<string, string>), "./testing/injected": "./src/testing/injected.ts" };
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("public export map");
  });
});
