import type { ProofMedia } from "../../lib/site-content.js";
import { SignalIcon, StatusIcon } from "./signal-icon.js";

/**
 * The runnable-surfaces level a capture evidences, as a status chip. Startable is a
 * validated fact; partial stays dormant, because the capture shows less than the whole
 * behaviour it names.
 */
const LEVEL_CHIP = Object.freeze({
  startable: Object.freeze({ label: "Startable", tone: "validated" }),
  partial: Object.freeze({ label: "Partial", tone: "dormant" }),
});

/**
 * One real Engine Desktop capture with its caption and limits (decision DEC-05).
 *
 * A server component on purpose: it renders data and holds no state, so the umbrella's
 * client-component set stays the reviewed eight. The image is a plain `<img>` rather than
 * `next/image`, so the served bytes are exactly the pixel-identical file recorded in
 * `MEDIA-PROVENANCE.md` and no optimizer re-encodes them. The image is not a link and
 * has no hover: the only affordance is the proof link, which goes to a route that serves
 * the evidence behind the claim.
 *
 * Every limitation renders, always, as its own chip. A caption that lost them would claim
 * more than the capture shows.
 */
export function ProofFigure({
  media,
  sizes,
  variant = "card",
}: {
  readonly media: ProofMedia;
  /** The rendered width the page gives this figure, for the browser's source choice. */
  readonly sizes: string;
  readonly variant?: "card" | "wide";
}) {
  const level = media.level === null ? null : LEVEL_CHIP[media.level];

  return (
    <figure className={`proof-figure proof-figure-${variant}`} data-proof-era="historical">
      <div className="proof-frame">
        <img
          src={media.src}
          srcSet={`${media.src} ${media.width}w`}
          sizes={sizes}
          width={media.width}
          height={media.height}
          alt={media.alt}
          loading="lazy"
          decoding="async"
        />
      </div>
      <figcaption className="proof-caption">
        <p className="proof-history">Historical capture · 2026-09-28 · Not current runtime proof</p>
        {level !== null && (
          <span className={`chip chip-${level.tone} proof-level`}>
              <StatusIcon status={level.tone} />
              {level.label}
            </span>
        )}
        <h3 className="proof-title">{media.title}</h3>
        <p className="proof-claim">{media.claim}</p>
        <ul className="proof-limits" aria-label="Limits of this image">
          {media.limitation.map((limit) => (
            <li className="chip chip-dormant" key={limit}>
                <SignalIcon name="limit" />
                {limit}
            </li>
          ))}
        </ul>
        {media.proofHref !== null && media.proofLabel !== null && (
          <a className="proof-link" href={media.proofHref}>
            <span className="proof-link-label">{media.proofLabel}</span>
            <span className="glyph" aria-hidden="true">
              →
            </span>
          </a>
        )}
      </figcaption>
    </figure>
  );
}
