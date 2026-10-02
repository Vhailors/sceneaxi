export function treeSelectionScript(): string {
  return `  const setSceneSelection = async (instanceIds, generation) => {
    if (generation !== sceneSelectionGeneration) return;
    const response = await commandRequest('scene-selection-set', {
      documentPath: T.product.documentPath,
      profile: shell.dataset.profile,
      instanceIds,
    });
    if (generation !== sceneSelectionGeneration) return;
    const diagnostic = responseDiagnostic(response);
    if (diagnostic !== null) {
      syncSceneProperties({ editableScene });
      productStatus('refused', 'Selection refused · ' + diagnostic.code + ' · ' + diagnostic.message);
      return;
    }
    const selection = response.data?.selection;
    if (!selection || !Array.isArray(selection.instanceIds)) return;
    if (
      response.data?.ok !== true ||
      !Array.isArray(response.data.entities) ||
      !response.data.hierarchy ||
      typeof response.data.contentHash !== 'string' ||
      !/^sha256:[0-9a-f]{64}$/.test(response.data.contentHash)
    ) {
      productStatus('refused', 'Selection refused · ' + T.product.refusals.authoringRefused);
      return;
    }
    if (!syncSceneProperties({ editableScene: response.data, selectedInstanceIds: selection.instanceIds })) {
      productStatus('refused', 'Selection refused · ' + T.product.refusals.authoringRefused);
      return;
    }
    projectContentHash = response.data.contentHash;
    selectedSceneEntityIds = selection.instanceIds;
    if (selection.primaryInstanceId && showSceneProperty(selection.primaryInstanceId) && shell.dataset.mode !== 'build') {
      showModePanels('build');
    }
  };

  const queueSceneSelection = () => {
    const instanceIds = [...selectedSceneEntityIds];
    const generation = sceneSelectionGeneration;
    sceneSelectionPending = sceneSelectionPending.then(
      () => setSceneSelection(instanceIds, generation),
      () => setSceneSelection(instanceIds, generation),
    );
  };`;
}
