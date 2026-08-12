/**
 * The command map shipped with this CLI build (cli-command-map.schema.json).
 *
 * Every verb in the live command tree MUST be declared here — an undeclared
 * verb refuses at dispatch (tests enforce full coverage). `heldKeys: []` is an
 * explicit ungated declaration; the ungated verbs encode no product policy.
 * That stays true as verbs gain real bodies: authoring, composition, and the
 * read-only listings are all free, offline, and unmetered, so none of them
 * acquires a gate by becoming runnable. The only gated verb is the held-key
 * protocol demo, gated by SYNTHETIC fixture keys: no real captain hold is
 * named, resolved, or invented here (the 24+10 real holds live in the
 * FirstMate backlog, exported per docs/held-key-enforcement.md).
 */

import { CLI_VERSION } from "../version.js";
import type { CliCommandMap } from "./registry.js";

/** Synthetic gating keys for `demo gated` — fixtures only, never real holds. */
export const SYNTHETIC_DEMO_KEYS: readonly string[] = Object.freeze([
  "synthetic-demo-alpha",
  "synthetic-demo-beta",
]);

export const SHIPPED_COMMAND_MAP: CliCommandMap = Object.freeze({
  schemaVersion: 1,
  builtForRegistryEpoch: 1,
  cliVersion: CLI_VERSION,
  commands: Object.freeze([
    { command: "project new", heldKeys: [] },
    { command: "project dev", heldKeys: [] },
    { command: "project test", heldKeys: [] },
    { command: "project capture", heldKeys: [] },
    { command: "project report", heldKeys: [] },
    { command: "project propose", heldKeys: [] },
    { command: "project apply", heldKeys: [] },
    { command: "scene compose", heldKeys: [] },
    { command: "asset list", heldKeys: [] },
    { command: "asset import", heldKeys: [] },
    { command: "asset reload", heldKeys: [] },
    { command: "profile list", heldKeys: [] },
    { command: "profile open-path", heldKeys: [] },
    { command: "catalog list", heldKeys: [] },
    { command: "evidence list", heldKeys: [] },
    { command: "desktop bridge call", heldKeys: [] },
    { command: "desktop bridge status", heldKeys: [] },
    { command: "desktop bridge tools", heldKeys: [] },
    { command: "demo gated", heldKeys: SYNTHETIC_DEMO_KEYS },
    { command: "protocol version", heldKeys: [] },
    { command: "protocol inspect", heldKeys: [] },
  ]),
}) as CliCommandMap;
