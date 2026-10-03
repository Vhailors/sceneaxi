import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), "utf8");

describe("D2 shared site component layer", () => {
    it.each(["catalog-game", "catalog-web"])("keeps %s server identity composition thin and shared", (site) => {
        expect(existsSync(join(REPO_ROOT, `sites/${site}/src/lib/identity-plane.ts`))).toBe(true);
        const adapter = read(`sites/${site}/src/lib/identity-plane.ts`);
        expect(adapter).toContain('from "@sceneaxi/site-kit/catalog-server-fetch"');
        expect(adapter).toContain("return createCatalogServerIdentityPlane(options)");
        expect(adapter).not.toMatch(/process\.env|fetch\(|@sceneaxi\/(auth|billing)/);
        expect(adapter).toBe(read(`sites/${site === "catalog-game" ? "catalog-web" : "catalog-game"}/src/lib/identity-plane.ts`));
        expect(read(`sites/${site}/src/index.ts`)).toContain('from "@sceneaxi/site-kit/catalog-identity"');
        expect(read(`sites/${site}/src/app/item/[itemId]/page.tsx`)).toContain('from "../../../lib/identity-plane.js"');
    });
    it.each(["umbrella", "catalog-game", "catalog-web"])("keeps sites/%s session work to Next request plumbing", (site) => {
        const source = read(`sites/${site}/src/app/_session.ts`);
        expect(source).toContain('from "@sceneaxi/site-kit/site-session"');
        expect(source).toContain("resolveSiteSessionToken");
        expect(source).not.toContain('"sceneaxi.session"');
        expect(source).not.toContain('"x-sceneaxi-session"');
    });
    it.each(["umbrella", "catalog-game", "catalog-web"])("keeps sites/%s state panel as a thin React adapter", (site) => {
        const source = read(`sites/${site}/src/app/_components/state-panel.tsx`);
        expect(source).toContain('from "@sceneaxi/site-kit/state-panel"');
        expect(source).toContain("createStatePanelModel");
        expect(source).not.toContain("FOUNDATION_STATUSES");
    });
    it.each(["catalog-game", "catalog-web"])("keeps sites/%s commerce notice copy and refusal logic in site-kit", (site) => {
        const source = read(`sites/${site}/src/app/_components/commerce-notice.tsx`);
        expect(source).toContain('from "@sceneaxi/site-kit/commerce-notice"');
        expect(source).toContain("createCommerceNoticeModel");
        expect(source).not.toContain("COMMERCE_ACTIVATION_GATE");
        expect(source).not.toContain("attemptCatalogPurchase");
    });
    it("exports narrow entries instead of sending client adapters through the root barrel", () => {
        // SAFETY: the parsed file is a checked-in repository fixture read from a fixed path, not external input.
        const manifest = JSON.parse(read("packages/site-kit/package.json")) as {
            readonly exports: Readonly<Record<string, string>>;
        };

        expect(manifest.exports).toMatchObject({
            "./catalog-identity": "./src/catalog-identity.ts",
            "./commerce-notice": "./src/commerce-notice.ts",
            "./site-session": "./src/site-session.ts",
            "./state-panel": "./src/state-panel.ts",
        });
    });
});
