import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createDocument,
  parseDocumentText,
  serializeDocument,
  writeNativeProjectSeed,
} from "@sceneaxi/authoring-core";
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
  if (existsSync(documentPath)) {
    const parsed = parseDocumentText(readFileSync(documentPath, "utf8"));
    if (!parsed.ok) return { ok: false, message: parsed.message };
    // Existing valid projects are opened byte-identically. The native manifest
    // is added only by the explicit reviewed project migration command.
    return { ok: true, migrated: false };
  }

  const starter = desktopOpenScene();
  if (!starter.ok) return { ok: false, message: starter.message };

  const doc = createDocument({
    id: "scene",
    data: {
      ...starter.composed.document.data,
      productId: DESKTOP_RARITY_PRODUCT_ID,
      seed: DESKTOP_RARITY_PROJECT_SEED,
      entities: [{ id: "hero", x: 1, y: 2, rz: 0 }],
      material: { roughness: 0.4 },
    },
  });
  const written = writeNativeProjectSeed({
    root: dir,
    document: doc,
    documentBytes: serializeDocument(doc),
  });
  return written.ok
    ? { ok: true, migrated: false }
    : {
        ok: false,
        message: written.diagnostic.message,
      };
}
