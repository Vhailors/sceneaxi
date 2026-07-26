/**
 * Every named orchestrator refusal is reachable from the public seam.
 *
 * This is the test that stops a refusal reason from being declared and then
 * never wired, and stops a reachable refusal from losing its covering case.
 * Adding a key to `ORCHESTRATOR_REFUSALS` without a case here fails the gate.
 */
import { describe, expect, it } from "vitest";
import {
  ORCHESTRATOR_REFUSALS,
  ORCHESTRATOR_REFUSAL_REASONS,
  bootstrapOpenPath,
  resumeOpenPath,
  type OpenPathHost,
  type OpenPathRequest,
  type OrchestratorRefusalReason,
  type OrchestratorResult,
  type ProductResumeRequest,
  type ResumeOpenPathRequest,
} from "@sceneaxi/engine-orchestrator";
import { fixedHost, productManifestFixture } from "./fixtures.js";

const asOpenRequest = (value: unknown) => value as OpenPathRequest;
const asResumeRequest = (value: unknown) => value as ResumeOpenPathRequest;
const asHost = (value: unknown) => value as OpenPathHost;

const productRequest = {
  kind: "product",
  productManifest: productManifestFixture(),
} as const;

/** Open a product session, advance it once, and return its save artifact. */
function savedProduct() {
  const opened = bootstrapOpenPath(productRequest, fixedHost);
  if (!opened.ok) throw new Error(opened.reason);
  const session = opened.value.session();
  if (!session.ok) throw new Error(session.reason);
  session.value.dispatch({ type: "move", actor: "hero", axis: [1, 0] });
  session.value.advance({ tick: 1, deltaMs: 16 });
  return session.value.save();
}

const CASES: Record<
  OrchestratorRefusalReason,
  () => OrchestratorResult<unknown>
> = {
  OPEN_PATH_REQUEST_MALFORMED: () =>
    bootstrapOpenPath(asOpenRequest(null), fixedHost),

  OPEN_PATH_KIND_UNKNOWN: () =>
    bootstrapOpenPath(asOpenRequest({ kind: "job-queue", jobs: [] }), fixedHost),

  OPEN_PATH_HOST_INVALID: () => bootstrapOpenPath(productRequest, asHost({})),

  OPEN_PATH_SUBJECT_UNIDENTIFIED: () =>
    bootstrapOpenPath(
      asOpenRequest({ kind: "product", productManifest: { seed: 7 } }),
      fixedHost,
    ),

  OPEN_PATH_KERNEL_REFUSED: () =>
    bootstrapOpenPath(
      asOpenRequest({
        kind: "product",
        productManifest: { productId: "bad-seed-product", seed: 1.5 },
      }),
      fixedHost,
    ),

  OPEN_PATH_RESUME_REFUSED: () =>
    resumeOpenPath(
      {
        kind: "product",
        save: { ...savedProduct(), terminalDigest: `sha256:${"a".repeat(64)}` },
      } as ProductResumeRequest,
      fixedHost,
    ),

  OPEN_PATH_SESSION_CLOSED: () => {
    const opened = bootstrapOpenPath(productRequest, fixedHost);
    if (!opened.ok) throw new Error(opened.reason);
    opened.value.close();
    return opened.value.session();
  },
};

function reasonOf(result: OrchestratorResult<unknown>) {
  if (result.ok) throw new Error("expected a refusal, got an ok result");
  return result.reason;
}

describe("orchestrator refuse matrix", () => {
  it("declares a case for exactly the reasons in the registry", () => {
    expect(Object.keys(CASES).sort()).toEqual(
      [...ORCHESTRATOR_REFUSAL_REASONS].sort(),
    );
  });

  it.each([...ORCHESTRATOR_REFUSAL_REASONS])("reaches %s", (reason) => {
    expect(reasonOf(CASES[reason]())).toBe(reason);
  });

  it("gives every reason a non-empty message and a frozen registry", () => {
    for (const reason of ORCHESTRATOR_REFUSAL_REASONS) {
      expect(ORCHESTRATOR_REFUSALS[reason].length).toBeGreaterThan(0);
    }
    expect(Object.isFrozen(ORCHESTRATOR_REFUSALS)).toBe(true);
  });

  it("carries the kernel's own message as detail when the kernel is the refuser", () => {
    const refused = CASES.OPEN_PATH_KERNEL_REFUSED();
    if (refused.ok) throw new Error("expected a refusal");
    expect(refused.detail).toContain("seed");

    const drifted = CASES.OPEN_PATH_RESUME_REFUSED();
    if (drifted.ok) throw new Error("expected a refusal");
    expect(drifted.detail).toContain("digest");

    // The orchestrator's own refusals carry no invented detail.
    const closed = CASES.OPEN_PATH_SESSION_CLOSED();
    if (closed.ok) throw new Error("expected a refusal");
    expect(closed.detail).toBeNull();
  });

  it("refuses every shape of unusable host before anything is opened", () => {
    expect(reasonOf(bootstrapOpenPath(productRequest, asHost(null)))).toBe(
      "OPEN_PATH_HOST_INVALID",
    );
    expect(
      reasonOf(bootstrapOpenPath(productRequest, { nowMs: () => Number.NaN })),
    ).toBe("OPEN_PATH_HOST_INVALID");
    expect(
      reasonOf(
        bootstrapOpenPath(productRequest, {
          nowMs: () => {
            throw new Error("clock unavailable");
          },
        }),
      ),
    ).toBe("OPEN_PATH_HOST_INVALID");

    // A digest that disagrees with the portable kernel digest would change
    // snapshot bytes, so it never reaches the kernel.
    const drifted = bootstrapOpenPath(productRequest, {
      nowMs: fixedHost.nowMs,
      digest: () => "0".repeat(64),
    });
    expect(reasonOf(drifted)).toBe("OPEN_PATH_HOST_INVALID");
    if (drifted.ok) return;
    expect(drifted.detail).toContain("digest");
  });

  it("refuses on the resume path with the same vocabulary as the open path", () => {
    expect(reasonOf(resumeOpenPath(asResumeRequest(null), fixedHost))).toBe(
      "OPEN_PATH_REQUEST_MALFORMED",
    );
    expect(
      reasonOf(
        resumeOpenPath(asResumeRequest({ kind: "worker-pool" }), fixedHost),
      ),
    ).toBe("OPEN_PATH_KIND_UNKNOWN");
    expect(
      reasonOf(
        resumeOpenPath(
          asResumeRequest({ kind: "scene", save: { scene: {} } }),
          fixedHost,
        ),
      ),
    ).toBe("OPEN_PATH_SUBJECT_UNIDENTIFIED");
  });

  it("never invokes an accessor while identifying a subject", () => {
    const hostile = bootstrapOpenPath(
      asOpenRequest({
        kind: "sculpt",
        artifact: Object.defineProperty({}, "artifactId", {
          get: () => {
            throw new Error("accessor must not run");
          },
        }),
        options: { seed: 1 },
      }),
      fixedHost,
    );
    expect(reasonOf(hostile)).toBe("OPEN_PATH_SUBJECT_UNIDENTIFIED");
  });
});
