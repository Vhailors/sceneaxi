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
      <Heading>{model.title}</Heading>
      {children}
      {model.reason !== null && <code className="reason">reason: {model.reason}</code>}
    </section>
  );
}
