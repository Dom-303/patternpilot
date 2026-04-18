import { resolveReportView, resolveDiscoveryProfile } from "./constants.mjs";
import { uniqueStrings } from "./utils.mjs";
import {
  classifyLicense,
  escapeHtml,
  getCandidateDecisionSummary,
  getCandidateName,
  localizeGeneratedText,
  localizeSystemTerm,
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
  renderAgentField,
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

function localizeModeValue(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "-";
  const mapping = {
    off: "aus",
    audit: "sichtbar pruefen",
    enforce: "erzwingen",
    prefer: "bevorzugen",
    explicit_urls: "explizite URLs",
    watchlist: "Beobachtungsliste",
    selected_urls: "explizite URLs",
    not_run: "nicht gelaufen",
    kein_review: "kein Review",
    "kein Review": "kein Review",
    first_run: "erster Lauf",
    follow_up_run: "Folgelauf",
    repeat_run: "Folgelauf",
    no_runs: "keine Laeufe",
    baseline_only: "nur Baseline",
    baseline_required: "Baseline noetig",
    unstable_streak: "instabile Serie",
    stable_streak: "stabile Serie",
    mixed: "gemischt",
    no_drift: "keine Drift",
    attention_required: "Aufmerksamkeit noetig",
    manual_gate: "manuelles Gate",
    comparison_and_decision: "Vergleich und Entscheidung",
    orientation_and_scope: "Orientierung und Umfang",
    balanced: "ausgewogen",
    standard: "Standard",
    unknown: "unbekannt",
    unbekannt: "unbekannt"
  };
  return mapping[normalized] ?? normalized.replaceAll("_", " ");
}

function buildAgentPayloadScript(value) {
  return JSON.stringify(value ?? {}, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function buildSharedAgentMission({ projectKey, reportType, nextSteps, topName, runConfidence }) {
  const mission = [];
  mission.push(`Arbeite nur im Kontext von ${projectKey} und leite keine generischen Entscheidungen ohne Bezug zum Zielprojekt ab.`);
  if (topName) {
    mission.push(`Beginne mit ${topName} als staerkstem Ausgangspunkt dieses Berichts.`);
  }
  if (nextSteps?.[0]) {
    mission.push(localizeGeneratedText(nextSteps[0]));
  }
  mission.push(`Vertrauen in den Lauf: ${localizeModeValue(runConfidence ?? "unbekannt")}. Unsichere Stellen vor Veraenderungen manuell pruefen.`);
  if (reportType === "on_demand") {
    mission.push("Nutze diesen Bericht als operative Uebergabe fuer den direkten naechsten Schritt, nicht als langfristige Strategieakte.");
  }
  return mission;
}

function summarizeTopCoverageItem(list = [], fallback = "unbekannt") {
  const top = Array.isArray(list) && list.length > 0 ? list[0] : null;
  if (!top) return fallback;
  return `${localizeSystemTerm(top.value ?? top.id ?? fallback)} (${top.count ?? 0})`;
}

export function buildDiscoveryAgentView({ projectKey, discovery, discoveryProfile = null }) {
  const candidates = discovery?.candidates ?? [];
  const profile = discoveryProfile ?? discovery?.discoveryProfile ?? resolveDiscoveryProfile("balanced", null);
  const searchErrors = discovery?.searchErrors ?? [];
  const topRecommendations = candidates
    .slice(0, 5)
    .map((candidate) => `${getCandidateName(candidate)}: ${getCandidateDecisionSummary(candidate)}`);

  return {
    mission: buildSharedAgentMission({
      projectKey,
      reportType: "discovery",
      nextSteps: topRecommendations,
      topName: candidates[0] ? getCandidateName(candidates[0]) : "",
      runConfidence: discovery?.runConfidence
    }),
    priorityRepos: candidates.slice(0, 3).map((candidate) => ({
      repo: getCandidateName(candidate),
      url: candidate.repo?.normalizedRepoUrl,
      action: getCandidateDecisionSummary(candidate)
    })),
    guardrails: [
      `Profil: ${localizeModeValue(profile.id)}`,
      `Regelmodus: ${localizeModeValue(discovery?.policySummary?.mode ?? "aus")}`,
      `Vom Regelwerk markiert: ${discovery?.policySummary?.blocked ?? 0}`,
      `Suchfehler: ${searchErrors.length}`
    ],
    context: [
      `Suchanfragen in diesem Lauf: ${discovery?.plan?.plans?.length ?? 0}`,
      `Gescannt: ${discovery?.scanned ?? 0}`,
      `Sichtbare Kandidaten: ${candidates.length}`,
      `Staerkster Kandidat: ${candidates[0] ? getCandidateName(candidates[0]) : "keiner"}`
    ],
    uncertainties: [
      searchErrors.length > 0 ? `${searchErrors.length} Suchfehler schraenken die Discovery-Qualitaet dieses Laufs ein.` : null,
      (discovery?.policySummary?.blocked ?? 0) > 0 ? `${discovery.policySummary.blocked} Kandidaten wurden vom Regelwerk markiert und brauchen bei Bedarf eine bewusste Sichtpruefung.` : null,
      candidates.length === 0 ? "Dieser Lauf hat keine sichtbaren Kandidaten geliefert. Erst Suchrichtung und Regelmodus pruefen." : null
    ].filter(Boolean),
    payload: {
      reportType: "discovery",
      projectKey,
      runConfidence: discovery?.runConfidence ?? "unbekannt",
      scanned: discovery?.scanned ?? 0,
      candidateCount: candidates.length,
      topCandidates: candidates.slice(0, 3).map((candidate) => ({
        repo: getCandidateName(candidate),
        url: candidate.repo?.normalizedRepoUrl ?? null,
        disposition: candidate.discoveryDisposition ?? "unknown",
        fitBand: candidate.projectAlignment?.fitBand ?? "unknown",
        nextStep: getCandidateDecisionSummary(candidate)
      }))
    },
    downloadFileName: `patternpilot-agent-handoff-${projectKey}-discovery.json`
  };
}

export function buildReviewAgentView(review, options = {}) {
  const topItems = review?.topItems ?? [];
  const visibleCount = options.visibleCount ?? 3;
  const missingUrls = review?.missingUrls ?? review?.missingWatchlistUrls ?? [];

  return {
    mission: buildSharedAgentMission({
      projectKey: review?.projectKey,
      reportType: "review",
      nextSteps: review?.nextSteps ?? [],
      topName: topItems[0]?.repoRef ?? "",
      runConfidence: review?.runConfidence
    }),
    priorityRepos: topItems.slice(0, 3).map((item) => ({
      repo: item.repoRef,
      url: `https://github.com/${item.repoRef}`,
      action: localizeGeneratedText(item.suggestedNextStep || item.reason || "Manuell pruefen.")
    })),
    guardrails: [
      `Review-Umfang: ${localizeModeValue(review?.reviewScope)}`,
      `Fehlendes Intake: ${missingUrls.length}`,
      `Vertrauen in den Lauf: ${localizeModeValue(review?.runConfidence ?? "unbekannt")}`,
      `Top-Eintraege im Bericht: ${Math.min(topItems.length, visibleCount)}`
    ],
    context: [
      `Staerkste Ebene: ${summarizeTopCoverageItem(review?.coverage?.mainLayers)}`,
      `Staerkster Lueckenbereich: ${summarizeTopCoverageItem(review?.coverage?.gapAreas)}`,
      `Staerkste Faehigkeit: ${summarizeTopCoverageItem(review?.coverage?.capabilities)}`,
      `Top-Repo fuer den Einstieg: ${topItems[0]?.repoRef ?? "keins"}`
    ],
    uncertainties: [
      missingUrls.length > 0 ? `${missingUrls.length} ausgewaehlte URLs fehlen noch mit frischer Intake-Abdeckung.` : null,
      (review?.itemsDataStateSummary?.fallback ?? 0) > 0 ? `${review.itemsDataStateSummary.fallback} Eintraege sind nur per Fallback bewertet.` : null,
      (review?.itemsDataStateSummary?.stale ?? 0) > 0 ? `${review.itemsDataStateSummary.stale} Eintraege beruhen auf veralteten Bewertungsregeln.` : null,
      topItems.some((item) => (item.projectFitBand ?? "unknown") === "low") ? "Mindestens ein sichtbarer Kandidat hat niedrige Passung und sollte nicht vorschnell uebernommen werden." : null
    ].filter(Boolean),
    payload: {
      reportType: "review",
      projectKey: review?.projectKey,
      reviewScope: review?.reviewScope,
      runConfidence: review?.runConfidence ?? "unbekannt",
      context: {
        mainLayer: review?.coverage?.mainLayers?.[0]?.value ?? null,
        gapArea: review?.coverage?.gapAreas?.[0]?.value ?? null,
        capability: review?.coverage?.capabilities?.[0]?.value ?? null
      },
      topRepos: topItems.slice(0, 3).map((item) => ({
        repo: item.repoRef,
        url: `https://github.com/${item.repoRef}`,
        fitBand: item.projectFitBand ?? "unknown",
        mainLayer: item.mainLayer ?? null,
        gapArea: item.gapArea ?? null,
        nextStep: localizeGeneratedText(item.suggestedNextStep || item.reason || "Manuell pruefen.")
      }))
    },
    downloadFileName: `patternpilot-agent-handoff-${review?.projectKey ?? "projekt"}-review.json`
  };
}

export function buildOnDemandAgentView(summary) {
  const review = summary?.reviewRun?.review ?? null;
  const runPlan = summary?.runPlan ?? null;
  const runDrift = summary?.runDrift ?? null;
  const runStability = summary?.runStability ?? null;
  const runGovernance = summary?.runGovernance ?? null;

  return {
    mission: buildSharedAgentMission({
      projectKey: summary?.projectKey,
      reportType: "on_demand",
      nextSteps: summary?.nextActions ?? [],
      topName: review?.topItems?.[0]?.repoRef ?? "",
      runConfidence: review?.runConfidence ?? "unbekannt"
    }),
    priorityRepos: (review?.topItems ?? []).slice(0, 3).map((item) => ({
      repo: item.repoRef,
      url: `https://github.com/${item.repoRef}`,
      action: localizeGeneratedText(item.suggestedNextStep || item.reason || "Manuell pruefen.")
    })),
    guardrails: [
      `Laufart: ${localizeModeValue(runPlan?.runKind ?? "unbekannt")}`,
      `Governance: ${localizeModeValue(runGovernance?.status ?? "-")}`,
      `Drift: ${localizeModeValue(runDrift?.driftStatus ?? "-")}`,
      `Stabilitaet: ${localizeModeValue(runStability?.status ?? "-")}`
    ],
    context: [
      `Quellmodus: ${localizeModeValue(summary?.sourceMode)}`,
      `Wirksame URLs: ${summary?.effectiveUrls?.length ?? 0}`,
      `Review-Umfang: ${localizeModeValue(review?.reviewScope ?? "nicht_gelaufen")}`,
      `Staerkstes Review-Repo: ${review?.topItems?.[0]?.repoRef ?? "keins"}`
    ],
    uncertainties: [
      runGovernance?.status === "manual_gate" ? "Dieser Lauf ist operativ unter manueller Governance. Ein Agent sollte keine automatische Folgeaktion unterstellen." : null,
      runDrift?.driftStatus === "attention_required" ? "Die Laufdrift verlangt Aufmerksamkeit. Vor tieferen Veraenderungen zuerst den Laufkontext pruefen." : null,
      runStability?.status === "unstable_streak" ? "Die letzten vergleichbaren Laeufe wirken instabil. Ergebnisse vorsichtig behandeln." : null,
      !review ? "In diesem Ad-hoc-Lauf wurde kein Review erzeugt. Agentische Entscheidungen haben deshalb wenig Vergleichsbasis." : null
    ].filter(Boolean),
    payload: {
      reportType: "on_demand",
      projectKey: summary?.projectKey,
      runId: summary?.runId,
      sourceMode: summary?.sourceMode,
      effectiveUrls: summary?.effectiveUrls ?? [],
      governance: runGovernance?.status ?? null,
      drift: runDrift?.driftStatus ?? null,
      stability: runStability?.status ?? null,
      context: {
        reviewScope: review?.reviewScope ?? null,
        topRepo: review?.topItems?.[0]?.repoRef ?? null
      },
      topRepos: (review?.topItems ?? []).slice(0, 3).map((item) => ({
        repo: item.repoRef,
        url: `https://github.com/${item.repoRef}`,
        fitBand: item.projectFitBand ?? "unknown",
        mainLayer: item.mainLayer ?? null,
        gapArea: item.gapArea ?? null,
        nextStep: localizeGeneratedText(item.suggestedNextStep || item.reason || "Manuell pruefen.")
      })),
      nextActions: (summary?.nextActions ?? []).map((item) => localizeGeneratedText(item))
    },
    downloadFileName: `patternpilot-agent-handoff-${summary?.projectKey ?? "projekt"}-on-demand.json`
  };
}

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
  const agentView = buildDiscoveryAgentView({ projectKey, discovery, discoveryProfile: profile });

  const topRecommendations = candidates
    .slice(0, Math.min(5, view.candidateCount))
    .map((candidate) => {
      const transfer = getCandidateDecisionSummary(candidate);
      return `${getCandidateName(candidate)}: ${transfer}`;
    });

  const sections = [
    {
      title: "Kandidatenuebersicht",
      id: "candidate-overview",
      navLabel: "Kandidaten",
      body: renderDiscoveryCandidateCards(candidates, view)
    }
  ];

  if (view.showQueries) {
    sections.push({
      title: "Discovery-Linsen",
      id: "discovery-lenses",
      navLabel: "Linsen",
      collapsible: true,
      collapsed: false,
      tone: "info",
      body: `<div class="coverage-grid">${discovery.plan.plans.map((plan) => `<article class="coverage-card">
  <h3>${escapeHtml(plan.label)}</h3>
  <p class="repo-copy">${escapeHtml(plan.query)}</p>
  ${renderHtmlList(plan.reasons, "Keine Gruende erfasst.")}
</article>`).join("")}</div>`
    });
  }

  sections.push({
    title: "Discovery-Regelwerk",
    id: "discovery-policy",
    navLabel: "Regeln",
    collapsible: true,
    collapsed: true,
    tone: discovery.policySummary?.blocked > 0 ? "warn" : "info",
    body: renderPolicySummaryCard(discovery)
  });

  sections.push({
    title: "Regel-Kalibrierung",
    id: "policy-calibration",
    navLabel: "Kalibrierung",
    collapsible: true,
    collapsed: true,
    tone: discovery.policyCalibration?.status === "strict_needs_review" ? "warn" : "info",
    body: renderPolicyCalibrationCard(discovery)
  });

  sections.push({
    title: "KI Coding Agents",
    id: "agent-view",
    navLabel: "Agenten",
    collapsible: true,
    collapsed: true,
    tone: "info",
    body: renderAgentField(agentView)
  });

  sections.push({
    title: "Zielrepo-Kontext",
    id: "target-repo-context",
    navLabel: "Kontext",
    collapsible: true,
    collapsed: true,
    tone: "info",
    body: renderProjectContextSources(projectProfile, binding)
  });

  sections.push({
    title: "Suchfehler",
    id: "search-errors",
    navLabel: "Fehler",
    collapsible: true,
    collapsed: true,
    tone: searchErrors.length > 0 ? "warn" : "default",
      body: renderHtmlList(
      searchErrors.map((item) => `${localizeGeneratedText(item.label)}: ${localizeGeneratedText(item.error)}`),
      "Keine Suchfehler."
    )
  });

  return renderHtmlDocument({
    title: `Patternpilot Bericht — ${projectKey}`,
    reportType: "discovery",
    projectKey,
    createdAt,
    heroSubtitle: `${localizeModeValue(profile.id)} Profil`,
    candidateCount: candidates.length,
    stats: [
      { label: "Kandidaten", value: candidates.length, primary: true },
      { label: "Roh gefunden", value: discovery.rawCandidateCount ?? candidates.length, primary: true },
      { label: "Gescannt", value: discovery.scanned, primary: true },
      { label: "Suchanfragen", value: discovery.plan.plans.length, primary: true },
      { label: "Regelmodus", value: localizeModeValue(discovery.policySummary?.mode ?? "aus"), primary: false },
      { label: "Vom Regelwerk markiert", value: discovery.policySummary?.blocked ?? 0, primary: false },
      { label: "Vom Regelwerk ausgeblendet", value: discovery.policySummary?.enforcedBlocked ?? 0, primary: false },
      { label: "Regelwerk bevorzugt", value: discovery.policySummary?.preferred ?? 0, primary: false },
      { label: "Profil", value: localizeModeValue(profile.id), primary: false },
      { label: "Profil-Limit", value: profile.limit, primary: false },
      { label: "Bekannte uebersprungen", value: discovery.knownUrlCount, primary: false },
      { label: "Erstellt", value: createdAt.slice(0, 16).replace("T", " "), primary: false },
      { label: "Ansicht", value: localizeModeValue(view.id), primary: false }
    ],
    recommendations: topRecommendations,
    candidates,
    runRoot: discovery,
    sections,
    modeOptions: uniqueStrings(candidates.map((c) => c.discoveryDisposition)),
    layerOptions: uniqueStrings(candidates.map((c) => c.guess?.mainLayer ?? "")),
    agentPayloadScript: buildAgentPayloadScript(agentView.payload)
  });
}

export function renderWatchlistReviewHtmlReport(review, reportView = "standard") {
  const view = resolveReportView(reportView);
  const items = review.items ?? [];
  const topItems = review.topItems ?? [];
  const riskiestItems = review.riskiestItems ?? [];
  const missingUrls = review.missingUrls ?? [];
  const nextSteps = review.nextSteps ?? [];
  const agentView = buildReviewAgentView(review, { visibleCount: view.candidateCount });

  const sections = [
    {
      title: "Staerkste Vergleichs-Repos",
      id: "top-compared-repositories",
      navLabel: "Kandidaten",
      body: renderWatchlistTopCards(review, view)
    }
  ];

  if (view.showCoverage) {
    sections.push({
      title: "Abdeckung und Signale",
      id: "coverage",
      navLabel: "Abdeckung",
      collapsible: true,
      collapsed: false,
      body: renderCoverageCards(review.coverage)
    });
  }

  sections.push({
    title: "Umfang des Laufs",
    id: "run-scope",
    navLabel: "Umfang",
    collapsible: true,
    collapsed: false,
    tone: "info",
    body: renderReviewScopeCards(review)
  });

  sections.push({
    title: "KI Coding Agents",
    id: "agent-view",
    navLabel: "Agenten",
    collapsible: true,
    collapsed: true,
    tone: "info",
    body: renderAgentField(agentView)
  });

  sections.push({
    title: "Zielrepo-Kontext",
    id: "target-repo-context",
    navLabel: "Kontext",
    collapsible: true,
    collapsed: true,
    tone: "info",
    body: renderProjectContextSources(review.projectProfile, review.binding)
  });

  sections.push({
    title: "Staerkste Risikosignale",
    id: "highest-risk-signals",
    navLabel: "Risiken",
    collapsible: true,
    collapsed: true,
    tone: riskiestItems.length > 0 ? "warn" : "default",
    body: renderHtmlList(
      riskiestItems.map((item) => `${item.repoRef}: ${localizeGeneratedText(item.risks.join(", ") || item.weaknesses || "needs_review")}`),
      "Keine starken Risikosignale im aktuellen Review-Set."
    )
  });

  sections.push({
    title: review.reviewScope === "selected_urls" ? "Fehlendes Intake fuer Auswahl" : "Fehlendes Intake fuer Watchlist",
    id: "missing-watchlist-intake",
    navLabel: "Fehlt",
    collapsible: true,
    collapsed: true,
    body: renderHtmlList(missingUrls, "Alle aktuellen Watchlist-URLs sind bereits in der Queue abgedeckt.")
  });

  if (view.showMatrix) {
    sections.push({
      title: "Repo-Matrix",
      id: "repo-matrix",
      navLabel: "Matrix",
      collapsible: true,
      collapsed: true,
      body: renderRepoMatrix(review, view)
    });
  }

  return renderHtmlDocument({
    title: `Patternpilot Bericht — ${review.projectKey}`,
    reportType: "review",
    projectKey: review.projectKey,
    createdAt: review.createdAt,
    heroSubtitle: `${localizeModeValue(review.analysisProfile.id)} / ${localizeModeValue(review.analysisDepth.id)}`,
    candidateCount: items.length,
    stats: [
      { label: "Gepruefte Repos", value: items.length, primary: true },
      { label: "Top-Eintraege", value: Math.min(topItems.length, view.candidateCount), primary: true },
      { label: "Fehlendes Intake", value: missingUrls.length, primary: true },
      { label: "Umfang", value: review.reviewScope === "selected_urls" ? "explizit" : "Beobachtungsliste", primary: false },
      { label: "Eingangs-URLs", value: review.inputUrlCount ?? review.watchlistCount, primary: false },
      { label: "Analyseprofil", value: localizeModeValue(review.analysisProfile.id), primary: false },
      { label: "Tiefe", value: localizeModeValue(review.analysisDepth.id), primary: false },
      { label: "Beobachtungslisten-URLs", value: review.watchlistCount, primary: false },
      { label: "Erstellt", value: review.createdAt.slice(0, 16).replace("T", " "), primary: false },
      { label: "Ansicht", value: localizeModeValue(view.id), primary: false }
    ],
    recommendations: nextSteps,
    candidates: topItems,
    runRoot: review,
    sections,
    modeOptions: uniqueStrings(items.map((item) => item.gapArea || "")),
    layerOptions: uniqueStrings(items.map((item) => item.mainLayer || "")),
    agentPayloadScript: buildAgentPayloadScript(agentView.payload)
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
    runConfidence: "unbekannt",
    runConfidenceReason: "In diesem Lauf wurde kein Review erzeugt.",
    itemsDataStateSummary: { complete: 0, fallback: 0, stale: 0 }
  };
  const candidates = review?.topItems ?? [];
  const recommendations = review?.nextSteps?.length > 0
    ? review.nextSteps
    : [
        "Oeffne zuerst den Projekt-Review-Bericht aus diesem Lauf.",
        "Pruefe vor einer Promotion die expliziten URLs oder die Watchlist-Abdeckung.",
        "Gehe erst in die Promotion, wenn das Review klar in eine Richtung zeigt."
      ];
  const agentView = buildOnDemandAgentView(summary);

  const sections = [
    {
      title: "Laufzusammenfassung",
      id: "run-summary",
      navLabel: "Lauf",
      body: renderOnDemandRunCards(summary)
    },
    {
      title: "Wirksame URLs",
      id: "effective-urls",
      navLabel: "URLs",
      collapsible: true,
      collapsed: false,
      body: renderHtmlList(summary.effectiveUrls, "Zu diesem Lauf gehoerten keine wirksamen URLs.")
    },
    {
      title: "Artefakte",
      id: "artifacts",
      navLabel: "Artefakte",
      collapsible: true,
      collapsed: false,
      tone: "info",
      body: renderOnDemandArtifactCards(summary.artifacts)
    },
    {
      title: "Laufplan",
      id: "run-plan",
      navLabel: "Plan",
      collapsible: true,
      collapsed: false,
      tone: "info",
      body: renderOnDemandRunPlanCards(runPlan)
    },
    {
      title: "Laufdrift",
      id: "run-drift",
      navLabel: "Drift",
      collapsible: true,
      collapsed: false,
      tone: runDrift?.driftStatus === "attention_required" ? "warn" : "info",
      body: renderOnDemandRunDriftCards(runDrift)
    },
    {
      title: "Stabilitaet",
      id: "run-stability",
      navLabel: "Stabilitaet",
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
      title: "Was jetzt",
      id: "what-now",
      navLabel: "Weiter",
      collapsible: true,
      collapsed: false,
      tone: "info",
      body: renderOnDemandNextActions(summary.nextActions ?? [])
    }
  ];

  if (review) {
    sections.push({
      title: "Review-Umfang",
      id: "review-scope",
      navLabel: "Umfang",
      collapsible: true,
      collapsed: false,
      tone: "info",
      body: renderReviewScopeCards(review)
    });
  }

  sections.push({
    title: "KI Coding Agents",
    id: "agent-view",
    navLabel: "Agenten",
    collapsible: true,
    collapsed: true,
    tone: "info",
    body: renderAgentField(agentView)
  });

  return renderHtmlDocument({
    title: `Patternpilot On-Demand-Lauf — ${summary.projectKey}`,
    reportType: "on_demand",
    projectKey: summary.projectKey,
    createdAt: summary.createdAt,
    heroSubtitle: `${localizeModeValue(summary.sourceMode)} / ${localizeModeValue(review?.analysisProfile?.id ?? "kein Review")}`,
    candidateCount: summary.effectiveUrls.length,
    stats: [
      { label: "Wirksame URLs", value: summary.effectiveUrls.length, primary: true },
      { label: "Intake-Eintraege", value: summary.intakeRun?.items?.length ?? 0, primary: true },
      { label: "Review-Eintraege", value: review?.items?.length ?? 0, primary: true },
      { label: "Laufart", value: localizeModeValue(runPlan?.runKind ?? "unbekannt"), primary: false },
      { label: "Drift", value: localizeModeValue(runDrift?.driftStatus ?? "-"), primary: false },
      { label: "Stabilitaet", value: localizeModeValue(runStability?.status ?? "-"), primary: false },
      { label: "Governance", value: localizeModeValue(runGovernance?.status ?? "-"), primary: false },
      { label: "Quellmodus", value: localizeModeValue(summary.sourceMode), primary: false },
      { label: "Dry-Run", value: summary.dryRun ? "ja" : "nein", primary: false },
      { label: "Review-Umfang", value: localizeModeValue(review?.reviewScope ?? "nicht_gelaufen"), primary: false },
      { label: "Erstellt", value: summary.createdAt.slice(0, 16).replace("T", " "), primary: false },
      { label: "Lauf-ID", value: summary.runId, primary: false }
    ],
    recommendations: recommendations.map((item) => localizeGeneratedText(item)),
    candidates,
    runRoot: reviewRoot,
    sections,
    modeOptions: uniqueStrings(candidates.map((item) => item.gapArea || "")),
    layerOptions: uniqueStrings(candidates.map((item) => item.mainLayer || "")),
    agentPayloadScript: buildAgentPayloadScript(agentView.payload)
  });
}
