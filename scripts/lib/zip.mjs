/**
 * Deterministic, dependency-free ZIP writer.
 *
 * Determinism is the point: the engine SDK archive is served publicly by the
 * umbrella site *and* built independently in CI, and the published checksum is only
 * meaningful if both produce the same bytes. So entries are sorted, timestamps are
 * fixed, permissions are fixed, and compression is a fixed-level `deflateRaw`.
 *
 * Plain ESM with no dependencies and no TypeScript build step, so a Vercel build can
 * run it straight from a site root without waiting on `tsc`.
 *
 * Scope: regular files only, no directory entries, no ZIP64, no encryption. That is
 * all an SDK source archive needs, and refusing anything else keeps the writer
 * small enough to audit.
 */
import { crc32, deflateRawSync } from "node:zlib";

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;

/** Fixed MS-DOS timestamp: 1980-01-01 00:00:00, the earliest ZIP can express. */
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

const VERSION_NEEDED = 20;
/** Unix (3) << 8 | version 20, so external attributes are read as unix modes. */
const VERSION_MADE_BY = (3 << 8) | 20;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;
/** 0100644 regular file, rw-r--r-- — fixed so the archive never carries local umask. */
const EXTERNAL_ATTRIBUTES = (0o100644 << 16) >>> 0;
const DEFLATE_LEVEL = 9;

const ZIP64_LIMIT = 0xffffffff;
const MAX_ENTRIES = 0xffff;

/**
 * Build a ZIP archive.
 *
 * @param {ReadonlyArray<{ name: string, data: Buffer | Uint8Array | string }>} entries
 * @returns {Buffer}
 */
export function buildZip(entries) {
  if (!Array.isArray(entries)) throw new TypeError("zip: entries must be an array");
  if (entries.length === 0) throw new Error("zip: refusing to build an empty archive");
  if (entries.length > MAX_ENTRIES) {
    throw new Error(`zip: ${entries.length} entries exceeds the non-ZIP64 limit of ${MAX_ENTRIES}`);
  }

  const normalized = entries.map((entry) => {
    const name = normalizeEntryName(entry?.name);
    const data = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(entry.data instanceof Uint8Array ? entry.data : String(entry.data), "utf8");
    if (data.length > ZIP64_LIMIT) {
      throw new Error(`zip: entry '${name}' exceeds the non-ZIP64 size limit`);
    }
    return { name, data };
  });

  const seen = new Set();
  for (const entry of normalized) {
    if (seen.has(entry.name)) throw new Error(`zip: duplicate entry name '${entry.name}'`);
    seen.add(entry.name);
  }

  // Sorted by byte order, so archive order never depends on filesystem order.
  normalized.sort((a, b) => (Buffer.from(a.name) < Buffer.from(b.name) ? -1 : 1));

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of normalized) {
    const nameBytes = Buffer.from(entry.name, "utf8");
    const checksum = crc32(entry.data) >>> 0;
    // Store when deflate does not actually help, so tiny files stay byte-stable
    // rather than depending on zlib's behaviour at the margin.
    const deflated = entry.data.length === 0 ? null : deflateRawSync(entry.data, { level: DEFLATE_LEVEL });
    const useDeflate = deflated !== null && deflated.length < entry.data.length;
    const method = useDeflate ? METHOD_DEFLATE : METHOD_STORE;
    const payload = useDeflate ? deflated : entry.data;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_HEADER_SIGNATURE, 0);
    local.writeUInt16LE(VERSION_NEEDED, 4);
    local.writeUInt16LE(0, 6); // flags: no encryption, no data descriptor
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28); // extra field length
    localParts.push(local, nameBytes, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_HEADER_SIGNATURE, 0);
    central.writeUInt16LE(VERSION_MADE_BY, 4);
    central.writeUInt16LE(VERSION_NEEDED, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE(EXTERNAL_ATTRIBUTES, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);

    offset += local.length + nameBytes.length + payload.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  if (offset > ZIP64_LIMIT || centralDirectory.length > ZIP64_LIMIT) {
    throw new Error("zip: archive exceeds the non-ZIP64 offset limit");
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIGNATURE, 0);
  eocd.writeUInt16LE(0, 4); // this disk
  eocd.writeUInt16LE(0, 6); // disk with central directory
  eocd.writeUInt16LE(normalized.length, 8);
  eocd.writeUInt16LE(normalized.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

/**
 * Read back the central directory of an archive this writer produced.
 *
 * Kept beside the writer so tests verify structure through an independent parse
 * rather than trusting the writer's own bookkeeping.
 *
 * @param {Buffer} archive
 * @returns {Array<{ name: string, method: number, crc32: number, compressedSize: number, size: number, offset: number }>}
 */
export function readZipCentralDirectory(archive) {
  if (!Buffer.isBuffer(archive)) throw new TypeError("zip: archive must be a Buffer");
  let eocdOffset = -1;
  for (let index = archive.length - 22; index >= 0; index -= 1) {
    if (archive.readUInt32LE(index) === EOCD_SIGNATURE) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("zip: no end-of-central-directory record found");

  const count = archive.readUInt16LE(eocdOffset + 10);
  let cursor = archive.readUInt32LE(eocdOffset + 16);
  const records = [];
  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(cursor) !== CENTRAL_HEADER_SIGNATURE) {
      throw new Error(`zip: bad central directory signature at entry ${index}`);
    }
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    records.push({
      name: archive.toString("utf8", cursor + 46, cursor + 46 + nameLength),
      method: archive.readUInt16LE(cursor + 10),
      crc32: archive.readUInt32LE(cursor + 16) >>> 0,
      compressedSize: archive.readUInt32LE(cursor + 20),
      size: archive.readUInt32LE(cursor + 24),
      offset: archive.readUInt32LE(cursor + 42),
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return records;
}

function normalizeEntryName(name) {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("zip: every entry needs a non-empty name");
  }
  const normalized = name.split("\\").join("/");
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) {
    throw new Error(`zip: refusing absolute entry name '${name}'`);
  }
  if (normalized.split("/").includes("..")) {
    throw new Error(`zip: refusing entry name that escapes the archive root '${name}'`);
  }
  return normalized;
}
