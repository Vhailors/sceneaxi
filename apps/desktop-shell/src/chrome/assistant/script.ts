import { belowTier } from "../core/markup.js";

export function assistantScript(): string {
  return `  // Below the regular tier the assistant is a drawer that starts closed, so the
  // toggle reports the drawer rather than the column state: otherwise it would
  // announce itself pressed over nothing, and its first press would only turn
  // that claim off. One press opens the drawer at every tier.
  const drawerQuery = window.matchMedia('${belowTier("regular")}');

  const assistantOpen = () => shell.dataset.drawerAssistant === 'open';

  const setAssistant = (state) => {
    shell.dataset.assistant = state;
    const open = state === 'open';
    shell.dataset.drawerAssistant = open ? 'open' : 'closed';
    q('.assistant-toggle').forEach((el) => el.setAttribute('aria-pressed', String(open)));
  };

  // Crossing into a drawer tier closes the drawer for the same reason it starts
  // closed, and crossing back out restores the column's own state.
  const syncAssistantTier = () => {
    const open = drawerQuery.matches ? false : shell.dataset.assistant === 'open';
    shell.dataset.drawerAssistant = open ? 'open' : 'closed';
    q('.assistant-toggle').forEach((el) => el.setAttribute('aria-pressed', String(open)));
  };
  drawerQuery.addEventListener('change', syncAssistantTier);`;
}
