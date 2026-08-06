import {
  EDITOR_DEEP_LINK_PATH,
  buildWebExperienceEditorView,
  buildEditorShellView,
  describeSiteAccessState,
  readEditorState,
  readWebExperienceEditorState,
  renderEditorState,
  sitePathWithSearchParams,
  webEditorStarterArtifact,
  type SearchParams,
} from "@sceneaxi/site-kit";
import { umbrellaRequestAuthority } from "../../lib/request-authority.js";
import {
  UMBRELLA_CATALOG_INTAKE_ACTION,
  readUmbrellaCatalogIntakePanel,
  umbrellaCatalogIntake,
  umbrellaEditorStateFields,
} from "../../lib/catalog-submission.js";
import { EDITOR_VIEWPORT_COPY } from "../../lib/editor-viewport.js";
import { resolveUmbrellaEditorAccess } from "../../lib/site-config.js";
import { readSessionToken } from "../_session.js";
import { StatePanel } from "../_components/state-panel.js";
import { EditorShell } from "./_components/editor-shell.js";

/**
 * The entitled editor route: Minimum E2 for Game and the smaller document-only
 * Web Experience authoring profile, drawn inside the shared product shell.
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
  const plane = umbrellaRequestAuthority().plane({ sessionToken });
  const resolved = await resolveUmbrellaEditorAccess({ plane, env: process.env, sessionToken });

  if (!resolved.decision.granted) {
    // The refusal renders as its own named access state — signed out, expired,
    // disabled, Kids, provider unavailable, not wired, out of credits — with the
    // one action that can change it, instead of a single undifferentiated wall.
    // Signing in from here returns to the editor rather than the account page,
    // so the surface that refused is the one the visitor gets back.
    const outcome = describeSiteAccessState(resolved.decision.reason, {
      next: sitePathWithSearchParams(EDITOR_DEEP_LINK_PATH, params),
    });
    return (
      <div className="page">
        <div className="page-head">
          <p className="eyebrow">Engine Desktop editor</p>
          <h1>The editor is not open for this request</h1>
        </div>
        <StatePanel
          tone="deny"
          level={2}
          title={outcome.title}
          reason={resolved.decision.reason}
        >
          <p>{outcome.body}</p>
          <p>{resolved.decision.message}</p>
          <p>
            The editor needs a signed-in account with credits above zero or an unused
            starter allotment; administrators are unrestricted. No editor session was
            created for this request.
          </p>
          {outcome.action !== null && (
            <p>
              <a className="button" href={outcome.action.href}>
                {outcome.action.label}
              </a>
            </p>
          )}
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
      <div className="page">
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

  const webState = readWebExperienceEditorState(params);
  if (!webState.ok) {
    return (
      <div className="page">
        <div className="page-head">
          <p className="eyebrow">Web Experience editor</p>
          <h1>That web editor state was refused</h1>
        </div>
        <StatePanel tone="deny" level={2} title="Web state refused" reason={webState.reason}>
          <p>{webState.message}</p>
          <p>Only the bounded page, canvas, known-asset, and safe Three fields are accepted.</p>
          <p><a href="/editor?profile=web">Open a clean Web Experience session</a></p>
        </StatePanel>
      </div>
    );
  }

  const render = renderEditorState(state.value);
  if (!render.ok) {
    return (
      <div className="page">
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
      <div className="page">
        <div className="page-head">
          <p className="eyebrow">Engine Desktop editor</p>
          <h1>The editor session could not start</h1>
        </div>
        <StatePanel tone="deny" level={2} title="Session refused" reason={starter.reason}>
          <p>{starter.message}</p>
          <p>
            <a href="/">Back to SceneAxi</a>
          </p>
        </StatePanel>
      </div>
    );
  }

  const editor = state.value;
  const webView = buildWebExperienceEditorView({
    state: webState.value,
    starterArtifactId: starter.value.artifactId,
  });
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

  // A render never submits. This reads the panel's state — the shipped deployment
  // injects nothing, so it refuses by name without reaching a provider at all — and the
  // one control that writes posts to `UMBRELLA_CATALOG_INTAKE_ACTION`.
  const intake = await readUmbrellaCatalogIntakePanel({ injection: umbrellaCatalogIntake() });

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
      {/*
        The shell is a fixed, opaque application surface, so anything rendered beside it
        in normal flow is painted underneath it on a page that does not scroll. These
        notices therefore ride in one fixed rail above the shell, stacked in a column so
        a second notice can never land on top of the first, and scrolled internally so
        the whole rail stays reachable at the smallest supported window.
      */}
      <div className="ed-overlay-notes">
        {resolved.decision.mode === "preview" && (
          <p className="ed-preview-note" role="note">
            Preview — the server-side editor preview flag is set, nothing is
            attributed to an account, and no credits are consumed. Real entitlement
            replaces this flag.
          </p>
        )}
        {intake.kind === "recorded" ? (
          <StatePanel
            tone="warn"
            title="The injected TEST intake holds this submission"
            evidence={[
              { term: "Item", value: intake.record.itemId },
              { term: "Pipeline", value: `${intake.record.pipelineState} · TEST only` },
              { term: "Recorded transitions", value: String(intake.record.recordedTransitions) },
              { term: "Document digest", value: intake.record.documentDigest },
              { term: "Asset-package digest", value: intake.record.artifactDigest },
            ]}
          >
            <p>
              Read back from the injected provider, never claimed by this link. The record
              holds the submitted render&rsquo;s own document and artifact digests, is not
              listed, and carries no listing projection: screening, curation, and an
              explicit human approval are separate recorded steps that nothing on this
              route performs.
            </p>
          </StatePanel>
        ) : intake.kind === "offered" ? (
          <StatePanel tone="warn" title="Submit this render to the injected TEST intake">
            <p>
              Catalog intake is a TEST-only injected seam for entitled non-Kids requests.
              Nothing is submitted by opening this page — pressing the control below is
              the only thing that writes a record.
            </p>
            <form method="post" action={UMBRELLA_CATALOG_INTAKE_ACTION} className="ed-intake-form">
              {umbrellaEditorStateFields(params).map((field, index) => (
                <input
                  key={`${field.name}-${String(index)}`}
                  type="hidden"
                  name={field.name}
                  value={field.value}
                />
              ))}
              <button className="button" type="submit">
                Submit this render to TEST intake
              </button>
            </form>
          </StatePanel>
        ) : (
          <StatePanel
            tone="deny"
            title="Catalog intake is not open on this deployment"
            reason={intake.reason}
          >
            <p>{intake.message}</p>
            <p>
              No intake record was built or read for this render, and this page submits
              nothing. This deployment injects no catalog store and collects no rights,
              provenance, or AI-disclosure declaration, so the seam refuses rather than
              inventing either. Listing would still require screening, curation, and an
              explicit human approval.
            </p>
          </StatePanel>
        )}
      </div>
      <EditorShell
        view={view}
        scene={render.value.mountable}
        selectedInstanceId={editor.selectedInstanceId}
        deepLinkFields={[...deepLinkFields, ...carriedTransforms]}
        viewportCopy={EDITOR_VIEWPORT_COPY}
        initialProfile={editor.profileId}
        webView={webView}
      />
    </>
  );
}
