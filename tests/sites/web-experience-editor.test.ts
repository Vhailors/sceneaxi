import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  WEB_EXPERIENCE_AUTHORING_REFUSALS,
  buildWebExperienceEditorView,
  decideEditorAccess,
  decideEditorEntitlement,
  describeSiteAccessState,
  ok,
  readWebExperienceEditorState,
  sitePathWithSearchParams,
} from "@sceneaxi/site-kit";

const read = (relativePath: string) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");

const PAGE = "sites/umbrella/src/app/editor/page.tsx";
const SHELL = "sites/umbrella/src/app/editor/_components/editor-shell.tsx";
const WEB_EDITOR =
  "sites/umbrella/src/app/editor/_components/web-experience-editor.tsx";

const MEMBER = {
  user: {
    userId: "member-1",
    email: "member@example.com",
    emailVerified: true,
    disabled: false,
  },
  role: "user" as const,
  session: {
    sessionId: "session-1",
    userId: "member-1",
    surface: "site" as const,
    issuedAt: "2026-08-05T10:00:00.000Z",
    expiresAt: "2026-08-05T12:00:00.000Z",
  },
};

describe("SA-WEB-1 access", () => {
  it("covers no-session, denied-entitlement, and entitled member decisions", () => {
    const noSession = decideEditorAccess({
      entitlement: decideEditorEntitlement({ principal: null, credits: null }),
      previewEnabled: false,
    });
    expect(noSession).toMatchObject({
      granted: false,
      reason: "EDITOR_ENTITLEMENT_ANONYMOUS",
    });

    const denied = decideEditorAccess({
      entitlement: decideEditorEntitlement({
        principal: MEMBER,
        credits: ok({
          userId: "member-1",
          balance: 0,
          starterGrantConsumed: true,
        }),
      }),
      previewEnabled: false,
    });
    expect(denied).toMatchObject({
      granted: false,
      reason: "EDITOR_ENTITLEMENT_NO_CREDITS",
    });

    const entitled = decideEditorAccess({
      entitlement: decideEditorEntitlement({
        principal: MEMBER,
        credits: ok({
          userId: "member-1",
          balance: 12,
          starterGrantConsumed: true,
        }),
      }),
      previewEnabled: false,
    });
    expect(entitled).toMatchObject({
      granted: true,
      mode: "entitled",
      basis: "credit-balance",
    });

    const state = readWebExperienceEditorState({ profile: "web" });
    expect(state.ok).toBe(true);
    if (!state.ok || !entitled.granted) return;
    expect(
      buildWebExperienceEditorView({
        state: state.value,
        starterArtifactId: "sculpt:starter-crate",
      }).sessionId,
    ).toMatch(/^web-experience:sha256:/);
  });

  it("returns a signed-out visitor to the exact URL-carried Web session", () => {
    const destination = sitePathWithSearchParams("/editor", {
      profile: "web",
      "web-title": "Launch story",
      "web-layout": "hero",
      "web-html": "<h1>Launch & learn</h1>",
      "web-three": "1",
    });
    expect(destination).toBe(
      "/editor?profile=web&web-title=Launch+story&web-layout=hero&web-html=%3Ch1%3ELaunch+%26+learn%3C%2Fh1%3E&web-three=1",
    );
    expect(
      describeSiteAccessState("EDITOR_ENTITLEMENT_ANONYMOUS", { next: destination }).action,
    ).toEqual({
      label: "Sign in",
      href: `/login?next=${encodeURIComponent(destination)}`,
    });
  });

  it("keeps the existing umbrella identity and entitlement seam ahead of all editor work", () => {
    const page = read(PAGE);
    const route = page.slice(page.indexOf("export default"));
    const authorityAt = route.indexOf("umbrellaRequestAuthority().plane");
    const accessAt = route.indexOf("resolveUmbrellaEditorAccess");
    const refusedAt = route.indexOf("!resolved.decision.granted");
    const webStateAt = route.indexOf("readWebExperienceEditorState");
    const webViewAt = route.indexOf("buildWebExperienceEditorView");
    expect(authorityAt).toBeGreaterThan(-1);
    expect(accessAt).toBeGreaterThan(authorityAt);
    expect(refusedAt).toBeGreaterThan(accessAt);
    expect(webStateAt).toBeGreaterThan(refusedAt);
    expect(webViewAt).toBeGreaterThan(webStateAt);
    expect(route).toContain("sitePathWithSearchParams(EDITOR_DEEP_LINK_PATH, params)");
    expect(page).not.toContain("@sceneaxi/profile-web");
    expect(page).not.toContain("@sceneaxi/auth");
    expect(page).not.toContain("@sceneaxi/billing");
  });
});

describe("SA-WEB-1 browser confinement", () => {
  it("renders authored HTML only as sandboxed srcDoc and never as parent markup", () => {
    const component = read(WEB_EDITOR);
    expect(component).toContain("sandbox={view.canvas.iframeSandbox}");
    expect(component).toContain("srcDoc={view.canvas.srcDoc}");
    expect(component).not.toContain("dangerouslySetInnerHTML");
  });

  it("renders the site-kit form contract without restating authoring parameters", () => {
    const component = read(WEB_EDITOR);
    expect(component).toContain("view.form.layout.options.map");
    expect(component).toContain("name={view.form.html.name}");
    expect(component).toContain("maxLength={view.form.html.maxLength}");
    expect(component).not.toContain('name="web-html"');
    expect(component).not.toContain('data-operation="page.set-html"');
    expect(component).not.toContain('value="hero"');
  });

  it("mounts a safe Three scene outside authored HTML through the existing viewport", () => {
    const component = read(WEB_EDITOR);
    expect(component).toContain("view.threeEmbed.enabled && scene !== null");
    expect(component).toContain("<EditorViewport");
    expect(component).not.toContain("@sceneaxi/engine-presentation");
  });

  it("replaces the desktop body and clearly renders every unsupported action as a refusal", () => {
    const shell = read(SHELL);
    expect(shell).toContain("<WebExperienceEditor");
    expect(shell).toContain('profile === "web"');
    const component = read(WEB_EDITOR);
    expect(component).toContain("view.desktopRefusals.map");
    expect(component).toContain('data-kind="inert"');
    expect(component).toContain("data-refusal={refusal.reason}");
  });

  it("names the demoted-chrome refusal off the view instead of restating it", () => {
    const shell = read(SHELL);
    expect(shell).toContain("webView.desktopOnlyRefusal.code");
    expect(shell).toContain("webView.desktopOnlyRefusal.message");
    expect(shell).not.toContain('"WEB_EXPERIENCE_DESKTOP_ONLY_OPERATION"');
    expect(shell).not.toContain(
      WEB_EXPERIENCE_AUTHORING_REFUSALS.WEB_EXPERIENCE_DESKTOP_ONLY_OPERATION,
    );
  });
});
