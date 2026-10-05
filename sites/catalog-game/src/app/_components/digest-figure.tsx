import { digestSigil } from "../../lib/digest-sigil.js";

/**
 * The record plate: the card, hero and detail figure.
 *
 * Everything drawn here is either a pure function of the validated listing record's own
 * digest (the mark) or a real fact printed on top of it (the chips, the short digest, the
 * stats). Nothing depicts the asset, because the committed listing contract carries no
 * asset payload and this storefront has never rendered one — so the lead and detail
 * plates carry an on-plate legend naming the figure as a record mark, the card plate
 * prints the digest it was drawn from, and a digest the sigil cannot parse draws no mark
 * at all.
 *
 * `card` is the grid plate; `lead` is the hero's first record, framed by the link around
 * it; `detail` is the listing page's figure, framed on its own with the record stats.
 *
 * The detail figure carries one decorative read line: on first paint it passes over the
 * frame once while the mark is drawn in from the digest, then rests out of sight. The
 * chips and stats are text and stay visible throughout.
 */
export function DigestFigure({
  digest,
  variant: requestedVariant,
  large = false,
  chips,
  stats,
}: {
  readonly digest: string;
  readonly variant?: "card" | "lead" | "detail";
  /** Legacy v1 alias. An explicit variant takes precedence. */
  readonly large?: boolean;
  /** Real, short facts overlaid at the top left — fixture mode, availability. */
  readonly chips?: readonly { readonly key: string; readonly label: string; readonly tone?: "accent" | "ok" }[];
  /** Mono key/value pairs along the bottom of the detail plate. */
  readonly stats?: readonly { readonly key: string; readonly value: string }[];
}) {
  const variant = requestedVariant ?? (large ? "detail" : "card");
  const sigil = digestSigil(digest);

  const legend =
    sigil === null ? null : (
      <span className="plate-legend" title={digest}>
        <span className="plate-legend-label">Record mark · </span><strong>{sigil.shortDigest}</strong>
      </span>
    );

  return (
    <span className={`plate plate-${variant}`} data-sigil={sigil === null ? "unreadable" : "drawn"}>
      <span className="plate-media" aria-hidden="true">
        {sigil !== null && (
          <span
            className="plate-mark"
            style={
              // SAFETY: the object sets only the mark's custom properties, which React's
              // CSSProperties type does not model; every value is a bounded sigil field.
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
        )}
        {sigil !== null && variant === "detail" && <span className="plate-scan" />}
      </span>

      {sigil === null && <span className="plate-empty">digest unreadable — no mark drawn</span>}

      {chips !== undefined && chips.length > 0 && (
        <span className="plate-chips">
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

      {sigil !== null && variant === "card" && (
        <span className="plate-digest" title={digest}>
          {sigil.shortDigest}
        </span>
      )}

      {variant === "lead" && legend}

      {variant === "detail" && (legend !== null || (stats !== undefined && stats.length > 0)) && (
        <span className="plate-stats">
          {legend}
          {stats?.map((stat) => (
            <span className="plate-stat" key={stat.key}>
              {stat.key} <strong>{stat.value}</strong>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
