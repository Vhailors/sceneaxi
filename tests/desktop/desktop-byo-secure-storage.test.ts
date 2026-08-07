import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AssistantSculptResult } from "@sceneaxi/authoring-core";
import {
  DESKTOP_BYO_CONFIGURATION_CHANNEL,
  DESKTOP_BYO_CONFIGURATION_REFUSALS,
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_BRIDGE_REFUSALS,
  PROVIDER_KEY_STORE_REFUSALS,
  createDesktopBridge,
  createDesktopByoConfiguration,
  createProviderKeyStore,
  createSecureDesktopByoAssistantRunner,
  seedDesktopProject,
  type PlatformSecureStorage,
  type ProviderKeyAccess,
  type ProviderKeyStore,
} from "../../desktop/linux/src/index.ts";

const SYNTHETIC_NON_SECRET = "synthetic-non-secret-provider-key";
const roots: string[] = [];

function temporaryRoot(label: string): string {
  const root = mkdtempSync(join(tmpdir(), `sceneaxi-${label}-`));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function syntheticPlatform(
  availability: ReturnType<PlatformSecureStorage["availability"]> = { ok: true },
): PlatformSecureStorage {
  return Object.freeze({
    availability: () => availability,
    encrypt: (plaintext) => Buffer.from(`protected:${plaintext}`, "utf8"),
    decrypt: (ciphertext) => {
      const protectedValue = Buffer.from(ciphertext).toString("utf8");
      if (!protectedValue.startsWith("protected:")) throw new Error("corrupt synthetic envelope");
      return protectedValue.slice("protected:".length);
    },
  });
}

describe("desktop provider key store", () => {
  it("saves, reads, replaces, and removes only platform-encrypted bytes", async () => {
    const root = temporaryRoot("provider-key-store");
    const store = createProviderKeyStore({ root, platformStorage: syntheticPlatform() });

    expect(await store.status("openrouter")).toMatchObject({ ok: true, keyStatus: "missing" });
    expect(await store.save("openrouter", SYNTHETIC_NON_SECRET)).toEqual({
      ok: true,
      provider: "openrouter",
      replaced: false,
    });
    const disk = readFileSync(join(root, "openrouter.v1.json"), "utf8");
    expect(disk).not.toContain(SYNTHETIC_NON_SECRET);
    expect(await store.read("openrouter")).toEqual({
      ok: true,
      provider: "openrouter",
      key: SYNTHETIC_NON_SECRET,
    });

    expect(await store.save("openrouter", `${SYNTHETIC_NON_SECRET}-replacement`)).toEqual({
      ok: true,
      provider: "openrouter",
      replaced: true,
    });
    expect(await store.remove("openrouter")).toEqual({
      ok: true,
      provider: "openrouter",
      removed: true,
    });
    expect(await store.read("openrouter")).toMatchObject({
      ok: false,
      reason: PROVIDER_KEY_STORE_REFUSALS.keyMissing,
    });
  });

  it.each([
    PROVIDER_KEY_STORE_REFUSALS.unavailable,
    PROVIDER_KEY_STORE_REFUSALS.locked,
    PROVIDER_KEY_STORE_REFUSALS.unsupported,
  ] as const)("refuses %s before encryption or persistence", async (reason) => {
    let encryptions = 0;
    const root = temporaryRoot("provider-key-unavailable");
    const store = createProviderKeyStore({
      root,
      platformStorage: {
        availability: () => ({ ok: false, reason, message: "Synthetic refusal." }),
        encrypt: () => {
          encryptions += 1;
          return new Uint8Array();
        },
        decrypt: () => "",
      },
    });
    expect(await store.save("openrouter", SYNTHETIC_NON_SECRET)).toMatchObject({
      ok: false,
      reason,
    });
    expect(encryptions).toBe(0);
  });

  it("names corrupt and failed storage without exposing stored bytes", async () => {
    const root = temporaryRoot("provider-key-corrupt");
    writeFileSync(join(root, "openrouter.v1.json"), "not-json", "utf8");
    const corrupt = createProviderKeyStore({ root, platformStorage: syntheticPlatform() });
    expect(await corrupt.read("openrouter")).toMatchObject({
      ok: false,
      reason: PROVIDER_KEY_STORE_REFUSALS.corrupt,
    });
    expect(await corrupt.remove("openrouter")).toEqual({
      ok: true,
      provider: "openrouter",
      removed: true,
    });

    const failingPlatform: PlatformSecureStorage = {
      availability: () => ({ ok: true }),
      encrypt: () => {
        throw new Error(SYNTHETIC_NON_SECRET);
      },
      decrypt: () => "",
    };
    const failed = createProviderKeyStore({
      root: temporaryRoot("provider-key-failed"),
      platformStorage: failingPlatform,
    });
    const response = await failed.save("openrouter", SYNTHETIC_NON_SECRET);
    expect(response).toMatchObject({ ok: false, reason: PROVIDER_KEY_STORE_REFUSALS.failed });
    expect(JSON.stringify(response)).not.toContain(SYNTHETIC_NON_SECRET);
  });

  it("leaves an existing encrypted value intact when replacement encryption fails", async () => {
    let failEncryption = false;
    const platform: PlatformSecureStorage = {
      availability: () => ({ ok: true }),
      encrypt: (plaintext) => {
        if (failEncryption) throw new Error("synthetic encryption failure");
        return Buffer.from(`protected:${plaintext}`, "utf8");
      },
      decrypt: (ciphertext) =>
        Buffer.from(ciphertext).toString("utf8").slice("protected:".length),
    };
    const store = createProviderKeyStore({
      root: temporaryRoot("provider-key-atomic"),
      platformStorage: platform,
    });
    await store.save("openrouter", SYNTHETIC_NON_SECRET);
    failEncryption = true;
    expect(
      await store.save("openrouter", `${SYNTHETIC_NON_SECRET}-replacement`),
    ).toMatchObject({ ok: false, reason: PROVIDER_KEY_STORE_REFUSALS.failed });
    expect(await store.read("openrouter")).toEqual({
      ok: true,
      provider: "openrouter",
      key: SYNTHETIC_NON_SECRET,
    });
  });
});

describe("desktop BYOK configuration", () => {
  it("returns status metadata only and redacts submitted values on save and replace", async () => {
    const store = createProviderKeyStore({
      root: temporaryRoot("provider-config"),
      platformStorage: syntheticPlatform(),
    });
    const configuration = createDesktopByoConfiguration({
      keyStore: store,
      providerRuntimeAvailable: true,
    });
    const save = await configuration.handle({
      action: "save",
      profile: "@sceneaxi/profile-game",
      provider: "openrouter",
      key: SYNTHETIC_NON_SECRET,
    });
    expect(save).toMatchObject({
      ok: true,
      operation: "saved",
      keyStatus: "configured",
      runtimeStatus: "ready",
    });
    expect(JSON.stringify(save)).not.toContain(SYNTHETIC_NON_SECRET);
    const replace = await configuration.handle({
      action: "save",
      profile: "@sceneaxi/profile-web",
      provider: "openrouter",
      key: `${SYNTHETIC_NON_SECRET}-replacement`,
    });
    expect(replace).toMatchObject({ ok: true, operation: "replaced" });
    expect(Object.keys(replace)).not.toContain("key");
  });

  it("denies Kids before reading a key field or touching secure storage", async () => {
    let keyReads = 0;
    let storageCalls = 0;
    const store = {
      status: async () => {
        storageCalls += 1;
        throw new Error("Kids reached status");
      },
      read: async () => {
        storageCalls += 1;
        throw new Error("Kids reached read");
      },
      save: async () => {
        storageCalls += 1;
        throw new Error("Kids reached save");
      },
      remove: async () => {
        storageCalls += 1;
        throw new Error("Kids reached remove");
      },
    } as unknown as ProviderKeyStore;
    const configuration = createDesktopByoConfiguration({
      keyStore: store,
      providerRuntimeAvailable: true,
    });
    const request = {
      profile: "@sceneaxi/profile-kids",
      get key() {
        keyReads += 1;
        return SYNTHETIC_NON_SECRET;
      },
      action: "save",
      provider: "openrouter",
    };
    expect(await configuration.handle(request)).toMatchObject({
      ok: false,
      reason: DESKTOP_BYO_CONFIGURATION_REFUSALS.kidsDenied,
    });
    expect(keyReads).toBe(0);
    expect(storageCalls).toBe(0);
  });
});

describe("privileged BYOK provider session", () => {
  it("injects only after secure retrieval and revokes the key lease before close", async () => {
    const events: string[] = [];
    let leasedKey: ProviderKeyAccess | null = null;
    const store = createProviderKeyStore({
      root: temporaryRoot("provider-session"),
      platformStorage: syntheticPlatform(),
    });
    await store.save("openrouter", SYNTHETIC_NON_SECRET);
    const runner = createSecureDesktopByoAssistantRunner({
      keyStore: {
        ...store,
        read: async (provider) => {
          events.push("secure-read");
          return store.read(provider);
        },
      },
      provider: "openrouter",
      createProviderSession: ({ key }) => {
        events.push("provider-session");
        leasedKey = key;
        expect(key.read()).toBe(SYNTHETIC_NON_SECRET);
        return {
          async run() {
            events.push("provider-run");
            return {
              ok: false,
              reason: "ASSISTANT_SCULPT_PROVIDER_REFUSED",
              message: "Synthetic provider refusal.",
              recoverable: true,
            } satisfies AssistantSculptResult;
          },
          close() {
            events.push("provider-close");
            expect(() => key.read()).toThrow("lease has ended");
          },
        };
      },
    });
    await runner({
      profile: "@sceneaxi/profile-game",
      prompt: "Synthetic prompt",
      onProgress: () => undefined,
    });
    expect(events).toEqual(["secure-read", "provider-session", "provider-run", "provider-close"]);
    expect(() => leasedKey?.read()).toThrow("lease has ended");
  });

  it("redacts provider failures from the renderer bridge and preserves route boundaries", async () => {
    const project = temporaryRoot("provider-bridge");
    seedDesktopProject(project);
    const store = createProviderKeyStore({
      root: temporaryRoot("provider-bridge-store"),
      platformStorage: syntheticPlatform(),
    });
    await store.save("openrouter", SYNTHETIC_NON_SECRET);
    const bridge = createDesktopBridge({
      cwd: project,
      runByoAssistant: createSecureDesktopByoAssistantRunner({
        keyStore: store,
        provider: "openrouter",
        createProviderSession: () => ({
          async run(request) {
            request.onProgress({
              phase: "streaming-provider",
              percent: 50,
              message: "Synthetic reflected credential",
              delta: SYNTHETIC_NON_SECRET,
            });
            throw new Error(`upstream echoed ${SYNTHETIC_NON_SECRET}`);
          },
          close: () => undefined,
        }),
      }),
    });
    const started = bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        profile: "@sceneaxi/profile-game",
        prompt: "Synthetic prompt",
      },
    });
    expect(started.ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const status = bridge.handle({ action: "assistant", payload: { op: "status" } });
    expect(status).toMatchObject({
      ok: true,
      data: {
        status: "refused",
        latestProgress: {
          percent: 50,
          message: "Provider progress was redacted.",
        },
        refusal: {
          reason: DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
        },
      },
    });
    expect(JSON.stringify(status)).not.toContain(SYNTHETIC_NON_SECRET);

    const local = bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "local",
        profile: "@sceneaxi/profile-game",
        prompt: "Synthetic local green sphere",
      },
    });
    expect(local).toMatchObject({ ok: true, data: { route: "local", status: "running" } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bridge.handle({ action: "assistant", payload: { op: "status" } })).toMatchObject({
      ok: true,
      data: { route: "local", status: "ready" },
    });

    const hosted = bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "hosted",
        profile: "@sceneaxi/profile-game",
        prompt: "Synthetic prompt",
      },
    });
    expect(hosted).toMatchObject({
      ok: false,
      reason: DESKTOP_BRIDGE_REFUSALS.assistantHostedMeteringUnavailable,
    });
    expect(DESKTOP_BRIDGE_ACTIONS).not.toContain("byo-configuration");
  });
});

describe("renderer and transport redaction structure", () => {
  it("keeps configuration off the local tool bridge and clears renderer key references", () => {
    const renderer = readFileSync(
      new URL("../../desktop/linux/src/renderer/byo-configuration.ts", import.meta.url),
      "utf8",
    );
    const preload = readFileSync(
      new URL("../../desktop/linux/src/electron/preload.ts", import.meta.url),
      "utf8",
    );
    const localRpc = readFileSync(
      new URL("../../desktop/linux/src/lib/local-rpc.ts", import.meta.url),
      "utf8",
    );
    const electronStore = readFileSync(
      new URL("../../desktop/linux/src/electron/provider-key-store.ts", import.meta.url),
      "utf8",
    );
    expect(renderer).toContain('keyInput.type = "password"');
    expect(renderer).toContain('keyInput.value = ""');
    expect(renderer).not.toContain("localStorage");
    expect(renderer).not.toContain("sessionStorage");
    expect(preload).toContain("configureByo");
    expect(preload).toContain("DESKTOP_BYO_CONFIGURATION_CHANNEL");
    expect(localRpc).not.toContain(DESKTOP_BYO_CONFIGURATION_CHANNEL);
    expect(electronStore).toContain("safeStorage.encryptString");
    expect(electronStore).toContain('backend === "basic_text"');
    expect(electronStore).not.toContain("setUsePlainTextEncryption");
    expect(electronStore).not.toContain("process.env");
  });
});
