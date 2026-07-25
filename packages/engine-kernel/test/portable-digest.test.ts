/**
 * The portable digest is the kernel's browser barrier removal, so it is tested
 * against `node:crypto` as the oracle: any divergence would silently rewrite
 * every snapshot digest, save artifact, and checked-in golden.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { portableKernelDigest } from "@sceneaxi/engine-kernel";

const nodeDigest = (input: string) =>
  createHash("sha256").update(input, "utf8").digest("hex");

/** Lengths around every SHA-256 block/padding boundary, in bytes. */
const BOUNDARY_LENGTHS = [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 1000];

const VECTORS: readonly string[] = [
  "",
  "abc",
  "sceneaxi",
  "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
  "ünïcode ✓ 🎬 astral",
  "with\u0000embedded\u0000nul",
  '{"tick":3,"seed":4242,"entities":[{"id":"player","x":2,"y":0}]}',
  JSON.stringify({ nested: [1, 2, { deep: "value".repeat(200) }] }),
];

describe("portable kernel digest", () => {
  it("matches node:crypto sha256 for representative inputs", () => {
    for (const vector of VECTORS) {
      expect(portableKernelDigest(vector)).toBe(nodeDigest(vector));
    }
  });

  it("matches node:crypto sha256 across block and padding boundaries", () => {
    for (const length of BOUNDARY_LENGTHS) {
      const ascii = "a".repeat(length);
      expect(portableKernelDigest(ascii)).toBe(nodeDigest(ascii));
      // Multi-byte characters make the encoded length differ from the char count.
      const multibyte = "é".repeat(length);
      expect(portableKernelDigest(multibyte)).toBe(nodeDigest(multibyte));
    }
  });

  it("reproduces the published empty-string and abc vectors", () => {
    expect(portableKernelDigest("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(portableKernelDigest("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("returns 64 lowercase hex characters", () => {
    for (const vector of VECTORS) {
      expect(portableKernelDigest(vector)).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("derives the same leading uint32 the kernel seeds instances with", () => {
    for (const vector of VECTORS) {
      const expected = createHash("sha256").update(vector).digest().readUInt32BE(0);
      expect(Number.parseInt(portableKernelDigest(vector).slice(0, 8), 16)).toBe(
        expected,
      );
    }
  });

  it("refuses a non-string input", () => {
    expect(() => portableKernelDigest(7 as unknown as string)).toThrow(
      /digest input must be a string/,
    );
  });
});
