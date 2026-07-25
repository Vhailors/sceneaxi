/** Types for the dependency-free deterministic ZIP writer in `zip.mjs`. */

export type ZipInputEntry = {
  readonly name: string;
  readonly data: Buffer | Uint8Array | string;
};

export type ZipDirectoryRecord = {
  readonly name: string;
  readonly method: number;
  readonly crc32: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly offset: number;
};

export function buildZip(entries: readonly ZipInputEntry[]): Buffer;

export function readZipCentralDirectory(archive: Buffer): ZipDirectoryRecord[];
