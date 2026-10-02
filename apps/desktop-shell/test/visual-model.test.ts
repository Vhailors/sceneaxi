import { describe, expect, it } from "vitest";
import {
  DESKTOP_MINIMUM_WINDOW,
  DESKTOP_OVERLAY_IDS,
  DESKTOP_PROFILE_IDS,
  DESKTOP_PROFILE_PACKAGES,
  DESKTOP_REFUSAL_MESSAGES,
  DESKTOP_VISUAL_REFUSALS,
  KIDS_ASSISTANT_LOCK_CODE,
  SCULPT_PASSES,
  WINDOW_TIERS,
  applyDesktopVisualAction,
  createDesktopVisualState,
  desktopVisualView,
  kidsAssistantDenial,
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
    expect(
      [
        view.product.open,
        view.product.save,
        view.product.play,
        view.product.exportWeb,
      ].map(
        (control) => control.refusal,
      ),
    ).toEqual(Array(4).fill(DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly));
    expect(view.product.stageHtml.refusal).toBe(
      DESKTOP_VISUAL_REFUSALS.webCapabilityRequired,
    );
    expect(view.product.injectAsset.refusal).toBe(
      DESKTOP_VISUAL_REFUSALS.webCapabilityRequired,
    );
  });

  it("keeps Game and Website driveable", () => {
    for (const profile of ["game", "web"] as const) {
      const view = desktopVisualView(drive([{ type: "select-profile", profile }]));
      expect(view.profileRefusal).toBeNull();
      expect(view.modes.filter((mode) => mode.id === "compose" || mode.id === "plugins")
        .every((mode) => mode.control.kind === "inert" && mode.control.refusal === DESKTOP_VISUAL_REFUSALS.noDocumentBound)).toBe(true);
      expect(view.modes.filter((mode) => mode.id !== "compose" && mode.id !== "plugins")
        .every((mode) => mode.control.kind === "view")).toBe(true);
    }
  });

  it("covers every declared profile id", () => {
    expect([...DESKTOP_PROFILE_IDS].sort()).toEqual(
      Object.keys(DESKTOP_PROFILE_PACKAGES).sort(),
    );
  });
});

describe("desktop visual model — change review", () => {
  it("mints a dismissal's kind from the action it declares", () => {
    // The action a dismissal performs decides its kind, so a dismissal cannot
    // acquire host reach while staying outside the refusal.
    const dismissals = desktopVisualView(createDesktopVisualState()).overlay.dismissals;
    for (const dismissal of dismissals) {
      expect([dismissal.id, dismissal.control.kind]).toEqual([
        dismissal.id,
        dismissal.productAction === null ? "view" : "live",
      ]);
      expect(dismissal.control.refusal).toBeNull();
    }
    // The shipped dialog reports an outcome a response already returned and
    // decides nothing, so no dismissal on it reaches the authoring session.
    expect(
      dismissals.filter((dismissal) => dismissal.productAction !== null).map((d) => d.id),
    ).toEqual([]);
  });

  it("demotes every acting dismissal under the structural Kids refusal", () => {
    // A dismissal that reached the authoring session would have to go inert on
    // the refuse-only profile; one that only closes its dialog stays usable, or
    // the refusal becomes a state you cannot leave.
    const dismissals = desktopVisualView(
      createDesktopVisualState({ profile: "kids" }),
    ).overlay.dismissals;
    for (const dismissal of dismissals) {
      if (dismissal.productAction === null) {
        expect([dismissal.id, dismissal.control.kind]).toEqual([dismissal.id, "view"]);
        expect(dismissal.control.refusal).toBeNull();
      } else {
        expect([dismissal.id, dismissal.control.kind]).toEqual([dismissal.id, "inert"]);
        expect(dismissal.control.refusal).toBe(DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly);
      }
    }
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

  it("keeps the pure preview state action separate from the inert UI control", () => {
    const running = drive([{ type: "start-sculpt" }]);
    expect(desktopVisualView(running).statusText).toBe("Sculpting — pass 1 of 5");
    const cancelled = applyDesktopVisualAction(running, { type: "cancel-sculpt" });
    expect(cancelled.sculpt).toBe("idle");
    expect(desktopVisualView(running).sculpt.cancel.kind).toBe("inert");
  });

  it("activates Sculpt only for the mounted runtime and keeps Cancel exact-job gated", () => {
    const view = desktopVisualView(createDesktopVisualState());
    expect(view.sculpt.start).toMatchObject({
      kind: "inert",
      refusal: DESKTOP_VISUAL_REFUSALS.noPresentationRuntime,
    });
    const mounted = desktopVisualView(createDesktopVisualState({ assistantRuntime: "local" }));
    expect(mounted.sculpt.start).toMatchObject({ kind: "live", refusal: null });
    expect(mounted.sculpt.cancel).toMatchObject({
      kind: "inert",
      refusal: DESKTOP_VISUAL_REFUSALS.noActiveCommand,
    });
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

  it("keeps outcome UI outside constructible visual state", () => {
    expect(
      createDesktopVisualState({ overlay: "outcome" as never }).overlay,
    ).toBeNull();
    expect(
      applyDesktopVisualAction(createDesktopVisualState(), {
        type: "open-overlay",
        overlay: "outcome" as never,
      }).overlay,
    ).toBeNull();
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
        ...view.assistant.routes.map((route) => route.control),
        view.product.renameBrowserFile,
        view.product.deleteBrowserFile,
        view.sculpt.start,
        view.sculpt.cancel,
        view.product.open,
        view.product.save,
        view.product.play,
        view.product.exportWeb,
        view.product.stageHtml,
        view.product.injectAsset,
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
    reached.add(DESKTOP_VISUAL_REFUSALS.noDocumentBound);
    collect(desktopVisualView(createDesktopVisualState({ assistantRuntime: "local" })));
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
      view.assistant.close,
      view.assistant.send,
      view.sculpt.start,
      view.sculpt.cancel,
      view.product.open,
      view.product.save,
      view.product.play,
      view.product.exportWeb,
      view.product.stageHtml,
      view.product.injectAsset,
      view.overlay.search,
      ...view.overlay.shortcuts.map((shortcut) => shortcut.control),
      ...view.overlay.dismissals.map((dismissal) => dismissal.control),
      ...view.drawers.map((drawer) => drawer.control),
      ...view.profiles.map((profile) => profile.control),
      ...view.assistant.modes.map((mode) => mode.control),
      ...view.menus.map((menu) => menu.control),
      ...view.modes.map((mode) => mode.control),
      ...view.dockTabs.map((tab) => tab.control),
      ...view.viewport.sources.map((source) => source.control),
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
        view.assistant.close,
        view.assistant.send,
        view.sculpt.start,
        view.sculpt.cancel,
        view.product.open,
        view.product.save,
        view.product.play,
        view.product.exportWeb,
        view.product.stageHtml,
        view.product.injectAsset,
        view.overlay.search,
        ...view.overlay.shortcuts.map((shortcut) => shortcut.control),
        ...view.overlay.dismissals.map((dismissal) => dismissal.control),
        ...view.drawers.map((drawer) => drawer.control),
        ...view.profiles.map((profile) => profile.control),
        ...view.assistant.modes.map((mode) => mode.control),
        view.changeReview.accept,
        view.changeReview.reject,
        ...view.menus.map((menu) => menu.control),
        ...view.modes.map((mode) => mode.control),
        ...view.dockTabs.map((tab) => tab.control),
        ...view.viewport.sources.map((source) => source.control),
        ...view.overlay.paletteGroups.flatMap((group) =>
          group.items.map((item) => item.control),
        ),
      ].map((control) => control.id);
      expect(ids.filter((id) => !/^[A-Za-z][\w-]*$/.test(id))).toEqual([]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("never claims pixels, and says nothing about which renderer is final", () => {
    const view = desktopVisualView(createDesktopVisualState());
    expect(view.viewport.pixelsDrawn).toBe(false);
    expect(view.viewport.inertNote).toContain("no pixels");
    // The captain settled Three as the product presentation core, so the
    // archive's "not the final choice" line is stale product copy and is not
    // carried — along with the two labels ADR 0017 retired by name.
    const notes = JSON.stringify(view.viewport);
    expect(notes).not.toContain("not the final choice");
    expect(notes).not.toContain("Experimental Three preview");
    expect(notes).not.toContain("non-decision");
  });

  it("decides per profile what the assistant column becomes", () => {
    // The renderer serializes this table, so a browser-side profile switch lands
    // on the model's own answer instead of only relabelling the column.
    const view = desktopVisualView(createDesktopVisualState());
    for (const chip of view.profiles) {
      expect(chip.assistant.state).toBe(chip.refuseOnly ? "denied" : "open");
      expect(chip.assistant.modelLabel).toBe(
        chip.refuseOnly ? "denied" : "no provider configured",
      );
      for (const ctrl of [chip.assistant.toggle, chip.assistant.close]) {
        expect(ctrl.kind).toBe(chip.refuseOnly ? "inert" : "view");
      }
      expect(chip.assistant.send.kind).toBe("inert");
      expect(chip.assistant.send.refusal).toBe(
        chip.refuseOnly
          ? DESKTOP_VISUAL_REFUSALS.kidsAssistantDenied
          : DESKTOP_VISUAL_REFUSALS.noPresentationRuntime,
      );
    }
    // The active profile's column is that same projection, not a second one.
    const kids = desktopVisualView(drive([{ type: "select-profile", profile: "kids" }]));
    const chip = kids.profiles.find((candidate) => candidate.refuseOnly);
    expect(kids.assistant.refusalCode).toBe(KIDS_ASSISTANT_LOCK_CODE);
    expect(kids.assistant.close).toEqual(chip?.assistant.close);
    expect(kids.assistant.refusal).toBe(kidsAssistantDenial().code);
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
      { type: "open-overlay", overlay: "palette" },
    ]);
    expect(JSON.stringify(desktopVisualView(state))).toBe(
      JSON.stringify(desktopVisualView(state)),
    );
  });
});
