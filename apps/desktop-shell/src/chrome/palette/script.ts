/** Palette dispatch stays in the shared command handler's original position. */
export function paletteScript(): string {
  return `    if (id === T.paletteShortcut.id) {
      setOverlay('palette');
      return;
    }`;
}
