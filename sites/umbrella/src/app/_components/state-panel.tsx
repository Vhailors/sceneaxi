/**
 * A named-state panel — the site's first-class designed state (decision D5).
 *
 * Refusal is a defining SceneAxi behaviour, so it gets a designed surface rather than an
 * unstyled fallback: a status chip from the published Foundations vocabulary, a heading,
 * the human sentence, and — always, never behind a disclosure — the machine-readable
 * reason in mono. An unwired plane therefore looks unwired rather than broken, and the
 * key is copy-pasteable into an issue.
 *
 * What this component may not do is as load-bearing as what it does. It never softens a
 * refusal, never hides the key, and offers **no re-attempt affordance**: nothing here decides
 * whether a refused operation can be attempted again, and a button that implied it could
 * would be inventing a contract. Pages link onward to surfaces that exist (account,
 * pricing, the free downloads) — that is a route, not a retry.
 */
import { Fragment } from "react";

/**
 * The tones, mapped onto Foundations' published status vocabulary so a state on this
 * site and a status chip anywhere else in the product read as the same thing.
 */
export type StateTone = "ok" | "warn" | "deny" | "iso";

const TONE_STATUS: Readonly<Record<StateTone, { readonly id: string; readonly label: string }>> =
  Object.freeze({
    ok: Object.freeze({ id: "validated", label: "Validated" }),
    warn: Object.freeze({ id: "needs-review", label: "Needs review" }),
    deny: Object.freeze({ id: "refused", label: "Refused" }),
    iso: Object.freeze({ id: "isolated", label: "Isolated" }),
  });

export function StatePanel({
  tone,
  title,
  level = 3,
  reason,
  evidence,
  children,
}: {
  readonly tone: StateTone;
  readonly title: string;
  /**
   * Heading level for the state's name.
   *
   * A state is a section of the page it sits in, so its heading has to follow that
   * page's outline rather than a fixed level. `3` suits a state under a section heading;
   * a state that *is* the page's first section — a refused route, where the `h1` says
   * the surface is closed and the panel says why — passes `2`, so the document never
   * jumps a level.
   */
  readonly level?: 2 | 3;
  /** The contract's own refusal key. Rendered verbatim whenever one exists. */
  readonly reason?: string | undefined;
  /**
   * Machine facts that belong beside the state — the plane that answered, the mode it
   * ran in. Rendered as a definition list, in the same technical-document treatment the
   * evidence readouts use, so a state and an evidence block are visibly one language.
   */
  readonly evidence?: readonly { readonly term: string; readonly value: string }[] | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  const status = TONE_STATUS[tone];
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <section className={`state state-${tone}`}>
      <div className="state-head">
        <span className={`chip chip-${status.id}`}>
          <span className="dot" aria-hidden="true" />
          {status.label}
        </span>
        <Heading>{title}</Heading>
        {reason !== undefined && (
          <code className="reason">
            <span className="reason-label">reason</span>
            {reason}
          </code>
        )}
      </div>
      {children !== undefined && <div className="state-body">{children}</div>}
      {evidence !== undefined && evidence.length > 0 && (
        <dl className="dl state-evidence">
          {evidence.map((entry) => (
            <Fragment key={entry.term}>
              <dt>{entry.term}</dt>
              <dd>
                <code>{entry.value}</code>
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
    </section>
  );
}
