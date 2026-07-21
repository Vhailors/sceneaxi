/**
 * Held-key gate: the fail-closed currency check + refusal table from
 * docs/held-key-enforcement.md, evaluated by the dispatcher for EVERY verb.
 *
 * For a gated verb the live authoritative epoch is established FIRST (trusted
 * epoch sentinel); only then do local snapshot/map rules run. There is no
 * offline exception, no signed-offline-marker path, and no env flag that can
 * reopen an allow path: nothing in this module reads process.env.
 */

import {
  validateCommandMap,
  validateRegistrySnapshot,
} from "./registry.js";
import { SHIPPED_COMMAND_MAP } from "./shipped.js";

/** Result of probing the trusted epoch sentinel. */
export type EpochProbe =
  | { readonly available: true; readonly epoch: number }
  | { readonly available: false; readonly reason: string };

/** Trusted authority for the current registry epoch (test doubles in fixtures). */
export interface EpochAuthority {
  readonly description: string;
  readonly probe: () => EpochProbe;
}

/** Authority double that reports a fixed authoritative epoch. */
export function staticEpochAuthority(epoch: number): EpochAuthority {
  return {
    description: `static epoch authority (epoch ${epoch})`,
    probe: () => ({ available: true, epoch }),
  };
}

/** Authority that can never establish currency — the fail-closed default. */
export function unavailableEpochAuthority(
  reason = "no trusted epoch sentinel configured",
): EpochAuthority {
  return {
    description: "unavailable epoch authority",
    probe: () => ({ available: false, reason }),
  };
}

/** Default snapshot freshness budget (docs/held-key-enforcement.md): 24h. */
export const DEFAULT_FRESHNESS_BUDGET_MS = 24 * 60 * 60 * 1000;

/** Everything the gate needs; injectable so tests are fixture-driven. */
export interface HeldKeyRuntime {
  /** CLI command map (validated fail-closed at evaluation time). */
  readonly commandMap: unknown;
  /** Held-key registry snapshot; undefined means no snapshot is present. */
  readonly snapshot: unknown;
  readonly authority: EpochAuthority;
  /** Clock in epoch milliseconds (injectable for freshness tests). */
  readonly now: () => number;
  readonly freshnessBudgetMs?: number;
}

/** Machine-readable refusal-table rows (docs/held-key-enforcement.md). */
export type HeldKeyRefusalReason =
  | "command-map-invalid"
  | "verb-undeclared"
  | "currency-unavailable"
  | "authoritative-epoch-mismatch"
  | "snapshot-missing"
  | "snapshot-invalid"
  | "snapshot-stale"
  | "map-snapshot-epoch-mismatch"
  | "unknown-held-key"
  | "open-held-key";

export interface GateAllow {
  readonly allow: true;
  readonly mode: "ungated" | "gated";
  readonly checkedKeys: readonly string[];
}

export interface GateRefusal {
  readonly allow: false;
  readonly reason: HeldKeyRefusalReason;
  readonly message: string;
  /** The gating key at fault, when one can be named (open/unknown key). */
  readonly heldKey?: string;
}

export type GateDecision = GateAllow | GateRefusal;

function refuse(
  reason: HeldKeyRefusalReason,
  message: string,
  heldKey?: string,
): GateRefusal {
  return {
    allow: false,
    reason,
    message,
    ...(heldKey === undefined ? {} : { heldKey }),
  };
}

/**
 * Evaluate the held-key gate for a full verb path (e.g. "demo gated").
 *
 * Check order: map validity → declaration → (ungated shortcut) → currency
 * BEFORE local rules → snapshot presence/validity/epochs/freshness → per-key
 * unknown/open. Allow only on all-resolved + currency OK.
 */
export function evaluateHeldKeyGate(
  verbPath: string,
  runtime: HeldKeyRuntime,
): GateDecision {
  const mapValidation = validateCommandMap(runtime.commandMap);
  if (!mapValidation.ok) {
    return refuse(
      "command-map-invalid",
      `CLI command map is missing or invalid (${mapValidation.errors[0] ?? "unknown error"}); cannot establish whether '${verbPath}' is gated, so it refuses`,
    );
  }
  const map = mapValidation.value;

  const entry = map.commands.find((c) => c.command === verbPath);
  if (entry === undefined) {
    return refuse(
      "verb-undeclared",
      `Verb '${verbPath}' is not declared in the CLI command map; undeclared verbs refuse (explicit heldKeys: [] is the only way to be ungated)`,
    );
  }

  if (entry.heldKeys.length === 0) {
    // Explicitly ungated: no currency check, and no product policy encoded.
    return { allow: true, mode: "ungated", checkedKeys: [] };
  }

  // Currency check FIRST — before any local snapshot/map rule.
  let probe: EpochProbe;
  try {
    probe = runtime.authority.probe();
  } catch (err) {
    probe = {
      available: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  if (!probe.available) {
    return refuse(
      "currency-unavailable",
      `Cannot establish the current authoritative registry epoch (${probe.reason}); held-key-gated verbs refuse without currency — matching local epochs are never sufficient`,
    );
  }
  if (probe.epoch !== map.builtForRegistryEpoch) {
    return refuse(
      "authoritative-epoch-mismatch",
      `Authoritative registry epoch is ${probe.epoch} but this CLI's command map was built for epoch ${map.builtForRegistryEpoch}; stale client must refresh its snapshot and map`,
    );
  }

  if (runtime.snapshot === undefined || runtime.snapshot === null) {
    return refuse(
      "snapshot-missing",
      `No held-key registry snapshot is present; gated verb '${verbPath}' refuses`,
    );
  }
  const snapshotValidation = validateRegistrySnapshot(runtime.snapshot);
  if (!snapshotValidation.ok) {
    return refuse(
      "snapshot-invalid",
      `Held-key registry snapshot is invalid (${snapshotValidation.errors[0] ?? "unknown error"}); gated verbs refuse`,
    );
  }
  const snapshot = snapshotValidation.value;

  const budget = runtime.freshnessBudgetMs ?? DEFAULT_FRESHNESS_BUDGET_MS;
  const age = runtime.now() - Date.parse(snapshot.generatedAt);
  if (age > budget) {
    return refuse(
      "snapshot-stale",
      `Held-key registry snapshot generated at ${snapshot.generatedAt} exceeds the freshness budget (${String(budget)}ms); refresh the snapshot`,
    );
  }

  if (snapshot.registryEpoch !== map.builtForRegistryEpoch) {
    return refuse(
      "map-snapshot-epoch-mismatch",
      `Command map was built for registry epoch ${map.builtForRegistryEpoch} but the snapshot is epoch ${snapshot.registryEpoch}; regenerate both for the same epoch`,
    );
  }

  const byKey = new Map(snapshot.keys.map((k) => [k.key, k]));
  for (const key of entry.heldKeys) {
    if (!byKey.has(key)) {
      return refuse(
        "unknown-held-key",
        `Verb '${verbPath}' is gated by key '${key}', which is unknown to the registry snapshot; unknown keys refuse`,
        key,
      );
    }
  }
  for (const key of entry.heldKeys) {
    const record = byKey.get(key);
    if (record !== undefined && record.state === "open") {
      return refuse(
        "open-held-key",
        `Verb '${verbPath}' is gated by open captain hold '${key}' (${record.title}); resolve the hold, refresh the snapshot, then retry`,
        key,
      );
    }
  }

  return { allow: true, mode: "gated", checkedKeys: entry.heldKeys };
}

/**
 * Production default: the shipped command map, no snapshot, and no trusted
 * epoch sentinel — so every gated verb refuses out of the box (fail closed)
 * until a real sentinel and a freshly exported snapshot are wired.
 */
export function defaultHeldKeyRuntime(): HeldKeyRuntime {
  return {
    commandMap: SHIPPED_COMMAND_MAP,
    snapshot: undefined,
    authority: unavailableEpochAuthority(
      "no trusted epoch sentinel is wired in the bootstrap CLI",
    ),
    now: () => Date.now(),
  };
}
