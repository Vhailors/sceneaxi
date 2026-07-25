/**
 * Session token digests.
 *
 * Only the digest is ever stored, so a leaked session table cannot be replayed
 * as a set of credentials. Comparison is constant-time over fixed-width
 * buffers: a byte-by-byte early return would leak how much of a guessed token
 * was correct, which is enough to walk a token out one byte at a time.
 */

import { createHash, timingSafeEqual } from "node:crypto";

/** Width of a SHA-256 hex digest. Part of the session contract. */
export const SESSION_TOKEN_DIGEST_LENGTH = 64 as const;

const HEX_DIGEST_RE = /^[0-9a-f]{64}$/;

/** SHA-256 hex digest of a session token. */
export function digestSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Constant-time comparison of a presented token against a stored digest.
 *
 * The stored digest's *format* is checked first and can short-circuit — that is
 * a property of data we already hold, not of the presented secret. Once both
 * sides are 32-byte buffers the comparison itself is timing-safe.
 */
export function sessionTokenMatches(
  token: unknown,
  storedDigest: unknown,
): boolean {
  if (typeof storedDigest !== "string" || !HEX_DIGEST_RE.test(storedDigest)) {
    return false;
  }
  if (typeof token !== "string" || token.length === 0) return false;

  const presented = Buffer.from(digestSessionToken(token), "hex");
  const stored = Buffer.from(storedDigest, "hex");
  if (presented.length !== stored.length) return false;
  return timingSafeEqual(presented, stored);
}
