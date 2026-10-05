import { DataTexture, GridHelper, Mesh, MeshStandardMaterial, Object3D, Points } from "three";
import { describe, expect, it, vi } from "vitest";
import {
  THREE_HEADLESS_SURFACE_LABEL,
  THREE_PRESENTATION_CORE_LABEL,
  ThreePresentationError,
  createSculptMountApi,
  createThreePresentationCore,
  createThreePresentationRuntime,
  createThreeRenderLoop,
  createThreeSculptPresentationBackend,
  hostAnimationFrameScheduler,
  type FrameScheduler,
  type ThreePresentationSurface,
  type ThreeRenderableHandle,
  type ThreeSceneEnvironment,
} from "@sceneaxi/engine-presentation";
import { open, type ProductManifest } from "@sceneaxi/engine-kernel";
import {
  OBJECT_SCULPT_SPEC_KIND,
  SCULPT_ARTIFACT_KIND,
  SCULPT_PROCEDURAL_EXPORT_NAME,
  SCULPT_PROCEDURAL_MODULE_ID,
  SCULPT_PROCEDURAL_SOURCE_DIGEST,
  SCULPT_SCHEMA_VERSION,
  digestObjectSculptSpec,
  emptySceneEffectsCatalog,
  sampleSceneEffects,
  projectAnimationReadyHierarchy,
  type SceneMaterialOverride,
  type SculptQualityArtifact,
} from "@sceneaxi/schemas";

const transform = {
  translation: [0, 0, 0],
  rotationEulerDegrees: [0, 0, 0],
  scale: [1, 1, 1],
} as const;

function fixtureArtifact(): SculptQualityArtifact {
  const hierarchy = [
    { id: "crate", parentId: null, componentId: "body", transform },
    {
      id: "cap",
      parentId: "crate",
      componentId: "cap",
      transform: { ...transform, translation: [0, 1.25, 0] },
    },
  ] as const;
  const spec = {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: OBJECT_SCULPT_SPEC_KIND,
    id: "canvas-crate",
    rootNodeId: "crate",
    complexityClass: "simple" as const,
    passes: [
      { id: "blockout", deterministic: true as const, steps: ["establish-volume"] },
      { id: "structure", deterministic: true as const, steps: ["place-components"] },
      { id: "materials", deterministic: true as const, steps: ["assign-materials"] },
      { id: "sockets", deterministic: true as const, steps: ["bind-sockets"] },
    ],
    materials: [{ id: "wood", baseColor: "#885522", metallic: 0, roughness: 0.8 }],
    components: [
      { id: "body", primitive: "box" as const, dimensions: [2, 2, 2] as const, materialId: "wood" },
      { id: "cap", primitive: "cylinder" as const, dimensions: [1, 0.5, 1] as const, materialId: "wood" },
    ],
    hierarchy,
    sockets: [
      {
        id: "cap-attachment",
        nodeId: "cap",
        kind: "attachment" as const,
        axis: "y" as const,
        amplitude: 0,
        frequencyHz: 0,
      },
    ],
  };
  const emitDigest =
    "sha256:5398cb8d19235d0c393c9d56f3958bd9c2700a90d2c0a03689753663a1192e08";
  return {
    schemaVersion: SCULPT_SCHEMA_VERSION,
    kind: SCULPT_ARTIFACT_KIND,
    artifactId: "canvas-crate-artifact",
    spec,
    proceduralModule: {
      moduleId: SCULPT_PROCEDURAL_MODULE_ID,
      exportName: SCULPT_PROCEDURAL_EXPORT_NAME,
      sourceDigest: SCULPT_PROCEDURAL_SOURCE_DIGEST,
      seed: 0,
      emitDigest,
    },
    runtimeHierarchy: projectAnimationReadyHierarchy(spec),
    evidence: {
      method: "structured-fixture",
      intakeDigest: `sha256:${"a".repeat(64)}`,
      specDigest: digestObjectSculptSpec(spec),
      proceduralModuleDigest: SCULPT_PROCEDURAL_SOURCE_DIGEST,
      qualityGates: [
        { id: "contract", status: "passed", digest: `sha256:${"d".repeat(64)}` },
        { id: "procedural-emit", status: "passed", digest: emitDigest },
      ],
    },
  };
}

type RecordedDraw = {
  readonly scene: ThreeRenderableHandle;
  readonly camera: ThreeRenderableHandle;
};

/**
 * Stands in for the WebGL canvas surface so the frame path is testable in node,
 * which has no WebGL context. It reports the canvas surface kind so the product
 * label and pixel claim of the real path are exercised too.
 */
function recordingSurface(drawCalls = 3) {
  const draws: RecordedDraw[] = [];
  const resizes: Array<readonly [number, number, number]> = [];
  let disposed = false;
  let captured: Uint8Array | null = null;
  const surface: ThreePresentationSurface = {
    kind: "webgl-canvas",
    resize(width, height, pixelRatio) {
      resizes.push([width, height, pixelRatio]);
    },
    draw(scene, camera) {
      draws.push({ scene, camera });
      captured = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      return { drawCalls, pixelsDrawn: true };
    },
    capture() {
      return captured;
    },
    dispose() {
      disposed = true;
    },
  };
  return {
    surface,
    draws,
    resizes,
    disposed: () => disposed,
  };
}

function sceneOf(draw: RecordedDraw | undefined) {
  if (!(draw?.scene instanceof Object3D)) throw new Error("surface received no scene");
  return draw.scene;
}

describe("Three presentation core — sculpt backend", () => {
  it("draws mounted artifacts through the injected canvas surface", () => {
    const recorder = recordingSurface(4);
    const backend = createThreeSculptPresentationBackend({
      surface: recorder.surface,
      viewport: { width: 800, height: 600, pixelRatio: 2 },
    });
    const mounts = createSculptMountApi(backend);
    mounts.mount({ instanceId: "crate-one", artifact: fixtureArtifact() });

    const frame = mounts.render();

    expect(frame).toEqual({
      backend: "three",
      label: THREE_PRESENTATION_CORE_LABEL,
      frame: 1,
      instanceIds: ["crate-one"],
      drawCalls: 4,
      surface: "webgl-canvas",
      pixelsDrawn: true,
    });
    expect(recorder.draws).toHaveLength(1);
    expect(recorder.resizes[0]).toEqual([800, 600, 2]);
    const scene = sceneOf(recorder.draws[0]);
    expect(scene.children.some((child) => child instanceof GridHelper)).toBe(true);
    expect(scene.getObjectByName("crate-one")).toBeDefined();
    expect(recorder.draws[0]?.camera).toBeInstanceOf(Object3D);

    expect(mounts.render().frame).toBe(2);
    mounts.dispose();
    expect(recorder.disposed()).toBe(true);
  });

  it("exposes orbit/zoom controls as plain numbers and frames mounted content", () => {
    const recorder = recordingSurface();
    const backend = createThreeSculptPresentationBackend({
      surface: recorder.surface,
      camera: { distance: 8, minDistance: 2, maxDistance: 20 },
    });
    const mounts = createSculptMountApi(backend);
    mounts.mount({ instanceId: "crate-one", artifact: fixtureArtifact() });

    const start = backend.camera.state();
    expect(start.distance).toBe(8);
    expect(start.position).toHaveLength(3);
    for (const component of start.position) expect(typeof component).toBe("number");

    const orbited = backend.camera.orbit(Math.PI / 2, 0);
    expect(orbited.azimuthRadians).toBeCloseTo(start.azimuthRadians + Math.PI / 2, 10);
    expect(orbited.position).not.toEqual(start.position);

    expect(backend.camera.zoom(0.01).distance).toBe(2);
    expect(backend.camera.zoom(1000).distance).toBe(20);

    backend.camera.setDistance(8);
    backend.frameMountedContent();
    const framed = backend.camera.state();
    expect(framed.target.map((value) => Math.round(value))).toEqual([0, 0, 0]);
    expect(framed.distance).toBeGreaterThan(1);
    expect(framed.distance).toBeLessThan(20);

    mounts.dispose();
  });

  it("echoes authored environment and effects on the headless surface", () => {
    const core = createThreePresentationCore({
      environment: {
        background: "#0A0F1A",
        effects: ["bloom", "vignette"],
      },
    });
    const frame = core.draw();
    expect(frame.pixelsDrawn).toBe(false);
    expect(frame.environmentBackground).toBe("#0A0F1A");
    expect(frame.effects).toEqual(["bloom", "vignette"]);
    core.setEnvironment({ background: "#101318", effects: ["bloom"] });
    expect(core.draw().effects).toEqual(["bloom"]);
    core.dispose();
  });

  it("projects and clears scalar overrides without changing artifact bytes or sibling instances", () => {
    const recorder = recordingSurface();
    const backend = createThreeSculptPresentationBackend({ surface: recorder.surface });
    const mounts = createSculptMountApi(backend);
    const artifact = fixtureArtifact();
    const before = JSON.stringify(artifact);

    const override: SceneMaterialOverride = {
      instanceId: "crate-one", emissiveColor: "#ff0000", emissiveIntensity: 2,
      opacity: 0.4, baseColorMapAssetId: null, normalMapAssetId: null, roughnessMapAssetId: null,
    };

    backend.setMaterialOverrides([override]);
    mounts.mount({ instanceId: "crate-one", artifact });
    mounts.mount({ instanceId: "crate-two", artifact });
    mounts.render();
    const scene = sceneOf(recorder.draws[0]);

    const materials = (id: string) => {
      const values: MeshStandardMaterial[] = [];
      scene.getObjectByName(id)?.traverse((node) => {
        if (node instanceof Mesh && node.material instanceof MeshStandardMaterial) values.push(node.material);
      });

      return values;
    };

    expect(materials("crate-one")).toHaveLength(2);

    for (const material of materials("crate-one")) {
      expect(material.emissive.getHexString()).toBe("ff0000");
      expect(material).toMatchObject({ emissiveIntensity: 2, opacity: 0.4, transparent: true, depthWrite: false });
    }

    expect(materials("crate-two")[0]).toMatchObject({ opacity: 1, transparent: false });

    for (const slot of ["baseColorMapAssetId", "normalMapAssetId", "roughnessMapAssetId"] as const) {
      expect(() => backend.setMaterialOverrides([{ ...override, [slot]: "image-one" }])).toThrow(/texture.*unresolved/i);
    }

    expect(() => backend.setMaterialOverrides([{ ...override, opacity: NaN }])).toThrow(/override/i);
    expect(materials("crate-one")[0]?.opacity).toBe(0.4);
    backend.mountTriangleAsset({
      instanceId: "crate-one", transform,
      meshes: [{ meshId: "triangle", positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2],
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        baseColor: "#ffffff", metallic: 0, roughness: 1 }],
    });
    expect(materials("crate-one")[0]).toMatchObject({ opacity: 0.4, emissiveIntensity: 2 });
    backend.setMaterialOverrides([]);
    expect(materials("crate-one")[0]).toMatchObject({ opacity: 1, transparent: false, depthWrite: true });
    expect(materials("crate-one")[0]?.emissive.getHexString()).toBe("000000");
    expect(JSON.stringify(artifact)).toBe(before);
    mounts.dispose();
  });

  it("draws the seeded sampler's positions, reuses buffers, and disposes removed emitters", () => {
    const recorder = recordingSurface();
    const backend = createThreeSculptPresentationBackend({ surface: recorder.surface });

    const emitter = { emitterId: "sparks", kind: "point" as const, rate: 3, lifetimeMs: 1000, speed: 2, spread: 1 };
    const catalog = { ...emptySceneEffectsCatalog(), seed: 17, emitters: [emitter] };
    const before = JSON.stringify(catalog);
    const expected = sampleSceneEffects({ catalog, timeMs: 250 });

    if (!expected.ok) throw new Error(expected.message);

    const evaluation = backend.sampleEffects(catalog, 250);
    expect(evaluation).toEqual(expected.evaluation);
    backend.render([]);
    const scene = sceneOf(recorder.draws[0]);
    const particles = scene.getObjectByName("sceneaxi-effect:sparks");

    if (!(particles instanceof Points)) throw new Error("Sampled emitter was not drawn as points.");

    expect(Array.from(particles.geometry.getAttribute("position").array).slice(0, 9)).toEqual(
      Array.from(new Float32Array(expected.evaluation.samples.flatMap((sample) => sample.positions.flat()))),
    );
    expect(particles.geometry.drawRange.count).toBe(3);
    const geometry = particles.geometry;
    const position = geometry.getAttribute("position");
    const digest = backend.sampleEffects(catalog, 251).digest;
    expect(digest).not.toBe(evaluation.digest);
    expect(backend.sampleEffects(catalog, 250)).toEqual(evaluation);
    expect(particles.geometry).toBe(geometry);
    expect(geometry.getAttribute("position")).toBe(position);
    // A viewport's frame clock is unbounded: an hour-old viewport must keep sampling,
    // and wrapping at the sampler's 60s window reproduces the same frame exactly.
    expect(backend.sampleEffects(catalog, 250 + 60_000)).toEqual(evaluation);
    expect(backend.sampleEffects(catalog, 250 + 3_600_000)).toEqual(evaluation);
    expect(() => backend.sampleEffects(catalog, -1)).toThrow(/time/i);
    expect(() => backend.sampleEffects(catalog, Number.POSITIVE_INFINITY)).toThrow(/time/i);
    expect(() => backend.sampleEffects({ ...catalog, emitters: [{ ...emitter, speed: NaN }] }, 0)).toThrow(/emitter/i);
    const geometryDisposed = vi.fn();
    const materialDisposed = vi.fn();
    geometry.addEventListener("dispose", geometryDisposed);

    if (Array.isArray(particles.material)) throw new Error("Expected one points material.");

    particles.material.addEventListener("dispose", materialDisposed);
    backend.sampleEffects(emptySceneEffectsCatalog(), 0);
    expect(scene.getObjectByName("sceneaxi-effect:sparks")).toBeUndefined();
    expect(geometryDisposed).toHaveBeenCalledOnce();
    expect(materialDisposed).toHaveBeenCalledOnce();
    expect(JSON.stringify(catalog)).toBe(before);
    backend.dispose();
  });

  it("refuses unknown postprocessing and forwards the closed renderer settings", () => {
    const settings: Array<ThreeSceneEnvironment | undefined> = [];
    const recorder = recordingSurface();

    const core = createThreePresentationCore({ surface: { ...recorder.surface,
      draw(scene, camera, environment) {
        settings.push(environment);

        return recorder.surface.draw(scene, camera);
      },
    } });

    core.setEnvironment({ effects: ["vignette", "bloom"], toneMapping: "reinhard", exposure: 0.8 });
    core.draw();
    expect(settings[0]).toMatchObject({ effects: ["vignette", "bloom"], toneMapping: "reinhard", exposure: 0.8 });
    // SAFETY: Deliberately bypass the typed vocabulary to check JavaScript callers.
    expect(() => core.setEnvironment({ effects: ["arbitrary-shader"] } as never)).toThrow(/effect/i);
    expect(() => core.setEnvironment({ exposure: NaN })).toThrow(/exposure/i);
    expect(core.draw().effects).toEqual(["vignette", "bloom"]);
    core.setEnvironment({ effects: [] });
    expect(core.draw().effects).toEqual([]);
    core.dispose();
  });

  it("keeps the deterministic headless surface honest about pixels", () => {
    const mounts = createSculptMountApi(createThreeSculptPresentationBackend());
    mounts.mount({ instanceId: "crate-one", artifact: fixtureArtifact() });

    const frame = mounts.render();

    expect(frame.surface).toBe("headless");
    expect(frame.pixelsDrawn).toBe(false);
    expect(frame.label).toBe(THREE_HEADLESS_SURFACE_LABEL);
    expect(frame.drawCalls).toBe(2);
    mounts.dispose();
  });

  it("builds a real WebGLRenderer for the canvas path", () => {
    // node has no WebGL context, so a real renderer must refuse here. A stub
    // renderer would have silently succeeded.
    expect(() =>
      createThreeSculptPresentationBackend({
        canvas: {
          width: 320,
          height: 240,
          getContext: () => null,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as never,
      }),
    ).toThrow(/webgl/i);
  });

  it("validates camera options before allocating a WebGL surface", () => {
    expect(() =>
      createThreeSculptPresentationBackend({
        canvas: {
          width: 320,
          height: 240,
          getContext: () => null,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as never,
        camera: { distance: 0 },
      }),
    ).toThrow(
      new ThreePresentationError(
        "invalid-camera",
        "distance must be greater than zero.",
      ),
    );
  });

  it("refuses a degenerate perspective field of view", () => {
    expect(() =>
      createThreeSculptPresentationBackend({
        camera: { fovDegrees: 180 },
      }),
    ).toThrow(
      new ThreePresentationError(
        "invalid-camera",
        "fovDegrees must be smaller than 180.",
      ),
    );
  });

  it("refuses an invalid canvas and an invalid viewport", () => {
    expect(() => createThreeSculptPresentationBackend({ canvas: null as never })).toThrow(
      ThreePresentationError,
    );
    expect(() =>
      createThreeSculptPresentationBackend({ viewport: { width: 0, height: 100 } }),
    ).toThrow(new ThreePresentationError("invalid-viewport", "Viewport width and height must be positive integers."));
  });
});

describe("Three presentation core — camera input wiring", () => {
  it("orbits on pointer drag and zooms on wheel through an attached target", () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const target = {
      addEventListener: vi.fn((type: string, listener: (event: unknown) => void) => {
        listeners.set(type, listener);
      }),
      removeEventListener: vi.fn((type: string) => {
        listeners.delete(type);
      }),
    };
    const backend = createThreeSculptPresentationBackend({
      surface: recordingSurface().surface,
      camera: { distance: 10, minDistance: 1, maxDistance: 100 },
    });

    const detach = backend.camera.attach(target);
    const before = backend.camera.state();

    listeners.get("pointerdown")?.({ clientX: 100, clientY: 100 });
    listeners.get("pointermove")?.({ clientX: 140, clientY: 100 });
    const dragged = backend.camera.state();
    expect(dragged.azimuthRadians).toBeLessThan(before.azimuthRadians);

    listeners.get("pointerup")?.({});
    listeners.get("pointermove")?.({ clientX: 400, clientY: 100 });
    expect(backend.camera.state().azimuthRadians).toBe(dragged.azimuthRadians);

    listeners.get("wheel")?.({ deltaY: 100 });
    expect(backend.camera.state().distance).toBeGreaterThan(dragged.distance);

    detach();
    expect(listeners.size).toBe(0);
    expect(target.removeEventListener).toHaveBeenCalledTimes(6);
    backend.dispose();
  });

  it("refuses an attach target that cannot register listeners", () => {
    const backend = createThreeSculptPresentationBackend();
    expect(() => backend.camera.attach({} as never)).toThrow(ThreePresentationError);
    backend.dispose();
  });

  it("mounts shared UV and decoded PNG payloads as an sRGB Three texture and disposes it", () => {
    const rendered: { scene: ThreeRenderableHandle | null } = { scene: null };
    const backend = createThreeSculptPresentationBackend({
      surface: {
        kind: "headless",
        resize() {},
        draw(value) { rendered.scene = value; return { drawCalls: 1, pixelsDrawn: false }; },
        capture() { return null; },
        dispose() {},
      },
    });
    const meshPayload = {
      meshId: "textured-triangle",
      nodeIndex: 0,
      positions: [-1, 0, 0, 1, 0, 0, 0, 1, 0],
      uvs: [0, 0, 1, 0, 0.5, 1],
      indices: [0, 1, 2],
      matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      baseColor: "#ffffff",
      metallic: 0,
      roughness: 1,
      baseColorTexture: { width: 1, height: 1, rgba: [255, 32, 8, 255] },
    };
    backend.mountTriangleAsset({ instanceId: "textured", transform, meshes: [meshPayload], nodes: [{ node: 0, parent: null, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], matrixAuthored: false, translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }] });
    backend.playTriangleAnimation("textured", { name: "move", duration: 1, channels: [{ node: 0, path: "translation", interpolation: "LINEAR", times: [0, 1], values: [0, 0, 0, 2, 1, 0] }] }, 0.5);
    expect(backend.render(["textured"]).pixelsDrawn).toBe(false);
    const scene = rendered.scene;
    expect(scene).toBeInstanceOf(Object3D);
    if (!(scene instanceof Object3D)) return;
    const animatedNode = scene.getObjectByName("gltf-node-0");
    expect(animatedNode?.position.toArray()).toEqual([1, 0.5, 0]);
    backend.resetTriangleAnimation("textured");
    expect(animatedNode?.position.toArray()).toEqual([0, 0, 0]);
    const mesh = scene.getObjectByName("textured-triangle");
    expect(mesh).toBeInstanceOf(Mesh);
    if (!(mesh instanceof Mesh)) return;
    expect(mesh.geometry.getAttribute("uv").array).toEqual(new Float32Array([0, 0, 1, 0, 0.5, 1]));
    expect(mesh.material).toBeInstanceOf(MeshStandardMaterial);
    if (!(mesh.material instanceof MeshStandardMaterial)) return;
    expect(mesh.material.map).toBeInstanceOf(DataTexture);
    const texture = mesh.material.map;
    if (!(texture instanceof DataTexture)) return;
    expect(texture.colorSpace).toBe("srgb");
    expect(texture.image.data).toEqual(new Uint8Array([255, 32, 8, 255]));
    const disposed = vi.fn();
    texture.addEventListener("dispose", disposed);
    expect(() => backend.mountTriangleAsset({
      instanceId: "textured",
      transform,
      meshes: [{ ...meshPayload, baseColorTexture: { width: 1, height: 1, rgba: [255] } }],
    })).toThrow('Contained triangle mesh "textured-triangle" is invalid.');
    expect(disposed).not.toHaveBeenCalled();
    expect(backend.render(["textured"]).pixelsDrawn).toBe(false);
    backend.dispose();
    expect(disposed).toHaveBeenCalledOnce();
  });

  it("replaces a mounted proxy with contained triangle geometry on the same Three core", () => {
    const backend = createThreeSculptPresentationBackend();
    const mounts = createSculptMountApi(backend);
    mounts.mount({ instanceId: "imported", artifact: fixtureArtifact(), transform });
    backend.mountTriangleAsset({
      instanceId: "imported",
      transform,
      meshes: [{
        meshId: "triangle",
        positions: [-1, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        baseColor: "#3399e5",
        metallic: 0,
        roughness: 0.7,
      }],
    });

    expect(mounts.render()).toMatchObject({
      backend: "three",
      drawCalls: 1,
      instanceIds: ["imported"],
      surface: "headless",
      pixelsDrawn: false,
    });
    mounts.dispose();
  });
});

const manifest: ProductManifest = {
  productId: "three-runtime-test",
  seed: 7,
  entities: [
    { id: "hero", x: 0, y: 0 },
    { id: "crate", x: 4, y: 2 },
  ],
};

describe("Three Presentation Runtime (ADR 0002 seam)", () => {
  it("mounts, presents a drawn frame, captures PNG bytes, and disposes", () => {
    const recorder = recordingSurface(2);
    const runtime = createThreePresentationRuntime({ surface: recorder.surface });
    const session = open(manifest, { nowMs: () => 1_753_420_800_000 });
    const snapshot = session.observe();

    expect(runtime.surface()).toBeNull();
    runtime.mount();
    expect(runtime.surface()).toBe("webgl-canvas");
    expect(runtime.label).toBe(THREE_PRESENTATION_CORE_LABEL);

    runtime.present(snapshot, [], 1);

    expect(runtime.lastFrame()).toEqual({
      frame: 1,
      tick: snapshot.tick,
      alpha: 1,
      entityCount: 2,
      drawCalls: 2,
      pixelsDrawn: true,
      surface: "webgl-canvas",
    });
    const scene = sceneOf(recorder.draws[0]);
    expect(scene.getObjectByName("entity:hero")).toBeDefined();
    expect(scene.getObjectByName("entity:crate")?.position.toArray()).toEqual([4, 0.5, 2]);

    const captured = runtime.capture();
    expect(captured?.contentType).toBe("image/png");
    expect([...(captured?.bytes ?? [])].slice(0, 4)).toEqual([0x89, 0x50, 0x4e, 0x47]);

    runtime.dispose();
    expect(recorder.disposed()).toBe(true);
    expect(runtime.surface()).toBeNull();
  });

  it("interpolates between snapshots with alpha and never mutates the snapshot", () => {
    const recorder = recordingSurface();
    const runtime = createThreePresentationRuntime({ surface: recorder.surface });
    const session = open(manifest, { nowMs: () => 1_753_420_800_000 });
    const first = session.observe();
    runtime.mount();
    runtime.present(first, [], 1);

    const moved = {
      ...first,
      tick: first.tick + 1,
      entities: [
        { id: "hero", x: 10, y: 0 },
        { id: "crate", x: 4, y: 2 },
      ],
    };
    const frozen = JSON.stringify(moved);
    runtime.present(moved, [], 0.5);

    const scene = sceneOf(recorder.draws[1]);
    expect(scene.getObjectByName("entity:hero")?.position.toArray()).toEqual([5, 0.5, 0]);
    expect(JSON.stringify(moved)).toBe(frozen);
    expect(session.observe()).toEqual(first);
    runtime.dispose();
  });

  it("keeps the prior tick stable across interpolated frames", () => {
    const recorder = recordingSurface();
    const runtime = createThreePresentationRuntime({ surface: recorder.surface });
    const first = open(manifest, { nowMs: () => 1_753_420_800_000 }).observe();
    const moved = {
      ...first,
      tick: first.tick + 1,
      entities: [
        { id: "hero", x: 10, y: 0 },
        { id: "crate", x: 4, y: 2 },
      ],
    };
    runtime.mount();
    runtime.present(first, [], 1);
    runtime.present(moved, [], 0.25);
    expect(
      sceneOf(recorder.draws[1]).getObjectByName("entity:hero")?.position.x,
    ).toBe(2.5);
    runtime.present(moved, [], 0.5);

    expect(
      sceneOf(recorder.draws[2]).getObjectByName("entity:hero")?.position.x,
    ).toBe(5);
    runtime.dispose();
  });

  it("removes markers for entities the kernel no longer reports", () => {
    const recorder = recordingSurface();
    const runtime = createThreePresentationRuntime({ surface: recorder.surface });
    const session = open(manifest, { nowMs: () => 1_753_420_800_000 });
    const snapshot = session.observe();
    runtime.mount();
    runtime.present(snapshot, [], 1);
    runtime.present({ ...snapshot, entities: [{ id: "hero", x: 1, y: 1 }] }, [], 1);

    const scene = sceneOf(recorder.draws[1]);
    expect(scene.getObjectByName("entity:hero")).toBeDefined();
    expect(scene.getObjectByName("entity:crate")).toBeUndefined();
    runtime.dispose();
  });

  it("returns no capture on a surface that draws no pixels", () => {
    const runtime = createThreePresentationRuntime();
    const session = open(manifest, { nowMs: () => 1_753_420_800_000 });
    runtime.mount();
    runtime.present(session.observe(), [], 0);

    expect(runtime.lastFrame()?.pixelsDrawn).toBe(false);
    expect(runtime.capture()).toBeNull();
    runtime.dispose();
  });

  it("fails closed while detached, on a second mount, and on invalid frames", () => {
    const runtime = createThreePresentationRuntime();
    const snapshot = open(manifest, { nowMs: () => 1_753_420_800_000 }).observe();

    expect(() => runtime.present(snapshot, [], 0)).toThrow(
      new ThreePresentationError("not-mounted", "Three presentation runtime is not mounted."),
    );
    expect(() => runtime.capture()).toThrow(ThreePresentationError);
    expect(() => runtime.dispose()).toThrow(ThreePresentationError);
    expect(() => runtime.camera()).toThrow(ThreePresentationError);

    runtime.mount();
    expect(() => runtime.mount()).toThrow(
      new ThreePresentationError("already-mounted", "Three presentation runtime is already mounted."),
    );
    expect(() => runtime.present(snapshot, [], 1.5)).toThrow(ThreePresentationError);
    expect(() => runtime.present({ tick: 0 } as never, [], 0)).toThrow(ThreePresentationError);
    expect(runtime.camera().state().distance).toBeGreaterThan(0);
    runtime.dispose();
    expect(() => runtime.present(snapshot, [], 0)).toThrow(ThreePresentationError);
  });

  it("resizes the surface and the camera aspect together", () => {
    const recorder = recordingSurface();
    const runtime = createThreePresentationRuntime({ surface: recorder.surface });
    runtime.mount();
    runtime.resize(1024, 512, 1.5);

    expect(recorder.resizes.at(-1)).toEqual([1024, 512, 1.5]);
    expect(runtime.camera().state().aspect).toBe(2);
    runtime.dispose();
  });
});

describe("Three render loop", () => {
  function fakeScheduler() {
    const pending = new Map<number, (timeMs: number) => void>();
    let next = 1;
    const scheduler: FrameScheduler = {
      request(callback) {
        const handle = next;
        next += 1;
        pending.set(handle, callback);
        return handle;
      },
      cancel(handle) {
        pending.delete(handle);
      },
    };
    return {
      scheduler,
      pendingCount: () => pending.size,
      tick(timeMs: number) {
        const entry = [...pending.entries()][0];
        if (entry === undefined) return false;
        pending.delete(entry[0]);
        entry[1](timeMs);
        return true;
      },
    };
  }

  it("drives frames until stopped and reports elapsed time", () => {
    const host = fakeScheduler();
    const deltas: number[] = [];
    const loop = createThreeRenderLoop({
      scheduler: host.scheduler,
      onFrame: (deltaMs) => deltas.push(deltaMs),
    });

    expect(loop.running()).toBe(false);
    loop.start();
    expect(loop.running()).toBe(true);
    host.tick(0);
    host.tick(16);
    host.tick(32);

    expect(deltas).toEqual([0, 16, 16]);
    expect(loop.frames()).toBe(3);

    loop.stop();
    expect(loop.running()).toBe(false);
    expect(host.pendingCount()).toBe(0);
    expect(host.tick(48)).toBe(false);
    expect(loop.frames()).toBe(3);
  });

  it("stops cleanly when stopped from inside a frame", () => {
    const host = fakeScheduler();
    const loop = createThreeRenderLoop({
      scheduler: host.scheduler,
      onFrame: () => loop.stop(),
    });
    loop.start();
    host.tick(0);

    expect(loop.running()).toBe(false);
    expect(host.pendingCount()).toBe(0);
  });

  it("stops and can restart after a frame callback throws", () => {
    const host = fakeScheduler();
    let shouldThrow = true;
    const loop = createThreeRenderLoop({
      scheduler: host.scheduler,
      onFrame: () => {
        if (shouldThrow) throw new Error("frame failed");
      },
    });
    loop.start();

    expect(() => host.tick(0)).toThrow("frame failed");
    expect(loop.running()).toBe(false);
    expect(host.pendingCount()).toBe(0);

    shouldThrow = false;
    loop.start();
    expect(host.tick(16)).toBe(true);
    expect(loop.running()).toBe(true);
    loop.stop();
  });

  it("keeps one scheduled frame when restarted inside a callback", () => {
    const host = fakeScheduler();
    let restart = true;
    const loop = createThreeRenderLoop({
      scheduler: host.scheduler,
      onFrame: () => {
        if (!restart) return;
        restart = false;
        loop.stop();
        loop.start();
      },
    });
    loop.start();

    host.tick(0);
    expect(loop.running()).toBe(true);
    expect(host.pendingCount()).toBe(1);

    host.tick(16);
    expect(loop.frames()).toBe(2);
    expect(host.pendingCount()).toBe(1);
    loop.stop();
  });

  it("stops when scheduling the next frame fails", () => {
    let callback: ((timeMs: number) => void) | null = null;
    let requests = 0;
    const scheduler: FrameScheduler = {
      request(next) {
        requests += 1;
        if (requests > 1) throw new Error("schedule failed");
        callback = next;
        return requests;
      },
      cancel() {
        callback = null;
      },
    };
    const loop = createThreeRenderLoop({
      scheduler,
      onFrame: () => {},
    });
    loop.start();

    expect(() => callback?.(0)).toThrow("schedule failed");
    expect(loop.running()).toBe(false);
  });

  it("refuses when the host has no frame scheduler", () => {
    expect(hostAnimationFrameScheduler()).toBeNull();
    expect(() => createThreeRenderLoop({ onFrame: () => {} })).toThrow(
      new ThreePresentationError(
        "no-frame-scheduler",
        "No frame scheduler: pass options.scheduler on hosts without requestAnimationFrame.",
      ),
    );
  });
});
