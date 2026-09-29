/**
 * The storefront's thin React adapter over site-kit's shared state-panel model.
 *
 * React stays in this install root; status/refusal semantics stay in site-kit. The title
 * and the reason key share the head row, so the key is the first thing read after the
 * title and never trails the body text; it wraps under the title where the row is narrow.
 */
import { createStatePanelModel } from "@sceneaxi/site-kit/state-panel";
import type { StatePanelTone } from "@sceneaxi/site-kit/state-panel";

export function StatePanel({
  tone,
  title,
  reason,
  children,
}: {
  readonly tone: Exclude<StatePanelTone, "iso">;
  readonly title: string;
  readonly reason?: string | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  const model = createStatePanelModel({
    tone,
    title,
    ...(reason === undefined ? {} : { reason }),
  });
  const Heading = model.headingTag;

  return (
    <section className={model.sectionClassName}>
      <div className="state-head">
        <Heading>{model.title}</Heading>
        {model.reason !== null && <code className="reason">reason: {model.reason}</code>}
      </div>
      {children}
    </section>
  );
}
