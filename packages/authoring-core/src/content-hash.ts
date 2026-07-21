/**
 * Content hashes for text-canonical documents (E1 conflict detection).
 */

import { createHash } from "node:crypto";
import { CONTENT_HASH_PREFIX } from "@sceneaxi/schemas";

/** sha256:hex of exact utf8 document bytes. */
export function contentHash(text: string): string {
  const digest = createHash("sha256").update(text, "utf8").digest("hex");
  return `${CONTENT_HASH_PREFIX}${digest}`;
}
