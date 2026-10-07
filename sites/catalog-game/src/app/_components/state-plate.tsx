/**
 * A named-state plate for the document routes (404, error, loading): label + icon + paint,
 * never paint alone (DIRECTION §4). The icon and paint come from site-kit's state-panel
 * model so this store holds no path data of its own. It imports only the pure
 * `state-panel` entry, so the client error boundary can render it as well.
 */
import { createStatePanelModel, statePlateElement } from "@sceneaxi/site-kit/state-panel";
import type { StatePanelTone } from "@sceneaxi/site-kit/state-panel";

export function StatePlate({
  tone,
  label,
}: {
  readonly tone: StatePanelTone;
  /** The route's own state word; the plate's icon and paint still come from the tone. */
  readonly label: string;
}) {
  const { state } = createStatePanelModel({ tone, title: label });
  const icon = statePlateElement(state).children.find((child) => child.tag === "svg");

  return (
    <p
      className={state.id === "pending" ? "sx-plate sx-plate--pending" : "sx-plate"}
      data-state={state.id}
    >
      <svg className="sx-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {(icon?.children ?? []).map((path) => (
          <path key={path.attributes.d} d={path.attributes.d} />
        ))}
      </svg>
      <span>{label}</span>
    </p>
  );
}
