import { HELP_DOCS } from "../../../lib/help-docs.js";

export function HelpDocPage({ slug }: { readonly slug: string }) {
  const doc = HELP_DOCS.find((entry) => entry.slug === slug);
  if (doc === undefined) throw new Error(`Unknown help document: ${slug}`);

  return (
    <article className="docs-main docs-article" data-doc={doc.slug}>
      <ol className="crumbs"><li><a href="/docs">Docs</a></li><li aria-current="page">{doc.title}</li></ol>
      <h1>{doc.title}</h1>
      {doc.sections.map((section) => (
        <section className="docs-section" key={section.heading}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
      <nav aria-label="Related links" className="guide-list guide-list-compact">
        {doc.links.map((link) => (
          <a className="guide-link" href={link.href} key={link.href}>
            <span className="guide-title">{link.label}</span>
            <code className="guide-route">{link.href}</code>
          </a>
        ))}
      </nav>
      <p><a href="/docs">Back to all documentation</a></p>
    </article>
  );
}
