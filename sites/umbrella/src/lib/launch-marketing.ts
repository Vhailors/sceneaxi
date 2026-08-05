/**
 * First-release marketing facts for the umbrella route (sceneaxi#203).
 *
 * This module is presentation data only and stays framework-free. It deliberately
 * contains no benchmark, ranking, installer name, release date, or shipping claim.
 */

export interface EngineComparison {
  readonly name: "SceneAxi" | "Unity" | "Godot" | "Three.js";
  readonly category: string;
  readonly bestWhen: string;
  readonly tradeoff: string;
  readonly source: Readonly<{ readonly label: string; readonly href: string }>;
}

export const ENGINE_COMPARISONS: readonly EngineComparison[] = Object.freeze([
  Object.freeze({
    name: "SceneAxi" as const,
    category: "Interactive engine and library with versioned profiles",
    bestWhen:
      "You want text-canonical scenes, reviewable proposals, and one contract across local tools, web surfaces, and the desktop app.",
    tradeoff:
      "The first release is intentionally narrower than an established general-purpose editor and platform-export ecosystem.",
    source: Object.freeze({ label: "SceneAxi contracts", href: "/docs" }),
  }),
  Object.freeze({
    name: "Unity" as const,
    category: "Full 2D and 3D engine, editor, and multiplatform ecosystem",
    bestWhen:
      "You need a mature visual editor, broad platform deployment, and a large games and real-time application ecosystem.",
    tradeoff:
      "SceneAxi is the smaller contract-first option when local files, proposal review, and agent-facing commands are the center of the workflow.",
    source: Object.freeze({
      label: "Unity Engine overview",
      href: "https://unity.com/products/unity-engine",
    }),
  }),
  Object.freeze({
    name: "Godot" as const,
    category: "Free, open-source 2D and 3D game engine",
    bestWhen:
      "You want an open-source general-purpose game engine with its own node, scene, scripting, editor, and export workflows.",
    tradeoff:
      "SceneAxi does not compete on editor breadth. It focuses on versioned profile scopes, deterministic evidence, and reviewed agent changes.",
    source: Object.freeze({
      label: "Godot Engine overview",
      href: "https://godotengine.org/",
    }),
  }),
  Object.freeze({
    name: "Three.js" as const,
    category: "JavaScript 3D rendering library for the web",
    bestWhen:
      "You want direct control over scenes, cameras, materials, and rendering inside a web application you assemble yourself.",
    tradeoff:
      "SceneAxi uses Three as its presentation core and adds artifacts, composition, profiles, review, and runtime contracts around it. It does not replace Three.",
    source: Object.freeze({
      label: "Three.js fundamentals",
      href: "https://threejs.org/manual/en/fundamentals.html",
    }),
  }),
]);

export interface LaunchProof {
  readonly id: "engine-access" | "local-byok" | "hosted-credits" | "kids-isolation";
  readonly title: string;
  readonly body: string;
  readonly href: string | null;
}

export const LAUNCH_PROOFS: readonly LaunchProof[] = Object.freeze([
  Object.freeze({
    id: "engine-access" as const,
    title: "Engine access is free",
    body: "The SDK archive, local CLI, docs, and public open path cost zero credits. The current 0.0.0 archive remains evaluation-only and is not registry-published.",
    href: "/engine",
  }),
  Object.freeze({
    id: "local-byok" as const,
    title: "Local and BYOK stay local",
    body: "Use the CLI with your provider key. Core has no live provider adapter and refuses missing policy, capability, or adapter instead of choosing a fallback.",
    href: "/docs",
  }),
  Object.freeze({
    id: "hosted-credits" as const,
    title: "Hosted AI is opt-in",
    body: "Hosted AI is opt-in and calls use credits through one metered path. A configured adapter or key never enables it by itself, and your files remain local when credits run out.",
    href: "/pricing",
  }),
  Object.freeze({
    id: "kids-isolation" as const,
    title: "Kids is structurally separate",
    body: "Kids has separate identity, storage, telemetry, and model routing. Third-party model defaults, commerce, identity, and cross-profile dependencies are denied.",
    href: null,
  }),
]);

export type ReleaseProfileId = "game" | "web" | "kids";

export interface ReleaseProfile {
  readonly id: ReleaseProfileId;
  readonly name: "Game" | "Web Experience" | "Kids";
  readonly state: "development-consumer" | "not-yet-claimed" | "refuse-only";
}

export interface ReleaseCapability {
  readonly capability: string;
  readonly values: Readonly<Record<ReleaseProfileId, string>>;
}

const profiles: readonly ReleaseProfile[] = Object.freeze([
  Object.freeze({
    id: "game" as const,
    name: "Game" as const,
    state: "development-consumer" as const,
  }),
  Object.freeze({
    id: "web" as const,
    name: "Web Experience" as const,
    state: "not-yet-claimed" as const,
  }),
  Object.freeze({
    id: "kids" as const,
    name: "Kids" as const,
    state: "refuse-only" as const,
  }),
]);

const capability = (
  name: string,
  game: string,
  web: string,
  kids: string,
): ReleaseCapability =>
  Object.freeze({
    capability: name,
    values: Object.freeze({ game, web, kids }),
  });

const capabilities: readonly ReleaseCapability[] = Object.freeze([
  capability(
    "Primary product scope",
    "Playable deterministic scenes",
    "Interactive scenes and site chrome",
    "Safety-scoped experiences",
  ),
  capability(
    "Open-path evidence",
    "Open, dispatch, advance, observe, save, and replay proven in a development demo",
    "Not yet claimed",
    "Refused by policy",
  ),
  capability(
    "Public consumption",
    "Versioned profile over the shared engine core",
    "Published package-root APIs with product-local glue",
    "No public route or cross-profile dependency",
  ),
  capability(
    "AI policy",
    "Local or BYOK; hosted is opt-in",
    "Local or BYOK; hosted is opt-in",
    "Third-party model defaults denied",
  ),
  capability(
    "Identity and commerce",
    "Outside the profile contract",
    "Owned by the separate site plane",
    "Identity and commerce denied",
  ),
  capability(
    "Current claim",
    "Development consumer, not a shipping claim",
    "Not yet claimed",
    "Refuse-only isolation boundary",
  ),
]);

export const PROFILE_RELEASE_MATRIX = Object.freeze({
  profiles,
  capabilities,
  shippingClaim: false as const,
});
