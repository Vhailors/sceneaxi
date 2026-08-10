/**
 * @sceneaxi/desktop-linux — the packaged Linux desktop application (ADR 0024).
 *
 * Electron packaging over the Engine Desktop chrome from `@sceneaxi/desktop-shell`
 * and the real engine stack: `composeScene()` composition, the orchestrated kernel
 * open path, the one Three presentation core in the renderer process, and the
 * shared authoring propose/accept session. This package adds packaging and one
 * narrow bridge seam; it duplicates no editor state machine, no visual token, and
 * no kernel behaviour.
 *
 * Everything under `src/lib/` is pure TypeScript proven by `pnpm gate` from
 * `tests/desktop/` and `tests/e2e/`; only `src/electron/` may import Electron
 * (enforced by `pnpm check:desktop`), and `src/renderer/` runs in the window.
 */
import type { PackageSeam } from "@sceneaxi/schemas";

export const seam: PackageSeam = Object.freeze({
  name: "@sceneaxi/desktop-linux",
  releaseGroup: "desktop",
});

export {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_BRIDGE_ASSISTANT_OPS,
  DESKTOP_BRIDGE_AUTHORING_OPS,
  DESKTOP_BRIDGE_CHANNEL,
  DESKTOP_BRIDGE_GLOBAL,
  DESKTOP_BRIDGE_REFUSALS,
  DESKTOP_RARITY_EVENT_ID,
  DESKTOP_RARITY_PROPOSAL_EVENT,
  DESKTOP_VIEWPORT_PLAY_EVENT,
  bridgeOk,
  bridgeRefuse,
  type DesktopBridgeAction,
  type DesktopBridgeAssistantOp,
  type DesktopAssistantMountedResult,
  type DesktopAssistantResult,
  type DesktopAssistantJobSnapshot,
  type DesktopBridgeAuthoringOp,
  type DesktopBridgeHandshake,
  type DesktopBridgeOk,
  type DesktopBridgeRefusal,
  type DesktopBridgeRefusalReason,
  type DesktopBridgeRequest,
  type DesktopBridgeResponse,
  type DesktopFrameReport,
  type DesktopRarityEvidence,
  type DesktopRarityProposalResult,
  type DesktopRarityRetirementReason,
} from "./lib/bridge-contract.js";

export {
  OPEN_PATH_EXERCISE_TICKS,
  createDesktopBridge,
  type DesktopBridge,
  type DesktopBridgeOptions,
  type DesktopAssistantRunRequest,
  type DesktopAssistantProfile,
  type DesktopRarityProviderRunRequest,
  type OpenPathExercise,
} from "./lib/bridge.js";

export { createDesktopAssistantViewportController } from "./lib/assistant-viewport.js";

export {
  DESKTOP_ASSISTANT_INSTANCE_ID,
  DESKTOP_ASSISTANT_SCENE_ID,
  DESKTOP_OPEN_PLACEMENTS,
  DESKTOP_OPEN_SCENE_ID,
  DESKTOP_RARITY_PRODUCT_ID,
  DESKTOP_RARITY_PROJECT_SEED,
  DESKTOP_SCENE_TRANSLATION_X_PROPERTY,
  DESKTOP_SCENE_NOT_COMPOSABLE,
  desktopAssistantScene,
  desktopOpenScene,
  desktopSceneFromDocumentData,
  inspectDesktopSceneProperties,
  stageDesktopSceneEdit,
  stageDesktopScenePropertyEdit,
  type DesktopSceneEditStageResult,
  type DesktopSceneEditableEntity,
  type DesktopSceneEditableProperty,
  type DesktopScenePropertyInspection,
  type DesktopScenePropertyProposalInput,
  type DesktopScenePropertyStageResult,
  type DesktopSceneResult,
} from "./lib/desktop-scene.js";

export {
  seedDesktopProject,
  type DesktopProjectSeedResult,
} from "./lib/project-seed.js";

export {
  DESKTOP_PROJECT_ACTIONS,
  DESKTOP_PROJECT_CHANNEL,
  DESKTOP_PROJECT_REFUSALS,
  DESKTOP_PROJECT_STATE_SCHEMA_VERSION,
  projectOk,
  projectRefuse,
  type DesktopProjectAction,
  type DesktopProjectHostResult,
  type DesktopProjectRecovery,
  type DesktopProjectRefusalReason,
  type DesktopProjectRequest,
  type DesktopProjectResponse,
  type DesktopProjectSource,
  type DesktopProjectStatus,
  type DesktopProjectSummary,
} from "./lib/project-lifecycle-contract.js";

export {
  DESKTOP_RECENT_PROJECTS_FILE,
  DESKTOP_RECENT_PROJECTS_QUARANTINE_PREFIX,
  createDesktopProjectLifecycle,
  type DesktopProjectLifecycle,
  type DesktopProjectLifecycleOptions,
} from "./lib/project-lifecycle.js";

export {
  createDesktopProjectHost,
  desktopProjectReloadRequired,
  type DesktopProjectDialogPort,
  type DesktopProjectHost,
  type DesktopProjectHostOptions,
} from "./lib/project-host.js";

export {
  resolveDesktopLocalBridgePaths,
  startDesktopLocalBridgeServer,
  type DesktopLocalBridgePathOptions,
  type DesktopLocalBridgePaths,
  type DesktopLocalBridgeServer,
  type StartDesktopLocalBridgeServerOptions,
} from "./lib/local-rpc.js";

export {
  createProviderKeyStore,
  type CreateProviderKeyStoreOptions,
  type PlatformSecureStorage,
  type PlatformSecureStorageAvailability,
  type ProviderKeyRead,
  type ProviderKeyRemovable,
  type ProviderKeyRemoved,
  type ProviderKeySaved,
  type ProviderKeyStatus,
  type ProviderKeyStore,
  type ProviderKeyStoreRefusal,
} from "./lib/provider-key-store.js";

export {
  DESKTOP_BYO_CONFIGURATION_ACTIONS,
  DESKTOP_BYO_CONFIGURATION_CHANNEL,
  DESKTOP_BYO_CONFIGURATION_REFUSALS,
  DESKTOP_BYO_PROVIDERS,
  PROVIDER_KEY_STORE_AVAILABILITY_REFUSALS,
  PROVIDER_KEY_STORE_REFUSALS,
  desktopByoRefusalContext,
  type DesktopByoConfigurationAction,
  type DesktopByoConfigurationRefusal,
  type DesktopByoConfigurationRefusalReason,
  type DesktopByoConfigurationRequest,
  type DesktopByoConfigurationResponse,
  type DesktopByoConfigurationStatus,
  type DesktopByoProvider,
  type DesktopByoRefusalContext,
  type ProviderKeyStoreRefusalReason,
} from "./lib/byo-configuration-contract.js";

export {
  desktopByoConfigurationView,
  type DesktopByoConfigurationView,
} from "./lib/byo-configuration-view.js";

export {
  DesktopByoRunnerRefusal,
  createDesktopByoConfiguration,
  createSecureDesktopByoAssistantRunner,
  type CreateDesktopByoConfigurationOptions,
  type CreateDesktopByoProviderSession,
  type CreateSecureDesktopByoAssistantRunnerOptions,
  type DesktopByoConfiguration,
  type DesktopByoProviderSession,
  type ProviderKeyAccess,
} from "./lib/byo-configuration.js";

export {
  DESKTOP_RUNTIME_META,
  PIXELS_META_NAME,
  RENDERER_SCRIPT_TAG,
  desktopLinuxIndexHtml,
  type DesktopIndexHtmlOptions,
} from "./lib/chrome-document.js";
