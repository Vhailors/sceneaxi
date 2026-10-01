import { describe, expect, it } from "vitest";
import {
  DESKTOP_MODE_IDS,
  DESKTOP_VISUAL_REFUSALS,
  applyDesktopVisualAction,
  createDesktopVisualState,
  defaultDockTabFor,
  desktopVisualView,
  dockTabsFor,
  type DesktopVisualAction,
  type DesktopVisualState,
} from "@sceneaxi/desktop-shell";

const drive = (
  actions: readonly DesktopVisualAction[],
  from: DesktopVisualState = createDesktopVisualState(),
): DesktopVisualState => actions.reduce(applyDesktopVisualAction, from);

describe("desktop visual model — dock tabs", () => {
  it("gives run no Changes tab: nothing may be authored while a scene runs", () => {
    expect(dockTabsFor("run")).not.toContain("changes");
    expect(dockTabsFor("run")).toEqual(["console", "evidence"]);
  });

  it("gives animate a timeline and opens on it", () => {
    expect(dockTabsFor("animate")).toContain("timeline");
    expect(defaultDockTabFor("animate")).toBe("timeline");
  });

  it("opens ship on evidence and every other mode on changes", () => {
    expect(defaultDockTabFor("ship")).toBe("evidence");
    for (const mode of ["build", "sculpt", "compose", "plugins"] as const) {
      expect(defaultDockTabFor(mode)).toBe("changes");
    }
  });

  it("cannot hold a dock tab the active mode does not have", () => {
    const state = drive([
      { type: "select-dock-tab", tab: "assets" },
      { type: "select-mode", mode: "run" },
    ]);
    expect(state.dockTab).toBe("console");
    expect(dockTabsFor(state.mode)).toContain(state.dockTab);
  });

  it("refuses to select a tab the mode does not have, leaving state untouched", () => {
    const before = drive([{ type: "select-mode", mode: "run" }]);
    const after = applyDesktopVisualAction(before, {
      type: "select-dock-tab",
      tab: "timeline",
    });
    expect(after).toBe(before);
  });

  it("gives every mode a dock tab set and every listed tab a mode", () => {
    const reachable = new Set(DESKTOP_MODE_IDS.flatMap((mode) => [...dockTabsFor(mode)]));
    expect([...reachable].sort()).toEqual(
      ["assets", "changes", "console", "evidence", "timeline"].sort(),
    );
  });

  it("gives animate the taller dock the archive draws", () => {
    expect(desktopVisualView(drive([{ type: "select-mode", mode: "animate" }])).dockHeight)
      .toBe(252);
    expect(desktopVisualView(createDesktopVisualState()).dockHeight).toBe(228);
  });
});

describe("desktop visual model — change review", () => {
  it("starts empty because only a real session snapshot may populate review", () => {
    const view = desktopVisualView(createDesktopVisualState());
    expect(view.changeReview).toMatchObject({ count: 0, empty: true });
    expect(view.dockTabs.find((tab) => tab.id === "changes")?.badge).toBe(0);
  });

  it("models one atomic accept and reject pair that reaches the host", () => {
    const review = desktopVisualView(createDesktopVisualState()).changeReview;
    expect(review.writesDocuments).toBe(true);
    expect(review.accept).toMatchObject({ id: "change-review-accept", kind: "live" });
    expect(review.reject).toMatchObject({ id: "change-review-reject", kind: "live" });
  });

  it("demotes both proposal decisions under the structural Kids refusal", () => {
    const review = desktopVisualView(
      createDesktopVisualState({ profile: "kids" }),
    ).changeReview;
    expect([review.accept, review.reject].every((control) =>
      control.kind === "inert" &&
      control.refusal === DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly,
    )).toBe(true);
  });
});
