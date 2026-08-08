import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ModelDescriptor } from "@sceneaxi/authoring-core";
import {
  createFixtureTransport,
  type OpenRouterTransportRequest,
} from "@sceneaxi/provider-openrouter";
import {
  DESKTOP_BRIDGE_REFUSALS,
  PROVIDER_KEY_STORE_REFUSALS,
  createDesktopBridge,
  createProviderKeyStore,
  seedDesktopProject,
  type DesktopAssistantJobSnapshot,
  type DesktopBridge,
  type DesktopBridgeOk,
  type PlatformSecureStorage,
  type ProviderKeyStore,
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
  seed: 235,
});

const SYNTHETIC_CREDENTIAL = "synthetic-desktop-provider-credential";
const PROVIDER_PRIVATE_MARKER = "provider-private-envelope-marker";

const SCULPT_INTAKE = JSON.stringify({
  schemaVersion: 1,
  kind: "sceneaxi.sculpt-intake",
  intakeId: "desktop-provider-crate",
  mode: "structured-spec",
  structuredSpec: {
    schemaVersion: 1,
    kind: "sceneaxi.object-sculpt-spec",
    id: "desktop-provider-crate-spec",
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

function platformStorage(
  availability: ReturnType<PlatformSecureStorage["availability"]> = { ok: true },
): PlatformSecureStorage {
  return Object.freeze({
    availability: () => availability,
    encrypt: (plaintext: string) => Buffer.from(plaintext, "utf8"),
    decrypt: (ciphertext: Uint8Array) => Buffer.from(ciphertext).toString("utf8"),
  });
}

async function settledAssistant(bridge: DesktopBridge) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const response = bridge.handle({ action: "assistant", payload: { op: "status" } });
    if (!response.ok) throw new Error(response.reason);
    const snapshot = (response as DesktopBridgeOk<DesktopAssistantJobSnapshot>).data;
    if (snapshot?.status !== "running") return snapshot;
  }
  throw new Error("desktop assistant did not settle");
}

describe("desktop privileged provider host", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  function temporaryRoot(label: string) {
    const root = mkdtempSync(join(tmpdir(), `sceneaxi-${label}-`));
    roots.push(root);
    return root;
  }

  function projectBridge(runByoAssistant: NonNullable<
    ReturnType<typeof createPrivilegedDesktopByoRuntime>["runByoAssistant"]
  >) {
    const projectRoot = temporaryRoot("provider-host-project");
    expect(seedDesktopProject(projectRoot).ok).toBe(true);
    return {
      projectRoot,
      bridge: createDesktopBridge({ cwd: projectRoot, runByoAssistant }),
    };
  }

  it("executes the pinned fixture path and returns only validated artifact and exact-model evidence", async () => {
    const store = createProviderKeyStore({
      root: temporaryRoot("provider-host-store"),
      platformStorage: platformStorage(),
    });
    await expect(store.save("openrouter", SYNTHETIC_CREDENTIAL)).resolves.toMatchObject({
      ok: true,
    });

    const requests: OpenRouterTransportRequest[] = [];
    const events: string[] = [];
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
            events.push("credential-read", "transport-dispatch");
            expect(credential.read()).toBe(SYNTHETIC_CREDENTIAL);
            requests.push(request);
            return fixture(request);
          },
          close() {
            events.push("transport-close");
            expect(() => credential.read()).toThrow("lease has ended");
          },
        }),
      }),
    });
    expect(runtime.runByoAssistant).toBeDefined();
    if (runtime.runByoAssistant === undefined) return;
    await expect(
      runtime.configuration.handle({
        action: "status",
        profile: "@sceneaxi/profile-game",
        provider: "openrouter",
      }),
    ).resolves.toMatchObject({
      ok: true,
      keyStatus: "configured",
      runtimeStatus: "ready",
    });

    const { bridge, projectRoot } = projectBridge(runtime.runByoAssistant);
    expect(
      bridge.handle({
        action: "assistant",
        payload: {
          op: "start",
          route: "byo",
          profile: "@sceneaxi/profile-game",
          prompt: "Build a blue crate",
        },
      }),
    ).toMatchObject({ ok: true, data: { route: "byo", status: "running" } });

    const snapshot = await settledAssistant(bridge);
    expect(snapshot).toMatchObject({
      route: "byo",
      status: "ready",
      result: {
        route: "byo",
        mountable: {
          artifacts: {
            "desktop-provider-crate-artifact": {
              kind: "sceneaxi.sculpt-artifact",
            },
          },
        },
        providerEvidence: {
          schemaVersion: 1,
          kind: "sceneaxi.model-provider-call-evidence",
          operation: "complete",
          profile: "@sceneaxi/profile-game",
          model: MODEL,
        },
      },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      operation: "complete",
      modelDescriptor: MODEL,
      model: MODEL.model,
      provider: { allow_fallbacks: false },
      temperature: 0,
      seed: 235,
    });
    expect(requests[0]?.messages[0].content).toContain("Build a blue crate");
    expect(JSON.stringify(requests[0])).not.toContain(SYNTHETIC_CREDENTIAL);
    expect(JSON.stringify(snapshot)).not.toContain(SYNTHETIC_CREDENTIAL);
    expect(JSON.stringify(snapshot)).not.toContain(PROVIDER_PRIVATE_MARKER);
    expect(readFileSync(join(projectRoot, "scene.json"), "utf8")).not.toContain(
      SYNTHETIC_CREDENTIAL,
    );
    expect(events).toEqual([
      "credential-read",
      "transport-dispatch",
      "transport-close",
    ]);
  });

  it("removes provider-authored failure detail before bridge status is visible", async () => {
    const store = createProviderKeyStore({
      root: temporaryRoot("provider-redaction-store"),
      platformStorage: platformStorage(),
    });
    await store.save("openrouter", SYNTHETIC_CREDENTIAL);
    const runtime = createPrivilegedDesktopByoRuntime({
      keyStore: store,
      createProviderSession: createDesktopOpenRouterProviderSession({
        model: MODEL,
        eval: EVAL,
        profilePolicies: {
          "@sceneaxi/profile-game": () => ({ ok: true }),
        },
        openTransport: () => ({
          transport() {
            throw new Error(`upstream failure ${PROVIDER_PRIVATE_MARKER}`);
          },
        }),
      }),
    });
    if (runtime.runByoAssistant === undefined) throw new Error("runtime unavailable");
    const { bridge } = projectBridge(runtime.runByoAssistant);
    bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        profile: "@sceneaxi/profile-game",
        prompt: "Build a crate",
      },
    });

    const snapshot = await settledAssistant(bridge);
    expect(snapshot).toMatchObject({
      status: "refused",
      refusal: {
        reason: "ASSISTANT_SCULPT_PROVIDER_FAILED",
        message:
          "The OpenRouter-backed assistant action refused before producing a renderer-safe artifact.",
      },
    });
    expect(JSON.stringify(snapshot)).not.toContain(PROVIDER_PRIVATE_MARKER);
    expect(JSON.stringify(snapshot)).not.toContain(SYNTHETIC_CREDENTIAL);
    expect(snapshot?.refusal).not.toHaveProperty("detail");
  });

  it("keeps the checked-in host unavailable when no transport session is injected", async () => {
    const store = createProviderKeyStore({
      root: temporaryRoot("provider-unavailable-store"),
      platformStorage: platformStorage(),
    });
    const runtime = createPrivilegedDesktopByoRuntime({ keyStore: store });
    expect(runtime.runByoAssistant).toBeUndefined();
    await expect(
      runtime.configuration.handle({
        action: "status",
        profile: "@sceneaxi/profile-game",
        provider: "openrouter",
      }),
    ).resolves.toMatchObject({
      ok: true,
      keyStatus: "missing",
      runtimeStatus: "unavailable",
    });

    const projectRoot = temporaryRoot("provider-unavailable-project");
    expect(seedDesktopProject(projectRoot).ok).toBe(true);
    const bridge = createDesktopBridge({ cwd: projectRoot });
    expect(
      bridge.handle({
        action: "assistant",
        payload: {
          op: "start",
          route: "byo",
          profile: "@sceneaxi/profile-game",
          prompt: "Build a crate",
        },
      }),
    ).toMatchObject({
      ok: false,
      reason: DESKTOP_BRIDGE_REFUSALS.assistantByoUnavailable,
    });
  });

  it("refuses an invalid injected transport session before provider dispatch", async () => {
    const store = createProviderKeyStore({
      root: temporaryRoot("provider-invalid-session-store"),
      platformStorage: platformStorage(),
    });
    await store.save("openrouter", SYNTHETIC_CREDENTIAL);
    const runtime = createPrivilegedDesktopByoRuntime({
      keyStore: store,
      createProviderSession: createDesktopOpenRouterProviderSession({
        model: MODEL,
        eval: EVAL,
        profilePolicies: {
          "@sceneaxi/profile-game": () => ({ ok: true }),
        },
        openTransport: () => ({ transport: "invalid" }) as never,
      }),
    });
    if (runtime.runByoAssistant === undefined) throw new Error("runtime unavailable");
    const { bridge } = projectBridge(runtime.runByoAssistant);
    bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        profile: "@sceneaxi/profile-game",
        prompt: "Build a crate",
      },
    });

    expect(await settledAssistant(bridge)).toMatchObject({
      status: "refused",
      refusal: {
        reason: "DESKTOP_BYO_PROVIDER_SESSION_FAILED",
        message: "The privileged BYOK provider session could not be created.",
      },
    });
  });

  it("closes the opened transport session when the pinned adapter refuses construction", async () => {
    const store = createProviderKeyStore({
      root: temporaryRoot("provider-mispinned-store"),
      platformStorage: platformStorage(),
    });
    await store.save("openrouter", SYNTHETIC_CREDENTIAL);
    const events: string[] = [];
    const runtime = createPrivilegedDesktopByoRuntime({
      keyStore: store,
      createProviderSession: createDesktopOpenRouterProviderSession({
        // A descriptor the OpenRouter adapter refuses: the session factory's own
        // guard only checks the key-store provider, so construction throws after
        // the deployment's transport has already been opened.
        model: { ...MODEL, provider: "not-openrouter" },
        eval: EVAL,
        profilePolicies: {
          "@sceneaxi/profile-game": () => ({ ok: true }),
        },
        openTransport: () => {
          events.push("transport-open");
          return {
            transport() {
              events.push("transport-dispatch");
              throw new Error("must not dispatch");
            },
            close() {
              events.push("transport-close");
            },
          };
        },
      }),
    });
    if (runtime.runByoAssistant === undefined) throw new Error("runtime unavailable");
    const { bridge } = projectBridge(runtime.runByoAssistant);
    bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        profile: "@sceneaxi/profile-game",
        prompt: "Build a crate",
      },
    });

    expect(await settledAssistant(bridge)).toMatchObject({
      status: "refused",
      refusal: {
        reason: "DESKTOP_BYO_PROVIDER_SESSION_FAILED",
        message: "The privileged BYOK provider session could not be created.",
      },
    });
    expect(events).toEqual(["transport-open", "transport-close"]);
  });

  it.each([
    ["missing", PROVIDER_KEY_STORE_REFUSALS.keyMissing],
    ["locked", PROVIDER_KEY_STORE_REFUSALS.locked],
    ["corrupt", PROVIDER_KEY_STORE_REFUSALS.corrupt],
  ] as const)("refuses %s secure configuration before transport dispatch", async (state, reason) => {
    const root = temporaryRoot(`provider-${state}-store`);
    const availability = state === "locked"
      ? {
          ok: false as const,
          reason: PROVIDER_KEY_STORE_REFUSALS.locked,
          message: "Synthetic locked store.",
        }
      : { ok: true as const };
    const store = createProviderKeyStore({
      root,
      platformStorage: platformStorage(availability),
    });
    if (state === "corrupt") {
      mkdirSync(root, { recursive: true, mode: 0o700 });
      writeFileSync(join(root, "openrouter.v1.json"), "{}", { mode: 0o600 });
    }
    let dispatches = 0;
    const runtime = createPrivilegedDesktopByoRuntime({
      keyStore: store,
      createProviderSession: createDesktopOpenRouterProviderSession({
        model: MODEL,
        eval: EVAL,
        profilePolicies: {
          "@sceneaxi/profile-game": () => ({ ok: true }),
        },
        openTransport: () => ({
          transport() {
            dispatches += 1;
            throw new Error("must not dispatch");
          },
        }),
      }),
    });
    if (runtime.runByoAssistant === undefined) throw new Error("runtime unavailable");
    const { bridge } = projectBridge(runtime.runByoAssistant);
    bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        profile: "@sceneaxi/profile-game",
        prompt: "Build a crate",
      },
    });

    expect(await settledAssistant(bridge)).toMatchObject({
      status: "refused",
      refusal: { reason },
    });
    expect(dispatches).toBe(0);
  });

  it("denies Kids and Hosted before secure reads or provider construction", () => {
    let reads = 0;
    let transports = 0;
    const inertStore: ProviderKeyStore = Object.freeze({
      status: async () => ({
        ok: true as const,
        provider: "openrouter" as const,
        keyStatus: "configured" as const,
      }),
      read: async () => {
        reads += 1;
        return {
          ok: true as const,
          provider: "openrouter" as const,
          key: SYNTHETIC_CREDENTIAL,
        };
      },
      save: async () => ({
        ok: true as const,
        provider: "openrouter" as const,
        replaced: false,
      }),
      remove: async () => ({
        ok: true as const,
        provider: "openrouter" as const,
        removed: false,
      }),
      removable: async () => ({
        ok: true as const,
        provider: "openrouter" as const,
        removable: false,
      }),
    });
    const runtime = createPrivilegedDesktopByoRuntime({
      keyStore: inertStore,
      createProviderSession: createDesktopOpenRouterProviderSession({
        model: MODEL,
        eval: EVAL,
        profilePolicies: {},
        openTransport: () => {
          transports += 1;
          return { transport: () => { throw new Error("must not dispatch"); } };
        },
      }),
    });
    if (runtime.runByoAssistant === undefined) throw new Error("runtime unavailable");
    const { bridge } = projectBridge(runtime.runByoAssistant);

    expect(
      bridge.handle({
        action: "assistant",
        payload: {
          op: "start",
          route: "byo",
          profile: "@sceneaxi/profile-kids",
          prompt: "Denied",
        },
      }),
    ).toMatchObject({ ok: false, reason: "ASSISTANT_SCULPT_KIDS_DENIED" });
    expect(
      bridge.handle({
        action: "assistant",
        payload: {
          op: "start",
          route: "hosted",
          profile: "@sceneaxi/profile-game",
          prompt: "Denied",
        },
      }),
    ).toMatchObject({
      ok: false,
      reason: DESKTOP_BRIDGE_REFUSALS.assistantHostedMeteringUnavailable,
    });
    expect(reads).toBe(0);
    expect(transports).toBe(0);
  });
});
