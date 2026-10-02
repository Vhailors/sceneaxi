export function dockReviewScript(): string {
  return `  const syncReview = (snapshot) => {
    if (snapshot !== null && !isSessionSnapshot(snapshot)) return false;
    const projection = reviewProjection(snapshot);
    // Only \`reviewing\` is decidable. \`pending\` keeps the proposal so the surface
    // can still show what was attempted, but its apply outcome is indeterminate:
    // Reject would come back \`apply-in-progress\` and Accept would issue
    // \`recover\`, so offering either decision there would be a lie.
    const active = projection !== null;
    activeReviewSnapshot = active ? snapshot : null;
    if (snapshot && typeof snapshot.phase === 'string') {
      projectDirty = snapshot.phase === 'reviewing' || snapshot.phase === 'pending';
      if (snapshot.phase === 'applied' || snapshot.phase === 'rejected') {
        projectRecovering = false;
      }
    }
    const panel = shell.querySelector('[data-change-proposal]');
    const empty = shell.querySelector('[data-change-empty]');
    if (panel) panel.hidden = !active;
    if (empty) empty.hidden = Boolean(active);
    const documentPath = shell.querySelector('[data-change-document]');
    const contentHash = shell.querySelector('[data-change-content-hash]');
    const renderedDiff = shell.querySelector('[data-change-diff]');
    const rarityEvidence = shell.querySelector('[data-change-rarity-evidence]');
    if (documentPath) documentPath.textContent = active ? projection.first.documentPath : '';
    if (contentHash) contentHash.textContent = active ? projection.first.baseContentHash : '';
    if (renderedDiff) renderedDiff.textContent = active ? projection.diff : '';
    const rarityText = active ? rarityEvidenceText(snapshot.rarityEvidence) : null;
    activeReviewRarityEvidenceDigest = rarityText !== null &&
      typeof snapshot.rarityEvidence?.namespaceDigest === 'string'
      ? snapshot.rarityEvidence.namespaceDigest
      : null;
    if (rarityEvidence) {
      rarityEvidence.textContent = rarityText || '';
      rarityEvidence.hidden = rarityText === null;
    }
    if (rarityText !== null) syncRarityEvidence(snapshot.rarityEvidence);
    if (active) rarityProposalStaged = rarityText !== null;
    const settledRarityText = snapshot &&
      (snapshot.phase === 'applied' || snapshot.phase === 'rejected')
      ? rarityEvidenceText(snapshot.rarityEvidence)
      : null;
    if (settledRarityText !== null) {
      document.dispatchEvent(new CustomEvent(T.product.rarityProposalEvent, {
        detail: {
          settled: snapshot.phase,
          evidence: snapshot.rarityEvidence,
        },
      }));
    }
    // Only the rarity proposal's own discard retires its provenance. Rejecting
    // an unrelated property edit says nothing about rarity the project already
    // accepted, and clearing the dock there would deny evidence that still
    // exists in the project bytes.
    if (snapshot?.phase === 'rejected') {
      if (rarityProposalStaged) clearRarityEvidence();
      rarityProposalStaged = false;
    }
    if (snapshot?.phase === 'applied') rarityProposalStaged = false;
    // A validated snapshot that reports no diagnostic is the host saying the
    // conflict is over, which is the only thing that resolves it.
    if (snapshot !== null &&
        (Array.isArray(snapshot.diagnostics) ? snapshot.diagnostics : []).length === 0) {
      clearConflictOutcome();
    }
    q('[data-change-badge]').forEach((el) => {
      el.textContent = String(active ? 1 : 0);
    });
    return true;
  };`;
}

export function dockTabsScript(): string {
  return `  const buildDockTabs = (mode, active) => {
    const strip = shell.querySelector('.dock-tablist');
    if (!strip) return;
    const ids = T.dockTabsByMode[mode];
    const chosen = ids.indexOf(active) === -1 ? ids[0] : active;
    q('.dock-tab').forEach((el) => el.remove());
    ids.forEach((id) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dock-tab';
      b.id = 'dock-' + id;
      b.setAttribute('role', 'tab');
      b.dataset.action = 'dock-tab';
      b.dataset.value = id;
      b.setAttribute('aria-controls', 'dock-panel-' + id);
      b.setAttribute('aria-selected', String(id === chosen));
      b.tabIndex = id === chosen ? 0 : -1;
      b.textContent = T.dockLabels[id];
      if (id === 'changes') {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.setAttribute('data-change-badge', '');
        badge.textContent = String(reviewCount());
        b.appendChild(badge);
      }
      // A rebuilt tab is a rendered control like any other, so it takes the
      // active profile's own kind and reason rather than the one the document
      // happened to be rendered with.
      applyControl(b);
      strip.appendChild(b);
    });
    selectDockTab(chosen);
    syncReview(activeReviewSnapshot);
  };

  const selectDockTab = (id) => {
    q('.dock-tab').forEach((el) => {
      const on = el.dataset.value === id;
      el.setAttribute('aria-selected', String(on));
      el.tabIndex = on ? 0 : -1;
    });
    q('[data-dock-panel]').forEach((el) => { el.hidden = el.dataset.dockPanel !== id; });
    if (id === 'timeline') void productAction(refreshTimeline);
  };`;
}

export function dockTimelineScript(): string {
  return `  const refreshTimeline = async () => {
    if (activeProject === null && !(await openProject())) return;
    const response = await commandRequest('animation-inspect', {
      documentPath: T.product.documentPath,
      profile: shell.dataset.profile,
    });
    const diagnostic = responseDiagnostic(response);
    const output = diagnostic === null ? JSON.stringify(response.data, null, 2)
      : diagnostic.code + ' · ' + diagnostic.message;
    q('[data-timeline-result]').forEach((el) => { el.textContent = output; });
    if (diagnostic !== null) productStatus('refused', 'Timeline inspection refused · ' + diagnostic.code);
  };

  const applyTimelineMutation = async () => {
    if (activeProject === null && !(await openProject())) return;
    let mutation;
    try { mutation = JSON.parse(shell.querySelector('[data-timeline-mutation]')?.value || ''); }
    catch { productStatus('refused', 'Animation edit refused · invalid JSON'); return; }
    const result = await stageSceneCommand('animation-apply', {
      documentPath: T.product.documentPath,
      expectedContentHash: projectContentHash,
      mutation,
    }, 'animation', { authoringSnapshot: true });
    if (result) q('[data-timeline-result]').forEach((el) => {
      el.textContent = 'Animation edit staged in Change Review. Save applies the proposal.';
    });
  };

  const openTimelineVersion = async () => {
    if (projectRecovering || projectDirty) {
      const code = projectRecovering ? T.product.refusals.recoveryPending : T.product.refusals.profileSwitchDirty;
      productStatus('refused', 'Timeline evaluation refused · ' + code);
      return false;
    }
    return projectData !== null && projectContentHash !== null &&
      projectContentRoot === (activeProject?.root ?? null) ? true : openProject();
  };

  const scrubTimeline = async () => {
    if (!(await openTimelineVersion())) return;
    const timeMs = Number(shell.querySelector('[data-timeline-time]')?.value);
    const response = await commandRequest('animation-scrub', {
      documentPath: T.product.documentPath,
      expectedContentHash: projectContentHash,
      profile: shell.dataset.profile,
      timeMs,
    });
    const diagnostic = responseDiagnostic(response);
    q('[data-timeline-result]').forEach((el) => {
      el.textContent = diagnostic === null ? JSON.stringify(response.data, null, 2)
        : diagnostic.code + ' · ' + diagnostic.message;
    });
  };

  const evaluateTimeline = async () => {
    if (!(await openTimelineVersion())) return;
    const timeMs = Number(shell.querySelector('[data-timeline-time]')?.value);
    const response = await commandRequest('animation-evaluate', {
      documentPath: T.product.documentPath,
      expectedContentHash: projectContentHash,
      profile: shell.dataset.profile,
      timeMs,
    });
    const diagnostic = responseDiagnostic(response);
    q('[data-timeline-result]').forEach((el) => {
      el.textContent = diagnostic === null ? JSON.stringify(response.data, null, 2)
        : diagnostic.code + ' · ' + diagnostic.message;
    });
  };`;
}
