import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const stringGuard = 'function guard(value: unknown): value is string { return typeof value === "string"; }';
const cases = [
  ["primitive predicate", stringGuard, []],
  ["async predicate decoder", 'async function guard(value: unknown): value is string { return typeof value === "string"; } function decode(value: unknown): string | null { return guard(value) ? value : null; }', ["no-runtime-typeof", "no-unknown-parameters"]],
  ["generator predicate decoder", 'function* guard(value: unknown): value is string { return typeof value === "string"; } function decode(value: unknown): string | null { return guard(value) ? value : null; }', ["no-runtime-typeof", "no-unknown-parameters"]],
  ["async arrow predicate", 'const guard = async (value: unknown): value is string => typeof value === "string";', ["no-runtime-typeof"]],
  ["async expression predicate", 'const guard = async function(value: unknown): value is string { return typeof value === "string"; };', ["no-runtime-typeof"]],
  ["async decoder", stringGuard + ' async function decode(value: unknown): string | null { return guard(value) ? value : null; }', ["no-unknown-parameters"]],
  ["generator decoder", stringGuard + ' function* decode(value: unknown): string | null { return guard(value) ? value : null; }', ["no-unknown-parameters"]],
  ["finite predicate", 'function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }', []],
  ["optional raw object shell", 'function raw(value: unknown): value is Readonly<{ field?: unknown }> { return typeof value === "object" && value !== null && !Array.isArray(value); }', []],
  ["checked same-input decoder", stringGuard + ' function decode(value: unknown): string | null { return guard(value) ? value : null; }', []],
  ["renamed checked decoder", stringGuard.replaceAll('guard', 'arbitrary') + ' function unrelatedName(value: unknown): string | null { return arbitrary(value) ? value : null; }', []],
  ["option remains opt-in", stringGuard, ["no-runtime-typeof"], false],
  ["boolean predicate", 'function guard(value: unknown): value is boolean { return typeof value === "boolean"; }', []],
  ["arrow predicate", 'const guard = (value: unknown): value is string => typeof value === "string";', []],
  ["function expression predicate", 'const guard = function(value: unknown): value is string { return typeof value === "string"; };', []],
  ["reassigned validator", stringGuard + ' guard = () => true; function decode(value: unknown): string | null { return guard(value) ? value : null; }', ["no-unknown-parameters"]],
  ["contract mismatch", stringGuard + ' function decode(value: unknown): number | null { return guard(value) ? value : null; }', ["no-unknown-parameters"]],
  ["shadowed Readonly", 'type Readonly<T> = { required: string }; function raw(value: unknown): value is Readonly<{ field?: unknown }> { return typeof value === "object" && value !== null && !Array.isArray(value); }', ["no-runtime-typeof"]],
  ["unchecked default return", stringGuard + ' function decode(value: unknown): string | null { if (value === null) return unsafeFactory(); return guard(value) ? value : null; }', ["no-unknown-parameters"]],
  ["generic unknown", 'function consume(value: unknown): void {}', ["no-unknown-parameters"]],
  ["cause existing exemption", 'function enrich(cause: unknown): void {}', []],
  ["representation only", 'function consume(value: string): boolean { return typeof value === "string"; }', ["no-runtime-typeof"]],
  ["unrelated typeof in predicate", 'function guard(value: unknown): value is string { return typeof other === "string"; }', ["no-runtime-typeof"]],
  ["unrelated predicate statement", 'function guard(value: unknown): value is string { const unused = typeof other; return typeof value === "string"; }', ["no-runtime-typeof"]],
  ["lying domain predicate", 'function guard(value: unknown): value is { required: string } { return typeof value === "object"; }', ["no-runtime-typeof"]],
  ["inverted predicate", 'function guard(value: unknown): value is string { return typeof value !== "string"; }', ["no-runtime-typeof"]],
  ["alternate unchecked predicate", 'function guard(value: unknown): value is string { return typeof value === "string" || true; }', ["no-runtime-typeof"]],
  ["always-true decoder", 'function guard(value: unknown): value is string { return true; } function decode(value: unknown): string | null { return guard(value) ? value : null; }', ["no-unknown-parameters"]],
  ["shadowed validator", stringGuard + ' function decode(value: unknown): string | null { const guard = (other: string) => true; return guard(value) ? value : null; }', ["no-unknown-parameters"]],
  ["imported unverifiable validator", 'import { guard } from "external"; function decode(value: unknown): string | null { return guard(value) ? value : null; }', ["no-unknown-parameters"]],
  ["wrong validated input", stringGuard + ' function decode(value: unknown): string | null { return guard(other) ? value : null; }', ["no-unknown-parameters"]],
  ["wrong return input", stringGuard + ' function decode(value: unknown): string | null { return guard(value) ? other : null; }', ["no-unknown-parameters"]],
  ["unchecked decoder return", stringGuard + ' function decode(value: unknown): string | null { return value; }', ["no-unknown-parameters"]],
  ["unchecked alternate branch", stringGuard + ' function decode(value: unknown): string | null { return guard(value) ? value : other; }', ["no-unknown-parameters"]],
  ["pre-validation property access", stringGuard + ' function decode(value: unknown): string | null { const observed = value.field; return guard(value) ? value : null; }', ["no-unknown-parameters"]],
  ["unchecked parse assertion", 'function parseAnything(value: unknown): string | null { return value as string; }', ["no-unknown-parameters"]],
  ["modified subject", 'function guard(value: unknown): value is string { return typeof (value = "accepted") === "string"; } function decode(value: unknown): string | null { return guard(value) ? value : null; }', ["no-runtime-typeof", "no-unknown-parameters"]],
  ["shadowed Number", 'function guard(value: unknown): value is number { const Number = { isFinite: () => true }; return typeof value === "number" && Number.isFinite(value); }', ["no-runtime-typeof"]],
  ["shadowed Array", 'const Array = { isArray: () => false }; function guard(value: unknown): value is Readonly<{ field?: unknown }> { return typeof value === "object" && value !== null && !Array.isArray(value); }', ["no-runtime-typeof"]],
  ["required unknown shell", 'function guard(value: unknown): value is { field: unknown } { return typeof value === "object" && value !== null && !Array.isArray(value); }', ["no-runtime-typeof"]],
  ["typed shell field", 'function guard(value: unknown): value is { field?: string } { return typeof value === "object" && value !== null && !Array.isArray(value); }', ["no-runtime-typeof"]],
  ["unvalidated dictionary", 'export type UncheckedDocument = Record<string, unknown>;', ["no-unsafe-dictionary-type"]],
  ["unchecked compatibility dictionary", 'export type LegacyResult = Readonly<{ ok: true; documentData: Record<string, unknown> }>;', ["no-unsafe-dictionary-type"]],
  ["concrete dictionary", 'export type Values = Record<string, number>;', []],
  ["raw public port not exempted by name", 'export type Bridge = { handle(request: unknown): Response };', ["no-unknown-parameters"]],
  ["transport not exempted by apply name", 'export function apply(input: {proposal: string | Proposal}) { return typeof input.proposal === "string" ? input.proposal : input.proposal; }', ["no-runtime-typeof"]],
];

for (const [name, code, expected, allowInTypeGuards = true] of cases) {
  test(name, () => {
    const directory = mkdtempSync(join(tmpdir(), "sceneaxi-rule-"));
    try {
      const config = join(directory, ".oxlintrc.json");
      const fixture = join(directory, "fixture.ts");
      writeFileSync(config, JSON.stringify({ jsPlugins: [{ name: "anti-slop", specifier: resolve(root, "tools/oxlint/anti-slop/index.ts") }], rules: {
        "anti-slop/no-runtime-typeof": ["error", { allowInTypeGuards }],
        "anti-slop/no-unknown-parameters": "error",
        "anti-slop/no-unsafe-dictionary-type": "error",
      }}));
      writeFileSync(fixture, code);
      const result = spawnSync(resolve(root, "node_modules/.bin/oxlint"), ["--config", config, "--format", "json", fixture], { cwd: root, encoding: "utf8", timeout: 20000 });
      assert.equal(result.error, undefined);
      assert.ok(result.status === 0 || result.status === 1, result.stderr + result.stdout);
      const output = JSON.parse(result.stdout);
      const actual = output.diagnostics.filter((item) => item.code?.startsWith("anti-slop(")).map((item) => item.code.slice(10, -1)).sort();
      assert.deepEqual(actual, [...expected].sort(), result.stdout + result.stderr);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
