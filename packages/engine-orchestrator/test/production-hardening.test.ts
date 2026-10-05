import { describe, expect, it } from "vitest";
import { bootstrapOpenPath, resumeOpenPath, ORCHESTRATOR_REFUSALS } from "@sceneaxi/engine-orchestrator";
import { open } from "@sceneaxi/engine-kernel";

describe("total hostile-host diagnostics", () => {
  it("never coerces objects, invokes error accessors or escapes hostile proxy exceptions", () => {
    const values: unknown[] = [{ toString() { throw new Error("escaped"); } }, Object.defineProperty(new Error(), "message", { get() { throw new Error("escaped"); } }), new Proxy({}, { getOwnPropertyDescriptor() { throw new Error("escaped"); } }), new Error("x".repeat(4096))];
    const save = open({ productId: "host", seed: 1 }, { nowMs: () => 1 }).save();

    for (const value of values) {
      const host = { nowMs(): number { throw value; } };

      for (const result of [bootstrapOpenPath({ kind: "product", productManifest: { productId: "host", seed: 1 } }, host), resumeOpenPath({ kind: "product", save }, host)]) {
        expect(result).toMatchObject({ ok: false, reason: "OPEN_PATH_HOST_INVALID" });
        expect(JSON.stringify(result).length).toBeLessThan(1024);
        expect(JSON.stringify(result)).not.toContain("escaped");
      }
    }
  });
});

it("uses the same bounded fallback for primitives and inherited host messages without coercion", () => {
  let invoked = 0;
  const values: unknown[] = [null, undefined, Symbol("private-host-object"), 1n, "private-host-string", Object.create({ message: "private-inherited-message" }), { toString() { invoked++;

 return "private-coercion"; } }];
  const save = open({ productId: "fallback", seed: 1 }, { nowMs: () => 1 }).save();

  for (const value of values) {
    const host = { nowMs(): number { throw value; } };

    for (const result of [bootstrapOpenPath({ kind: "product", productManifest: { productId: "fallback", seed: 1 } }, host),resumeOpenPath({ kind: "product", save }, host)]) {
      expect(result).toMatchObject({ok:false,reason:"OPEN_PATH_HOST_INVALID",message:ORCHESTRATOR_REFUSALS.OPEN_PATH_HOST_INVALID,detail:"operation failed"}); expect(JSON.stringify(result)).not.toContain("private");
    }
  }

  expect(invoked).toBe(0);
});
