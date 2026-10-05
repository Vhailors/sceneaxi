/**
 * The last cell of the listing grid: the route that explains how listing will work.
 *
 * A shelf whose tracks the inventory cannot fill reads as broken, and inventing listings
 * to fill it would be the exact fiction this storefront refuses. So the empty track holds
 * an honest invitation instead: it links `/publish` and says, in the footer card's own
 * words, that publishing is not open yet. Its plate area is an empty dashed frame, with no
 * mark, digest, price or TEST chip, because it is not a listing and must not be mistaken
 * for one. The one chip it carries follows its title and names who it is for.
 */
export function PublishSlot() {
  return (
    <li className="card card-slot">
      <a className="slot-link" href="/publish">
        <span className="slot-plate" aria-hidden="true" />
        <span className="slot-body">
          <span className="slot-title">
            List your work
            <span className="glyph glyph-nudge" aria-hidden="true">
              →
            </span>
          </span>
          <span className="chip chip-accent">For creators</span>
          <span className="slot-text">
            Publishing is not open yet, so the share rule and what a listing would pay are
            published ahead of it.
          </span>
        </span>
      </a>
    </li>
  );
}
