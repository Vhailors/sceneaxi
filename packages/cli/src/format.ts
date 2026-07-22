/**
 * Axi-style typed/counted text rendering with strict `--json` equivalence.
 *
 * Both formats are projections of the same {@link CliEnvelope}: `--json`
 * emits the envelope as JSON; default text is a deterministic, token-efficient
 * rendering of the same data (counts on arrays as `key[n]:`).
 */

import type { CliEnvelope, CliOutcome } from "./envelope.js";

export type OutputFormat = "text" | "json";

export function formatOutcome(
  outcome: CliOutcome,
  format: OutputFormat,
): string {
  if (format === "json") {
    return `${JSON.stringify(outcome.envelope, null, 2)}\n`;
  }
  return `${renderText(outcome.envelope)}\n`;
}

/** Deterministic text projection of an envelope (axi-style counts). */
export function renderText(envelope: CliEnvelope): string {
  const lines: string[] = [];
  lines.push(`ok: ${envelope.ok}`);
  lines.push(`schemaVersion: ${envelope.schemaVersion}`);
  lines.push(`cliVersion: ${envelope.cliVersion}`);

  if (envelope.ok) {
    lines.push("result:");
    lines.push(...indent(renderValue(envelope.result, 0), 1));
  } else {
    lines.push("error:");
    lines.push(...indent(renderValue(envelope.error, 0), 1));
  }

  lines.push(...renderHelp(envelope.help));
  return lines.join("\n");
}

function renderHelp(help: readonly string[]): string[] {
  if (help.length === 0) {
    return ["help[0]:"];
  }
  const lines = [`help[${help.length}]:`];
  for (const item of help) {
    lines.push(`  ${item}`);
  }
  return lines;
}

function renderValue(value: unknown, depth: number): string[] {
  if (value === null) return ["null"];
  if (typeof value === "string") return [JSON.stringify(value)];
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return ["[]"];
    if (value.every((v) => isScalar(v))) {
      return [value.map((v) => formatScalar(v)).join(", ")];
    }
    const lines: string[] = [];
    value.forEach((item, i) => {
      const rendered = renderValue(item, depth + 1);
      if (rendered.length === 1) {
        lines.push(`- ${rendered[0]}`);
      } else {
        lines.push(`- ${rendered[0]}`);
        lines.push(...indent(rendered.slice(1), 1));
      }
      void i;
    });
    return lines;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return ["{}"];
    const lines: string[] = [];
    for (const [key, child] of entries) {
      if (Array.isArray(child)) {
        lines.push(`${key}[${child.length}]:`);
        if (child.length === 0) continue;
        if (child.every((v) => isScalar(v))) {
          for (const item of child) {
            lines.push(`  ${formatScalar(item)}`);
          }
        } else {
          lines.push(...indent(renderValue(child, depth + 1), 1));
        }
        continue;
      }
      if (child !== null && typeof child === "object") {
        lines.push(`${key}:`);
        lines.push(...indent(renderValue(child, depth + 1), 1));
        continue;
      }
      lines.push(`${key}: ${formatScalar(child)}`);
    }
    return lines;
  }
  return [String(value)];
}

function isScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function formatScalar(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null) return "null";
  return String(value);
}

function indent(lines: string[], levels: number): string[] {
  const pad = "  ".repeat(levels);
  return lines.map((l) => `${pad}${l}`);
}
