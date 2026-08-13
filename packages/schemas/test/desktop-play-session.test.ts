import { describe, expect, it } from "vitest";
import {
  PLAY_SESSION_REFUSALS,
  disposePlaySession,
  resetPlaySession,
  setPlayViewportSource,
  startPlaySession,
  stopPlaySession,
} from "@sceneaxi/schemas";

const source = {
  sourceDocumentPath: "scene.json",
  sourceContentHash: `sha256:${"ab".repeat(32)}`,
  document: { title: "Authoring" },
};

describe("isolated Play session", () => {
  it("records a distinct clone and keeps authoring bytes untouched across stop and reset", () => {
    const started = startPlaySession(source);
    expect(started).toMatchObject({
      ok: true,
      session: { state: "playing", viewportSource: "game", authoringBytesUnchanged: true },
    });
    if (!started.ok) throw new Error(started.message);
    expect(started.session.cloneDigest).not.toBe(source.sourceContentHash);
    const stopped = stopPlaySession(started.session);
    expect(stopped).toMatchObject({
      ok: true,
      session: { state: "stopped", viewportSource: "scene", sourceContentHash: source.sourceContentHash },
    });
    if (!stopped.ok) throw new Error(stopped.message);
    const reset = resetPlaySession(stopped.session, source.document);
    expect(reset).toMatchObject({
      ok: true,
      session: { state: "playing", cloneDigest: started.session.cloneDigest },
    });
    const switched = setPlayViewportSource(started.session, "scene");
    expect(switched).toMatchObject({ ok: true, session: { viewportSource: "scene" } });
    expect(disposePlaySession(started.session)).toMatchObject({
      ok: true,
      session: { state: "disposed" },
    });
  });

  it("names missing, disposed, and invalid viewport-source refusals", () => {
    expect(stopPlaySession(null)).toMatchObject({
      ok: false,
      reason: PLAY_SESSION_REFUSALS.sessionMissing,
    });
    const started = startPlaySession(source);
    if (!started.ok) throw new Error(started.message);
    const disposed = disposePlaySession(started.session);
    if (!disposed.ok) throw new Error(disposed.message);
    expect(resetPlaySession(disposed.session, source.document)).toMatchObject({
      ok: false,
      reason: PLAY_SESSION_REFUSALS.sessionDisposed,
    });
    expect(setPlayViewportSource(started.session, "unknown")).toMatchObject({
      ok: false,
      reason: PLAY_SESSION_REFUSALS.viewportSourceInvalid,
    });
  });
});
