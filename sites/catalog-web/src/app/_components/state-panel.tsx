/**
 * A named-state panel.
 *
 * Every refusal on this storefront renders through here, carrying the
 * machine-readable reason alongside the human sentence — an inert commerce gate should
 * look deliberate, not broken.
 */
export function StatePanel({
  tone,
  title,
  reason,
  children,
}: {
  readonly tone: "ok" | "warn" | "deny";
  readonly title: string;
  readonly reason?: string | undefined;
  readonly children?: React.ReactNode | undefined;
}) {
  return (
    <section className={`state state-${tone}`}>
      <h3>{title}</h3>
      {children}
      {reason !== undefined && <code className="reason">reason: {reason}</code>}
    </section>
  );
}
