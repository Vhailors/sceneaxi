import { createHash } from "node:crypto";
import type { JsonObject, JsonValue } from "@sceneaxi/schemas";

export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${Array.from(value, (item) => canonicalJson(item)).join(",")}]`;
  }
  const object = value as { readonly [key: string]: JsonValue };
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key] ?? null)}`)
    .join(",")}}`;
}

export function snapshotJsonValue<Value>(value: Value): Value {
  if (Array.isArray(value)) {
    return Object.freeze(
      Array.from(value, (entry) => snapshotJsonValue(entry)),
    ) as Value;
  }
  if (value !== null && typeof value === "object") {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          snapshotJsonValue(entry),
        ]),
      ),
    ) as Value;
  }
  return value;
}

export function snapshotJsonObject<Value extends JsonObject>(
  value: Value,
): Value {
  return snapshotJsonValue(value);
}

export function digestJson(value: JsonValue) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function digestBytes(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
