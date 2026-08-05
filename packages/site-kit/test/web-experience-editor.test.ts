import { describe, expect, it } from "vitest";
import {
  WEB_EXPERIENCE_AUTHORING_OPERATIONS,
  WEB_EXPERIENCE_DESKTOP_ONLY_OPERATIONS,
  WEB_EDITOR_SESSION_OPERATIONS,
  buildWebExperienceEditorView,
  editorHref,
  readEditorState,
  readWebExperienceEditorState,
} from "@sceneaxi/site-kit";

describe("the simplified Web Experience editor", () => {
  it("carries the selected Web projection through live editor navigations", () => {
    const editor = readEditorState({ profile: "web", mode: "run" });
    expect(editor.ok).toBe(true);
    if (!editor.ok) return;
    expect(editor.value.profileId).toBe("web");
    expect(editorHref(editor.value, { play: true })).toContain("profile=web");
    expect(readEditorState({ profile: "desktop" })).toMatchObject({
      ok: false,
      reason: "SITE_REQUEST_MALFORMED",
    });
  });

  it("reconstructs a stable server session from the same URL state", () => {
    const params = {
      profile: "web",
      "web-title": "Launch story",
      "web-layout": "split",
      "web-html": "<main><h1>Launch</h1><p>One durable page.</p></main>",
      "web-asset": "1",
      "web-three": "1",
    };
    const first = readWebExperienceEditorState(params);
    const second = readWebExperienceEditorState(params);
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const firstView = buildWebExperienceEditorView({
      state: first.value,
      starterArtifactId: "sculpt:starter-crate",
    });
    const secondView = buildWebExperienceEditorView({
      state: second.value,
      starterArtifactId: "sculpt:starter-crate",
    });
    expect(firstView).toEqual(secondView);
    expect(firstView.sessionId).toMatch(/^web-experience:sha256:[0-9a-f]{64}$/);
    expect(firstView.document).toMatchObject({
      schemaVersion: 1,
      kind: "sceneaxi.document",
      id: "umbrella-web-experience",
      title: "Launch story",
    });
    expect(firstView.documentDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(firstView.sessionId).toBe(`web-experience:${firstView.documentDigest}`);
    expect(firstView.operations).toBe(WEB_EXPERIENCE_AUTHORING_OPERATIONS);
  });

  it("owns its complete form contract outside the React renderer", () => {
    const state = readWebExperienceEditorState({});
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    const view = buildWebExperienceEditorView({
      state: state.value,
      starterArtifactId: "sculpt:starter-crate",
    });
    expect(view.form).toMatchObject({
      action: "/editor",
      method: "get",
      profile: { name: "profile", value: "web" },
      title: { name: "web-title", maxLength: 80, operation: "page.set-html" },
      html: { name: "web-html", maxLength: 5_000, operation: "page.set-html" },
      asset: { name: "web-asset", value: "1", operation: "asset.inject" },
      three: { name: "web-three", value: "1", operation: "three.embed" },
    });
    expect(view.form.layout.options.map((option) => option.value)).toEqual([
      "hero",
      "split",
      "stack",
    ]);
  });

  it("keeps document projection operations separate from the Minimum E2 session", () => {
    expect(
      WEB_EXPERIENCE_AUTHORING_OPERATIONS.filter((operation) =>
        (WEB_EDITOR_SESSION_OPERATIONS as readonly string[]).includes(operation),
      ),
    ).toEqual([]);
  });

  it("projects page HTML, site canvas, known asset injection, and a safe Three embed", () => {
    const state = readWebExperienceEditorState({
      profile: "web",
      "web-title": "Microsite canvas",
      "web-layout": "hero",
      "web-html": "<h1>Hello web</h1>",
      "web-asset": "1",
      "web-three": "1",
    });
    expect(state.ok).toBe(true);
    if (!state.ok) return;

    const view = buildWebExperienceEditorView({
      state: state.value,
      starterArtifactId: "sculpt:starter-crate",
    });
    expect(view.page).toMatchObject({ title: "Microsite canvas", html: "<h1>Hello web</h1>" });
    expect(view.canvas.layout).toBe("hero");
    expect(view.assets).toEqual([
      { id: "sculpt:starter-crate", kind: "sceneaxi-sculpt-artifact" },
    ]);
    expect(view.threeEmbed).toMatchObject({
      enabled: true,
      host: "umbrella-presentation-seam",
      advancesSession: false,
    });
  });

  it("confines hostile HTML to a scriptless, networkless srcDoc", () => {
    const hostile = '<script>parent.document.body.textContent="owned"</script><form action="https://evil.test">';
    const state = readWebExperienceEditorState({ "web-html": hostile });
    expect(state.ok).toBe(true);
    if (!state.ok) return;

    const view = buildWebExperienceEditorView({
      state: state.value,
      starterArtifactId: "sculpt:starter-crate",
    });
    expect(view.canvas.iframeSandbox).toBe("");
    expect(view.canvas.contentSecurityPolicy).toContain("script-src 'none'");
    expect(view.canvas.contentSecurityPolicy).toContain("connect-src 'none'");
    expect(view.canvas.srcDoc).toContain(hostile);
    expect(view.canvas.srcDoc).toContain(
      `<meta http-equiv="Content-Security-Policy" content="${view.canvas.contentSecurityPolicy}">`,
    );
  });

  it.each([
    [{ "web-layout": "desktop" }, "SITE_REQUEST_MALFORMED"],
    [{ "web-title": "" }, "SITE_REQUEST_MALFORMED"],
    [{ "web-asset": "https://evil.test/a.js" }, "SITE_REQUEST_MALFORMED"],
    [{ "web-three": ["1", "0"] }, "SITE_REQUEST_MALFORMED"],
  ] as const)("refuses malformed web authoring state %#", (params, reason) => {
    expect(readWebExperienceEditorState(params)).toMatchObject({ ok: false, reason });
  });

  it("publishes every desktop-only refusal in the view", () => {
    const state = readWebExperienceEditorState({});
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    const view = buildWebExperienceEditorView({
      state: state.value,
      starterArtifactId: "sculpt:starter-crate",
    });
    expect(view.desktopRefusals.map((entry) => entry.operation)).toEqual(
      WEB_EXPERIENCE_DESKTOP_ONLY_OPERATIONS,
    );
    expect(view.desktopRefusals.every((entry) => entry.reason === "WEB_EXPERIENCE_DESKTOP_ONLY_OPERATION")).toBe(true);
  });
});
