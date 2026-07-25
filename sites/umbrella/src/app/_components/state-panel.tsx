/**
 * A named-state panel.
 *
 * Every refusal on this site renders through here, carrying the machine-readable
 * reason alongside the human sentence — so an unwired plane looks unwired instead of
 * looking broken, and the reason is copy-pasteable into an issue.
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
