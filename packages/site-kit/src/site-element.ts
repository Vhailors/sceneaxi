/**
 * A framework-neutral element tree, so one visual definition can serve three
 * separate install roots.
 *
 * The `sites/` tier is React (ADR 0018 keeps each site its own install root), but
 * this package must stay framework-free — only a site's own `src/app` tree may
 * import React at all. A shared *primitive* therefore cannot be a component. It can be a
 * description of one: a tiny tree a React site maps to `createElement` in a few
 * lines, and that this module can serialize to HTML for server rendering, for
 * static evidence, and for gate tests that need no browser.
 *
 * This is deliberately not a rendering library. There is no state, no event
 * model, no lifecycle, and no diffing — behaviour stays with the surface that
 * owns it. What travels is structure, class names, text, and ARIA.
 */

export type SiteElement = {
  readonly tag: string;
  readonly className: string | null;
  readonly attributes: Readonly<Record<string, string>>;
  /** Text content. Mutually exclusive with `children` by construction. */
  readonly text: string | null;
  readonly children: readonly SiteElement[];
};

export type SiteElementProps = {
  readonly className?: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly text?: string;
};

const TAG_NAME = /^[A-Za-z][A-Za-z0-9-]*$/;
const ATTRIBUTE_NAME = /^[A-Za-z_:][-A-Za-z0-9_:.]*$/;

/**
 * Build a frozen element. Pass `text` for a leaf, `children` for a branch.
 *
 * A tag and an attribute name are structure, not content, so neither can be made
 * safe by escaping: they are checked here instead, once, so no tree can exist
 * that any consumer — this module's serializer or a site's own `createElement`
 * mapping — could turn into markup its author did not write. A tag is mandatory
 * structure, so an invalid one throws; an attribute is optional, so an invalid
 * name is dropped rather than taking a page down with it.
 */
export function el(
  tag: string,
  props: SiteElementProps = {},
  children: readonly SiteElement[] = [],
): SiteElement {
  if (!TAG_NAME.test(tag)) throw new Error(`Invalid SiteElement tag name: ${JSON.stringify(tag)}`);

  const attributes: Record<string, string> = {};
  for (const [name, value] of Object.entries(props.attributes ?? {})) {
    if (ATTRIBUTE_NAME.test(name)) attributes[name] = value;
  }

  return Object.freeze({
    tag,
    className: props.className ?? null,
    attributes: Object.freeze(attributes),
    text: props.text ?? null,
    children: Object.freeze([...children]),
  });
}

const ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

/** Escape text and attribute values for HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

const VOID_TAGS: ReadonlySet<string> = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/**
 * Serialize an element tree to HTML.
 *
 * Every text node and attribute value is escaped, and `el()` has already refused
 * or dropped any tag or attribute name escaping could not have made safe, so a
 * document path, a pointer, or a proposed value carried by a view model can never
 * reach the page as markup.
 */
export function renderSiteElementHtml(element: SiteElement): string {
  const attributes = [
    ...(element.className === null ? [] : [`class="${escapeHtml(element.className)}"`]),
    ...Object.entries(element.attributes).map(
      ([name, value]) => `${name}="${escapeHtml(value)}"`,
    ),
  ];
  const open = attributes.length === 0 ? element.tag : `${element.tag} ${attributes.join(" ")}`;

  if (VOID_TAGS.has(element.tag)) return `<${open}>`;

  const inner =
    element.text !== null
      ? escapeHtml(element.text)
      : element.children.map((child) => renderSiteElementHtml(child)).join("");

  return `<${open}>${inner}</${element.tag}>`;
}
