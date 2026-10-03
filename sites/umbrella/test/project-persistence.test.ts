import { describe, expect, it } from "vitest";
import { createProjectRecord, readProjectRecord, projectHref, projectStorageKey, saveProjectRecord, PROJECT_RECORD_MAX_BYTES } from "../src/app/editor/_components/project-persistence.js";

const owner = "preview-local";

const input = { owner, href: "/editor?tx-object-1=5%2C0%2C0&objects=3", documentDigest: "a".repeat(64), revision: 1 };

const memory = () => {
  const values = new Map<string, string>();

  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
};

describe("browser-owned editor checkpoint transport", () => {
  it("roundtrips bounded state with stable checksum and isolated profile/owner keys", async () => {
    const record = await createProjectRecord(input);
    expect(await readProjectRecord(JSON.stringify(record), owner)).toEqual(record);
    expect(record.href).toBe("/editor?objects=3&tx-object-1=5%2C0%2C0");
    expect(await projectStorageKey(owner, "game")).not.toBe(await projectStorageKey(owner, "web"));
    expect(await projectStorageKey(owner, "game")).not.toBe(await projectStorageKey("other", "game"));
    expect(await projectStorageKey(owner, "game")).not.toContain(owner);
  });
  it("rejects malformed, oversized, tampered, cross-owner and extra-field records", async () => {
    const record = await createProjectRecord(input);

    for (const text of ["{", "null", "[]", JSON.stringify({ ...record, href: "/editor?objects=4" }), JSON.stringify({ ...record, extra: "credential" }), JSON.stringify({ ...record, revision: Infinity })]) {
      await expect(readProjectRecord(text, owner)).rejects.toThrow();
    }

    await expect(readProjectRecord(JSON.stringify(record), "other")).rejects.toThrow("PROJECT_RECORD_INVALID");
    await expect(readProjectRecord("é".repeat(PROJECT_RECORD_MAX_BYTES / 2 + 1), owner)).rejects.toThrow("PROJECT_RECORD_TOO_LARGE");
    await expect(createProjectRecord({ ...input, revision: Number.MAX_SAFE_INTEGER + 1 })).rejects.toThrow();
  });
  it("rejects credentials, Kids, unknown fields, external destinations, duplicate fields and fragments", () => {
    for (const href of ["https://evil.invalid/editor", "//evil.invalid/editor", "/editor/evil", "/editor?session=secret", "/editor?profile=kids", "/editor?objects=2&objects=4", "/editor#x", "/editor?unknown=1"]) expect(() => projectHref(href)).toThrow();
    expect(projectHref("/editor?profile=web&web-html=%3Cp%3Ehello%3C%2Fp%3E&web-layout=hero")).toContain("web-html");
  });
  it("increments revisions atomically and keeps bytes unchanged on conflict or corrupt prior", async () => {
    const storage = memory(); const key = await projectStorageKey(owner, "game");
    const first = await createProjectRecord(input); await saveProjectRecord(storage, key, first);
    const before = storage.getItem(key);
    await expect(saveProjectRecord(storage, key, first)).rejects.toThrow("PROJECT_REVISION_CONFLICT"); expect(storage.getItem(key)).toBe(before);
    const next = await createProjectRecord({ ...input, revision: 2, href: "/editor?objects=4" });
    await saveProjectRecord(storage, key, next); expect(await readProjectRecord(storage.getItem(key) ?? "", owner)).toEqual(next);
    storage.setItem(key, "corrupt"); await expect(saveProjectRecord(storage, key, next)).rejects.toThrow(); expect(storage.getItem(key)).toBe("corrupt");
    storage.removeItem(key); expect(storage.getItem(key)).toBeNull();
    await expect(saveProjectRecord(storage, key, first, () => { throw new Error("PROJECT_PROFILE_CHANGED"); })).rejects.toThrow("PROJECT_PROFILE_CHANGED");
    expect(storage.getItem(key)).toBeNull();
  });
  it("keeps prior bytes on quota refusal and concurrent revision changes", async () => {
    const storage = memory();
    const key = await projectStorageKey(owner, "game");
    const first = await createProjectRecord(input);
    await saveProjectRecord(storage, key, first);
    const before = storage.getItem(key);
    const next = await createProjectRecord({ ...input, revision: 2 });
    const quotaStorage = { ...storage, setItem: () => { throw new Error("QuotaExceededError"); } };
    await expect(saveProjectRecord(quotaStorage, key, next)).rejects.toThrow("QuotaExceededError");
    expect(storage.getItem(key)).toBe(before);
    let reads = 0;

    const concurrent = { ...storage, getItem: (name: string) => {
      reads += 1;

      return reads === 1 ? storage.getItem(name) : "other-tab-record";
    } };

    await expect(saveProjectRecord(concurrent, key, next)).rejects.toThrow("PROJECT_REVISION_CONFLICT");
    expect(storage.getItem(key)).toBe(before);
  });
});
