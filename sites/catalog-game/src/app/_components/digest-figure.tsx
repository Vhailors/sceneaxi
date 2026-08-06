import { digestSigil } from "../../lib/digest-sigil.js";

/**
 * The card and hero figure.
 *
 * Everything drawn here is either a pure function of the validated listing record's own
 * digest (the mark) or a real fact printed on top of it (the chips, the short digest, the
 * step marks). Nothing depicts the asset, because the committed listing contract carries
 * no asset payload and this storefront has never rendered one — so the figure is labelled
 * as a mark of the record digest rather than left to read as a preview, and a digest the
 * sigil cannot parse draws no mark at all.
 */
export function DigestFigure({
  digest,
  large = false,
  chips,
  steps,
  stepsLabel,
  stats,
}: {
  readonly digest: string;
  readonly large?: boolean;
  /** Real, short facts overlaid at the top left — fixture mode, availability. */
  readonly chips?: readonly { readonly key: string; readonly label: string; readonly tone?: "accent" | "ok" }[];
  /** How many recorded steps to mark; the listing contract carries none, so no page passes it. */
  readonly steps?: number;
  readonly stepsLabel?: string;
  /** Mono key/value pairs along the bottom of the large figure. */
  readonly stats?: readonly { readonly key: string; readonly value: string }[];
}) {
  const sigil = digestSigil(digest);

  return (
    <div className={large ? "sigil sigil-lg" : "sigil"}>
      {sigil === null ? (
        <span className="sigil-empty">digest unreadable — no mark drawn</span>
      ) : (
        <>
          {large && <span className="sigil-grid" aria-hidden="true" />}
          <span
            className="sigil-chip"
            aria-hidden="true"
            style={
              {
                "--chip-w": `${sigil.widthPercent}%`,
                "--chip-h": `${sigil.heightPercent}%`,
                "--chip-rot": `${sigil.rotateDeg}deg`,
                "--chip-skew": `${sigil.skewDeg}deg`,
                "--chip-from": sigil.gradientFrom,
                "--chip-to": sigil.gradientTo,
              } as React.CSSProperties
            }
          />
          <span className="sigil-scrim" aria-hidden="true" />
        </>
      )}

      {chips !== undefined && chips.length > 0 && (
        <span className="sigil-tl">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className={chip.tone === undefined ? "chip" : `chip chip-${chip.tone}`}
            >
              {chip.label}
            </span>
          ))}
        </span>
      )}

      {sigil !== null && !large && (
        <span className="sigil-br" title={digest}>
          {sigil.shortDigest}
        </span>
      )}

      {steps !== undefined && steps > 0 && !large && (
        <span className="sigil-bl" title={stepsLabel}>
          <span className="sr-only">{stepsLabel}</span>
          {Array.from({ length: steps }, (_step, index) => (
            <span className="sigil-step" key={index} aria-hidden="true" />
          ))}
        </span>
      )}

      {large && stats !== undefined && stats.length > 0 && (
        <span className="detail-stats">
          {stats.map((stat) => (
            <span className="detail-stat" key={stat.key}>
              {stat.key} <strong>{stat.value}</strong>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
