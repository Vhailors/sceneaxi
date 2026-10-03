"use client";

/**
 * The storefront's primary navigation.
 *
 * A client component for one reason: `aria-current="page"` has to know the active route,
 * and the same state draws the visible current marker, so the assistive and the visual
 * state cannot drift apart. The catalogue word stays current across `/` and every
 * `/item/*` detail page, and the publish word on `/publish`. It holds no other behaviour:
 * no menu state and no JavaScript-only disclosure, and on a phone the strip scrolls
 * sideways so every destination stays a real link at every size.
 *
 * The labels arrive as props because they are store copy; this file is byte-identical on
 * both storefronts. The engine link leaves this origin, so it carries the `↗` glyph, and
 * it exists only when the deployment configured an umbrella origin.
 */
import { usePathname } from "next/navigation";

export function StoreNav({
  catalogueLabel,
  publishLabel,
  engine,
}: {
  readonly catalogueLabel: string;
  readonly publishLabel: string;
  readonly engine: { readonly href: string; readonly label: string } | null;
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
      {engine !== null && (
        <a href={engine.href}>
          {engine.label}
          <span className="glyph" aria-hidden="true">
            ↗
          </span>
        </a>
      )}
    </nav>
  );
}
