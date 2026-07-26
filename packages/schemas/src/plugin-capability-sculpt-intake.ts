/**
 * Public capability contract: Sculpt Intake Source (v1) — ADR 0005 / sceneaxi#135.
 *
 * This is the first **registered** plugin capability. A provider turns its own
 * plugin-local knowledge into a Sculpt Intake document, the already-public
 * pipeline entry contract (`contracts/sculpt-intake.schema.json`). The capability
 * is deliberately narrow:
 *
 * - data in, data out — no lifecycle hook, no engine handle, no service locator;
 * - the host never calls a provider on its own, so loading stays inert until a
 *   caller asks for an intake;
 * - a provider's output is re-validated against the public Sculpt Intake contract
 *   here, so a malformed intake refuses at the boundary instead of entering the
 *   pipeline.
 *
 * Adding a capability is a reviewed contract change (see docs/plugins.md); this
 * module owns the one contract that exists.
 */

import {
  SCULPT_INTAKE_MODES,
  isSculptIntakeMode,
  validateSculptIntake,
  type SculptIntake,
  type SculptIntakeMode,
} from "./sculpt.js";

/** Registered capability ID. Exactly this string appears in the seed registry. */
export const SCULPT_INTAKE_SOURCE_CAPABILITY_ID =
  "sceneaxi.sculpt.intake-source.v1" as const;

/** Exact capability contract version pinned by the registry row. */
export const SCULPT_INTAKE_SOURCE_CONTRACT_VERSION = "1.0.0" as const;

/** Public document contract a provider must produce. */
export const SCULPT_INTAKE_SOURCE_CONTRACT_REF =
  "contracts/sculpt-intake.schema.json" as const;

/** Package owning the capability contract. */
export const SCULPT_INTAKE_SOURCE_OWNING_PACKAGE = "@sceneaxi/schemas" as const;

export type SculptIntakeSourceRequest = {
  /** Caller-chosen intake identity; the provider must echo it exactly. */
  readonly intakeId: string;
  /** Intake mode the caller wants. */
  readonly mode: SculptIntakeMode;
};

export type SculptIntakeSourceRefusalReason =
  /** Implementation does not satisfy the capability contract shape. */
  | "source-invalid"
  /** Provider does not support the requested mode. */
  | "unsupported-mode"
  /** Provider rejected the request itself (e.g. unknown intake identity). */
  | "request-refused"
  /** Provider returned something that is not a result envelope. */
  | "malformed-result"
  /** Provider returned an intake that fails the public Sculpt Intake contract. */
  | "intake-invalid"
  /** Provider returned an intake whose identity or mode drifts from the request. */
  | "intake-mismatch"
  /** Provider threw while producing the intake. */
  | "provider-threw";

export type SculptIntakeSourceOk = {
  readonly ok: true;
  readonly intake: SculptIntake;
};

export type SculptIntakeSourceRefuse = {
  readonly ok: false;
  readonly reason: SculptIntakeSourceRefusalReason;
  readonly message: string;
};

export type SculptIntakeSourceResult =
  | SculptIntakeSourceOk
  | SculptIntakeSourceRefuse;

/**
 * Implementation shape a plugin exports under the registered capability ID.
 * `produceIntake` is pure data-to-data; the host never invokes it.
 */
export type SculptIntakeSource = {
  readonly capabilityId: typeof SCULPT_INTAKE_SOURCE_CAPABILITY_ID;
  readonly contractVersion: string;
  readonly supportedModes: readonly SculptIntakeMode[];
  readonly produceIntake: (
    request: SculptIntakeSourceRequest,
  ) => SculptIntakeSourceResult;
};

export type SculptIntakeSourceContractCheckOk = { readonly ok: true };

export type SculptIntakeSourceContractCheckRefuse = {
  readonly ok: false;
  readonly message: string;
};

export type SculptIntakeSourceContractCheckResult =
  | SculptIntakeSourceContractCheckOk
  | SculptIntakeSourceContractCheckRefuse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function violation(message: string): SculptIntakeSourceContractCheckRefuse {
  return { ok: false, message };
}

/**
 * Structural check of a capability implementation against this contract.
 *
 * Shaped as a Plugin Host capability-contract check: bind it to
 * `SCULPT_INTAKE_SOURCE_CAPABILITY_ID` so a provider that declares the ID but
 * exports the wrong shape refuses at load instead of at first call.
 */
export function checkSculptIntakeSourceImplementation(
  implementation: unknown,
): SculptIntakeSourceContractCheckResult {
  if (!isRecord(implementation)) {
    return violation(
      `Capability "${SCULPT_INTAKE_SOURCE_CAPABILITY_ID}" implementation must be an object.`,
    );
  }

  if (implementation["capabilityId"] !== SCULPT_INTAKE_SOURCE_CAPABILITY_ID) {
    return violation(
      `Implementation must declare capabilityId "${SCULPT_INTAKE_SOURCE_CAPABILITY_ID}".`,
    );
  }

  if (implementation["contractVersion"] !== SCULPT_INTAKE_SOURCE_CONTRACT_VERSION) {
    return violation(
      `Implementation must pin contractVersion "${SCULPT_INTAKE_SOURCE_CONTRACT_VERSION}".`,
    );
  }

  const supportedModes = implementation["supportedModes"];
  if (!Array.isArray(supportedModes) || supportedModes.length === 0) {
    return violation("supportedModes must be a non-empty array of intake modes.");
  }
  const seen = new Set<string>();
  for (const mode of supportedModes) {
    if (!isSculptIntakeMode(mode)) {
      return violation(
        `supportedModes entries must be Sculpt Intake modes (${SCULPT_INTAKE_MODES.join(", ")}).`,
      );
    }
    if (seen.has(mode)) {
      return violation(`supportedModes contains duplicate mode "${mode}".`);
    }
    seen.add(mode);
  }

  if (typeof implementation["produceIntake"] !== "function") {
    return violation("produceIntake must be a function.");
  }

  return { ok: true };
}

function refuse(
  reason: SculptIntakeSourceRefusalReason,
  message: string,
): SculptIntakeSourceRefuse {
  return { ok: false, reason, message };
}

/**
 * Call a loaded provider and validate its output against the public contract.
 *
 * Callers use this instead of invoking `produceIntake` directly: a provider can
 * be the wrong shape entirely, refuse, throw, or answer with a malformed intake,
 * and every one of those is a typed refusal here rather than a throw or an
 * invalid document downstream. The shape is re-checked here because a host that
 * binds no contract check for the capability still hands back whatever the
 * plugin exported.
 */
export function requestSculptIntake(
  source: SculptIntakeSource,
  request: SculptIntakeSourceRequest,
): SculptIntakeSourceResult {
  const contract = checkSculptIntakeSourceImplementation(source);
  if (!contract.ok) {
    return refuse("source-invalid", contract.message);
  }

  if (!source.supportedModes.includes(request.mode)) {
    return refuse(
      "unsupported-mode",
      `Provider does not support intake mode "${request.mode}".`,
    );
  }

  let produced: unknown;
  try {
    produced = source.produceIntake(request);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "produceIntake threw.";
    return refuse("provider-threw", `produceIntake threw: ${message}`);
  }

  if (!isRecord(produced) || typeof produced["ok"] !== "boolean") {
    return refuse(
      "malformed-result",
      "produceIntake must return a { ok } result envelope.",
    );
  }

  if (produced["ok"] === false) {
    const message = produced["message"];
    return refuse(
      "request-refused",
      typeof message === "string" && message.length > 0
        ? message
        : "Provider refused the intake request.",
    );
  }

  const validated = validateSculptIntake(produced["intake"]);
  if (!validated.ok) {
    const first = validated.diagnostics[0];
    return refuse(
      "intake-invalid",
      `Produced intake failed the Sculpt Intake contract: ${first?.message ?? "unknown diagnostic"}`,
    );
  }

  if (validated.value.intakeId !== request.intakeId) {
    return refuse(
      "intake-mismatch",
      `Produced intakeId "${validated.value.intakeId}" does not echo requested "${request.intakeId}".`,
    );
  }
  if (validated.value.mode !== request.mode) {
    return refuse(
      "intake-mismatch",
      `Produced mode "${validated.value.mode}" does not match requested "${request.mode}".`,
    );
  }

  return { ok: true, intake: validated.value };
}
