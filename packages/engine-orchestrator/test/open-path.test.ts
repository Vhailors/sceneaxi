/**
 * The orchestrated open path, proved through the public package name.
 *
 * Two properties carry the ship: the orchestrator really opens the kernel's
 * three landed paths (not a re-implementation of them), and the session it hands
 * back is under a lifecycle that a caller cannot walk past.
 */
import { describe, expect, it } from "vitest";
import {
  BOM_VERSION,
  KERNEL_VERSION,
  portableKernelDigest,
} from "@sceneaxi/engine-kernel";
import {
  OPEN_PATH_KINDS,
  bootstrapOpenPath,
  resumeOpenPath,
} from "@sceneaxi/engine-orchestrator";
import {
  FIXED_NOW_MS,
  composedSceneFixture,
  fixedHost,
  productManifestFixture,
  sculptArtifactFixture,
} from "./fixtures.js";

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

describe("open-path bootstrap over the product session", () => {
  it("opens a real kernel session and records what it opened", () => {
    const bootstrapped = bootstrapOpenPath(
      { kind: "product", productManifest: productManifestFixture() },
      fixedHost,
    );
    expect(bootstrapped.ok).toBe(true);
    if (!bootstrapped.ok) return;

    const handle = bootstrapped.value;
    expect(handle.kind).toBe("product");
    expect(handle.status()).toBe("open");
    expect(handle.bootstrap).toEqual({
      kind: "product",
      subjectId: "orchestrated-product",
      sessionId: expect.stringMatching(DIGEST_RE) as unknown as string,
      openedAtMs: FIXED_NOW_MS,
      resumed: false,
      kernelVersion: KERNEL_VERSION,
      bomVersion: BOM_VERSION,
    });
    expect(Object.isFrozen(handle.bootstrap)).toBe(true);

    const session = handle.session();
    expect(session.ok).toBe(true);
    if (!session.ok) return;

    // The handle carries the kernel's own session: its authority model is
    // untouched, and only `advance` moves state.
    const initial = session.value.observe();
    session.value.dispatch({ type: "move", actor: "hero", axis: [3, -1] });
    expect(session.value.observe().digest).toBe(initial.digest);
    session.value.advance({ tick: 1, deltaMs: 16 });
    const terminal = session.value.observe();
    expect(terminal.digest).not.toBe(initial.digest);
    expect(terminal.entities).toEqual([
      { id: "crate", x: -1, y: 0 },
      { id: "hero", x: 5, y: 0 },
    ]);
  });

  it("resumes a saved session and marks the bootstrap record as resumed", () => {
    const opened = bootstrapOpenPath(
      { kind: "product", productManifest: productManifestFixture() },
      fixedHost,
    );
    if (!opened.ok) throw new Error(opened.reason);
    const live = opened.value.session();
    if (!live.ok) throw new Error(live.reason);
    live.value.dispatch({ type: "move", actor: "hero", axis: [1, 1] });
    live.value.advance({ tick: 1, deltaMs: 16 });
    const terminal = live.value.observe();

    const resumed = resumeOpenPath(
      { kind: "product", save: live.value.save() },
      fixedHost,
    );
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.value.bootstrap.resumed).toBe(true);
    expect(resumed.value.bootstrap.subjectId).toBe("orchestrated-product");

    const replayed = resumed.value.session();
    if (!replayed.ok) throw new Error(replayed.reason);
    expect(replayed.value.observe()).toEqual(terminal);

    // A resume is a different session from a fresh open of the same subject at
    // the same clock reading, and says so.
    expect(resumed.value.bootstrap.sessionId).not.toBe(
      opened.value.bootstrap.sessionId,
    );
  });

  it("keeps a host clock bound to the host that owns it", () => {
    const ownClockHost = {
      reading: FIXED_NOW_MS,
      nowMs(): number {
        return this.reading;
      },
    };

    const bootstrapped = bootstrapOpenPath(
      { kind: "product", productManifest: productManifestFixture() },
      ownClockHost,
    );
    if (!bootstrapped.ok) throw new Error(bootstrapped.reason);
    expect(bootstrapped.value.bootstrap.openedAtMs).toBe(FIXED_NOW_MS);

    const session = bootstrapped.value.session();
    if (!session.ok) throw new Error(session.reason);
    session.value.dispatch({ type: "move", actor: "hero", axis: [1, 0] });
    session.value.advance({ tick: 1, deltaMs: 16 });
    expect(session.value.save().events).toContainEqual(
      expect.objectContaining({ kind: "dispatch", timestampMs: FIXED_NOW_MS }),
    );
  });
});

describe("open-path bootstrap over the sculpt and scene sessions", () => {
  it("opens and resumes a sculpt session through one request vocabulary", () => {
    const opened = bootstrapOpenPath(
      {
        kind: "sculpt",
        artifact: sculptArtifactFixture(),
        options: { seed: 4242 },
      },
      fixedHost,
    );
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.bootstrap.kind).toBe("sculpt");
    expect(opened.value.bootstrap.subjectId).toBe("crate-artifact");

    const session = opened.value.session();
    if (!session.ok) throw new Error(session.reason);
    for (let tick = 1; tick <= 4; tick += 1) {
      session.value.advance({ tick, deltaMs: 100 });
    }
    const terminal = session.value.observe();

    const resumed = resumeOpenPath(
      { kind: "sculpt", save: session.value.save() },
      fixedHost,
    );
    if (!resumed.ok) throw new Error(resumed.reason);
    const replayed = resumed.value.session();
    if (!replayed.ok) throw new Error(replayed.reason);
    expect(replayed.value.observe().digest).toBe(terminal.digest);
  });

  it("opens and resumes a composed scene as one multi-object session", () => {
    const scene = composedSceneFixture();
    const opened = bootstrapOpenPath(
      { kind: "scene", scene, options: { seed: 9101 } },
      fixedHost,
    );
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.bootstrap.kind).toBe("scene");
    expect(opened.value.bootstrap.subjectId).toBe("orchestrated-bay");

    const session = opened.value.session();
    if (!session.ok) throw new Error(session.reason);
    const initial = session.value.observe();
    expect(initial.instances).toHaveLength(2);
    for (let tick = 1; tick <= 8; tick += 1) {
      session.value.advance({ tick, deltaMs: 100 });
    }
    const terminal = session.value.observe();
    expect(terminal.digest).not.toBe(initial.digest);

    const resumed = resumeOpenPath(
      { kind: "scene", save: session.value.save() },
      fixedHost,
    );
    if (!resumed.ok) throw new Error(resumed.reason);
    const replayed = resumed.value.session();
    if (!replayed.ok) throw new Error(replayed.reason);
    expect(replayed.value.observe().digest).toBe(terminal.digest);
  });

  it("covers every declared open-path kind", () => {
    expect(OPEN_PATH_KINDS).toEqual(["product", "sculpt", "scene"]);
    for (const kind of OPEN_PATH_KINDS) {
      const request =
        kind === "product"
          ? ({ kind, productManifest: productManifestFixture() } as const)
          : kind === "sculpt"
            ? ({
                kind,
                artifact: sculptArtifactFixture(),
                options: { seed: 11 },
              } as const)
            : ({
                kind,
                scene: composedSceneFixture(),
                options: { seed: 11 },
              } as const);
      const bootstrapped = bootstrapOpenPath(request, fixedHost);
      expect(bootstrapped.ok, `${kind} must bootstrap`).toBe(true);
    }
  });
});

describe("open-path session lifecycle", () => {
  it("refuses to hand out a closed session, and closing twice is not an error", () => {
    const opened = bootstrapOpenPath(
      { kind: "product", productManifest: productManifestFixture() },
      fixedHost,
    );
    if (!opened.ok) throw new Error(opened.reason);
    const handle = opened.value;

    const taken = handle.session();
    expect(taken.ok).toBe(true);

    handle.close();
    handle.close();
    expect(handle.status()).toBe("closed");

    const afterClose = handle.session();
    expect(afterClose).toMatchObject({
      ok: false,
      reason: "OPEN_PATH_SESSION_CLOSED",
      detail: null,
    });

    // Honest bound: the guard is on the handle, not a revocation of a kernel
    // object a caller already took. Closing releases the handle's grant; it does
    // not reach into a reference someone else is holding.
    if (!taken.ok) return;
    expect(() => {
      taken.value.advance({ tick: 1, deltaMs: 16 });
    }).not.toThrow();
  });

  it("is a lifecycle per handle: two opens of one subject are two sessions", () => {
    const request = {
      kind: "product",
      productManifest: productManifestFixture(),
    } as const;
    const first = bootstrapOpenPath(request, fixedHost);
    const second = bootstrapOpenPath(request, fixedHost);
    if (!first.ok || !second.ok) throw new Error("bootstrap refused");

    first.value.close();
    expect(first.value.status()).toBe("closed");
    expect(second.value.status()).toBe("open");
    expect(second.value.session().ok).toBe(true);
  });
});

describe("open-path determinism", () => {
  it("derives the same session id from the same request, host, and mode", () => {
    const request = {
      kind: "product",
      productManifest: productManifestFixture(),
    } as const;
    const first = bootstrapOpenPath(request, fixedHost);
    const second = bootstrapOpenPath(request, fixedHost);
    if (!first.ok || !second.ok) throw new Error("bootstrap refused");
    expect(second.value.bootstrap.sessionId).toBe(
      first.value.bootstrap.sessionId,
    );

    const other = bootstrapOpenPath(
      {
        kind: "product",
        productManifest: productManifestFixture("other-product"),
      },
      fixedHost,
    );
    if (!other.ok) throw new Error("bootstrap refused");
    expect(other.value.bootstrap.sessionId).not.toBe(
      first.value.bootstrap.sessionId,
    );
  });

  it("accepts an injected digest that agrees with the portable one, and changes no bytes", () => {
    const request = {
      kind: "sculpt",
      artifact: sculptArtifactFixture(),
      options: { seed: 4242 },
    } as const;
    let injectedCalls = 0;
    const injectedHost = {
      nowMs: () => FIXED_NOW_MS,
      digest: (input: string) => {
        injectedCalls += 1;
        return portableKernelDigest(input);
      },
    };

    const plain = bootstrapOpenPath(request, fixedHost);
    const injected = bootstrapOpenPath(request, injectedHost);
    if (!plain.ok || !injected.ok) throw new Error("bootstrap refused");
    expect(injectedCalls).toBeGreaterThan(0);
    expect(injected.value.bootstrap.sessionId).toBe(
      plain.value.bootstrap.sessionId,
    );

    const plainSession = plain.value.session();
    const injectedSession = injected.value.session();
    if (!plainSession.ok || !injectedSession.ok) throw new Error("closed");
    expect(injectedSession.value.observe().digest).toBe(
      plainSession.value.observe().digest,
    );
  });
});
