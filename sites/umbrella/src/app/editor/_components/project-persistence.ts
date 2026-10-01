/** Browser-owned checkpoints of the existing deterministic editor transport.
 * No account/cloud storage, authority, scene parser, or session credential lives here.
 * The public /editor front door must reconstruct and verify a record before import.
 */
export const PROJECT_RECORD_MAX_BYTES = 16 * 1024;

export type LocalProject = Readonly<{
  version: 1;
  owner: string;
  revision: number;
  href: string;
  documentDigest: string;
  checksum: string;
}>;

export type ProjectStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type ProjectJson = string | number | boolean | null | readonly ProjectJson[] | ProjectFields;

type ProjectFields = { readonly [key: string]: ProjectJson };

function isFields(value: unknown): value is ProjectFields { return value !== null && typeof value === "object" && !Array.isArray(value); }

function isString(value: unknown): value is string { return typeof value === "string"; }

function isNumber(value: unknown): value is number { return typeof value === "number"; }

const HASH = /^[a-f0-9]{64}$/;

const FIELDS = /^(?:sel|objects|play|mode|profile|source|item|artifact|tx-object-[1-4]|web-(?:title|layout|html|asset|three))$/;

export function projectHref(href: string): string {
  if (!href.startsWith("/editor") || href.length > 8192) throw new Error("PROJECT_LINK_INVALID");
  const url = new URL(href, "https://local.invalid");

  if (url.origin !== "https://local.invalid" || url.pathname !== "/editor" || url.hash !== "") {
    throw new Error("PROJECT_LINK_INVALID");
  }

  for (const key of url.searchParams.keys()) {
    if (!FIELDS.test(key) || url.searchParams.getAll(key).length !== 1) throw new Error("PROJECT_LINK_INVALID");
  }

  if (url.searchParams.get("profile") === "kids") throw new Error("PROJECT_KIDS_REFUSED");
  url.searchParams.sort();

  return `${url.pathname}${url.search}`;
}

async function digest(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));

  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const payload = (record: Omit<LocalProject, "checksum">): string => JSON.stringify({
  version: record.version, owner: record.owner, revision: record.revision,
  href: record.href, documentDigest: record.documentDigest,
});

export async function projectStorageKey(owner: string, profile: "game" | "web"): Promise<string> {
  return `sceneaxi.editor-project.v1.${await digest(owner)}.${profile}`;
}

export async function createProjectRecord(input: Omit<LocalProject, "version" | "checksum">): Promise<LocalProject> {
  if (input.owner.length === 0 || input.owner.length > 256 || !Number.isSafeInteger(input.revision) || input.revision < 1 || !HASH.test(input.documentDigest)) {
    throw new Error("PROJECT_RECORD_INVALID");
  }

  const record = { version: 1 as const, ...input, href: projectHref(input.href) };
  const checksum = await digest(payload(record));

  return Object.freeze({ ...record, checksum });
}

export async function readProjectRecord(text: string, owner: string): Promise<LocalProject> {
  if (new TextEncoder().encode(text).length > PROJECT_RECORD_MAX_BYTES) throw new Error("PROJECT_RECORD_TOO_LARGE");
  let value: unknown;

  try { value = JSON.parse(text); } catch { throw new Error("PROJECT_RECORD_INVALID"); }

  if (!isFields(value)) throw new Error("PROJECT_RECORD_INVALID");
  const record = value;

  if (Object.keys(record).sort().join(",") !== "checksum,documentDigest,href,owner,revision,version" || record["version"] !== 1 || record["owner"] !== owner || !isString(record["href"]) || !isString(record["documentDigest"]) || !isNumber(record["revision"]) || !isString(record["checksum"])) {
    throw new Error("PROJECT_RECORD_INVALID");
  }

  const verified = await createProjectRecord({ owner, href: record["href"], documentDigest: record["documentDigest"], revision: record["revision"] });

  if (verified.checksum !== record["checksum"] || verified.href !== record["href"]) throw new Error("PROJECT_CHECKSUM_MISMATCH");

  return verified;
}

export async function saveProjectRecord(storage: ProjectStorage, key: string, record: LocalProject, beforeWrite: () => void = () => undefined): Promise<void> {
  // A single bounded record is an atomic localStorage replacement. No partial writes.
  const prior = storage.getItem(key);

  if (prior !== null) {
    const previous = await readProjectRecord(prior, record.owner);

    if (record.revision !== previous.revision + 1) throw new Error("PROJECT_REVISION_CONFLICT");
  } else if (record.revision !== 1) throw new Error("PROJECT_REVISION_CONFLICT");
  const verified = await readProjectRecord(JSON.stringify(record), record.owner);

  // Detect a competing tab while checksum verification was asynchronous.
  if (storage.getItem(key) !== prior) throw new Error("PROJECT_REVISION_CONFLICT");
  beforeWrite();
  storage.setItem(key, JSON.stringify(verified));
}

/** Read-only reconstruction through the existing access-gated server; never a mutation. */
export async function verifyProjectReconstruction(record: LocalProject, read: typeof fetch = fetch): Promise<void> {
  const response = await read(record.href, { cache: "no-store", redirect: "error" });

  if (!response.ok) throw new Error("PROJECT_RECONSTRUCTION_REFUSED");
  const html = await response.text();

  if (html.length > 2 * 1024 * 1024) throw new Error("PROJECT_RECONSTRUCTION_REFUSED");
  const marker = new DOMParser().parseFromString(html, "text/html").querySelector("[data-editor-project-digest]");

  if (marker?.getAttribute("data-editor-project-digest") !== record.documentDigest || marker.getAttribute("data-editor-project-owner") !== record.owner) throw new Error("PROJECT_RECONSTRUCTION_REFUSED");
}
