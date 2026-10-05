import { sceneCompositionArtifactFixture } from "@sceneaxi/schemas/testing/scene-composition";
import { describe, expect, it, vi } from "vitest";
import { BufferGeometry } from "three";
import { createThreePresentationCore, createThreePresentationRuntime, createThreeSculptPresentationBackend, type ThreeTriangleAssetInput } from "@sceneaxi/engine-presentation";

const transform = { translation: [0,0,0], rotationEulerDegrees: [0,0,0], scale: [1,1,1] } as const;

const triangle: ThreeTriangleAssetInput = { instanceId: "triangle", transform, meshes: [{ meshId: "mesh", positions: [0,0,0, 1,0,0, 0,1,0], indices: [0,1,2], matrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1], baseColor: "#ffffff", metallic: 0, roughness: 1 }] };

describe("public presentation hardening", () => {
  it("public core hides the backend group and rejects lighting/fog/viewport mutations transactionally", () => {
    const c = createThreePresentationCore();
    expect(c).not.toHaveProperty("content");
    const before = c.draw();

    for (const environment of [{ background: "#fff", ambientIntensity: NaN }, { keyDirection: [Infinity,0,0] as const }, { fog: { enabled: true, color: "#fff", near: 10, far: -1 } }]) expect(() => c.setEnvironment(environment)).toThrow();
    expect(c.draw().environmentBackground).toBe(before.environmentBackground);
    const camera = c.camera.state();
    expect(() => c.resize(8193, 1)).toThrow();
    expect(() => c.resize(4096, 4096, 1.001)).toThrow();
    expect(() => c.resize(1, 1, 4.001)).toThrow();
    expect(c.camera.state()).toEqual(camera);
    c.resize(4096,4096,1);
    c.dispose();
  });
  it("rejects duplicate/nonfinite snapshots without changing the last good frame or allocation state", () => {
    const r = createThreePresentationRuntime(); r.mount();
    const good = { tick: 0, seed: 1, entities: [{ id: "player", x: 0, y: 0 }], digest: "unused" };
    r.present(good, [], 1);
    const frame = r.lastFrame();

    for (const entities of [[{ id: "same", x: NaN, y: Infinity }], [{ id: "same", x: 0, y: 0 }, { id: "same", x: 1, y: 1 }]]) expect(() => r.present({ ...good, entities }, [], 1)).toThrow();
    expect(r.lastFrame()).toEqual(frame);
    r.present(good, [], 1);
    expect(r.lastFrame()?.entityCount).toBe(1);
    r.dispose();
  });
  it("prevalidates five bad replacements without allocations/disposals and retains the last valid root", () => {
    const b = createThreeSculptPresentationBackend(); b.mountTriangleAsset(triangle);
    const dispose = vi.spyOn(BufferGeometry.prototype, "dispose");

    try {
      for (let i = 0; i < 5; i++) expect(() => b.mountTriangleAsset({ ...triangle, meshes: [...triangle.meshes, { ...requireValue(triangle.meshes[0]), meshId: "bad", positions: [NaN,0,0] }] })).toThrow();
      expect(dispose).not.toHaveBeenCalled();
      expect(b.render(["triangle"]).drawCalls).toBe(1);
      expect(() => b.mountTriangleAsset({ ...triangle, nodes: [{ node: 0, parent: 0, matrixAuthored: false, matrix: requireValue(triangle.meshes[0]).matrix, translation: [0,0,0], rotation: [0,0,0,1], scale: [1,1,1] }], meshes: [{ ...requireValue(triangle.meshes[0]), nodeIndex: 0 }] })).toThrow(/Cyclic/);
      b.dispose();
      expect(dispose).toHaveBeenCalledTimes(2); // one mesh and grid
      expect(() => b.mountTriangleAsset(triangle)).toThrow(/disposed/);
      expect(() => b.unmount("triangle")).toThrow(/disposed/);
      b.dispose();
      expect(dispose).toHaveBeenCalledTimes(2);
    } finally { dispose.mockRestore(); }
  });
});


describe("retry transaction oracles", () => {
  it("refuses physical dimension overflow and empty framebuffers before resizing", () => {
    const c = createThreePresentationCore();
    expect(() => c.resize(8192, 1, 4)).toThrow(/viewport|Framebuffer/);
    expect(() => c.resize(1, 1, 0.1)).toThrow(/viewport|Framebuffer/);
    c.resize(8192, 1, 1); c.dispose();
  });
  it("refused animation preserves the previous visible pose and rejects unsupported interpolation", () => {
    let x = 0;

    const surface = { kind: "headless" as const, resize() {}, capture() { return null; }, dispose() {},
      draw(scene: unknown) { x = (scene as { getObjectByName(name: string): { position: { x: number } } }).getObjectByName("gltf-node-0").position.x;

 return { drawCalls: 1, pixelsDrawn: false }; } };

    const b = createThreeSculptPresentationBackend({ surface });
    b.mountTriangleAsset({ ...triangle, nodes: [{ node: 0, parent: null, matrixAuthored: false, matrix: requireValue(triangle.meshes[0]).matrix, translation: [0,0,0], rotation: [0,0,0,1], scale: [1,1,1] }], meshes: [{ ...requireValue(triangle.meshes[0]), nodeIndex: 0 }] });
    const clip = { name: "move", duration: 1, channels: [{ node: 0, path: "translation" as const, interpolation: "LINEAR" as const, times: [0,1], values: [0,0,0, 4,0,0] }] };
    b.playTriangleAnimation("triangle", clip, 1); b.render(["triangle"]); expect(x).toBe(4);
    expect(() => b.playTriangleAnimation("triangle", clip, NaN)).toThrow();
    b.render(["triangle"]); expect(x).toBe(4);
    expect(() => b.playTriangleAnimation("triangle", { ...clip, channels: [{ ...requireValue(clip.channels[0]), interpolation: "CUBICSPLINE" as never }] }, 0)).toThrow();
    expect(() => b.playTriangleAnimation("triangle", { ...clip, channels: [...clip.channels, { ...requireValue(clip.channels[0]), node: 99 }] }, 0)).toThrow();
    b.render(["triangle"]); expect(x).toBe(4); b.dispose();
  });
  it("refuses sparse mesh coordinates without replacing the good root", () => {
    const b = createThreeSculptPresentationBackend(); b.mountTriangleAsset(triangle);
    expect(() => b.mountTriangleAsset({ ...triangle, meshes: [{ ...requireValue(triangle.meshes[0]), positions: new Array<number>(9) }] })).toThrow();
    expect(b.render(["triangle"]).drawCalls).toBe(1); b.dispose();
  });
});

function requireValue<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error("Required fixture value is absent.");

  return value;
}


it("validates neutral snapshot seed and digest metadata before changing a frame", () => {
  const r = createThreePresentationRuntime(); r.mount();
  const good = { tick: 0, seed: 1, entities: [], digest: "unused" }; r.present(good, [], 1);
  const before = r.lastFrame();

  for (const bad of [{ ...good, seed: 1e308 }, { ...good, digest: "x".repeat(129) }, { ...good, digest: null as never }]) {
    expect(() => r.present(bad, [], 1)).toThrow(); expect(r.lastFrame()).toEqual(before);
  }

  r.dispose();
});

it("guards direct proxy mount/update and releases partial triangle allocations on host failures", () => {
  const artifact = sceneCompositionArtifactFixture("direct-proxy");
  const instance = { instanceId: "direct", artifactId: artifact.artifactId, artifact, transform };
  const b = createThreeSculptPresentationBackend(); b.mount(instance);
  expect(() => b.update({ ...instance, transform: { ...transform, translation: [NaN,0,0] } })).toThrow();
  expect(() => b.mount({ ...instance, artifact: { ...artifact, spec: { ...artifact.spec, materials: [] } } })).toThrow();
  expect(b.render(["direct"]).drawCalls).toBeGreaterThan(0);
  b.mountTriangleAsset(triangle);
  const allocation = vi.spyOn(BufferGeometry.prototype, "setAttribute").mockImplementationOnce(() => { throw new Error("injected allocation failure"); });
  const cleanup = vi.spyOn(BufferGeometry.prototype, "dispose");

  try {
    expect(() => b.mountTriangleAsset(triangle)).toThrow(/allocation/);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(b.render(["direct", "triangle"]).drawCalls).toBeGreaterThan(1);
  } finally { allocation.mockRestore(); cleanup.mockRestore(); b.dispose(); }
});

it("cleans every partially allocated mesh when a later mesh construction fails", () => {
  const b=createThreeSculptPresentationBackend();b.mountTriangleAsset(triangle);
  const original=BufferGeometry.prototype.computeBoundingSphere;

  const build=vi.spyOn(BufferGeometry.prototype,"computeBoundingSphere")
    .mockImplementationOnce(function(this:BufferGeometry){original.call(this);})
    .mockImplementationOnce(()=>{throw Error("later mesh allocation failure");});

  const cleanup=vi.spyOn(BufferGeometry.prototype,"dispose");

  try {
    expect(()=>b.mountTriangleAsset({...triangle,meshes:[requireValue(triangle.meshes[0]),{...requireValue(triangle.meshes[0]),meshId:"later"}]})).toThrow(/later mesh/);
    expect(cleanup).toHaveBeenCalledTimes(2);expect(b.render(["triangle"]).drawCalls).toBe(1);
  } finally {build.mockRestore();cleanup.mockRestore();b.dispose();}
});
