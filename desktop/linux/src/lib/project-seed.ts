import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createDocument,
  parseDocumentText,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";
import { COMPOSED_SCENE_DOCUMENT_DATA_KEY } from "@sceneaxi/schemas";
import { DESKTOP_ACTIVE_DOCUMENT_PATH } from "./bridge-contract.js";
import {
  DESKTOP_RARITY_PRODUCT_ID,
  DESKTOP_RARITY_PROJECT_SEED,
  desktopOpenScene,
} from "./desktop-scene.js";

export type DesktopProjectSeedResult =
  | { readonly ok: true; readonly migrated: boolean }
  | { readonly ok: false; readonly message: string };

export function seedDesktopProject(dir: string): DesktopProjectSeedResult {
  mkdirSync(dir, { recursive: true });
  const documentPath = join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH);
  const starter = desktopOpenScene();
  if (!starter.ok) return { ok: false, message: starter.message };

  let id = "scene";
  let title: string | undefined;
  let existingData = {};
  let migrated = false;
  if (existsSync(documentPath)) {
    const parsed = parseDocumentText(readFileSync(documentPath, "utf8"));
    if (!parsed.ok) return { ok: false, message: parsed.message };
    if (
      Object.hasOwn(parsed.document.data, COMPOSED_SCENE_DOCUMENT_DATA_KEY) &&
      parsed.document.data.productId === DESKTOP_RARITY_PRODUCT_ID &&
      parsed.document.data.seed === DESKTOP_RARITY_PROJECT_SEED
    ) {
      return { ok: true, migrated: false };
    }
    if (
      (parsed.document.data.productId !== undefined &&
        parsed.document.data.productId !== DESKTOP_RARITY_PRODUCT_ID) ||
      (parsed.document.data.seed !== undefined &&
        parsed.document.data.seed !== DESKTOP_RARITY_PROJECT_SEED)
    ) {
      return {
        ok: false,
        message: "The existing Scene Document owns a different productId or project seed; migration refused.",
      };
    }
    id = parsed.document.id;
    title = parsed.document.title;
    existingData = parsed.document.data;
    migrated = true;
  }

  const doc = createDocument({
    id,
    ...(title === undefined ? {} : { title }),
    data: {
      ...starter.composed.document.data,
      ...existingData,
      productId: DESKTOP_RARITY_PRODUCT_ID,
      seed: DESKTOP_RARITY_PROJECT_SEED,
      ...(!migrated
        ? {
            entities: [{ id: "hero", x: 1, y: 2, rz: 0 }],
            material: { roughness: 0.4 },
          }
        : {}),
    },
  });
  const written = writeDocumentFile(documentPath, doc, { cwd: dir });
  return written.ok
    ? { ok: true, migrated }
    : {
        ok: false,
        message: written.diagnostics[0]?.message ?? "The desktop project document was not written.",
      };
}
