export const safeStorage = Object.freeze({
  getSelectedStorageBackend: () => "kwallet6",
  isEncryptionAvailable: () => true,
  encryptString: (value: string) => Buffer.from(value),
  decryptString: (value: Uint8Array) => Buffer.from(value).toString("utf8"),
});
