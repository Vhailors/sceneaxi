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
import type {
  StatePanelDensity,
  StatePanelEvidence,
  StatePanelTone,
} from "@sceneaxi/site-kit/state-panel";
import { Fragment } from "react";
import { StatusIcon } from "./signal-icon.js";

export type StateTone = StatePanelTone;

/**
 * Plate paint per tone. `warn` stays the neutral enamel plate on purpose: on this site a
 * warn panel is a notice ("Support status", "Checkout cancelled"), never a change waiting
 * on a commit, and yellow means COMMIT only (RULINGS). The label and glyph still name it.
 */
const PLATE_STATE: Readonly<Record<StateTone, string | undefined>> = Object.freeze({
  ok: "verified",
  deny: "refused",
  iso: "isolated",
  warn: undefined,
});

export function StatePanel({
  tone,
  title,
  level = 3,
  reason,
  evidence,
  density,
  children,
}: {
  readonly tone: StateTone;
  readonly title: string;
  /**
   * Operate density, chosen by placement (DIRECTION §3) and written on the panel itself.
   * Omitted on Persuade routes, where the panel keeps the page's own measure.
   */
  readonly density?: StatePanelDensity;
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
  // The model reads every optional field through `??` / `===`, so an explicit
  // undefined reason or evidence renders exactly like an omitted one.
  const input = { tone, title, reason, evidence, variant: "diagnostic" as const };
  const placed = density === undefined ? input : { ...input, density };
  const model = createStatePanelModel(level === undefined ? placed : { ...placed, level });

  const Heading = model.headingTag;

  return (
    <section
      className={model.sectionClassName}
      {...(model.placed ? { "data-density": model.density } : {})}
    >
      <div className="state-head">
        <span className="sx-plate" data-state={PLATE_STATE[model.tone]}>
          <StatusIcon status={model.status.id} />
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
