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
          <dd>v{view.document.schemaVersion} text-canonical / URL-carried</dd>
          <dt>Document</dt>
          <dd className="mono">{view.documentDigest}</dd>
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
        <form method={view.form.method} action={view.form.action} className="webxp-form">
          <input
            type="hidden"
            name={view.form.profile.name}
            value={view.form.profile.value}
          />
          <label htmlFor={view.form.title.id}>Page title</label>
          <input
            id={view.form.title.id}
            name={view.form.title.name}
            maxLength={view.form.title.maxLength}
            defaultValue={view.page.title}
            data-kind={view.form.title.kind}
            data-operation={view.form.title.operation}
          />

          <label htmlFor={view.form.layout.id}>Site canvas</label>
          <select
            id={view.form.layout.id}
            name={view.form.layout.name}
            defaultValue={view.canvas.layout}
            data-kind={view.form.layout.kind}
            data-operation={view.form.layout.operation}
          >
            {view.form.layout.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label htmlFor={view.form.html.id}>Page HTML</label>
          <textarea
            id={view.form.html.id}
            name={view.form.html.name}
            maxLength={view.form.html.maxLength}
            rows={12}
            defaultValue={view.page.html}
            data-kind={view.form.html.kind}
            data-operation={view.form.html.operation}
          />

          <label className="webxp-check" htmlFor={view.form.asset.id}>
            <input
              id={view.form.asset.id}
              type="checkbox"
              name={view.form.asset.name}
              value={view.form.asset.value}
              defaultChecked={view.assets.length > 0}
              data-kind={view.form.asset.kind}
              data-operation={view.form.asset.operation}
            />
            Inject the known starter asset
          </label>
          <label className="webxp-check" htmlFor={view.form.three.id}>
            <input
              id={view.form.three.id}
              type="checkbox"
              name={view.form.three.name}
              value={view.form.three.value}
              defaultChecked={view.threeEmbed.enabled}
              data-kind={view.form.three.kind}
              data-operation={view.form.three.operation}
            />
            Embed the safe Three scene
          </label>

          <button
            type="submit"
            className="ed-primary"
            data-kind={view.form.submit.kind}
            data-operation={view.form.submit.operations.join(" ")}
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
