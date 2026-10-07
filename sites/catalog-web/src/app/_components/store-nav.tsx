"use client";

/**
 * The storefront's primary navigation.
 *
 * A client component for one reason: `aria-current="page"` has to know the active route,
 * and the same state draws the visible current marker, so the assistive and the visual
 * state cannot drift apart. The catalogue word stays current across `/` and every
 * `/item/*` detail page, and the publish word on `/publish`. It holds no other behaviour
 * and no menu state: at ≤860px the layout wraps it in the umbrella's no-script `<details>`
 * Menu, so a listing's primary action stays within 5 Tab stops (RULINGS, release fix 2).
 *
 * The labels arrive as props because they are store copy; this file is byte-identical on
 * both storefronts. `children` carries the cross-site family links into the ≤860px Menu
 * panel only (globals.css `.nav-family`); from 861px they are hidden here and reached
 * from the footer, so the masthead's Tab sequence is storemark, Catalogue, publish.
 */
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function StoreNav({
  catalogueLabel,
  publishLabel,
  children,
}: {
  readonly catalogueLabel: string;
  readonly publishLabel: string;
  readonly children?: ReactNode;
}) {
  const pathname = usePathname();
  const onCatalogue = pathname === "/" || pathname.startsWith("/item/");
  const onPublish = pathname === "/publish" || pathname.startsWith("/publish/");

  return (
    <nav className="nav" aria-label="Primary">
      <a href="/" {...(onCatalogue ? { "aria-current": "page" as const } : {})}>
        {catalogueLabel}
      </a>
      <a href="/publish" {...(onPublish ? { "aria-current": "page" as const } : {})}>
        {publishLabel}
      </a>
      {children}
    </nav>
  );
}
