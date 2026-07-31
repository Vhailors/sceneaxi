/**
 * The editor route owns the whole viewport.
 *
 * The Engine Desktop shell is an application chrome with its own title bar,
 * rail, and status bar (`Engine Desktop.dc.html`), so the site masthead and
 * footer are collapsed for exactly this route. `display: none` removes them
 * from the accessibility tree and the tab order — nothing is merely painted
 * over. The style is route-scoped by construction: Next renders this layout
 * only under `/editor`, and every other route keeps the full site chrome.
 */
export default function EditorLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <>
      <style>{`.masthead, body > footer, .skip-link { display: none; } main#main { padding: 0; }`}</style>
      {children}
    </>
  );
}
