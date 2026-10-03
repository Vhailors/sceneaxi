/** SDK pin: browser-only contained PNG/JPEG/WebP decoding, never URL loading. */
export type ContainedImageInput = Readonly<{ assetId: string; bytes: Uint8Array }>;

export type DecodedContainedImage = Readonly<{ assetId: string; width: number; height: number; rgba: readonly number[] }>;

type Bitmap = { width: number; height: number; close(): void };

type Canvas2D = { drawImage(bitmap: Bitmap, x: number, y: number): void; getImageData(x: number, y: number, width: number, height: number): { data: Uint8ClampedArray } };

type BrowserBlob = { readonly size: number; readonly type: string };

type ImageDimensions = { mime: string; width: number; height: number };

type BrowserDecoder = { Blob: new (parts: ArrayBuffer[], options: { type: string }) => BrowserBlob; createImageBitmap(blob: BrowserBlob): Promise<Bitmap>; OffscreenCanvas: new (width: number, height: number) => { getContext(kind: "2d"): Canvas2D | null } };

function dimensions(bytes: Uint8Array): ImageDimensions {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length));

  if (bytes.length >= 33 && bytes[0] === 137 && tag(1,7) === "PNG\r\n\x1a\n" && tag(12,4) === "IHDR") return { mime: "image/png", width: view.getUint32(16), height: view.getUint32(20) };

  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;

    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) throw Error("Invalid contained JPEG marker");

      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];

      if (marker === 217 || marker === 218) break;

      if (marker === 1 || (marker !== undefined && marker >= 208 && marker <= 215)) continue;

      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);

      if (length < 2 || offset + length > bytes.length) break;

      if (marker !== undefined && [192,193,194].includes(marker) && length >= 8) return { mime: "image/jpeg", height: view.getUint16(offset+3), width: view.getUint16(offset+5) };
      offset += length;
    }
  }

  if (bytes.length >= 30 && tag(0,4) === "RIFF" && tag(8,4) === "WEBP" && view.getUint32(4,true) + 8 === bytes.length) {
    const chunk = tag(12,4);

    if (chunk === "VP8X") return { mime: "image/webp", width: 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0)<<8) + ((bytes[26] ?? 0)<<16), height: 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0)<<8) + ((bytes[29] ?? 0)<<16) };

    if (chunk === "VP8 " && tag(23,3) === "\x9d\x01\x2a") return { mime: "image/webp", width: view.getUint16(26,true) & 16383, height: view.getUint16(28,true) & 16383 };

    if (chunk === "VP8L" && bytes[20] === 47) { const bits = view.getUint32(21,true);

 return { mime: "image/webp", width: (bits & 16383) + 1, height: ((bits >>> 14) & 16383) + 1 }; }
  }

  throw Error("Unsupported or malformed contained PNG/JPEG/WebP image");
}

/** Validates dimensions before browser decode/allocation; snapshots input across awaits. */
export async function decodeContainedImage(input: ContainedImageInput): Promise<DecodedContainedImage> {
  if (!input || !isAssetId(input.assetId) || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(input.assetId) || !(input.bytes instanceof Uint8Array) || input.bytes.length === 0 || input.bytes.length > 8*1024*1024) throw Error("Invalid bounded contained image");
  const bytes = new Uint8Array(input.bytes), assetId = input.assetId;
  const { mime, width, height } = dimensions(bytes);

  if (width < 1 || height < 1 || width > 4096 || height > 4096 || width*height*4 > 4*1024*1024) throw Error("Contained image pixel capacity exceeded");
  // SAFETY: browser globals implement the platform Blob, createImageBitmap and OffscreenCanvas contracts; unavailable members are refused below.
  const host = globalThis as Partial<BrowserDecoder>;

  if (!host.Blob || !host.createImageBitmap || !host.OffscreenCanvas) throw Error("Contained image browser decoder unavailable");
  const bitmap = await host.createImageBitmap(new host.Blob([bytes.buffer], { type: mime }));

  try {
    if (bitmap.width !== width || bitmap.height !== height) throw Error("Contained image header/dimensions mismatch");
    const context = new host.OffscreenCanvas(width,height).getContext("2d");

    if (!context) throw Error("Contained image 2D decoder unavailable");
    context.drawImage(bitmap,0,0);
    const rgba = Array.from(context.getImageData(0,0,width,height).data);

    if (rgba.length !== width*height*4) throw Error("Contained image decode length mismatch");

    return Object.freeze({ assetId, width, height, rgba: Object.freeze(rgba) });
  } finally { bitmap.close(); }
}

function isAssetId(value: string): value is string {
  return typeof value === "string";
}
