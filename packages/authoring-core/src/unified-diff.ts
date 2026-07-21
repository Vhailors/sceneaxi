/**
 * Minimal unified-diff generator for text-canonical documents.
 * Deterministic line-based LCS; good enough for review surfaces and golden tests.
 */

function lcsTable(a: readonly string[], b: readonly string[]): number[][] {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0),
  );
  for (let i = 1; i < rows; i++) {
    const ai = a[i - 1];
    const row = table[i];
    const prev = table[i - 1];
    if (row === undefined || prev === undefined) continue;
    for (let j = 1; j < cols; j++) {
      if (ai === b[j - 1]) {
        row[j] = (prev[j - 1] ?? 0) + 1;
      } else {
        row[j] = Math.max(prev[j] ?? 0, row[j - 1] ?? 0);
      }
    }
  }
  return table;
}

type DiffOp =
  | { readonly kind: "equal"; readonly line: string }
  | { readonly kind: "remove"; readonly line: string }
  | { readonly kind: "add"; readonly line: string };

function diffOps(a: readonly string[], b: readonly string[]): DiffOp[] {
  const table = lcsTable(a, b);
  const ops: DiffOp[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    const aLine = i > 0 ? a[i - 1] : undefined;
    const bLine = j > 0 ? b[j - 1] : undefined;
    if (i > 0 && j > 0 && aLine === bLine && aLine !== undefined) {
      ops.push({ kind: "equal", line: aLine });
      i -= 1;
      j -= 1;
    } else if (
      j > 0 &&
      bLine !== undefined &&
      (i === 0 || (table[i]?.[j - 1] ?? 0) >= (table[i - 1]?.[j] ?? 0))
    ) {
      ops.push({ kind: "add", line: bLine });
      j -= 1;
    } else if (i > 0 && aLine !== undefined) {
      ops.push({ kind: "remove", line: aLine });
      i -= 1;
    } else {
      break;
    }
  }
  ops.reverse();
  return ops;
}

/**
 * Produce a unified diff between two full-file texts.
 * Paths appear in the --- / +++ headers for review.
 */
export function unifiedDiff(
  oldText: string,
  newText: string,
  options: {
    readonly oldPath: string;
    readonly newPath: string;
  },
): string {
  const oldLines = oldText.length === 0 ? [] : oldText.split("\n");
  // Preserve trailing empty from final newline as an empty last element, matching
  // typical split behavior; strip a single trailing empty when both sides end with \n
  // so line counts match visual lines.
  const a = stripTrailingEmpty(oldLines);
  const b = stripTrailingEmpty(newText.length === 0 ? [] : newText.split("\n"));

  if (a.length === b.length && a.every((line, idx) => line === b[idx])) {
    return [
      `--- ${options.oldPath}`,
      `+++ ${options.newPath}`,
      "@@ -0,0 +0,0 @@",
    ].join("\n");
  }

  const ops = diffOps(a, b);
  const hunks: string[] = [];
  // Single full-file hunk (simple, deterministic).
  const removeCount = ops.filter((o) => o.kind === "remove" || o.kind === "equal")
    .length;
  const addCount = ops.filter((o) => o.kind === "add" || o.kind === "equal")
    .length;
  const oldStart = a.length === 0 ? 0 : 1;
  const newStart = b.length === 0 ? 0 : 1;
  hunks.push(`@@ -${oldStart},${removeCount} +${newStart},${addCount} @@`);
  for (const op of ops) {
    if (op.kind === "equal") hunks.push(` ${op.line}`);
    else if (op.kind === "remove") hunks.push(`-${op.line}`);
    else hunks.push(`+${op.line}`);
  }

  return [
    `--- ${options.oldPath}`,
    `+++ ${options.newPath}`,
    ...hunks,
  ].join("\n");
}

function stripTrailingEmpty(lines: string[]): string[] {
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    return lines.slice(0, -1);
  }
  return lines;
}
