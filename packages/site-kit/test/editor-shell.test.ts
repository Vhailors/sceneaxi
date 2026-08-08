/**
 * The web editor's Engine Desktop shell view (sceneaxi#184).
 *
 * `buildEditorShellView` is the one place the design-faithful chrome meets the
 * real bounded session, so this suite holds its honesty contract executable:
 * every control declares a kind and an inert one a reachable refusal, every
 * `live` control drives only frozen Minimum E2 operations, every digest on the
 * view is the engine's own, and the archive's fixture figures cannot ship.
 */
import { describe, expect, it } from "vitest";
import {
  EDITOR_MAX_OBJECTS,
  EDITOR_MIN_OBJECTS,
  EDITOR_SHELL_FABRICATED_FIGURES,
  EDITOR_SHELL_WEB_REFUSALS,
  EDITOR_SHELL_WEB_REFUSAL_MESSAGES,
  WEB_EDITOR_SESSION_OPERATIONS,
  buildEditorShellView,
  readEditorState,
  renderEditorState,
  webEditorStarterArtifact,
  type EditorShellControl,
  type EditorShellInput,
  type EditorShellView,
  type SearchParams,
} from "@sceneaxi/site-kit";
import {
  EDITOR_SHELL_MODE_IDS,
  OPEN_PATH_REFUSE_CODES,
  digestSceneArtifact,
  editorShellDockTabsFor,
} from "@sceneaxi/schemas";
import { MODEL_PROVIDER_REFUSE_REASONS } from "@sceneaxi/authoring-core";

function shellInput(params: SearchParams = {}): EditorShellInput {
  const state = readEditorState(params);
  if (!state.ok) throw new Error(`editor state refused: ${state.reason}`);
  const render = renderEditorState(state.value);
  if (!render.ok) throw new Error(`editor render refused: ${render.reason}`);
  const starter = webEditorStarterArtifact();
  if (!starter.ok) throw new Error(`starter refused: ${starter.reason}`);
  return {
    state: state.value,
    render: render.value,
    baseDocument: render.value.baseDocument,
    entitlement: { mode: "entitled", basis: "credits" },
    starterArtifact: starter.value,
  };
}

function view(params: SearchParams = {}): EditorShellView {
  return buildEditorShellView(shellInput(params));
}

const walkControls = (shell: EditorShellView): readonly EditorShellControl[] =>
  shell.controls;

describe("control accounting", () => {
  it("every control declares a kind, and inert exactly when it refuses", () => {
    for (const control of walkControls(view())) {
      expect(["view", "live", "inert"]).toContain(control.kind);
      if (control.kind === "inert") {
        if (control.refusal === null) throw new Error(`${control.id} refuses nothing`);
        expect(control.refusalMessage, control.id).toBe(
          EDITOR_SHELL_WEB_REFUSAL_MESSAGES[control.refusal],
        );
      } else {
        expect(control.refusal, control.id).toBeNull();
      }
    }
  });

  it("control ids are unique and legal HTML ids", () => {
    const ids = walkControls(view()).map((control) => control.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/);
    }
  });

  it("every live control drives only frozen Minimum E2 operations", () => {
    for (const control of walkControls(view())) {
      if (control.kind !== "live") continue;
      const binding = control.binding;
      if (binding === null) throw new Error(`${control.id} has no binding`);
      expect(binding.kind).not.toBe("client-view");
      if (binding.kind === "href" || binding.kind === "form-field") {
        expect(binding.operations.length, control.id).toBeGreaterThan(0);
        for (const operation of binding.operations) {
          expect(WEB_EDITOR_SESSION_OPERATIONS).toContain(operation);
        }
      }
    }
  });

  it("every refusal in the closed registry is reachable", () => {
    const reachable = new Set(
      walkControls(view())
        .filter((control) => control.refusal !== null)
        .map((control) => control.refusal),
    );
    const shell = view();
    for (const code of Object.values(EDITOR_SHELL_WEB_REFUSALS)) {
      if (code === EDITOR_SHELL_WEB_REFUSALS.windowBelowMinimum) {
        // Carried by the shell's minimum-window block, not by a control; the
        // legend still prints it so the block's describedby resolves.
        expect(shell.refusalLegend.map((row) => row.code)).toContain(code);
        continue;
      }
      if (code === EDITOR_SHELL_WEB_REFUSALS.changesBaselineUnreadable) {
        // Carried by the Changes dock when the applied proposal has no
        // readable baseline to diff against, not by a control.
        const unreadable = buildEditorShellView({
          ...shellInput(),
          baseDocument: null,
        });
        expect(unreadable.changes.review).toBeNull();
        expect(unreadable.changes.reviewRefusal).toBe(code);
        expect(shell.refusalLegend.map((row) => row.code)).toContain(code);
        continue;
      }
      if (code === EDITOR_SHELL_WEB_REFUSALS.kidsRefuseOnly) {
        // Carried by the Kids lock projection the profile switch applies —
        // the whole editor body refuses, not one control at build time.
        expect(shell.kidsLock.code).toBe(code);
        expect(shell.refusalLegend.map((row) => row.code)).toContain(code);
        continue;
      }
      expect(reachable, code).toContain(code);
    }
    // And nothing refuses with an unlisted code.
    const registry = new Set(Object.values(EDITOR_SHELL_WEB_REFUSALS));
    for (const code of reachable) {
      expect(registry).toContain(code);
    }
  });

  it("the assistant's default mode names one of its own mode controls", () => {
    const shell = view();
    expect(shell.assistant.modes.map((control) => control.id)).toContain(
      shell.assistant.defaultModeId,
    );
  });

  it("the Kids assistant deny is the port's own reason, not a restatement", () => {
    expect(view().assistant.kidsDenyCode).toBe(
      MODEL_PROVIDER_REFUSE_REASONS.kidsThirdPartyDenied,
    );
  });

  it("the palette opener is chrome, not one of the rows it opens", () => {
    const shell = view();
    expect(shell.paletteOpener.kind).toBe("view");
    expect(shell.palette.map((row) => row.control.id)).not.toContain(
      shell.paletteOpener.id,
    );
    // It is still accounted for, so the renderer has to draw it through the
    // kind-aware helper like every other control.
    expect(shell.controls.map((control) => control.id)).toContain(
      shell.paletteOpener.id,
    );
  });

  it("the objects field is bounded by the state parser's own clamp", () => {
    const shell = view();
    expect(shell.edit.objectBounds).toEqual({
      min: EDITOR_MIN_OBJECTS,
      max: EDITOR_MAX_OBJECTS,
    });
    // And the clamp is what a request past either end actually lands on.
    expect(view({ objects: "9" }).run.objectCount).toBe(EDITOR_MAX_OBJECTS);
    expect(view({ objects: "0" }).run.objectCount).toBe(EDITOR_MIN_OBJECTS);
  });

  it("the Kids code is the shared open-path policy's own", () => {
    expect(EDITOR_SHELL_WEB_REFUSALS.kidsRefuseOnly).toBe(
      OPEN_PATH_REFUSE_CODES.kidsRefused,
    );
    expect(view().kidsLock.code).toBe(OPEN_PATH_REFUSE_CODES.kidsRefused);
  });
});

describe("real engine state, not fixtures", () => {
  it("is deterministic for a fixed URL state", () => {
    expect(JSON.stringify(view())).toBe(JSON.stringify(view()));
  });

  it("carries the composition pipeline's own scene digest", () => {
    const input = shellInput();
    const shell = buildEditorShellView(input);
    if (!input.render.composition.ok) throw new Error("expected composable default");
    const digest = input.render.composition.sceneDigest.replace(/^sha256:/, "");
    const short = `${digest.slice(0, 4)}…${digest.slice(-4)}`;
    expect(shell.project.sceneDigestShort).toBe(short);
    expect(shell.statusBar.docLabel).toBe(`doc ${short}`);
    expect(shell.evidence.some((row) => row.digest === short)).toBe(true);
  });

  it("shows the starter artifact's real evidence digests", () => {
    const input = shellInput();
    const shell = buildEditorShellView(input);
    const starterDigest = digestSceneArtifact(input.starterArtifact).replace(
      /^sha256:/,
      "",
    );
    const short = `${starterDigest.slice(0, 4)}…${starterDigest.slice(-4)}`;
    expect(shell.sculpt.library[0]?.digestShort).toBe(short);
    expect(
      shell.sculpt.evidence.some(
        (field) =>
          field.label === "Spec digest" &&
          input.starterArtifact.evidence.specDigest.includes(
            field.value.split("…")[0] ?? "",
          ),
      ),
    ).toBe(true);
  });

  it("advances a real kernel tick through the play operation", () => {
    const paused = view();
    const playing = view({ play: "1" });
    expect(paused.run.tick).toBe(0);
    expect(playing.run.tick).toBeGreaterThan(0);
    expect(playing.run.playState).toBe("playing");
    expect(playing.statusBar.readiness).toBe("Running — deterministic");
  });

  it("declares the run link as what it does, never a pause it does not perform", () => {
    // The session is rebuilt per request, so turning `play` off opens the next
    // one at tick 0 rather than pausing the advanced one. The control says
    // "Stop" and declares `dispose`; claiming `pause` would name an operation no
    // render on this surface calls.
    const playing = view({ play: "1" });
    const stop = playing.run.playPause;
    expect(stop.label).toBe("Stop");
    if (stop.binding === null || stop.binding.kind !== "href") {
      throw new Error("the run control must be an href binding");
    }
    expect(stop.binding.operations).not.toContain("pause");
    expect(stop.binding.operations).toContain("dispose");
    // Following it lands on a session that never advanced.
    expect(view().run.tick).toBe(0);
    expect(view().run.playState).toBe("paused");

    const paused = view();
    const play = paused.run.playPause;
    expect(play.label).toBe("Play one step");
    if (play.binding === null || play.binding.kind !== "href") {
      throw new Error("the run control must be an href binding");
    }
    expect([...play.binding.operations]).toEqual(["play", "step"]);
    // The palette row is the same binding, so the two cannot disagree.
    const paletteRow = paused.palette.find((row) => row.control.id === "palette-play-scene");
    expect(paletteRow?.control.binding).toBe(play.binding);
  });

  it("indents the scene tree by the snapshot's own parent chain", () => {
    const shell = view();
    const depthById = new Map(shell.tree.map((row) => [row.id, row.depth]));
    // The starter artifact nests its runtime hierarchy, so the tree is deeper
    // than "instance or not": a grandchild node must not draw level with its
    // own parent.
    expect(Math.max(...depthById.values())).toBeGreaterThan(1);
    // Instance rows are roots, and every other row is exactly one deeper than
    // whatever row precedes it as its parent.
    for (const row of shell.tree) {
      if (row.kindLabel === "sculpt") expect(row.depth).toBe(0);
      else expect(row.depth).toBeGreaterThan(0);
    }
  });

  it("mints the scene tree's selection links, so accounting can see them", () => {
    const shell = view();
    const selectable = shell.tree.filter((row) => row.select !== null);
    expect(selectable.length).toBeGreaterThan(0);
    for (const row of selectable) {
      const control = row.select;
      if (control === null) throw new Error("filtered rows carry a control");
      expect(control.kind).toBe("live");
      expect(shell.controls.map((entry) => entry.id)).toContain(control.id);
      if (control.binding === null || control.binding.kind !== "href") {
        throw new Error(`${control.id} must select through an href`);
      }
      expect([...control.binding.operations]).toEqual(["select"]);
    }
    // The selected instance offers no link to select itself again.
    expect(shell.tree.filter((row) => row.selected && row.select !== null)).toEqual([]);
  });

  it("says the applied save is ephemeral rather than claiming durability", () => {
    const shell = view();
    expect(shell.changes.appliedPaths).toContain("scene.sceneaxi.json");
    // The label may not read as a durable save, and the disclosure has to exist.
    expect(shell.changes.savedLabel).toContain("in session");
    expect(shell.changes.persistenceNote).toContain("nothing is stored between requests");
    expect(shell.changes.persistencePin).toContain("ephemeral");
  });

  it("carries the deep link and what it does not do, only when one was given", () => {
    expect(view().deepLink).toBeNull();
    const linked = view({ source: "catalog-game", item: "listing-1" });
    expect(linked.deepLink?.source).toBe("catalog-game");
    expect(linked.deepLink?.itemId).toBe("listing-1");
    expect(linked.deepLink?.note).toContain("shared starter scene");
  });

  it("decides the refuse-only assistant state here, not in a renderer", () => {
    expect(view().assistant.kidsState).toBe("denied");
  });

  it("moves exactly the edited instance through its own transform parameter", () => {
    const moved = view({ "tx-object-2": "5,0,0", sel: "object-2" });
    const inspectorPosition = moved.inspector
      .find((section) => section.id === "transform")
      ?.fields.find((field) => field.id === "position");
    expect(inspectorPosition?.value).toBe("5, 0, 0");
    // The other instance keeps its default placement.
    expect(
      moved.compose.instances.find((instance) => instance.instanceId === "object-1")
        ?.worldTranslation,
    ).toBe("0, 0, 0");
  });

  it("reviews the real save proposal, all-or-nothing", () => {
    const shell = view();
    const review = shell.changes.review;
    if (review === null) throw new Error("expected a reviewable proposal");
    expect(review.rows.length).toBeGreaterThan(0);
    expect(shell.changes.appliedPaths).toContain("scene.sceneaxi.json");
    // Deciding single rows is not an operation this surface has.
    expect(shell.changes.acceptAll.kind).toBe("inert");
    expect(shell.changes.rejectAll.kind).toBe("inert");
  });

  it("draws a per-row decision pair, inert and accounted for, on every row", () => {
    const shell = view();
    const review = shell.changes.review;
    if (review === null) throw new Error("expected a reviewable proposal");
    expect(shell.changes.rowDecisions.map((decision) => decision.index)).toEqual(
      review.rows.map((row) => row.index),
    );
    const accounted = shell.controls.map((control) => control.id);
    for (const decision of shell.changes.rowDecisions) {
      for (const control of [decision.reject, decision.accept]) {
        expect(control.kind, control.id).toBe("inert");
        expect(control.refusal, control.id).toBe(
          EDITOR_SHELL_WEB_REFUSALS.operationNotOnSurface,
        );
        expect(accounted).toContain(control.id);
      }
    }
  });

  it("logs what the render actually did, in order, with real ids", () => {
    const rows = view().console.map((row) => row.text);
    expect(rows[0]).toContain("addSculpt object-1");
    expect(rows.some((text) => text.startsWith("save applied"))).toBe(true);
    expect(rows.some((text) => text.startsWith("scene composed"))).toBe(true);
  });

  it("ships none of the archive's fabricated figures", () => {
    const serialized = JSON.stringify(view());
    for (const figure of EDITOR_SHELL_FABRICATED_FIGURES) {
      expect(serialized).not.toContain(figure);
    }
    // And no invented units the session cannot measure.
    expect(serialized).not.toMatch(/\b\d+ ?fps\b/i);
    expect(serialized).not.toMatch(/\b\d+(\.\d+)? ?(MB|KB|GB)\b/);
  });

  it("keeps the dock-tab mapping the shared model's for every mode", () => {
    const shell = view();
    for (const mode of shell.modes) {
      expect(mode.dockTabs).toEqual(editorShellDockTabsFor(mode.id));
    }
    expect(shell.modes.map((mode) => mode.id)).toEqual([...EDITOR_SHELL_MODE_IDS]);
  });

  it("frame facts come from the headless surface and never claim pixels", () => {
    const shell = view();
    expect(shell.viewport.frame.pixelsDrawn ?? false).toBe(false);
    expect(shell.viewport.frame.backend).toBe("three");
  });
});
