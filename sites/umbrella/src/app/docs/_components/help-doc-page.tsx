import { HELP_DOCS } from "../../../lib/help-docs.js";

/**
 * One help guide, in the docs shell.
 *
 * The rail marks the guide being read with `aria-current`, decided here on the server
 * from the slug the route passes, so the reader's location is in the markup before any
 * script runs. Onward links name where they go: `→` stays on this site, `↗` leaves it.
 */
export function HelpDocPage({ slug }: { readonly slug: string }) {
  const doc = HELP_DOCS.find((entry) => entry.slug === slug);

  if (doc === undefined) throw new Error(`Unknown help document: ${slug}`);

  return (
    <div className="docs-shell docs-shell-doc">
      <nav className="docs-rail" aria-label="Documents">
        <div className="docs-rail-group">
          <p className="docs-rail-title">Help</p>
          <a href="/docs">All documentation</a>
          {HELP_DOCS.map((entry) => (
            <a
              key={entry.slug}
              href={`/docs/${entry.slug}`}
              {...(entry.slug === doc.slug ? { "aria-current": "page" as const } : {})}
            >
              {entry.title}
            </a>
          ))}
        </div>
      </nav>

      <article className="docs-main docs-article" data-doc={doc.slug}>
        <nav aria-label="Breadcrumb">
          <ol className="crumbs">
            <li>
              <a href="/docs">Docs</a>
            </li>
            <li aria-current="page">{doc.title}</li>
          </ol>
        </nav>
        <h1>{doc.title}</h1>
        {doc.sections.map((section) => (
          <section className="docs-section" key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <nav className="doc-links guide-list guide-list-compact" aria-label="Related links">
          {doc.links.map((link) => (
            <a className="guide-link" href={link.href} key={link.href}>
              <span className="guide-title">
                {link.label}
                <span className="glyph" aria-hidden="true">
                  {link.href.startsWith("https://") ? "↗" : "→"}
                </span>
              </span>
              <code className="guide-route">{link.href}</code>
            </a>
          ))}
        </nav>
        <p>
          <a href="/docs">Back to all documentation</a>
        </p>
      </article>
    </div>
  );
}
