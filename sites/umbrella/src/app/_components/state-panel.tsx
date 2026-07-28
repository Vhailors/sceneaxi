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
import { FOUNDATION_STATUSES, type FoundationStatusId } from "@sceneaxi/site-kit";
import { Fragment } from "react";

/**
 * The tones, mapped onto Foundations' published status vocabulary so a state on this
 * site and a status chip anywhere else in the product read as the same thing.
 */
export type StateTone = "ok" | "warn" | "deny" | "iso";

/**
 * A tone selects a published status *by id*; the id is the only thing this site decides.
 * The label beside it — like the colours `umbrellaStatusVariablesCss()` projects — is read
 * back out of `FOUNDATION_STATUSES`, so a status renamed in site-kit renames here rather
 * than silently disagreeing with every other chip in the product. An id site-kit does not
 * publish refuses at module load: this surface may not name a status Foundations has not.
 */
function publishedStatus(id: FoundationStatusId) {
  const status = FOUNDATION_STATUSES.find((candidate) => candidate.id === id);
  if (status === undefined) {
    throw new Error(`Foundations publishes no status "${id}".`);
  }
  return Object.freeze({ id: status.id, label: status.label });
}

const TONE_STATUS: Readonly<
  Record<StateTone, { readonly id: FoundationStatusId; readonly label: string }>
> = Object.freeze({
  ok: publishedStatus("validated"),
  warn: publishedStatus("needs-review"),
  deny: publishedStatus("refused"),
  iso: publishedStatus("isolated"),
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
