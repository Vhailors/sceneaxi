import { describe, expect, it, vi } from "vitest";
import { decodeContainedImage } from "@sceneaxi/engine-presentation";

function png(width: number, height: number) {
  const bytes = new Uint8Array(33), view = new DataView(bytes.buffer);
  bytes.set([137,80,78,71,13,10,26,10]); bytes.set([73,72,68,82],12); view.setUint32(16,width); view.setUint32(20,height);

 return bytes;
}

describe("contained image preallocation admission", () => {
  it("refuses unknown/URL/oversized/zero/sparse encoded input before browser decoder calls", async () => {
    const decode = vi.fn(); vi.stubGlobal("createImageBitmap",decode);

    try {
      for (const bytes of [png(4097,1),png(0,1),png(4096,4096),new Uint8Array(8*1024*1024+1),new Uint8Array([0,1,2])]) await expect(decodeContainedImage({ assetId: "image", bytes })).rejects.toThrow();
      await expect(decodeContainedImage({ assetId: "https://invalid/image.png", bytes: png(1,1) })).rejects.toThrow();
      expect(decode).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it("snapshots bytes/id over awaits, verifies decoded dimensions and closes every bitmap", async () => {
    const close = vi.fn(), original = png(2,1), input = { assetId: "image", bytes: original };
    let release: ((bitmap: { width: number; height: number; close: () => void }) => void) | undefined;

    const decode = vi.fn((blob: Blob) => { void blob;

 return new Promise(resolve => { release = resolve; }); });

    const canvas = class { getContext() { return { drawImage() {}, getImageData() { return { data: new Uint8ClampedArray([255,0,0,255,0,0,255,255]) }; } }; } };
    vi.stubGlobal("createImageBitmap",decode); vi.stubGlobal("OffscreenCanvas",canvas);

    try {
      const pending = decodeContainedImage(input); input.assetId = "changed"; original.fill(0);

      if (!release) throw Error("Decoder did not start"); release({ width: 2, height: 1, close });
      const decoded = await pending; expect(decoded.assetId).toBe("image"); expect(decoded.rgba).toHaveLength(8); expect(Object.isFrozen(decoded.rgba)).toBe(true); expect(close).toHaveBeenCalledTimes(1);
      const blob = decode.mock.calls[0]?.[0];

 if (!blob) throw Error("Decoder input absent"); expect(new Uint8Array(await blob.arrayBuffer())).toEqual(png(2,1));
      const bad = decodeContainedImage({ assetId: "bad", bytes: png(2,1) });

 if (!release) throw Error("Decoder did not start"); release({ width: 3, height: 1, close });
      await expect(bad).rejects.toThrow(/dimensions mismatch/); expect(close).toHaveBeenCalledTimes(2);
    } finally { vi.unstubAllGlobals(); }
  });
});
