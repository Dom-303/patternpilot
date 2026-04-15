import { resolveReportView, resolveDiscoveryProfile } from "./constants.mjs";
import { uniqueStrings } from "./utils.mjs";
import {
  classifyLicense,
  escapeHtml,
  getCandidateDecisionSummary,
  getCandidateName,
  renderDataStateWarnBanner,
  renderDecisionSummary,
  renderHtmlList,
  renderLicenseTag,
  renderPolicyCalibrationCard,
  renderPolicySummaryCard,
  renderRecommendedActions,
  sortAdoptGroup
} from "./html/shared.mjs";
import {
  renderCoverageCards,
  renderDiscoveryCandidateCards,
  renderOnDemandArtifactCards,
  renderOnDemandGovernanceCards,
  renderOnDemandNextActions,
  renderOnDemandRunCards,
  renderOnDemandRunDriftCards,
  renderOnDemandRunPlanCards,
  renderOnDemandStabilityCards,
  renderProjectContextSources,
  renderRepoMatrix,
  renderReviewScopeCards,
  renderWatchlistTopCards
} from "./html/sections.mjs";
import { renderHtmlDocument } from "./html/document.mjs";

export {
  classifyLicense,
  renderDataStateWarnBanner,
  renderDecisionSummary,
  renderLicenseTag,
  renderRecommendedActions,
  sortAdoptGroup
};

export function renderDiscoveryHtmlReport({
  projectKey,
  createdAt,
  discovery,
  projectProfile,
  binding,
  reportView = "standard"
}) {
  const view = resolveReportView(reportView);
  const profile = discovery.discoveryProfile ?? resolveDiscoveryProfile("balanced", null);
  const candidates = discovery.candidates ?? [];
  const searchErrors = discovery.searchErrors ?? [];

  const topRecommendations = candidates
    .slice(0, Math.min(5, view.candidateCount))
    .map((candidate) => {
      const transfer = getCandidateDecisionSummary(candidate);
      return `${getCandidateName(candidate)}: ${transfer}`;
    });

  const sections = [
    {
      title: "Candidate overview",
      id: "candidate-overview",
      navLabel: "Kandidaten",
      body: renderDiscoveryCandidateCards(candidates, view)
    }
  ];

  if (view.showQueries) {
    sections.push({
      title: "Discovery lenses",
      id: "discovery-lenses",
      navLabel: "Lenses",
      collapsible: true,
      collapsed: false,
      tone: "info",
      body: `<div class="coverage-grid">${discovery.plan.plans.map((plan) => `<article class="coverage-card">
  <h3>${escapeHtml(plan.label)}</h3>
  <p class="repo-copy">${escapeHtml(plan.query)}</p>
  ${renderHtmlList(plan.reasons, "No reasons recorded.")}
</article>`).join("")}</div>`
    });
  }

  sections.push({
    title: "Discovery policy",
    id: "discovery-policy",
    navLabel: "Policy",
    collapsible: true,
    collapsed: true,
    tone: discovery.policySummary?.blocked > 0 ? "warn" : "info",
    body: renderPolicySummaryCard(discovery)
  });

  sections.push({
    title: "Policy calibration",
    id: "policy-calibration",
    navLabel: "Calibration",
    collapsible: true,
    collapsed: true,
    tone: discovery.policyCalibration?.status === "strict_needs_review" ? "warn" : "info",
    body: renderPolicyCalibrationCard(discovery)
  });

  sections.push({
    title: "Target repo context",
    id: "target-repo-context",
    navLabel: "Kontext",
    collapsible: true,
    collapsed: true,
    tone: "info",
    body: renderProjectContextSources(projectProfile, binding)
  });

  sections.push({
    title: "Search errors",
    id: "search-errors",
    navLabel: "Errors",
    collapsible: true,
    collapsed: true,
    tone: searchErrors.length > 0 ? "warn" : "default",
    body: renderHtmlList(
      searchErrors.map((item) => `${item.label}: ${item.error}`),
      "No search errors."
    )
  });

  return renderHtmlDocument({
    title: `Patternpilot Report — ${projectKey}`,
    reportType: "discovery",
    projectKey,
    createdAt,
    heroSubtitle: `${profile.id} profile`,
    candidateCount: candidates.length,
    stats: [
      { label: "Candidates", value: candidates.length, primary: true },
      { label: "Raw found", value: discovery.rawCandidateCount ?? candidates.length, primary: true },
      { label: "Scanned", value: discovery.scanned, primary: true },
      { label: "Queries", value: discovery.plan.plans.length, primary: true },
      { label: "Policy mode", value: discovery.policySummary?.mode ?? "off", primary: false },
      { label: "Policy flagged", value: discovery.policySummary?.blocked ?? 0, primary: false },
      { label: "Policy hidden", value: discovery.policySummary?.enforcedBlocked ?? 0, primary: false },
      { label: "Policy preferred", value: discovery.policySummary?.preferred ?? 0, primary: false },
      { label: "Profile", value: profile.id, primary: false },
      { label: "Profile limit", value: profile.limit, primary: false },
      { label: "Known skipped", value: discovery.knownUrlCount, primary: false },
      { label: "Created", value: createdAt.slice(0, 16).replace("T", " "), primary: false },
      { label: "View", value: view.id, primary: false }
    ],
    recommendations: topRecommendations,
    candidates,
    runRoot: discovery,
    sections,
    modeOptions: uniqueStrings(candidates.map((c) => c.discoveryDisposition)),
    layerOptions: uniqueStrings(candidates.map((c) => c.guess?.mainLayer ?? ""))
  });
}

export function renderWatchlistReviewHtmlReport(review, reportView = "standard") {
  const view = resolveReportView(reportView);
  const items = review.items ?? [];
  const topItems = review.topItems ?? [];
  const riskiestItems = review.riskiestItems ?? [];
  const missingUrls = review.missingUrls ?? [];
  const nextSteps = review.nextSteps ?? [];

  const sections = [
    {
      title: "Top compared repositories",
      id: "top-compared-repositories",
      navLabel: "Kandidaten",
      body: renderWatchlistTopCards(review, view)
    }
  ];

  if (view.showCoverage) {
    sections.push({
      title: "Coverage & signals",
      id: "coverage",
      navLabel: "Coverage",
      collapsible: true,
      collapsed: false,
      body: renderCoverageCards(review.coverage)
    });
  }

  sections.push({
    title: "Run scope",
    id: "run-scope",
    navLabel: "Scope",
    collapsible: true,
    collapsed: false,
    tone: "info",
    body: renderReviewScopeCards(review)
  });

  sections.push({
    title: "Target repo context",
    id: "target-repo-context",
    navLabel: "Kontext",
    collapsible: true,
    collapsed: true,
    tone: "info",
    body: renderProjectContextSources(review.projectProfile, review.binding)
  });

  sections.push({
    title: "Highest risk signals",
    id: "highest-risk-signals",
    navLabel: "Risks",
    collapsible: true,
    collapsed: true,
    tone: riskiestItems.length > 0 ? "warn" : "default",
    body: renderHtmlList(
      riskiestItems.map((item) => `${item.repoRef}: ${item.risks.join(", ") || item.weaknesses || "needs_review"}`),
      "No strong risk signals in the current review set."
    )
  });

  sections.push({
    title: review.reviewScope === "selected_urls" ? "Missing selected intake" : "Missing watchlist intake",
    id: "missing-watchlist-intake",
    navLabel: "Missing",
    collapsible: true,
    collapsed: true,
    body: renderHtmlList(missingUrls, "All current watchlist URLs already have queue coverage.")
  });

  if (view.showMatrix) {
    sections.push({
      title: "Repo matrix",
      id: "repo-matrix",
      navLabel: "Matrix",
      collapsible: true,
      collapsed: true,
      body: renderRepoMatrix(review, view)
    });
  }

  return renderHtmlDocument({
    title: `Patternpilot Report — ${review.projectKey}`,
    reportType: "review",
    projectKey: review.projectKey,
    createdAt: review.createdAt,
    heroSubtitle: `${review.analysisProfile.id} / ${review.analysisDepth.id}`,
    candidateCount: items.length,
    stats: [
      { label: "Reviewed repos", value: items.length, primary: true },
      { label: "Top items", value: Math.min(topItems.length, view.candidateCount), primary: true },
      { label: "Missing intake", value: missingUrls.length, primary: true },
      { label: "Scope", value: review.reviewScope === "selected_urls" ? "selected" : "watchlist", primary: false },
      { label: "Input URLs", value: review.inputUrlCount ?? review.watchlistCount, primary: false },
      { label: "Analysis profile", value: review.analysisProfile.id, primary: false },
      { label: "Depth", value: review.analysisDepth.id, primary: false },
      { label: "Watchlist URLs", value: review.watchlistCount, primary: false },
      { label: "Created", value: review.createdAt.slice(0, 16).replace("T", " "), primary: false },
      { label: "View", value: view.id, primary: false }
    ],
    recommendations: nextSteps,
    candidates: topItems,
    runRoot: review,
    sections,
    modeOptions: uniqueStrings(items.map((item) => item.gapArea || "")),
    layerOptions: uniqueStrings(items.map((item) => item.mainLayer || ""))
  });
}

export function renderOnDemandRunHtmlReport(summary) {
  const review = summary.reviewRun?.review ?? null;
  const runPlan = summary.runPlan ?? null;
  const runDrift = summary.runDrift ?? null;
  const runStability = summary.runStability ?? null;
  const runGovernance = summary.runGovernance ?? null;
  const reviewRoot = review ?? {
    reportSchemaVersion: 2,
    runConfidence: "unknown",
    runConfidenceReason: "Review skipped in this run.",
    itemsDataStateSummary: { complete: 0, fallback: 0, stale: 0 }
  };
  const candidates = review?.topItems ?? [];
  const recommendations = review?.nextSteps?.length > 0
    ? review.nextSteps
    : [
        "Open the project review report from this run.",
        "Inspect the explicit URL set or watchlist coverage before promoting anything.",
        "Only move into promotion after the review looks directionally strong."
      ];

  const sections = [
    {
      title: "Run summary",
      id: "run-summary",
      navLabel: "Run",
      body: renderOnDemandRunCards(summary)
    },
    {
      title: "Effective URLs",
      id: "effective-urls",
      navLabel: "URLs",
      collapsible: true,
      collapsed: false,
      body: renderHtmlList(summary.effectiveUrls, "No effective URLs were part of this run.")
    },
    {
      title: "Artifacts",
      id: "artifacts",
      navLabel: "Artefakte",
      collapsible: true,
      collapsed: false,
      tone: "info",
      body: renderOnDemandArtifactCards(summary.artifacts)
    },
    {
      title: "Run plan",
      id: "run-plan",
      navLabel: "Plan",
      collapsible: true,
      collapsed: false,
      tone: "info",
      body: renderOnDemandRunPlanCards(runPlan)
    },
    {
      title: "Run drift",
      id: "run-drift",
      navLabel: "Drift",
      collapsible: true,
      collapsed: false,
      tone: runDrift?.driftStatus === "attention_required" ? "warn" : "info",
      body: renderOnDemandRunDriftCards(runDrift)
    },
    {
      title: "Stability",
      id: "run-stability",
      navLabel: "Stability",
      collapsible: true,
      collapsed: false,
      tone: runStability?.status === "unstable_streak" ? "warn" : "info",
      body: renderOnDemandStabilityCards(runStability)
    },
    {
      title: "Governance",
      id: "run-governance",
      navLabel: "Governance",
      collapsible: true,
      collapsed: false,
      tone: runGovernance?.status === "manual_gate" ? "warn" : "info",
      body: renderOnDemandGovernanceCards(runGovernance)
    },
    {
      title: "What now",
      id: "what-now",
      navLabel: "Next",
      collapsible: true,
      collapsed: false,
      tone: "info",
      body: renderOnDemandNextActions(summary.nextActions ?? [])
    }
  ];

  if (review) {
    sections.push({
      title: "Review scope",
      id: "review-scope",
      navLabel: "Scope",
      collapsible: true,
      collapsed: false,
      tone: "info",
      body: renderReviewScopeCards(review)
    });
  }

  return renderHtmlDocument({
    title: `Patternpilot On-Demand Run — ${summary.projectKey}`,
    reportType: "on_demand",
    projectKey: summary.projectKey,
    createdAt: summary.createdAt,
    heroSubtitle: `${summary.sourceMode} / ${review?.analysisProfile?.id ?? "no-review"}`,
    candidateCount: summary.effectiveUrls.length,
    stats: [
      { label: "Effective URLs", value: summary.effectiveUrls.length, primary: true },
      { label: "Intake items", value: summary.intakeRun?.items?.length ?? 0, primary: true },
      { label: "Review items", value: review?.items?.length ?? 0, primary: true },
      { label: "Run kind", value: runPlan?.runKind ?? "unknown", primary: false },
      { label: "Drift", value: runDrift?.driftStatus ?? "-", primary: false },
      { label: "Stability", value: runStability?.status ?? "-", primary: false },
      { label: "Governance", value: runGovernance?.status ?? "-", primary: false },
      { label: "Source mode", value: summary.sourceMode, primary: false },
      { label: "Dry run", value: summary.dryRun ? "yes" : "no", primary: false },
      { label: "Review scope", value: review?.reviewScope ?? "not_run", primary: false },
      { label: "Created", value: summary.createdAt.slice(0, 16).replace("T", " "), primary: false },
      { label: "Run ID", value: summary.runId, primary: false }
    ],
    recommendations,
    candidates,
    runRoot: reviewRoot,
    sections,
    modeOptions: uniqueStrings(candidates.map((item) => item.gapArea || "")),
    layerOptions: uniqueStrings(candidates.map((item) => item.mainLayer || ""))
  });
}
