/**
 * The storefront's thin React adapter over site-kit's shared state-panel model.
 *
 * React stays in this install root; status/refusal semantics stay in site-kit. The head
 * reads title, then the status chip (DIRECTION §5: a chip follows its heading in DOM
 * order, so the tone is carried in words as well as by the 1px tone frame, DV-F6), then
 * the reason key on its own line, so the key is still the first thing read after the
 * title and never trails the body text.
 */
import { createStatePanelModel } from "@sceneaxi/site-kit/state-panel";
import type { StatePanelTone } from "@sceneaxi/site-kit/state-panel";

type StatePanelInput = { -readonly [Key in keyof Parameters<typeof createStatePanelModel>[0]]: Parameters<typeof createStatePanelModel>[0][Key] };

export function StatePanel({
  tone,
  title,
  reason,
  level,
  children,
}: {
  readonly tone: Exclude<StatePanelTone, "iso">;
  readonly title: string;
  readonly reason?: string | undefined;
  /** Heading level; defaults to the model's h3. A panel that sits beside h2 sections takes 2. */
  readonly level?: 2 | 3 | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  const input: StatePanelInput = { tone, title };

  if (reason !== undefined) input.reason = reason;

  if (level !== undefined) input.level = level;

  const model = createStatePanelModel(input);

  const Heading = model.headingTag;

  return (
    <section className={model.sectionClassName} data-status={model.status.id}>
      <div className="state-head">
        <Heading>{model.title}</Heading>
        <span className={`chip chip-${model.status.id}`}>
          <span className="chip-dot" aria-hidden="true" />
          {model.status.label}
        </span>
        {model.reason !== null && <code className="reason">reason: {model.reason}</code>}
      </div>
      {children}
    </section>
  );
}
