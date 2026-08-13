/**
 * Executable module-coverage check over docs/dependency-matrix.json and
 * docs/module-coverage.md. Every matrix package must name a role, public seam,
 * verification owner, and status. Allowed edges remain the matrix `allow` lists.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMarkdownTables } from "./capability-matrix-audit.ts";

export const MODULE_STATUSES = Object.freeze(["real", "partial", "dormant", "delayed"] as const);
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

export const HOST_GRAPHICS_LIMITATION = "Electron 43.2.0";

export const CHAIN_SEQUENCE = Object.freeze([
  "tests/e2e/desktop-provider-host-golden.test.ts",
  "tests/e2e/desktop-provider-authoring-engine-golden.test.ts",
  "tests/e2e/rarity-provider-desktop-golden.test.ts",
  "tests/e2e/desktop-linux-bridge-golden.test.ts",
] as const);

export const CHAIN_REFUSALS = Object.freeze([
  "ASSISTANT_SCULPT_KIDS_DENIED",
  "DESKTOP_ASSISTANT_HOSTED_METERING_UNAVAILABLE",
  "DESKTOP_ASSISTANT_BYO_UNAVAILABLE",
  "DESKTOP_RARITY_PROVIDER_UNAVAILABLE",
  "content-hash-conflict",
] as const);

export type ModuleCoverageFinding = Readonly<{
  code:
    | "missing-package"
    | "extra-package"
    | "missing-role"
    | "missing-seam"
    | "missing-owner"
    | "unknown-status"
    | "stale-evidence-path"
    | "missing-allow"
    | "missing-host-limitation"
    | "missing-chain-sequence"
    | "missing-named-refusal";
  message: string;
}>;

export type DependencyMatrix = Readonly<{
  packages: Readonly<Record<string, Readonly<{
    dir?: string;
    allow?: readonly string[];
    releaseGroup?: string;
  }>>>;
  delayed?: Readonly<Record<string, Readonly<{
    allow?: readonly string[];
  }>>>;
}>;

export function loadDependencyMatrix(root: string): DependencyMatrix {
  return JSON.parse(
    readFileSync(resolve(root, "docs/dependency-matrix.json"), "utf8"),
  ) as DependencyMatrix;
}

export function matrixPackageNames(matrix: DependencyMatrix): readonly string[] {
  return [...Object.keys(matrix.packages), ...Object.keys(matrix.delayed ?? {})].sort();
}

type CoverageRow = Readonly<{
  name: string;
  role: string;
  publicSeam: string;
  verificationOwner: string;
  status: string;
}>;

function rowsFromDocument(markdown: string): CoverageRow[] {
  const tables = parseMarkdownTables(markdown).filter((table) =>
    table.headers[0] === "Package" &&
    table.headers.includes("Role") &&
    table.headers.includes("Public seam") &&
    table.headers.includes("Verification owner") &&
    table.headers.includes("Status"),
  );
  return tables.flatMap((table) =>
    table.rows.map((cells) => ({
      name: unwrap(cells[0] ?? ""),
      role: unwrap(cells[table.headers.indexOf("Role")] ?? ""),
      publicSeam: unwrap(cells[table.headers.indexOf("Public seam")] ?? ""),
      verificationOwner: unwrap(cells[table.headers.indexOf("Verification owner")] ?? ""),
      status: unwrap(cells[table.headers.indexOf("Status")] ?? "").replace(/\*/g, ""),
    })),
  );
}

function unwrap(value: string) {
  return value.replace(/^`+|`+$/g, "").trim();
}

export function auditModuleCoverage(
  markdown: string,
  root: string,
  matrix: DependencyMatrix,
): ModuleCoverageFinding[] {
  const findings: ModuleCoverageFinding[] = [];
  const expected = new Set(matrixPackageNames(matrix));
  const rows = rowsFromDocument(markdown);
  const seen = new Set<string>();

  for (const name of expected) {
    if (!rows.some((row) => row.name === name)) {
      findings.push({
        code: "missing-package",
        message: `${name} is in the dependency matrix but missing from the module-coverage table.`,
      });
    }
  }

  for (const row of rows) {
    if (seen.has(row.name)) {
      findings.push({
        code: "extra-package",
        message: `${row.name} appears more than once in the module-coverage table.`,
      });
      continue;
    }
    seen.add(row.name);
    if (!expected.has(row.name)) {
      findings.push({
        code: "extra-package",
        message: `${row.name} is in the module-coverage table but not in the dependency matrix.`,
      });
    }
    if (row.role.length === 0) {
      findings.push({ code: "missing-role", message: `${row.name} is missing a role.` });
    }
    if (row.publicSeam.length === 0) {
      findings.push({ code: "missing-seam", message: `${row.name} is missing a public seam.` });
    }
    if (row.verificationOwner.length === 0) {
      findings.push({ code: "missing-owner", message: `${row.name} is missing a verification owner.` });
    }
    if (!(MODULE_STATUSES as readonly string[]).includes(row.status)) {
      findings.push({
        code: "unknown-status",
        message: `${row.name} has unknown status ${JSON.stringify(row.status)}.`,
      });
    }
    const entry = matrix.packages[row.name] ?? matrix.delayed?.[row.name];
    if (entry !== undefined && !Array.isArray(entry.allow)) {
      findings.push({
        code: "missing-allow",
        message: `${row.name} has no allow list in the dependency matrix.`,
      });
    }
    for (const path of [row.publicSeam, row.verificationOwner]) {
      if (path.length === 0) continue;
      if (!existsSync(resolve(root, path))) {
        findings.push({
          code: "stale-evidence-path",
          message: `${row.name} names missing path ${path}.`,
        });
      }
    }
  }

  if (!markdown.includes(HOST_GRAPHICS_LIMITATION) || !/host limitation/i.test(markdown)) {
    findings.push({
      code: "missing-host-limitation",
      message: "Module coverage must record the Electron 43.2.0 local headless crash as a host limitation.",
    });
  }
  for (const path of CHAIN_SEQUENCE) {
    if (!markdown.includes(path)) {
      findings.push({
        code: "missing-chain-sequence",
        message: `Module coverage must record the chain test ${path}.`,
      });
    }
    if (!existsSync(resolve(root, path))) {
      findings.push({
        code: "stale-evidence-path",
        message: `Chain sequence names missing test ${path}.`,
      });
    }
  }
  for (const refusal of CHAIN_REFUSALS) {
    if (!markdown.includes(refusal)) {
      findings.push({
        code: "missing-named-refusal",
        message: `Module coverage must name refusal ${refusal}.`,
      });
    }
  }
  return findings;
}

export function repoRootFromUrl(url: string) {
  return resolve(dirname(fileURLToPath(url)), "../..");
}

export function liveModuleCoverageMarkdown(root: string) {
  return readFileSync(resolve(root, "docs/module-coverage.md"), "utf8");
}
