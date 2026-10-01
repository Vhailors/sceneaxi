export function viewportScript(): string {
  return `  const playScene = async () => {
    if (projectData === null && !(await openProject())) return;
    runStatus('Opening composed scene…');
    const response = await commandRequest('run-play', { documentPath: T.product.documentPath });
    if (response === null || !response.ok) {
      runRefusal(
        response === null
          ? T.product.refusals.runtimeUnavailable
          : (response.reason || T.product.refusals.runtimeRequestRefused),
        response === null ? null : response.detail,
      );
      return;
    }
    const exercise = response.data;
    appendConsoleEvidence('run-play', exercise);
    const inspection = await commandRequest('play-inspect', {});
    if (inspection?.ok) appendConsoleEvidence('play-inspect', inspection.data);
    const ticks = Array.isArray(exercise?.tickDigests) ? exercise.tickDigests.length : 0;
    if (exercise?.closed !== true || ticks === 0) {
      runRefusal(T.product.refusals.openPathEvidenceInvalid);
      return;
    }
    const playState = exercise.playSession?.state;
    editorPlaySessionActive = typeof playState === 'string' && playState !== 'disposed';
    updateEditorCommandControls();
    const playback = { exercise, accepted: false, frame: null };
    document.dispatchEvent(new CustomEvent(T.product.viewportPlayEvent, { detail: playback }));
    if (!playback.accepted || !Number.isSafeInteger(playback.frame) || playback.frame < 1) {
      runRefusal(T.product.refusals.viewportUnavailable);
      return;
    }
    showModePanels('run');
    const lastDigest = exercise.tickDigests[ticks - 1];
    // Play reports the session it just ran. A staged rarity proposal has not
    // changed project bytes yet, so that session carries no rarity — but the
    // proposal's provenance is still on screen in Change Review and still waiting
    // for Accept, and retiring the dock under it would deny evidence the surface
    // is showing. Only a run with nothing staged may clear it.
    const runRarity = rarityEvidenceText(exercise.rarity, exercise.raritySession);
    activeRunRarityEvidenceDigest = runRarity !== null && exercise.rarity &&
      typeof exercise.rarity === 'object' && typeof exercise.rarity.namespaceDigest === 'string'
      ? exercise.rarity.namespaceDigest
      : null;
    if (!rarityProposalStaged) syncRarityEvidence(exercise.rarity);
    q('[data-run-rarity-evidence]').forEach((el) => {
      el.textContent = runRarity || '';
      el.hidden = runRarity === null;
    });
    const played = 'Played composed scene · ' + ticks + ' ticks · viewport frame ' + playback.frame + ' · session closed';
    q('[data-run-session-report]').forEach((el) => {
      el.textContent = 'Completed closed session · ' + ticks + ' ticks · terminal digest ' + String(lastDigest);
    });
    q('[data-run-live-report]').forEach((el) => {
      el.textContent = 'Viewport frame ' + playback.frame + ' acknowledged for ' + exercise.mountable.sceneId + '.';
    });
    runStatus(played);
    productStatus(projectRecovering ? 'recovering' : (projectDirty ? 'dirty' : (projectData === null ? 'closed' : 'open')), played);
  };`;
}
