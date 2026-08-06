"use client";

import { useState } from "react";
import {
  KIDS_ACTIVITY_PIECES,
  KIDS_ACTIVITY_PIECE_LIMIT,
  KIDS_ACTIVITY_WORLDS,
  applyKidsActivityAction,
  createKidsActivityState,
  type KidsActivityRequest,
} from "../../lib/kids-activity.js";

const piecePositionClasses = [
  "piece-one",
  "piece-two",
  "piece-three",
  "piece-four",
  "piece-five",
  "piece-six",
] as const;

export function KidsStudio() {
  const [activity, setActivity] = useState(createKidsActivityState);
  const [message, setMessage] = useState("Your sunny meadow is ready.");

  const world = KIDS_ACTIVITY_WORLDS.find((candidate) => candidate.id === activity.worldId);
  if (world === undefined) throw new Error("The curated Kids world is missing.");

  function run(request: KidsActivityRequest) {
    const decision = applyKidsActivityAction(activity, request);
    setMessage(decision.message);
    if (decision.ok) setActivity(decision.state);
  }

  return (
    <section className="studio" aria-label="Tiny world maker">
      <div className="stage-wrap">
        <div
          className={`stage world-${activity.worldId} ${activity.mode === "play" ? "is-playing" : ""}`}
          role="group"
          aria-label={`${world.label}. ${activity.pieceIds.length} of ${KIDS_ACTIVITY_PIECE_LIMIT} pieces added.`}
        >
          <div className="sky-symbol" aria-hidden="true">
            {world.symbol}
          </div>
          <div className="horizon" aria-hidden="true" />
          <div className="placed-pieces" aria-hidden="true">
            {activity.pieceIds.map((pieceId, index) => {
              const piece = KIDS_ACTIVITY_PIECES.find((candidate) => candidate.id === pieceId);
              return (
                <span className={`placed-piece ${piecePositionClasses[index]}`} key={`${pieceId}-${index}`}>
                  {piece?.symbol}
                </span>
              );
            })}
          </div>
          {activity.pieceIds.length === 0 && (
            <p className="stage-hint">Add your first piece</p>
          )}
          <span className="mode-badge">{activity.mode === "play" ? "Playing" : "Building"}</span>
        </div>

        <div className="play-row">
          <button
            className="play-button"
            type="button"
            aria-pressed={activity.mode === "play"}
            onClick={() =>
              run({ action: activity.mode === "play" ? "play.stop" : "play.start" })
            }
          >
            <span aria-hidden="true">{activity.mode === "play" ? "■" : "▶"}</span>
            {activity.mode === "play" ? "Stop" : "Play my world"}
          </button>
          <p className="activity-message" aria-live="polite">
            {message}
          </p>
        </div>
      </div>

      <div className="builder">
        <fieldset disabled={activity.mode === "play"}>
          <legend>1. Pick a place</legend>
          <div className="choice-row world-choices">
            {KIDS_ACTIVITY_WORLDS.map((choice) => (
              <button
                className={activity.worldId === choice.id ? "choice is-selected" : "choice"}
                key={choice.id}
                type="button"
                aria-pressed={activity.worldId === choice.id}
                onClick={() => run({ action: "world.choose", worldId: choice.id })}
              >
                <span className="choice-symbol" aria-hidden="true">
                  {choice.symbol}
                </span>
                <span>{choice.label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset disabled={activity.mode === "play"}>
          <legend>2. Add something</legend>
          <div className="choice-row piece-choices">
            {KIDS_ACTIVITY_PIECES.map((piece) => (
              <button
                className="choice"
                key={piece.id}
                type="button"
                disabled={activity.pieceIds.length >= KIDS_ACTIVITY_PIECE_LIMIT}
                onClick={() => run({ action: "piece.add", pieceId: piece.id })}
              >
                <span className="choice-symbol" aria-hidden="true">
                  {piece.symbol}
                </span>
                <span>{piece.label}</span>
              </button>
            ))}
          </div>
          <p className="piece-count">
            {activity.pieceIds.length} of {KIDS_ACTIVITY_PIECE_LIMIT} pieces
          </p>
        </fieldset>

        <div className="edit-actions">
          <button
            type="button"
            disabled={activity.mode === "play" || activity.pieceIds.length === 0}
            onClick={() => run({ action: "piece.undo" })}
          >
            Undo last
          </button>
          <button
            type="button"
            disabled={activity.mode === "play"}
            onClick={() => run({ action: "scene.reset" })}
          >
            Start over
          </button>
        </div>

        <details className="grownups">
          <summary>For grown-ups</summary>
          <p>
            This first activity works only in this browser tab. It does not ask for a
            name, save a project, or send activity anywhere.
          </p>
        </details>
      </div>
    </section>
  );
}
