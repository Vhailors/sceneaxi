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
import { Icon, Picture } from "./kids-art.js";

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
  readonly pieces: readonly { readonly pieceId: string; readonly slot: number }[];
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
  const isFull = pieceCount >= KIDS_ACTIVITY_PIECE_LIMIT;
  const isPlaying = activity.mode === "play";

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
              .map((pieceId, offset) => ({ pieceId, slot: keptCount + offset }))
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
      <div className="table">
        <div
          className={`stage world-${activity.worldId}${isPlaying ? " is-playing" : ""}`}
          role="group"
          aria-label={`${world.label}. ${pieceCount} of ${KIDS_ACTIVITY_PIECE_LIMIT} pieces added.`}
        >
          {departure?.worldId != null && (
            <div
              className={`world-departure world-${departure.worldId}`}
              key={`world-${departure.serial}`}
              aria-hidden="true"
            />
          )}
          <div className="sky-picture" key={`sky-${activity.worldId}`} aria-hidden="true">
            <Picture id={activity.worldId} />
          </div>
          <div className="horizon" aria-hidden="true" />
          <div className="placed-pieces" aria-hidden="true">
            {activity.pieceIds.map((pieceId, index) => (
              <span className={`placed-piece ${piecePositionClasses[index]}`} key={`${pieceId}-${index}`}>
                <Picture id={pieceId} />
              </span>
            ))}
          </div>
          {departure !== null && departure.pieces.length > 0 && (
            <div className="leaving-pieces" key={`leaving-${departure.serial}`} aria-hidden="true">
              {departure.pieces.map((piece) => (
                <span className={`leaving-piece ${piecePositionClasses[piece.slot]}`} key={piece.slot}>
                  <Picture id={piece.pieceId} />
                </span>
              ))}
            </div>
          )}
          {pieceCount === 0 && <p className="stage-hint">Add your first piece</p>}
          <span className={isPlaying ? "mode-badge is-playing" : "mode-badge"} key={activity.mode}>
            <Icon name={isPlaying ? "play" : "build"} />
            {isPlaying ? "Playing" : "Building"}
          </span>
        </div>

        <div className="play-row">
          <button
            className="play-button"
            type="button"
            aria-pressed={isPlaying}
            onClick={() => run({ action: isPlaying ? "play.stop" : "play.start" })}
          >
            <span className="play-station" aria-hidden="true">
              <Icon name={isPlaying ? "stop" : "play"} />
            </span>
            {isPlaying ? "Stop" : "Play my world"}
          </button>
          <p className={note.refused ? "activity-message is-refused" : "activity-message"} aria-live="polite">
            <span className="message-text" key={note.serial}>
              <Icon name={note.refused ? "info" : "note"} />
              <span>{note.text}</span>
            </span>
          </p>
        </div>
      </div>

      <div className="builder">
        <fieldset className="tray" disabled={isPlaying}>
          <legend>
            <span className="step" aria-hidden="true">1</span>Pick a place
          </legend>
          <div className="choice-row world-choices">
            {KIDS_ACTIVITY_WORLDS.map((choice) => {
              const chosen = activity.worldId === choice.id;

              // The "Picked" tag sits beside the button, not inside it: the button's
                // name stays its visible label (WCAG 2.5.3), aria-pressed carries the
                // state, and the tag is plain text that screen readers still read.
                return (
                  <div className="choice-cell" key={choice.id}>
                  <button
                      className={chosen ? "choice is-selected" : "choice"}
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => run({ action: "world.choose", worldId: choice.id })}
                  >
                    <span className="station" aria-hidden="true">
                        <Picture id={choice.id} />
                      </span>
                      <span className="choice-label">{choice.label}</span>
                    </button>
                    {chosen && (
                      <span className="chosen-tag">
                        <Icon name="chosen" />
                        Picked
                      </span>
                    )}
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="tray" disabled={isPlaying}>
          <legend>
            <span className="step" aria-hidden="true">2</span>Add something
          </legend>
          <div className="choice-row piece-choices">
            {KIDS_ACTIVITY_PIECES.map((piece) => (
              <button
                className="choice"
                key={piece.id}
                type="button"
                disabled={isFull}
                onClick={() => run({ action: "piece.add", pieceId: piece.id })}
              >
                <span className="station" aria-hidden="true">
                  <Picture id={piece.id} />
                </span>
                <span className="choice-label">{piece.label}</span>
              </button>
            ))}
          </div>
          <div className={isFull ? "piece-progress is-full" : "piece-progress"}>
            <span className="piece-meter" aria-hidden="true">
              {Array.from({ length: KIDS_ACTIVITY_PIECE_LIMIT }, (_, slot) => (
                <span className={slot < pieceCount ? "meter-dot is-filled" : "meter-dot"} key={slot} />
              ))}
            </span>
            <p className="piece-count">
              {isFull && <Icon name="full" />}
              {pieceCount} of {KIDS_ACTIVITY_PIECE_LIMIT} pieces
            </p>
          </div>
        </fieldset>

        <div className="edit-actions">
          <button
            type="button"
            disabled={isPlaying || pieceCount === 0}
            onClick={() => run({ action: "piece.undo" })}
          >
            <Icon name="undo" />
            Undo last
          </button>
          <button type="button" disabled={isPlaying} onClick={() => run({ action: "scene.reset" })}>
            <Icon name="restart" />
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
