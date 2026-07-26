/**
 * Golden path for the entitled Minimum E2 editor's live viewport (Ladder Step 5).
 *
 * The browser adds a canvas and `requestAnimationFrame` and nothing else, so everything
 * between the URL state and the draw call is provable in node: URL state → a real
 * Minimum E2 session → `composeSceneProjection()` → browser mount payload → Sculpt
 * Mount API → the one Three presentation core.
 *
 * WebGL cannot run in node, so this test drives the **headless** surface of that same
 * core and asserts it never claims pixels. What proves the *browser* route is different
 * is asserted here too: the canvas path really constructs a `WebGLRenderer`, which must
 * fail in node, so a silently stubbed renderer cannot pass this gate. The pixel claim
 * itself is a recorded browser observation in `docs/three-presentation-core.md`.
 *
 * The other load-bearing property is the boundary: the viewport draws what the editor
 * composed and never advances the kernel. Rendering the same scene many times must
 * leave the session's tick where it was.
 */
import { describe, expect, it } from "vitest";
import {
  THREE_HEADLESS_SURFACE_LABEL,
  createSculptMountApi,
  createThreeRenderLoop,
  createThreeSculptPresentationBackend,
  type FrameScheduler,
} from "../../packages/engine-presentation/src/index.ts";
import {
  EDITOR_MAX_OBJECTS,
  EDITOR_MIN_OBJECTS,
  WEB_EDITOR_SESSION_OPERATIONS,
  decideEditorAccess,
  decideEditorEntitlement,
  ok,
  readEditorState,
  renderEditorState,
  type EditorEntitlementInput,
  type EditorRender,
  type MountableScene,
  type SearchParams,
  type SitePrincipal,
} from "@sceneaxi/site-kit";

/**
 * Render one editor URL exactly as the entitled route does.
 *
 * Memoised per URL. Reconstruction is deterministic for the fixed seed — that is
 * asserted in `packages/site-kit/test/editor-session.test.ts` — so re-rendering the
 * same URL would only repeat a full multi-pass reconstruction and propose/apply for
 * an identical result.
 */
const RENDER_CACHE = new Map<string, EditorRender>();

/** A real render, never cached — the session is built, driven, saved, and disposed. */
function freshEditorRender(params: SearchParams = {}): EditorRender {
  const state = readEditorState(params);
  if (!state.ok) throw new Error(`editor state refused: ${state.reason}`);
  const render = renderEditorState(state.value);
  if (!render.ok) throw new Error(`editor render refused: ${render.reason}`);
  return render.value;
}

function editorRender(params: SearchParams = {}): EditorRender {
  const key = JSON.stringify(params);
  const cached = RENDER_CACHE.get(key);
  if (cached !== undefined) return cached;
  const render = freshEditorRender(params);
  RENDER_CACHE.set(key, render);
  return render;
}

function editorScene(params: SearchParams = {}): MountableScene {
  const mountable = editorRender(params).mountable;
  if (mountable === null) throw new Error("the editor composed no scene to mount");
  return mountable;
}

/** Mount every instance of the composed scene exactly as the browser viewport does. */
function mountEditorScene(scene: MountableScene) {
  const backend = createThreeSculptPresentationBackend();
  const mounts = createSculptMountApi(backend);
  for (const instance of scene.instances) {
    const artifact = scene.artifacts[instance.artifactId];
    if (artifact === undefined) throw new Error(`composed scene omits ${instance.artifactId}`);
    mounts.mount({
      instanceId: instance.instanceId,
      artifact,
      transform: instance.worldTransform,
    });
  }
  return { backend, mounts };
}

/** Deterministic stand-in for `requestAnimationFrame`, driven frame by frame. */
function manualScheduler(): FrameScheduler & { tick(timeMs: number): void } {
  const pending: ((timeMs: number) => void)[] = [];
  return {
    request(callback) {
      pending.push(callback);
      return pending.length;
    },
    cancel() {
      pending.length = 0;
    },
    tick(timeMs) {
      const next = pending.shift();
      if (next !== undefined) next(timeMs);
    },
  };
}

describe("entitled editor viewport — the composed scene reaches the Three core", () => {
  it("mounts every composed instance and draws them through one core", () => {
    const scene = editorScene();
    const { mounts } = mountEditorScene(scene);

    expect(scene.instances.length).toBeGreaterThanOrEqual(EDITOR_MIN_OBJECTS);
    expect(scene.instances.length).toBeLessThanOrEqual(EDITOR_MAX_OBJECTS);
    expect(mounts.list().map((instance) => instance.instanceId)).toEqual(
      scene.instances.map((instance) => instance.instanceId),
    );

    const frame = mounts.render();
    expect(frame.backend).toBe("three");
    expect(frame.instanceIds).toEqual(
      [...scene.instances.map((instance) => instance.instanceId)].sort(),
    );
    // One draw per mesh a renderer would issue: every artifact node of every instance.
    const nodesPerInstance = scene.instances.map(
      (instance) => scene.artifacts[instance.artifactId]?.runtimeHierarchy.nodes.length ?? 0,
    );
    expect(frame.drawCalls).toBe(nodesPerInstance.reduce((sum, count) => sum + count, 0));
    expect(frame.drawCalls).toBeGreaterThan(0);

    mounts.dispose();
  });

  it("never lets the node gate claim pixels it did not draw", () => {
    const { backend, mounts } = mountEditorScene(editorScene());
    const frame = mounts.render();

    expect(frame.surface).toBe("headless");
    expect(frame.pixelsDrawn).toBe(false);
    expect(frame.label).toBe(THREE_HEADLESS_SURFACE_LABEL);
    expect(backend.capture()).toBeNull();

    mounts.dispose();
  });

  it("builds a real WebGLRenderer on the canvas path, so node must refuse it", () => {
    expect(() =>
      createThreeSculptPresentationBackend({
        canvas: {
          width: 960,
          height: 540,
          getContext: () => null,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as never,
      }),
    ).toThrow(/webgl/i);
  });

  it("frames the composed scene and accepts orbit and zoom as plain numbers", () => {
    const { backend, mounts } = mountEditorScene(editorScene({ objects: "4" }));
    const initial = backend.camera.state();

    backend.frameMountedContent();
    const framed = backend.camera.state();
    expect(framed.distance).toBeGreaterThan(initial.distance);

    const orbited = backend.camera.dragOrbit(120, -40);
    expect(orbited.azimuthRadians).not.toBe(framed.azimuthRadians);
    const zoomed = backend.camera.wheelZoom(300);
    expect(zoomed.distance).toBeGreaterThan(orbited.distance);
    // "Reset view" returns to the camera the session was constructed with.
    expect(backend.camera.reset()).toEqual(initial);

    mounts.dispose();
  });

  it("draws one frame per scheduled tick, so the viewport loop is real", () => {
    const { mounts } = mountEditorScene(editorScene());
    const scheduler = manualScheduler();
    const frames: number[] = [];
    const loop = createThreeRenderLoop({
      scheduler,
      onFrame: () => frames.push(mounts.render().frame),
    });

    loop.start();
    for (let tick = 1; tick <= 4; tick += 1) scheduler.tick(tick * 16);
    loop.stop();

    expect(frames).toEqual([1, 2, 3, 4]);
    expect(loop.running()).toBe(false);

    mounts.dispose();
  });

  it("mounts and unmounts live, which is what the isolate-selection control uses", () => {
    const scene = editorScene({ objects: "3" });
    const { mounts } = mountEditorScene(scene);
    const others = scene.instances.filter(
      (instance) => instance.instanceId !== scene.rootInstanceId,
    );
    expect(others.length).toBeGreaterThan(0);

    for (const other of others) mounts.unmount(other.instanceId);
    expect(mounts.render().instanceIds).toEqual([scene.rootInstanceId]);

    // Reconciliation is idempotent and converges from any starting state, without the
    // renderer ever being rebuilt.
    for (const other of others) {
      const artifact = scene.artifacts[other.artifactId];
      if (artifact === undefined) throw new Error("composed scene omits an artifact");
      mounts.mount({
        instanceId: other.instanceId,
        artifact,
        transform: other.worldTransform,
      });
    }
    expect(mounts.render().instanceIds).toEqual(
      [...scene.instances.map((instance) => instance.instanceId)].sort(),
    );

    mounts.dispose();
  });

  it("releases the renderer once, and refuses every call after that", () => {
    const { mounts } = mountEditorScene(editorScene());
    mounts.dispose();
    expect(() => mounts.render()).toThrow(/disposed/i);
    expect(() => mounts.list()).toThrow(/disposed/i);
    expect(() => mounts.dispose()).toThrow(/disposed/i);
  });
});

describe("the viewport draws the editor's scene and never advances it", () => {
  it("moves an instance only when the editor's own state moves it", () => {
    const atOrigin = editorScene({ objects: "2", "tx-object-2": "0,0,0" });
    const moved = editorScene({ objects: "2", "tx-object-2": "7,0,0" });

    const translationOf = (scene: MountableScene, instanceId: string) =>
      scene.instances.find((instance) => instance.instanceId === instanceId)?.worldTransform
        .translation;

    expect(translationOf(atOrigin, "object-2")).toEqual([0, 0, 0]);
    expect(translationOf(moved, "object-2")).toEqual([7, 0, 0]);
    // A different scene is a different scene, not a redraw of the same one.
    expect(atOrigin.sceneDigest).not.toBe(moved.sceneDigest);
  });

  it("leaves the session tick untouched however many frames are drawn", () => {
    const render = editorRender();
    const before = render.snapshot.tick;
    const scene = render.mountable;
    if (scene === null) throw new Error("the editor composed no scene to mount");

    const { mounts } = mountEditorScene(scene);
    for (let frame = 0; frame < 30; frame += 1) mounts.render();
    mounts.dispose();

    // Presentation consumes a composed snapshot; it holds no kernel session and can
    // advance nothing. A *fresh* render of the same URL — a new session, built after
    // those frames were drawn — proves the tick did not move.
    expect(freshEditorRender().snapshot.tick).toBe(before);
  });

  it("exposes no drawing operation on the bounded Minimum E2 surface", () => {
    // The viewport is a consumer of the session's output, not a session operation, so
    // adding it must not have widened the frozen checklist.
    expect([...WEB_EDITOR_SESSION_OPERATIONS]).not.toContain("render");
    expect([...WEB_EDITOR_SESSION_OPERATIONS]).not.toContain("draw");
    expect([...WEB_EDITOR_SESSION_OPERATIONS]).toContain("viewport");
  });
});

const VIEWER: SitePrincipal = {
  user: {
    userId: "user-1",
    email: "viewer@example.com",
    emailVerified: true,
    disabled: false,
  },
  role: "user",
  session: {
    sessionId: "session-1",
    userId: "user-1",
    surface: "site",
    issuedAt: "2026-07-26T11:00:00.000Z",
    expiresAt: "2026-07-26T13:00:00.000Z",
  },
};

describe("no scene is composed for a request the editor refuses", () => {
  /**
   * Entitlement is decided before a session is constructed, so a refused request never
   * reaches `renderEditorState` and there is nothing for a canvas to draw. These are the
   * refusals the route renders instead of a viewport.
   */
  const REFUSED: ReadonlyArray<
    readonly [string, EditorEntitlementInput, string]
  > = [
    ["signed out", { principal: null, credits: null }, "EDITOR_ENTITLEMENT_ANONYMOUS"],
    ["entitlement unavailable", { principal: VIEWER, credits: null }, "EDITOR_ENTITLEMENT_UNAVAILABLE"],
    [
      "out of credits",
      {
        principal: VIEWER,
        credits: ok({ userId: "user-1", balance: 0, starterGrantConsumed: true }),
      },
      "EDITOR_ENTITLEMENT_NO_CREDITS",
    ],
  ];

  it.each(REFUSED)("refuses %s with a named reason and opens no viewport", (_label, input, reason) => {
    const entitlement = decideEditorEntitlement(input);
    expect(entitlement.entitled).toBe(false);
    expect(entitlement.entitled === false && entitlement.reason).toBe(reason);

    const decision = decideEditorAccess({ entitlement, previewEnabled: false });
    expect(decision.granted).toBe(false);
    expect(decision.granted === false && decision.reason).toBe(reason);
  });

  it("grants an entitled viewer the session the viewport draws", () => {
    const entitlement = decideEditorEntitlement({
      principal: VIEWER,
      credits: ok({ userId: "user-1", balance: 12, starterGrantConsumed: true }),
    });
    const decision = decideEditorAccess({ entitlement, previewEnabled: false });
    expect(decision).toMatchObject({ granted: true, mode: "entitled", basis: "credit-balance" });
    expect(editorScene().instances.length).toBeGreaterThanOrEqual(EDITOR_MIN_OBJECTS);
  });

  it("still refuses when the request is otherwise a perfectly good editor link", () => {
    const state = readEditorState({ objects: "3", sel: "object-2" });
    expect(state.ok).toBe(true);
    const decision = decideEditorAccess({
      entitlement: decideEditorEntitlement({ principal: null, credits: null }),
      previewEnabled: false,
    });
    // A valid link is not an entitlement: link validity and access are independent, and
    // access is what decides whether a session — and therefore a scene — exists.
    expect(decision.granted).toBe(false);
  });

  it("refuses a malformed editor link before any scene is composed", () => {
    const refused = readEditorState({ "tx-object-1": "1junk,0,0" });
    expect(refused.ok).toBe(false);
    expect(refused.ok === false && refused.reason).toBe("SITE_REQUEST_MALFORMED");
  });

  it("ties the mount payload to the composition, with no third state between them", () => {
    // The shipped states are exactly two: a composed scene to mount, or the pipeline's
    // own refusal with nothing to mount. There is no "draw something anyway".
    for (const objects of ["2", "3", "4"]) {
      const render = editorRender({ objects });
      expect(render.mountable !== null).toBe(render.composition.ok);
    }
  });
});
