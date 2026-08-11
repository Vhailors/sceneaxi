import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, relative, sep } from "node:path";

function within(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

export function openContainedRegularFile(root: string, target: string) {
  let descriptor: number | null = null;
  try {
    descriptor = openSync(
      target,
      constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW,
    );
    const stats = fstatSync(descriptor);
    if (!stats.isFile()) {
      return Object.freeze({
        ok: false as const,
        kind: "unsafe" as const,
        cause: "nonregular" as const,
        detail: "the opened path is not a regular file",
      });
    }
    const canonical = realpathSync(`/proc/self/fd/${String(descriptor)}`);
    if (!within(root, canonical)) {
      return Object.freeze({
        ok: false as const,
        kind: "unsafe" as const,
        cause: "outside" as const,
        detail: "the opened file resolves outside the project root",
      });
    }
    const openedDescriptor = descriptor;
    descriptor = null;
    return Object.freeze({
      ok: true as const,
      descriptor: openedDescriptor,
      stats,
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : null;
    return Object.freeze({
      ok: false as const,
      kind:
        code === "ENOENT"
          ? "missing" as const
          : code === "ELOOP"
            ? "unsafe" as const
            : "invalid" as const,
      cause: code === "ELOOP" ? "symlink" as const : null,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

export function readContainedRegularFile(
  root: string,
  target: string,
  limits: Readonly<{ maximumBytes?: number; expectedBytes?: number }> = {},
) {
  let descriptor: number | null = null;
  try {
    const opened = openContainedRegularFile(root, target);
    if (!opened.ok) return opened;
    descriptor = opened.descriptor;
    const before = opened.stats;
    if (
      !Number.isSafeInteger(before.size) ||
      before.size < 0 ||
      (limits.maximumBytes !== undefined && before.size > limits.maximumBytes) ||
      (limits.expectedBytes !== undefined && before.size !== limits.expectedBytes)
    ) {
      return Object.freeze({
        ok: false as const,
        kind: "invalid" as const,
        cause: null,
        detail: "the opened file length is outside its accepted bounds",
      });
    }
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = readSync(
        descriptor,
        bytes,
        offset,
        bytes.byteLength - offset,
        null,
      );
      if (count === 0) {
        return Object.freeze({
          ok: false as const,
          kind: "invalid" as const,
          cause: null,
          detail: "the opened file ended before its verified length",
        });
      }
      offset += count;
    }
    const trailing = Buffer.alloc(1);
    if (readSync(descriptor, trailing, 0, trailing.byteLength, null) !== 0) {
      return Object.freeze({
        ok: false as const,
        kind: "invalid" as const,
        cause: null,
        detail: "the opened file grew beyond its verified length",
      });
    }
    const after = fstatSync(descriptor);
    if (bytes.byteLength !== before.size || after.size !== before.size) {
      return Object.freeze({
        ok: false as const,
        kind: "invalid" as const,
        cause: null,
        detail: "the opened file length changed while it was being read",
      });
    }
    return Object.freeze({ ok: true as const, bytes });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : null;
    return Object.freeze({
      ok: false as const,
      kind:
        code === "ENOENT"
          ? "missing" as const
          : code === "ELOOP"
            ? "unsafe" as const
            : "invalid" as const,
      cause: code === "ELOOP" ? "symlink" as const : null,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch {
        // Best-effort cleanup cannot change the completed read result.
      }
    }
  }
}
