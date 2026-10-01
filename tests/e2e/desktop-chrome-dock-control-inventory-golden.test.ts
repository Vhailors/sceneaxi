import { describe, expect, it } from "vitest";
import {
  mountInventory as mount,
  inventoryElement as element,
  clickInventory as click,
} from "../helpers/desktop-chrome-golden.js";

describe("desktop mounted control inventory — dock", () => {
  it("loads Timeline evidence through the desktop command and keeps controls typed", async () => {
    const requests: unknown[] = [];
    const window = mount(undefined, {
      project: async () => ({
        ok: true,
        data: { status: { active: { name: "Animation", root: "/project", documentPath: "scene.json" }, recents: [] } },
      }),
      request: async (request) => {
        requests.push(request);
        const typed = request as { action?: string; payload?: { commandId?: string; op?: string } };
        if (typed.action === "authoring" && typed.payload?.op === "status") {
          return { ok: true, data: { ok: true, documentId: "animation", data: {}, contentHash: `sha256:${"a".repeat(64)}` } };
        }
        const commandId = typed.payload?.commandId;
        if (commandId === "animation-inspect") {
          return { ok: true, data: { kind: "sceneaxi.scene-animation-inspection", catalog: { clips: [{ clipId: "idle" }], tracks: [], keyframes: [] } } };
        }
        if (commandId === "animation-scrub" || commandId === "animation-evaluate") {
          return { ok: true, data: { kind: "sceneaxi.scene-animation-evaluation", timeMs: 0, savedBytesWritten: false } };
        }
        return { ok: false, reason: "ANIMATION_INPUT_UNSUPPORTED", message: "Mutation input is required." };
      },
    });
    await click(window, "#mode-animate");
    await click(window, '[data-action="dock-tab"][data-value="timeline"]');
    expect(element(window, "[data-timeline-result]").textContent).toContain('"clipId": "idle"');
    const timelineKinds = { "timeline-mutation": "view", "timeline-apply": "live", "timeline-time": "view", "timeline-scrub": "live", "timeline-evaluate": "live" } as const;
    for (const [id, kind] of Object.entries(timelineKinds)) {
      expect(element(window, `#${id}`).getAttribute("data-kind")).toBe(kind);
    }
    expect(element(window, "#timeline-apply").getAttribute("data-action")).toBe("timeline-apply");
    expect(element(window, "#timeline-evaluate").getAttribute("data-action")).toBe("timeline-evaluate");
    expect(requests.find((request) => (request as { payload?: { commandId?: string } }).payload?.commandId === "animation-inspect"))
      .toMatchObject({ payload: { input: { documentPath: "scene.json", profile: "game" } } });
    await click(window, "#timeline-scrub");
    await click(window, "#timeline-evaluate");
    expect(requests.map((request) => (request as { payload?: { commandId?: string } }).payload?.commandId))
      .toEqual(expect.arrayContaining(["animation-scrub", "animation-evaluate"]));
  });
});
