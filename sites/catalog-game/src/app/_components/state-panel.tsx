/**
 * The storefront's thin React adapter over site-kit's shared state-panel model.
 *
 * React stays in this install root; status/refusal semantics stay in site-kit.
 */
import { createStatePanelModel } from "@sceneaxi/site-kit/state-panel";
import type { StatePanelTone } from "@sceneaxi/site-kit/state-panel";

export function StatePanel({
  tone,
  title,
  reason,
  level,
  children,
}: {
  readonly tone: Exclude<StatePanelTone, "iso">;
  readonly title: string;
  /** Heading level; defaults to the model's h3. A panel directly under an h1 takes 2. */
  readonly level?: 2 | 3 | undefined;
  readonly reason?: string | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  const model = createStatePanelModel({
    tone,
    title,
    ...(level === undefined ? {} : { level }),
    ...(reason === undefined ? {} : { reason }),
  });
  const Heading = model.headingTag;

  // The heading leads and the status chip follows it in DOM order (DIRECTION §5 chip
  // rule), so the tone is carried in words as well as by the hairline colour (DV-F6).
  return (
    <section className={model.sectionClassName} data-status={model.status.id}>
      <div className="state-head">
        <Heading>{model.title}</Heading>
        <span className={`chip chip-${model.status.id}`}>
          <span className="chip-dot" aria-hidden="true" />
          {model.status.label}
        </span>
      </div>
      {children}
      {model.reason !== null && <code className="reason">reason: {model.reason}</code>}
    </section>
  );
}
