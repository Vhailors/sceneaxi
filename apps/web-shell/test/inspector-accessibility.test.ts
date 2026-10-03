import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import { createDocument, writeDocumentFile } from "@sceneaxi/authoring-core";
import { createInspectorApp, inspectorPageHtml, type InspectorSession, type InspectorHttpRequest } from "@sceneaxi/web-shell";

const cleanups: (() => void)[] = [];

afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });

async function page(session?: InspectorSession) {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-inspector-a11y-"));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  expect(writeDocumentFile(join(root, "scene.json"), createDocument({ id: "scene", data: { entities: [{ id: "hero", x: 1 }] } }), { cwd: root }).ok).toBe(true);
  const before = readFileSync(join(root, "scene.json"));
  const appOptions: InspectorAppOptions = { projectRoot: root };

  if (session) appOptions.session = session;
  const app = createInspectorApp(appOptions);
  const window = new Window({ url: "http://127.0.0.1/", settings: { enableJavaScriptEvaluation: true } });
  cleanups.push(() => window.close());
  const calls: string[] = [];
  const errors: unknown[] = [];
  window.addEventListener("error", (event) => errors.push(event));
  window.fetch = async (url, options) => {
    const request: MutableOwnerFields<InspectorHttpRequest> = { url: String(url), method: options?.method ?? "GET" };

    if (isProtocolText(options?.body)) request.body = options.body;
    calls.push(request.url);
    const response = app.handle(request);

    return new window.Response(response.body, { status: response.status });
  };

  window.document.write(inspectorPageHtml(root));
  await window.happyDOM.waitUntilComplete();

  const element = (id: string) => {
    const node = window.document.getElementById(id);

    if (!(node instanceof window.HTMLElement)) throw new Error("Missing inspector control: " + id);

    return node;
  };

  const input = (id: string, value: string) => {
    const node = element(id);

    if (!(node instanceof window.HTMLInputElement)) throw new Error("Missing inspector field");
    node.value = value;
    node.dispatchEvent(new window.Event("input", { bubbles: true }));
  };

  const submit = async () => {
    element("propose").focus();
    element("edit").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await window.happyDOM.waitUntilComplete();
  };

  const click = async (id: string) => {
    element(id).focus();
    element(id).click();
    await window.happyDOM.waitUntilComplete();
  };

  return { window, root, before, app, calls, errors, element, input, submit, click };
}

describe("inspector accessible protocol feedback", () => {
  it("describes unavailable review actions and keeps native no-activation behavior", async () => {
    const p = await page();

    for (const id of ["accept", "reject", "recover", "reconcile"]) {
      const ids = p.element(id).getAttribute("aria-describedby")?.split(/\s+/) ?? [];
      expect(ids.length).toBeGreaterThan(0);

      for (const description of ids) expect(p.element(description).textContent?.trim()).not.toBe("");
    }

    const count = p.calls.length;
    p.element("accept").click();
    p.element("reject").click();
    expect(p.calls.length).toBe(count);
    expect(p.element("review-help").textContent).toContain("Propose");
    expect(p.window.document.activeElement).toBe(p.window.document.body);
  });

  it("marks malformed JSON invalid, focuses the field, clears the error on edit, and never sends it", async () => {
    const p = await page();
    const count = p.calls.length;
    p.input("newValue", "{broken");
    await p.submit();
    expect(p.calls.length).toBe(count);
    expect(p.element("newValue").getAttribute("aria-invalid")).toBe("true");
    expect(p.element("newValue").getAttribute("aria-describedby")).toContain("note");
    expect(p.window.document.activeElement).toBe(p.element("newValue"));
    p.input("newValue", "9");
    expect(p.element("newValue").hasAttribute("aria-invalid")).toBe(false);
    expect(p.element("note").textContent).toBe("");
    await p.submit();
    expect(p.element("phase").textContent).toBe("reviewing");
    expect(readFileSync(join(p.root, "scene.json"))).toEqual(p.before);
    expect(p.errors).toEqual([]);
  });

  it("announces review/rejection without a write and returns focus to the remaining action", async () => {
    const p = await page();
    await p.submit();
    expect(p.element("note").textContent).toContain("Review");
    expect(p.element("review-help").textContent).toContain("exact");
    await p.click("reject");
    expect(p.element("phase").textContent).toBe("rejected");
    expect(p.element("note").textContent).toContain("No document was written");
    expect(p.element("diff").textContent).toContain("No current proposal");
    expect(p.window.document.activeElement).toBe(p.element("propose"));
    expect(readFileSync(join(p.root, "scene.json"))).toEqual(p.before);
  });

  it("invalidates a replaced review, exposes explicit reconciliation, and does not accept unseen diff", async () => {
    const p = await page();
    await p.submit();
    p.app.handle({ method: "POST", url: "/api/propose", body: JSON.stringify({ documentPath: "scene.json", jsonPointer: "/data/entities/0/x", newValue: 71 }) });
    await p.click("accept");
    expect(p.element("note").textContent).toContain("review-token-invalid");
    expect(p.element("note").textContent).toContain("Read authoritative state");
    expect(p.element("diff").textContent).toContain("stale");
    expect(p.element("accept").hasAttribute("disabled")).toBe(true);
    expect(p.element("reconcile").hasAttribute("hidden")).toBe(false);
    expect(p.window.document.activeElement).toBe(p.element("reconcile"));
    expect(readFileSync(join(p.root, "scene.json"))).toEqual(p.before);
    await p.click("reconcile");
    expect(p.element("diff").textContent).toContain("71");
    expect(p.element("note").textContent).toContain("Review");
    expect(p.window.document.activeElement).toBe(p.element("accept"));
    expect(p.calls.filter((path) => path === "/api/accept")).toHaveLength(1);
  });

  it("shows busy state while a request is unresolved and never repeats a pending operation", async () => {
    const p = await page();
    const fetch = p.window.fetch;
    let release = () => {};

    const wait = new Promise<void>((resolve) => { release = resolve; });
    p.window.fetch = async (url, options) => { await wait;

 return fetch(url, options); };

    p.element("propose").focus();
    p.element("edit").dispatchEvent(new p.window.Event("submit", { bubbles: true, cancelable: true }));
    expect(p.element("edit").getAttribute("aria-busy")).toBe("true");
    expect(p.element("diff").getAttribute("aria-busy")).toBe("true");
    expect(p.element("note").textContent).toContain("Waiting");
    p.element("edit").dispatchEvent(new p.window.Event("submit", { bubbles: true, cancelable: true }));
    release();
    await p.window.happyDOM.waitUntilComplete();
    expect(p.calls.filter((path) => path === "/api/propose")).toHaveLength(1);
    expect(p.element("diff").getAttribute("aria-busy")).toBe("false");
  });

  it("explains durable pending recovery without claiming rollback or successful apply", async () => {
    const snapshot = { phase: "pending", journalRecoveryPending: true, renderedDiff: "pending diff", unifiedDiff: null, proposal: null, appliedPaths: null, diagnostics: [{ code: "apply-in-progress", message: "The apply outcome is pending journal recovery.", reReadHint: "Call refreshRecovery() before another inspector action." }] } as const;
    const p = await page({ snapshot: () => snapshot, proposeEdit: () => snapshot, accept: () => snapshot, reject: () => snapshot, refreshRecovery: () => snapshot });
    expect(p.element("note").textContent).toContain("outcome is pending");
    expect(p.element("note").textContent).toContain("Resolve pending apply");
    expect(p.element("propose").hasAttribute("disabled")).toBe(true);
    expect(p.element("accept").hasAttribute("disabled")).toBe(true);
    expect(p.element("recover").hasAttribute("hidden")).toBe(false);
    expect(readFileSync(join(p.root, "scene.json"))).toEqual(p.before);
  });

  it("keeps long genuine refusal text safe and recoverable without inventing success", async () => {
    const p = await page();
    const longPath = "../" + "<unsafe>&".repeat(100);
    p.input("documentPath", longPath);
    await p.submit();
    expect(p.element("note").textContent).toContain("document-outside-project-root");
    expect(p.element("note").querySelector("unsafe")).toBeNull();
    expect(p.element("propose").hasAttribute("disabled")).toBe(false);
    expect(p.element("accept").hasAttribute("disabled")).toBe(true);
    expect(readFileSync(join(p.root, "scene.json"))).toEqual(p.before);
    expect(p.errors).toEqual([]);
  });

  it("does not steal focus from a field chosen while the response is pending", async () => {
    const p = await page();
    const fetch = p.window.fetch;
    let release = () => {};

    const wait = new Promise<void>((resolve) => { release = resolve; });
    p.window.fetch = async (url, options) => { await wait;

 return fetch(url, options); };

    p.element("propose").focus();
    p.element("edit").dispatchEvent(new p.window.Event("submit", { bubbles: true, cancelable: true }));
    p.element("documentPath").focus();
    release();
    await p.window.happyDOM.waitUntilComplete();
    expect(p.window.document.activeElement).toBe(p.element("documentPath"));
    expect(p.element("phase").textContent).toBe("reviewing");
  });

  it("recovers a lost acceptance response by reading state, never resending the write", async () => {
    const p = await page();
    await p.submit();
    const fetch = p.window.fetch;
    p.window.fetch = async (url, options) => {
      const response = await fetch(url, options);

      if (String(url) === "/api/accept") throw new Error("Lost response after commit");

      return response;
    };

    await p.click("accept");
    expect(p.element("note").textContent).toContain("outcome unknown");
    expect(p.window.document.activeElement).toBe(p.element("reconcile"));
    expect(p.element("propose").hasAttribute("disabled")).toBe(true);
    p.element("accept").click();
    expect(p.calls.filter((path) => path === "/api/accept")).toHaveLength(1);
    await p.click("reconcile");
    expect(p.element("phase").textContent).toBe("applied");
    expect(p.element("note").textContent).toContain("history");
    expect(p.element("diff").textContent).toContain("Applied change (history)");
    expect(p.window.document.activeElement).toBe(p.element("propose"));
    expect(readFileSync(join(p.root, "scene.json"), "utf8")).toContain('"x": 42');
    expect(p.calls.filter((path) => path === "/api/accept")).toHaveLength(1);
    expect(p.errors).toEqual([]);
  });

  it("handles aborted and non-JSON responses without claiming rejection or writing", async () => {
    for (const failure of ["aborted", "nonjson"]) {
      const p = await page();
      p.window.fetch = async () => {
        if (failure === "aborted") throw new Error("Request aborted");

        return new p.window.Response("not JSON");
      };

      await p.submit();
      expect(p.element("phase").textContent).toBe("unknown");
      expect(p.element("note").textContent).toContain("No write was retried");
      expect(p.element("diff").textContent).toContain("Current outcome unknown");
      expect(p.window.document.activeElement).toBe(p.element("reconcile"));
      expect(p.element("diff").getAttribute("aria-busy")).toBe("false");
      expect(readFileSync(join(p.root, "scene.json"))).toEqual(p.before);
      expect(p.errors).toEqual([]);
    }
  });

  it("keeps declared danger paints above 4.5:1 on light/dark reference canvases and rejects the old dark paint", () => {
    const luminance = (rgb: number[]) => rgb.map((channel) => {
      const c = channel / 255;

      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }).reduce((total, value, index) => total + value * (index === 0 ? 0.2126 : index === 1 ? 0.7152 : 0.0722), 0);

    const contrast = (foreground: number[], background: number[]) => {
      const a = luminance(foreground), b = luminance(background);

      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };

    expect(contrast([179, 38, 30], [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
    expect(contrast([255, 77, 94], [18, 18, 18])).toBeGreaterThanOrEqual(4.5);
    expect(contrast([179, 38, 30], [18, 18, 18])).toBeLessThan(4.5);
    // Declared reference colors only; real system Canvas and high contrast are browser predicates.
    expect(inspectorPageHtml("/")).toContain(".refused { color: #b3261e; }");
    expect(inspectorPageHtml("/")).toContain(".refused { color: #FF4D5E; }");
  });

  it("preserves wrapping/theme/focus rules and makes invalid fields legible in forced colors", () => {
    const html = inspectorPageHtml("/" + "long-id".repeat(100));
    expect(html).toContain("overflow-wrap: anywhere");
    expect(html).toContain("white-space: pre-wrap");
    expect(html).toContain("color-scheme: light dark");
    expect(html).toContain(".refused { color: #FF4D5E; }");
    expect(html).toContain("outline-color: Highlight");
    expect(html).toContain('[aria-invalid="true"]');
    expect(html).toContain("border-color: Mark");
    expect(html).not.toMatch(/<script[^>]+src=|\sonclick=|https:\/\//);
  });
});

function isProtocolText<Value>(value: Value): value is Value & (string) {
  return typeof value === "string";
}

/** Mutable request builders preserve each owner-defined property type. */
type MutableOwnerFields<Owner> = { -readonly [Key in keyof Owner]: Owner[Key] };

type InspectorAppOptions = { projectRoot: string; session?: InspectorSession };
