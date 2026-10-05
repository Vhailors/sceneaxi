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

/** The line under the Play button. `serial` re-runs its entrance even when the words repeat. */
type ActivityNote = {
  readonly text: string;
  readonly refused: boolean;
  readonly serial: number;
};

/**
 * Presentation only: what just left the stage, kept one render longer so it can fade
 * out instead of vanishing. It never feeds the reducer and is not activity state.
 */
type StageDeparture = {
  readonly serial: number;
  readonly worldId: string | null;
  readonly pieces: readonly { readonly symbol: string; readonly slot: number }[];
};

export function KidsStudio() {
  const [activity, setActivity] = useState(createKidsActivityState);
  const [note, setNote] = useState<ActivityNote>({
    text: "Your sunny meadow is ready.",
    refused: false,
    serial: 0,
  });
  const [departure, setDeparture] = useState<StageDeparture | null>(null);

  const world = KIDS_ACTIVITY_WORLDS.find((candidate) => candidate.id === activity.worldId);
  if (world === undefined) throw new Error("The curated Kids world is missing.");

  const pieceCount = activity.pieceIds.length;

  function symbolFor(pieceId: string) {
    return KIDS_ACTIVITY_PIECES.find((candidate) => candidate.id === pieceId)?.symbol ?? "";
  }

  function run(request: KidsActivityRequest) {
    const decision = applyKidsActivityAction(activity, request);
    const serial = note.serial + 1;
    setNote({ text: decision.message, refused: !decision.ok, serial });
    if (decision.ok) {
      const next = decision.state;
      const keptCount = next.pieceIds.length;
      const leaving =
        keptCount < activity.pieceIds.length
          ? activity.pieceIds
              .slice(keptCount)
              .map((pieceId, offset) => ({ symbol: symbolFor(pieceId), slot: keptCount + offset }))
          : [];
      const leavingWorld = next.worldId !== activity.worldId ? activity.worldId : null;
      setDeparture(
        leaving.length > 0 || leavingWorld !== null
          ? { serial, worldId: leavingWorld, pieces: leaving }
          : null,
      );
      setActivity(next);
    }
  }

  return (
    <section className="studio" aria-label="Tiny world maker">
      <div className="stage-wrap">
        <div
          className={`stage world-${activity.worldId} ${activity.mode === "play" ? "is-playing" : ""}`}
          role="group"
          aria-label={`${world.label}. ${activity.pieceIds.length} of ${KIDS_ACTIVITY_PIECE_LIMIT} pieces added.`}
        >
          {departure?.worldId != null && (
            <div
              className={`world-departure world-${departure.worldId}`}
              key={`world-${departure.serial}`}
              aria-hidden="true"
            />
          )}
          <div className="sky-symbol" key={`sky-${activity.worldId}`} aria-hidden="true">
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
          {departure !== null && departure.pieces.length > 0 && (
            <div className="leaving-pieces" key={`leaving-${departure.serial}`} aria-hidden="true">
              {departure.pieces.map((piece) => (
                <span
                  className={`leaving-piece ${piecePositionClasses[piece.slot]}`}
                  key={piece.slot}
                >
                  {piece.symbol}
                </span>
              ))}
            </div>
          )}
          {activity.pieceIds.length === 0 && (
            <p className="stage-hint">Add your first piece</p>
          )}
          <span className="mode-badge" key={activity.mode}>
            {activity.mode === "play" ? "Playing" : "Building"}
          </span>
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
            <span className="play-glyph" aria-hidden="true">
              {activity.mode === "play" ? "■" : "▶"}
            </span>
            {activity.mode === "play" ? "Stop" : "Play my world"}
          </button>
          <p
            className={note.refused ? "activity-message is-refused" : "activity-message"}
            aria-live="polite"
          >
            <span className="message-text" key={note.serial}>
              {note.text}
            </span>
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
                <span className="choice-label">{choice.label}</span>
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
                <span className="choice-label">{piece.label}</span>
              </button>
            ))}
          </div>
          <div className="piece-progress">
            <span
              className={
                pieceCount >= KIDS_ACTIVITY_PIECE_LIMIT ? "piece-meter is-full" : "piece-meter"
              }
              aria-hidden="true"
            >
              {Array.from({ length: KIDS_ACTIVITY_PIECE_LIMIT }, (_, slot) => (
                <span className={slot < pieceCount ? "meter-dot is-filled" : "meter-dot"} key={slot} />
              ))}
            </span>
            <p className="piece-count">
              {activity.pieceIds.length} of {KIDS_ACTIVITY_PIECE_LIMIT} pieces
            </p>
          </div>
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
