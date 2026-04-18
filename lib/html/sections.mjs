import {
  dispositionTone,
  escapeHtml,
  fitTone,
  renderBadge,
  renderFilterIndicator,
  renderHtmlList,
  slugifyForId
} from "./shared.mjs";

export function renderDiscoveryCandidateCards(candidates, reportView) {
  const visible = candidates.slice(0, reportView.candidateCount);
  if (visible.length === 0) {
    return `<p class="empty">No discovery candidates available in this run.</p>`;
  }
  return `<div class="repo-grid">${visible.map((candidate) => {
    const whyRelevant = candidate.reasoning[0] ?? "Needs manual review.";
    const transfer = candidate.landkarteCandidate?.possible_implication ?? candidate.projectAlignment?.suggestedNextStep ?? "-";
    const strengths = candidate.landkarteCandidate?.strengths ?? "-";
    const risks = candidate.landkarteCandidate?.risks ?? "needs_review";
    const cardId = `repo-${slugifyForId(candidate.repo.owner + "-" + candidate.repo.name)}`;
    return `<article class="repo-card filter-card" id="${cardId}"
  data-search="${escapeHtml([candidate.repo.owner, candidate.repo.name, candidate.enrichment?.repo?.description ?? "", candidate.projectAlignment?.matchedCapabilities?.join(" ") ?? "", candidate.guess?.mainLayer ?? "", candidate.discoveryDisposition ?? ""].join(" ").toLowerCase())}"
  data-fit="${escapeHtml(candidate.projectAlignment?.fitBand ?? "unknown")}"
  data-mode="${escapeHtml(candidate.discoveryDisposition ?? "watch_only")}"
  data-layer="${escapeHtml(candidate.guess?.mainLayer ?? "unknown")}">
  <div class="repo-head">
    <h3>${escapeHtml(candidate.repo.owner)}/${escapeHtml(candidate.repo.name)}</h3>
    <div class="repo-badges">
      ${renderBadge(`Score ${candidate.discoveryScore}`, "accent")}
      ${renderBadge(`Fit ${candidate.projectAlignment?.fitBand ?? "unknown"}`, fitTone(candidate.projectAlignment?.fitBand))}
      ${renderBadge(candidate.discoveryDisposition, dispositionTone(candidate.discoveryDisposition))}
    </div>
  </div>
  <p class="repo-url"><a href="${escapeHtml(candidate.repo.normalizedRepoUrl)}">${escapeHtml(candidate.repo.normalizedRepoUrl)}</a></p>
  <p class="repo-copy">${escapeHtml(candidate.enrichment?.repo?.description || "No public description available.")}</p>
  <dl class="mini-grid">
    <div><dt>Why relevant</dt><dd>${escapeHtml(whyRelevant)}</dd></div>
    <div><dt>Strong area</dt><dd>${escapeHtml(strengths)}</dd></div>
    <div><dt>Transfer idea</dt><dd>${escapeHtml(transfer)}</dd></div>
    <div><dt>Risks</dt><dd>${escapeHtml(risks)}</dd></div>
  </dl>
  <details class="repo-details">
    <summary>Open repo reasoning</summary>
    ${renderHtmlList(candidate.reasoning, "No reasoning recorded.")}
  </details>
</article>`;
  }).join("")}</div>`;
}

export function renderWatchlistTopCards(review, reportView) {
  const visible = review.topItems.slice(0, reportView.candidateCount);
  if (visible.length === 0) {
    return `<p class="empty">No reviewed watchlist repositories yet.</p>`;
  }
  return `<div class="repo-grid">${visible.map((item) => {
    const cardId = `repo-${slugifyForId(item.repoRef)}`;
    return `<article class="repo-card filter-card" id="${cardId}"
  data-search="${escapeHtml([item.repoRef, item.reason, item.learningForEventbaer, item.possibleImplication, item.mainLayer, item.gapArea, item.matchedCapabilities.join(" ")].join(" ").toLowerCase())}"
  data-fit="${escapeHtml(item.projectFitBand || "unknown")}"
  data-mode="${escapeHtml(item.gapArea || "unknown")}"
  data-layer="${escapeHtml(item.mainLayer || "unknown")}">
  <div class="repo-head">
    <h3>${escapeHtml(item.repoRef)}</h3>
    <div class="repo-badges">
      ${renderBadge(`Review ${item.reviewScore}`, "accent")}
      ${renderBadge(`Fit ${item.projectFitBand || "unknown"}`, fitTone(item.projectFitBand))}
      ${renderBadge(item.mainLayer || "unknown", "neutral")}
    </div>
  </div>
  <p class="repo-copy">${escapeHtml(item.reason || "Needs manual review.")}</p>
  <dl class="mini-grid">
    <div><dt>Why it matters</dt><dd>${escapeHtml(item.learningForEventbaer || item.strengths || "-")}</dd></div>
    <div><dt>What to take</dt><dd>${escapeHtml(item.possibleImplication || item.suggestedNextStep || "-")}</dd></div>
    <div><dt>Strength</dt><dd>${escapeHtml(item.strengths || "-")}</dd></div>
    <div><dt>Weakness / risk</dt><dd>${escapeHtml(item.weaknesses || item.risks.join(", ") || "-")}</dd></div>
  </dl>
  <details class="repo-details">
    <summary>Open comparison details</summary>
    ${renderHtmlList([
      `Matched capabilities: ${item.matchedCapabilities.join(", ") || "-"}`,
      `Worker areas: ${item.recommendedWorkerAreas.join(", ") || "-"}`,
      `Suggested next step: ${item.suggestedNextStep || "-"}`
    ], "No extra details.")}
  </details>
</article>`;
  }).join("")}</div>`;
}

export function renderCoverageCards(coverage) {
  const groups = [
    { title: "Main layers", items: coverage.mainLayers.map((item) => `${item.value}: ${item.count}`) },
    { title: "Gap areas", items: coverage.gapAreas.map((item) => `${item.value}: ${item.count}`) },
    { title: "Capabilities", items: coverage.capabilities.map((item) => `${item.value}: ${item.count}`) }
  ];
  return `<div class="coverage-grid">${groups.map((group) => {
    const parsed = group.items.map((item) => {
      const [value, count] = item.split(": ");
      return { value, count: Number(count || 0) };
    });
    const maxCount = parsed.reduce((highest, item) => Math.max(highest, item.count), 1);
    return `<article class="coverage-card">
  <h3>${escapeHtml(group.title)}</h3>
  ${parsed.length === 0 ? renderHtmlList([], "none") : `<div class="bar-list">${parsed.map((item) => `<div class="bar-row">
    <span class="bar-label">${escapeHtml(item.value)}</span>
    <span class="bar-track"><span class="bar-fill" data-width="${Math.max(12, Math.round((item.count / maxCount) * 100))}"></span></span>
    <span class="bar-count">${item.count}</span>
  </div>`).join("")}</div>`}
</article>`;
  }).join("")}</div>`;
}

export function renderReviewScopeCards(review) {
  const scopeLabel = review.reviewScope === "selected_urls" ? "Selected URLs" : "Watchlist";
  const scopeCopy = review.reviewScope === "selected_urls"
    ? "This run focused only on the explicitly supplied repository URLs."
    : "This run compared the current project watchlist against queue-backed intake data.";
  const selectionLines = review.selectedUrls?.length > 0
    ? review.selectedUrls.map((url) => url)
    : [];

  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Run scope</h3>
    ${renderHtmlList([
      `Scope: ${scopeLabel}`,
      `Input URLs: ${review.inputUrlCount ?? 0}`,
      `Watchlist URLs: ${review.watchlistCount ?? 0}`,
      scopeCopy
    ], "No scope metadata.")}
  </article>
  <article class="coverage-card">
    <h3>Explicit selection</h3>
    ${renderHtmlList(
      selectionLines,
      review.reviewScope === "selected_urls"
        ? "No explicit URLs were captured for this run."
        : "This run used the watchlist rather than an explicit URL selection."
    )}
  </article>
  <article class="coverage-card">
    <h3>Decision data state</h3>
    ${renderHtmlList([
      `Complete: ${review.itemsDataStateSummary?.complete ?? 0}`,
      `Fallback: ${review.itemsDataStateSummary?.fallback ?? 0}`,
      `Stale: ${review.itemsDataStateSummary?.stale ?? 0}`,
      `Run confidence: ${review.runConfidence ?? "unknown"}`
    ], "No decision-state summary.")}
  </article>
</div>`;
}

function renderArtifactCard(title, copy, href, label = href) {
  return `<article class="coverage-card">
  <h3>${escapeHtml(title)}</h3>
  <p class="repo-copy">${escapeHtml(copy)}</p>
  ${href ? `<p class="repo-url"><a href="${escapeHtml(href)}">${escapeHtml(label || href)}</a></p>` : `<p class="empty">No artifact available.</p>`}
</article>`;
}

export function renderOnDemandRunCards(summary) {
  const reviewScope = summary.reviewRun?.review?.reviewScope ?? "not_run";
  const reviewLabel = reviewScope === "selected_urls" ? "selected urls" : reviewScope === "watchlist" ? "watchlist" : "not run";
  const runPlan = summary.runPlan ?? null;

  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Run mode</h3>
    ${renderHtmlList([
      `Run kind: ${runPlan?.runKind ?? "unknown"}`,
      `Focus: ${runPlan?.recommendedFocus ?? "-"}`,
      `Source mode: ${summary.sourceMode}`,
      `Explicit URLs: ${summary.explicitUrls.length}`,
      `Effective URLs: ${summary.effectiveUrls.length}`,
      `Append watchlist: ${summary.appendWatchlist ? "yes" : "no"}`
    ], "No run metadata.")}
  </article>
  <article class="coverage-card">
    <h3>Phase status</h3>
    ${renderHtmlList([
      `Intake items: ${summary.intakeRun?.items?.length ?? 0}`,
      `Re-evaluated rows: ${summary.reEvaluateRun?.updates?.length ?? 0}`,
      `Review scope: ${reviewLabel}`,
      `Promotion items: ${summary.promoteRun?.items?.length ?? 0}`
    ], "No phase data.")}
  </article>
  <article class="coverage-card">
    <h3>Review data quality</h3>
    ${renderHtmlList([
      `Run confidence: ${summary.reviewRun?.review?.runConfidence ?? "unknown"}`,
      `Complete: ${summary.reviewRun?.review?.itemsDataStateSummary?.complete ?? 0}`,
      `Fallback: ${summary.reviewRun?.review?.itemsDataStateSummary?.fallback ?? 0}`,
      `Stale: ${summary.reviewRun?.review?.itemsDataStateSummary?.stale ?? 0}`
    ], "No review data-state summary.")}
  </article>
</div>`;
}

export function renderOnDemandArtifactCards(artifacts) {
  return `<div class="coverage-grid">
  ${renderArtifactCard(
    "Review report",
    "Project-level HTML report generated for this on-demand run.",
    artifacts.reviewReportHref,
    artifacts.reviewReportLabel
  )}
  ${renderArtifactCard(
    "Latest report metadata",
    "Stable project pointer for the latest HTML report.",
    artifacts.latestReportHref,
    artifacts.latestReportLabel
  )}
  ${renderArtifactCard(
    "Browser link",
    "Local convenience pointer to open the latest project report quickly.",
    artifacts.browserLinkHref,
    artifacts.browserLinkLabel
  )}
</div>`;
}

export function renderOnDemandNextActions(actions) {
  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>What now</h3>
    ${renderHtmlList(actions, "No follow-up guidance available for this run.")}
  </article>
</div>`;
}

export function renderOnDemandRunPlanCards(runPlan) {
  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Lifecycle notes</h3>
    ${renderHtmlList(runPlan?.notes ?? [], "No lifecycle notes available for this run.")}
  </article>
  <article class="coverage-card">
    <h3>Default phase shape</h3>
    ${renderHtmlList([
      `Intake: ${runPlan?.defaultPhases?.intake ?? "-"}`,
      `Re-evaluate: ${runPlan?.defaultPhases?.reEvaluate ?? "-"}`,
      `Review: ${runPlan?.defaultPhases?.review ?? "-"}`,
      `Promote: ${runPlan?.defaultPhases?.promote ?? "-"}`
    ], "No phase guidance available.")}
  </article>
</div>`;
}

export function renderOnDemandRunDriftCards(runDrift) {
  const signalLines = (runDrift?.signals ?? []).map((item) => `${item.severity.toUpperCase()} · ${item.id} · ${item.message}`);
  const queueDecisionStateSummary = runDrift?.queueSnapshot?.decisionStateSummary ?? {};
  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Drift status</h3>
    ${renderHtmlList([
      `Status: ${runDrift?.driftStatus ?? "-"}`,
      `Signals: ${(runDrift?.signals ?? []).length}`,
      `Resume mode: ${runDrift?.resumeGuidance?.mode ?? "-"}`,
      `Resume action: ${runDrift?.resumeGuidance?.nextAction ?? "-"}`
    ], "No drift summary available for this run.")}
  </article>
  <article class="coverage-card">
    <h3>Queue state</h3>
    ${renderHtmlList([
      `Complete: ${queueDecisionStateSummary.complete ?? 0}`,
      `Fallback: ${queueDecisionStateSummary.fallback ?? 0}`,
      `Stale: ${queueDecisionStateSummary.stale ?? 0}`
    ], "No queue decision-state summary available.")}
  </article>
  <article class="coverage-card">
    <h3>Signals</h3>
    ${renderHtmlList(signalLines, "No drift signals are active right now.")}
  </article>
</div>`;
}

export function renderOnDemandGovernanceCards(governance) {
  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Governance status</h3>
    ${renderHtmlList([
      `Status: ${governance?.status ?? "-"}`,
      `Auto dispatch allowed: ${governance?.autoDispatchAllowed ? "yes" : "no"}`,
      `Auto apply allowed: ${governance?.autoApplyAllowed ? "yes" : "no"}`,
      `Recommended promotion mode: ${governance?.recommendedPromotionMode ?? "-"}`
    ], "No governance snapshot available for this run.")}
  </article>
  <article class="coverage-card">
    <h3>Blocked phases</h3>
    ${renderHtmlList(governance?.blockedPhases ?? [], "No blocked phases are active.")}
  </article>
  <article class="coverage-card">
    <h3>Next action</h3>
    ${renderHtmlList([governance?.nextAction].filter(Boolean), "No governance next action available.")}
  </article>
</div>`;
}

export function renderOnDemandStabilityCards(stability) {
  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Stability status</h3>
    ${renderHtmlList([
      `Status: ${stability?.status ?? "-"}`,
      `Stable streak: ${stability?.stableStreak ?? 0}`,
      `Unstable streak: ${stability?.unstableStreak ?? 0}`,
      `Compared pairs: ${stability?.comparedPairs ?? 0}`
    ], "No stability summary available for this run.")}
  </article>
</div>`;
}

export function renderRepoMatrix(review, reportView) {
  if (!reportView.showMatrix) {
    return `<p class="empty">Repo matrix hidden in compact report view.</p>`;
  }
  const rows = review.items.slice(0, reportView.candidateCount);
  if (rows.length === 0) {
    return `<p class="empty">No review rows available.</p>`;
  }
  return `<div class="table-wrap"><table class="data-table">
  <thead>
    <tr>
      <th>Repo</th>
      <th>Layer</th>
      <th>Gap</th>
      <th>Fit</th>
      <th>Relevance</th>
      <th>Next step</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((item) => `<tr>
      <td data-search="${escapeHtml([item.repoRef, item.mainLayer, item.gapArea, item.suggestedNextStep].join(" ").toLowerCase())}">${escapeHtml(item.repoRef)}</td>
      <td>${escapeHtml(item.mainLayer || "-")}</td>
      <td>${escapeHtml(item.gapArea || "-")}</td>
      <td>${escapeHtml(`${item.projectFitBand || "-"} (${item.projectFitScore})`)}</td>
      <td>${escapeHtml(item.projectRelevance || item.eventbaerRelevance || "-")}</td>
      <td>${escapeHtml(item.suggestedNextStep || "-")}</td>
    </tr>`).join("")}
  </tbody>
</table></div>`;
}

export function renderProjectContextSources(projectProfile, binding) {
  const loadedFiles = projectProfile?.contextSources?.loadedFiles ?? [];
  const missingFiles = projectProfile?.contextSources?.missingFiles ?? [];
  const scannedDirectories = projectProfile?.contextSources?.scannedDirectories ?? [];
  const nonEmptyDirectories = scannedDirectories.filter((item) => item.entryCount > 0);
  const declaredFiles = projectProfile?.contextSources?.declaredFiles ?? binding?.readBeforeAnalysis ?? [];
  const declaredDirectories = projectProfile?.contextSources?.declaredDirectories ?? binding?.referenceDirectories ?? [];
  const capabilitiesPresent = projectProfile?.capabilitiesPresent ?? [];

  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Read first files</h3>
    ${renderHtmlList(
      loadedFiles.length > 0 ? loadedFiles : declaredFiles,
      "No target-repo context files configured."
    )}
  </article>
  <article class="coverage-card">
    <h3>Missing configured files</h3>
    ${renderHtmlList(missingFiles, "All configured context files were available.")}
  </article>
  <article class="coverage-card">
    <h3>Scanned directories</h3>
    ${renderHtmlList(
      nonEmptyDirectories.length > 0
        ? nonEmptyDirectories.map((item) => `${item.path}/ (${item.entryCount} entries sampled)`)
        : declaredDirectories.map((item) => `${item}/`),
      "No directory context configured."
    )}
  </article>
  <article class="coverage-card">
    <h3>Signals extracted</h3>
    ${renderHtmlList(
      capabilitiesPresent.map((item) => `capability: ${item}`),
      "No target-project capabilities were inferred from the current context."
    )}
  </article>
</div>`;
}

export function renderReportToolbar({ modeOptions, layerOptions }) {
  return `<section class="toolbar-card">
  <div class="toolbar-grid">
    <label class="control">
      <span>Search</span>
      <input id="report-search" type="search" placeholder="Filter repos, layers, capabilities">
    </label>
    <label class="control">
      <span>Fit</span>
      <select id="report-fit">
        <option value="">All</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
        <option value="unknown">Unknown</option>
      </select>
    </label>
    <label class="control">
      <span>Mode</span>
      <select id="report-mode">
        <option value="">All</option>
        ${modeOptions.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}
      </select>
    </label>
    <label class="control">
      <span>Layer</span>
      <select id="report-layer">
        <option value="">All</option>
        ${layerOptions.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}
      </select>
    </label>
    <button class="ghost-button" id="report-reset" type="button">Reset</button>
  </div>
  ${renderFilterIndicator()}
</section>`;
}
