/**
 * Presentation-only pictures and state icons for the Kids studio. Pictures are keyed by
 * the curated world and piece ids; they replace the emoji glyphs on screen while the
 * activity data stays untouched. Every picture and icon is decorative: the visible
 * label next to it carries the meaning.
 */

const INK = "#13302a";

const PICTURES = {
  meadow: (
    <>
      <circle cx="32" cy="32" r="13" fill="#f2c230" stroke={INK} strokeWidth="3" />
      <g stroke={INK} strokeWidth="3.5" strokeLinecap="round">
        <path d="M32 6v7M32 51v7M6 32h7M51 32h7M13.6 13.6l5 5M45.4 45.4l5 5M13.6 50.4l5-5M45.4 18.6l5-5" />
      </g>
    </>
  ),
  moon: (
    <>
      <path d="M40 8a24 24 0 1 0 16 38A20 20 0 0 1 40 8z" fill="#f6e7a0" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 14l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill={INK} />
    </>
  ),
  ocean: (
    <>
      <path d="M4 26c7-7 13-7 20 0s13 7 20 0 13-7 16-3" fill="none" stroke="#1e4fbf" strokeWidth="5" strokeLinecap="round" />
      <path d="M4 42c7-7 13-7 20 0s13 7 20 0 13-7 16-3" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  friend: (
    <>
      <path d="M14 34a18 18 0 0 1 36 0v4H14z" fill="#e0679a" stroke={INK} strokeWidth="3" />
      <path d="M17 38c-2 8-6 10-9 12M25 38c0 9-3 13-6 16M32 38v17M39 38c0 9 3 13 6 16M47 38c2 8 6 10 9 12" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="26" cy="28" r="3.5" fill={INK} />
      <circle cx="38" cy="28" r="3.5" fill={INK} />
    </>
  ),
  tree: (
    <>
      <rect x="28" y="38" width="8" height="20" fill="#8a5a2b" stroke={INK} strokeWidth="3" />
      <circle cx="32" cy="26" r="18" fill="#2f8f3e" stroke={INK} strokeWidth="3" />
    </>
  ),
  star: (
    <path d="M32 6l7.6 16.6 18 2-13.5 12.3 3.8 17.8L32 45.6 16.1 54.7l3.8-17.8L6.4 24.6l18-2z" fill="#f2c230" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
  ),
  rocket: (
    <>
      <path d="M32 4c10 8 13 20 11 34H21C19 24 22 12 32 4z" fill="#ffffff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="32" cy="22" r="5" fill="#1e4fbf" stroke={INK} strokeWidth="2.5" />
      <path d="M21 30l-9 12h10M43 30l9 12H42" fill="#c4362c" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M27 42l5 14 5-14z" fill="#f2c230" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </>
  ),
} satisfies Readonly<Record<string, React.ReactNode>>;

export function Picture({ id, className = "pic" }: { readonly id: string; readonly className?: string }) {
  // SAFETY: an id outside the set reads undefined and renders an empty frame.
  const picture = PICTURES[id as keyof typeof PICTURES];

  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {picture}
    </svg>
  );
}

const ICONS = {
  chosen: <path d="M4 12.5l5 5L20 6.5" />,
  play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />,
  undo: <path d="M9 6L4 11l5 5M4 11h10a5 5 0 0 1 0 10h-3" />,
  restart: <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4" />,
  build: <path d="M4 20h16M6 20v-9h5v9M13 20V6h5v14" />,
  full: <path d="M4 5h16v14H4zM4 10h16M4 15h16" />,
  note: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
  pause: <path d="M5 12h14" />,
  info: <path d="M12 11v6M12 7.5v.5M3.5 12a8.5 8.5 0 1 0 17 0 8.5 8.5 0 1 0-17 0" />,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name }: { readonly name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  );
}
