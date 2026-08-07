/** Electron safeStorage adapter for the pure provider-key store contract. */
import { join } from "node:path";
import { safeStorage } from "electron";
import {
  createProviderKeyStore,
  type PlatformSecureStorage,
  type ProviderKeyStore,
} from "../lib/provider-key-store.js";
import { PROVIDER_KEY_STORE_REFUSALS } from "../lib/byo-configuration-contract.js";

export function createElectronProviderKeyStore(userDataDirectory: string): ProviderKeyStore {
  const platformStorage: PlatformSecureStorage = Object.freeze({
    availability() {
      if (process.platform !== "linux" && process.platform !== "darwin" && process.platform !== "win32") {
        return Object.freeze({
          ok: false as const,
          reason: PROVIDER_KEY_STORE_REFUSALS.unsupported,
          message: "This operating system has no supported Electron secure-storage backend.",
        });
      }
      if (process.platform === "linux") {
        const backend = safeStorage.getSelectedStorageBackend();
        if (backend === "basic_text" || backend === "unknown") {
          return Object.freeze({
            ok: false as const,
            reason: PROVIDER_KEY_STORE_REFUSALS.unsupported,
            message: "Linux BYOK requires an OS password manager; Electron basic-text storage is refused.",
          });
        }
      }
      if (!safeStorage.isEncryptionAvailable()) {
        return Object.freeze({
          ok: false as const,
          reason: PROVIDER_KEY_STORE_REFUSALS.locked,
          message: "Platform secure storage is locked or unavailable for this desktop session.",
        });
      }
      return Object.freeze({ ok: true as const });
    },
    encrypt: (plaintext) => safeStorage.encryptString(plaintext),
    decrypt: (ciphertext) => safeStorage.decryptString(Buffer.from(ciphertext)),
  });

  return createProviderKeyStore({
    root: join(userDataDirectory, "secure-provider-keys"),
    platformStorage,
  });
}
