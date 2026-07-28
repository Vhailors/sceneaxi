import type { FamilyEntry } from "../../lib/family-bar.js";

/**
 * The SceneAxi family bar.
 *
 * The design's version is a runtime store switch inside one file. Here it is what ADR
 * 0018 allows it to be: three ordinary cross-origin links, one of which is the page you
 * are on. Entries whose origin this deployment has not configured render as text — a
 * storefront states the family it belongs to whether or not its siblings are deployed,
 * but it never emits a link it cannot resolve.
 *
 * `resolveFamilyBar` has no Kids key, so nothing here can point at Kids.
 */
export function FamilyBar({
  entries,
  domain,
}: {
  readonly entries: readonly FamilyEntry[];
  readonly domain: string | null;
}) {
  return (
    <div className="family">
      <div className="shell family-inner">
        <span className="family-brand">
          <span className="family-glyph" aria-hidden="true" />
          SceneAxi
        </span>
        <nav aria-label="SceneAxi surfaces">
          <ul className="family-list">
            {entries.map((entry) => (
              <li key={entry.key}>
                {entry.current ? (
                  <span className="family-item is-current" aria-current="page">
                    <span
                      className="family-dot"
                      style={{ background: entry.dot }}
                      aria-hidden="true"
                    />
                    {entry.label}
                  </span>
                ) : entry.href === null ? (
                  <span className="family-item family-unlinked">
                    <span
                      className="family-dot"
                      style={{ background: entry.dot }}
                      aria-hidden="true"
                    />
                    {entry.label}
                  </span>
                ) : (
                  <a className="family-item" href={entry.href}>
                    <span
                      className="family-dot"
                      style={{ background: entry.dot }}
                      aria-hidden="true"
                    />
                    {entry.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
        {domain !== null && <span className="family-domain">{domain}</span>}
      </div>
    </div>
  );
}
