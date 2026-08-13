import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SCENE_ANIMATION_REFUSALS,
  createEditorCommandInvocation,
  type EditorCommandClient,
  type JsonObject,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  createDesktopBridge,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-animation-golden-"));
  dirs.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  return root;
}

function bridge(root: string) {
  return createDesktopBridge({
    cwd: root,
    commandCapabilities: ["scene.compose", "authoring.change-review", "authoring.undo", "authoring.redo", "runtime.play"],
  });
}

function hash(host: ReturnType<typeof createDesktopBridge>) {
  const response = host.handle({
    action: "authoring",
    payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
  });
  if (!response.ok || typeof (response.data as { contentHash?: unknown }).contentHash !== "string") {
    throw new Error("fixture status did not return a content hash");
  }
  return (response.data as { contentHash: string }).contentHash;
}

function command(
  host: ReturnType<typeof createDesktopBridge>,
  commandId: Parameters<typeof createEditorCommandInvocation>[0],
  client: EditorCommandClient,
  input: JsonObject,
) {
  return host.handle({
    action: "command",
    payload: createEditorCommandInvocation(commandId, client, input, "game"),
  });
}

function accept(host: ReturnType<typeof createDesktopBridge>, client: EditorCommandClient = "desktop-control") {
  expect(command(host, "change-review-accept", client, {})).toMatchObject({ ok: true });
}

describe("full-editor animation vertical", () => {
  it("authors clips through review, scrubs without writing, and replays identical Play samples", () => {
    const root = fixture();
    const host = bridge(root);
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    expect(command(host, "animation-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: { kind: "clip-upsert", clipId: "idle", name: "Idle", startMs: 0, durationMs: 1000 },
    })).toMatchObject({ ok: true });
    accept(host);
    expect(command(host, "animation-apply", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: {
        kind: "track-upsert",
        trackId: "tx",
        clipId: "idle",
        targetInstanceId: "desktop-crate-beside",
        propertyId: "translation-x",
      },
    })).toMatchObject({ ok: true });
    accept(host, "cli");
    expect(command(host, "animation-apply", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: {
        kind: "keyframe-upsert",
        keyframeId: "k0",
        trackId: "tx",
        timeMs: 0,
        value: 0,
        interpolation: "linear",
      },
    })).toMatchObject({ ok: true });
    accept(host, "local-agent");
    expect(command(host, "animation-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: {
        kind: "keyframe-upsert",
        keyframeId: "k1",
        trackId: "tx",
        timeMs: 1000,
        value: 8,
        interpolation: "linear",
      },
    })).toMatchObject({ ok: true });
    accept(host);
    const saved = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    const version = hash(host);
    const scrubbed = command(host, "animation-scrub", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: version,
      profile: "game",
      timeMs: 250,
    });
    expect(scrubbed).toMatchObject({
      ok: true,
      data: {
        kind: "sceneaxi.scene-animation-evaluation",
        sourceContentHash: version,
        savedBytesWritten: false,
        samples: [{ instanceId: "desktop-crate-beside", propertyId: "translation-x", value: 2 }],
      },
    });
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).toEqual(saved);
    const replayed = ["desktop-control", "cli", "local-agent"].map((client) =>
      command(host, "animation-evaluate", client as EditorCommandClient, {
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: version,
        profile: "game",
        timeMs: 250,
      }),
    );
    expect(replayed[0]).toEqual(replayed[1]);
    expect(replayed[1]).toEqual(replayed[2]);
    expect(replayed[0]).toEqual(scrubbed);
    expect(command(host, "edit-undo", "desktop-control", {})).toMatchObject({ ok: true });
    expect(command(host, "edit-redo", "desktop-control", {})).toMatchObject({ ok: true });
    const inspected = command(host, "animation-inspect", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    });
    expect(inspected).toMatchObject({
      ok: true,
      data: { kind: "sceneaxi.scene-animation-inspection", catalog: { clips: [{ clipId: "idle" }] } },
    });
    expect(before.equals(saved)).toBe(false);
  });

  it("names missing targets, invalid ranges, unsupported interpolation, and unbound imported data", () => {
    const root = fixture();
    const host = bridge(root);
    expect(command(host, "animation-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: { kind: "clip-upsert", clipId: "idle", name: "Idle", startMs: 0, durationMs: 0 },
    })).toMatchObject({ ok: false, reason: SCENE_ANIMATION_REFUSALS.timeRangeInvalid });
    expect(command(host, "animation-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: { kind: "clip-upsert", clipId: "idle", name: "Idle", startMs: 0, durationMs: 1000 },
    })).toMatchObject({ ok: true });
    accept(host);
    expect(command(host, "animation-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: {
        kind: "track-upsert",
        trackId: "tx",
        clipId: "idle",
        targetInstanceId: "missing-node",
        propertyId: "translation-x",
      },
    })).toMatchObject({ ok: false, reason: SCENE_ANIMATION_REFUSALS.targetMissing });
    expect(command(host, "animation-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: {
        kind: "track-upsert",
        trackId: "tx",
        clipId: "idle",
        targetInstanceId: "desktop-crate-beside",
        propertyId: "translation-x",
      },
    })).toMatchObject({ ok: true });
    accept(host);
    expect(command(host, "animation-apply", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      mutation: {
        kind: "keyframe-upsert",
        keyframeId: "k0",
        trackId: "tx",
        timeMs: 0,
        value: 1,
        interpolation: "bezier",
      },
    })).toMatchObject({ ok: false, reason: SCENE_ANIMATION_REFUSALS.interpolationUnsupported });
    expect(command(host, "animation-evaluate", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      timeMs: 0,
      requireBoundAsset: true,
    })).toMatchObject({ ok: false, reason: SCENE_ANIMATION_REFUSALS.assetUnbound });
  });
});
