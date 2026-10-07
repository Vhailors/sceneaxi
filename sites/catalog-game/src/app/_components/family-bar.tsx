import type { FamilyEntry } from "../../lib/family-bar.js";

/**
 * The SceneAxi family bar.
 *
 * The design's version is a runtime store switch inside one file. Here it is what ADR
 * 0018 allows it to be: a statement of the family this storefront belongs to, with the
 * page you are on marked. It holds no links. The cross-origin links live in the footer's
 * SceneAxi column at every width and inside the masthead Menu at ≤860px, because a link
 * here sat between the skip link and a listing's primary action and pushed that action
 * to Tab stop 6 at 1440px (RULINGS, release fix round 2; the brief caps it at 5).
 *
 * `resolveFamilyBar` has no Kids key, so nothing here can name or point at Kids.
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
        <ul className="family-list" aria-label="SceneAxi surfaces">
          {entries.map((entry) => (
            <li key={entry.key}>
              <span
                className={entry.current ? "family-item is-current" : "family-item"}
                {...(entry.current ? { "aria-current": "page" as const } : {})}
              >
                <span
                  className="family-dot"
                  style={{ background: entry.dot }}
                  aria-hidden="true"
                />
                {entry.label}
              </span>
            </li>
          ))}
        </ul>
        {domain !== null && <span className="family-domain">{domain}</span>}
      </div>
    </div>
  );
}
