import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
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
  desktopByoConfigurationView,
  desktopByoRemovalContext,
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
    writeFileSync(join(root, "openrouter.v1.json"), "not-json", {
      encoding: "utf8",
      mode: 0o600,
    });
    chmodSync(join(root, "openrouter.v1.json"), 0o600);
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

  it.each([
    PROVIDER_KEY_STORE_REFUSALS.unavailable,
    PROVIDER_KEY_STORE_REFUSALS.locked,
    PROVIDER_KEY_STORE_REFUSALS.unsupported,
  ] as const)(
    "still unlinks an already-stored envelope when the backend reports %s",
    async (reason) => {
      const root = temporaryRoot("provider-key-remove-unavailable");
      await createProviderKeyStore({
        root,
        platformStorage: syntheticPlatform(),
      }).save("openrouter", SYNTHETIC_NON_SECRET);
      let decryptions = 0;
      const store = createProviderKeyStore({
        root,
        platformStorage: {
          availability: () => ({ ok: false, reason, message: "Synthetic refusal." }),
          encrypt: () => new Uint8Array(),
          decrypt: () => {
            decryptions += 1;
            return "";
          },
        },
      });

      expect(await store.removable("openrouter")).toEqual({
        ok: true,
        provider: "openrouter",
        removable: true,
      });
      expect(await store.read("openrouter")).toMatchObject({ ok: false, reason });
      expect(await store.status("openrouter")).toMatchObject({ ok: false, reason });
      expect(await store.save("openrouter", SYNTHETIC_NON_SECRET)).toMatchObject({
        ok: false,
        reason,
      });

      const removed = await store.remove("openrouter");
      expect(removed).toEqual({ ok: true, provider: "openrouter", removed: true });
      expect(JSON.stringify(removed)).not.toContain(SYNTHETIC_NON_SECRET);
      expect(existsSync(join(root, "openrouter.v1.json"))).toBe(false);
      expect(await store.remove("openrouter")).toEqual({
        ok: true,
        provider: "openrouter",
        removed: false,
      });
      expect(await store.removable("openrouter")).toEqual({
        ok: true,
        provider: "openrouter",
        removable: false,
      });
      expect(decryptions).toBe(0);
    },
  );

  it("refuses removal of a path that is not a regular owner-private file", async () => {
    const platformStorage = syntheticPlatform();

    const directoryRoot = temporaryRoot("provider-key-remove-directory");
    mkdirSync(join(directoryRoot, "openrouter.v1.json"));
    const directory = createProviderKeyStore({ root: directoryRoot, platformStorage });
    expect(await directory.remove("openrouter")).toMatchObject({
      ok: false,
      reason: PROVIDER_KEY_STORE_REFUSALS.corrupt,
    });
    expect(await directory.removable("openrouter")).toMatchObject({
      ok: false,
      reason: PROVIDER_KEY_STORE_REFUSALS.corrupt,
    });
    expect(existsSync(join(directoryRoot, "openrouter.v1.json"))).toBe(true);

    const decoy = join(temporaryRoot("provider-key-remove-decoy"), "decoy.json");
    writeFileSync(decoy, "{}", { encoding: "utf8", mode: 0o600 });
    const linkRoot = temporaryRoot("provider-key-remove-symlink");
    symlinkSync(decoy, join(linkRoot, "openrouter.v1.json"));
    const linked = createProviderKeyStore({ root: linkRoot, platformStorage });
    expect(await linked.remove("openrouter")).toMatchObject({
      ok: false,
      reason: PROVIDER_KEY_STORE_REFUSALS.corrupt,
    });
    expect(existsSync(decoy)).toBe(true);

    const openRoot = temporaryRoot("provider-key-remove-permissions");
    const openPath = join(openRoot, "openrouter.v1.json");
    writeFileSync(openPath, "{}", { encoding: "utf8", mode: 0o600 });
    chmodSync(openPath, 0o644);
    const open = createProviderKeyStore({ root: openRoot, platformStorage });
    expect(await open.remove("openrouter")).toMatchObject({
      ok: false,
      reason: PROVIDER_KEY_STORE_REFUSALS.corrupt,
    });
    expect(existsSync(openPath)).toBe(true);
  });

  it("keeps the owner-private assertion off platforms without POSIX permissions", async () => {
    const root = temporaryRoot("provider-key-remove-windows");
    const store = createProviderKeyStore({ root, platformStorage: syntheticPlatform() });
    await store.save("openrouter", SYNTHETIC_NON_SECRET);
    const envelope = join(root, "openrouter.v1.json");
    chmodSync(envelope, 0o666);

    const platform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    try {
      expect(await store.removable("openrouter")).toEqual({
        ok: true,
        provider: "openrouter",
        removable: true,
      });
      expect(await store.remove("openrouter")).toEqual({
        ok: true,
        provider: "openrouter",
        removed: true,
      });
      expect(existsSync(envelope)).toBe(false);

      mkdirSync(envelope);
      expect(await store.remove("openrouter")).toMatchObject({
        ok: false,
        reason: PROVIDER_KEY_STORE_REFUSALS.corrupt,
      });
    } finally {
      if (platform !== undefined) Object.defineProperty(process, "platform", platform);
    }
  });

  it.skipIf(process.getuid?.() === 0)(
    "names a failed removal without deleting anything",
    async () => {
      const root = temporaryRoot("provider-key-remove-failed");
      const store = createProviderKeyStore({ root, platformStorage: syntheticPlatform() });
      await store.save("openrouter", SYNTHETIC_NON_SECRET);
      chmodSync(root, 0o500);
      try {
        const response = await store.remove("openrouter");
        expect(response).toMatchObject({
          ok: false,
          reason: PROVIDER_KEY_STORE_REFUSALS.failed,
        });
        expect(JSON.stringify(response)).not.toContain(SYNTHETIC_NON_SECRET);
        expect(existsSync(join(root, "openrouter.v1.json"))).toBe(true);
      } finally {
        chmodSync(root, 0o700);
      }
    },
  );
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

  it("offers removal but no save or read while the backend is locked", async () => {
    const root = temporaryRoot("provider-config-locked");
    await createProviderKeyStore({
      root,
      platformStorage: syntheticPlatform(),
    }).save("openrouter", SYNTHETIC_NON_SECRET);
    const configuration = createDesktopByoConfiguration({
      keyStore: createProviderKeyStore({
        root,
        platformStorage: {
          availability: () => ({
            ok: false,
            reason: PROVIDER_KEY_STORE_REFUSALS.locked,
            message: "Synthetic lock.",
          }),
          encrypt: () => new Uint8Array(),
          decrypt: () => SYNTHETIC_NON_SECRET,
        },
      }),
      providerRuntimeAvailable: false,
    });
    const request = { profile: "@sceneaxi/profile-game", provider: "openrouter" } as const;

    const stored = await configuration.handle({ ...request, action: "status" });
    expect(stored).toMatchObject({
      ok: false,
      reason: PROVIDER_KEY_STORE_REFUSALS.locked,
      removable: true,
    });
    expect(JSON.stringify(stored)).not.toContain(SYNTHETIC_NON_SECRET);
    expect(
      await configuration.handle({ ...request, action: "save", key: SYNTHETIC_NON_SECRET }),
    ).toMatchObject({ ok: false, reason: PROVIDER_KEY_STORE_REFUSALS.locked, removable: true });

    expect(await configuration.handle({ ...request, action: "remove" })).toMatchObject({
      ok: true,
      operation: "removed",
      keyStatus: "missing",
      storageStatus: "unavailable",
    });
    expect(await configuration.handle({ ...request, action: "status" })).toMatchObject({
      ok: false,
      reason: PROVIDER_KEY_STORE_REFUSALS.locked,
      removable: false,
    });
  });

  it("reports a reachable backend on every other successful answer", async () => {
    const root = temporaryRoot("provider-config-storage-status");
    const configuration = createDesktopByoConfiguration({
      keyStore: createProviderKeyStore({ root, platformStorage: syntheticPlatform() }),
      providerRuntimeAvailable: false,
    });
    const request = { profile: "@sceneaxi/profile-game", provider: "openrouter" } as const;

    expect(await configuration.handle({ ...request, action: "status" })).toMatchObject({
      ok: true,
      keyStatus: "missing",
      storageStatus: "ready",
    });
    expect(
      await configuration.handle({ ...request, action: "save", key: SYNTHETIC_NON_SECRET }),
    ).toMatchObject({ ok: true, operation: "saved", storageStatus: "ready" });
    expect(await configuration.handle({ ...request, action: "remove" })).toMatchObject({
      ok: true,
      operation: "removed",
      storageStatus: "ready",
    });
    expect(await configuration.handle({ ...request, action: "remove" })).toMatchObject({
      ok: true,
      operation: "already-missing",
      storageStatus: "ready",
    });
  });

  it.each([
    [PROVIDER_KEY_STORE_REFUSALS.unavailable, "storage-unavailable"],
    [PROVIDER_KEY_STORE_REFUSALS.locked, "storage-unavailable"],
    [PROVIDER_KEY_STORE_REFUSALS.unsupported, "storage-unavailable"],
    [PROVIDER_KEY_STORE_REFUSALS.corrupt, "envelope-invalid"],
    [PROVIDER_KEY_STORE_REFUSALS.keyInvalid, "envelope-present"],
    [PROVIDER_KEY_STORE_REFUSALS.failed, "envelope-present"],
  ] as const)("classifies %s removal context as %s", (reason, context) => {
    expect(desktopByoRemovalContext(reason)).toBe(context);
  });

  it("denies Kids before reading a key field or touching secure storage", async () => {
    let keyReads = 0;
    let storageCalls = 0;
    const store = {
      removable: async () => {
        storageCalls += 1;
        throw new Error("Kids reached removable");
      },
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

describe("BYOK configuration surface projection", () => {
  const refusal = (
    reason: (typeof PROVIDER_KEY_STORE_REFUSALS)[keyof typeof PROVIDER_KEY_STORE_REFUSALS],
    removable: boolean,
  ) => desktopByoConfigurationView({ ok: false, reason, message: "Synthetic detail.", removable });

  it("blames only the cause the store reported", () => {
    const locked = refusal(PROVIDER_KEY_STORE_REFUSALS.locked, true);
    expect(locked.message).toContain("Secure storage is unavailable");
    expect(locked.message).toContain("without unlocking it");
    expect(locked.removeEnabled).toBe(true);

    const corrupt = refusal(PROVIDER_KEY_STORE_REFUSALS.corrupt, true);
    expect(corrupt.state).toBe("Stored · unusable");
    expect(corrupt.message).toContain("The stored entry is invalid and can be removed.");
    expect(corrupt.message).not.toContain("sealed");
    expect(corrupt.message).not.toContain("unlock");
    expect(corrupt.message).not.toContain("Secure storage is unavailable");
    expect(corrupt.removeEnabled).toBe(true);

    const unknown = refusal(PROVIDER_KEY_STORE_REFUSALS.keyInvalid, true);
    expect(unknown.message).toContain("A stored entry is present and can be removed.");
    expect(unknown.message).not.toContain("sealed");
    expect(unknown.message).not.toContain("Secure storage is unavailable");

    for (const view of [locked, corrupt, unknown, refusal(PROVIDER_KEY_STORE_REFUSALS.failed, false)]) {
      expect(view.keyFieldEnabled).toBe(false);
      expect(view.saveEnabled).toBe(false);
      expect(view.saveLabel).toBeNull();
    }
    expect(refusal(PROVIDER_KEY_STORE_REFUSALS.failed, false).removeEnabled).toBe(false);
  });

  it("never offers save while the backend stays unreachable after a successful removal", () => {
    const removed = desktopByoConfigurationView({
      ok: true,
      action: "remove",
      provider: "openrouter",
      providerLabel: "OpenRouter",
      keyStatus: "missing",
      operation: "removed",
      storageStatus: "unavailable",
      runtimeStatus: "unavailable",
    });
    expect(removed).toMatchObject({
      state: "Storage unavailable",
      keyFieldEnabled: false,
      saveEnabled: false,
      removeEnabled: false,
    });
    expect(removed.message).toContain("The provider key was removed.");
    expect(removed.message).toContain("saving and replacing stay refused");

    const ready = desktopByoConfigurationView({
      ok: true,
      action: "status",
      provider: "openrouter",
      providerLabel: "OpenRouter",
      keyStatus: "configured",
      operation: "status",
      storageStatus: "ready",
      runtimeStatus: "unavailable",
    });
    expect(ready).toMatchObject({
      state: "Key saved",
      saveLabel: "Replace key",
      keyFieldEnabled: true,
      saveEnabled: true,
      removeEnabled: true,
    });
    expect(ready.message).toContain("Provider execution is unavailable in this desktop build.");
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
    expect(renderer).toContain("desktopByoConfigurationView(response)");
    expect(renderer).toContain("save.disabled = !view.saveEnabled");
    expect(renderer).toContain("remove.disabled = !view.removeEnabled");
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
