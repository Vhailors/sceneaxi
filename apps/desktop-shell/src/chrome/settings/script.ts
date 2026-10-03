export function settingsGitValidationScript(): string {
  return `  const isProjectGitEntry = (entry) => entry !== null && typeof entry === 'object' &&
    typeof entry.path === 'string' && typeof entry.index === 'string' &&
    (entry.sourcePath === undefined || typeof entry.sourcePath === 'string') &&
    typeof entry.worktree === 'string' && typeof entry.canonical === 'boolean' &&
    typeof entry.conflict === 'boolean';

  const isProjectGitState = (state) => state !== null && typeof state === 'object' &&
    state.schemaVersion === 1 && state.kind === 'sceneaxi.project-git-state' &&
    typeof state.projectId === 'string' &&
    (state.branch === null || typeof state.branch === 'string') &&
    (state.head === null || typeof state.head === 'string') &&
    typeof state.detached === 'boolean' &&
    Array.isArray(state.canonicalFiles) && state.canonicalFiles.every((path) => typeof path === 'string') &&
    Array.isArray(state.entries) && state.entries.every(isProjectGitEntry) &&
    Array.isArray(state.canonicalChanges) && state.canonicalChanges.every(isProjectGitEntry) &&
    Array.isArray(state.unrelatedChanges) && state.unrelatedChanges.every(isProjectGitEntry) &&
    Array.isArray(state.conflicts) && state.conflicts.every((path) => typeof path === 'string') &&
    typeof state.workingTreeDiff === 'string' && typeof state.stagedDiff === 'string' &&
    typeof state.clean === 'boolean' && state.undoScope === 'sceneaxi-document-only';

  const isProjectGitPreparation = (preparation) => preparation !== null && typeof preparation === 'object' &&
    preparation.schemaVersion === 1 && preparation.kind === 'sceneaxi.project-git-commit-preparation' &&
    typeof preparation.message === 'string' &&
    Array.isArray(preparation.selectedPaths) && preparation.selectedPaths.every((path) => typeof path === 'string') &&
    typeof preparation.stagedDiff === 'string' && isProjectGitState(preparation.state) &&
    preparation.commitCreated === false && preparation.hooksBypassed === false &&
    preparation.undoScope === 'sceneaxi-document-only';`;
}

export function settingsShipScript(): string {
  return `  const shipStatus = (text) => {
    q('[data-ship-export-status]').forEach((el) => { el.textContent = text; });
  };

  const exportWeb = async () => {
    if (activeProject === null && projectPort() !== null) {
      const code = T.product.refusals.projectRequired;
      shipStatus('Export refused · ' + code);
      productStatus('refused', 'Export refused · ' + code);
      showOutcome('Export Web refused', code, 'Choose New Project or Open Project first.');
      return;
    }
    if (projectDirty || projectRecovering) {
      const code = T.product.refusals.exportDirty;
      shipStatus('Export refused · ' + code);
      productStatus(projectRecovering ? 'recovering' : 'dirty', 'Export refused · ' + code);
      showOutcome('Export Web refused', code, 'Save or discard the staged proposal and resolve recovery before exporting.');
      return;
    }
    if ((projectData === null || projectContentHash === null) && !(await openProject())) return;
    if (projectContentHash === null) {
      shipStatus('Export refused · ' + T.product.refusals.documentDataInvalid);
      return;
    }
    clearShipEvidence();
    shipStatus('Writing deterministic local Web bundle…');
    const response = await commandRequest('ship-export-web', {
      documentPath: T.product.documentPath,
      expectedContentHash: projectContentHash,
    });
    if (response === null || !response.ok) {
      const code = response === null
        ? T.product.refusals.runtimeUnavailable
        : (response.reason || T.product.refusals.runtimeRequestRefused);
      const message = response?.message || 'The packaged host did not produce a Web export.';
      shipStatus('Export refused · ' + code + ' · ' + message);
      productStatus('refused', 'Export refused · ' + code);
      showOutcome('Export Web refused', code, message);
      return;
    }
    const result = response.data;
    const source = result && result.sourceProject;
    const digestPattern = /^sha256:[0-9a-f]{64}$/;
    if (
      !result || typeof result.outputDirectory !== 'string' ||
      typeof result.handoffPath !== 'string' || typeof result.bundleDigest !== 'string' ||
      !digestPattern.test(result.bundleDigest) ||
      !source || typeof source.contentHash !== 'string' ||
      !digestPattern.test(source.contentHash) || source.contentHash !== projectContentHash
    ) {
      const code = T.product.refusals.runtimeRequestRefused;
      shipStatus('Export refused · ' + code + ' · invalid export evidence');
      productStatus('refused', 'Export refused · ' + code);
      showOutcome('Export Web refused', code, 'The host returned no complete export evidence.');
      return;
    }
    showModePanels('ship');
    q('[data-ship-output]').forEach((el) => { el.textContent = result.outputDirectory; });
    q('[data-ship-bundle-digest]').forEach((el) => { el.textContent = result.bundleDigest; });
    q('[data-ship-source-digest]').forEach((el) => { el.textContent = source.contentHash; });
    q('[data-ship-handoff-path]').forEach((el) => { el.textContent = result.handoffPath; });
    q('[data-ship-export-evidence]').forEach((el) => { el.hidden = false; });
    shippedSourceDigest = source.contentHash;
    const outcome = result.replayed === true ? 'Verified existing' : 'Exported';
    shipStatus(outcome + ' deterministic Web bundle · no deployment performed.');
    productStatus('open', outcome + ' Web bundle · ' + result.bundleDigest);
  };

  const inspectProjectRepository = async (commandId) => {
    const response = await commandRequest(commandId, {});
    if (response === null || !response.ok) {
      const code = response?.reason || T.product.refusals.runtimeUnavailable;
      const message = response?.message || 'The packaged host did not produce contained Git evidence.';
      productStatus('refused', 'Repository inspection refused · ' + code);
      showOutcome('Repository inspection refused', code, message);
      return;
    }
    const state = response.data;
    if (!isProjectGitState(state)) {
      const code = T.product.refusals.runtimeRequestRefused;
      productStatus('refused', 'Repository inspection refused · ' + code);
      showOutcome('Repository inspection refused', code, 'The host returned no complete repository evidence.');
      return;
    }
    showModePanels('ship');
    q('[data-project-git-evidence]').forEach((el) => {
      el.textContent = JSON.stringify(state, null, 2);
      el.hidden = false;
    });
    renderProjectGitPathSelection(state);
    const label = commandId === 'project-git-diff' ? 'diff' : 'status';
    productStatus('open', 'Repository ' + label + ' · ' + state.entries.length + ' working-tree change(s) · ' + state.conflicts.length + ' conflict(s)');
  };

  const renderProjectGitPathSelection = (state) => {
    const paths = [];
    state.entries.forEach((entry) => {
      [entry.path, entry.sourcePath].forEach((path) => {
        if (typeof path === 'string' && !paths.includes(path)) paths.push(path);
      });
    });
    paths.sort();
    q('[data-project-git-path-list]').forEach((container) => {
      container.replaceChildren();
      if (paths.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'No changed files are available for selection.';
        container.append(empty);
        return;
      }
      paths.forEach((path) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = path;
        input.setAttribute('data-project-git-path', '');
        const text = document.createElement('span');
        text.textContent = path;
        label.append(input, text);
        container.append(label);
      });
    });
  };

  const projectGitPaths = () => {
    return Array.from(shell.querySelectorAll('[data-project-git-path]:checked')).map((input) => input.value);
  };

  const renderProjectGitEvidence = (evidence, label) => {
    showModePanels('ship');
    q('[data-project-git-evidence]').forEach((el) => {
      el.textContent = JSON.stringify(evidence, null, 2);
      el.hidden = false;
    });
    const state = isProjectGitState(evidence) ? evidence : evidence.state;
    renderProjectGitPathSelection(state);
    productStatus('open', label + ' · ' + state.entries.length + ' working-tree change(s) · ' + state.conflicts.length + ' conflict(s)');
  };

  const mutateProjectRepository = async (commandId) => {
    const paths = projectGitPaths();
    const input = commandId === 'project-git-stage'
      ? { paths }
      : { paths, message: shell.querySelector('[data-project-git-message]')?.value || '' };
    const response = await commandRequest(commandId, input);
    if (response === null || !response.ok) {
      const code = response?.reason || T.product.refusals.runtimeUnavailable;
      const message = response?.message || 'The packaged host refused contained Git preparation.';
      productStatus('refused', 'Repository preparation refused · ' + code);
      showOutcome('Repository preparation refused', code, message);
      return;
    }
    if (commandId === 'project-git-stage' && isProjectGitState(response.data)) {
      renderProjectGitEvidence(response.data, 'Staged selected files');
      return;
    }
    if (commandId === 'project-git-commit-prepare' && isProjectGitPreparation(response.data)) {
      renderProjectGitEvidence(response.data, 'Prepared commit evidence');
      return;
    }
    const code = T.product.refusals.runtimeRequestRefused;
    productStatus('refused', 'Repository preparation refused · ' + code);
    showOutcome('Repository preparation refused', code, 'The host returned no complete repository evidence.');
  };`;
}

export function settingsScript(): string {
  return `  const editorCommandInput = (commandId, approve = false) => {
    const form = shell.querySelector('[data-editor-command-form="' + commandId + '"]');
    const input = Object.create(null);
    if (form) {
      for (const field of Array.from(form.querySelectorAll('[data-command-field]'))) {
        const name = field.dataset.commandField;
        if (!name) continue;
        if (!field.value && ['instanceIds', 'parentInstanceId', 'instanceId', 'sourceInstanceId'].includes(name)) continue;
        if (!field.value) throw new Error('EDITOR_COMMAND_PREREQUISITE_MISSING');
        if (field.tagName === 'TEXTAREA') {
          try { input[name] = JSON.parse(field.value); }
          catch { throw new Error('EDITOR_COMMAND_INPUT_INVALID'); }
        } else if (field.type === 'number') input[name] = Number(field.value);
        else input[name] = field.value;
      }
    }
    if (['package-install', 'package-remove', 'scene-prefab-inspect', 'scene-prefab-define',
      'scene-prefab-instance', 'scene-prefab-override', 'scene-prefab-refresh', 'physics-evaluate'].includes(commandId)) {
      input.documentPath = T.product.documentPath;
      input.profile = shell.dataset.profile;
      input.expectedContentHash = projectContentHash;
    }
    if (commandId === 'viewport-source-set') {
      input.source = shell.querySelector('[data-command-field="source"]')?.value || '';
    }
    if (commandId === 'package-inspect' || commandId === 'profile-inspect') {
      input.documentPath = T.product.documentPath;
      input.profile = shell.dataset.profile;
    }
    if (commandId === 'extension-inspect') input.profile = shell.dataset.profile;
    if (commandId === 'extension-start') input.profile = shell.dataset.profile;
    if (commandId === 'project-build') {
      input.profile = shell.dataset.profile;
      input.target = 'linux';
    }
    if (commandId === 'workspace-layout-apply') {
      input.profile = shell.dataset.profile;
      input.leftVisible = shell.dataset.drawerLeft === 'open';
      input.inspectorVisible = shell.dataset.drawerInspector === 'open';
    }
    if (commandId === 'scene-prefab-define') input.instanceIds = selectedSceneEntityIds;
    if (commandId === 'scene-prefab-instance' && !input.parentInstanceId && (selectedSceneEntityId || selectedSceneEntityIds[0])) {
      input.parentInstanceId = selectedSceneEntityId || selectedSceneEntityIds[0];
    }
    if (commandId === 'scene-prefab-override') {
      if (!input.instanceId && selectedSceneEntityId) input.instanceId = selectedSceneEntityId;
      if (!input.sourceInstanceId && selectedSceneEntityId) input.sourceInstanceId = selectedSceneEntityId;
    }
    if (commandId === 'project-migration-commit') {
      if (!editorMigrationDigest) throw new Error('PROJECT_MIGRATION_PROPOSAL_REQUIRED');
      input.approved = true;
      input.proposalDigest = editorMigrationDigest;
    }
    if (commandId === 'input-action-rebind' || commandId === 'input-actions-reset') {
      const current = editorInputActionReview;
      if (approve && (!current || current.commandId !== commandId || typeof current.reviewDigest !== 'string')) {
        throw new Error('INPUT_ACTION_REVIEW_REQUIRED');
      }
      input.expectedBaseVersion = current?.baseVersion || editorInputActionBaseVersions?.[input.scope];
      if (!input.expectedBaseVersion) throw new Error('INPUT_ACTION_INSPECTION_REQUIRED');
      // Only the Approve control approves; Submit always asks for a fresh review.
      const approving = approve && current?.commandId === commandId;
      input.approved = approving;
      input.reviewDigest = approving ? current.reviewDigest : null;
    }
    if (commandId === 'scene-prefab-inspect') delete input.expectedContentHash;
    return input;
  };

  const clearInputActionReview = () => {
    editorInputActionReview = null;
    q('[data-editor-command-review]').forEach((approve) => { approve.hidden = true; });
  };

  // Everything learned from one project's inspections belongs to that project.
  const resetEditorCommandState = () => {
    editorMigrationDigest = null;
    editorPackageIds = [];
    editorExtensionSeams = [];
    editorInputActionBaseVersions = null;
    editorPrefabDefinitions = [];
    editorPlaySessionActive = false;
    clearInputActionReview();
    for (const name of ['packageId', 'seamId', 'actionId', 'definitionId', 'instanceId', 'sourceInstanceId', 'parentInstanceId']) {
      populateEditorChoices(name, []);
    }
    const refusal = shell.querySelector('[data-migration-proposal-refusal]');
    if (refusal) refusal.textContent = 'Run Propose Project Migration first.';
    updateEditorCommandControls();
  };

  const runEditorCommand = async (commandId, approve = false) => {
    if (activeProject === null && !(await openProject())) return;
    if (projectContentHash === null && !(await openProject())) return;
    let input;
    try {
      input = editorCommandInput(commandId, approve);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'EDITOR_COMMAND_INPUT_INVALID';
      showOutcome(commandId + ' refused', code, 'Inspect the relevant catalog and provide all required values before submitting.');
      productStatus('refused', commandId + ' refused · ' + code);
      return;
    }
    const definition = T.editorCommands.find((row) => row.id === commandId);
    if (definition?.mutation === 'stages-change' && definition.inputSchema.properties.expectedContentHash) {
      await stageSceneCommand(commandId, input, definition.label, { authoringSnapshot: true });
      return;
    }
    const response = await commandRequest(commandId, input);
    const diagnostic = responseDiagnostic(response);
    if (diagnostic !== null) {
      // A refused review decision cannot be approved later; ask for a new review.
      if (commandId === 'input-action-rebind' || commandId === 'input-actions-reset') clearInputActionReview();
      showOutcome(commandId + ' refused', diagnostic.code, diagnostic.message);
      productStatus('refused', commandId + ' refused · ' + diagnostic.code);
      return;
    }
    const data = response.data;
    if (commandId === 'project-migration-propose' && typeof data?.proposal?.proposalDigest === 'string') {
      editorMigrationDigest = data.proposal.proposalDigest;
      const refusal = shell.querySelector('[data-migration-proposal-refusal]');
      if (refusal) refusal.textContent = 'Proposal ready. The commit uses its returned digest.';
      updateEditorCommandControls();
    }
    if (commandId === 'package-inspect' && Array.isArray(data?.catalog?.lock)) {
      editorPackageIds = data.catalog.lock.map((row) => row.packageId).filter((id) => typeof id === 'string');
      populateEditorChoices('packageId', editorPackageIds);
    }
    if (commandId === 'extension-inspect' && Array.isArray(data?.seams)) {
      editorExtensionSeams = data.seams.map((row) => row.id).filter((id) => typeof id === 'string');
      populateEditorChoices('seamId', editorExtensionSeams);
    }
    if (commandId === 'input-actions-inspect' && data?.baseVersions && data?.map) {
      editorInputActionBaseVersions = data.baseVersions;
      activeInputActionMap = data.map;
      populateEditorChoices('actionId', data.map.bindings.map((row) => row.actionId));
      editorInputActionReview = null;
    }
    if (commandId === 'scene-prefab-inspect' && Array.isArray(data?.catalog?.definitions)) {
      editorPrefabDefinitions = data.catalog.definitions.map((row) => row.definitionId);
      populateEditorChoices('definitionId', editorPrefabDefinitions);
      populateEditorChoices('instanceId', data.catalog.instances.map((row) => row.instanceId));
      populateEditorChoices('sourceInstanceId', editorSceneInstanceIds);
    }
    if ((commandId === 'input-action-rebind' || commandId === 'input-actions-reset') && data?.status === 'review') {
      editorInputActionReview = { commandId, baseVersion: input.expectedBaseVersion, reviewDigest: data.reviewDigest };
      const approve = shell.querySelector('[data-editor-command-review="' + commandId + '"]');
      if (approve) approve.hidden = false;
      showOutcome(commandId + ' review', 'INPUT_ACTION_REVIEW_REQUIRED', JSON.stringify(data, null, 2));
      updateEditorCommandControls();
      return;
    }
    if (data?.authoringSnapshot) {
      syncReview(data.authoringSnapshot);
      projectDirty = data.authoringSnapshot.phase === 'reviewing';
    }
    if ((commandId === 'input-action-rebind' || commandId === 'input-actions-reset') && data?.status === 'committed') {
      clearInputActionReview();
      await hydrateInputActions();
      // The commit moved the settings version; re-read it so the next change is based on it.
      const inspected = await commandRequest('input-actions-inspect', {});
      editorInputActionBaseVersions = responseDiagnostic(inspected) === null && inspected.data?.baseVersions
        ? inspected.data.baseVersions
        : null;
      updateEditorCommandControls();
    }
    if (commandId === 'project-migration-commit') {
      editorMigrationDigest = null;
      updateEditorCommandControls();
    }
    const output = JSON.stringify(data, null, 2);
    showOutcome(commandId, 'COMMAND_COMPLETED', output);
    productStatus('open', commandId + ' completed');
  };

  const populateEditorChoices = (name, values) => {
    q('[data-command-field="' + name + '"]').forEach((field) => {
      if (field.tagName === 'SELECT') {
        const first = field.querySelector('option');
        field.replaceChildren(first);
        for (const value of values) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          field.append(option);
        }
      } else if (field.tagName === 'INPUT') {
        field.value = values[0] || '';
        field.setAttribute('list', 'editor-choice-' + name);
        let list = shell.querySelector('#editor-choice-' + name);
        if (!list) {
          list = document.createElement('datalist');
          list.id = 'editor-choice-' + name;
          shell.append(list);
        }
        list.replaceChildren(...values.map((value) => {
          const option = document.createElement('option');
          option.value = value;
          return option;
        }));
      }
    });
    updateEditorCommandControls();
  };

  const updateEditorCommandControls = () => {
    q('[data-editor-command-submit]').forEach((button) => {
      const id = button.dataset.editorCommandSubmit;
      const form = button.closest('[data-editor-command-form]');
      const fields = form ? Array.from(form.querySelectorAll('[data-command-field]')) : [];
      const missingField = id === 'viewport-source-set'
        ? !shell.querySelector('[data-command-field="source"]')?.value
        : fields.some((field) => !field.value && !(id === 'scene-prefab-instance' && field.dataset.commandField === 'parentInstanceId' && editorSceneInstanceIds.length > 0));
      const missingPrerequisite = id === 'project-migration-commit' && !editorMigrationDigest ||
        id === 'viewport-source-set' && !editorPlaySessionActive ||
        id === 'physics-evaluate' && !editorPhysicsHostReady ||
        id === 'scene-prefab-define' && selectedSceneEntityIds.length === 0 ||
        id === 'scene-prefab-instance' && (editorPrefabDefinitions.length === 0 || editorSceneInstanceIds.length === 0) ||
        (id === 'scene-prefab-override' || id === 'scene-prefab-refresh') && editorPrefabDefinitions.length === 0 ||
        id === 'package-remove' && editorPackageIds.length === 0 ||
        id === 'extension-start' && editorExtensionSeams.length === 0 ||
        (id === 'input-action-rebind' || id === 'input-actions-reset') && !editorInputActionBaseVersions;
      const invalidJson = fields.some((field) => field.tagName === 'TEXTAREA' && field.value && (() => { try { JSON.parse(field.value); return false; } catch { return true; } })());
      const disabled = (id === 'input-actions-inspect' ? activeProject === null : missingField || invalidJson || missingPrerequisite);
      button.disabled = disabled;
      button.setAttribute('aria-disabled', String(disabled));
      if (!disabled) button.removeAttribute('data-refusal');
      else button.dataset.refusal = id === 'viewport-source-set' && !editorPlaySessionActive ? 'PLAY_SESSION_MISSING' : id === 'physics-evaluate' && !editorPhysicsHostReady ? 'PHYSICS_WORLD_NOT_READY' : missingPrerequisite ? 'EDITOR_COMMAND_PREREQUISITE_MISSING' : 'EDITOR_COMMAND_INPUT_INVALID';
    });
  };`;
}
