import { describe, expect, it } from "vitest";
import {
  commandHarness as harness,
  commandElement as element,
  clickCommand as click,
} from "../helpers/desktop-chrome-golden.js";

describe("desktop inspector command interactions", () => {
  it("dispatches Stop and Reset from the Run inspector", async () => {
    const { window, calls, requests } = await harness();
    await click(window, "#mode-run");
    calls.splice(0);
    await click(window, "#run-stop");
    expect(calls).toContainEqual({ plane: "engine", action: "command", op: "run-stop" });
    expect(requests.find((request) => (request["payload"] as Record<string, unknown>)?.["commandId"] === "run-stop"))
      .toMatchObject({ payload: { input: {} } });
    expect(element(window, "[data-project-status]").textContent).toContain("run-stop");
    await click(window, "#run-reset");
    expect(calls).toContainEqual({ plane: "engine", action: "command", op: "run-reset" });
    expect(requests.find((request) => (request["payload"] as Record<string, unknown>)?.["commandId"] === "run-reset"))
      .toMatchObject({ payload: { input: {} } });
    expect(element(window, "[data-project-status]").textContent).toContain("run-reset");
  });

  it("names malformed inspector JSON and refuses before host dispatch", async () => {
    const { window, calls } = await harness();
    await click(window, "#mode-build");
    const mutation = element(window, '[data-catalog-mutation="physics"]') as ReturnType<typeof element> & { value: string };
    mutation.value = "[]";
    calls.splice(0);
    await click(window, "#physics-stage");
    expect(calls.some((call) => call.op === "physics-apply")).toBe(false);
    expect(element(window, "[data-outcome-code]").textContent).toBe("EDITOR_COMMAND_INPUT_INVALID");
  });

  it("dispatches inspector reads for all four registered catalogs", async () => {
    const { window, calls } = await harness();
    await click(window, "#mode-build");
    for (const kind of ["physics", "environment", "material", "effect"] as const) {
      await click(window, `#${kind}-inspect`);
      expect(calls).toContainEqual({ plane: "engine", action: "command", op: `${kind}-inspect` });
      expect(element(window, `[data-catalog-report="${kind}"]`).textContent).toContain("sceneaxi.test-catalog");
    }
  });
});
