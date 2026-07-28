import { Fragment } from "react";
import type { Metadata } from "next";
import {
  PROFILE_CAPABILITY_COPY,
  PROFILE_MATRIX_COPY,
  PROFILE_OPERATION_COPY,
  profileMatrix,
} from "../../lib/profile-matrix.js";
import { PROFILE_CARDS } from "../../lib/site-content.js";
import { StatePanel } from "../_components/state-panel.js";

export const metadata: Metadata = {
  title: "Profiles — SceneAxi",
  description:
    "The Game, Web Experience, and Kids profiles, graded by the profile conformance registry and the open-path demo policy. No shipping claim.",
};

/**
 * The reduced, truthful profile matrix (decision D3).
 *
 * The accepted screen draws a 3 × 10 grid of ticks. This page draws the six ADR 0001
 * Kernel-seam operations and answers every cell from `profileMatrix()`, which computes
 * each one from the contracts rather than reading it off a table someone typed. A
 * capability the registry has not claimed says so; the refuse-only profile says that.
 *
 * The page changes no claim: it neither widens `profileConformanceRegistry` nor touches
 * `docs/open-path-policy.md`, and `shippingClaim` stays structurally false throughout.
 */
export default function ProfilesPage() {
  const matrix = profileMatrix();

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">{PROFILE_MATRIX_COPY.eyebrow}</p>
        <h1>{PROFILE_MATRIX_COPY.title}</h1>
        <p className="lede">{PROFILE_MATRIX_COPY.lede}</p>
      </div>

      {/*
        The same card the overview uses, so a profile reads identically wherever it
        appears. Here the name is an `h2` because these cards *are* this page's sections;
        on the overview they sit under one, and are `h3`.
      */}
      <div className="grid grid-3">
        {PROFILE_CARDS.map((profile) => (
          <article className={`profile-card tone-${profile.accent}`} key={profile.name}>
            <span className="card-accent-rail" aria-hidden="true" />
            <div className="profile-card-body">
              <div className="panel-head">
                <h2>{profile.name}</h2>
                <span className={`tag tag-${profile.accent}`}>{profile.tag}</span>
              </div>
              <p>{profile.desc}</p>
              <span className="panel-grow" />
              <ul className="bullets panel-foot">
                {profile.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      <div className="stack">
        <h2>What each profile is graded for</h2>
        <p className="prose prose-wide">{PROFILE_MATRIX_COPY.claimNote}</p>
        <div className="scroll-x">
          <table className="matrix">
            <thead>
              <tr>
                <th className="wrap">Kernel-seam operation</th>
                {matrix.rows.map((row) => (
                  <th key={row.profile} className="wrap">
                    {row.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.operations.map((operation) => (
                <tr key={operation}>
                  <th scope="row" className="wrap">
                    <code>{operation}</code>
                    <br />
                    <span className="note">{PROFILE_OPERATION_COPY[operation]}</span>
                  </th>
                  {matrix.rows.map((row) => {
                    const cell = row.cells.find((entry) => entry.operation === operation);
                    const status = cell?.status ?? "not-yet-claimed";
                    const copy = PROFILE_CAPABILITY_COPY[status];
                    return (
                      <td key={`${row.profile}-${operation}`}>
                        <span className={`chip chip-${copy.tone}`}>{copy.label}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">{PROFILE_MATRIX_COPY.evidenceNote}</p>
      </div>

      <div className="stack">
        <h2>The evidence behind each row</h2>
        <dl className="dl">
          {matrix.rows.map((row) => (
            <Fragment key={row.profile}>
              <dt>
                <code>{row.profile}</code>
              </dt>
              <dd>
                <p>{row.summary}</p>
                <p className="note">
                  claim <code>{row.claimStatus}</code> · demo level{" "}
                  <code>{row.demoLevel}</code> · session <code>{row.sessionKind}</code> ·
                  evidence <code>{row.evidence}</code>
                </p>
              </dd>
            </Fragment>
          ))}
        </dl>
      </div>

      <StatePanel tone="iso" title="Kids refuses the open path" reason="refuse-only">
        <p>{PROFILE_MATRIX_COPY.kidsNote}</p>
      </StatePanel>

      <StatePanel tone="warn" title="No shipping claim is made here">
        <p>
          The conformance contract and the open-path policy both carry a structurally
          false shipping claim, and this page carries it forward unchanged. A demo level
          grades a demonstration. Whether a profile ships is a decision made elsewhere,
          and it has not been made.
        </p>
      </StatePanel>

      <h2>Where to go next</h2>
      <div className="actions">
        <a className="button" href="/open">
          Open a real artifact
        </a>
        <a className="button button-quiet" href="/docs">
          Read the contracts
        </a>
        <a className="button button-quiet" href="/engine">
          Download the engine SDK
        </a>
      </div>
    </div>
  );
}
