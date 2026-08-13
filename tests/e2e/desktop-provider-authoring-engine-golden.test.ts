import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ModelDescriptor } from "@sceneaxi/authoring-core";
import {
  createFixtureTransport,
  type OpenRouterTransportRequest,
} from "@sceneaxi/provider-openrouter";
import {
  createEditorCommandInvocation,
  type EditorCommandClient,
  type JsonObject,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_BRIDGE_REFUSALS,
  createDesktopBridge,
  createProviderKeyStore,
  seedDesktopProject,
  type DesktopAssistantJobSnapshot,
  type DesktopBridge,
  type DesktopBridgeOk,
  type PlatformSecureStorage,
} from "../../desktop/linux/src/index.ts";
import {
  createDesktopOpenRouterProviderSession,
  createPrivilegedDesktopByoRuntime,
} from "../../desktop/linux/src/electron/provider-runtime.ts";

const MODEL: ModelDescriptor = Object.freeze({
  model: "openai/desktop-fixture-2026-08-08",
  provider: "openrouter",
  quantization: "provider-default-pinned",
  version: "2026-08-08",
});

const EVAL = Object.freeze({
  mode: "deterministic" as const,
  allowFallbacks: false as const,
  temperature: 0 as const,
  seed: 236,
});

const SYNTHETIC_CREDENTIAL = "synthetic-desktop-chain-credential";
const PROVIDER_PRIVATE_MARKER = "provider-private-chain-marker";
const OPERATOR_PROMPT = "Build a blue crate credential-sentinel-never-persisted";

const SCULPT_INTAKE = JSON.stringify({
  schemaVersion: 1,
  kind: "sceneaxi.sculpt-intake",
  intakeId: "desktop-chain-crate",
  mode: "structured-spec",
  structuredSpec: {
    schemaVersion: 1,
    kind: "sceneaxi.object-sculpt-spec",
    id: "desktop-chain-crate-spec",
    rootNodeId: "crate-root",
    components: [
      {
        id: "crate-body",
        primitive: "box",
        dimensions: [2, 2, 2],
        materialId: "crate-shell",
      },
    ],
    materials: [
      {
        id: "crate-shell",
        baseColor: "#3366cc",
        metallic: 0.1,
        roughness: 0.7,
      },
    ],
    sockets: [],
    hierarchy: [
      {
        id: "crate-root",
        parentId: null,
        componentId: "crate-body",
        transform: {
          translation: [0, 0, 0],
          rotationEulerDegrees: [0, 0, 0],
          scale: [1, 1, 1],
        },
      },
    ],
  },
});

const COMMAND_CAPABILITIES = Object.freeze([
  "scene.compose",
  "authoring.change-review",
  "authoring.undo",
  "authoring.redo",
  "assistant.progress",
  "assistant.build.local",
  "assistant.build.byo",
]);

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporaryRoot(label: string) {
  const root = mkdtempSync(join(tmpdir(), `sceneaxi-${label}-`));
  roots.push(root);
  return root;
}

function platformStorage(): PlatformSecureStorage {
  return Object.freeze({
    availability: () => ({ ok: true as const }),
    encrypt: (plaintext: string) => Buffer.from(plaintext, "utf8"),
    decrypt: (ciphertext: Uint8Array) => Buffer.from(ciphertext).toString("utf8"),
  });
}

function documentBytes(root: string) {
  return readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
}

function hash(bridge: DesktopBridge) {
  const response = bridge.handle({
    action: "authoring",
    payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
  });
  if (!response.ok || typeof (response.data as { contentHash?: unknown }).contentHash !== "string") {
    throw new Error("authoring status did not return a content hash");
  }
  return (response.data as { contentHash: string }).contentHash;
}

function command(
  bridge: DesktopBridge,
  commandId: Parameters<typeof createEditorCommandInvocation>[0],
  client: EditorCommandClient,
  input: JsonObject,
) {
  return bridge.handle({
    action: "command",
    payload: createEditorCommandInvocation(commandId, client, input, "game"),
  });
}

async function settledAssistant(bridge: DesktopBridge) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const response = bridge.handle({ action: "assistant", payload: { op: "status" } });
    if (!response.ok) throw new Error(response.reason);
    const snapshot = (response as DesktopBridgeOk<DesktopAssistantJobSnapshot | null>).data;
    if (snapshot !== null && snapshot.status !== "running") return snapshot;
  }
  throw new Error("desktop assistant did not settle");
}

async function readyByoBridge(options?: Readonly<{
  onRequest?: (request: OpenRouterTransportRequest) => void;
  runByoAssistant?: ReturnType<typeof createPrivilegedDesktopByoRuntime>["runByoAssistant"];
}>) {
  const projectRoot = temporaryRoot("chain-project");
  expect(seedDesktopProject(projectRoot).ok).toBe(true);
  if (options?.runByoAssistant !== undefined) {
    return {
      projectRoot,
      bridge: createDesktopBridge({
        cwd: projectRoot,
        commandCapabilities: COMMAND_CAPABILITIES,
        runByoAssistant: options.runByoAssistant,
      }),
    };
  }

  const store = createProviderKeyStore({
    root: temporaryRoot("chain-store"),
    platformStorage: platformStorage(),
  });
  await expect(store.save("openrouter", SYNTHETIC_CREDENTIAL)).resolves.toMatchObject({ ok: true });
  const fixture = createFixtureTransport({
    model: MODEL,
    responses: {
      complete: {
        id: PROVIDER_PRIVATE_MARKER,
        model: MODEL.model,
        choices: [
          {
            finish_reason: "stop",
            message: { content: SCULPT_INTAKE },
          },
        ],
      },
    },
  });
  const runtime = createPrivilegedDesktopByoRuntime({
    keyStore: store,
    createProviderSession: createDesktopOpenRouterProviderSession({
      model: MODEL,
      eval: EVAL,
      profilePolicies: {
        "@sceneaxi/profile-game": () => ({ ok: true }),
      },
      openTransport: ({ credential }) => ({
        transport(request) {
          expect(credential.read()).toBe(SYNTHETIC_CREDENTIAL);
          options?.onRequest?.(request);
          return fixture(request);
        },
      }),
    }),
  });
  if (runtime.runByoAssistant === undefined) throw new Error("privileged runtime unavailable");
  return {
    projectRoot,
    bridge: createDesktopBridge({
      cwd: projectRoot,
      commandCapabilities: COMMAND_CAPABILITIES,
      runByoAssistant: runtime.runByoAssistant,
    }),
  };
}

function startByo(bridge: DesktopBridge, prompt = OPERATOR_PROMPT) {
  return bridge.handle({
    action: "assistant",
    payload: {
      op: "start",
      route: "byo",
      mode: "build",
      profile: "@sceneaxi/profile-game",
      prompt,
    },
  });
}

describe("desktop provider → authoring → engine chain", () => {
  it("drives BYOK through the privileged port, Change Review, persist/reopen, and play", async () => {
    const requests: OpenRouterTransportRequest[] = [];
    const { bridge, projectRoot } = await readyByoBridge({
      onRequest: (request) => requests.push(request),
    });
    const before = documentBytes(projectRoot);

    expect(startByo(bridge)).toMatchObject({ ok: true, data: { route: "byo", status: "running" } });
    const ready = await settledAssistant(bridge);
    expect(ready).toMatchObject({
      route: "byo",
      status: "ready",
      result: {
        route: "byo",
        providerClass: "configured",
        fallbackPolicy: "none",
        mountable: {
          artifacts: {
            "desktop-chain-crate-artifact": { kind: "sceneaxi.sculpt-artifact" },
          },
        },
        providerEvidence: {
          operation: "complete",
          profile: "@sceneaxi/profile-game",
          model: MODEL,
        },
      },
    });
    expect(documentBytes(projectRoot)).toBe(before);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      operation: "complete",
      modelDescriptor: MODEL,
      provider: { allow_fallbacks: false },
    });
    expect(requests[0]?.messages[0]?.content).toContain("Build a blue crate");

    const desktopApply = command(bridge, "assistant-apply-build", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(bridge),
    });
    expect(desktopApply).toMatchObject({
      ok: true,
      data: {
        catalog: {
          kind: "sceneaxi.scene-assistant-build-catalog",
          entries: [{
            providerClass: "configured",
            model: MODEL.model,
            provider: MODEL.provider,
            version: MODEL.version,
            fallbackPolicy: "none",
          }],
        },
        authoringSnapshot: { phase: "reviewing" },
      },
    });
    expect(command(bridge, "change-review-reject", "desktop-control", {})).toMatchObject({
      ok: true,
      data: { phase: "rejected" },
    });
    expect(documentBytes(projectRoot)).toBe(before);

    const cliApply = command(bridge, "assistant-apply-build", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(bridge),
    });
    expect(cliApply).toEqual(desktopApply);
    expect(command(bridge, "change-review-reject", "cli", {})).toMatchObject({
      ok: true,
      data: { phase: "rejected" },
    });
    const agentApply = command(bridge, "assistant-apply-build", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(bridge),
    });
    expect(agentApply).toEqual(desktopApply);
    expect(command(bridge, "change-review-accept", "local-agent", {})).toMatchObject({
      ok: true,
      data: { phase: "applied" },
    });

    const accepted = documentBytes(projectRoot);
    expect(accepted).not.toBe(before);
    expect(accepted).toContain("sceneAssistantBuilds");
    expect(accepted).toContain(MODEL.model);
    expect(accepted).not.toContain(SYNTHETIC_CREDENTIAL);
    expect(accepted).not.toContain(PROVIDER_PRIVATE_MARKER);
    expect(accepted).not.toContain("credential-sentinel-never-persisted");
    expect(JSON.stringify(ready)).not.toContain(SYNTHETIC_CREDENTIAL);
    expect(JSON.stringify(ready)).not.toContain(PROVIDER_PRIVATE_MARKER);

    const reopened = createDesktopBridge({
      cwd: projectRoot,
      commandCapabilities: COMMAND_CAPABILITIES,
    });
    const played = reopened.handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(played).toMatchObject({
      ok: true,
      data: { closed: true, instanceCount: expect.any(Number) },
    });
    if (!played.ok) throw new Error(played.reason);
    expect((played.data as { instanceCount: number }).instanceCount).toBeGreaterThan(0);
    const scene = reopened.handle({
      action: "scene",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(scene.ok).toBe(true);
    expect(JSON.stringify({ ready, played, scene })).not.toContain(SYNTHETIC_CREDENTIAL);
  });

  it("refuses Kids, Hosted, missing BYOK, and unsupported Agent before dispatch", async () => {
    let dispatches = 0;
    const { bridge } = await readyByoBridge({
      onRequest: () => {
        dispatches += 1;
      },
    });
    expect(bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        mode: "build",
        profile: "@sceneaxi/profile-kids",
        prompt: "Denied",
      },
    })).toMatchObject({ ok: false, reason: "ASSISTANT_SCULPT_KIDS_DENIED" });
    expect(bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "hosted",
        mode: "build",
        profile: "@sceneaxi/profile-game",
        prompt: "Denied",
      },
    })).toMatchObject({
      ok: false,
      reason: DESKTOP_BRIDGE_REFUSALS.assistantHostedMeteringUnavailable,
    });
    expect(bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        mode: "agent",
        profile: "@sceneaxi/profile-game",
        prompt: "Denied",
      },
    })).toMatchObject({
      ok: false,
      reason: DESKTOP_BRIDGE_REFUSALS.rarityProviderUnavailable,
    });

    const unconfigured = createDesktopBridge({
      cwd: (await readyByoBridge()).projectRoot,
      commandCapabilities: COMMAND_CAPABILITIES,
    });
    expect(unconfigured.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        mode: "build",
        profile: "@sceneaxi/profile-game",
        prompt: "Denied",
      },
    })).toMatchObject({
      ok: false,
      reason: DESKTOP_BRIDGE_REFUSALS.assistantByoUnavailable,
    });
    expect(dispatches).toBe(0);
  });

  it("refuses a stale document and abandons an in-flight provider job", async () => {
    let release: ((value: unknown) => void) | undefined;
    const deferred = new Promise((resolve) => {
      release = resolve;
    });
    const { projectRoot, bridge } = await readyByoBridge({
      runByoAssistant: async () => {
        await deferred;
        throw new Error("must not settle after abandon");
      },
    });
    const started = startByo(bridge);
    expect(started).toMatchObject({ ok: true, data: { status: "running" } });
    const jobId = started.ok
      ? (started.data as DesktopAssistantJobSnapshot).jobId
      : "";
    expect(bridge.handle({
      action: "assistant",
      payload: { op: "abandon", jobId },
    })).toMatchObject({
      ok: true,
      data: {
        status: "refused",
        refusal: { reason: DESKTOP_BRIDGE_REFUSALS.assistantAbandoned },
      },
    });
    release?.(undefined);
    expect(documentBytes(projectRoot)).not.toContain(SYNTHETIC_CREDENTIAL);

    const readyHost = await readyByoBridge();
    expect(startByo(readyHost.bridge)).toMatchObject({ ok: true });
    expect((await settledAssistant(readyHost.bridge)).status).toBe("ready");
    const beforeStale = documentBytes(readyHost.projectRoot);
    expect(command(readyHost.bridge, "assistant-apply-build", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: `sha256:${"00".repeat(32)}`,
    })).toMatchObject({
      ok: true,
      data: {
        authoringSnapshot: {
          diagnostics: [{ code: "content-hash-conflict" }],
        },
      },
    });
    expect(documentBytes(readyHost.projectRoot)).toBe(beforeStale);
  });
});
