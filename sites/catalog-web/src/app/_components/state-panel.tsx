/**
 * The storefront's thin React adapter over site-kit's shared state-panel model.
 *
 * React stays in this install root; status/refusal semantics stay in site-kit. v6
 * (DIRECTION §3): the panel renders the site-kit interlock tree — plate (label + icon +
 * paint), heading, reason code, body — and writes its own `data-density`, so the shared
 * `.sx-interlock` rules read density from the panel itself, never from an ancestor or the
 * viewport. The placement chooses it: an acquire block is comfortable even when it sits in
 * a narrow column (the v5 defect rendered the refusal at editor-dock density there).
 *
 * The plate is never paint alone: the state word is text, the icon is decorative, and the
 * pending (yellow) plate takes the site-kit class that ships its boundary line with it.
 */
import { createStatePanelModel } from "@sceneaxi/site-kit/state-panel";
import type { StatePanelDensity, StatePanelTone } from "@sceneaxi/site-kit/state-panel";
import { StatePlate } from "./state-plate.js";

export function StatePanel({
  tone,
  title,
  reason,
  level,
  density = "comfortable",
  children,
}: {
  readonly tone: Exclude<StatePanelTone, "iso">;
  readonly title: string;
  readonly reason?: string | undefined;
  /** Heading level; defaults to the model's h3. A panel that sits beside h2 sections takes 2. */
  readonly level?: 2 | 3 | undefined;
  /** Chosen by the placement, never by the viewport (DIRECTION §3). */
  readonly density?: StatePanelDensity | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  // The model reads `reason` through `??`, so an explicit undefined renders like an omitted one.
  const input = { tone, title, density, reason };
  const model = createStatePanelModel(level === undefined ? input : { ...input, level });

  const Heading = model.headingTag;

  return (
    <section
      className={model.interlockClassName}
      data-status={model.status.id}
      data-density={model.attributes["data-density"]}
      data-state={model.attributes["data-state"]}
    >
      <div className="sx-interlock-head">
        <StatePlate tone={tone} label={model.state.plate} />
        <Heading>{model.title}</Heading>
      </div>
      {model.reason !== null && (
        <code className="reason sx-interlock-reason">reason: {model.reason}</code>
      )}
      {children}
    </section>
  );
}
