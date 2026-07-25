import type { Metadata } from "next";
import {
  LIVE_OPEN_COPY,
  LIVE_OPEN_INSTANCE_COUNT,
  LIVE_OPEN_PRESENTATION,
  describePlacement,
  resolveLiveOpenScene,
} from "../../lib/live-open.js";
import { StatePanel } from "../_components/state-panel.js";
import { LiveViewport } from "./_components/live-viewport.js";

export const metadata: Metadata = {
  title: "Open a real artifact — SceneAxi",
  description:
    "A committed SceneAxi Sculpt Artifact, composed into a scene and drawn live in your browser by the Three presentation core.",
};

/**
 * The public live open path (ADR 0022).
 *
 * The server resolves the scene — a committed fixture reconstructed and placed by the
 * scene-composition pipeline — and hands it to the client viewport as contract data.
 * No identity, no credits, no editing operation: this page opens an artifact, and the
 * Minimum E2 editor at `/editor` remains the only authoring surface.
 */
export default function OpenPage() {
  const scene = resolveLiveOpenScene();

  if (!scene.ok) {
    return (
      <>
        <p className="eyebrow">{LIVE_OPEN_COPY.eyebrow}</p>
        <h1>{LIVE_OPEN_COPY.title}</h1>
        <StatePanel tone="deny" title="No scene to open" reason={scene.reason}>
          <p>{scene.message}</p>
          <p>
            The scene is built by the same composition pipeline the CLI uses, and it
            fails closed. Rather than draw a placeholder, this deploy shows you the
            refusal the pipeline produced.
          </p>
        </StatePanel>
      </>
    );
  }

  const opened = scene.value;
  const artifactIds = Object.keys(opened.artifacts);

  return (
    <>
      <p className="eyebrow">{LIVE_OPEN_COPY.eyebrow}</p>
      <h1>{LIVE_OPEN_COPY.title}</h1>
      <p className="lede">{LIVE_OPEN_COPY.lede}</p>

      <LiveViewport scene={opened} />

      <h2>What you are looking at</h2>
      <p>{LIVE_OPEN_COPY.honesty}</p>
      <div className="grid">
        <article className="panel">
          <h3>A real artifact</h3>
          <p>
            The object is a Sculpt Artifact reconstructed deterministically from a
            committed intake for a fixed seed — the same multi-pass path the engine
            tests cover. It is not a model file dropped into a viewer.
          </p>
        </article>
        <article className="panel">
          <h3>A real composition</h3>
          <p>
            The scene places {LIVE_OPEN_INSTANCE_COUNT} instances of that one artifact
            through <code>composeScene()</code>. Placement is a projection: a child transform
            reads relative to its parent, and no artifact is rewritten to place it,
            because its evidence binds its exact spec bytes.
          </p>
        </article>
        <article className="panel">
          <h3>{LIVE_OPEN_PRESENTATION.coreLabel}</h3>
          <p>{LIVE_OPEN_PRESENTATION.decision}</p>
          <p>{LIVE_OPEN_PRESENTATION.seam}</p>
        </article>
        <article className="panel">
          <h3>What is not claimed</h3>
          <p>{LIVE_OPEN_PRESENTATION.notClaimed}</p>
        </article>
      </div>

      <h2>The scene this deploy serves</h2>
      <dl className="dl">
        <dt>Scene id</dt>
        <dd>
          <code>{opened.sceneId}</code>
        </dd>
        <dt>Root instance</dt>
        <dd>
          <code>{opened.rootInstanceId}</code>
        </dd>
        <dt>Artifacts</dt>
        <dd>
          <code>{artifactIds.join(", ")}</code>
        </dd>
        <dt>Scene digest</dt>
        <dd>
          <code>{opened.sceneDigest}</code>
        </dd>
      </dl>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Instance</th>
              <th>Parent</th>
              <th>Placement</th>
              <th className="wrap">Role</th>
            </tr>
          </thead>
          <tbody>
            {opened.instances.map((instance) => (
              <tr key={instance.instanceId}>
                <td>
                  <code>{instance.instanceId}</code>
                </td>
                <td>
                  <code>{instance.parentInstanceId ?? "—"}</code>
                </td>
                <td>
                  <code>{describePlacement(instance)}</code>
                </td>
                <td className="wrap">{instance.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ color: "var(--ink-faint)", fontSize: "0.9rem" }}>
        The scene digest is deterministic, so this page opens the same scene on every
        request and on every deploy of the same commit.
      </p>

      <h2>Where to go next</h2>
      <div className="actions">
        <a className="button" href="/engine">
          Download the engine SDK
        </a>
        <a className="button button-quiet" href="/editor">
          The Minimum E2 editor
        </a>
        <a className="button button-quiet" href="/docs">
          Read the contracts
        </a>
      </div>
      <StatePanel tone="ok" title="Public — no account, no credits">
        <p>
          This page needs no sign-in and consumes nothing. It also edits nothing: the
          bounded Minimum E2 editor is a separate, entitled surface, and opening an
          artifact here does not widen it.
        </p>
      </StatePanel>
    </>
  );
}
