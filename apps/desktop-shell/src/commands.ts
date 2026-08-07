/**
 * The desktop shell's command vocabulary.
 *
 * This is the `sceneaxi-desktop` CLI vocabulary. Interactive window commands
 * live in `interaction-commands.ts`: the two protocols are intentionally
 * separate because renderer-to-host New/Open/Save/Undo/Play are not CLI verbs.
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
