/**
 * Minimal RFC 6901 JSON Pointer get/set for propose/apply.
 * Empty pointer addresses the whole document.
 */

export type PointerGetOk = { readonly ok: true; readonly value: unknown };
export type PointerGetFail = {
  readonly ok: false;
  readonly code: "invalid-pointer" | "path-not-found";
  readonly message: string;
};
export type PointerGetResult = PointerGetOk | PointerGetFail;

export type PointerSetOk = { readonly ok: true; readonly value: unknown };
export type PointerSetFail = {
  readonly ok: false;
  readonly code: "invalid-pointer" | "path-not-found";
  readonly message: string;
};
export type PointerSetResult = PointerSetOk | PointerSetFail;

function unescapeToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

/** Split a pointer into unescaped tokens. Empty string → []. */
export function pointerTokens(pointer: string): string[] | null {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) return null;
  if (/(?:~(?![01]))/.test(pointer)) return null;
  // Split on unescaped '/' — RFC 6901 segments cannot contain raw '/'.
  return pointer
    .slice(1)
    .split("/")
    .map((t) => unescapeToken(t));
}

export function getAtPointer(
  document: unknown,
  pointer: string,
): PointerGetResult {
  const tokens = pointerTokens(pointer);
  if (tokens === null) {
    return {
      ok: false,
      code: "invalid-pointer",
      message: `Invalid JSON Pointer: ${JSON.stringify(pointer)}`,
    };
  }

  let current: unknown = document;
  for (const token of tokens) {
    if (current === null || typeof current !== "object") {
      return {
        ok: false,
        code: "path-not-found",
        message: `JSON Pointer path not found: ${JSON.stringify(pointer)}`,
      };
    }
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(token)) {
        return {
          ok: false,
          code: "path-not-found",
          message: `JSON Pointer array index invalid at ${JSON.stringify(token)}`,
        };
      }
      const index = Number(token);
      if (index < 0 || index >= current.length) {
        return {
          ok: false,
          code: "path-not-found",
          message: `JSON Pointer path not found: ${JSON.stringify(pointer)}`,
        };
      }
      current = current[index];
      continue;
    }
    const obj = current as Record<string, unknown>;
    if (!Object.hasOwn(obj, token)) {
      return {
        ok: false,
        code: "path-not-found",
        message: `JSON Pointer path not found: ${JSON.stringify(pointer)}`,
      };
    }
    current = obj[token];
  }
  return { ok: true, value: current };
}

/**
 * Return a deep-cloned document with the value at `pointer` replaced.
 * Does not create missing intermediate paths (fail-closed).
 */
export function setAtPointer(
  document: unknown,
  pointer: string,
  newValue: unknown,
): PointerSetResult {
  const tokens = pointerTokens(pointer);
  if (tokens === null) {
    return {
      ok: false,
      code: "invalid-pointer",
      message: `Invalid JSON Pointer: ${JSON.stringify(pointer)}`,
    };
  }

  if (tokens.length === 0) {
    return { ok: true, value: newValue };
  }

  const root = structuredClone(document) as unknown;

  let parent: unknown = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    if (token === undefined) {
      return {
        ok: false,
        code: "invalid-pointer",
        message: `Invalid JSON Pointer: ${JSON.stringify(pointer)}`,
      };
    }
    if (parent === null || typeof parent !== "object") {
      return {
        ok: false,
        code: "path-not-found",
        message: `JSON Pointer path not found: ${JSON.stringify(pointer)}`,
      };
    }
    if (Array.isArray(parent)) {
      if (!/^(0|[1-9][0-9]*)$/.test(token)) {
        return {
          ok: false,
          code: "path-not-found",
          message: `JSON Pointer array index invalid at ${JSON.stringify(token)}`,
        };
      }
      const index = Number(token);
      if (index < 0 || index >= parent.length) {
        return {
          ok: false,
          code: "path-not-found",
          message: `JSON Pointer path not found: ${JSON.stringify(pointer)}`,
        };
      }
      parent = parent[index];
      continue;
    }
    const obj = parent as Record<string, unknown>;
    if (!Object.hasOwn(obj, token)) {
      return {
        ok: false,
        code: "path-not-found",
        message: `JSON Pointer path not found: ${JSON.stringify(pointer)}`,
      };
    }
    parent = obj[token];
  }

  const last = tokens[tokens.length - 1];
  if (last === undefined) {
    return {
      ok: false,
      code: "invalid-pointer",
      message: `Invalid JSON Pointer: ${JSON.stringify(pointer)}`,
    };
  }

  if (parent === null || typeof parent !== "object") {
    return {
      ok: false,
      code: "path-not-found",
      message: `JSON Pointer path not found: ${JSON.stringify(pointer)}`,
    };
  }

  if (Array.isArray(parent)) {
    if (!/^(0|[1-9][0-9]*)$/.test(last)) {
      return {
        ok: false,
        code: "path-not-found",
        message: `JSON Pointer array index invalid at ${JSON.stringify(last)}`,
      };
    }
    const index = Number(last);
    if (index < 0 || index >= parent.length) {
      return {
        ok: false,
        code: "path-not-found",
        message: `JSON Pointer path not found: ${JSON.stringify(pointer)}`,
      };
    }
    parent[index] = newValue;
    return { ok: true, value: root };
  }

  const obj = parent as Record<string, unknown>;
  if (!Object.hasOwn(obj, last)) {
    return {
      ok: false,
      code: "path-not-found",
      message: `JSON Pointer path not found: ${JSON.stringify(pointer)}`,
    };
  }
  obj[last] = newValue;
  return { ok: true, value: root };
}
