/**
 * The built loopback shell's deterministic assistant wiring.
 *
 * The product seam remains `createAssistantPanel`: this module only supplies
 * the recorded adapter and the other injected values needed to make the
 * startable local surface useful without a provider package, a credential, or
 * a network. Hosted mode is deliberately left at billing's default-off value
 * and has no principal, ledger view, or store wired here.
 */

import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  createModelProviderPort,
} from "@sceneaxi/authoring-core";
import {
  ADMIN_EMAIL_ENV_VAR,
  resolveAdminIdentity,
} from "@sceneaxi/auth";
import {
  createAssistantPanel,
  ASSISTANT_PANEL_REASONS,
  type CreateAssistantPanelResult,
} from "./assistant-panel.js";
import type { ModelDescriptor } from "@sceneaxi/schemas";

/** The pinned model evidence carried by every default fixture completion. */
const DEFAULT_ASSISTANT_MODEL: ModelDescriptor = Object.freeze({
  model: "openai/gpt-fixture-2026-07-24",
  provider: "openrouter",
  quantization: "provider-default-pinned",
  version: "2026-07-24",
});

const DEFAULT_ASSISTANT_ADAPTER = Object.freeze({
  routeKind: "third-party" as const,
  capabilities: Object.freeze({
    schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
    operations: Object.freeze(["complete"] as const),
  }),
  complete: () =>
    Object.freeze({
      response: Object.freeze({
        schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
        operation: "complete" as const,
        text: "fixture completion",
        finishReason: "stop" as const,
      }),
      executedModel: DEFAULT_ASSISTANT_MODEL,
    }),
});

/**
 * Resolve the existing identity seam for the panel's common options.
 *
 * A fixture turn never enters an auth guard, so a local shell without an
 * identity environment does not need a bootstrap setting just to try the
 * recorded route. If an operator did configure the single-admin environment,
 * it is still resolved (and any plural/invalid configuration still refuses)
 * rather than bypassing the identity package with a hand-built object.
 */
function fixtureAdminEnvironment() {
  const adminEmail = process.env[ADMIN_EMAIL_ENV_VAR];
  return {
    [ADMIN_EMAIL_ENV_VAR]: adminEmail ?? "fixture@sceneaxi.invalid",
    ...(process.env.SCENEAXI_ADMIN_EMAILS === undefined
      ? {}
      : { SCENEAXI_ADMIN_EMAILS: process.env.SCENEAXI_ADMIN_EMAILS }),
    ...(process.env.SCENEAXI_ADMINS === undefined
      ? {}
      : { SCENEAXI_ADMINS: process.env.SCENEAXI_ADMINS }),
  };
}

/**
 * Build the panel used when the binary is started without an injected panel.
 *
 * The returned panel offers the fixture route by default. Hosted is wired only
 * far enough for its explicit default-off refusal; it cannot reach a credit
 * store because this local fixture has no store wired. A BYO port is supplied
 * by callers that have an explicit provider injection, never by this binary.
 */
export function createDefaultAssistantPanel(): CreateAssistantPanelResult {
  const admin = resolveAdminIdentity(fixtureAdminEnvironment());
  if (!admin.ok) {
    return Object.freeze({
      ok: false,
      reason: ASSISTANT_PANEL_REASONS.adminIdentityMissing,
      message: admin.message,
    });
  }

  const port = createModelProviderPort({
    adapter: DEFAULT_ASSISTANT_ADAPTER,
    profilePolicies: {
      "@sceneaxi/profile-web": () => ({ ok: true }),
    },
  });

  return createAssistantPanel({
    surface: "web-shell",
    profile: "@sceneaxi/profile-web",
    model: DEFAULT_ASSISTANT_MODEL,
    ports: { fixture: port, hosted: port },
    admin: admin.value,
    clock: () => Date.now(),
  });
}
