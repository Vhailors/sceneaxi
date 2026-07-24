import type { JsonObject } from "../../../packages/authoring-core/src/index.ts";
import type { ProductManifest } from "../../../packages/engine-kernel/src/index.ts";

export const GOLDEN_PROJECT_DOCUMENT_INPUT = Object.freeze({
  id: "golden-project",
  title: "Issue 51 CLI golden path",
  data: Object.freeze({
    productManifest: Object.freeze({
      productId: "golden-game",
      seed: 51,
      entities: Object.freeze([
        Object.freeze({ id: "hero", x: 0, y: 1 }),
      ]),
    }),
  }) satisfies JsonObject,
});

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function productManifestFrom(value: unknown): ProductManifest {
  if (!isJsonObject(value)) {
    throw new Error("applied project is missing data.productManifest");
  }

  const productId = value["productId"];
  const seed = value["seed"];
  const rawEntities = value["entities"];
  if (
    typeof productId !== "string" ||
    typeof seed !== "number" ||
    !Number.isInteger(seed) ||
    !Array.isArray(rawEntities)
  ) {
    throw new Error("applied project has an invalid product manifest");
  }

  const entities: NonNullable<ProductManifest["entities"]>[number][] =
    rawEntities.map((raw, index) => {
      if (!isJsonObject(raw)) {
        throw new Error(
          `product manifest entity ${String(index)} is not an object`,
        );
      }
      const id = raw["id"];
      const x = raw["x"];
      const y = raw["y"];
      if (
        typeof id !== "string" ||
        typeof x !== "number" ||
        !Number.isInteger(x) ||
        typeof y !== "number" ||
        !Number.isInteger(y)
      ) {
        throw new Error(`product manifest entity ${String(index)} is invalid`);
      }
      return { id, x, y };
    });

  return { productId, seed, entities };
}
