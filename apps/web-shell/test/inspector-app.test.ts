/**
 * The served inspector routes (sceneaxi#120).
 *
 * These drive `createInspectorApp()` directly — no socket — because the app is
 * the whole served surface and the transport adds nothing to assert here.
 * `bin-smoke.test.ts` covers the socket, and `refuse-matrix.test.ts` covers the
 * refusal registry's reachability.
 */
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDocument,
  writeDocumentFile,
  type JsonObject,
} from "@sceneaxi/authoring-core";
import {
  INSPECTOR_ACTIONS,
  MAX_REQUEST_BODY_BYTES,
  WEB_SHELL_APP,
  WEB_SHELL_REFUSALS,
  createInspectorApp,
  createInspectorSession,
  inspectorPageHtml,
  type InspectorApp,
  type InspectorSession,
  type InspectorSnapshot,
} from "@sceneaxi/web-shell";

function fixtureDir(): string {
  const dir = join(mkdtempSync(join(tmpdir(), "sceneaxi-web-shell-app-")), "root");
  mkdirSync(dir);
  return dir;
}

function writeScene(dir: string, name: string, data: JsonObject): void {
  const path = join(dir, name);
  mkdirSync(dirname(path), { recursive: true });
  const result = writeDocumentFile(
    path,
    createDocument({ id: name.replace(/\.json$/, ""), data }),
    { cwd: dir },
  );
  expect(result.ok).toBe(true);
}

function project(): { dir: string; app: InspectorApp } {
  const dir = fixtureDir();
  writeScene(dir, "scene.json", { entities: [{ id: "hero", x: 1, y: 2 }] });
  return { dir, app: createInspectorApp({ projectRoot: dir }) };
}

type Payload = {
  app: string;
  ok: boolean;
  action: string;
  reason?: string;
  message?: string;
  reviewToken?: string | null;
  snapshot?: InspectorSnapshot;
  [key: string]: unknown;
};

function body(response: { body: string }): Payload {
  return JSON.parse(response.body) as Payload;
}

const EDIT = {
  documentPath: "scene.json",
  jsonPointer: "/data/entities/0/x",
  newValue: 9,
} as const;

function post(app: InspectorApp, path: string, payload: unknown) {
  return app.handle({ method: "POST", url: path, body: JSON.stringify(payload) });
}

describe("served inspector page", () => {
  it("serves a self-contained page naming the served project root", () => {
    const { dir, app } = project();
    const response = app.handle({ method: "GET", url: "/" });

    expect(response.status).toBe(200);
    expect(response.contentType).toContain("text/html");
    expect(response.body).toContain(dir);
    expect(response.body).toContain("/api/propose");
    // Self-contained by matrix necessity: no framework, no external asset.
    expect(response.body).not.toMatch(/src="https?:/);
    expect(response.body).not.toMatch(/href="https?:/);
  });

  it("escapes the project root into the page rather than interpolating markup", () => {
    const page = inspectorPageHtml('/tmp/<script>"evil"</script>');
    expect(page).not.toContain("<script>evil");
    expect(page).toContain("&lt;script&gt;&quot;evil&quot;&lt;/script&gt;");
  });

  it("refuses a non-GET method on the page", () => {
    const { app } = project();
    const response = app.handle({ method: "DELETE", url: "/" });
    expect(response.status).toBe(405);
    expect(body(response).reason).toBe(WEB_SHELL_REFUSALS.methodNotAllowed);
  });
});

describe("served inspector protocol", () => {
  it("starts idle and reports the session snapshot verbatim", () => {
    const { dir, app } = project();
    const response = app.handle({ method: "GET", url: "/api/state" });

    expect(response.status).toBe(200);
    const payload = body(response);
    expect(payload.app).toBe(WEB_SHELL_APP);
    expect(payload.ok).toBe(true);
    expect(payload["projectRoot"]).toBe(dir);
    expect(payload.snapshot?.phase).toBe("idle");
    expect(payload.snapshot?.renderedDiff).toBeNull();
  });

  it("propose reviews a rendered diff and writes nothing", () => {
    const { dir, app } = project();
    const before = readFileSync(join(dir, "scene.json"));

    const response = post(app, "/api/propose", EDIT);
    expect(response.status).toBe(200);
    const payload = body(response);
    expect(payload.snapshot?.phase).toBe("reviewing");
    expect(payload.snapshot?.renderedDiff).toContain("SceneAxi inspector");
    expect(payload.snapshot?.unifiedDiff).toMatch(/^\+.*"x": 9/m);
    expect(payload.snapshot?.proposal).not.toBeNull();

    expect(readFileSync(join(dir, "scene.json")).equals(before)).toBe(true);
  });

  it("accept applies the reviewed proposal", () => {
    const { dir, app } = project();
    const review = body(post(app, "/api/propose", EDIT));
    expect(review.reviewToken).toMatch(/^sha256:[0-9a-f]{64}$/);

    const accepted = body(
      post(app, "/api/accept", { reviewToken: review.reviewToken }),
    );
    expect(accepted.ok).toBe(true);
    expect(accepted.snapshot?.phase).toBe("applied");
    expect(accepted.snapshot?.appliedPaths).toEqual(["scene.json"]);
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toContain('"x": 9');
  });

  it("reject discards the proposal and leaves the document alone", () => {
    const { dir, app } = project();
    const before = readFileSync(join(dir, "scene.json"));
    const review = body(post(app, "/api/propose", EDIT));

    const rejected = body(
      post(app, "/api/reject", { reviewToken: review.reviewToken }),
    );
    expect(rejected.ok).toBe(true);
    expect(rejected.snapshot?.phase).toBe("rejected");
    expect(rejected.snapshot?.renderedDiff).toBeNull();
    expect(readFileSync(join(dir, "scene.json")).equals(before)).toBe(true);
  });

  it("reports the served document's id and content hash", () => {
    const { dir, app } = project();
    const response = app.handle({
      method: "GET",
      url: "/api/document?path=scene.json",
    });

    expect(response.status).toBe(200);
    const payload = body(response);
    expect(payload["documentId"]).toBe("scene");
    expect(payload["contentHash"]).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(payload["dataKeys"]).toEqual(["entities"]);
    expect(payload["projectRoot"]).toBe(dir);
  });
});

describe("served inspector drives the existing session, not a second protocol", () => {
  it("each action forwards to the InspectorSession method it declares", () => {
    const { dir } = project();
    const calls: string[] = [];
    const real = createInspectorSession({ cwd: dir });
    // A recording proxy over the real session: the routes must reach these
    // methods, and the behaviour underneath must still be authoring-core's.
    const session: InspectorSession = {
      snapshot: () => (calls.push("snapshot"), real.snapshot()),
      proposeEdit: (input) => (calls.push("proposeEdit"), real.proposeEdit(input)),
      accept: () => (calls.push("accept"), real.accept()),
      reject: () => (calls.push("reject"), real.reject()),
      refreshRecovery: () => (calls.push("refreshRecovery"), real.refreshRecovery()),
    };
    const app = createInspectorApp({ projectRoot: dir, session });

    app.handle({ method: "GET", url: INSPECTOR_ACTIONS.state.path });
    const firstReview = body(post(app, INSPECTOR_ACTIONS.propose.path, EDIT));
    post(app, INSPECTOR_ACTIONS.reject.path, {
      reviewToken: firstReview.reviewToken,
    });
    post(app, INSPECTOR_ACTIONS.recover.path, {});
    const secondReview = body(post(app, INSPECTOR_ACTIONS.propose.path, EDIT));
    post(app, INSPECTOR_ACTIONS.accept.path, {
      reviewToken: secondReview.reviewToken,
    });

    expect(calls).toEqual([
      INSPECTOR_ACTIONS.state.session,
      INSPECTOR_ACTIONS.propose.session,
      INSPECTOR_ACTIONS.reject.session,
      INSPECTOR_ACTIONS.recover.session,
      INSPECTOR_ACTIONS.propose.session,
      INSPECTOR_ACTIONS.accept.session,
    ]);
  });

  it("every declared session action names a real InspectorSession method", () => {
    const { dir } = project();
    const session = createInspectorSession({ cwd: dir }) as unknown as Record<
      string,
      unknown
    >;
    const declared = Object.values(INSPECTOR_ACTIONS)
      .map((route): string | null => route.session)
      .filter((name): name is string => name !== null);

    expect(declared.length).toBeGreaterThan(0);
    for (const name of declared) {
      expect(typeof session[name], `${name} is not a session method`).toBe("function");
    }
  });
});

describe("served inspector fails closed", () => {
  it("refuses an unknown route and lists the real ones", () => {
    const { app } = project();
    const response = app.handle({ method: "GET", url: "/api/nope" });
    expect(response.status).toBe(404);
    const payload = body(response);
    expect(payload.reason).toBe(WEB_SHELL_REFUSALS.routeUnknown);
    expect(payload["routes"]).toContain("POST /api/propose");
  });

  it("refuses the wrong method on a real route", () => {
    const { app } = project();
    const response = app.handle({ method: "GET", url: "/api/propose" });
    expect(response.status).toBe(405);
    expect(body(response).reason).toBe(WEB_SHELL_REFUSALS.methodNotAllowed);
  });

  it("refuses a body that is not a JSON object", () => {
    const { app } = project();
    for (const raw of ["{oops", "[1,2]", '"a string"', "null"]) {
      const response = app.handle({ method: "POST", url: "/api/propose", body: raw });
      expect(response.status, raw).toBe(400);
      expect(body(response).reason, raw).toBe(WEB_SHELL_REFUSALS.requestBodyNotJson);
    }
  });

  it("refuses an oversized body", () => {
    const { app } = project();
    const response = app.handle({
      method: "POST",
      url: "/api/propose",
      body: JSON.stringify({ ...EDIT, newValue: "x".repeat(MAX_REQUEST_BODY_BYTES) }),
    });
    expect(response.status).toBe(413);
    expect(body(response).reason).toBe(WEB_SHELL_REFUSALS.requestBodyTooLarge);
  });

  it("refuses a malformed edit rather than guessing a default", () => {
    const { app } = project();
    const cases: Array<[string, unknown]> = [
      ["missing documentPath", { jsonPointer: "/data", newValue: 1 }],
      ["empty documentPath", { documentPath: "", jsonPointer: "/data", newValue: 1 }],
      ["non-string pointer", { documentPath: "scene.json", jsonPointer: 7, newValue: 1 }],
      ["missing newValue", { documentPath: "scene.json", jsonPointer: "/data" }],
    ];
    for (const [label, payload] of cases) {
      const response = post(app, "/api/propose", payload);
      expect(response.status, label).toBe(400);
      expect(body(response).reason, label).toBe(WEB_SHELL_REFUSALS.editFieldInvalid);
    }
  });

  it("refuses a document path that escapes the served project root", () => {
    const { dir, app } = project();
    writeScene(dirname(dir), "outside.json", { entities: [] });

    for (const path of ["../outside.json", "sub/../../outside.json"]) {
      const response = post(app, "/api/propose", { ...EDIT, documentPath: path });
      expect(response.status, path).toBe(403);
      expect(body(response).reason, path).toBe(
        WEB_SHELL_REFUSALS.documentOutsideProjectRoot,
      );
    }

    const absolute = post(app, "/api/propose", {
      ...EDIT,
      documentPath: join(dirname(dir), "outside.json"),
    });
    expect(absolute.status).toBe(403);
  });

  it("refuses a symlink inside the root that points outside it", () => {
    const { dir, app } = project();
    writeScene(dirname(dir), "linked.json", { entities: [{ x: 0 }] });
    symlinkSync(join(dirname(dir), "linked.json"), join(dir, "linked.json"));

    const response = post(app, "/api/propose", {
      ...EDIT,
      documentPath: "linked.json",
    });
    expect(response.status).toBe(403);
    expect(body(response).reason).toBe(
      WEB_SHELL_REFUSALS.documentOutsideProjectRoot,
    );
  });

  it("answers an unexpected routing failure instead of throwing", () => {
    const { dir } = project();
    const app = createInspectorApp({
      projectRoot: dir,
      session: {
        ...createInspectorSession({ cwd: dir }),
        snapshot: () => {
          throw new Error("boom");
        },
      },
    });
    const response = app.handle({ method: "GET", url: "/api/state" });
    expect(response.status).toBe(500);
    expect(body(response).reason).toBe(WEB_SHELL_REFUSALS.handlerFailed);
  });

  it("refuses an absent or non-document file", () => {
    const { dir, app } = project();
    const absent = app.handle({ method: "GET", url: "/api/document?path=absent.json" });
    expect(absent.status).toBe(404);
    expect(body(absent).reason).toBe(WEB_SHELL_REFUSALS.documentUnreadable);

    writeFileSync(join(dir, "notes.json"), "[1,2,3]", "utf8");
    const notADocument = app.handle({
      method: "GET",
      url: "/api/document?path=notes.json",
    });
    expect(notADocument.status).toBe(422);
    expect(body(notADocument).reason).toBe(WEB_SHELL_REFUSALS.documentUnreadable);
  });

  it("surfaces an authoring-core refusal as a refusal, not a 200", () => {
    const { app } = project();
    const response = post(app, "/api/propose", {
      ...EDIT,
      jsonPointer: "/data/entities/0/missing/deeper",
    });
    expect(response.status).toBe(409);
    const payload = body(response);
    expect(payload.reason).toBe(WEB_SHELL_REFUSALS.inspectorRefused);
    expect(payload.snapshot?.diagnostics?.[0]?.code).toBe("invalid-pointer");
  });

  it("binds accept and reject to the exact rendered review", () => {
    const { dir, app } = project();
    const before = readFileSync(join(dir, "scene.json"));
    const first = body(post(app, "/api/propose", EDIT));
    const second = body(post(app, "/api/propose", { ...EDIT, newValue: 17 }));

    expect(first.reviewToken).not.toBe(second.reviewToken);
    for (const action of ["accept", "reject"] as const) {
      const stale = post(app, `/api/${action}`, {
        reviewToken: first.reviewToken,
      });
      expect(stale.status, action).toBe(409);
      expect(body(stale).reason, action).toBe(
        WEB_SHELL_REFUSALS.reviewTokenInvalid,
      );
      expect(readFileSync(join(dir, "scene.json")).equals(before), action).toBe(
        true,
      );
    }

    const accepted = post(app, "/api/accept", {
      reviewToken: second.reviewToken,
    });
    expect(accepted.status).toBe(200);
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toContain('"x": 17');
  });

  it("refuses accept without a reviewed proposal token", () => {
    const { app } = project();
    const accepted = post(app, "/api/accept", {});
    expect(accepted.status).toBe(409);
    expect(body(accepted).reason).toBe(WEB_SHELL_REFUSALS.reviewTokenInvalid);
  });

  it("refuses a pointer authoring-core rejects, keeping the session idle", () => {
    const { app } = project();
    const response = post(app, "/api/propose", {
      ...EDIT,
      jsonPointer: "/data/entities/0/missing/deeper",
    });
    expect(response.status).toBe(409);
    const payload = body(response);
    expect(payload.reason).toBe(WEB_SHELL_REFUSALS.inspectorRefused);
    expect(payload.snapshot?.phase).toBe("idle");
  });
});
