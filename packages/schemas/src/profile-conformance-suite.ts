/**
 * Shared Profile Conformance suite (v1).
 *
 * Generic: pass any ProfileConformanceSurface — no suite changes for future
 * profiles. Exercises kernel session + document propose/apply through the
 * profile's pinned core, and asserts evidence-hook presence.
 *
 * Only development-consumer claims are eligible to pass. not-yet-claimed
 * surfaces are refused (they must not be pointed at the suite to "claim"
 * readiness). shippingClaim is never true (enforced by claim validation).
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PROFILE_CONFORMANCE_SUITE_VERSION,
  PROFILE_ROLLOUT_ORDER_HELD_KEY,
  registryEntryFor,
  validateProfileConformanceClaim,
  type ProfileConformanceSurface,
} from "./profile-conformance.js";
import { KERNEL_SESSION_SCHEMA_VERSION } from "./kernel-session.js";
import { parseDocumentText } from "./document.js";

export type ConformanceCheckResult = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail?: string;
};

export type ConformanceSuiteResult = {
  readonly ok: boolean;
  readonly suiteVersion: typeof PROFILE_CONFORMANCE_SUITE_VERSION;
  readonly checks: ReadonlyArray<ConformanceCheckResult>;
};

function check(
  name: string,
  ok: boolean,
  detail?: string,
): ConformanceCheckResult {
  return detail === undefined ? { name, ok } : { name, ok, detail };
}

/**
 * Run the shared suite against a profile surface.
 * Safe to call from any package/app test; requires no suite modification
 * when a new profile package is added — only a new surface export.
 */
export function runProfileConformanceSuite(
  surface: ProfileConformanceSurface,
): ConformanceSuiteResult {
  const checks: ConformanceCheckResult[] = [];

  const claimResult = validateProfileConformanceClaim(surface.claim);
  checks.push(
    check(
      "claim-validates",
      claimResult.ok,
      claimResult.ok ? undefined : claimResult.message,
    ),
  );
  if (!claimResult.ok) {
    return fail(checks);
  }

  const claim = claimResult.claim;

  checks.push(
    check(
      "claim-status-development-consumer",
      claim.claimStatus === "development-consumer",
      claim.claimStatus === "development-consumer"
        ? undefined
        : `Suite only passes development-consumer claims; got "${claim.claimStatus}". not-yet-claimed profiles must not be suite-claimed.`,
    ),
  );

  checks.push(
    check(
      "shipping-claim-false",
      claim.shippingClaim === false,
      "shippingClaim must be false — no rollout/publication from this suite",
    ),
  );

  checks.push(
    check(
      "cites-profile-rollout-order",
      claim.heldKeysCited.includes(PROFILE_ROLLOUT_ORDER_HELD_KEY),
      `heldKeysCited must include open key ${PROFILE_ROLLOUT_ORDER_HELD_KEY}`,
    ),
  );

  checks.push(
    check(
      "suite-version",
      claim.suiteVersion === PROFILE_CONFORMANCE_SUITE_VERSION,
    ),
  );

  checks.push(
    check(
      "seam-name-matches-claim",
      surface.seam.name === claim.profile,
      `seam.name ${surface.seam.name} !== claim.profile ${claim.profile}`,
    ),
  );

  checks.push(
    check(
      "seam-release-group-profile",
      surface.seam.releaseGroup === "profile",
    ),
  );

  checks.push(
    check(
      "core-pin-real-range",
      typeof claim.corePin === "string" &&
        claim.corePin.length > 0 &&
        /[\d*]/.test(claim.corePin) &&
        surface.seam.corePin === claim.corePin,
      `corePin must be a real semver range; claim=${claim.corePin} seam=${surface.seam.corePin}`,
    ),
  );

  const registry = registryEntryFor(claim.profile);
  checks.push(
    check(
      "registry-row-matches",
      registry !== undefined &&
        registry.claimStatus === claim.claimStatus &&
        registry.shippingClaim === false &&
        registry.openHeldKey === PROFILE_ROLLOUT_ORDER_HELD_KEY,
      registry
        ? `registry claimStatus=${registry.claimStatus}`
        : `no registry row for ${claim.profile}`,
    ),
  );

  // Evidence-hook presence (declared hooks on claim + surface).
  const surfaceHooks = surface.core.evidenceHooks;
  checks.push(
    check(
      "evidence-hooks-present",
      surfaceHooks.present === true &&
        surfaceHooks.hooks.length > 0 &&
        claim.evidenceHooks.present === true &&
        claim.evidenceHooks.hooks.length > 0,
    ),
  );
  const hookNames = new Set(surfaceHooks.hooks.map((h) => h.name));
  checks.push(
    check(
      "evidence-hook-kernel-session-save",
      hookNames.has("kernel-session-save"),
    ),
  );
  checks.push(
    check("evidence-hook-document-apply", hookNames.has("document-apply")),
  );

  // Kernel session through the profile's pinned core.
  try {
    const host = fixedHost(1_000);
    const manifest = Object.freeze({
      productId: "profile-conformance",
      seed: 7,
      entities: Object.freeze([
        Object.freeze({ id: "player", x: 0, y: 0 }),
      ]),
    });
    const session = surface.core.kernel.open(manifest, host);
    const before = session.observe();
    session.dispatch({ type: "move", actor: "player", axis: [2, 0] });
    const afterDispatch = session.observe();
    checks.push(
      check(
        "kernel-dispatch-does-not-mutate",
        afterDispatch.digest === before.digest,
      ),
    );
    session.advance({ tick: 1, deltaMs: 16 });
    const afterAdvance = session.observe();
    checks.push(
      check(
        "kernel-advance-mutates",
        afterAdvance.digest !== before.digest && afterAdvance.tick === 1,
      ),
    );
    checks.push(
      check(
        "kernel-entity-moved",
        afterAdvance.entities.some((e) => e.id === "player" && e.x === 2 && e.y === 0),
      ),
    );

    const artifact = session.save();
    checks.push(
      check(
        "kernel-save-stamps-versions",
        artifact.schemaVersion === KERNEL_SESSION_SCHEMA_VERSION &&
          artifact.kernelVersion === surface.core.kernel.KERNEL_VERSION &&
          artifact.bomVersion === surface.core.kernel.BOM_VERSION &&
          artifact.terminalDigest === afterAdvance.digest,
      ),
    );

    const replayed = surface.core.kernel.replay(artifact, fixedHost(2_000));
    checks.push(
      check(
        "kernel-save-replay-digest",
        replayed.observe().digest === afterAdvance.digest,
      ),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    checks.push(check("kernel-session-seam", false, message));
  }

  // Document propose/apply through the profile's pinned core.
  let tempDir: string | undefined;
  try {
    tempDir = mkdtempSync(join(tmpdir(), "sceneaxi-profile-conformance-"));
    const docName = "scene.json";
    const doc = surface.core.authoring.createDocument({
      id: "conformance-scene",
      data: { entities: [{ id: "hero", x: 0, y: 0 }] },
    });
    const abs = join(tempDir, docName);
    const written = surface.core.authoring.writeDocumentFile(abs, doc);
    checks.push(check("document-write", written.ok === true));

    const proposed = surface.core.authoring.propose({
      documentPath: docName,
      jsonPointer: "/data/entities/0/x",
      newValue: 10,
      cwd: tempDir,
    });
    checks.push(
      check(
        "document-propose",
        proposed.ok === true,
        proposed.ok
          ? undefined
          : proposed.diagnostics.map((d) => d.message).join("; "),
      ),
    );

    if (proposed.ok) {
      checks.push(
        check(
          "document-propose-diff",
          typeof proposed.unifiedDiff === "string" &&
            proposed.unifiedDiff.includes("scene.json"),
        ),
      );

      const applied = surface.core.authoring.apply({
        proposal: proposed.proposal,
        cwd: tempDir,
      });
      checks.push(
        check(
          "document-apply",
          applied.ok === true,
          applied.ok
            ? undefined
            : "diagnostics" in applied && Array.isArray(applied.diagnostics)
              ? JSON.stringify(applied.diagnostics)
              : "apply refused",
        ),
      );

      if (applied.ok) {
        const text = readFileSync(abs, "utf8");
        const parsed = parseDocumentText(text);
        checks.push(check("document-reparse", parsed.ok === true));
        if (parsed.ok) {
          const entities = parsed.document.data["entities"];
          const first =
            Array.isArray(entities) && entities[0] !== undefined
              ? (entities[0] as { x?: unknown })
              : undefined;
          checks.push(
            check(
              "document-apply-mutated-pointer",
              first?.x === 10,
              `expected x=10, got ${JSON.stringify(first)}`,
            ),
          );
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    checks.push(check("document-propose-apply-seam", false, message));
  } finally {
    if (tempDir !== undefined) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }

  return {
    ok: checks.every((c) => c.ok),
    suiteVersion: PROFILE_CONFORMANCE_SUITE_VERSION,
    checks: Object.freeze(checks),
  };
}

function fail(checks: ConformanceCheckResult[]): ConformanceSuiteResult {
  return {
    ok: false,
    suiteVersion: PROFILE_CONFORMANCE_SUITE_VERSION,
    checks: Object.freeze(checks),
  };
}

function fixedHost(startMs: number): { nowMs: () => number } {
  let t = startMs;
  return {
    nowMs: () => {
      const v = t;
      t += 1;
      return v;
    },
  };
}
