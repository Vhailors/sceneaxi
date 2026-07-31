import {
  buildEditorShellView,
  readEditorState,
  renderEditorState,
  webEditorStarterArtifact,
  type SearchParams,
} from "@sceneaxi/site-kit";
import { createUmbrellaIdentityPlane } from "../../lib/identity-plane.js";
import { EDITOR_VIEWPORT_COPY } from "../../lib/editor-viewport.js";
import { resolveUmbrellaEditorAccess } from "../../lib/site-config.js";
import { readSessionToken } from "../_session.js";
import { StatePanel } from "../_components/state-panel.js";
import { EditorShell } from "./_components/editor-shell.js";

/**
 * The Minimum E2 sculpt/scene web editor, drawn as the Engine Desktop shell.
 *
 * Bounded to exactly the Minimum E2 checklist plus the multi-object composition
 * projection (ADRs 0014-0015). ADR 0003 keeps general E2 specified-not-built and
 * nothing here widens that: the shell's `live` controls map onto the same frozen
 * operation set the previous page used, and a control the design draws for
 * behaviour this surface has no contract for renders inert with a named refusal.
 *
 * Access is decided before a session is constructed: an unentitled request never
 * reaches the engine, and a refused request reaches no canvas. The preview flag
 * is read from the server environment only.
 *
 * Everything the shell shows is computed here, server-side, from one real
 * session render — `buildEditorShellView` in `@sceneaxi/site-kit` decides, the
 * client component draws.
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
      <div className="page ed-refusal-page">
        <div className="page-head">
          <p className="eyebrow">Engine Desktop editor</p>
          <h1>The editor is not open for this request</h1>
        </div>
        <StatePanel
          tone="deny"
          level={2}
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
            <a href="/engine">The engine SDK is free and needs no account</a> ·{" "}
            <a href="/">Back to SceneAxi</a>
          </p>
        </StatePanel>
      </div>
    );
  }

  const state = readEditorState(params);
  if (!state.ok) {
    return (
      <div className="page ed-refusal-page">
        <div className="page-head">
          <p className="eyebrow">Engine Desktop editor</p>
          <h1>That editor link was refused</h1>
        </div>
        <StatePanel tone="deny" level={2} title="Link refused" reason={state.reason}>
          <p>{state.message}</p>
          <p>
            Catalog deep links carry a source, an item, and an optional artifact
            reference — nothing else. A link cannot carry identity, session, or
            telemetry across a surface boundary.
          </p>
          <p>
            <a href="/editor">Open the editor without a link</a> ·{" "}
            <a href="/">Back to SceneAxi</a>
          </p>
        </StatePanel>
      </div>
    );
  }

  const render = renderEditorState(state.value);
  if (!render.ok) {
    return (
      <div className="page ed-refusal-page">
        <div className="page-head">
          <p className="eyebrow">Engine Desktop editor</p>
          <h1>The editor session could not start</h1>
        </div>
        <StatePanel tone="deny" level={2} title="Session refused" reason={render.reason}>
          <p>{render.message}</p>
          <p>
            <a href="/">Back to SceneAxi</a>
          </p>
        </StatePanel>
      </div>
    );
  }

  const starter = webEditorStarterArtifact();
  if (!starter.ok) {
    return (
      <div className="page ed-refusal-page">
        <div className="page-head">
          <p className="eyebrow">Engine Desktop editor</p>
          <h1>The editor session could not start</h1>
        </div>
        <StatePanel tone="deny" level={2} title="Session refused" reason={starter.reason}>
          <p>{starter.message}</p>
        </StatePanel>
      </div>
    );
  }

  const editor = state.value;
  const view = buildEditorShellView({
    state: editor,
    render: render.value,
    baseDocument: render.value.baseDocument,
    entitlement: {
      mode: resolved.decision.mode === "preview" ? "preview" : "entitled",
      basis: resolved.decision.mode === "preview" ? "preview flag" : resolved.decision.basis,
    },
    starterArtifact: starter.value,
  });

  const deepLinkFields =
    editor.deepLink === null
      ? []
      : [
          { name: "source", value: editor.deepLink.source },
          { name: "item", value: editor.deepLink.itemId },
          ...(editor.deepLink.artifactRef === null
            ? []
            : [{ name: "artifact", value: editor.deepLink.artifactRef }]),
        ];
  const carriedTransforms = editor.instances
    .filter((instance) => instance.instanceId !== editor.selectedInstanceId)
    .map((instance) => ({
      name: `tx-${instance.instanceId}`,
      value: instance.transform.translation.join(","),
    }));

  return (
    <>
      {resolved.decision.mode === "preview" && (
        <p className="ed-preview-note" role="note">
          Preview — the server-side editor preview flag is set, nothing is
          attributed to an account, and no credits are consumed. Real entitlement
          replaces this flag.
        </p>
      )}
      <EditorShell
        view={view}
        scene={render.value.mountable}
        selectedInstanceId={editor.selectedInstanceId}
        deepLinkFields={[...deepLinkFields, ...carriedTransforms]}
        viewportCopy={EDITOR_VIEWPORT_COPY}
      />
    </>
  );
}
