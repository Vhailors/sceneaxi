export type UnambiguousJsonParseResult =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{
      ok: false;
      code: "parse-error";
      message: string;
    }>
  | Readonly<{
      ok: false;
      code: "duplicate-json-member";
      path: string;
      message: string;
    }>;

type JsonToken =
  | {
      readonly kind: "punctuation";
      readonly value: "{" | "}" | "[" | "]" | ":" | ",";
    }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "primitive" };

type JsonObjectFrame = {
  readonly kind: "object";
  readonly path: string;
  readonly keys: Set<string>;
  state: "key-or-end" | "colon" | "value" | "comma-or-end";
  pendingKey: string | null;
};

type JsonArrayFrame = {
  readonly kind: "array";
  readonly path: string;
  state: "value-or-end" | "comma-or-end";
  index: number;
};

type JsonContainerFrame = JsonObjectFrame | JsonArrayFrame;

function nextJsonToken(
  text: string,
  start: number,
): { readonly token: JsonToken; readonly nextIndex: number } | null {
  let index = start;
  while (
    text[index] === " " ||
    text[index] === "\t" ||
    text[index] === "\n" ||
    text[index] === "\r"
  ) {
    index += 1;
  }
  if (index >= text.length) return null;

  const character = text[index];
  if (
    character === "{" ||
    character === "}" ||
    character === "[" ||
    character === "]" ||
    character === ":" ||
    character === ","
  ) {
    return {
      token: { kind: "punctuation", value: character } satisfies JsonToken,
      nextIndex: index + 1,
    };
  }

  if (character === '"') {
    let cursor = index + 1;
    while (cursor < text.length) {
      if (text[cursor] === "\\") {
        cursor += 2;
      } else if (text[cursor] === '"') {
        const raw = text.slice(index, cursor + 1);
        const value = JSON.parse(raw) as unknown;
        if (typeof value !== "string") return null;
        return {
          token: { kind: "string", value } satisfies JsonToken,
          nextIndex: cursor + 1,
        };
      } else {
        cursor += 1;
      }
    }
    return null;
  }

  let cursor = index + 1;
  while (
    cursor < text.length &&
    text[cursor] !== " " &&
    text[cursor] !== "\t" &&
    text[cursor] !== "\n" &&
    text[cursor] !== "\r" &&
    text[cursor] !== "{" &&
    text[cursor] !== "}" &&
    text[cursor] !== "[" &&
    text[cursor] !== "]" &&
    text[cursor] !== ":" &&
    text[cursor] !== ","
  ) {
    cursor += 1;
  }
  return {
    token: { kind: "primitive" } satisfies JsonToken,
    nextIndex: cursor,
  };
}

function jsonMemberPath(parent: string, member: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(member)
    ? `${parent}.${member}`
    : `${parent}[${JSON.stringify(member)}]`;
}

function findDuplicateJsonMember(text: string) {
  const stack: JsonContainerFrame[] = [];
  let index = 0;
  let rootConsumed = false;

  const beginValue = (token: JsonToken, path: string) => {
    if (token.kind !== "punctuation") return;
    if (token.value === "{") {
      stack.push({
        kind: "object",
        path,
        keys: new Set<string>(),
        state: "key-or-end",
        pendingKey: null,
      });
    } else if (token.value === "[") {
      stack.push({ kind: "array", path, state: "value-or-end", index: 0 });
    }
  };

  while (true) {
    const next = nextJsonToken(text, index);
    if (next === null) return null;
    index = next.nextIndex;
    const token = next.token;
    const frame = stack.at(-1);

    if (frame === undefined) {
      if (rootConsumed) return null;
      rootConsumed = true;
      beginValue(token, "$");
      continue;
    }

    if (frame.kind === "object") {
      if (frame.state === "key-or-end") {
        if (token.kind === "punctuation" && token.value === "}") {
          stack.pop();
          continue;
        }
        if (token.kind !== "string") return null;
        const path = jsonMemberPath(frame.path, token.value);
        if (frame.keys.has(token.value)) return path;
        frame.keys.add(token.value);
        frame.pendingKey = token.value;
        frame.state = "colon";
      } else if (frame.state === "colon") {
        frame.state = "value";
      } else if (frame.state === "value") {
        if (frame.pendingKey === null) return null;
        const path = jsonMemberPath(frame.path, frame.pendingKey);
        frame.pendingKey = null;
        frame.state = "comma-or-end";
        beginValue(token, path);
      } else if (token.kind === "punctuation" && token.value === ",") {
        frame.state = "key-or-end";
      } else {
        stack.pop();
      }
      continue;
    }

    if (frame.state === "value-or-end") {
      if (token.kind === "punctuation" && token.value === "]") {
        stack.pop();
        continue;
      }
      const path = `${frame.path}[${frame.index}]`;
      frame.index += 1;
      frame.state = "comma-or-end";
      beginValue(token, path);
    } else if (token.kind === "punctuation" && token.value === ",") {
      frame.state = "value-or-end";
    } else {
      stack.pop();
    }
  }
}

export function parseUnambiguousJson(
  text: string,
): UnambiguousJsonParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    return Object.freeze({
      ok: false,
      code: "parse-error",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const duplicateMemberPath = findDuplicateJsonMember(text);
  if (duplicateMemberPath !== null) {
    return Object.freeze({
      ok: false,
      code: "duplicate-json-member",
      path: duplicateMemberPath,
      message: "Duplicate JSON member names are refused.",
    });
  }

  return Object.freeze({ ok: true, value });
}
