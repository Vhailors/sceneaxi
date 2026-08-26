import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editManifest, makeFixture, removeFixture, runCheck, writeTo } from "../helpers/fixture.ts";

const CHECK = "check-traceability.mjs" as const;
const INVENTORY = "docs/audits/initiation/requirements.json";
const RENDERED = "docs/audits/initiation/Requirements-Traceability.md";
const RUNTIME_SURFACES = "docs/audits/initiation/runtime-surfaces.json";

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
    providerEntrypoints: string[];
    routes: string[];
    counts: {
      routes: number;
    };
  };
};

type RuntimeSurfaces = {
  cliVerbs: string[];
  editorCommands: string[];
  desktopControls: string[];
  bridgeActions: string[];
  localAgentTools: string[];
  providerEntrypoints: string[];
  refusalRegistries: Array<{ path: string; symbol: string }>;
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

function mutateRuntimeSurfaces(
  root: string,
  mutate: (surfaces: RuntimeSurfaces) => void,
): void {
  const path = join(root, RUNTIME_SURFACES);
  const surfaces = JSON.parse(readFileSync(path, "utf8")) as RuntimeSurfaces;
  mutate(surfaces);
  writeFileSync(path, `${JSON.stringify(surfaces, null, 2)}\n`);
}

function replaceRenderedClassification(
  root: string,
  id: string,
  from: string,
  to: string,
): void {
  const path = join(root, RENDERED);
  const rendered = readFileSync(path, "utf8");
  const original = `| ${id} | \`${from}\` |`;
  const replacement = `| ${id} | \`${to}\` |`;
  if (!rendered.includes(original)) throw new Error(`missing rendered row ${id}`);
  writeFileSync(path, rendered.replace(original, replacement));
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
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("traceability check OK");
  });

  it("fails when a requirement disappears from both generated audit artifacts", () => {
    let removedId = "";
    mutateInventory(fixture, (inventory) => {
      const removed = inventory.requirements.pop();
      if (removed === undefined) throw new Error("expected a requirement row");
      removedId = removed.id;
    });
    const renderedPath = join(fixture, RENDERED);
    const rendered = readFileSync(renderedPath, "utf8");
    writeFileSync(
      renderedPath,
      rendered.split("\n").filter((line) => !line.startsWith(`| ${removedId} |`)).join("\n"),
    );
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[requirements-authority]");
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

  it("fails when a held requirement is promoted in both generated audit artifacts", () => {
    mutateInventory(fixture, (inventory) => {
      requirement(inventory, "IDENT-007").classification = "real";
    });
    replaceRenderedClassification(fixture, "IDENT-007", "held", "real");
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[authority-classification]");
  });

  it("fails when the executable CLI surface exposes an unaccounted verb", () => {
    mutateRuntimeSurfaces(fixture, (surfaces) => {
      surfaces.cliVerbs.push("protocol injected");
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CLI verb inventory");
  });

  it("fails when a valid public CLI verb is exposed only by live registries", () => {
    const commandsPath = join(fixture, "packages/cli/src/commands.ts");
    const commands = readFileSync(commandsPath, "utf8");
    const commandMarker = "    protocol: protocolGroup,\n";
    if (!commands.includes(commandMarker)) throw new Error("missing CLI command marker");
    writeFileSync(
      commandsPath,
      commands.replace(
        commandMarker,
        `${commandMarker}    injected: group("injected", "Injected runtime group", {\n      live: verb("live", "Injected runtime verb", () => Object.freeze({ status: "injected" })),\n    }),\n`,
      ),
    );

    const shippedPath = join(fixture, "packages/cli/src/held-keys/shipped.ts");
    const shipped = readFileSync(shippedPath, "utf8");
    const shippedMarker = '    { command: "protocol inspect", heldKeys: [] },\n';
    if (!shipped.includes(shippedMarker)) throw new Error("missing shipped command marker");
    writeFileSync(
      shippedPath,
      shipped.replace(
        shippedMarker,
        `${shippedMarker}    { command: "injected live", heldKeys: [] },\n`,
      ),
    );

    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[runtime-surface]");
  });

  it("fails when the executable editor registry exposes an unaccounted command", () => {
    mutateRuntimeSurfaces(fixture, (surfaces) => {
      surfaces.editorCommands.push("injected-command");
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("editor command inventory");
  });

  it("fails when the executable desktop projection exposes an unaccounted control", () => {
    mutateRuntimeSurfaces(fixture, (surfaces) => {
      surfaces.desktopControls.push("injected-control");
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("desktop control inventory");
  });

  it("fails when the executable desktop bridge exposes an unaccounted action", () => {
    mutateRuntimeSurfaces(fixture, (surfaces) => {
      surfaces.bridgeActions.push("injected-action");
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("desktop bridge operation inventory");
  });

  it("fails when the executable local bridge exposes an unaccounted tool", () => {
    mutateRuntimeSurfaces(fixture, (surfaces) => {
      surfaces.localAgentTools.push("sceneaxi.injected.tool");
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("local-agent tool inventory");
  });

  it("fails when an executable refusal registry is missing from inventory", () => {
    mutateRuntimeSurfaces(fixture, (surfaces) => {
      surfaces.refusalRegistries.push({
        path: "packages/auth/src/refusals.ts",
        symbol: "INJECTED_REFUSALS",
      });
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("refusal registry inventory");
  });

  it("fails when an executable provider entrypoint is missing from inventory", () => {
    mutateInventory(fixture, (inventory) => {
      inventory.liveInventory.providerEntrypoints =
        inventory.liveInventory.providerEntrypoints.filter(
          (entry) => entry !== "desktop/linux/src/electron/provider-key-store.ts",
        );
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[provider-entrypoint]");
  });

  it("fails when a site route is added without inventory coverage", () => {
    writeTo(fixture, "sites/umbrella/src/app/injected-route/page.tsx", "export default function Page() { return null; }\n");
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("routes inventory");
  });

  it("fails when a route and its declared count are duplicated together", () => {
    mutateInventory(fixture, (inventory) => {
      const route = inventory.liveInventory.routes.at(0);
      if (route === undefined) throw new Error("expected an inventoried route");
      inventory.liveInventory.routes.push(route);
      inventory.liveInventory.counts.routes += 1;
    });
    const result = runCheck(fixture, CHECK);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[surface-duplicate] routes");
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
