import type {
  MountableScene,
  WebExperienceEditorView,
} from "@sceneaxi/site-kit";
import { EditorViewport } from "./editor-viewport.js";

/**
 * The deliberately smaller Web Experience projection.
 *
 * The server supplied every policy decision. This adapter renders the authored
 * page in an opaque iframe, keeps the safe Three scene in the parent through the
 * existing viewport module, and submits edits as URL state for deterministic
 * server reconstruction. It owns no identity, entitlement, authoring policy, or
 * renderer implementation.
 */
export function WebExperienceEditor({
  view,
  scene,
}: {
  readonly view: WebExperienceEditorView;
  readonly scene: MountableScene | null;
}) {
  return (
    <section className="webxp-editor" aria-label="Web Experience editor">
      <header className="webxp-head">
        <div>
          <p className="eyebrow">Web Experience profile</p>
          <h2>Page canvas</h2>
          <p>
            Page and HTML authoring, one site canvas, known asset injection, and
            a safe Three embed. Desktop engine tools stay outside this surface.
          </p>
        </div>
        <dl className="webxp-session">
          <dt>Session</dt>
          <dd className="mono">{view.sessionId}</dd>
          <dt>Persistence</dt>
          <dd>URL-reconstructable</dd>
        </dl>
      </header>

      <div className="webxp-operations" aria-label="Supported authoring operations">
        {view.operations.map((operation) => (
          <span key={operation} className="ed-chip mono">
            {operation}
          </span>
        ))}
      </div>

      <div className="webxp-grid">
        <form method="get" action="/editor" className="webxp-form">
          <input type="hidden" name="profile" value="web" />
          <label htmlFor="webxp-title">Page title</label>
          <input
            id="webxp-title"
            name="web-title"
            maxLength={80}
            defaultValue={view.page.title}
            data-kind="live"
            data-operation="page.set-html"
          />

          <label htmlFor="webxp-layout">Site canvas</label>
          <select
            id="webxp-layout"
            name="web-layout"
            defaultValue={view.canvas.layout}
            data-kind="live"
            data-operation="site-canvas.configure"
          >
            <option value="hero">Hero</option>
            <option value="split">Split</option>
            <option value="stack">Stack</option>
          </select>

          <label htmlFor="webxp-html">Page HTML</label>
          <textarea
            id="webxp-html"
            name="web-html"
            maxLength={5000}
            rows={12}
            defaultValue={view.page.html}
            data-kind="live"
            data-operation="page.set-html"
          />

          <label className="webxp-check" htmlFor="webxp-asset">
            <input
              id="webxp-asset"
              type="checkbox"
              name="web-asset"
              value="1"
              defaultChecked={view.assets.length > 0}
              data-kind="live"
              data-operation="asset.inject"
            />
            Inject the known starter asset
          </label>
          <label className="webxp-check" htmlFor="webxp-three">
            <input
              id="webxp-three"
              type="checkbox"
              name="web-three"
              value="1"
              defaultChecked={view.threeEmbed.enabled}
              data-kind="live"
              data-operation="three.embed"
            />
            Embed the safe Three scene
          </label>

          <button
            type="submit"
            className="ed-primary"
            data-kind="live"
            data-operation="page.set-html"
          >
            Apply web page state
          </button>
        </form>

        <div className="webxp-canvas" data-layout={view.canvas.layout}>
          <div className="webxp-page-frame">
            <p className="webxp-frame-label mono">sandboxed page / srcDoc</p>
            <iframe
              title={`Sandboxed preview of ${view.page.title}`}
              sandbox={view.canvas.iframeSandbox}
              srcDoc={view.canvas.srcDoc}
              data-kind="view"
            />
          </div>

          <section className="webxp-three" aria-label="Safe Three embed">
            <div className="webxp-three-head">
              <div>
                <p className="eyebrow">Safe Three embed</p>
                <h3>Presentation seam</h3>
              </div>
              <span className="mono">
                {view.threeEmbed.advancesSession ? "advances" : "draw-only"}
              </span>
            </div>
            {view.threeEmbed.enabled && scene !== null ? (
              <EditorViewport
                scene={scene}
                selectedInstanceId={scene.instances[0]?.instanceId ?? ""}
              />
            ) : (
              <p className="webxp-empty">
                {view.threeEmbed.enabled
                  ? "The composed scene refused, so no Three surface was opened."
                  : "Enable the safe Three embed to mount the session scene outside authored HTML."}
              </p>
            )}
          </section>
        </div>

        <aside className="webxp-side" aria-label="Web Experience boundaries">
          <h3>Injected assets</h3>
          {view.assets.length === 0 ? (
            <p>None. Arbitrary URLs and scripts are never accepted as assets.</p>
          ) : (
            <ul>
              {view.assets.map((asset) => (
                <li key={asset.id}>
                  <span className="mono">{asset.id}</span>
                  <span>{asset.kind}</span>
                </li>
              ))}
            </ul>
          )}

          <h3>Desktop-only actions</h3>
          <div className="webxp-refusals">
            {view.desktopRefusals.map((refusal) => (
              <button
                key={refusal.operation}
                type="button"
                aria-disabled="true"
                data-kind="inert"
                data-refusal={refusal.reason}
                title={refusal.message}
              >
                <span>{refusal.operation}</span>
                <span className="mono">{refusal.reason}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
