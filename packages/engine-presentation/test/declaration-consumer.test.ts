import { describe, expect, it } from "vitest";
import ts from "typescript";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe("emitted public declaration consumer", () => {
  it("accepts numeric controls but rejects content/scene/renderer authority using actual emitted declarations", () => {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-presentation-consumer-"));

    try {
      const file = join(root, "consumer.ts");
      writeFileSync(file, `import { createThreePresentationCore, type ThreeTriangleAnimationClip } from ${JSON.stringify(join(packageRoot, "dist/src/index.js"))};
const c = createThreePresentationCore();
c.resize(128,128,1); const frame: number = c.draw().frame; c.camera.state(); c.dispose();
// @ts-expect-error public facade must not expose backend content
c.content;
// @ts-expect-error public facade must not expose backend renderer
c.renderer;
// @ts-expect-error public facade must not expose backend scene
c.scene;
const clip: ThreeTriangleAnimationClip = { name: "numeric", duration: 0, channels: [] }; void clip; void frame;
`);
      const program = ts.createProgram([file], { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, skipLibCheck: true, noEmit: true });
      expect(ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"))).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
