export function inspectorDisplayScript(): string {
  return `  const showSceneProperty = (entityId) => {
    const entities = editableScene && Array.isArray(editableScene.entities)
      ? editableScene.entities
      : [];
    const entity = entities.find((candidate) => candidate && candidate.id === entityId);
    const properties = entity && Array.isArray(entity.properties) ? entity.properties : [];
    if (!entity || properties.length !== 9 || properties.some((property) =>
      !property || typeof property.id !== 'string' || typeof property.value !== 'number')) return false;
    selectedSceneEntityId = entity.id;
    if (!selectedSceneEntityIds.includes(entity.id)) selectedSceneEntityIds = [entity.id];
    q('[data-action="scene-entity-select"]').forEach((el) => {
      if (el.tagName === 'SELECT') {
        Array.from(el.options).forEach((option) => {
          option.selected = selectedSceneEntityIds.includes(option.value);
        });
        el.dataset.value = selectedSceneEntityIds.join(',');
      } else {
        const pressed = el.dataset.value === entity.id;
        el.setAttribute('aria-pressed', String(pressed));
        el.classList.toggle('is-selected', pressed);
      }
    });
    q('[data-scene-property-entity-label]').forEach((el) => { el.textContent = entity.label; });
    q('[data-scene-property-entity-id]').forEach((el) => { el.textContent = entity.id; });
    properties.forEach((property) => {
      const input = shell.querySelector('#scene-property-' + property.id);
      if (!input || input.tagName !== 'INPUT') return;
      input.value = String(property.value);
      input.step = String(property.step);
      input.min = String(property.min);
      input.max = String(property.max);
    });
    const editor = shell.querySelector('[data-scene-property-editor]');
    if (editor) editor.hidden = false;
    const diagnostic = shell.querySelector('[data-scene-property-diagnostic]');
    if (diagnostic) diagnostic.textContent = 'Typed numeric property · edits stage one E1 proposal and write only on Save.';
    return true;
  };`;
}

export function inspectorCatalogScript(): string {
  return `  const inspectCatalog = async (kind, commandId) => {
    const response = await commandRequest(commandId, {
      documentPath: T.product.documentPath,
      profile: shell.dataset.profile,
    });
    const report = shell.querySelector('[data-catalog-report="' + kind + '"]');
    if (response === null || !response.ok) {
      const code = response === null ? T.product.refusals.runtimeUnavailable : response.reason;
      if (report) { report.textContent = code; report.hidden = false; }
      productStatus('refused', 'Inspect refused · ' + code);
      showOutcome('Inspect refused', code, response?.detail || response?.message || 'The catalog was not returned.');
      return;
    }
    if (kind === 'physics') {
      editorPhysicsHostReady = response.data?.physicsHostReady === true;
      updateEditorCommandControls();
    }
    if (report) { report.textContent = JSON.stringify(response.data, null, 2); report.hidden = false; }
    productStatus('open', kind + ' catalog inspected');
  };

  const stageCatalog = async (kind) => {
    const inspector = T.product.inspectors.find((row) => row.kind === kind);
    const field = shell.querySelector('[data-catalog-mutation="' + kind + '"]');
    if (!inspector || !field || typeof field.value !== 'string') return;
    let mutation;
    try { mutation = JSON.parse(field.value); } catch {
      productStatus('refused', 'Stage refused · EDITOR_COMMAND_INPUT_INVALID');
      showOutcome('Stage refused', 'EDITOR_COMMAND_INPUT_INVALID', 'Enter one valid JSON mutation object.');
      return;
    }
    if (!mutation || typeof mutation !== 'object' || Array.isArray(mutation)) {
      productStatus('refused', 'Stage refused · EDITOR_COMMAND_INPUT_INVALID');
      showOutcome('Stage refused', 'EDITOR_COMMAND_INPUT_INVALID', 'Mutation must be a JSON object.');
      return;
    }
    await stageSceneCommand(inspector.applyCommand, {
      documentPath: T.product.documentPath,
      profile: shell.dataset.profile,
      mutation,
    }, kind + ' change', { refreshScene: false, authoringSnapshot: true });
  };`;
}

export function inspectorPropertyScript(): string {
  return `  const stageSceneProperty = async () => {
    if (selectedSceneEntityId === null || editableScene === null) {
      productStatus('refused', 'Edit refused · select a composed instance first');
      return;
    }
    const entity = editableScene.entities.find((candidate) => candidate.id === selectedSceneEntityId);
    const changed = entity && Array.isArray(entity.properties)
      ? entity.properties.flatMap((property) => {
          const input = shell.querySelector('#scene-property-' + property.id);
          const value = input && input.tagName === 'INPUT' ? input.valueAsNumber : Number.NaN;
          return value === property.value ? [] : [{ propertyId: property.id, value }];
        })
      : [];
    if (changed.length > 1) {
      const message = shell.querySelector('[data-scene-property-diagnostic]');
      const detail = 'Stage one transform component at a time.';
      if (message) message.textContent = 'invalid-proposal · ' + detail;
      productStatus('refused', 'Edit refused · invalid-proposal · ' + detail);
      return;
    }
    const component = changed[0] || {
      propertyId: 'translation-x',
      value: entity.properties.find((property) => property.id === 'translation-x')?.value,
    };
    await stageSceneChange({
      label: 'property',
      requiresSelection: true,
      propertyFeedback: true,
      request: (expectedContentHash) => commandRequest('scene-property-set', {
        documentPath: T.product.documentPath,
        expectedContentHash,
        profile: shell.dataset.profile,
        instanceId: selectedSceneEntityId,
        propertyId: component.propertyId,
        newValue: component.value,
      }),
    });
  };

  const stageSceneInstance = async (kind) => {
    if (selectedSceneEntityId === null) {
      productStatus('refused', 'Edit refused · select a composed instance first');
      return;
    }
    const base = {
      documentPath: T.product.documentPath,
      expectedContentHash: projectContentHash,
      profile: shell.dataset.profile,
    };
    const parent = shell.querySelector('[data-scene-parent]');
    const commandId = kind === 'add-instance' ? 'scene-object-create' : 'scene-object-remove';
    const input = kind === 'add-instance'
      ? { ...base, sourceInstanceId: selectedSceneEntityId, parentInstanceId: parent?.value || editableScene.hierarchy.rootInstanceId }
      : { ...base, instanceIds: selectedSceneEntityIds };
    await stageSceneCommand(commandId, input, kind === 'add-instance' ? 'object create' : 'object removal');
  };`;
}

export function inspectorTransformScript(): string {
  return `  const nudgeSceneTransform = async (axis, sign) => {
    const ids = selectedSceneEntityIds.length > 0
      ? selectedSceneEntityIds
      : selectedSceneEntityId === null ? [] : [selectedSceneEntityId];
    if (ids.length === 0) {
      productStatus('refused', 'Edit refused · select a composed instance first');
      return;
    }
    const snapRaw = shell.querySelector('[data-scene-transform-snap]')?.value;
    const snapIncrement = snapRaw === '' || snapRaw === undefined ? null : Number(snapRaw);
    const values = [0, 0, 0];
    values[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] = sign * (snapIncrement && snapIncrement > 0 ? snapIncrement : 0.1);
    await stageSceneCommand('scene-transform-apply', {
      documentPath: T.product.documentPath,
      instanceIds: ids,
      mode: shell.dataset.transformMode || 'translate',
      space: shell.querySelector('[data-scene-transform-space]')?.value || 'local',
      pivot: shell.querySelector('[data-scene-transform-pivot]')?.value || 'individual',
      axes: axis,
      snapIncrement: snapIncrement && snapIncrement > 0 ? snapIncrement : null,
      valueKind: 'delta',
      values,
    }, 'transform');
  };

  const stageSceneReparent = async () => {
    const parent = shell.querySelector('[data-scene-parent]');
    const policy = shell.querySelector('[data-scene-policy]');
    if (selectedSceneEntityId === null || parent?.tagName !== 'SELECT' || policy?.tagName !== 'SELECT') return;
    await stageSceneCommand('scene-object-reparent', {
      documentPath: T.product.documentPath,
      expectedContentHash: projectContentHash,
      profile: shell.dataset.profile,
      instanceId: selectedSceneEntityId,
      parentInstanceId: parent.value,
      transformPolicy: policy.value,
    }, 'reparent ' + policy.value);
  };`;
}
