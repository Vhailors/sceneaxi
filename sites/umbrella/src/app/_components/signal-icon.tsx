/**
 * The A-rich state glyphs (DIRECTION §5: every state is a label plus an icon, never paint
 * alone). A server component: inline strokes, no sprite id to collide, no client code.
 * Always decorative; the label beside it carries the meaning.
 */
const PATHS = Object.freeze({
  pending: ["M12 3v4", "M12 17v4", "M5 12h14"],
  verified: ["M4 12.5l5 5L20 6.5"],
  refused: ["M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z", "M8 12h8"],
  test: ["M9 3h6", "M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3", "M7.5 15h9"],
  inspect: ["M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13", "M15.5 15.5L21 21", "M8 10.5h5"],
  limit: ["M3 12h12", "M19 5v14", "M11 8l4 4-4 4"],
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  download: ["M12 4v11", "M7 10l5 5 5-5", "M5 20h14"],
  restart: ["M20 12a8 8 0 1 1-2.4-5.7", "M20 4v4h-4"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
});

export type SignalIconName = keyof typeof PATHS;

/** The glyph each site-kit status chip carries beside its label. */
const STATUS_ICON: Readonly<Record<string, SignalIconName>> = Object.freeze({
  validated: "verified",
  "needs-review": "pending",
  refused: "refused",
  dormant: "limit",
  isolated: "limit",
  experimental: "test",
});

export function StatusIcon({ status }: { readonly status: string }) {
  return <SignalIcon name={STATUS_ICON[status] ?? "limit"} />;
}

export function SignalIcon({ name }: { readonly name: SignalIconName }) {
  return (
    <svg className="sx-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name].map((d) => (
        <path d={d} key={d} />
      ))}
    </svg>
  );
}
