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
import { createStatePanelModel } from "@sceneaxi/site-kit/state-panel";
import type { StatePanelEvidence, StatePanelTone } from "@sceneaxi/site-kit/state-panel";
import { Fragment } from "react";

export type StateTone = StatePanelTone;

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
  readonly evidence?: readonly StatePanelEvidence[] | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  const model = createStatePanelModel({
    tone,
    title,
    ...(level === undefined ? {} : { level }),
    ...(reason === undefined ? {} : { reason }),
    ...(evidence === undefined ? {} : { evidence }),
    variant: "diagnostic",
  });
  const Heading = model.headingTag;

  return (
    <section className={model.sectionClassName}>
      <div className="state-head">
        <span className={`chip chip-${model.status.id}`}>
          <span className="dot" aria-hidden="true" />
          {model.status.label}
        </span>
        <Heading>{model.title}</Heading>
        {model.reason !== null && (
          <code className="reason">
            <span className="reason-label">reason</span>
            {model.reason}
          </code>
        )}
      </div>
      {children !== undefined && <div className="state-body">{children}</div>}
      {model.evidence.length > 0 && (
        <dl className="dl state-evidence">
          {model.evidence.map((entry) => (
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
