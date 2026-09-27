export type BaseColorTexture = Readonly<{
  width: number;
  height: number;
  rgba: readonly number[];
}>;

export type AssetRenderMesh = Readonly<{
  meshId: string;
  nodeIndex?: number;
  positions: readonly number[];
  normals?: readonly number[];
  uvs?: readonly number[];
  indices: readonly number[];
  matrix: readonly number[];
  baseColor: string;
  metallic: number;
  roughness: number;
  baseColorTexture?: BaseColorTexture;
}>;
