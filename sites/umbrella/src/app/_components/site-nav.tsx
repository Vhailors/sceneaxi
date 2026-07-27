"use client";

/**
 * The primary navigation strip.
 *
 * A client component for one reason: `aria-current="page"` has to know the active
 * route, and the accepted screen marks the active item visually as well. The visual
 * marker and the assistive one are the same state, so neither can drift from the other.
 *
 * It holds no other behaviour — no menu state, no focus trap, no JavaScript-only
 * disclosure. On narrow viewports the strip scrolls horizontally, so every destination
 * stays a real link reachable by keyboard at every size.
 */
import { usePathname } from "next/navigation";

export interface NavItem {
  readonly href: string;
  readonly label: string;
}

export function SiteNav({ items }: { readonly items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Primary">
      {items.map((item) => {
        // Exact match for the overview, prefix match for every section below it, so a
        // nested route still marks its own section rather than nothing.
        const active =
          item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <a key={item.href} href={item.href} {...(active ? { "aria-current": "page" as const } : {})}>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
