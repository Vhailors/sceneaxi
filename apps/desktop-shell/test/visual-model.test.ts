import { describe, expect, it } from "vitest";
import {
  CHANGE_REVIEW_ROWS,
  DESKTOP_ASSISTANT_MODE_IDS,
  DESKTOP_COMMANDS,
  DESKTOP_MENU_IDS,
  DESKTOP_MINIMUM_WINDOW,
  DESKTOP_MODE_IDS,
  DESKTOP_OVERLAY_IDS,
  DESKTOP_PROFILE_IDS,
  DESKTOP_PROFILE_PACKAGES,
  DESKTOP_REFUSAL_MESSAGES,
  DESKTOP_VISUAL_REFUSALS,
  PALETTE_GROUPS,
  SCULPT_PASSES,
  VIEWPORT_RENDERER_NOTE,
  WINDOW_TIERS,
  applyDesktopVisualAction,
  createDesktopVisualState,
  defaultDockTabFor,
  desktopVisualView,
  dockTabsFor,
  resolveWindowTier,
  type DesktopVisualAction,
  type DesktopVisualState,
} from "@sceneaxi/desktop-shell";
import { openPathPolicyView } from "@sceneaxi/schemas";

/**
 * The Engine Desktop visual state model (sceneaxi#158).
 *
 * These tests exist because the archive is a mockup: it draws controls for
 * behaviour this shell has no contract for. What is asserted here is the split —
 * which controls really work, which refuse and by what name, and that nothing in
 * the chrome can reach a document.
 */

const drive = (
  actions: readonly DesktopVisualAction[],
  from: DesktopVisualState = createDesktopVisualState(),
): DesktopVisualState => actions.reduce(applyDesktopVisualAction, from);

describe("desktop visual model — modes and dock tabs", () => {
  it("has exactly the seven modes the accepted archive defines, in order", () => {
    expect([...DESKTOP_MODE_IDS]).toEqual([
      "build",
      "sculpt",
      "compose",
      "animate",
      "run",
      "ship",
      "plugins",
    ]);
  });

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

describe("desktop visual model — profile switch", () => {
  it("projects the shared open-path policy rather than restating it", () => {
    const view = desktopVisualView(createDesktopVisualState());
    // Data identity with the CLI verb, the desktop `open-path` command, and
    // web-shell's view: parity is asserted, not described.
    expect(view.policy).toEqual(openPathPolicyView());
    for (const chip of view.profiles) {
      const row = openPathPolicyView().rows.find(
        (candidate) => candidate.profile === DESKTOP_PROFILE_PACKAGES[chip.id],
      );
      expect(chip.policy).toEqual(row ?? null);
    }
  });

  it("marks exactly one profile refuse-only, and it is Kids", () => {
    const view = desktopVisualView(createDesktopVisualState());
    const refuseOnly = view.profiles.filter((chip) => chip.refuseOnly);
    expect(refuseOnly.map((chip) => chip.id)).toEqual(["kids"]);
    expect(refuseOnly[0]?.packageName).toBe("@sceneaxi/profile-kids");
    expect(refuseOnly[0]?.refusal).toBe(DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly);
  });

  it("refuses the whole editor body on Kids, with the policy's own sentence", () => {
    const view = desktopVisualView(drive([{ type: "select-profile", profile: "kids" }]));
    expect(view.profileRefusal).not.toBeNull();
    expect(view.profileRefusal?.code).toBe("OPEN_PATH_KIDS_REFUSED");
    expect(view.profileRefusal?.summary).toBe(
      openPathPolicyView().rows.find(
        (row) => row.profile === "@sceneaxi/profile-kids",
      )?.summary,
    );
    // Every mode is inert: no mode may be entered from behind the refusal.
    expect(view.modes.every((mode) => mode.control.kind === "inert")).toBe(true);
  });

  it("keeps Game and Website driveable", () => {
    for (const profile of ["game", "web"] as const) {
      const view = desktopVisualView(drive([{ type: "select-profile", profile }]));
      expect(view.profileRefusal).toBeNull();
      expect(view.modes.every((mode) => mode.control.kind === "view")).toBe(true);
    }
  });

  it("covers every declared profile id", () => {
    expect([...DESKTOP_PROFILE_IDS].sort()).toEqual(
      Object.keys(DESKTOP_PROFILE_PACKAGES).sort(),
    );
  });
});

describe("desktop visual model — assistant", () => {
  it("denies the assistant on Kids and cannot be toggled back open", () => {
    const kids = drive([{ type: "select-profile", profile: "kids" }]);
    expect(kids.assistant).toBe("denied");
    const toggled = applyDesktopVisualAction(kids, { type: "toggle-assistant" });
    expect(toggled).toBe(kids);
    const view = desktopVisualView(kids);
    expect(view.assistant.refusal).toBe(DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied);
    expect(view.assistant.refusalCode).toBe("THIRD_PARTY_LLM_DENIED_BY_DEFAULT");
    expect(view.assistant.modelLabel).toBe("denied");
    expect(view.assistant.toggle.kind).toBe("inert");
  });

  it("re-opens the assistant when leaving Kids", () => {
    const back = drive([
      { type: "select-profile", profile: "kids" },
      { type: "select-profile", profile: "game" },
    ]);
    expect(back.assistant).toBe("open");
  });

  it("toggles open and closed on a non-refusing profile", () => {
    const closed = drive([{ type: "toggle-assistant" }]);
    expect(closed.assistant).toBe("closed");
    expect(drive([{ type: "toggle-assistant" }], closed).assistant).toBe("open");
  });

  it("drops thinking when the assistant is not open", () => {
    const state = drive([
      { type: "toggle-assistant-thinking" },
      { type: "toggle-assistant" },
    ]);
    expect(state.assistantThinking).toBe(false);
  });

  it("ignores assistant-mode and thinking actions while closed", () => {
    const closed = drive([{ type: "toggle-assistant" }]);
    expect(
      applyDesktopVisualAction(closed, { type: "select-assistant-mode", mode: "agent" }),
    ).toBe(closed);
    expect(applyDesktopVisualAction(closed, { type: "toggle-assistant-thinking" })).toBe(
      closed,
    );
  });

  it("never claims a provider: send is inert with no document bound", () => {
    const view = desktopVisualView(createDesktopVisualState());
    expect(view.assistant.send.kind).toBe("inert");
    expect(view.assistant.send.refusal).toBe(DESKTOP_VISUAL_REFUSALS.noDocumentBound);
    expect(view.assistant.modelLabel).toBe("no provider configured");
    expect([...DESKTOP_ASSISTANT_MODE_IDS]).toEqual(["ask", "build", "agent"]);
  });
});

describe("desktop visual model — change review", () => {
  it("states on the surface that a decision writes no document", () => {
    expect(desktopVisualView(createDesktopVisualState()).changeReview.writesDocuments)
      .toBe(false);
  });

  it("removes a decided row and moves the dock badge with it", () => {
    const view = desktopVisualView(drive([{ type: "decide-change", index: 1 }]));
    expect(view.changeReview.count).toBe(CHANGE_REVIEW_ROWS.length - 1);
    expect(view.changeReview.pending.map((row) => row.index)).toEqual([0, 2]);
    expect(view.dockTabs.find((tab) => tab.id === "changes")?.badge).toBe(
      CHANGE_REVIEW_ROWS.length - 1,
    );
  });

  it("is idempotent: deciding the same row twice removes it once", () => {
    const twice = drive([
      { type: "decide-change", index: 0 },
      { type: "decide-change", index: 0 },
    ]);
    expect(desktopVisualView(twice).changeReview.count).toBe(
      CHANGE_REVIEW_ROWS.length - 1,
    );
  });

  it("empties on decide-all and reports the empty state", () => {
    const view = desktopVisualView(drive([{ type: "decide-all-changes" }]));
    expect(view.changeReview.count).toBe(0);
    expect(view.changeReview.empty).toBe(true);
    expect(view.changeReview.pending).toEqual([]);
  });

  it("marks every decision control `review`, never a writing kind", () => {
    const view = desktopVisualView(createDesktopVisualState());
    const controls = [
      view.changeReview.acceptAll,
      view.changeReview.rejectAll,
      ...view.changeReview.pending.flatMap((row) => [row.accept, row.reject]),
    ];
    expect(controls.every((control) => control.kind === "review")).toBe(true);
    expect(controls.every((control) => control.refusal === null)).toBe(true);
  });
});

describe("desktop visual model — sculpt run", () => {
  it("starts a run in sculpt mode at pass one", () => {
    const state = drive([{ type: "start-sculpt" }]);
    expect(state.mode).toBe("sculpt");
    expect(state.sculpt).toBe("running");
    expect(desktopVisualView(state).sculpt.percent).toBe(0);
    expect(desktopVisualView(state).sculpt.label).toBe(SCULPT_PASSES[0]?.runningLabel);
  });

  it("advances within a pass and rolls into the next", () => {
    const started = drive([{ type: "start-sculpt" }]);
    const part = applyDesktopVisualAction(started, { type: "advance-sculpt", by: 0.5 });
    expect(desktopVisualView(part).sculpt.percent).toBe(50);
    const rolled = applyDesktopVisualAction(part, { type: "advance-sculpt", by: 0.6 });
    expect(rolled.sculptPass).toBe(1);
    expect(desktopVisualView(rolled).sculpt.percent).toBe(0);
  });

  it("clamps the pass index to the five-pass plan", () => {
    let state = drive([{ type: "start-sculpt" }]);
    for (let i = 0; i < 40; i++) {
      state = applyDesktopVisualAction(state, { type: "advance-sculpt", by: 1 });
    }
    expect(state.sculptPass).toBeLessThanOrEqual(SCULPT_PASSES.length - 1);
    expect(desktopVisualView(state).sculpt.label).toBe(
      SCULPT_PASSES[SCULPT_PASSES.length - 1]?.runningLabel,
    );
  });

  it("ignores advance while idle", () => {
    const idle = createDesktopVisualState();
    expect(applyDesktopVisualAction(idle, { type: "advance-sculpt", by: 0.5 })).toBe(idle);
  });

  it("reports the run in the status line and stops on cancel", () => {
    const running = drive([{ type: "start-sculpt" }]);
    expect(desktopVisualView(running).statusText).toBe("Sculpting — pass 1 of 5");
    const cancelled = applyDesktopVisualAction(running, { type: "cancel-sculpt" });
    expect(cancelled.sculpt).toBe("idle");
    expect(desktopVisualView(cancelled).statusText).toBe("Ready");
  });

  it("refuses to start a sculpt: no document is bound", () => {
    const view = desktopVisualView(createDesktopVisualState());
    expect(view.sculpt.start.kind).toBe("inert");
    expect(view.sculpt.start.refusal).toBe(DESKTOP_VISUAL_REFUSALS.noDocumentBound);
  });
});

describe("desktop visual model — overlays and palette", () => {
  it("opens and closes each overlay", () => {
    for (const overlay of DESKTOP_OVERLAY_IDS) {
      const open = drive([{ type: "open-overlay", overlay }]);
      expect(open.overlay).toBe(overlay);
      expect(applyDesktopVisualAction(open, { type: "close-overlay" }).overlay).toBeNull();
    }
  });

  it("closes an overlay when the mode changes", () => {
    const state = drive([
      { type: "open-overlay", overlay: "palette" },
      { type: "select-mode", mode: "ship" },
    ]);
    expect(state.overlay).toBeNull();
  });

  it("marks a palette row driveable only when this shell has that command", () => {
    const view = desktopVisualView(createDesktopVisualState());
    const rows = view.overlay.paletteGroups.flatMap((group) => group.items);
    const declared = PALETTE_GROUPS.flatMap((group) => group.items);
    expect(rows).toHaveLength(declared.length);

    for (const [index, row] of rows.entries()) {
      const item = declared[index];
      const driveable =
        item?.desktopCommand !== null &&
        item !== undefined &&
        Object.hasOwn(DESKTOP_COMMANDS, item.desktopCommand ?? "");
      expect(row.control.kind).toBe(driveable ? "view" : "inert");
      if (!driveable) {
        expect(row.control.refusal).toBe(DESKTOP_VISUAL_REFUSALS.verbNotOnDesktop);
      }
    }
  });

  it("keeps `sceneaxi project dev` inert — it is a CLI verb, not a desktop one", () => {
    const rows = desktopVisualView(createDesktopVisualState()).overlay.paletteGroups
      .flatMap((group) => group.items);
    const dev = rows.find((row) => row.cli === "sceneaxi project dev");
    expect(dev?.control.kind).toBe("inert");
    expect(dev?.control.refusal).toBe(DESKTOP_VISUAL_REFUSALS.verbNotOnDesktop);
  });

  it("names a real CLI verb on every palette row", () => {
    for (const group of PALETTE_GROUPS) {
      for (const item of group.items) {
        expect(item.cli.startsWith("sceneaxi ")).toBe(true);
      }
    }
  });
});

describe("desktop visual model — window tiers", () => {
  it("resolves each tier at its own minimum", () => {
    expect(resolveWindowTier({ width: 1680, height: 1000 })).toBe("regular");
    expect(resolveWindowTier({ width: 1440, height: 720 })).toBe("regular");
    expect(resolveWindowTier({ width: 1439, height: 900 })).toBe("compact");
    expect(resolveWindowTier({ width: 1180, height: 660 })).toBe("compact");
    expect(resolveWindowTier({ width: 1179, height: 900 })).toBe("narrow");
    expect(resolveWindowTier({ width: 900, height: 600 })).toBe("narrow");
    expect(resolveWindowTier({ width: 899, height: 900 })).toBe("minimum");
    expect(resolveWindowTier({ width: 1680, height: 599 })).toBe("minimum");
  });

  it("refuses below the declared minimum rather than laying out", () => {
    const view = desktopVisualView(
      createDesktopVisualState({ window: { width: 800, height: 560 } }),
    );
    expect(view.tier).toBe("minimum");
    expect(view.refusal?.code).toBe(DESKTOP_VISUAL_REFUSALS.windowBelowMinimum);
    expect(view.refusal?.minimum).toEqual(DESKTOP_MINIMUM_WINDOW);
    expect(view.dockedColumns).toEqual([]);
  });

  it("undocks columns outside-in, and every undocked column becomes a drawer", () => {
    for (const tier of WINDOW_TIERS) {
      if (tier.id === "minimum") continue;
      const view = desktopVisualView(
        createDesktopVisualState({
          window: { width: tier.minWidth, height: tier.minHeight },
        }),
      );
      expect(view.tier).toBe(tier.id);
      // The rail and the viewport are never undocked: they are the surface.
      expect(view.dockedColumns).toContain("rail");
      expect(view.dockedColumns).toContain("viewport");
      for (const drawer of tier.drawerColumns) {
        expect(view.dockedColumns).not.toContain(drawer);
      }
    }
  });

  it("declares the minimum the tier table itself uses", () => {
    const narrow = WINDOW_TIERS.find((tier) => tier.id === "narrow");
    expect(narrow?.minWidth).toBe(DESKTOP_MINIMUM_WINDOW.width);
    expect(narrow?.minHeight).toBe(DESKTOP_MINIMUM_WINDOW.height);
  });
});

describe("desktop visual model — refusals and honesty", () => {
  it("reaches every refusal in the registry from some state", () => {
    const reached = new Set<string>();
    const collect = (view: ReturnType<typeof desktopVisualView>): void => {
      if (view.refusal !== null) reached.add(view.refusal.code);
      if (view.profileRefusal !== null) reached.add(view.profileRefusal.code);
      reached.add(view.viewport.refusal);
      for (const control of [
        view.assistant.toggle,
        view.assistant.send,
        view.sculpt.start,
        ...view.menus.map((menu) => menu.control),
        ...view.modes.map((mode) => mode.control),
        ...view.overlay.paletteGroups.flatMap((group) =>
          group.items.map((item) => item.control),
        ),
      ]) {
        if (control.refusal !== null) reached.add(control.refusal);
      }
      if (view.statusText === DESKTOP_REFUSAL_MESSAGES[DESKTOP_VISUAL_REFUSALS.noKernelSession]) {
        reached.add(DESKTOP_VISUAL_REFUSALS.noKernelSession);
      }
    };
    collect(desktopVisualView(createDesktopVisualState()));
    collect(desktopVisualView(drive([{ type: "select-profile", profile: "kids" }])));
    collect(desktopVisualView(drive([{ type: "select-mode", mode: "run" }])));
    collect(
      desktopVisualView(
        createDesktopVisualState({ window: { width: 640, height: 480 } }),
      ),
    );

    expect([...reached].sort()).toEqual(
      Object.values(DESKTOP_VISUAL_REFUSALS).sort(),
    );
  });

  it("gives every refusal a sentence", () => {
    for (const code of Object.values(DESKTOP_VISUAL_REFUSALS)) {
      expect(DESKTOP_REFUSAL_MESSAGES[code]).toMatch(/\S/);
    }
  });

  it("gives an inert control a refusal and a live control none", () => {
    const view = desktopVisualView(createDesktopVisualState());
    const controls = [
      view.assistant.toggle,
      view.assistant.send,
      view.sculpt.start,
      view.sculpt.cancel,
      view.overlay.close,
      ...view.menus.map((menu) => menu.control),
      ...view.modes.map((mode) => mode.control),
      ...view.dockTabs.map((tab) => tab.control),
    ];
    for (const control of controls) {
      expect(control.refusal === null).toBe(control.kind !== "inert");
      expect(control.refusalMessage === null).toBe(control.kind !== "inert");
    }
  });

  it("gives every control a unique id that is a legal HTML id", () => {
    // Ids are derived from declared identities, never from display text: two
    // palette rows name the same CLI verb in the same mode, and a verb has
    // spaces in it.
    for (const state of [
      createDesktopVisualState(),
      drive([{ type: "select-profile", profile: "kids" }]),
      drive([{ type: "select-mode", mode: "animate" }]),
    ]) {
      const view = desktopVisualView(state);
      const ids = [
        view.assistant.toggle,
        view.assistant.send,
        view.sculpt.start,
        view.sculpt.cancel,
        view.overlay.close,
        view.changeReview.acceptAll,
        view.changeReview.rejectAll,
        ...view.changeReview.pending.flatMap((row) => [row.accept, row.reject]),
        ...view.menus.map((menu) => menu.control),
        ...view.modes.map((mode) => mode.control),
        ...view.dockTabs.map((tab) => tab.control),
        ...view.overlay.paletteGroups.flatMap((group) =>
          group.items.map((item) => item.control),
        ),
      ].map((control) => control.id);
      expect(ids.filter((id) => !/^[A-Za-z][\w-]*$/.test(id))).toEqual([]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("marks every application menu inert, with the menus' own reason", () => {
    const view = desktopVisualView(createDesktopVisualState());
    expect(view.menus.map((menu) => menu.id)).toEqual([...DESKTOP_MENU_IDS]);
    for (const menu of view.menus) {
      expect(menu.control.kind).toBe("inert");
      // Not the viewport's reason: that one is about pixels, not commands.
      expect(menu.control.refusal).toBe(DESKTOP_VISUAL_REFUSALS.verbNotOnDesktop);
    }
  });

  it("never claims pixels, and keeps the held renderer note verbatim", () => {
    const view = desktopVisualView(createDesktopVisualState());
    expect(view.viewport.pixelsDrawn).toBe(false);
    expect(view.viewport.rendererNote).toBe(
      "Preview renderer is experimental — not the final choice",
    );
    expect(VIEWPORT_RENDERER_NOTE).toBe(view.viewport.rendererNote);
    // ADR 0017 retired these for product presentation copy; nothing here uses them.
    expect(view.viewport.rendererNote).not.toContain("Experimental Three preview");
    expect(view.viewport.rendererNote).not.toContain("non-decision");
    expect(view.viewport.inertNote).toContain("no pixels");
  });

  it("says no kernel session runs instead of reporting a tick", () => {
    const view = desktopVisualView(drive([{ type: "select-mode", mode: "run" }]));
    expect(view.statusText).toBe(
      DESKTOP_REFUSAL_MESSAGES[DESKTOP_VISUAL_REFUSALS.noKernelSession],
    );
  });

  it("freezes every projected view so a renderer cannot mutate the model", () => {
    const view = desktopVisualView(createDesktopVisualState());
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.assistant)).toBe(true);
    expect(Object.isFrozen(view.changeReview)).toBe(true);
    expect(Object.isFrozen(view.state)).toBe(true);
  });

  it("is deterministic: the same state always projects the same view", () => {
    const state = drive([
      { type: "select-mode", mode: "compose" },
      { type: "decide-change", index: 2 },
      { type: "open-overlay", overlay: "conflict" },
    ]);
    expect(JSON.stringify(desktopVisualView(state))).toBe(
      JSON.stringify(desktopVisualView(state)),
    );
  });
});
