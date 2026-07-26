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
 * - a provider's output is snapshotted and then re-validated against the public
 *   Sculpt Intake contract here, so a malformed intake refuses at the boundary
 *   instead of entering the pipeline, and a returned intake is a frozen document
 *   the provider can no longer reach.
 *
 * Adding a capability is a reviewed contract change (see docs/plugins.md); this
 * module owns the one contract that exists.
 */

import { snapshotSculptJson } from "./sculpt-json.js";
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

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Read every provider-declared field of a candidate source exactly once.
 *
 * The declared fields may be accessors, so a later re-read can answer something
 * the contract check never saw. Reading them into a plain snapshot here means
 * the shape check, the mode gate, and the call all agree on one set of values.
 * `produceIntake` is looked up through the candidate so a prototype-backed
 * implementation still resolves, and is invoked with its own receiver below.
 */
function readSourceFields(candidate: unknown): unknown {
  if (!isRecord(candidate)) return candidate;
  const modes = candidate["supportedModes"];
  return {
    capabilityId: candidate["capabilityId"],
    contractVersion: candidate["contractVersion"],
    supportedModes: Array.isArray(modes) ? [...(modes as unknown[])] : modes,
    produceIntake: candidate["produceIntake"],
  };
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
 *
 * The provider's document is snapshotted before it is validated, so what the
 * contract accepts is exactly what the caller receives: accessors are collapsed
 * to the values they answered once, and the returned intake is frozen and
 * detached from any reference the provider kept.
 *
 * The request travels the same way in reverse. The provider is handed a frozen
 * copy, never the caller's own object, and the echo invariant is enforced
 * against the identity and mode captured before the call — so a provider cannot
 * rewrite the question it is being graded against.
 */
export function requestSculptIntake(
  source: SculptIntakeSource,
  request: SculptIntakeSourceRequest,
): SculptIntakeSourceResult {
  const wanted: SculptIntakeSourceRequest = Object.freeze({
    intakeId: request.intakeId,
    mode: request.mode,
  });

  let declared: unknown;
  try {
    declared = readSourceFields(source);
  } catch (error) {
    return refuse(
      "source-invalid",
      `Capability implementation could not be inspected: ${describeError(error, "reading a declared field threw.")}`,
    );
  }

  const contract = checkSculptIntakeSourceImplementation(declared);
  if (!contract.ok) {
    return refuse("source-invalid", contract.message);
  }
  const fields = declared as {
    readonly supportedModes: readonly SculptIntakeMode[];
    readonly produceIntake: SculptIntakeSource["produceIntake"];
  };

  if (!fields.supportedModes.includes(wanted.mode)) {
    return refuse(
      "unsupported-mode",
      `Provider does not support intake mode "${wanted.mode}".`,
    );
  }

  let produced: unknown;
  try {
    produced = Reflect.apply(fields.produceIntake, source, [wanted]);
  } catch (error) {
    return refuse(
      "provider-threw",
      `produceIntake threw: ${describeError(error, "produceIntake threw.")}`,
    );
  }

  let envelope: {
    readonly ok: unknown;
    readonly message: unknown;
    readonly intake: unknown;
  };
  try {
    envelope = isRecord(produced)
      ? {
          ok: produced["ok"],
          message: produced["message"],
          intake: produced["intake"],
        }
      : { ok: undefined, message: undefined, intake: undefined };
  } catch (error) {
    return refuse(
      "malformed-result",
      `produceIntake result could not be read: ${describeError(error, "reading a result field threw.")}`,
    );
  }

  if (typeof envelope.ok !== "boolean") {
    return refuse(
      "malformed-result",
      "produceIntake must return a { ok } result envelope.",
    );
  }

  if (!envelope.ok) {
    const message = envelope.message;
    return refuse(
      "request-refused",
      typeof message === "string" && message.length > 0
        ? message
        : "Provider refused the intake request.",
    );
  }

  let candidate: unknown;
  try {
    candidate = snapshotSculptJson(envelope.intake);
  } catch (error) {
    return refuse(
      "malformed-result",
      `Produced intake could not be captured as a plain document: ${describeError(error, "intake could not be captured.")}`,
    );
  }

  const validated = validateSculptIntake(candidate);
  if (!validated.ok) {
    const first = validated.diagnostics[0];
    return refuse(
      "intake-invalid",
      `Produced intake failed the Sculpt Intake contract: ${first?.message ?? "unknown diagnostic"}`,
    );
  }

  if (validated.value.intakeId !== wanted.intakeId) {
    return refuse(
      "intake-mismatch",
      `Produced intakeId "${validated.value.intakeId}" does not echo requested "${wanted.intakeId}".`,
    );
  }
  if (validated.value.mode !== wanted.mode) {
    return refuse(
      "intake-mismatch",
      `Produced mode "${validated.value.mode}" does not match requested "${wanted.mode}".`,
    );
  }

  return { ok: true, intake: validated.value };
}
