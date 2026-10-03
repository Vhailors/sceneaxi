interface ProofDigests {
    readonly [path: string]: string;
}

type ComponentRender = Element | string | number | boolean | null | undefined | readonly ComponentRender[] | Promise<ComponentRender>;

interface ComponentProps {
    readonly children?: ComponentRender;
    readonly className?: string;
    readonly href?: string;
    readonly name?: string;
    readonly value?: string;
    readonly type?: string;
    readonly action?: string;
    readonly method?: string;
    readonly required?: boolean;
    readonly "aria-current"?: string;
    readonly "aria-disabled"?: string;
    readonly src?: string;
    readonly digest?: string;
    readonly large?: boolean;
    readonly chips?: readonly {
        key: string;
        label: string;
        tone: string;
    }[];
    readonly stats?: readonly {
        key: string;
        value: string;
    }[];
    readonly variant?: string;
    readonly listing?: ReturnType<typeof siteKit.listSiteCatalog>[number];
    readonly price?: {
        ok: false;
        reason: string;
    };
    readonly catalogueLabel?: string;
    readonly publishLabel?: string;
    readonly engine?: null;
    readonly media?: (typeof content.PROOF_MEDIA)[number];
    readonly sizes?: string;
    readonly searchParams?: Promise<Record<string, string | readonly string[]>>;
}

type ComponentFunction = (props: ComponentProps) => ComponentRender | Promise<ComponentRender>;

type ComponentModule = Record<string, ComponentFunction>;

interface InjectedComponentDependency {
    readonly readSessionToken?: () => Promise<string>;
    readonly umbrellaRequestAuthority?: () => object;
    readonly BILLING_PLANE_PENDING_NOTE?: string;
}

interface ComponentDependencies {
    readonly [specifier: string]: InjectedComponentDependency;
}

type ComponentDependency = typeof siteKit | ComponentModule | InjectedComponentDependency | {
    Fragment: symbol;
} | {
    jsx: typeof jsx;
    jsxs: typeof jsx;
    Fragment: symbol;
} | {
    usePathname: () => string;
};

function isElement(value: ComponentRender): value is Element {
    return isBoundaryObjectValue(value) && value !== null && "type" in value && "props" in value;
}

function isComponentFunction(value: Element["type"]): value is (props: ComponentProps) => Element {
    return isBoundaryCallableValue(value);
}

function isTextValue(value: ComponentRender): value is string | number {
    return isBoundaryTextValue(value) || isBoundaryNumericValue(value);
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
    return isBoundaryObjectValue(error) && error !== null && "code" in error && error.code === "ENOENT";
}

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as siteKit from "@sceneaxi/site-kit";
import * as content from "../../sites/umbrella/src/lib/site-content.ts";

function required<T>(value: T | null | undefined): T {
    if (value === undefined || value === null)
        throw new Error("Required test fixture value is absent");

    return value;
}

interface Element {
    readonly type: string | symbol | ((props: ComponentProps) => Element);
    readonly props: ComponentProps;
}

// Inject only transport (JSX element creation and pathname); execute the real component
// and pure public site-kit models. This is not React DOM or browser/pixel evidence.
const jsx = (type: Element["type"], props: Element["props"]): Element => ({ type, props });

const fragment = Symbol("fragment");

function loadComponent(path: string, pathname = "/", injected: ComponentDependencies = {}): ComponentModule {
    const cache = new Map<string, {
        exports: ComponentModule;
    }>();

    function load(file: string): ComponentModule {
        const cached = cache.get(file);

        if (cached)
            return cached.exports;
        // SAFETY: the initially empty export table is populated only by the repository module transpiled and executed by this loader.
        const module = { exports: {} as ComponentModule };
        cache.set(file, module);
        const source = readFileSync(file, "utf8");
        const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

        const require = (specifier: string): ComponentDependency => {
            if (Object.hasOwn(injected, specifier))
                return required(injected[specifier]);

            if (specifier === "react")
                return { Fragment: fragment };

            if (specifier === "react/jsx-runtime")
                return { jsx, jsxs: jsx, Fragment: fragment };

            if (specifier === "next/navigation")
                return { usePathname: () => pathname };

            if (specifier === "@sceneaxi/site-kit" || specifier.startsWith("@sceneaxi/site-kit/"))
                return siteKit;

            if (!specifier.startsWith("."))
                throw new Error("Unreviewed component dependency: " + specifier);
            const stem = resolve(dirname(file), specifier.replace(/\.js$/, ""));

            try {
                return load(stem + ".ts");
            }
            catch (error) {
                if (!isMissingFile(error))
                    throw error;

                return load(stem + ".tsx");
            }
        };

        runInNewContext(code, { module, exports: module.exports, require, process, Error, crypto: globalThis.crypto }, { filename: file });

        return module.exports;
    }

    return load(resolve(path));
}

function nodes(value: ComponentRender): Element[] {
    if (Array.isArray(value))
        return value.flatMap(nodes);

    if (!isElement(value))
        return [];
    const element = value;

    if (isComponentFunction(element.type))
        return nodes(element.type(element.props));

    return [element, ...nodes(element.props.children)];
}

function text(value: ComponentRender): string {
    if (Array.isArray(value))
        return value.map(text).join("");

    if (isTextValue(value))
        return String(value);

    if (!isElement(value))
        return "";
    const element = value;

    return isComponentFunction(element.type) ? text(element.type(element.props)) : text(element.props.children);
}

function call(module: ReturnType<typeof loadComponent>, name: string, props: ComponentProps): ReturnType<ComponentFunction> {
    const fn = module[name];
    expect(fn, name + " public export").toBeTypeOf("function");

    return required(fn)(props);
}

describe("maintenance P2-P6 public compatibility and refusal oracles", () => {
    it("P2 emits the versioned motion values on every existing surface without changing contrast", () => {
        expect(siteKit.FOUNDATION_MOTION.map(({ token, value }) => [token, value])).toEqual([["--motion-fast", "120ms"], ["--motion-base", "200ms"], ["--ease-standard", "cubic-bezier(0.2, 0, 0, 1)"]]);

        for (const surface of ["umbrella", "game-assets", "web-assets"] as const) {
            const css = siteKit.foundationsVariablesCss({ surface });
            expect(css.ok).toBe(true);

            if (!css.ok)
                throw Error(css.reason);
            expect(css.value).toContain("--motion-fast: 120ms;");
            expect(css.value).toContain("--motion-base: 200ms;");
            expect(css.value).toContain("--ease-standard: cubic-bezier(0.2, 0, 0, 1);");
        }

        // SAFETY: this deliberately invalid fixture is passed only to the runtime refusal boundary exercised by this negative test.
        expect(siteKit.foundationsVariablesCss({ surface: "kids" as never }).ok).toBe(false);
    });

    for (const store of ["catalog-game", "catalog-web"] as const) {
        const components = "sites/" + store + "/src/app/_components/";
        it(store + " P4 preserves large/ok legacy props and explicit variant precedence", () => {
            const m = loadComponent(components + "digest-figure.tsx");
            const listing = required(siteKit.listSiteCatalog(store)[0]);
            const old = call(m, "DigestFigure", { digest: listing.recordDigest, large: true, chips: [{ key: "verified", label: "checked", tone: "ok" }], stats: [{ key: "legacy", value: "retained" }] });
            expect(required(nodes(old)[0]).props.className).toBe("plate plate-detail");
            expect(text(old)).toContain("legacy retained");
            expect(nodes(old).some(n => n.props.className === "chip chip-ok")).toBe(true);
            const explicit = call(m, "DigestFigure", { digest: listing.recordDigest, large: true, variant: "lead" });
            expect(required(nodes(explicit)[0]).props.className).toBe("plate plate-lead");
            expect(text(explicit)).toContain("Record mark");
            const invalid = call(m, "DigestFigure", { digest: "bad", variant: "detail" });
            expect(text(invalid)).toContain("digest unreadable — no mark drawn");
            expect(nodes(invalid).some(n => n.props.className === "plate-mark")).toBe(false);
        });
        it(store + " P4 keeps ListingTile list semantics alongside LeadPlate and honest refusal pricing", () => {
            const listing = required(siteKit.listSiteCatalog(store)[0]);
            const m = loadComponent(components + "listing-tile.tsx");
            const old = call(m, "ListingTile", { listing });
            expect(required(nodes(old)[0]).type).toBe("li");
            expect(text(old)).toContain(listing.title);
            expect(text(old)).toContain("creator " + siteKit.CREATOR_SHARE_RULE.creatorPercent + "%");
            expect(nodes(old).some(n => n.props.className === "tile lead")).toBe(true);
            const lead = call(m, "LeadPlate", { listing });
            expect(required(nodes(lead)[0]).type).toBe("a");
            expect(required(nodes(lead)[0]).props.href).toBe("/item/" + listing.itemId);
            expect(text(lead)).toContain(listing.title);
            const card = loadComponent(components + "listing-card.tsx");
            const refused = call(card, "ListingPrice", { price: { ok: false, reason: "INVALID_PRICE" } });
            expect(text(refused)).toBe("unpriced (INVALID_PRICE)");
            expect(text(call(card, "ListingCard", { listing }))).toContain("purchases unavailable");
        });
        it(store + " P4 marks real pathname navigation and keeps publish slot a link, not intake", () => {
            for (const pathname of ["/", "/publish", "/item/example"]) {
                const m = loadComponent(components + "store-nav.tsx", pathname);
                const nav = call(m, "StoreNav", { catalogueLabel: "Browse", publishLabel: "Sell", engine: null });
                const current = nodes(nav).filter(n => n.props["aria-current"] === "page");
                expect(current).toHaveLength(1);
                expect(required(current[0]).props.href).toBe(pathname === "/publish" ? "/publish" : "/");
            }

            const slot = call(loadComponent(components + "publish-slot.tsx"), "PublishSlot", {});
            expect(required(nodes(slot)[0]).type).toBe("li");
            expect(nodes(slot).some(n => n.props.href === "/publish")).toBe(true);
            expect(nodes(slot).some(n => ["form", "input", "button"].includes(String(n.type)))).toBe(false);
        });
        it(store + " P4 executes modern bounded browse success, empty state and query refusal", async () => {
            const m = loadComponent("sites/" + store + "/src/app/page.tsx");
            const fn = required(m.default);
            const all = await fn({ searchParams: Promise.resolve({}) });
            expect(text(all)).toContain("Apply filters");
            const empty = await fn({ searchParams: Promise.resolve({ q: "no-matching-record-12345" }) });
            expect(text(empty)).toContain("No matching");
            const refused = await fn({ searchParams: Promise.resolve({ q: ["a", "b"] }) });
            expect(text(refused)).toContain("CATALOG_BROWSE_QUERY_INVALID");
            expect(nodes(refused).some(n => n.type === "form")).toBe(true);
        });
    }

    it("P3/P5 retain exact original PNG bytes and show historical limitations through ProofFigure", () => {
        const media = content.PROOF_MEDIA;
        expect(media).toHaveLength(4);
        const expected: ProofDigests = { "/proof/desktop-change-review.png": "670ccdb01add10432452a4e085bf5085f6c48c2873c10244b4d9568d8f422828", "/proof/desktop-local-build.png": "ca17e1f15079921d7424e4e719aeec220202ce90a06a36bea69538243c136776", "/proof/desktop-run-viewport.png": "5f9b3a4ef6e21949e5da52eac0d03953ce6c8d50f4a18e3b96ea9af1d8eb6ee0", "/proof/desktop-run-window.png": "f5567d1b1fd439583225e5672b02b2f206697cca827a74b93092fc87cef0fb75" };

        for (const capture of media) {
            const png = readFileSync("sites/umbrella/public" + capture.src);
            expect(createHash("sha256").update(png).digest("hex")).toBe(expected[capture.src]);
            expect(png.readUInt32BE(16)).toBe(capture.width);
            expect(png.readUInt32BE(20)).toBe(capture.height);
            const figure = call(loadComponent("sites/umbrella/src/app/_components/proof-figure.tsx"), "ProofFigure", { media: capture, sizes: "100vw" });
            expect(text(figure)).toContain("Historical capture · 2026-09-28");
            expect(text(figure)).toContain("Not current runtime proof");

            for (const limit of capture.limitation)
                expect(text(figure)).toContain(limit);
            expect(nodes(figure).some(n => n.type === "img" && n.props.src === capture.src)).toBe(true);
        }
    });
    it("P5 executes modern login refusal, entitlement copy and signed-in account controls", async () => {
        const fixture = (signedIn: boolean, wired: boolean) => ({
            "../_session.js": { readSessionToken: async () => "fixture-session" },
            "../../lib/request-authority.js": { umbrellaRequestAuthority: () => ({ plane: () => ({
                        wired: { login: wired }, identity: { resolvePrincipal: async () => signedIn
                                ? { ok: true, value: { user: { email: "fixture@example.invalid" }, role: "member" } }
                                : { ok: false, reason: "IDENTITY_REQUIRED", message: "Sign in" } }
                    }) }) }
        });

        const path = "sites/umbrella/src/app/login/page.tsx";
        const signed = await required(loadComponent(path, "/login", fixture(true, true)).default)({ searchParams: Promise.resolve({}) });
        expect(text(signed)).toContain("You are already signed in");

        for (const action of ["/api/logout", "/api/auth/account/export", "/api/auth/account/disable"])
            expect(nodes(signed).some(n => n.type === "form" && n.props.action === action && n.props.method === "post")).toBe(true);
        expect(nodes(signed).some(n => n.props.name === "confirm" && n.props.required === true)).toBe(true);
        const unwired = await required(loadComponent(path, "/login", fixture(false, false)).default)({ searchParams: Promise.resolve({}) });
        expect(text(unwired)).toContain("Sign-in is not activated");
        expect(nodes(unwired).some(n => n.type === "form")).toBe(false);
        const login = await required(loadComponent(path, "/login", fixture(false, true)).default)({ searchParams: Promise.resolve({ next: "https://attacker.invalid" }) });
        expect(text(login)).toContain("hosted AI remains default-off");
        expect(text(login)).toContain("still needs an entitlement");
        expect(nodes(login).some(n => n.type === "form" && n.props.action === "/api/login")).toBe(true);
        expect(nodes(login).some(n => n.props.name === "next")).toBe(false);
    });
    it("P5 executes current TEST checkout attempt uniqueness and LIVE/unwired refusal", async () => {
        const fixture = (mode: "test" | "live", wired = true) => ({
            "../../lib/request-authority.js": { BILLING_PLANE_PENDING_NOTE: "Unwired billing", umbrellaRequestAuthority: () => ({ plane: () => ({
                        billingMode: mode, wired: { billing: wired, identity: true },
                        billing: { listCreditPacks: async () => ({ ok: true, value: [{ packId: "fixture-pack", credits: 50, unitAmount: 100, currency: "usd" }] }) }
                    }) }) }
        });

        const path = "sites/umbrella/src/app/pricing/page.tsx";
        const testPage = loadComponent(path, "/pricing", fixture("test"));
        const first = await required(testPage.default)({ searchParams: Promise.resolve({ checkout: "cancelled" }) });
        const second = await required(testPage.default)({ searchParams: Promise.resolve({}) });
        const attempt = (v: ComponentRender) => required(nodes(v).find(n => n.props.name === "attempt")).props.value;
        expect(attempt(first)).toMatch(/^[0-9a-f-]{36}$/);
        expect(attempt(first)).not.toBe(attempt(second));
        expect(text(first)).toContain("No payment was completed. No credits were added.");
        expect(nodes(first).some(n => n.type === "form" && n.props.action === "/api/checkout" && n.props.method === "post")).toBe(true);

        for (const config of [fixture("live"), fixture("test", false)]) {
            const refused = await required(loadComponent(path, "/pricing", config).default)({ searchParams: Promise.resolve({}) });
            expect(nodes(refused).some(n => n.type === "form" && n.props.action === "/api/checkout")).toBe(false);
            expect(nodes(refused).some(n => n.props["aria-disabled"] === "true")).toBe(true);
        }
    });
});

type BoundaryObjectValue = object | null;

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}

function isBoundaryTextValue<Input>(value: Input): value is Input & string {
  return typeof value === "string";
}

function isBoundaryNumericValue<Input>(value: Input): value is Input & number {
  return typeof value === "number";
}
