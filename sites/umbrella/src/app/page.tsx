import { LIVE_OPEN_INSTANCE_COUNT, LIVE_OPEN_PATH, resolveLiveOpenScene } from "../lib/live-open.js";
import {
  ENGINE_COMPARISONS,
  LAUNCH_PROOFS,
  PROFILE_RELEASE_MATRIX,
} from "../lib/launch-marketing.js";
import { RELEASE_MARKER } from "../lib/site-content.js";
import { DownloadCta } from "./_components/download-cta.js";
import { HeroViewport } from "./_components/hero-viewport.js";
import { StatePanel } from "./_components/state-panel.js";

const PROFILE_STATE_COPY = Object.freeze({
  "development-consumer": Object.freeze({ label: "Development proof", tone: "validated" }),
  "not-yet-claimed": Object.freeze({ label: "Not yet claimed", tone: "dormant" }),
  "refuse-only": Object.freeze({ label: "Refuse-only", tone: "isolated" }),
});

/**
 * The first public engine release overview (sceneaxi#203).
 *
 * The route sells one bounded proposition: local, reviewable scene authoring over a
 * shared engine core. Its hero visual is the committed public artifact, its comparison
 * claims link to each product's own description, and its profile matrix carries a
 * structurally false shipping claim.
 */
export default function OverviewPage() {
  const heroScene = resolveLiveOpenScene();

  return (
    <>
      <section className="hero release-hero" aria-labelledby="release-title">
        <div className="hero-inner hero-inner-split">
          <div className="hero-copy">
            <p className="badge">{RELEASE_MARKER}</p>
            <h1 id="release-title">Build scenes. Keep the source.</h1>
            <p className="lede">
              Build interactive scenes as local, reviewable files, then open them through
              a versioned product profile.
            </p>

            <div className="release-actions">
              <DownloadCta />
              <a className="button button-quiet button-arrow" href={LIVE_OPEN_PATH}>
                Open the proof
              </a>
            </div>
          </div>

          {heroScene.ok ? (
            <HeroViewport
              scene={heroScene.value}
              label={`A committed SceneAxi Sculpt Artifact, composed into ${LIVE_OPEN_INSTANCE_COUNT} placed instances and drawn live`}
            />
          ) : (
            <StatePanel
              tone="deny"
              level={2}
              title="The release artifact refused to open"
              reason={heroScene.reason}
              evidence={[{ term: "Surface", value: "release overview" }]}
            >
              <p>{heroScene.message}</p>
              <p>
                This slot shows the same composed artifact as the public open path. A
                refusal stays visible instead of being replaced by invented marketing art.
              </p>
            </StatePanel>
          )}
        </div>

        <div className="launch-proof-rail">
          <dl className="launch-proof-grid">
            {LAUNCH_PROOFS.map((proof) => (
              <div className={`launch-proof proof-${proof.id}`} key={proof.id}>
                <dt>
                  {proof.href === null ? proof.title : <a href={proof.href}>{proof.title}</a>}
                </dt>
                <dd>{proof.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="band-inner release-section" id="compare" aria-labelledby="compare-title">
        <div className="release-heading">
          <h2 id="compare-title">Choose the right layer.</h2>
          <p className="prose prose-wide">
            Unity and Godot are broad game engines. Three.js is a web rendering library.
            SceneAxi is a smaller engine and library centered on reviewable source,
            deterministic evidence, and versioned profiles.
          </p>
        </div>

        <div
          className="scroll-x comparison-scroll"
          role="region"
          tabIndex={0}
          aria-label="Engine comparison, scrollable"
        >
          <table className="comparison-table" aria-label="Engine comparison">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th className="wrap" scope="col">What it is</th>
                <th className="wrap" scope="col">Choose it when</th>
                <th className="wrap" scope="col">Honest tradeoff</th>
              </tr>
            </thead>
            <tbody>
              {ENGINE_COMPARISONS.map((entry) => (
                <tr className={entry.name === "SceneAxi" ? "comparison-sceneaxi" : undefined} key={entry.name}>
                  <th scope="row">
                    <span>{entry.name}</span>
                    <a
                      href={entry.source.href}
                      {...(entry.source.href.startsWith("https://")
                        ? { rel: "noreferrer", target: "_blank" }
                        : {})}
                    >
                      {entry.source.label}
                    </a>
                  </th>
                  <td className="wrap">{entry.category}</td>
                  <td className="wrap">{entry.bestWhen}</td>
                  <td className="wrap">{entry.tradeoff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="band band-sunk" id="profiles" aria-labelledby="profiles-title">
        <div className="band-inner release-section">
          <div className="release-heading">
            <h2 id="profiles-title">One core, three explicit scopes.</h2>
            <p className="prose prose-wide">
              Profiles define product scope around the engine. This first-release matrix
              distinguishes development evidence from product intent and keeps Kids
              refusal visible.
            </p>
          </div>

          <div
            className="scroll-x profile-release-scroll"
            role="region"
            tabIndex={0}
            aria-label="Profile capability matrix, scrollable"
          >
            <table className="profile-release-matrix" aria-label="Profile capability matrix">
              <thead>
                <tr>
                  <th scope="col">Capability</th>
                  {PROFILE_RELEASE_MATRIX.profiles.map((profile) => {
                    const state = PROFILE_STATE_COPY[profile.state];
                    return (
                      <th className="wrap" scope="col" key={profile.id}>
                        <span className="profile-column-name">{profile.name}</span>
                        <span className={`chip chip-${state.tone}`}>{state.label}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {PROFILE_RELEASE_MATRIX.capabilities.map((capability) => (
                  <tr key={capability.capability}>
                    <th className="wrap" scope="row">{capability.capability}</th>
                    {PROFILE_RELEASE_MATRIX.profiles.map((profile) => (
                      <td className="wrap" key={profile.id}>
                        {capability.values[profile.id]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="matrix-note">
            <p>
              This matrix makes no shipping or availability claim. The detailed open-path
              table is generated directly from the conformance registry and policy.
            </p>
            <a className="button button-quiet" href="/profiles">Inspect profile evidence</a>
          </div>
        </div>
      </section>

      <section className="band-inner release-section release-paths" aria-labelledby="paths-title">
        <div className="release-heading">
          <h2 id="paths-title">Start without an account.</h2>
          <p className="prose prose-wide">
            Download the engine, read the contracts, or open the browser proof. Sign in
            only when you choose account-backed editor or hosted-AI features.
          </p>
        </div>
        <nav className="path-links" aria-label="First-release paths">
          <a href="/docs">Read the docs</a>
          <a href={LIVE_OPEN_PATH}>Open the proof</a>
          <a href="/login">Sign in</a>
          <a href="/pricing">View credit pricing</a>
        </nav>
      </section>
    </>
  );
}
