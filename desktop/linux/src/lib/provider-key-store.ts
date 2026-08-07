/**
 * Desktop provider credentials behind an injected platform secure-storage seam.
 *
 * This module knows how to persist only platform-encrypted bytes. It never owns a
 * cipher, environment fallback, browser store, CLI field, or logging path. The
 * Electron adapter supplies the OS-backed primitive; tests supply a synthetic
 * in-memory primitive with the same contract.
 *
 * Two capabilities, deliberately separated. Producing or consuming a key needs the
 * platform backend, so `save` and `read` refuse whenever it is unavailable, locked,
 * or unsupported. Unlinking an envelope needs no cipher at all, so `remove` and its
 * `removable` probe answer from the filesystem alone — a user whose OS keyring is
 * locked can still delete a stored credential. That path never reads, decrypts, or
 * returns envelope bytes, and refuses by name when the file is not a regular
 * owner-private file or cannot be unlinked.
 */
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  type Stats,
} from "node:fs";
import { join } from "node:path";
import {
  DESKTOP_BYO_PROVIDERS,
  PROVIDER_KEY_STORE_REFUSALS,
  type DesktopByoProvider,
  type ProviderKeyStoreRefusalReason,
} from "./byo-configuration-contract.js";

export type ProviderKeyStoreRefusal = Readonly<{
  ok: false;
  reason: ProviderKeyStoreRefusalReason;
  message: string;
}>;

export type PlatformSecureStorageAvailability =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      reason:
        | typeof PROVIDER_KEY_STORE_REFUSALS.unavailable
        | typeof PROVIDER_KEY_STORE_REFUSALS.locked
        | typeof PROVIDER_KEY_STORE_REFUSALS.unsupported
        | typeof PROVIDER_KEY_STORE_REFUSALS.failed;
      message: string;
    }>;

export type PlatformSecureStorage = Readonly<{
  availability(): PlatformSecureStorageAvailability;
  encrypt(plaintext: string): Uint8Array;
  decrypt(ciphertext: Uint8Array): string;
}>;

export type ProviderKeyStatus = Readonly<{
  ok: true;
  provider: DesktopByoProvider;
  keyStatus: "missing" | "configured";
}>;

export type ProviderKeyRead = Readonly<{
  ok: true;
  provider: DesktopByoProvider;
  key: string;
}>;

export type ProviderKeySaved = Readonly<{
  ok: true;
  provider: DesktopByoProvider;
  replaced: boolean;
}>;

export type ProviderKeyRemoved = Readonly<{
  ok: true;
  provider: DesktopByoProvider;
  removed: boolean;
}>;

export type ProviderKeyRemovable = Readonly<{
  ok: true;
  provider: DesktopByoProvider;
  removable: boolean;
}>;

export type ProviderKeyStore = Readonly<{
  status(provider: DesktopByoProvider): Promise<ProviderKeyStatus | ProviderKeyStoreRefusal>;
  read(provider: DesktopByoProvider): Promise<ProviderKeyRead | ProviderKeyStoreRefusal>;
  save(provider: DesktopByoProvider, key: string): Promise<ProviderKeySaved | ProviderKeyStoreRefusal>;
  remove(provider: DesktopByoProvider): Promise<ProviderKeyRemoved | ProviderKeyStoreRefusal>;
  removable(provider: DesktopByoProvider): Promise<ProviderKeyRemovable | ProviderKeyStoreRefusal>;
}>;

type ProviderKeyEnvelope = Readonly<{
  schemaVersion: 1;
  provider: DesktopByoProvider;
  ciphertext: string;
}>;

const ENVELOPE_SCHEMA_VERSION = 1 as const;
const MAX_KEY_LENGTH = 16_384;
const GROUP_AND_OTHER_MODE_BITS = 0o077;

/**
 * Whether `Stats.mode` carries a real POSIX permission set. Windows synthesizes
 * it from the read-only attribute alone — `0o666`, or `0o444` when read-only —
 * and `chmod` there toggles only that attribute, so an envelope this store wrote
 * itself would fail an owner-private assertion that the platform cannot express.
 * The Windows packaging root stages this exact runtime, so the assertion is made
 * where it means something and the file-type check carries every platform.
 */
function posixPermissions(): boolean {
  return process.platform !== "win32";
}

function refuse(
  reason: ProviderKeyStoreRefusalReason,
  message: string,
): ProviderKeyStoreRefusal {
  return Object.freeze({ ok: false as const, reason, message });
}

function validProvider(value: unknown): value is DesktopByoProvider {
  return (
    typeof value === "string" &&
    (DESKTOP_BYO_PROVIDERS as readonly string[]).includes(value)
  );
}

function validKey(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_KEY_LENGTH &&
    !value.includes("\0") &&
    !/[\r\n]/.test(value)
  );
}

function envelopeOf(value: unknown, provider: DesktopByoProvider): ProviderKeyEnvelope | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).length !== 3 ||
    row["schemaVersion"] !== ENVELOPE_SCHEMA_VERSION ||
    row["provider"] !== provider ||
    typeof row["ciphertext"] !== "string" ||
    row["ciphertext"].length === 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(row["ciphertext"])
  ) {
    return null;
  }
  return Object.freeze({
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    provider,
    ciphertext: row["ciphertext"],
  });
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

export type CreateProviderKeyStoreOptions = Readonly<{
  root: string;
  platformStorage: PlatformSecureStorage;
}>;

/**
 * Store one provider key as an OS-encrypted envelope under the desktop user-data
 * directory. The file contains ciphertext only and is replaced atomically.
 */
export function createProviderKeyStore(
  options: CreateProviderKeyStoreOptions,
): ProviderKeyStore {
  const pathFor = (provider: DesktopByoProvider): string =>
    join(options.root, `${provider}.v1.json`);

  const available = (): PlatformSecureStorageAvailability => {
    try {
      return options.platformStorage.availability();
    } catch {
      return Object.freeze({
        ok: false as const,
        reason: PROVIDER_KEY_STORE_REFUSALS.failed,
        message: "The platform secure-storage availability check failed.",
      });
    }
  };

  /**
   * The one thing deletion is allowed to learn about the envelope: whether the
   * path is a stored credential this store may safely unlink. `lstat` rather than
   * `stat`, so a symlink is a wrong type instead of a redirected delete, and —
   * where the platform has POSIX permissions — an owner-private check that
   * refuses a file this store cannot have written.
   */
  const inspectEnvelopeFile = (
    provider: DesktopByoProvider,
  ): Readonly<{ ok: true; present: boolean }> | ProviderKeyStoreRefusal => {
    let entry: Stats;
    try {
      entry = lstatSync(pathFor(provider));
    } catch (error) {
      if (isMissing(error)) return Object.freeze({ ok: true as const, present: false });
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.failed,
        "The stored provider credential path could not be inspected.",
      );
    }
    if (!entry.isFile()) {
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.corrupt,
        "The stored provider credential path is not a regular encrypted file.",
      );
    }
    if (posixPermissions() && (entry.mode & GROUP_AND_OTHER_MODE_BITS) !== 0) {
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.corrupt,
        "The stored provider credential file is not owner-private.",
      );
    }
    return Object.freeze({ ok: true as const, present: true });
  };

  const readEnvelope = (
    provider: DesktopByoProvider,
  ):
    | Readonly<{ ok: true; envelope: ProviderKeyEnvelope }>
    | Readonly<{ ok: true; envelope: null }>
    | ProviderKeyStoreRefusal => {
    try {
      const bytes = readFileSync(pathFor(provider), "utf8");
      const envelope = envelopeOf(JSON.parse(bytes), provider);
      return envelope === null
        ? refuse(
            PROVIDER_KEY_STORE_REFUSALS.corrupt,
            "The stored provider credential envelope is corrupt.",
          )
        : Object.freeze({ ok: true as const, envelope });
    } catch (error) {
      if (isMissing(error)) return Object.freeze({ ok: true as const, envelope: null });
      if (error instanceof SyntaxError) {
        return refuse(
          PROVIDER_KEY_STORE_REFUSALS.corrupt,
          "The stored provider credential envelope is corrupt.",
        );
      }
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.failed,
        "The encrypted provider credential could not be read.",
      );
    }
  };

  /**
   * The one decrypt-and-validate path. `status` projects presence from it and
   * `read` returns its plaintext, so a single refusal order — unsupported
   * provider, platform availability, envelope shape, decryption, plaintext
   * validation — governs both, and a retrieval costs one file read and one
   * platform decrypt.
   */
  const loadKey = (
    provider: DesktopByoProvider,
  ): Readonly<{ ok: true; key: string | null }> | ProviderKeyStoreRefusal => {
    if (!validProvider(provider)) {
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.providerUnsupported,
        "The requested BYOK provider is not supported by this desktop build.",
      );
    }
    const availability = available();
    if (!availability.ok) return availability;
    const stored = readEnvelope(provider);
    if (!stored.ok) return stored;
    if (stored.envelope === null) return Object.freeze({ ok: true as const, key: null });
    let key: string;
    try {
      key = options.platformStorage.decrypt(
        Buffer.from(stored.envelope.ciphertext, "base64"),
      );
    } catch {
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.corrupt,
        "The stored provider credential could not be decrypted by platform secure storage.",
      );
    }
    if (!validKey(key)) {
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.corrupt,
        "The stored provider credential could not be validated after secure retrieval.",
      );
    }
    return Object.freeze({ ok: true as const, key });
  };

  const status = async (
    provider: DesktopByoProvider,
  ): Promise<ProviderKeyStatus | ProviderKeyStoreRefusal> => {
    const loaded = loadKey(provider);
    if (!loaded.ok) return loaded;
    return Object.freeze({
      ok: true as const,
      provider,
      keyStatus: loaded.key === null ? "missing" as const : "configured" as const,
    });
  };

  const read = async (
    provider: DesktopByoProvider,
  ): Promise<ProviderKeyRead | ProviderKeyStoreRefusal> => {
    const loaded = loadKey(provider);
    if (!loaded.ok) return loaded;
    if (loaded.key === null) {
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.keyMissing,
        "No provider credential is stored for the selected provider.",
      );
    }
    return Object.freeze({ ok: true as const, provider, key: loaded.key });
  };

  const save = async (
    provider: DesktopByoProvider,
    key: string,
  ): Promise<ProviderKeySaved | ProviderKeyStoreRefusal> => {
    if (!validProvider(provider)) {
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.providerUnsupported,
        "The requested BYOK provider is not supported by this desktop build.",
      );
    }
    if (!validKey(key)) {
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.keyInvalid,
        "The provider credential is empty or has an unsupported shape.",
      );
    }
    const availability = available();
    if (!availability.ok) return availability;
    const current = readEnvelope(provider);
    if (!current.ok) return current;
    let ciphertext: Uint8Array;
    try {
      ciphertext = options.platformStorage.encrypt(key);
    } catch {
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.failed,
        "Platform secure storage could not encrypt the provider credential.",
      );
    }
    const target = pathFor(provider);
    const temporary = `${target}.replace`;
    try {
      mkdirSync(options.root, { recursive: true, mode: 0o700 });
      chmodSync(options.root, 0o700);
      writeFileSync(
        temporary,
        JSON.stringify({
          schemaVersion: ENVELOPE_SCHEMA_VERSION,
          provider,
          ciphertext: Buffer.from(ciphertext).toString("base64"),
        } satisfies ProviderKeyEnvelope),
        { encoding: "utf8", mode: 0o600 },
      );
      chmodSync(temporary, 0o600);
      renameSync(temporary, target);
      return Object.freeze({
        ok: true as const,
        provider,
        replaced: current.envelope !== null,
      });
    } catch {
      try {
        rmSync(temporary, { force: true });
      } catch {
        // The named refusal remains the only outward detail; cleanup is best effort.
      }
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.failed,
        "The encrypted provider credential could not be saved.",
      );
    }
  };

  const remove = async (
    provider: DesktopByoProvider,
  ): Promise<ProviderKeyRemoved | ProviderKeyStoreRefusal> => {
    if (!validProvider(provider)) {
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.providerUnsupported,
        "The requested BYOK provider is not supported by this desktop build.",
      );
    }
    const inspected = inspectEnvelopeFile(provider);
    if (!inspected.ok) return inspected;
    if (!inspected.present) {
      return Object.freeze({ ok: true as const, provider, removed: false });
    }
    try {
      rmSync(pathFor(provider));
    } catch (error) {
      if (isMissing(error)) {
        return Object.freeze({ ok: true as const, provider, removed: false });
      }
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.failed,
        "The encrypted provider credential could not be removed.",
      );
    }
    return Object.freeze({ ok: true as const, provider, removed: true });
  };

  const removable = async (
    provider: DesktopByoProvider,
  ): Promise<ProviderKeyRemovable | ProviderKeyStoreRefusal> => {
    if (!validProvider(provider)) {
      return refuse(
        PROVIDER_KEY_STORE_REFUSALS.providerUnsupported,
        "The requested BYOK provider is not supported by this desktop build.",
      );
    }
    const inspected = inspectEnvelopeFile(provider);
    if (!inspected.ok) return inspected;
    return Object.freeze({ ok: true as const, provider, removable: inspected.present });
  };

  return Object.freeze({ status, read, save, remove, removable });
}
