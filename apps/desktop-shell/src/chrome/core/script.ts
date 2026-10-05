/** Ordered client-script slices share one lexical scope and one request serializer. */
import { formatSafeRarityEvidence } from "@sceneaxi/authoring-core/rarity-evidence";
import {
  DESKTOP_SCENE_HIERARCHY_REFUSALS,
  DEFAULT_INPUT_ACTION_MAP,
  DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS,
  EDITOR_COMMAND_REGISTRY,
  INPUT_ACTION_REFUSALS,
  INPUT_ACTION_REGISTRY,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ASSISTANT_RUNTIME_EVENT,
  DESKTOP_MODE_IDS,
  DESKTOP_MINIMUM_WINDOW,
  DESKTOP_VISUAL_REFUSALS,
  desktopVisualView,
  dockTabsFor,
  type DesktopVisualView,
} from "../../visual-model.js";
import {
  DESKTOP_PRODUCT_REFUSALS,
  DESKTOP_RARITY_PROPOSAL_EVENT,
  DESKTOP_VIEWPORT_PLAY_EVENT,
  DESKTOP_VIEWPORT_STOP_EVENT,
  DESKTOP_VIEWPORT_SCENE_OPEN_EVENT,
  DESKTOP_WEB_STAGE_CONFIG,
  DESKTOP_WEB_STARTER,
  desktopWebStageDecision,
} from "../../product-loop.js";
import { DESKTOP_INTERACTION_COMMANDS, DESKTOP_PALETTE_SHORTCUT } from "../../interaction-commands.js";
import { METRICS, MOTION_SYSTEM } from "../../visual-tokens.js";
import { belowTier } from "./markup.js";
import { frameScript } from "../frame/script.js";
import { treeSelectionScript } from "../tree/script.js";
import { inspectorDisplayScript, inspectorCatalogScript, inspectorPropertyScript, inspectorTransformScript } from "../inspector/script.js";
import { viewportScript } from "../viewport/script.js";
import { assistantScript } from "../assistant/script.js";
import { paletteScript } from "../palette/script.js";
import { settingsGitValidationScript, settingsShipScript, settingsScript } from "../settings/script.js";
import { dockReviewScript, dockTabsScript, dockTimelineScript } from "../dock/script.js";

/**
 * Every control, on every profile, exactly as the model projects it.
 *
 * `[kind, refusal]` per control id, unioned across the modes because the dock
 * tabs a mode has are part of that mode. The browser-side switch applies these
 * by id, which is what replaced a hand-written selector list: the list had to be
 * edited whenever a control was added, and it was not — the drawer toggles were
 * missing from it and stayed live on a profile whose panels the refusal removes.
 */
function controlsByProfile(
  view: DesktopVisualView,
  runtime = view.state.assistantRuntime,
) {
  const table: Record<string, Record<string, readonly [string, string | null]>> = {};

  for (const profile of view.profiles) {
    const merged: Record<string, readonly [string, string | null]> = {};

    for (const mode of DESKTOP_MODE_IDS) {
      const projected = desktopVisualView({
        ...view.state,
        profile: profile.id,
        mode,
        assistantRuntime: runtime,
      });

      for (const control of projected.controls) {
        merged[control.id] = [control.kind, control.refusal] as const;
      }
    }

    table[profile.id] = merged;
  }

  return table;
}

/** The emitted behaviour script. Reads only tables serialized from the model. */
export function script(view: DesktopVisualView): string {
  const assistantRuntimeRows = Object.fromEntries(
    (["none", "local"] as const).map((runtime) => {
      const projected = desktopVisualView({
        ...view.state,
        assistantRuntime: runtime,
      });

      return [
        runtime,
        {
          controlsByProfile: controlsByProfile(projected, runtime),
          assistantByProfile: Object.fromEntries(
            projected.profiles.map((profile) => [
              profile.id,
              {
                state: profile.assistant.state,
                modelLabel: profile.assistant.modelLabel,
              },
            ]),
          ),
        },
      ];
    }),
  );

  const tables = {
    dockTabsByMode: Object.fromEntries(
      DESKTOP_MODE_IDS.map((mode) => [mode, [...dockTabsFor(mode)]]),
    ),
    dockLabels: { changes: "Changes", assets: "Assets", console: "Console", evidence: "Evidence", timeline: "Timeline" },
    dockHeightByMode: Object.fromEntries(
      DESKTOP_MODE_IDS.map((mode) => [
        mode,
        mode === "animate" ? METRICS.dockHeightAnimate : METRICS.dockHeight,
      ]),
    ),
    assistantRuntimeEvent: DESKTOP_ASSISTANT_RUNTIME_EVENT,
    assistantRuntimeRows,
    assistantRuntimeRefusal: DESKTOP_VISUAL_REFUSALS.noPresentationRuntime,
    // The status bar names the profile the document is on, so a switch that
    // leaves it behind has the surface asserting a profile it is not on — next
    // to a refusal that says otherwise. The model's own pin, never a local copy.
    pinByProfile: Object.fromEntries(
      view.profiles.map((profile) => [
        profile.id,
        desktopVisualView({ ...view.state, profile: profile.id }).profilePin,
      ]),
    ),
    /** The tier boundary the stylesheet undocks the assistant at. */
    assistantDrawerQuery: belowTier("regular"),
    commands: DESKTOP_INTERACTION_COMMANDS,
    editorCommands: EDITOR_COMMAND_REGISTRY,
    hierarchyRefusals: DESKTOP_SCENE_HIERARCHY_REFUSALS,
    inputActions: INPUT_ACTION_REGISTRY,
    defaultInputActionMap: DEFAULT_INPUT_ACTION_MAP,
    inputActionRefusals: INPUT_ACTION_REFUSALS,
    paletteShortcut: DESKTOP_PALETTE_SHORTCUT,
    commandRefusals: {
      undoUnavailable: DESKTOP_VISUAL_REFUSALS.undoUnavailable,
      redoUnavailable: DESKTOP_VISUAL_REFUSALS.redoUnavailable,
    },
    product: {
      documentPath: view.product.surface.project.activeFile,
      viewportPlayEvent: DESKTOP_VIEWPORT_PLAY_EVENT,
      viewportStopEvent: DESKTOP_VIEWPORT_STOP_EVENT,
      viewportSceneOpenEvent: DESKTOP_VIEWPORT_SCENE_OPEN_EVENT,
      rarityProposalEvent: DESKTOP_RARITY_PROPOSAL_EVENT,
      webStarter: DESKTOP_WEB_STARTER,
      // Every name the script can print, serialized rather than typed out as a
      // literal in the browser body: a refusal the visitor reads is one the
      // registry owns and `refusalLegend()` explains.
      refusals: DESKTOP_PRODUCT_REFUSALS,
      /** The one staging decision's own configuration, not a browser copy. */
      stageConfig: DESKTOP_WEB_STAGE_CONFIG,
      inspectors: view.product.inspectors.map(({ kind, applyCommand }) => ({ kind, applyCommand })),
    },
    controlsByProfile: controlsByProfile(view),
  };

  return `
const T = ${JSON.stringify(tables).replace(/</g, "\\u003c")};
const shell = document.querySelector('.shell');
if (shell) {
  const q = (sel) => Array.from(shell.querySelectorAll(sel));
  const minimumWindowQuery = window.matchMedia('(max-width:${DESKTOP_MINIMUM_WINDOW.width - 1}px),(max-height:${DESKTOP_MINIMUM_WINDOW.height - 1}px)');

  // The model's own staging decision, not a paraphrase of it: this is the exact
  // function \`stageWebHtml()\` and \`stageWebAssetInjection()\` call, so the shipped
  // browser path and the tested exports cannot answer differently.
  const webStageDecision = ${String(desktopWebStageDecision)};

  let projectData = null;
  let projectContentHash = null;
  let projectContentRoot = null;
  let projectDirty = false;
  let projectRecovering = false;
  let recoveryStatusText = null;
  // The code of the host's last unresolved refusal about this document. Only a
  // validated resolution clears it, so a blocked decision can name what is
  // actually in the way instead of claiming a normal-open document.
  let activeConflictDetail = null;
  let activeReviewSnapshot = null;
  let rarityProposalStaged = false;
  let activeRarityEvidence = null;
  let activeRarityEvidenceDigest = null;
  let activeReviewRarityEvidenceDigest = null;
  let activeRunRarityEvidenceDigest = null;
  let activeProject = null;
  let projectBrowserStatus = null;
  let editableScene = null;
  let selectedSceneEntityId = null;
  let selectedSceneEntityIds = [];
  let sceneSelectionPending = Promise.resolve();
  let sceneSelectionGeneration = 0;
  let sceneRefusalText = null;
  let consoleEvidence = [];
  let undoAvailability = 'unavailable';
  let redoAvailability = 'unavailable';
  let shippedSourceDigest = null;
  // One product request at a time. Every live control reads \`projectData\` before
  // its first await, so two overlapping clicks would each build a proposal from
  // the same pre-edit document and the second would replace the first in the
  // host's single-proposal session — both reporting success, one edit gone.
  let inFlight = false;
  let activeInputActionMap = T.defaultInputActionMap;
  let editorInputActionBaseVersions = null;
  let editorMigrationDigest = null;
  let editorPackageIds = [];
  let editorExtensionSeams = [];
  let editorInputActionReview = null;
  let editorPrefabDefinitions = [];
  let editorSceneInstanceIds = [];
  let editorPlaySessionActive = false;
  let editorPhysicsHostReady = false;

${frameScript()}

  const beginSceneLifecycleTransition = async () => {
    await sceneSelectionPending;
    sceneSelectionGeneration += 1;
  };

  const clearShipEvidence = () => {
    shippedSourceDigest = null;
    q('[data-ship-export-evidence]').forEach((el) => { el.hidden = true; });
    q('[data-ship-output], [data-ship-bundle-digest], [data-ship-source-digest], [data-ship-handoff-path]')
      .forEach((el) => { el.textContent = ''; });
    q('[data-ship-export-status]').forEach((el) => {
      el.textContent = 'No export has run for the current saved project bytes.';
    });
  };

  const productStatus = (state, text) => {
    if (
      shippedSourceDigest !== null &&
      (projectDirty || projectRecovering || shippedSourceDigest !== projectContentHash)
    ) clearShipEvidence();
    const pill = shell.querySelector('[data-project-state]');
    if (pill) pill.dataset.projectState = state;
    q('[data-project-status]').forEach((el) => { el.textContent = text; });
    q('[data-project-file-state]').forEach((el) => { el.textContent = text; });
  };

  // The panel's refusal lives beside the entity list rather than inside the
  // editor it would explain: the editor is hidden exactly when there is no
  // inspectable entity, so a reason written in there is a reason nobody reads.
  // The left dock is itself a closed drawer below the compact tier, so the same
  // text also rides the product status the status bar mirrors at every tier.
  const sceneEntitiesRefusal = (text) => {
    sceneRefusalText = text || null;
    const el = shell.querySelector('[data-scene-entities-refusal]');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  };

  const withSceneRefusal = (text) =>
    sceneRefusalText === null ? text : text + ' · ' + sceneRefusalText;

  const clearSceneProperty = () => {
    editableScene = null;
    selectedSceneEntityId = null;
    selectedSceneEntityIds = [];
    const entities = shell.querySelector('[data-scene-entities]');
    const identities = shell.querySelector('[data-scene-identities]');
    const editor = shell.querySelector('[data-scene-property-editor]');
    const review = shell.querySelector('[data-scene-property-review]');
    if (entities) entities.hidden = true;
    if (identities) identities.replaceChildren();
    if (editor) editor.hidden = true;
    if (review) { review.hidden = true; review.textContent = ''; }
    sceneEntitiesRefusal('');
    q('[data-action="scene-entity-select"]').forEach((el) => {
      if (el.tagName === 'SELECT') {
        el.value = '';
        delete el.dataset.value;
      } else {
        el.setAttribute('aria-pressed', 'false');
      }
    });
  };

${inspectorDisplayScript()}

  // Every path that moves the document — open, stage, save, recovery — re-reads
  // the panel from the host's own inspection, and keeps the operator's selection
  // across that read. Re-selecting is how the value on screen used to be
  // refreshed, so dropping the selection here is what made a stale value
  // survivable in the first place.
  const syncSceneProperties = (status) => {
    const inspectedSelection = status?.editableScene?.selection;
    const stagedSelection = status && Array.isArray(status.selectedInstanceIds)
      ? status.selectedInstanceIds
      : null;
    const previousSelection = stagedSelection ||
      (inspectedSelection && Array.isArray(inspectedSelection.instanceIds)
        ? inspectedSelection.instanceIds
        : selectedSceneEntityIds);
    clearSceneProperty();
    const inspected = status && status.editableScene;
    const staleRecovery = inspected && inspected.ok === false &&
      inspected.reason === T.hierarchyRefusals.selectionStale &&
      inspected.hierarchy && Array.isArray(inspected.entities);
    const entitiesList = inspected && (inspected.ok === true || staleRecovery) && Array.isArray(inspected.entities)
      ? inspected.entities
      : [];
    const expectedPropertyIds = ${JSON.stringify(DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS.map((definition) => definition.id))};
    const validEntities = entitiesList.length >= 2 && entitiesList.every((entity) =>
      entity && typeof entity.id === 'string' && typeof entity.label === 'string' &&
      typeof entity.artifactId === 'string' && typeof entity.depth === 'number' &&
      (entity.parentInstanceId === null || typeof entity.parentInstanceId === 'string') && Array.isArray(entity.properties) &&
      entity.properties.length === expectedPropertyIds.length &&
      expectedPropertyIds.every((id) => entity.properties.some((property) =>
        property && property.id === id && typeof property.value === 'number')));
    if (!validEntities) {
      const refusal = inspected && inspected.ok === false && Array.isArray(inspected.diagnostics)
        ? inspected.diagnostics[0]
        : null;
      if (refusal && typeof refusal.code === 'string') {
        sceneEntitiesRefusal(
          'Scene entities unavailable · ' + refusal.code +
          (typeof refusal.message === 'string' && refusal.message ? ' · ' + refusal.message : ''),
        );
      }
      return false;
    }
    if (staleRecovery) {
      const refusal = Array.isArray(inspected.diagnostics) ? inspected.diagnostics[0] : null;
      sceneEntitiesRefusal(
        'Scene selection stale · ' + inspected.reason +
        (typeof refusal?.message === 'string' && refusal.message ? ' · ' + refusal.message : '') +
        ' · choose a current object to recover',
      );
    }
    editableScene = inspected;
    const entities = shell.querySelector('[data-scene-entities]');
    if (entities) entities.hidden = false;
    const identities = shell.querySelector('[data-scene-identities]');
    if (identities) {
      identities.replaceChildren();
      entitiesList.forEach((entity) => {
        const item = document.createElement('li');
        item.className = 'scene-entity-identity';
        item.dataset.sceneIdentity = entity.id;
        item.style.setProperty('--scene-depth', String(entity.depth));
        item.dataset.action = 'scene-entity-select';
        item.dataset.value = entity.id;
        item.setAttribute('aria-pressed', selectedSceneEntityIds.includes(entity.id) ? 'true' : 'false');
        item.classList.toggle('is-selected', selectedSceneEntityIds.includes(entity.id));
        const kind = document.createElement('span');
        kind.textContent = entity.label;
        item.appendChild(kind);
        const fields = document.createElement('dl');
        [
          ['Artifact', entity.artifactId, 'artifact'],
          ['Instance', entity.id, 'instance'],
          ['Parent', entity.parentInstanceId === null ? 'root' : entity.parentInstanceId, 'parent'],
        ].forEach(([label, value, field]) => {
          const row = document.createElement('div');
          const term = document.createElement('dt');
          const description = document.createElement('dd');
          const code = document.createElement('code');
          term.textContent = label;
          code.textContent = value;
          code.setAttribute('data-scene-identity-' + field, '');
          description.appendChild(code);
          row.append(term, description);
          fields.appendChild(row);
        });
        item.appendChild(fields);
        identities.appendChild(item);
      });
    }
    q('[data-action="scene-entity-select"]').forEach((el) => {
      if (el.tagName !== 'SELECT') return;
      el.replaceChildren();
      entitiesList.forEach((entity) => {
        const option = document.createElement('option');
        option.value = entity.id;
        option.textContent = '  '.repeat(entity.depth) + 'Object ' + entity.artifactId +
          ' · instance ' + entity.id +
          (entity.parentInstanceId === null ? ' · root' : ' · parent ' + entity.parentInstanceId);
        el.appendChild(option);
      });
      const fallback = entitiesList.find((entity) => entity.id === 'desktop-crate-beside')?.id || entitiesList[0]?.id || '';
      const chosen = previousSelection.filter((id) => entitiesList.some((entity) => entity.id === id));
      selectedSceneEntityIds = staleRecovery ? [] : chosen.length > 0 ? chosen : [fallback];
      Array.from(el.options).forEach((option) => {
        option.selected = selectedSceneEntityIds.includes(option.value);
      });
      el.dataset.value = selectedSceneEntityIds.join(',');
    });
    editorSceneInstanceIds = entitiesList.map((entity) => entity.id);
    populateEditorChoices('parentInstanceId', editorSceneInstanceIds);
    updateEditorCommandControls();
    const parent = shell.querySelector('[data-scene-parent]');
    if (parent && parent.tagName === 'SELECT') {
      parent.replaceChildren();
      entitiesList.forEach((entity) => {
        const option = document.createElement('option');
        option.value = entity.id;
        option.textContent = 'Object ' + entity.artifactId + ' · instance ' + entity.id;
        parent.appendChild(option);
      });
      parent.value = entitiesList[0]?.id || '';
    }
    if (staleRecovery) return true;
    if (selectedSceneEntityIds[0] && showSceneProperty(selectedSceneEntityIds[0])) return true;
    return true;
  };

  const reportRecoveryRefusal = (action) => {
    const current = recoveryStatusText || shell.querySelector('[data-project-status]')?.textContent || '';
    productStatus(
      'recovering',
      action + ' refused · ' + T.product.refusals.recoveryPending + (current ? ' · ' + current : ''),
    );
  };

  const reviewCount = () => activeReviewSnapshot === null ? 0 : 1;

${settingsGitValidationScript()}

  const isSessionSnapshot = (snapshot) => {
    const phases = ['idle', 'reviewing', 'applied', 'pending', 'rejected'];
    return snapshot !== null && typeof snapshot === 'object' &&
      phases.includes(snapshot.phase) &&
      (snapshot.unifiedDiff === null || typeof snapshot.unifiedDiff === 'string') &&
      (snapshot.renderedDiff === null || typeof snapshot.renderedDiff === 'string') &&
      (snapshot.proposal === null || typeof snapshot.proposal === 'object') &&
      (snapshot.appliedPaths === null ||
        (Array.isArray(snapshot.appliedPaths) && snapshot.appliedPaths.every((path) => typeof path === 'string'))) &&
      typeof snapshot.journalRecoveryPending === 'boolean' &&
      (snapshot.transactionId === null || typeof snapshot.transactionId === 'string') &&
      (snapshot.diagnostics === null || Array.isArray(snapshot.diagnostics));
  };

  const reviewProjection = (snapshot) => {
    if (!isSessionSnapshot(snapshot)) return null;
    const proposal = snapshot && snapshot.proposal;
    const edits = proposal && Array.isArray(proposal.edits) ? proposal.edits : [];
    const compact = snapshot?.preparedReview;
    const first = edits[0] || (snapshot.proposal === null && snapshot.preparedAsset &&
      Number.isSafeInteger(snapshot.preparedAsset.canonicalBase64ByteLength) &&
      snapshot.preparedAsset.canonicalBase64ByteLength > 0 && compact &&
      typeof compact.documentPath === 'string' && compact.documentPath.length > 0 &&
      typeof compact.baseContentHash === 'string' && compact.baseContentHash.length > 0 ? compact : null);
    const diff = snapshot && typeof snapshot.renderedDiff === 'string'
      ? snapshot.renderedDiff
      : null;
    return snapshot && snapshot.phase === 'reviewing' &&
      first && typeof first.documentPath === 'string' &&
      typeof first.baseContentHash === 'string' && diff !== null
      ? { first, diff }
      : null;
  };

  // The authoring core's own safe-evidence rendering, not a browser paraphrase
  // of it: the packaged renderer prints this exact function's output, so the
  // Assistant, Change Review, Run, and Evidence surfaces cannot disagree about
  // what an accepted roll's provenance says.
  const rarityEvidenceText = ${String(formatSafeRarityEvidence)};

  const syncRarityEvidence = (evidence) => {
    const text = rarityEvidenceText(evidence);
    activeRarityEvidence = text !== null ? evidence : null;
    activeRarityEvidenceDigest = text !== null && evidence && typeof evidence === 'object' &&
      typeof evidence.namespaceDigest === 'string'
      ? evidence.namespaceDigest
      : null;
    const panel = shell.querySelector('[data-rarity-evidence]');
    const empty = shell.querySelector('[data-rarity-evidence-empty]');
    if (panel) {
      panel.textContent = text || '';
      panel.hidden = text === null;
    }
    if (empty) empty.hidden = text !== null;
    return text;
  };

  const dispatchRarityInvalidations = (invalidatedDigests) => {
    invalidatedDigests.forEach((namespaceDigest) => {
      document.dispatchEvent(new CustomEvent(T.product.rarityProposalEvent, {
        detail: { invalidated: true, namespaceDigest },
      }));
    });
  };

  const clearReviewRarityEvidence = () => {
    activeReviewRarityEvidenceDigest = null;
    q('[data-change-rarity-evidence]').forEach((el) => {
      el.textContent = '';
      el.hidden = true;
    });
  };

  const clearRunRarityEvidence = () => {
    activeRunRarityEvidenceDigest = null;
    q('[data-run-rarity-evidence]').forEach((el) => {
      el.textContent = '';
      el.hidden = true;
    });
  };

  const clearRarityEvidence = (retireAll = false) => {
    const invalidatedDigests = new Set();
    if (activeRarityEvidenceDigest !== null) invalidatedDigests.add(activeRarityEvidenceDigest);
    if (retireAll && activeReviewRarityEvidenceDigest !== null) {
      invalidatedDigests.add(activeReviewRarityEvidenceDigest);
    }
    if (retireAll && activeRunRarityEvidenceDigest !== null) {
      invalidatedDigests.add(activeRunRarityEvidenceDigest);
    }
    const invalidatedDigest = activeRarityEvidenceDigest;
    const cleared = syncRarityEvidence(null);
    if (retireAll || activeReviewRarityEvidenceDigest === invalidatedDigest) {
      clearReviewRarityEvidence();
    }
    if (retireAll || activeRunRarityEvidenceDigest === invalidatedDigest) {
      clearRunRarityEvidence();
    }
    dispatchRarityInvalidations(invalidatedDigests);
    return cleared;
  };

  const reconcileRarityEvidence = (status) => {
    if (!status || status.ok !== true) return;
    const accepted = status.acceptedRarityEvidence;
    const digest = typeof status.rarityNamespaceDigest === 'string'
      ? status.rarityNamespaceDigest
      : null;
    const acceptedDigest = accepted && typeof accepted === 'object' &&
      typeof accepted.namespaceDigest === 'string'
      ? accepted.namespaceDigest
      : null;
    if (digest === null || acceptedDigest !== digest || rarityEvidenceText(accepted) === null) {
      clearRarityEvidence(true);
      return;
    }
    const invalidatedDigests = new Set();
    if (activeRarityEvidenceDigest !== digest) {
      if (activeRarityEvidenceDigest !== null) {
        invalidatedDigests.add(activeRarityEvidenceDigest);
      }
      syncRarityEvidence(accepted);
    }
    if (
      activeReviewRarityEvidenceDigest !== null &&
      activeReviewRarityEvidenceDigest !== digest
    ) {
      invalidatedDigests.add(activeReviewRarityEvidenceDigest);
      clearReviewRarityEvidence();
    }
    if (activeRunRarityEvidenceDigest !== null && activeRunRarityEvidenceDigest !== digest) {
      invalidatedDigests.add(activeRunRarityEvidenceDigest);
      clearRunRarityEvidence();
    }
    dispatchRarityInvalidations(invalidatedDigests);
  };

  const clearConflictOutcome = () => { activeConflictDetail = null; };

${dockReviewScript()}

  // A conflict or recovery outcome reports the host's own diagnostic — its code,
  // its message, and the re-read hint it returned — through the one outcome
  // dialog, so nothing here describes a conflict the response did not name.
  // The dialog is written on every open, so a resolved conflict cannot be
  // re-read from it later.
  const showConflictOutcome = (title, snapshot, fallback) => {
    const diagnostics = snapshot && Array.isArray(snapshot.diagnostics)
      ? snapshot.diagnostics
      : [];
    const diagnostic = diagnostics[0];
    const code = diagnostic && typeof diagnostic.code === 'string'
      ? diagnostic.code
      : fallback;
    const message = diagnostic && typeof diagnostic.message === 'string'
      ? diagnostic.message
      : 'The authoring session refused the proposal.';
    const hint = diagnostic && typeof diagnostic.reReadHint === 'string'
      ? ' · ' + diagnostic.reReadHint
      : '';
    showOutcome(title, code, message + hint);
    activeConflictDetail = code;
  };

  // The run report is hidden below the compact tier, so a refusal that lives
  // only there is a refusal nobody at 1000x700 can read. Refusals also go to the
  // product status, which the status bar mirrors at every tier.
  const runStatus = (text) => {
    q('[data-product-run-report]').forEach((el) => { el.textContent = text; });
  };

  const runRefusal = (code, detail, command = 'Play') => {
    const text = command + ' refused · ' + code + (detail ? ' · ' + detail : '');
    runStatus(text);
    q('[data-run-session-report]').forEach((el) => {
      el.textContent = 'No completed session for the latest ' + command + ' request · ' + code;
    });
    q('[data-run-live-report]').forEach((el) => {
      el.textContent = 'No viewport frame was acknowledged for the latest ' + command + ' request.';
    });
    productStatus('refused', text);
    showOutcome(command + ' refused', code, detail || 'The run command was not completed.');
  };

  const appendConsoleEvidence = (event, data) => {
    const output = shell.querySelector('[data-console-output]');
    if (!output) return;
    consoleEvidence.push(JSON.stringify({ event, data }, null, 2));
    if (consoleEvidence.length > 20) consoleEvidence.shift();
    output.textContent = consoleEvidence.join("\\n");
  };

  const runControl = async (commandId) => {
    const response = await commandRequest(commandId, {});
    if (response === null || !response.ok) {
      runRefusal(response === null ? T.product.refusals.runtimeUnavailable : response.reason,
        response === null ? null : response.detail, commandId === 'run-stop' ? 'Stop' : 'Reset');
      return;
    }
    const detail = response.data && typeof response.data === 'object'
      ? JSON.stringify(response.data)
      : 'completed';
    runStatus((commandId === 'run-stop' ? 'Stopped' : 'Reset') + ' · ' + detail);
    appendConsoleEvidence(commandId, response.data);
    if (commandId === 'run-stop') {
      editorPlaySessionActive = false;
      updateEditorCommandControls();
    }
    document.dispatchEvent(new CustomEvent(T.product.viewportStopEvent));
    productStatus('open', 'Run command completed · ' + commandId);
  };

${inspectorCatalogScript()}

  const desktopPort = () => {
    const portable = globalThis.sceneaxiDesktop;
    const linux = globalThis.sceneaxiDesktopLinux;
    const candidate = portable || linux;
    return candidate && typeof candidate.request === 'function' ? candidate : null;
  };

  const projectPort = () => {
    const portable = globalThis.sceneaxiDesktop;
    const linux = globalThis.sceneaxiDesktopLinux;
    const candidate = portable || linux;
    return candidate && typeof candidate.project === 'function' ? candidate : null;
  };

  const inputActionPort = () => {
    const portable = globalThis.sceneaxiDesktop;
    const linux = globalThis.sceneaxiDesktopLinux;
    const candidate = portable || linux;
    return candidate && typeof candidate.inputActions === 'function' ? candidate : null;
  };

  const hydrateInputActions = async () => {
    const port = inputActionPort();
    if (port === null || activeProject === null) return;
    try {
      const response = await port.inputActions();
      const map = response && response.ok === true && response.data && response.data.map;
      if (!map || map.schemaVersion !== 1 || map.kind !== 'sceneaxi.input-action-map' ||
          !Array.isArray(map.bindings) || map.bindings.length !== T.inputActions.length) {
        commandRefusal(response?.reason || T.inputActionRefusals.persistedStateInvalid);
        return;
      }
      activeInputActionMap = map;
      refreshInputBindingLabels();
    } catch {
      commandRefusal(T.inputActionRefusals.persistedStateInvalid);
    }
  };

  const assetImportPort = () => {
    const portable = globalThis.sceneaxiDesktop;
    const linux = globalThis.sceneaxiDesktopLinux;
    const candidate = portable || linux;
    return candidate && typeof candidate.importAsset === 'function' ? candidate : null;
  };

  const projectBrowserPort = () => {
    const portable = globalThis.sceneaxiDesktop;
    const linux = globalThis.sceneaxiDesktopLinux;
    const candidate = portable || linux;
    return candidate && typeof candidate.browseProject === 'function' ? candidate : null;
  };

  // Audio authority is never inferred from a scene/frame or an offline reply.
  let desktopAudioGeneration = 0;
  const invalidateDesktopAudio = () => {
    desktopAudioGeneration += 1;
    document.dispatchEvent(new CustomEvent('sceneaxi:desktop-audio-invalidate', { detail: { profile: null } }));
    return desktopAudioGeneration;
  };

  const runtimeRequest = async (request) => {
    const confirmsProfile = request.action === 'profile';
    const invalidatesAudio = confirmsProfile || request.action === 'open-path' || request.action === 'project-open' ||
      request.action === 'authoring' && ['restart', 'status'].includes(request.payload?.op);
    const audioGeneration = invalidatesAudio ? invalidateDesktopAudio() : desktopAudioGeneration;
    const audioRoot = activeProject?.root ?? null;
    const audioProfile = shell.dataset.profile;
    const port = desktopPort();
    if (port === null) return null;
    try {
      const response = await port.request(request);
      if (confirmsProfile) {
        const profile = request.payload?.profile;
        // A rootless shell may switch business profiles, but cannot grant audio.
        const current = audioGeneration === desktopAudioGeneration &&
          (activeProject?.root ?? null) === audioRoot && shell.dataset.profile === audioProfile;
        if (!current) return { ok: false, reason: T.product.refusals.runtimeRequestRefused, message: 'Stale profile response.' };
        if (audioRoot !== null && response?.ok === true && response.data?.profile === profile && ['game', 'web', 'kids'].includes(profile)) {
          document.dispatchEvent(new CustomEvent('sceneaxi:desktop-audio-invalidate', { detail: { profile } }));
        }
      }
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        reason: T.product.refusals.runtimeRequestFailed,
        message,
        detail: message,
      };
    }
  };

  const projectRequest = async (request) => {
    if (['choose-new', 'choose-open', 'open-recent'].includes(request.action)) invalidateDesktopAudio();
    const port = projectPort();
    if (port === null) return null;
    try {
      return await port.project(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        reason: T.product.refusals.runtimeRequestFailed,
        message,
        detail: message,
      };
    }
  };

  const assetImportRequest = async (request) => {
    const port = assetImportPort();
    if (port === null) return null;
    try {
      return await port.importAsset(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, reason: T.product.refusals.runtimeRequestFailed, message, detail: message };
    }
  };

  const projectBrowserRequest = async (request) => {
    const port = projectBrowserPort();
    if (port === null) return null;
    try {
      return await port.browseProject(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, reason: T.product.refusals.runtimeRequestFailed, message, detail: message };
    }
  };

  const renderProjectBrowser = (status) => {
    if (!status || !Array.isArray(status.files) || typeof status.selectedPath !== 'string' ||
        status.activeDocumentPath !== T.product.documentPath) return false;
    const files = status.files.filter((file) => file && typeof file.path === 'string' &&
      typeof file.fileType === 'string' && typeof file.digest === 'string' &&
      file.validation && typeof file.validation.state === 'string');
    if (files.length !== status.files.length ||
        !files.some((file) => file.path === status.selectedPath)) return false;
    projectBrowserStatus = status;
    const browserRevision = Number(shell.dataset.projectBrowserRevision || '0') + 1;
    shell.dataset.projectBrowserRevision = String(browserRevision);
    shell.dataset.projectBrowserSelectedPath = status.selectedPath;
    const list = shell.querySelector('#project-browser-file-select');
    if (list && list.tagName === 'SELECT') {
      list.replaceChildren();
      files.forEach((file) => {
        const option = document.createElement('option');
        option.value = file.path;
        option.textContent = file.path + ' · ' + file.fileType + ' · ' + file.validation.state;
        list.append(option);
      });
      list.value = status.selectedPath;
    }
    const selected = files.find((file) => file.path === status.selectedPath);
    const detail = shell.querySelector('[data-project-browser-detail]');
    if (!selected || !detail) return false;
    detail.hidden = false;
    const put = (selector, value) => {
      const element = detail.querySelector(selector);
      if (element) element.textContent = value;
    };
    put('[data-project-browser-path]', selected.path +
      (selected.path === status.activeDocumentPath ? ' · active authoring target' : ' · manifest asset'));
    put('[data-project-browser-type]', selected.fileType + ' · ' + selected.mediaType + ' · ' + selected.byteLength + ' bytes');
    put('[data-project-browser-digest]', selected.digest);
    put('[data-project-browser-provenance]', JSON.stringify(selected.provenance));
    put('[data-project-browser-validation]', selected.validation.state +
      (selected.validation.reason ? ' · ' + selected.validation.reason : '') +
      ' · ' + selected.validation.message);
    const assetSurface = shell.querySelector('[data-project-assets]');
    if (assetSurface) {
      assetSurface.replaceChildren();
      const assets = files.filter((file) => file.kind === 'asset');
      if (assets.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'panel-empty';
        empty.textContent = 'No admitted project assets are present.';
        assetSurface.append(empty);
      } else {
        assets.forEach((asset) => {
          const card = document.createElement('article');
          card.className = 'asset-browser-card';
          card.dataset.projectAsset = asset.path;
          const name = document.createElement('strong');
          name.textContent = asset.path;
          const type = document.createElement('span');
          type.textContent = asset.fileType + ' · ' + asset.mediaType + ' · ' + asset.byteLength + ' bytes';
          const digest = document.createElement('span');
          digest.className = 'asset-browser-meta';
          digest.textContent = asset.digest;
          const provenance = document.createElement('span');
          provenance.className = 'asset-browser-meta';
          provenance.textContent = JSON.stringify(asset.provenance);
          const validation = document.createElement('span');
          validation.textContent = asset.validation.state +
            (asset.validation.reason ? ' · ' + asset.validation.reason : '') +
            ' · ' + asset.validation.message;
          card.append(name, type, digest, provenance, validation);
          assetSurface.append(card);
        });
      }
    }
    return true;
  };

  const clearProjectBrowser = () => {
    projectBrowserStatus = null;
    delete shell.dataset.projectBrowserSelectedPath;
    const list = shell.querySelector('#project-browser-file-select');
    if (list) list.replaceChildren();
    const detail = shell.querySelector('[data-project-browser-detail]');
    if (detail) {
      detail.hidden = true;
      detail.querySelectorAll('[data-project-browser-path], [data-project-browser-type], [data-project-browser-digest], [data-project-browser-provenance], [data-project-browser-validation]')
        .forEach((element) => { element.textContent = ''; });
    }
    const assetSurface = shell.querySelector('[data-project-assets]');
    if (assetSurface) assetSurface.replaceChildren();
  };

  const syncProjectBrowser = async () => {
    clearProjectBrowser();
    if (activeProject === null || projectBrowserPort() === null) return true;
    let response = await projectBrowserRequest({ action: 'status', profile: shell.dataset.profile });
    if (response?.reason === T.product.refusals.projectBrowserFileMissing) {
      response = await projectBrowserRequest({
        action: 'select',
        profile: shell.dataset.profile,
        path: T.product.documentPath,
      });
    }
    if (!response || !response.ok || !renderProjectBrowser(response.data?.status)) {
      const code = response?.reason || T.product.refusals.runtimeRequestRefused;
      productStatus('refused', 'Project browser refused · ' + code);
      return false;
    }
    return true;
  };

  const projectBrowserAction = async (action, path, targetPath) => {
    const restoreSelection = () => {
      if (projectBrowserStatus !== null) renderProjectBrowser(projectBrowserStatus);
    };
    if (action !== 'open' && projectBrowserPort() === null) {
      restoreSelection();
      const code = T.product.refusals.runtimeRequestRefused;
      productStatus('refused', 'Project browser refused · ' + code);
      showOutcome('Project browser refused', code, 'The packaged project-browser host is unavailable.');
      return false;
    }
    if (typeof path !== 'string' || path.length === 0) return false;
    const request = {
      action,
      profile: shell.dataset.profile,
      path,
      ...(typeof targetPath === 'string' ? { targetPath } : {}),
      ...((action === 'rename' || action === 'delete') ? { confirmed: true } : {}),
    };
    const response = action === 'open'
      ? await runtimeRequest({
          action: 'project-browser-open',
          payload: { profile: shell.dataset.profile, path },
        })
      : await projectBrowserRequest(request);
    if (!response || !response.ok) {
      restoreSelection();
      const code = response?.reason || T.product.refusals.runtimeRequestRefused;
      if (action === 'open' && code === T.product.refusals.projectBrowserDirty) {
        const authoritative = await runtimeRequest({
          action: 'authoring',
          payload: { op: 'status', documentPath: T.product.documentPath },
        });
        const status = authoritative?.ok ? authoritative.data : null;
        if (status && isSessionSnapshot(status.authoringSnapshot)) {
          const hierarchyReviewRedacted = status.authoringSnapshot.phase === 'reviewing' &&
            reviewProjection(status.authoringSnapshot) === null;
          if (hierarchyReviewRedacted) {
            await syncSceneHierarchy(true);
          } else {
            syncReview(status.authoringSnapshot);
          }
        }
      }
      productStatus('refused', 'Project browser refused · ' + code);
      showOutcome('Project browser refused', code, response?.message || 'No project file changed.');
      return false;
    }
    if (!renderProjectBrowser(response.data?.status)) {
      restoreSelection();
      productStatus('refused', 'Project browser refused · ' + T.product.refusals.runtimeRequestRefused);
      return false;
    }
    if (action === 'open') {
      const file = response.data.status.files.find((candidate) => candidate.path === path);
      const authoringStatus = response.data.authoringStatus;
      const authoringSnapshot = authoringStatus && isSessionSnapshot(authoringStatus.authoringSnapshot)
        ? authoringStatus.authoringSnapshot
        : null;
      if (authoringSnapshot !== null) syncReview(authoringSnapshot);
      if (!authoringStatus || authoringStatus.ok !== true || authoringSnapshot === null ||
          reviewProjection(authoringSnapshot) !== null || authoringSnapshot.phase === 'pending' ||
          authoringSnapshot.journalRecoveryPending === true) {
        const code = T.product.refusals.projectBrowserDirty;
        productStatus('refused', 'Open refused · ' + code);
        showOutcome('Open refused', code, 'Resolve authoritative authoring state before opening a project file.');
        return false;
      }
      if (file?.kind === 'document' && response.data.outcome === 'opened') {
        productStatus('opening', T.product.documentPath + ' · opening…');
        return applyOpenedProjectStatus(authoringStatus, authoringSnapshot, false);
      }
      if (!file || file.kind !== 'asset' || response.data.outcome !== 'validated') {
        const code = T.product.refusals.runtimeRequestRefused;
        productStatus('refused', 'Project browser refused · ' + code);
        showOutcome('Project browser refused', code, 'The selected asset did not pass canonical validation.');
        return false;
      }
      const selectedAsset = response.data.asset;
      const mountable = response.data.mountable;
      const importedAssets = mountable && Array.isArray(mountable.importedAssets)
        ? mountable.importedAssets
        : [];
      if (!selectedAsset || selectedAsset.instanceId !== file.instanceId ||
          selectedAsset.digest !== file.digest ||
          !importedAssets.some((asset) => asset && asset.instanceId === selectedAsset.instanceId &&
            asset.digest === selectedAsset.digest)) {
        const code = T.product.refusals.runtimeRequestRefused;
        productStatus('refused', 'Asset open refused · ' + code);
        showOutcome('Asset open refused', code, 'The scene bridge did not return the validated asset identity and digest.');
        return false;
      }
      const detail = { mountable, asset: selectedAsset, accepted: false, frame: null };
      document.dispatchEvent(new CustomEvent(T.product.viewportSceneOpenEvent, { detail }));
      if (detail.accepted !== true || !Number.isInteger(detail.frame)) {
        const code = T.product.refusals.runtimeRequestRefused;
        productStatus('refused', 'Asset open refused · ' + code);
        showOutcome('Asset open refused', code, 'The packaged viewport did not accept the canonical asset scene.');
        return false;
      }
      productStatus('open', path + ' · opened at viewport frame ' + detail.frame +
        ' · active authoring target remains ' + response.data.status.activeDocumentPath);
      return true;
    }
    productStatus('open', path + ' · ' + response.data.outcome + ' · active authoring target remains ' +
      response.data.status.activeDocumentPath);
    return true;
  };

  const applyProjectLifecycleStatus = (status) => {
    if (!status || !Array.isArray(status.recents)) return false;
    const previousRoot = activeProject?.root ?? null;
    const candidate = status.active;
    activeProject = candidate && typeof candidate.name === 'string' &&
      typeof candidate.root === 'string' && candidate.documentPath === T.product.documentPath
      ? candidate
      : null;
    if ((activeProject?.root ?? null) !== previousRoot) {
      invalidateDesktopAudio();
      sceneSelectionGeneration += 1;
      clearProjectBrowser();
      // Deferred: this can run while the script is still defining its helpers.
      void Promise.resolve().then(() => resetEditorCommandState());
    }
    const launcher = shell.querySelector('[data-project-launcher]');
    const bound = shell.querySelector('[data-project-bound]');
    if (launcher) launcher.hidden = activeProject !== null;
    if (bound) bound.hidden = activeProject === null;
    q('[data-project-name]').forEach((el) => {
      el.textContent = activeProject === null ? 'No project' : activeProject.name;
    });
    q('[data-project-root]').forEach((el) => {
      el.textContent = activeProject === null ? '' : activeProject.root;
    });
    const recent = shell.querySelector('#project-recent-select');
    if (recent) {
      recent.replaceChildren();
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = status.recents.length === 0 ? 'No recent projects' : 'Choose a recent project';
      recent.append(empty);
      status.recents.forEach((entry) => {
        if (!entry || typeof entry.root !== 'string' || typeof entry.name !== 'string') return;
        const option = document.createElement('option');
        option.value = entry.root;
        option.textContent = entry.name + ' — ' + entry.root;
        recent.append(option);
      });
    }
    if (activeProject !== null) {
      document.title = activeProject.name + ' — ' + activeProject.root + ' — ' +
        activeProject.documentPath + ' — SceneAxi Engine Desktop';
      productStatus('closed', activeProject.name + ' · ' + activeProject.root + ' · ' +
        activeProject.documentPath + ' · ready to open');
    } else {
      document.title = 'SceneAxi Engine Desktop — Choose a project';
      const recovery = status.recovery && typeof status.recovery.reason === 'string'
        ? ' · recovery: ' + status.recovery.reason + ' · choose New Project or Open Project'
        : '';
      productStatus(recovery ? 'refused' : 'closed', 'No project selected' + recovery);
    }
    return true;
  };

  const syncProjectLifecycle = async () => {
    const port = projectPort();
    if (port === null) return;
    const response = await projectRequest({ action: 'status', profile: shell.dataset.profile });
    if (!response || !response.ok || !applyProjectLifecycleStatus(response.data?.status)) {
      productStatus('refused', 'Project lifecycle refused · ' +
        (response?.reason || T.product.refusals.runtimeRequestRefused));
      return;
    }
    if (activeProject !== null) await openProject();
  };

  const chooseProject = async (action) => {
    if (projectRecovering) {
      reportRecoveryRefusal('Project change');
      showOutcome('Project change refused', T.product.refusals.recoveryPending, 'Resolve the pending Save recovery before changing project roots.');
      return;
    }
    if (projectDirty) {
      productStatus('refused', 'Project change refused · ' + T.product.refusals.profileSwitchDirty);
      showOutcome('Project change refused', T.product.refusals.profileSwitchDirty, 'Save or reload the staged proposal before changing project roots.');
      return;
    }
    const recent = shell.querySelector('#project-recent-select');
    const root = recent && typeof recent.value === 'string' ? recent.value : '';
    if ((action === 'open-recent' || action === 'remove-recent') && root.length === 0) {
      productStatus('refused', 'Recent project refused · no validated recent root selected');
      showOutcome('Recent project refused', T.product.refusals.runtimeRequestRefused, 'Choose a validated recent project first.');
      return;
    }
    await beginSceneLifecycleTransition();
    productStatus('opening', action === 'choose-new' ? 'Choose a directory for the explicit starter project…' : 'Choose a project directory…');
    const response = await projectRequest({
      action,
      profile: shell.dataset.profile,
      ...((action === 'open-recent' || action === 'remove-recent') ? { root } : {}),
    });
    if (response === null || !response.ok) {
      const code = response === null ? T.product.refusals.runtimeUnavailable : response.reason;
      productStatus('refused', 'Project lifecycle refused · ' + code);
      showOutcome('Project lifecycle refused', code, response?.message || 'The project root was not changed.');
      return;
    }
    if (!applyProjectLifecycleStatus(response.data?.status)) {
      productStatus('refused', 'Project lifecycle refused · ' + T.product.refusals.runtimeRequestRefused);
      showOutcome('Project lifecycle refused', T.product.refusals.runtimeRequestRefused, 'The host returned no valid project status.');
      return;
    }
    if (response.data.outcome === 'cancelled') {
      productStatus(activeProject === null ? 'closed' : 'open', 'Project selection cancelled · no project bytes changed');
      return;
    }
    projectData = null;
    projectContentHash = null;
    projectDirty = false;
    projectRecovering = false;
    clearSceneProperty();
    undoAvailability = 'unavailable';
    redoAvailability = 'unavailable';
    syncReview(null);
    if (response.data.outcome === 'removed') {
      productStatus(activeProject === null ? 'closed' : 'open', 'Recent project removed · active project unchanged');
      return;
    }
    // Only past this point has a root actually changed. The dock's provenance
    // belongs to the project it was read from, so binding another one must not
    // leave one project's tier, seed, and digests describing another's — while
    // forgetting a recent entry binds nothing and takes nothing away.
    rarityProposalStaged = false;
    clearRarityEvidence(true);
    if (activeProject !== null) await openProject();
  };

  // A refused authoring response carries its own named reason: the document
  // status shape reports \`ok: false\`, a session snapshot reports diagnostics.
  // Both are read here so the host's reason reaches the surface instead of the
  // generic one — \`apply-in-progress\` in particular is the operator's cue that
  // journal recovery, not another click, is what moves this forward.
  const responseDiagnostic = (response) => {
    if (response === null) return {
      code: T.product.refusals.runtimeUnavailable,
      message: T.product.refusals.runtimeUnavailable,
    };
    if (!response.ok) return {
      code: response.reason || T.product.refusals.runtimeRequestRefused,
      message: response.message || T.product.refusals.runtimeRequestRefused,
    };
    const data = response.data;
    const diagnostics = data && Array.isArray(data.diagnostics) ? data.diagnostics : [];
    if (diagnostics.length > 0) {
      return {
        code: diagnostics[0]?.code || T.product.refusals.authoringRefused,
        message: diagnostics[0]?.message || T.product.refusals.authoringRefused,
      };
    }
    if (data && data.ok === false) {
      return {
        code: data.reason || T.product.refusals.authoringRefused,
        message: data.message || T.product.refusals.authoringRefused,
      };
    }
    return null;
  };
  const responseReason = (response) => responseDiagnostic(response)?.code ?? null;
  const isRarityRefusal = (code) => typeof code === 'string' && code.startsWith('RARITY_');
  const commandRequest = (commandId, input) => {
    const command = T.editorCommands.find((candidate) => candidate.id === commandId);
    if (!command || !command.acceptedClients.includes('desktop-control')) {
      return Promise.resolve({
        ok: false,
        reason: 'EDITOR_COMMAND_CLIENT_DENIED',
        message: 'The emitted desktop client does not accept ' + commandId + '.',
      });
    }
    return runtimeRequest({
      action: 'command',
      payload: {
        schemaVersion: command.schemaVersion,
        commandId,
        client: 'desktop-control',
        permission: command.permission,
        profile: shell.dataset.profile,
        input,
      },
    });
  };

  const syncSceneHierarchy = async (restoreReview = false) => {
    const response = await commandRequest('scene-hierarchy-inspect', {
      documentPath: T.product.documentPath,
      profile: shell.dataset.profile,
    });
    if (response?.ok && response.data && typeof response.data === 'object') {
      let reviewRestored = !restoreReview;
      if (restoreReview && isSessionSnapshot(response.data.authoringSnapshot) &&
          reviewProjection(response.data.authoringSnapshot) !== null) {
        reviewRestored = syncReview(response.data.authoringSnapshot);
      }
      const propertiesSynced = syncSceneProperties({ editableScene: response.data });
      return propertiesSynced && reviewRestored;
    }
    const diagnostic = responseDiagnostic(response) || {
      code: T.product.refusals.authoringRefused,
      message: T.product.refusals.authoringRefused,
    };
    return syncSceneProperties({
      editableScene: {
        ok: false,
        reason: diagnostic.code,
        diagnostics: [diagnostic],
      },
    });
  };

  const restartProject = async (diagnostic) => {
    await beginSceneLifecycleTransition();
    productStatus('recovering', T.product.documentPath + ' · ' + diagnostic + ' · re-opening fresh session…');
    const response = await runtimeRequest({
      action: 'authoring',
      payload: { op: 'restart', documentPath: T.product.documentPath },
    });
    if (response === null || !response.ok) {
      clearSceneProperty();
      productStatus('recovering', 'Open refused · ' + diagnostic + ' · ' + responseReason(response));
      return false;
    }
    const status = response.data;
    const reason = responseReason(response);
    projectData = null;
    projectContentHash = null;
    projectDirty = false;
    projectRecovering = false;
    undoAvailability = 'unavailable';
    redoAvailability = 'unavailable';
    let restartedRarityEvidence = null;
    if (rarityProposalStaged) {
      restartedRarityEvidence = activeRarityEvidence;
      rarityProposalStaged = false;
      syncReview(null);
      clearRarityEvidence();
    } else {
      rarityProposalStaged = false;
      syncReview(null);
    }
    if (reason !== null || !status || status.ok !== true || typeof status.data !== 'object' || status.data === null || typeof status.contentHash !== 'string') {
      if (rarityEvidenceText(restartedRarityEvidence) !== null) {
        document.dispatchEvent(new CustomEvent(T.product.rarityProposalEvent, {
          detail: { retired: 'session-restarted', evidence: restartedRarityEvidence },
        }));
      }
      clearSceneProperty();
      if (reason === 'document-not-found' || isRarityRefusal(reason)) clearRarityEvidence(true);
      productStatus('refused', 'Recovery reset · ' + diagnostic + ' · ' + (reason || T.product.refusals.documentDataInvalid));
      return false;
    }
    projectData = status.data;
    projectContentHash = status.contentHash;
    projectContentRoot = activeProject?.root ?? null;
    reconcileRarityEvidence(status);
    if (rarityEvidenceText(restartedRarityEvidence) !== null) {
      const acceptedDigest = status.acceptedRarityEvidence &&
        typeof status.acceptedRarityEvidence === 'object' &&
        typeof status.acceptedRarityEvidence.namespaceDigest === 'string'
        ? status.acceptedRarityEvidence.namespaceDigest
        : null;
      const restartedDigest = restartedRarityEvidence.namespaceDigest;
      document.dispatchEvent(new CustomEvent(T.product.rarityProposalEvent, {
        detail: acceptedDigest === restartedDigest
          ? { settled: 'applied', evidence: restartedRarityEvidence }
          : { retired: 'session-restarted', evidence: restartedRarityEvidence },
      }));
    }
    await syncSceneHierarchy();
    undoAvailability = status.undoAvailability === 'available' || status.undoAvailability === 'recovery-pending'
      ? status.undoAvailability
      : 'unavailable';
    redoAvailability = status.redoAvailability === 'available' || status.redoAvailability === 'recovery-pending'
      ? status.redoAvailability
      : 'unavailable';
    syncCommandAvailability();
    clearConflictOutcome();
    productStatus('open', withSceneRefusal(T.product.documentPath + ' · re-opened after ' + diagnostic + ' · ' + status.documentId));
    return true;
  };

  // Re-opening re-reads the document from the host, so a proposal the host is
  // still holding has to be discarded there rather than only forgotten here:
  // otherwise the shell reports a clean project while the session stays in
  // \`reviewing\`, and the next Save reports "no staged changes" over an edit the
  // host would still have applied.
  const discardStagedProposal = async () => {
    if (!projectDirty) return true;
    const response = await runtimeRequest({ action: 'authoring', payload: { op: 'reject' } });
    const reason = responseReason(response);
    const snapshot = response?.ok ? response.data : null;
    if (reason !== null || !snapshot || snapshot.phase !== 'rejected') {
      productStatus('refused', 'Open refused · ' + (reason || T.product.refusals.proposalNotDiscarded));
      return false;
    }
    projectData = null;
    projectContentHash = null;
    projectDirty = false;
    clearSceneProperty();
    syncReview(snapshot);
    return true;
  };

  const refreshAuthoringState = async () => {
    const response = await runtimeRequest({
      action: 'authoring',
      payload: { op: 'status', documentPath: T.product.documentPath },
    });
    const reason = responseReason(response);
    const status = response?.ok ? response.data : null;
    const statusSnapshot = status && isSessionSnapshot(status.authoringSnapshot)
      ? status.authoringSnapshot
      : null;
    const hierarchyReviewRedacted = statusSnapshot?.phase === 'reviewing' &&
      reviewProjection(statusSnapshot) === null;
    if (statusSnapshot !== null && !hierarchyReviewRedacted) {
      syncReview(statusSnapshot);
    }
    if (reason !== null || !status || status.ok !== true || typeof status.data !== 'object' ||
        status.data === null || typeof status.contentHash !== 'string') {
      if (reason === 'document-not-found' || isRarityRefusal(reason)) {
        clearRarityEvidence(true);
      }
      productStatus('refused', 'Authoring refresh refused · ' +
        (reason || T.product.refusals.documentDataInvalid));
      return false;
    }
    projectData = status.data;
    projectContentHash = status.contentHash;
    projectContentRoot = activeProject?.root ?? null;
    reconcileRarityEvidence(status);
    await syncSceneHierarchy(hierarchyReviewRedacted);
    undoAvailability = status.undoAvailability === 'available' || status.undoAvailability === 'recovery-pending'
      ? status.undoAvailability
      : 'unavailable';
    redoAvailability = status.redoAvailability === 'available' || status.redoAvailability === 'recovery-pending'
      ? status.redoAvailability
      : 'unavailable';
    syncCommandAvailability();
    clearConflictOutcome();
    const reviewing = reviewCount() > 0;
    productStatus(
      reviewing ? 'dirty' : (projectRecovering ? 'recovering' : 'open'),
      reviewing
        ? T.product.documentPath + ' · current proposal restored · review before Save'
        : T.product.documentPath + ' · authoring state refreshed · ' + status.documentId,
    );
    return true;
  };

  const applyOpenedProjectStatus = async (status, authoringSnapshot, synchronizeBrowser) => {
    const hierarchyReviewRedacted = authoringSnapshot?.phase === 'reviewing' &&
      reviewProjection(authoringSnapshot) === null;
    projectData = status.data;
    projectContentHash = status.contentHash;
    projectContentRoot = activeProject?.root ?? null;
    reconcileRarityEvidence(status);
    projectDirty = false;
    projectRecovering = false;
    updateEditorCommandControls();
    await syncSceneHierarchy(hierarchyReviewRedacted);
    undoAvailability = status.undoAvailability === 'available' || status.undoAvailability === 'recovery-pending'
      ? status.undoAvailability
      : 'unavailable';
    redoAvailability = status.redoAvailability === 'available' || status.redoAvailability === 'recovery-pending'
      ? status.redoAvailability
      : 'unavailable';
    syncCommandAvailability();
    if (!hierarchyReviewRedacted) syncReview(authoringSnapshot);
    clearConflictOutcome();
    const reviewing = reviewCount() > 0;
    productStatus(
      reviewing ? 'dirty' : 'open',
      withSceneRefusal(T.product.documentPath +
        (reviewing ? ' · current proposal restored · review before Save' : ' · open · ' + status.documentId)),
    );
    if (synchronizeBrowser) await syncProjectBrowser();
    return true;
  };

  const openProject = async (refuseDirty = false) => {
    invalidateDesktopAudio();
    await beginSceneLifecycleTransition();
    if (activeProject === null && projectPort() !== null) {
      productStatus('refused', 'Open refused · no project root selected');
      showOutcome('Open refused', T.product.refusals.runtimeRequestRefused, 'Choose New Project or Open Project first.');
      return false;
    }
    if (projectRecovering && !refuseDirty) return restartProject('recovery-pending');
    if (!refuseDirty && !(await discardStagedProposal())) return false;
    productStatus('opening', T.product.documentPath + ' · opening…');
    const response = await runtimeRequest({
      action: 'authoring',
      payload: { op: 'status', documentPath: T.product.documentPath },
    });
    const reason = responseReason(response);
    const status = response?.ok ? response.data : null;
    const authoringSnapshot = status && isSessionSnapshot(status.authoringSnapshot)
      ? status.authoringSnapshot
      : null;
    const hierarchyReviewRedacted = authoringSnapshot?.phase === 'reviewing' &&
      reviewProjection(authoringSnapshot) === null;
    if (authoringSnapshot !== null && !hierarchyReviewRedacted) syncReview(authoringSnapshot);
    if (refuseDirty && (authoringSnapshot === null || authoringSnapshot.phase === 'reviewing' ||
        reviewProjection(authoringSnapshot) !== null || authoringSnapshot.phase === 'pending' ||
          authoringSnapshot.journalRecoveryPending === true)) {
      const code = T.product.refusals.projectBrowserDirty;
      productStatus('refused', 'Open refused · ' + code);
      showOutcome('Open refused', code, 'Resolve the authoritative Change Review or recovery state before opening.');
      return false;
    }
    if (reason !== null || !status || status.ok !== true || typeof status.data !== 'object' || status.data === null || typeof status.contentHash !== 'string') {
      clearSceneProperty();
      const code = reason || T.product.refusals.documentDataInvalid;
      if (code === 'document-not-found' || isRarityRefusal(code)) clearRarityEvidence(true);
      productStatus('refused', 'Open refused · ' + code);
      showOutcome('Open refused', code, 'The active Scene Document was not opened.');
      return false;
    }
    const opened = await applyOpenedProjectStatus(status, authoringSnapshot, true);
    if (opened) await runtimeRequest({ action: 'profile', payload: { profile: shell.dataset.profile } });
    return opened;
  };

  const stageWebEdit = async (kind) => {
    // The decision refuses this too; answering before the round trip only keeps
    // a profile that cannot stage from opening a document to be told so.
    if (shell.dataset.profile !== 'web') {
      productStatus('refused', 'Stage refused · ' + T.product.refusals.webCapabilityRequired);
      return;
    }
    if (projectRecovering) {
      reportRecoveryRefusal('Stage');
      return;
    }
    if ((projectData === null || projectContentHash === null) && !(await openProject())) return;
    const decision = webStageDecision(
      {
        profile: shell.dataset.profile,
        documentData: projectData,
        contentHash: projectContentHash,
        kind,
        html: T.product.webStarter.html,
        assetPath: T.product.webStarter.assetPath,
      },
      T.product.stageConfig,
    );
    if (!decision.ok) {
      productStatus('refused', 'Stage refused · ' + decision.reason);
      return;
    }
    const response = await runtimeRequest(decision.request);
    const reason = responseReason(response);
    const snapshot = response?.ok ? response.data : null;
    if (isSessionSnapshot(snapshot)) syncReview(snapshot);
    if (reason !== null || reviewProjection(snapshot) === null) {
      productStatus('refused', 'Stage refused · ' + (reason || T.product.refusals.proposalNotReviewing));
      if (reason === 'content-hash-conflict') {
        showConflictOutcome('Stage refused', snapshot, reason);
      }
      return;
    }
    projectData = decision.request.payload.newValue;
    projectDirty = true;
    projectRecovering = false;
    productStatus('dirty', T.product.documentPath + ' · staged · Save to apply');
  };

  const stageAssetImport = async () => {
    if (shell.dataset.profile !== 'web') {
      productStatus('refused', 'Import refused · ' + T.product.refusals.webCapabilityRequired);
      return;
    }
    // The portable shell fixture has no native dialog. Preserve its bounded
    // pre-existing asset-path proposal; packaged Linux always exposes the picker.
    if (assetImportPort() === null) return stageWebEdit('asset');
    if (projectRecovering) return reportRecoveryRefusal('Import');
    if (projectDirty) {
      productStatus('refused', 'Import refused · ' + T.product.refusals.profileSwitchDirty);
      return;
    }
    if ((projectData === null || projectContentHash === null) && !(await openProject())) return;
    const response = await assetImportRequest({ profile: shell.dataset.profile });
    if (response === null || !response.ok) {
      const code = response === null ? T.product.refusals.runtimeUnavailable : response.reason;
      productStatus('refused', 'Import refused · ' + code);
      showOutcome('Import refused', code, response?.message || 'No asset was staged.');
      return;
    }
    if (response.data?.outcome === 'cancelled') {
      productStatus('open', 'Asset selection cancelled · project bytes unchanged');
      return;
    }
    if (response.data?.outcome === 'replayed') {
      productStatus('open', 'Asset already accepted · canonical project copy verified');
      return;
    }
    const snapshot = response.data?.authoring;
    if (!isSessionSnapshot(snapshot) || reviewProjection(snapshot) === null) {
      productStatus('refused', 'Import refused · ' + T.product.refusals.proposalNotReviewing);
      return;
    }
    syncReview(snapshot);
    const importedData = snapshot.proposal?.edits?.[0]?.newValue;
    if (typeof importedData !== 'object' || importedData === null) {
      productStatus('refused', 'Import refused · ' + T.product.refusals.documentDataInvalid);
      return;
    }
    projectData = importedData;
    projectDirty = true;
    projectRecovering = false;
    const name = response.data?.entry?.sourceName || 'asset';
    productStatus('dirty', name + ' · import staged · review before Save');
  };

  const stageSceneChange = async ({ label, request, requiresSelection, propertyFeedback, refreshScene, authoringSnapshot }) => {
    await sceneSelectionPending;
    if (projectRecovering) {
      reportRecoveryRefusal('Edit');
      return false;
    }
    if (projectDirty) {
      productStatus('refused', 'Edit refused · ' + T.product.refusals.profileSwitchDirty);
      return false;
    }
    if ((projectData === null || projectContentHash === null) && !(await openProject())) return false;
    if (requiresSelection && (selectedSceneEntityId === null || editableScene === null)) {
      productStatus('refused', 'Edit refused · select a composed instance first');
      return false;
    }
    const response = await request(projectContentHash);
    const diagnostic = responseDiagnostic(response);
    const snapshot = response?.ok
      ? (authoringSnapshot ? response.data?.authoringSnapshot || response.data : response.data)
      : null;
    const message = propertyFeedback
      ? shell.querySelector('[data-scene-property-diagnostic]')
      : null;
    // The typed edit parks the same E1 proposal every other staging path does,
    // so Change Review is driven by the returned snapshot here too — and the
    // decidable projection, not the phase alone, is what says it may be shown.
    if (isSessionSnapshot(snapshot)) syncReview(snapshot);
    if (diagnostic !== null || reviewProjection(snapshot) === null) {
      const code = diagnostic?.code || T.product.refusals.proposalNotReviewing;
      const detail = diagnostic?.message || T.product.refusals.proposalNotReviewing;
      if (snapshot?.ok === false && snapshot.hierarchy && Array.isArray(snapshot.entities)) {
        syncSceneProperties({ editableScene: snapshot });
      }
      if (message) message.textContent = code + ' · ' + detail;
      productStatus('refused', 'Edit refused · ' + code + ' · ' + detail);
      if (code === 'content-hash-conflict') {
        showConflictOutcome('Edit refused', snapshot, code);
      }
      return false;
    }
    const edit = Array.isArray(snapshot.proposal?.edits) ? snapshot.proposal.edits[0] : null;
    if (edit && edit.jsonPointer === '/data/composedScene' && projectData && typeof projectData === 'object') {
      projectData = { ...projectData, composedScene: edit.newValue };
    } else if (edit && edit.jsonPointer === '/data' && typeof edit.newValue === 'object' && edit.newValue !== null) {
      projectData = edit.newValue;
    }
    if (refreshScene !== false) syncSceneProperties(snapshot);
    const review = propertyFeedback
      ? shell.querySelector('[data-scene-property-review]')
      : null;
    if (review) {
      review.textContent = String(snapshot.renderedDiff || snapshot.unifiedDiff || 'Proposal staged for review.');
      review.hidden = false;
    }
    if (message) {
      message.textContent = 'Staged · review it in Changes, then Save.';
    }
    projectDirty = true;
    projectRecovering = false;
    const status = T.product.documentPath + ' · ' + label + ' staged · review before Save';
    productStatus('dirty', propertyFeedback ? withSceneRefusal(status) : status);
    return true;
  };

${inspectorPropertyScript()}

  const stageSceneCommand = async (commandId, input, label, options = {}) => stageSceneChange({
    label,
    requiresSelection: false,
    propertyFeedback: false,
    ...options,
    request: (expectedContentHash) => commandRequest(commandId, {
      ...input,
      expectedContentHash,
      profile: shell.dataset.profile,
    }),
  });

${inspectorTransformScript()}

${treeSelectionScript()}

  const applySaveSnapshot = async (snapshot) => {
    if (!isSessionSnapshot(snapshot)) return false;
    syncReview(snapshot);
    const diagnostics = Array.isArray(snapshot.diagnostics) ? snapshot.diagnostics : [];
    const recovering = snapshot.phase === 'pending' || snapshot.journalRecoveryPending === true;
    const applied = snapshot.phase === 'applied' && diagnostics.length === 0;
    if (diagnostics[0]?.code === 'journal-not-found') return false;
    if (recovering) {
      projectRecovering = true;
      const code = typeof diagnostics[0]?.code === 'string' ? ' · ' + diagnostics[0].code : '';
      const transaction = typeof snapshot.transactionId === 'string' ? ' · transaction ' + snapshot.transactionId : '';
      recoveryStatusText = T.product.documentPath + ' · recovery pending' + code + transaction + ' · Save to refresh or Open to re-read';
      productStatus('recovering', recoveryStatusText);
      return true;
    }
    if (applied) {
      reconcileRarityEvidence(snapshot);
      projectData = null;
      projectContentHash = null;
      projectDirty = false;
      projectRecovering = false;
      undoAvailability = 'available';
      syncCommandAvailability();
      // The written document, not the diff of how it got there: the applied
      // proposal is spent, so the review panel goes with it while the panel
      // keeps showing the value the next Play will mount.
      await syncSceneHierarchy();
      if (shell.querySelector('[data-dock-panel="timeline"]')?.hidden === false) await refreshTimeline();
      productStatus('saved', withSceneRefusal(T.product.documentPath + ' · saved'));
      return true;
    }
    return false;
  };

  const saveProject = async (commandId = 'project-save') => {
    if (!projectDirty && !projectRecovering) {
      productStatus(projectData === null ? 'closed' : 'open', T.product.documentPath + ' · no staged changes');
      return;
    }
    const recovering = projectRecovering;
    productStatus(recovering ? 'recovering' : 'saving', T.product.documentPath + (recovering ? ' · refreshing recovery…' : ' · saving…'));
    const response = recovering
      ? await runtimeRequest({ action: 'authoring', payload: { op: 'recover' } })
      : await commandRequest(commandId, {});
    const snapshot = response?.ok ? response.data : null;
    const reason = responseReason(response);
    if (recovering && reason === 'journal-not-found') {
      await restartProject('journal-not-found');
      return;
    }
    if (await applySaveSnapshot(snapshot)) {
      await syncProjectBrowser();
      return;
    }
    if (recovering && snapshot && snapshot.journalRecoveryPending !== true) projectRecovering = false;
    productStatus(projectRecovering ? 'recovering' : 'refused', 'Save refused · ' + (reason || T.product.refusals.applyNotCompleted));
    if (reason === 'content-hash-conflict' || reason === 'journal-conflict') {
      showConflictOutcome('Save refused', snapshot, reason);
    } else {
      showOutcome('Save refused', reason || T.product.refusals.applyNotCompleted, 'No staged document change was reported as saved.');
    }
  };

  // A decision needs a review that was actually validated and projected, so an
  // action started from anywhere refuses by name rather than reaching the host
  // with nothing under review — recovery included, which is not decidable.
  const requireActiveReview = () => {
    if (activeReviewSnapshot !== null) return true;
    setOverlay('none');
    if (projectRecovering) {
      reportRecoveryRefusal('Decision');
    } else if (activeConflictDetail !== null) {
      // The refusal the host last reported about this document is still in the
      // way, so a blocked decision names its own outcome and carries that code
      // as detail rather than replaying the earlier action's whole sentence.
      productStatus(
        'refused',
        'Decision refused · ' + T.product.refusals.proposalNotReviewing +
          ' · ' + activeConflictDetail,
      );
    } else {
      productStatus(
        projectData === null ? 'closed' : 'open',
        T.product.documentPath + ' · nothing under review · ' + T.product.refusals.proposalNotReviewing,
      );
    }
    return false;
  };

  // Accept is one half of the all-or-nothing decision, so it is gated on the
  // same validated review Reject is rather than on the dirty flag: a decision
  // taken with nothing under review refuses by name instead of sending the
  // document action underneath it. Save itself is not a decision and keeps its
  // own path, which is why the gate lives here and not in \`saveProject\`.
  const acceptProposal = async () => {
    if (!requireActiveReview()) return false;
    await saveProject('change-review-accept');
    return true;
  };

  // Reject is the other half of the all-or-nothing decision: it discards the
  // host's one active proposal and re-opens the document, so the surface reports
  // the bytes on disk rather than a queue it decided locally.
  const rejectProposal = async (outcome = 'rejected') => {
    if (!requireActiveReview()) return false;
    const response = await commandRequest('change-review-reject', {});
    const reason = responseReason(response);
    const snapshot = response?.ok ? response.data : null;
    if (reason !== null || !isSessionSnapshot(snapshot) || snapshot.phase !== 'rejected') {
      const code = reason || T.product.refusals.proposalNotDiscarded;
      productStatus('refused', 'Reject refused · ' + code);
      showOutcome('Reject refused', code, 'The staged proposal was not discarded and no document was written.');
      return false;
    }
    syncReview(snapshot);
    projectDirty = false;
    projectRecovering = false;
    projectData = null;
    projectContentHash = null;
    const opened = await openProject();
    if (opened) {
      productStatus('open', T.product.documentPath + ' · ' + outcome + ' · no document written');
    }
    return opened;
  };

  // The host's undo clears its own proposal along with the apply it reverses,
  // so a staged edit would go with it. Every other path here that can lose one
  // either refuses by name or discards it explicitly; this one refuses.
  const undoProject = async () => {
    if (undoAvailability !== 'available') return;
    if (projectDirty) {
      const code = T.product.refusals.undoStagedProposal;
      productStatus('refused', 'Undo refused · ' + code);
      showOutcome('Undo refused', code, 'Save the staged proposal or re-open the project to discard it before undoing the last Save.');
      return;
    }
    productStatus('undoing', T.product.documentPath + ' · undoing last completed Save…');
    const response = await commandRequest('edit-undo', {});
    const reason = responseReason(response);
    const result = response?.ok ? response.data : null;
    if (reason !== null || !result || result.ok !== true || !Array.isArray(result.restoredPaths)) {
      const code = reason || T.commandRefusals.undoUnavailable;
      productStatus('refused', 'Undo refused · ' + code);
      showOutcome('Undo refused', code, 'The host did not restore a completed Save.');
      return;
    }
    projectData = null;
    projectContentHash = null;
    projectDirty = false;
    projectRecovering = false;
    rarityProposalStaged = false;
    const reopened = await openProject();
    // Whether the provenance is still real is a question the reopened document
    // answers: an Undo that reverted the rarity apply leaves no namespace to
    // describe, and one that reverted an unrelated Save leaves it exactly where
    // it was. Clearing on the reverted-rarity case alone keeps the dock from
    // both lies — digests for bytes that are gone, and an empty state over bytes
    // that are still there.
    if (reopened) {
      productStatus('open', 'Undid last Save · restored ' + result.restoredPaths.join(', '));
    }
  };

  const redoProject = async () => {
    if (redoAvailability !== 'available') return;
    if (projectDirty) {
      const code = T.product.refusals.undoStagedProposal;
      productStatus('refused', 'Redo refused · ' + code);
      showOutcome('Redo refused', code, 'Accept or reject the staged proposal before changing committed history.');
      return;
    }
    productStatus('redoing', T.product.documentPath + ' · redoing next Save…');
    const response = await commandRequest('edit-redo', {});
    const reason = responseReason(response);
    const result = response?.ok ? response.data : null;
    if (reason !== null || !result || result.ok !== true || !Array.isArray(result.restoredPaths)) {
      const code = reason || T.commandRefusals.redoUnavailable;
      productStatus('refused', 'Redo refused · ' + code);
      showOutcome('Redo refused', code, 'The host did not restore the next durable Save.');
      return;
    }
    projectData = null;
    projectContentHash = null;
    projectDirty = false;
    projectRecovering = false;
    const reopened = await openProject();
    if (reopened) productStatus('open', 'Redid Save · restored ' + result.restoredPaths.join(', '));
  };

  // Every element that can start a product action, whichever surface it sits on:
  // the same command reachable from a menu, a palette row, and a title-bar
  // button is one operation, so all three carry the in-flight refusal, not only
  // the one that happens to be marked as a product action. The palette opener is
  // excluded because opening the palette is not a product action and stays
  // available while one is outstanding.
  const productActionControls = () => {
    const seen = [];
    q('[data-product-action]').forEach((el) => { if (!seen.includes(el)) seen.push(el); });
    q('[data-command]').forEach((el) => {
      if (el.dataset.command === T.paletteShortcut.id) return;
      if (!seen.includes(el)) seen.push(el);
    });
    return seen;
  };

  // Serialize the product loop: the host holds one session and one proposal, so
  // a second action started before the first answers is not concurrency, it is a
  // lost edit. The controls are inert for the duration, which is the surface's
  // own vocabulary for "this cannot act right now".
  const productAction = async (run) => {
    if (inFlight) return;
    inFlight = true;
    productActionControls().forEach((el) => {
      el.dataset.busy = 'true';
      setRefusal(el, T.product.refusals.requestInFlight);
    });
    try {
      await run();
    } finally {
      inFlight = false;
      // Cleared unconditionally, then re-decided: a control whose id the profile
      // table does not carry must not stay disabled because a request finished.
      productActionControls().forEach((el) => {
        delete el.dataset.busy;
        setRefusal(el, null);
        applyControl(el);
      });
      syncCommandAvailability();
    }
  };

${viewportScript()}

${settingsShipScript()}

  const switchProfile = async (value) => {
    if (shell.dataset.profile === value) return;
    if (projectRecovering) {
      reportRecoveryRefusal('Profile switch');
      return;
    }
    if (projectDirty) {
      productStatus('refused', 'Profile switch refused · ' + T.product.refusals.profileSwitchDirty);
      return;
    }
    const response = await runtimeRequest({ action: 'profile', payload: { profile: value } });
    if (response !== null && !response.ok) {
      const code = response.reason || T.product.refusals.runtimeUnavailable;
      productStatus('refused', 'Profile switch refused · ' + code);
      return;
    }
    await beginSceneLifecycleTransition();
    if (typeof Event !== 'undefined') document.dispatchEvent(new Event(T.product.viewportStopEvent));
    editorPlaySessionActive = false;
    updateEditorCommandControls();
    shell.dataset.profile = value;
    q('.profile-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.value === value)));
    const promptField = shell.querySelector('#assistant-prompt');
    if (promptField instanceof HTMLTextAreaElement) {
      promptField.placeholder = value === 'web'
        ? 'Ask Flash for a Three.js hero or a headline animation'
        : 'Tell Flash what to make';
    }
    setProfile(value);
  };

  const showModePanels = (mode) => {
    shell.dataset.mode = mode;
    q('[data-mode-panel]').forEach((el) => { el.hidden = el.dataset.modePanel !== mode; });
    q('.rail-mode').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.value === mode)));
    const dock = shell.querySelector('.dock');
    if (dock) dock.style.setProperty('--dock-h', T.dockHeightByMode[mode] + 'px');
    buildDockTabs(mode, T.dockTabsByMode[mode][0]);
  };

${dockTabsScript()}

  // Roving tabindex takes the non-active tabs out of the Tab order, so the arrow
  // keys are what makes them reachable at all. Dock tabs activate on move; the
  // viewport tabs only take focus, which is all a click does there either.
  const moveTab = (event) => {
    const from = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
    if (from === null) return;
    const list = from.closest('[role="tablist"]');
    if (list === null) return;
    const stops = Array.from(list.querySelectorAll('[role="tab"]'));
    const at = stops.indexOf(from);
    if (at === -1) return;
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (at + 1) % stops.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (at - 1 + stops.length) % stops.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = stops.length - 1;
    else return;
    event.preventDefault();
    const target = stops[next];
    if (target.dataset.action === 'dock-tab' && target.dataset.value) selectDockTab(target.dataset.value);
    else stops.forEach((el) => { el.tabIndex = el === target ? 0 : -1; });
    target.focus();
  };

  // An overlay declares aria-modal, so the rest of the document must really be
  // out of reach: focus moves in on open, Tab wraps inside the dialog, and the
  // control that opened it gets focus back on close.
  let overlayReturn = null;

  // Every button in the dialog, inert ones included: an inert control keeps its
  // native focus stop, so a trap that dropped it would hand Tab to an element it
  // does not contain and then bounce focus back to the first stop, leaving the
  // rows after it unreachable — and on a profile where every row is inert it
  // would contain nothing at all.
  const overlayStops = () => {
    const open = shell.querySelector('.overlay:not([hidden])');
    return open === null ? [] : Array.from(open.querySelectorAll('button, input:not([disabled]), textarea:not([disabled]), select:not([disabled])'));
  };

  const setOverlay = (id) => {
    // Pending replies must not reopen a dialog behind the size refusal.
    if (minimumWindowQuery.matches && id !== 'none') return;
    const wasOpen = shell.dataset.overlay !== 'none';
    if (id !== 'none' && !wasOpen) {
      const active = document.activeElement;
      overlayReturn = active !== null && typeof active.focus === 'function' ? active : null;
    }
    shell.dataset.overlay = id;
    q('.overlay').forEach((el) => { el.hidden = el.dataset.overlay !== id; });
    if (id === 'none') {
      const back = overlayReturn;
      overlayReturn = null;
      if (!minimumWindowQuery.matches && back !== null && shell.contains(back)) back.focus();
      return;
    }
    const stops = overlayStops();
    if (stops.length === 0) return;
    // Containment covers every stop; the opening move prefers one that can act.
    const entry = stops.find((el) => el.getAttribute('aria-disabled') !== 'true');
    (entry || stops[0]).focus();
  };

  // The legend row the document already renders for every registry code is the
  // one copy of that sentence, so the dialog cannot name a reason the disclosure
  // explains differently.
  const refusalMessage = (code) => {
    const row = shell.querySelector('#refusal-' + code);
    if (row === null) return '';
    const text = String(row.textContent);
    return (text.startsWith(code) ? text.slice(String(code).length) : text).trim();
  };

  // A refused command is not a project state: the operation it collided with may
  // still be running, so this names the reason in the outcome dialog and leaves
  // the project pill and its status reporting the project.
  const commandRefusal = (code) => {
    showOutcome(
      'Command refused',
      code,
      refusalMessage(code) || 'This desktop refused the requested command.',
    );
  };

  const showOutcome = (title, code, message) => {
    q('[data-outcome-mark]').forEach((el) => {
      const complete = code === 'COMMAND_COMPLETED';
      el.classList.toggle('mark-complete', complete);
      el.classList.toggle('mark-refuse', !complete);
      el.textContent = complete ? '✓' : '!';
    });
    q('[data-outcome-title]').forEach((el) => { el.textContent = String(title); });
    q('[data-outcome-code]').forEach((el) => { el.textContent = String(code); });
    q('[data-outcome-message]').forEach((el) => { el.textContent = String(message); });
    setOverlay('outcome');
  };

  const menuTrigger = (panel) => {
    const root = panel.closest('[data-menu-root]');
    return root === null ? null : root.querySelector('[data-menu-trigger]');
  };

  const hideMenus = () => {
    q('.menu-panel').forEach((panel) => { panel.hidden = true; });
    q('[data-menu-trigger]').forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
  };

  // Hiding the panel under the caret would drop focus to the body and restart
  // the Tab order at the top of the document, so the menu hands focus back to
  // the trigger that owns it — the same return the overlay makes. Only the
  // paths that dismiss a menu while focus is still inside it restore; a
  // dismissal caused by focus leaving must not pull it back.
  const closeMenus = () => {
    const active = document.activeElement;
    let restore = null;
    q('.menu-panel').forEach((panel) => {
      if (!panel.hidden && active !== null && panel.contains(active)) {
        restore = menuTrigger(panel);
      }
    });
    hideMenus();
    if (!minimumWindowQuery.matches && restore !== null && typeof restore.focus === 'function') restore.focus();
  };

  // The CSS refusal is a sibling of the hidden shell. Mirror its actual media
  // state for navigation, dismiss covered UI, and return to the original opener
  // only once the editor can be used again. Resizing is the only dismissal.
  const windowRefusal = document.querySelector('.window-refusal');
  let minimumWindowReturn = null;
  const syncMinimumWindow = () => {
    const refused = minimumWindowQuery.matches;
    const wasRefused = shell.dataset.window === 'refused';
    // Capture focus before hiding the refusal: browsers can blur hidden nodes.
    const refusalHadFocus = document.activeElement === windowRefusal;
    shell.dataset.window = refused ? 'refused' : 'ready';
    shell.inert = refused;
    if (windowRefusal) {
      windowRefusal.dataset.window = shell.dataset.window;
      windowRefusal.hidden = !refused;
    }
    if (refused && !wasRefused) {
      const active = document.activeElement;
      const menu = active && typeof active.closest === 'function' ? active.closest('.menu-panel') : null;
      minimumWindowReturn = overlayReturn || (menu ? menuTrigger(menu) : (shell.contains(active) ? active : null));
      setOverlay('none');
      closeMenus();
      shell.dataset.drawerLeft = 'closed';
      shell.dataset.drawerInspector = 'closed';
      shell.dataset.drawerAssistant = 'closed';
      q('.drawer-toggle, .assistant-toggle').forEach((el) => el.setAttribute('aria-expanded', 'false'));
      const legend = shell.querySelector('#refusal-legend');
      if (legend) legend.hidden = true;
      q('[data-action="refusal-help"]').forEach((el) => el.setAttribute('aria-expanded', 'false'));
      if (windowRefusal) {
        windowRefusal.tabIndex = -1;
        windowRefusal.focus();
      }
    } else if (!refused && wasRefused) {
      const back = minimumWindowReturn;
      minimumWindowReturn = null;
      if (!refusalHadFocus) return;
      if (back && shell.contains(back) && !back.closest('[hidden], [inert]') && back.getClientRects().length > 0) back.focus();
      else { shell.tabIndex = -1; shell.focus(); }
    }
  };
  minimumWindowQuery.addEventListener('change', syncMinimumWindow);

  // The panel declares role="menu", so the arrow keys have to move between its
  // items for that role to be true. The items keep their plain Tab stop as
  // well: an inert control that stays findable is this surface's own rule.
  const moveMenuItem = (event) => {
    const from = event.target instanceof Element ? event.target.closest('[role="menuitem"]') : null;
    if (from === null) return false;
    const panel = from.closest('.menu-panel');
    if (panel === null || panel.hidden) return false;
    const items = Array.from(panel.querySelectorAll('[role="menuitem"]'));
    const at = items.indexOf(from);
    if (at === -1) return false;
    let next = -1;
    if (event.key === 'ArrowDown') next = (at + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (at - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return false;
    event.preventDefault();
    const target = items[next];
    if (target && typeof target.focus === 'function') target.focus();
    return true;
  };

  const toggleMenu = (id) => {
    const trigger = shell.querySelector('[data-menu-trigger="' + id + '"]');
    const panel = shell.querySelector('#menu-panel-' + id);
    if (!trigger || !panel) return;
    const open = panel.hidden;
    closeMenus();
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      const first = panel.querySelector('[role="menuitem"]:not([aria-disabled="true"])');
      if (first && typeof first.focus === 'function') first.focus();
    }
  };

${assistantScript()}
  const compactDrawerQuery = window.matchMedia('${belowTier("compact")}');
  // Undocked panels occlude the viewport/dock. Keep covered controls out of
  // keyboard and pointer navigation until the drawer is closed again.
  const syncDrawerNavigation = () => {
    const assistantDrawer = drawerQuery.matches && shell.dataset.assistant !== 'denied' && shell.dataset.drawerAssistant === 'open';
    const leftDrawer = compactDrawerQuery.matches && shell.dataset.drawerLeft === 'open';
    const inspectorDrawer = compactDrawerQuery.matches && shell.dataset.drawerInspector === 'open';
    q('.viewport-region, .dock').forEach((el) => { el.inert = assistantDrawer || leftDrawer || inspectorDrawer; });
    q('.left-dock').forEach((el) => { el.inert = assistantDrawer || inspectorDrawer; });
    q('.inspector').forEach((el) => { el.inert = assistantDrawer || leftDrawer; });
  };
  const drawerNavigationObserver = new MutationObserver(syncDrawerNavigation);
  drawerNavigationObserver.observe(shell, { attributes: true, attributeFilter: ['data-drawer-left', 'data-drawer-inspector', 'data-drawer-assistant', 'data-assistant'] });
  drawerQuery.addEventListener('change', syncDrawerNavigation);
  compactDrawerQuery.addEventListener('change', syncDrawerNavigation);
  window.addEventListener('pagehide', () => {
    drawerNavigationObserver.disconnect();
    drawerQuery.removeEventListener('change', syncDrawerNavigation);
    compactDrawerQuery.removeEventListener('change', syncDrawerNavigation);
  }, { once: true });
  syncDrawerNavigation();

  // An inert control keeps its focus stop and names its refusal, so a control
  // that becomes inert in the browser has to gain all of that, not just dim.
  const setRefusal = (el, code) => {
    if (el === null) return;
    if (code) {
      el.classList.add('is-inert');
      el.setAttribute('aria-disabled', 'true');
      el.setAttribute('aria-describedby', 'refusal-' + code);
      el.dataset.refusal = code;
      if ('readOnly' in el) el.readOnly = true;
    } else {
      el.classList.remove('is-inert');
      el.removeAttribute('aria-disabled');
      el.removeAttribute('aria-describedby');
      delete el.dataset.refusal;
      if ('readOnly' in el) el.readOnly = false;
    }
  };

  // Every rendered control, not a list of selectors: the model already decided
  // what each control is on each profile, and a list of the ones to update is a
  // list that has to be edited whenever a control is added.
  const applyControl = (el) => {
    const runtime = T.assistantRuntimeRows[shell.dataset.assistantRuntime];
    const row = ((runtime && runtime.controlsByProfile[shell.dataset.profile]) || {})[el.id];
    if (!row) return;
    const refusal = row[1];
    el.dataset.kind = refusal ? 'inert' : row[0];
    setRefusal(el, refusal);
  };

  const applyProfileControls = () => q('[data-kind]').forEach(applyControl);

  const syncCommandAvailability = () => {
    q('[data-command]').forEach((el) => {
      if (el.dataset.command !== 'edit-undo' && el.dataset.command !== 'edit-redo') return;
      applyControl(el);
      if (shell.dataset.profile !== 'kids') {
        const isRedo = el.dataset.command === 'edit-redo';
        const availability = isRedo ? redoAvailability : undoAvailability;
        const available = !inFlight && availability === 'available';
        el.dataset.kind = available ? 'live' : 'inert';
        setRefusal(
          el,
          available
            ? null
            : inFlight
              ? T.product.refusals.requestInFlight
              : availability === 'recovery-pending'
              ? T.product.refusals.recoveryPending
              : isRedo ? T.commandRefusals.redoUnavailable : T.commandRefusals.undoUnavailable,
        );
      }
    });
  };

  // A drawer opened before the switch must not keep announcing itself expanded
  // over a region the new profile's refusal removes. Read after the controls are
  // applied, so the toggle the profile just made inert is the one that closes —
  // the same reset setAssistant() already does for its own drawer.
  const closeRefusedDrawers = () => {
    q('.drawer-toggle').forEach((el) => {
      if (el.getAttribute('aria-disabled') !== 'true') return;
      shell.dataset[el.dataset.value === 'left' ? 'drawerLeft' : 'drawerInspector'] = 'closed';
      el.setAttribute('aria-expanded', 'false');
    });
  };

  const setProfile = (id) => {
    const runtime = T.assistantRuntimeRows[shell.dataset.assistantRuntime];
    const seat = runtime && runtime.assistantByProfile[id];
    if (!seat) return;
    setAssistant(seat.state);
    q('[data-assistant-model]').forEach((el) => { el.textContent = seat.modelLabel; });
    const pin = T.pinByProfile[id];
    if (pin) q('[data-profile-pin]').forEach((el) => { el.textContent = pin; });
    applyProfileControls();
    syncCommandAvailability();
    closeRefusedDrawers();
    // The column the profile restores is still a drawer in the tiers that undock
    // it, and leaving a refusal is not opening a drawer.
    syncAssistantTier();
  };

  document.addEventListener(T.assistantRuntimeEvent, (event) => {
    const detail = event && event.detail;
    if (!detail || !T.assistantRuntimeRows[detail.runtime]) return;
    shell.dataset.assistantRuntime = detail.runtime;
    setProfile(shell.dataset.profile);
    const status = shell.querySelector('[data-assistant-status]');
    if (status && typeof detail.message === 'string') {
      status.textContent = T.assistantRuntimeRefusal + ' — ' + detail.message;
    }
  });

${settingsScript()}

${dockTimelineScript()}

  const focusEditorCommandForm = (commandId) => {
    if (['physics-evaluate', 'scene-prefab-inspect', 'scene-prefab-define', 'scene-prefab-instance',
      'scene-prefab-override', 'scene-prefab-refresh', 'package-install', 'package-remove', 'extension-start'].includes(commandId)) {
      showModePanels('build');
    }
    const field = shell.querySelector('[data-editor-command-form="' + commandId + '"] [data-command-field]');
    if (field) field.focus();
    const refusal = shell.querySelector('[data-editor-command-refusal="' + commandId + '"]');
    if (refusal) refusal.textContent = 'Fill in the form here. The command is not sent from the menu until its inputs are ready.';
  };

  const commandHandlers = Object.freeze({
    'project-new': () => chooseProject('choose-new'),
    'project-open': () => chooseProject('choose-open'),
    'project-save': saveProject,
    'project-git-status': () => inspectProjectRepository('project-git-status'),
    'project-git-diff': () => inspectProjectRepository('project-git-diff'),
    'project-git-stage': () => mutateProjectRepository('project-git-stage'),
    'project-git-commit-prepare': () => mutateProjectRepository('project-git-commit-prepare'),
    'ship-export-web': exportWeb,
    'edit-undo': undoProject,
    'edit-redo': redoProject,
    'run-play': playScene,
    'run-stop': () => runControl('run-stop'),
    'run-reset': () => runControl('run-reset'),
    'physics-inspect': () => inspectCatalog('physics', 'physics-inspect'),
    'environment-inspect': () => inspectCatalog('environment', 'environment-inspect'),
    'material-inspect': () => inspectCatalog('material', 'material-inspect'),
    'effect-inspect': () => inspectCatalog('effect', 'effect-inspect'),
    ...Object.fromEntries([
      'package-inspect', 'package-install', 'package-remove',
      'workspace-layout-inspect', 'workspace-layout-apply', 'workspace-layout-reset',
      'project-migration-propose', 'project-migration-commit', 'project-migration-recover',
      'project-build', 'extension-inspect', 'extension-start', 'profile-inspect',
      'project-inspect', 'input-actions-inspect', 'input-action-rebind', 'input-actions-reset',
      'physics-evaluate', 'scene-prefab-inspect', 'scene-prefab-define', 'scene-prefab-instance',
      'scene-prefab-override', 'scene-prefab-refresh',
    ].map((id) => [id, () => ['package-install', 'package-remove', 'project-migration-commit', 'extension-start',
      'input-action-rebind', 'input-actions-reset', 'scene-prefab-define', 'scene-prefab-instance',
      'scene-prefab-override', 'scene-prefab-refresh', 'viewport-source-set', 'physics-evaluate'].includes(id) ? focusEditorCommandForm(id) : runEditorCommand(id)])),

  });

  const executeCommand = (id) => {
    if (minimumWindowQuery.matches) return;
    closeMenus();
${paletteScript()}
    const registryCommand = T.editorCommands.find((candidate) => candidate.id === id);
    const exposedCommand = T.commands.find((candidate) => candidate.id === id);
    if (!registryCommand || !registryCommand.acceptedClients.includes('desktop-control') ||
        (exposedCommand !== undefined &&
          (exposedCommand.schemaVersion !== registryCommand.schemaVersion ||
            exposedCommand.permission !== registryCommand.permission))) {
      commandRefusal('EDITOR_COMMAND_REGISTRY_INVALID');
      return;
    }
    const handler = commandHandlers[id];
    if (typeof handler !== 'function') return;
    // Read the state, not one element's attributes: an accelerator reaches this
    // without ever touching a control, so a second press during a round trip has
    // to name the refusal instead of disappearing.
    if (inFlight) {
      commandRefusal(T.product.refusals.requestInFlight);
      return;
    }
    const representative = q('[data-command]').find((el) => el.dataset.command === id);
    if (representative?.getAttribute('aria-disabled') === 'true') {
      commandRefusal(representative.dataset.refusal || T.product.refusals.runtimeRequestRefused);
      return;
    }
    setOverlay('none');
    void productAction(handler);
  };

  shell.addEventListener('input', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-editor-command-form], [data-command-field="source"]')) {
      updateEditorCommandControls();
    }
  });

  shell.addEventListener('change', (event) => {
    if (event.target instanceof Element && event.target.matches('[data-command-field="source"]')) updateEditorCommandControls();
  });

  // Changing a reviewed input-action request invalidates its review: Approve
  // would otherwise commit a digest the user no longer sees.
  const invalidateEditedReview = (event) => {
    const form = event.target instanceof Element ? event.target.closest('[data-editor-command-form]') : null;
    const id = form?.getAttribute('data-editor-command-form');
    if (editorInputActionReview !== null && editorInputActionReview.commandId === id) clearInputActionReview();
  };
  shell.addEventListener('input', invalidateEditedReview);
  shell.addEventListener('change', invalidateEditedReview);

  shell.addEventListener('click', (event) => {
    if (minimumWindowQuery.matches) return;
    const command = event.target instanceof Element ? event.target.closest('[data-command]') : null;
    if (command && command.getAttribute('aria-disabled') !== 'true') {
      executeCommand(command.dataset.command);
      return;
    }
    const menu = event.target instanceof Element ? event.target.closest('[data-menu-trigger]') : null;
    if (menu && menu.getAttribute('aria-disabled') !== 'true') {
      toggleMenu(menu.dataset.menuTrigger);
      return;
    }
    const el = event.target instanceof Element ? event.target.closest('[data-action]') : null;
    if (!el || el.getAttribute('aria-disabled') === 'true') return;
    const action = el.dataset.action;
    const value = el.dataset.value;
    if (action === 'editor-command-submit' && value) {
      void productAction(() => runEditorCommand(value));
    }
    else if (action === 'editor-command-review' && value) {
      void productAction(() => runEditorCommand(value, true));
    }
    else if (action === 'drawer' && value) {
      const key = value === 'left' ? 'drawerLeft' : 'drawerInspector';
      const open = shell.dataset[key] !== 'open';
      shell.dataset[key] = open ? 'open' : 'closed';
      el.setAttribute('aria-expanded', String(open));
      return;
    }
    if (action === 'project-open-recent') void productAction(() => chooseProject('open-recent'));
    else if (action === 'project-remove-recent') void productAction(() => chooseProject('remove-recent'));
    else if (action === 'project-browser-open') {
      const path = projectBrowserStatus?.selectedPath;
      if (typeof path === 'string') void productAction(() => projectBrowserAction('open', path));
    }
    else if (action === 'document-reload') void productAction(openProject);
    else if (action === 'change-accept') void productAction(acceptProposal);
    else if (action === 'change-reject') void productAction(() => rejectProposal('rejected'));
    else if (action === 'scene-entity-select' && value) {
      const primary = el.tagName === 'SELECT' ? el.value : value;
      if (primary && showSceneProperty(primary)) {
        if (shell.dataset.mode !== 'build') showModePanels('build');
        if (el.tagName !== 'SELECT') queueSceneSelection();
      }
    }
    else if (action === 'scene-property-stage') void productAction(stageSceneProperty);
    else if (action === 'catalog-stage' && value) void productAction(() => stageCatalog(value));
    else if (action === 'scene-transform-mode' && value) {
      shell.dataset.transformMode = value;
    }
    else if (action === 'scene-transform-nudge') {
      const axis = el.dataset.axis;
      const sign = Number(el.dataset.sign);
      if (axis === 'x' || axis === 'y' || axis === 'z') {
        void productAction(() => nudgeSceneTransform(axis, Number.isFinite(sign) ? sign : 1));
      }
    }
    else if (action === 'scene-instance-add') void productAction(() => stageSceneInstance('add-instance'));
    else if (action === 'scene-instance-remove') void productAction(() => stageSceneInstance('remove-instance'));
    else if (action === 'scene-instance-reparent') void productAction(stageSceneReparent);
    else if (action === 'web-stage-html') void productAction(() => stageWebEdit('html'));
    else if (action === 'web-inject-asset') void productAction(stageAssetImport);
    else if (action === 'mode' && value) showModePanels(value);
    else if (action === 'dock-tab' && value) selectDockTab(value);
    else if (action === 'timeline-apply') void productAction(applyTimelineMutation);
    else if (action === 'timeline-scrub') void productAction(scrubTimeline);
    else if (action === 'timeline-evaluate') void productAction(evaluateTimeline);
    else if (action === 'overlay') setOverlay(value || 'none');
    else if (action === 'refusal-help') {
      const panel = shell.querySelector('#refusal-legend');
      if (panel) {
        const open = panel.hidden;
        panel.hidden = !open;
        el.setAttribute('aria-expanded', String(open));
      }
    }
    else if (action === 'profile' && value) void productAction(() => switchProfile(value));
    else if (action === 'assistant') {
      if (shell.dataset.assistant === 'denied') return;
      setAssistant(assistantOpen() ? 'closed' : 'open');
    } else if (action === 'assistant-mode' && value) {
      shell.dataset.assistantMode = value;
      q('.assistant-mode').forEach((m) => m.setAttribute('aria-pressed', String(m.dataset.value === value)));
      const promptField = shell.querySelector('#assistant-prompt');
      if (promptField instanceof HTMLTextAreaElement && promptField.getAttribute('aria-disabled') !== 'true') {
        promptField.focus();
      }
      const status = shell.querySelector('[data-assistant-status]');
      if (status) {
        status.textContent = value === 'ask'
          ? 'Light · Flash will keep it simple. Type, then Send.'
          : value === 'agent'
            ? 'Strong · Flash will go further. Type, then Send.'
            : 'Mid · Flash will make the usual pass. Type, then Send.';
      }
    } else if (action === 'assistant-route' && value) {
      shell.dataset.assistantRoute = value;
      q('.assistant-route').forEach((m) => m.setAttribute('aria-pressed', String(m.dataset.value === value)));
    }
  });

  shell.addEventListener('change', (event) => {
    const browserFile = event.target instanceof Element
      ? event.target.closest('[data-action="project-browser-select"]')
      : null;
    if (browserFile && browserFile.tagName === 'SELECT') {
      if (browserFile.getAttribute('aria-disabled') === 'true') {
        if (typeof projectBrowserStatus?.selectedPath === 'string') {
          browserFile.value = projectBrowserStatus.selectedPath;
        }
        return;
      }
      const path = browserFile.value;
      if (path) {
        if (typeof projectBrowserStatus?.selectedPath === 'string') {
          browserFile.value = projectBrowserStatus.selectedPath;
        }
        void productAction(() => projectBrowserAction('select', path));
      }
      return;
    }
    const el = event.target instanceof Element ? event.target.closest('[data-action="scene-entity-select"]') : null;
    if (!el || el.tagName !== 'SELECT' || el.getAttribute('aria-disabled') === 'true') return;
    selectedSceneEntityIds = Array.from(el.selectedOptions).map((option) => option.value).filter(Boolean);
    if (selectedSceneEntityIds[0]) {
      showSceneProperty(selectedSceneEntityIds[0]);
      if (shell.dataset.mode !== 'build') showModePanels('build');
    }
    queueSceneSelection();
  });

  // Tab is deliberately not captured inside a menu — every item keeps its plain
  // focus stop — so leaving the menu root by keyboard is the one dismissal the
  // click and Escape paths cannot see. Focus is already elsewhere here, so the
  // panel is hidden without the trigger return.
  shell.addEventListener('focusout', (event) => {
    const root = event.target instanceof Element ? event.target.closest('[data-menu-root]') : null;
    if (root === null) return;
    const panel = root.querySelector('.menu-panel');
    if (panel === null || panel.hidden) return;
    const next = event.relatedTarget;
    if (next instanceof Element && root.contains(next)) return;
    hideMenus();
  });

  // A dropped-down menu floats over the surface below it, so any click that is
  // not inside a menu closes it — including one outside the shell entirely,
  // which is why this listens on the document.
  document.addEventListener('click', (event) => {
    const root = event.target instanceof Element ? event.target.closest('[data-menu-root]') : null;
    if (root === null) closeMenus();
  });

  const isTextEntryTarget = (target) => {
    if (!(target instanceof Element)) return false;
    if (target.closest('input, textarea') !== null) return true;
    if (target instanceof HTMLElement && target.isContentEditable) return true;
    let current = target;
    while (current !== null) {
      const attribute = current.getAttribute('contenteditable');
      if (attribute !== null) {
        const value = attribute.trim().toLowerCase();
        if (value === 'false') return false;
        if (value === '' || value === 'true' || value === 'plaintext-only') return true;
      }
      current = current.parentElement;
    }
    return false;
  };

  // On the document, not the shell: once focus is inside a dialog the shell is
  // still the ancestor, but a restored or lost focus must not silently drop the
  // Escape key, and the trap has to see every Tab.
  document.addEventListener('keydown', (event) => {
    if (minimumWindowQuery.matches) return;
    const action = resolveKeyboardAction(event);
    if (action && (action.id === T.paletteShortcut.actionId || action.commandId)) {
      const textEntry = isTextEntryTarget(event.target);
      if (!textEntry || action.allowInTextEntry) {
        event.preventDefault();
        if (action.id === T.paletteShortcut.actionId) executeCommand(T.paletteShortcut.id);
        else if (action.commandId) executeCommand(action.commandId);
        return;
      }
    }
    if (shell.dataset.overlay === 'none') {
      if (event.key === 'Escape') { closeMenus(); return; }
      if (moveMenuItem(event)) return;
      moveTab(event);
      return;
    }
    if (event.key === 'Escape') { setOverlay('none'); return; }
    if (event.key !== 'Tab') return;
    const stops = overlayStops();
    if (stops.length === 0) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = document.activeElement;
    const inside = stops.indexOf(active) !== -1;
    if (event.shiftKey ? active === first || !inside : active === last || !inside) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });

  // A replay staged nothing, so it moves no proposal into Change Review and
  // leaves the project clean. Its provenance is still real and still belongs in
  // the Evidence dock — the surface just may not claim there is something to
  // accept or save.
  document.addEventListener(T.product.rarityProposalEvent, (event) => {
    const detail = event && event.detail;
    if (!detail) return;
    if (detail.settled === 'applied' || detail.settled === 'rejected') {
      if (detail.refreshAuthoring === true) void refreshAuthoringState();
      return;
    }
    if (detail.retired === 'session-restarted' || detail.retired === 'undo' ||
        detail.retired === 'namespace-replaced' || detail.retired === 'document-missing') {
      if (detail.refreshAuthoring === true) void refreshAuthoringState();
      return;
    }
    if (detail.replayed === true) {
      if (syncRarityEvidence(detail.evidence) === null) return;
      selectDockTab('evidence');
      productStatus(
        projectRecovering ? 'recovering' : (projectDirty ? 'dirty' : (projectData === null ? 'closed' : 'open')),
        T.product.documentPath + ' · identical rarity event replayed · project bytes unchanged, nothing staged',
      );
      return;
    }
    if (!isSessionSnapshot(detail.snapshot)) return;
    if (!syncReview(detail.snapshot)) return;
    syncRarityEvidence(detail.evidence);
    selectDockTab('changes');
    productStatus('dirty', T.product.documentPath + ' · rarity proposal staged · review before Save');
  });

  syncReview(null);
  syncAssistantTier();
  syncCommandAvailability();
  syncMinimumWindow();
  void syncProjectLifecycle().then(hydrateInputActions).then(updateEditorCommandControls);
}
${motionScript()}
`;
}

/**
 * Motion only (DIRECTION.md section 6, rows 10, 16 and 17): no state, hook, id,
 * role or label is read for behaviour or written here. Entrances already on
 * screen at boot are finished at once (no page-load choreography); a live status
 * line or value that changes text settles in with a short wipe; the selected
 * tab bar and the assistant strength fill glide from the previous choice. It
 * returns before observing when MutationObserver or Element.animate is missing,
 * and does nothing under prefers-reduced-motion: reduce.
 */
function motionScript(): string {
  return `(() => {
  if (typeof document.getAnimations === 'function') {
    document.getAnimations().forEach((animation) => {
      const timing = animation.effect && typeof animation.effect.getTiming === 'function'
        ? animation.effect.getTiming()
        : null;
      if (timing && timing.iterations !== Infinity) animation.finish();
    });
  }
  const host = document.querySelector('.shell');
  if (!host || typeof MutationObserver !== 'function' || typeof host.animate !== 'function') return;
  const reduce = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const still = () => Boolean(reduce && reduce.matches);
  const live = '.status-text,.status-pin,[data-project-status],.runtime-report,[data-scene-property-diagnostic],[data-assistant-status],.viewport p[data-live-viewport],.sculpt-detail,[data-change-badge],[data-ship-export-status],[data-product-run-report],.project-browser-status,.scene-entities-refusal,.editor-command-form [aria-live],.desktop-byo-config-message,.desktop-byo-config-state,[data-ship-bundle-digest],[data-ship-source-digest],[data-project-browser-digest]';
  const running = new WeakMap();
  const settle = (el) => {
    if (typeof el.animate !== 'function' || still()) return;
    const previous = running.get(el);
    if (previous) previous.cancel();
    running.set(el, el.animate([
      { clipPath: 'inset(0 100% 0 0)', transform: 'translateY(${MOTION_SYSTEM.distance.sm}px)' },
      { clipPath: 'inset(0 0 0 0)', transform: 'none' },
    ], { duration: ${MOTION_SYSTEM.duration.state}, easing: '${MOTION_SYSTEM.ease.outQuint}' }));
  };
  const tabs = '.view-tab,.dock-tab';
  const selectedIn = new WeakMap();
  host.querySelectorAll('.view-tab[aria-selected="true"],.dock-tab[aria-selected="true"],.assistant-mode[aria-pressed="true"]').forEach((tab) => {
    if (tab.parentElement) selectedIn.set(tab.parentElement, tab);
  });
  const from = (next) => {
    const list = next.parentElement;
    if (!list) return null;
    const previous = selectedIn.get(list);
    selectedIn.set(list, next);
    if (!previous || previous === next || !previous.isConnected || still()) return null;
    const a = previous.getBoundingClientRect();
    const b = next.getBoundingClientRect();
    if (a.width === 0 || b.width === 0) return null;
    return { dx: a.left - b.left, hidden: b.width - Math.min(a.width, b.width) };
  };
  // The selected tab bar glides from the tab selected before (translate + clip-path).
  const glide = (tab) => {
    const path = from(tab);
    if (!path) return;
    try {
      tab.animate([
        { transform: 'translateX(' + path.dx + 'px)', clipPath: 'inset(0 ' + path.hidden + 'px 0 0)' },
        { transform: 'none', clipPath: 'inset(0)' },
      ], { duration: ${MOTION_SYSTEM.duration.panel}, easing: '${MOTION_SYSTEM.ease.outExpo}', pseudoElement: '::after' });
    } catch (error) {
      // Pseudo-element targets are unsupported here: the CSS draw stays.
    }
  };
  // The assistant strength fill glides the same way; the button's own fill is
  // held clear for the glide only.
  const slide = (mode) => {
    const path = from(mode);
    if (!path) return;
    const done = () => { mode.classList.remove('is-gliding'); };
    try {
      mode.classList.add('is-gliding');
      const animation = mode.animate([
        { transform: 'translateX(' + path.dx + 'px)', clipPath: 'inset(0 ' + path.hidden + 'px 0 0 round 4px)' },
        { transform: 'none', clipPath: 'inset(0 0 0 0 round 4px)' },
      ], { duration: ${MOTION_SYSTEM.duration.panel}, easing: '${MOTION_SYSTEM.ease.outExpo}', pseudoElement: '::before' });
      if (animation && animation.finished) animation.finished.then(done, done);
      else done();
    } catch (error) {
      done();
    }
  };
  try {
    new MutationObserver((records) => {
      const seen = new Set();
      records.forEach((record) => {
        if (record.type === 'attributes') {
          const target = record.target;
          if (target.nodeType !== 1) return;
          if (record.attributeName === 'aria-selected' && target.matches(tabs) && target.getAttribute('aria-selected') === 'true') glide(target);
          if (record.attributeName === 'aria-pressed' && target.matches('.assistant-mode') && target.getAttribute('aria-pressed') === 'true') slide(target);
          return;
        }
        const node = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        const el = node && typeof node.closest === 'function' ? node.closest(live) : null;
        if (el && !seen.has(el)) {
          seen.add(el);
          settle(el);
        }
      });
    }).observe(host, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-selected', 'aria-pressed'] });
  } catch (error) {
    // An observer that cannot watch these records only costs the motion.
  }
})();`;
}

