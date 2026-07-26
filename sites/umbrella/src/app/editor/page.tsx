import {
  WEB_EDITOR_SESSION_OPERATIONS,
  EDITOR_MAX_OBJECTS,
  EDITOR_MIN_OBJECTS,
  editorHref,
  renderEditorState,
  readEditorState,
  type SearchParams,
} from "@sceneaxi/site-kit";
import { createUmbrellaIdentityPlane } from "../../lib/identity-plane.js";
import { resolveUmbrellaEditorAccess } from "../../lib/site-config.js";
import { readSessionToken } from "../_session.js";
import { StatePanel } from "../_components/state-panel.js";

/**
 * The Minimum E2 sculpt/scene web editor.
 *
 * Bounded to exactly the Minimum E2 checklist plus the multi-object composition
 * projection (ADRs 0014-0015). ADR 0003 keeps general E2 specified-not-built and
 * nothing here widens that.
 *
 * Access is decided before a session is constructed: an unentitled request never
 * reaches the engine. The preview flag is read from the server environment only.
 */
export default async function EditorPage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const sessionToken = await readSessionToken();
  const plane = createUmbrellaIdentityPlane(process.env, { sessionToken });
  const resolved = await resolveUmbrellaEditorAccess({ plane, env: process.env, sessionToken });

  if (!resolved.decision.granted) {
    return (
      <>
        <p className="eyebrow">Minimum E2 editor</p>
        <h1>The editor is not open for this request</h1>
        <StatePanel
          tone="deny"
          title="Not entitled"
          reason={resolved.decision.reason}
        >
          <p>{resolved.decision.message}</p>
          <p>
            The editor needs credits above zero or an unused starter allotment;
            administrators are unrestricted. No editor session was created for this
            request.
          </p>
          <p>
            <a href="/account">Account</a> · <a href="/pricing">Pricing</a> ·{" "}
            <a href="/engine">The engine SDK is free and needs no account</a>
          </p>
        </StatePanel>
      </>
    );
  }

  const state = readEditorState(params);
  if (!state.ok) {
    return (
      <>
        <p className="eyebrow">Minimum E2 editor</p>
        <h1>That editor link was refused</h1>
        <StatePanel tone="deny" title="Link refused" reason={state.reason}>
          <p>{state.message}</p>
          <p>
            Catalog deep links carry a source, an item, and an optional artifact
            reference — nothing else. A link cannot carry identity, session, or
            telemetry across a surface boundary.
          </p>
          <p>
            <a href="/editor">Open the editor without a link</a>
          </p>
        </StatePanel>
      </>
    );
  }

  const render = renderEditorState(state.value);
  if (!render.ok) {
    return (
      <>
        <p className="eyebrow">Minimum E2 editor</p>
        <h1>The editor session could not start</h1>
        <StatePanel tone="deny" title="Session refused" reason={render.reason}>
          <p>{render.message}</p>
        </StatePanel>
      </>
    );
  }

  const { snapshot, viewport, save, composition, artifactId } = render.value;
  const editor = state.value;
  const selected = editor.instances.find(
    (instance) => instance.instanceId === editor.selectedInstanceId,
  );

  return (
    <>
      <p className="eyebrow">Minimum E2 editor · sculpt and scene</p>
      <h1>Editor</h1>

      {resolved.decision.mode === "preview" ? (
        <StatePanel tone="warn" title="Preview — not an entitled session">
          <p>
            This deployment sets the server-side editor preview flag, so the Minimum E2
            surface is demonstrable before the identity plane is wired. Nothing here is
            attributed to an account, and no credits are consumed. The flag is removed
            once entitlement can be resolved.
          </p>
        </StatePanel>
      ) : (
        <StatePanel tone="ok" title={`Entitled — ${resolved.decision.basis}`} />
      )}

      {editor.deepLink !== null && (
        <StatePanel tone="ok" title="Opened from a catalog">
          <p>
            The catalog item is shown here as context only — every editor session opens
            the shared starter scene, not that listing&rsquo;s own scene. Source{" "}
            <code>{editor.deepLink.source}</code> · item{" "}
            <code>{editor.deepLink.itemId}</code>
            {editor.deepLink.artifactRef !== null && (
              <>
                {" "}
                · artifact <code>{editor.deepLink.artifactRef}</code>
              </>
            )}
          </p>
        </StatePanel>
      )}

      <h2>Scene</h2>
      <div className="grid">
        <section className="panel">
          <h3>Tree</h3>
          <ul className="tree">
            {snapshot.sceneTree.map((node) => (
              <li key={node.id}>
                <span className="depth">{node.kind === "sculpt-instance" ? "▸ " : "  · "}</span>
                {node.label}
                {node.instanceId === snapshot.selectedInstanceId && node.kind === "sculpt-instance" && (
                  <strong> ←</strong>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h3>Inspector</h3>
          {snapshot.inspector === null ? (
            <p>Nothing selected.</p>
          ) : (
            <dl className="dl">
              <dt>Instance</dt>
              <dd>
                <code>{snapshot.inspector.instanceId}</code>
              </dd>
              <dt>Artifact</dt>
              <dd>
                <code>{snapshot.inspector.artifactId}</code>
              </dd>
              <dt>Components</dt>
              <dd>{snapshot.inspector.componentCount}</dd>
              <dt>Sockets</dt>
              <dd>{snapshot.inspector.socketCount}</dd>
              <dt>Translation</dt>
              <dd>
                <code>[{snapshot.inspector.transform.translation.join(", ")}]</code>
              </dd>
              <dt>Kernel tick</dt>
              <dd>{snapshot.inspector.kernel.tick}</dd>
            </dl>
          )}
        </section>

        <section className="panel">
          <h3>Viewport</h3>
          <dl className="dl">
            <dt>Backend</dt>
            <dd>
              <code>{viewport.backend}</code>
            </dd>
            <dt>Label</dt>
            <dd>{viewport.label}</dd>
            <dt>Frame</dt>
            <dd>{viewport.frame}</dd>
            <dt>Draw calls</dt>
            <dd>{viewport.drawCalls}</dd>
            <dt>Instances</dt>
            <dd>{viewport.instanceIds.length}</dd>
          </dl>
        </section>

        <section className="panel">
          <h3>Session</h3>
          <dl className="dl">
            <dt>Play state</dt>
            <dd>
              <code>{snapshot.playState}</code>
            </dd>
            <dt>Tick</dt>
            <dd>{snapshot.tick}</dd>
            <dt>Objects</dt>
            <dd>{editor.instances.length}</dd>
            <dt>Seed artifact</dt>
            <dd>
              <code>{artifactId}</code>
            </dd>
          </dl>
        </section>
      </div>

      <h2>Edit</h2>
      <form method="get" action="/editor">
        {editor.deepLink !== null && (
          <>
            <input type="hidden" name="source" value={editor.deepLink.source} />
            <input type="hidden" name="item" value={editor.deepLink.itemId} />
            {editor.deepLink.artifactRef !== null && (
              <input type="hidden" name="artifact" value={editor.deepLink.artifactRef} />
            )}
          </>
        )}
        {editor.instances
          .filter((instance) => instance.instanceId !== editor.selectedInstanceId)
          .map((instance) => (
            <input
              key={`tx-${instance.instanceId}`}
              type="hidden"
              name={`tx-${instance.instanceId}`}
              value={instance.transform.translation.join(",")}
            />
          ))}
        <div className="row">
          <div className="field">
            <label htmlFor="sel">Selection</label>
            <select id="sel" name="sel" defaultValue={editor.selectedInstanceId}>
              {editor.instances.map((instance) => (
                <option key={instance.instanceId} value={instance.instanceId}>
                  {instance.instanceId}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tx">Translation (x,y,z)</label>
            <input
              id="tx"
              name={`tx-${editor.selectedInstanceId}`}
              defaultValue={selected?.transform.translation.join(",") ?? "0,0,0"}
              size={14}
            />
          </div>
          <div className="field">
            <label htmlFor="objects">Objects</label>
            <input
              id="objects"
              name="objects"
              type="number"
              min={EDITOR_MIN_OBJECTS}
              max={EDITOR_MAX_OBJECTS}
              defaultValue={editor.instances.length}
            />
          </div>
          <button className="button" type="submit">
            Apply
          </button>
        </div>
      </form>

      <div className="actions">
        <a className="button button-quiet" href={editorHref(editor, { play: !editor.playing })}>
          {editor.playing ? "Pause" : "Play one step"}
        </a>
        <a className="button button-quiet" href="/editor">
          Reset
        </a>
      </div>

      <h2>Save — through propose/apply</h2>
      {save.ok ? (
        <>
          <p>
            The editor saves by proposing an edit to a text-canonical document and
            applying it, the same path the CLI uses. There is no second writer.
          </p>
          <dl className="dl">
            <dt>Applied paths</dt>
            <dd>
              <code>{save.appliedPaths.join(", ")}</code>
            </dd>
          </dl>
          <pre>
            <code>{save.unifiedDiff.split("\n").slice(0, 24).join("\n")}</code>
          </pre>
        </>
      ) : (
        <StatePanel tone="deny" title="Save refused">
          <p>
            {save.diagnostics
              .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
              .join(" · ")}
          </p>
        </StatePanel>
      )}

      <h2>Composition projection</h2>
      {composition.ok ? (
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Instance</th>
                <th>Parent</th>
                <th>Depth</th>
                <th>World translation</th>
              </tr>
            </thead>
            <tbody>
              {composition.scene.instances.map((instance) => (
                <tr key={instance.instanceId}>
                  <td>
                    <code>{instance.instanceId}</code>
                  </td>
                  <td>
                    <code>{instance.parentInstanceId ?? "—"}</code>
                  </td>
                  <td>{instance.depth}</td>
                  <td>
                    <code>[{instance.worldTransform.translation.join(", ")}]</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <StatePanel tone="warn" title="Not composable" reason={composition.code}>
          <p>{composition.message}</p>
          <p>
            A composed scene needs at least two placements and exactly one root. This is
            the pipeline&rsquo;s own refusal, not a message invented by this page.
          </p>
        </StatePanel>
      )}
      {composition.ok && (
        <p style={{ color: "var(--ink-faint)", fontSize: "0.9rem" }}>
          Placement is a projection: a child transform reads relative to its parent and
          no artifact is rewritten to place it, because its evidence binds its exact spec
          bytes.
        </p>
      )}

      <h2>What this surface is bounded to</h2>
      <p>
        Exactly these operations, and no more:{" "}
        {WEB_EDITOR_SESSION_OPERATIONS.map((operation) => (
          <code key={operation} style={{ marginRight: "0.5rem" }}>
            {operation}
          </code>
        ))}
      </p>
      <StatePanel tone="warn" title="Edits are not persisted">
        <p>
          The session is rebuilt per request in an ephemeral workspace and its state
          lives in this URL, so the same link always renders the same scene. Each object
          keeps its own translation, so switching selection never moves another object.
          Persisting a project needs a storage decision that has not been made, so
          nothing here pretends to save your work.
        </p>
      </StatePanel>
    </>
  );
}
