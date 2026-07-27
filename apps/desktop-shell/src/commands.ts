/**
 * The desktop shell's command vocabulary.
 *
 * Held in its own module because two consumers need it and one of them is the
 * visual layer: the command palette in `visual-model.ts` may only mark a row
 * driveable when it names a key of this map, and `app.ts` dispatches from the
 * same map. One list, so a palette row cannot claim a command that does not
 * exist and a new command cannot quietly stay out of the palette's reach.
 */
export const DESKTOP_COMMANDS = Object.freeze({
  status: "Report a document's id, content hash, and top-level data keys",
  propose: "Propose a JSON Pointer edit and render the diff for review",
  apply: "Propose and accept an edit in one non-interactive step",
  undo: "Undo the last completed apply",
  "open-path":
    "Report the shared open-path demo policy, or evaluate one demo operation against it (demo only; never a shipping claim)",
  chrome:
    "Render the Engine Desktop editor chrome for one visual state as a self-contained HTML document (draws no pixels; mounts no renderer)",
});

export type DesktopCommandName = keyof typeof DESKTOP_COMMANDS;
