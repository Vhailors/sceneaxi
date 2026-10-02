import {
  dockTabsFor,
  type DesktopChangeReviewView,
  type DesktopControlMint,
  type DesktopDockTabId,
  type DesktopVisualState,
  type DesktopVisualView,
} from "./core.js";

const DOCK_TAB_LABELS: Readonly<Record<DesktopDockTabId, string>> = Object.freeze({
  changes: "Changes",
  assets: "Assets",
  console: "Console",
  evidence: "Evidence",
  timeline: "Timeline",
});

export function changeReviewView(control: DesktopControlMint): DesktopChangeReviewView {
  return Object.freeze({
    count: 0,
    empty: true,
    accept: control("change-review-accept", "Accept proposal", "live"),
    reject: control("change-review-reject", "Reject proposal", "live"),
    writesDocuments: true as const,
  });
}

export function dockTabsView(state: DesktopVisualState, count: number, control: DesktopControlMint): DesktopVisualView["dockTabs"] {
  return Object.freeze(
    dockTabsFor(state.mode).map((id) =>
      Object.freeze({
        id,
        label: DOCK_TAB_LABELS[id],
        active: id === state.dockTab,
        badge: id === "changes" ? count : 0,
        control: control(`dock-${id}`, DOCK_TAB_LABELS[id], "view"),
      }),
    ),
  );
}

export function timelineControls(control: DesktopControlMint): DesktopVisualView["timelineControls"] {
  return Object.freeze({
    mutation: control("timeline-mutation", "Animation mutation JSON", "view"),
    apply: control("timeline-apply", "Stage animation edit", "live"),
    time: control("timeline-time", "Time in milliseconds", "view"),
    scrub: control("timeline-scrub", "Scrub animation", "live"),
    evaluate: control("timeline-evaluate", "Evaluate animation", "live"),
  });
}
