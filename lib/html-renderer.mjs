// lib/html-renderer.mjs — Discovery / Watchlist-Review / On-Demand Renderer.
//
// ============================================================================
// STRUKTUR EINGEFROREN — NICHT AENDERN OHNE EXPLIZITEN USER-FREIGABE
// ----------------------------------------------------------------------------
// Die Section-Reihenfolge, die Nav-Label-Konvention, der Cockpit-Night-Aufbau
// und die Parity zur Landscape-Vorlage (lib/landscape/html-report.mjs) sind
// mit Stand commit 22f6587 (24.04.2026) final. Erlaubt sind weiterhin:
//   - Inhaltliche Qualitaetsverbesserungen je Section
//   - Bugfixes fuer konkrete Rendering-Probleme
//   - Neue Daten-Builder in lib/html/sections.mjs / lib/html/shared.mjs
// NICHT erlaubt ohne User-Freigabe:
//   - Umbau der Section-Reihenfolge in renderDiscoveryHtmlReport /
//     renderWatchlistReviewHtmlReport / renderOnDemandRunHtmlReport
//   - Austausch oder Neu-Wrap der bestehenden Section-Renderer
//   - Anpassung der Nav-Label-Konvention (1-2-Wort-Stil)
//   - Aenderungen an der max-2-Col-Grundregel
// Diese Regel gilt parallel fuer lib/landscape/html-report.mjs.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
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
  renderTopRecommendations,
  sortAdoptGroup
} from "./html/shared.mjs";
import {
  renderCoverageCards,
  renderEmpfehlungenSection,
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
  renderTabbedSection,
  renderWatchlistTopCards,
  renderWhatNowSection
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
    quick: "schnell",
    standard: "Standard",
    deep: "tief",
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
    medium: "mittel",
    high: "hoch",
    low: "niedrig",
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

function buildSharedAgentMission({ projectKey, reportType, nextSteps, topName, topIntroOverride = null, runConfidence }) {
  const mission = [];
  mission.push(`Arbeite nur im Kontext von ${projectKey} und leite keine generischen Entscheidungen ohne Bezug zum Zielprojekt ab.`);
  if (topIntroOverride) {
    mission.push(topIntroOverride);
  } else if (topName) {
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

function resolveTargetRepoFiles(binding, declaredFiles = []) {
  const files = Array.isArray(declaredFiles) ? declaredFiles.filter(Boolean) : [];
  if (!binding?.projectRoot || files.length === 0) {
    return {
      availableFiles: files,
      missingFiles: []
    };
  }

  const repoRoot = path.resolve(process.cwd(), binding.projectRoot);
  if (!fs.existsSync(repoRoot)) {
    return {
      availableFiles: files,
      missingFiles: files
    };
  }

  const availableFiles = [];
  const missingFiles = [];
  for (const file of files) {
    const absolutePath = path.join(repoRoot, file);
    if (fs.existsSync(absolutePath)) {
      availableFiles.push(file);
    } else {
      missingFiles.push(file);
    }
  }

  return {
    availableFiles: availableFiles.length > 0 ? availableFiles : files,
    missingFiles
  };
}

function buildTargetRepoContext({ projectKey, projectProfile, binding }) {
  const contextSources = projectProfile?.contextSources ?? {};
  const loadedFiles = contextSources.loadedFiles ?? [];
  const declaredFiles = contextSources.declaredFiles ?? binding?.readBeforeAnalysis ?? [];
  const scannedDirectories = contextSources.scannedDirectories ?? [];
  const nonEmptyDirectories = scannedDirectories
    .filter((item) => (item?.entryCount ?? 0) > 0)
    .map((item) => item.path);
  const declaredDirectories = contextSources.declaredDirectories ?? binding?.referenceDirectories ?? [];
  const resolvedFiles = resolveTargetRepoFiles(binding, declaredFiles);
  const missingConfiguredFiles = (contextSources.missingFiles?.length ?? 0) > 0 && loadedFiles.length > 0
    ? contextSources.missingFiles
    : resolvedFiles.missingFiles;

  return {
    projectKey,
    projectLabel: binding?.projectLabel ?? projectKey,
    projectRoot: binding?.projectRoot ?? null,
    firstReadFiles: loadedFiles.length > 0 ? loadedFiles : resolvedFiles.availableFiles,
    missingConfiguredFiles,
    referenceDirectories: nonEmptyDirectories.length > 0 ? nonEmptyDirectories : declaredDirectories,
    extractedCapabilities: projectProfile?.capabilitiesPresent ?? [],
    targetCapabilities: binding?.targetCapabilities ?? [],
    analysisQuestions: binding?.analysisQuestions ?? [],
    guardrails: binding?.guardrails ?? []
  };
}

function buildAgentDeliverable(reportType) {
  if (reportType === "discovery") {
    return [
      "Pruefe die priorisierten Repos zuerst gegen das Zielprojekt statt sie isoliert zu bewerten.",
      "Liefere fuer die staerksten Kandidaten jeweils Schichtwert, Uebertragungswert, Hauptrisiko und naechsten sinnvollen Schritt.",
      "Beende mit einer klaren Intake-, Review- oder Beobachtungs-Empfehlung pro Kandidat."
    ];
  }

  if (reportType === "on_demand") {
    return [
      "Nutze diesen Brief als operative Uebergabe fuer den naechsten direkten Schritt in diesem Lauf.",
      "Liefere nur konkrete Folgearbeit mit Bezug auf Zielrepo, aktuelle Laufdrift und Governance.",
      "Wenn Unsicherheiten hoch sind, entscheide nicht spekulativ, sondern markiere die noetige manuelle Pruefung."
    ];
  }

  return [
    "Vergleiche die priorisierten Repos explizit mit dem Zielrepo und nicht nur untereinander.",
    "Liefere pro Repo uebertragbares Muster, Hauptgrenze, betroffene Zielrepo-Bereiche und eine konkrete Folgeempfehlung.",
    "Schliesse mit einer priorisierten Build-vs-Borrow-Einschaetzung fuer das Zielprojekt ab."
  ];
}

function buildDiscoveryCodingStarterEntry(candidate, binding, starterMode) {
  const repoName = getCandidateName(candidate);
  const targetAreas = suggestTargetRepoAreas({
    binding,
    mainLayer: candidate.guess?.mainLayer,
    gapArea: candidate.projectAlignment?.gapArea,
    matchedCapabilities: candidate.projectAlignment?.matchedCapabilities ?? []
  });
  const mainLayer = localizeSystemTerm(candidate.guess?.mainLayer ?? "unknown");
  const capabilities = (candidate.projectAlignment?.matchedCapabilities ?? []).map((item) => localizeSystemTerm(item));
  const modeTexts = {
    compare_then_prototype: {
      title: "Primaerer Prototyp",
      goal: `${repoName} zuerst strukturell mit dem Zielrepo vergleichen und danach nur einen kleinen Prototyp fuer die Kernschicht bauen, nicht die Fremdarchitektur uebernehmen.`,
      slice: `Pruefe in ${targetAreas.join(", ") || "lib, sources, scripts"}, wie ${repoName} die Schicht ${mainLayer} loest, und skizziere danach einen minimalen Adapter- oder Intake-Prototyp fuer genau diese Stelle.`
    },
    support_prototype: {
      title: "Unterstuetzender Prototyp",
      goal: `${repoName} nicht als Kern uebernehmen, sondern als unterstuetzendes Vergleichsmuster fuer eine angrenzende Schicht nutzen.`,
      slice: `Pruefe in ${targetAreas.join(", ") || "lib, sources, scripts"}, ob ${repoName} fuer ${mainLayer} ein kleines Support-Muster liefert, das den Kern ergaenzt statt ersetzt.`
    },
    compare_only: {
      title: "Nur vergleichen",
      goal: `${repoName} nur als Vergleichs- und Mustersignal lesen, ohne direkt in einen Code-Prototyp zu springen.`,
      slice: `Vergleiche in ${targetAreas.join(", ") || "lib, sources, scripts"} nur die tragfaehigen Muster aus ${repoName} und halte den ersten Code-Schritt bewusst zurueck.`
    }
  };
  const modeText = modeTexts[starterMode] ?? modeTexts.compare_then_prototype;

  return {
    repo: repoName,
    starterMode,
    starterLabel: modeText.title,
    implementationGoal: modeText.goal,
    firstSlice: modeText.slice,
    targetAreas,
    compareChecklist: [
      `Welche konkrete Schicht aus ${repoName} ist fuer ${binding?.projectKey ?? "das Zielprojekt"} wirklich uebertragbar?`,
      `Welche Teile gehoeren nur zur Fremdplattform und duerfen nicht in die Zielarchitektur wandern?`,
      `Welche kleinste sinnvolle Folgearbeit im Zielrepo beweist den Mustergewinn, ohne schon Produktionslogik zu ersetzen?`
    ],
    stopIf: [
      "das Muster nur ueber UI-, Dashboard- oder Surface-Code wirkt",
      "kein sauberer Bezug auf Quellenaufnahme, Adapter oder Normalisierung sichtbar bleibt",
      "die Folgearbeit nur durch direkte Uebernahme grosser Fremdlogik sinnvoll waere"
    ],
    matchedCapabilities: capabilities
  };
}

function buildDiscoveryCodingStarter(candidates = [], binding = null) {
  const primaryCandidate = candidates.find((candidate) => candidate.prototypeReadiness?.ready);
  const supportCandidates = candidates.filter((candidate) => {
    if (candidate === primaryCandidate) return false;
    const evidence = candidate.discoveryEvidence ?? {};
    const fitBand = String(candidate?.projectAlignment?.fitBand ?? "unknown");
    const fitScore = Number(candidate?.projectAlignment?.fitScore ?? 0) || 0;
    const sourceFamilyHits = Number(evidence.sourceFamilyHits ?? 0) || 0;
    const normalizationHits = Number(evidence.normalizationHits ?? 0) || 0;
    return fitBand === "high"
      && fitScore >= 70
      && (sourceFamilyHits >= 3 || normalizationHits >= 2);
  }).slice(0, 2);

  if (!primaryCandidate && supportCandidates.length === 0) {
    return null;
  }

  return {
    primary: primaryCandidate ? buildDiscoveryCodingStarterEntry(primaryCandidate, binding, "compare_then_prototype") : null,
    secondary: supportCandidates.map((candidate) => buildDiscoveryCodingStarterEntry(
      candidate,
      binding,
      candidate.discoveryDisposition === "review_queue" ? "support_prototype" : "compare_only"
    ))
  };
}

function suggestTargetRepoAreas({ binding, mainLayer, gapArea, matchedCapabilities = [] }) {
  const directories = binding?.referenceDirectories ?? [];
  const available = new Set(directories.map((item) => String(item || "").replace(/\/+$/g, "")));
  const suggestions = [];
  const add = (value) => {
    const normalized = String(value || "").replace(/\/+$/g, "");
    if (!normalized || !available.has(normalized) || suggestions.includes(normalized)) {
      return;
    }
    suggestions.push(normalized);
  };
  const signalText = [mainLayer, gapArea, ...matchedCapabilities].join(" ").toLowerCase();

  if (signalText.includes("source") || signalText.includes("ingestion")) {
    add("sources");
    add("lib");
    add("scripts");
  }
  if (signalText.includes("quality") || signalText.includes("governance")) {
    add("lib");
    add("docs");
  }
  if (signalText.includes("distribution") || signalText.includes("surface") || signalText.includes("export")) {
    add("templates");
    add("lib");
    add("scripts");
  }
  if (signalText.includes("data_model") || signalText.includes("semantics")) {
    add("lib");
    add("docs");
  }

  directories.forEach((item) => add(item));
  return suggestions.slice(0, 4);
}

function buildReviewAgentRepos(items = [], binding = null) {
  return items.slice(0, 3).map((item) => ({
    repo: item.repoRef,
    url: `https://github.com/${item.repoRef}`,
    fitBand: item.projectFitBand ?? "unknown",
    reviewScore: item.reviewScore ?? null,
    mainLayer: item.mainLayer ?? null,
    gapArea: item.gapArea ?? null,
    matchedCapabilities: item.matchedCapabilities ?? [],
    recommendedTargetAreas: suggestTargetRepoAreas({
      binding,
      mainLayer: item.mainLayer,
      gapArea: item.gapArea,
      matchedCapabilities: item.matchedCapabilities ?? []
    }),
    observedRepoAreas: item.recommendedWorkerAreas ?? [],
    whyRelevant: localizeGeneratedText(item.reason || "Braucht eine manuelle Pruefung."),
    transferablePattern: localizeGeneratedText(item.possibleImplication || item.suggestedNextStep || "-"),
    strengths: localizeGeneratedText(item.strengths || item.learningForEventbaer || "-"),
    risks: localizeGeneratedText(item.weaknesses || item.risks?.join(", ") || "-"),
    nextStep: localizeGeneratedText(item.suggestedNextStep || item.reason || "Manuell pruefen.")
  }));
}

function buildDiscoveryAgentRepos(candidates = [], binding = null) {
  return candidates.slice(0, 3).map((candidate) => ({
    repo: getCandidateName(candidate),
    url: candidate.repo?.normalizedRepoUrl ?? null,
    disposition: candidate.discoveryDisposition ?? "unknown",
    fitBand: candidate.projectAlignment?.fitBand ?? "unknown",
    discoveryScore: candidate.discoveryScore ?? null,
    mainLayer: candidate.guess?.mainLayer ?? null,
    matchedCapabilities: candidate.projectAlignment?.matchedCapabilities ?? [],
    whyRelevant: localizeGeneratedText(candidate.reasoning?.[0] ?? "Braucht eine manuelle Pruefung."),
    evidence: candidate.discoveryEvidence?.grade
      ? `${candidate.discoveryEvidence.grade} (${candidate.discoveryEvidence.score})`
      : null,
    recommendedTargetAreas: suggestTargetRepoAreas({
      binding,
      mainLayer: candidate.guess?.mainLayer,
      gapArea: candidate.projectAlignment?.gapArea,
      matchedCapabilities: candidate.projectAlignment?.matchedCapabilities ?? []
    }),
    workMode: candidate.prototypeReadiness?.ready
      ? "gezielter Vergleich mit kleinem Prototyp moeglich"
      : candidate.discoveryDisposition === "intake_now"
        ? "gezielte Musterpruefung mit moeglichem Prototyp"
      : "Research zuerst, Code erst nach Vergleich mit Zielrepo",
    prototypeReady: Boolean(candidate.prototypeReadiness?.ready),
    transferablePattern: localizeGeneratedText(
      candidate.landkarteCandidate?.possible_implication
        ?? candidate.projectAlignment?.suggestedNextStep
        ?? "-"
    ),
    strengths: localizeGeneratedText(candidate.landkarteCandidate?.strengths ?? "-"),
    risks: localizeGeneratedText(candidate.landkarteCandidate?.risks ?? "manuell pruefen"),
    nextStep: getCandidateDecisionSummary(candidate)
  }));
}

function buildAgentBrief({
  reportType,
  projectKey,
  runConfidence,
  runConfidenceReason = null,
  mission = [],
  deliverable = [],
  targetRepoContext = {},
  summary = {},
  guardrails = [],
  uncertainties = [],
  repos = [],
  codingStarter = null,
  nextSteps = []
}) {
  return {
    schemaVersion: 2,
    handoffType: "patternpilot_agent_brief",
    reportType,
    projectKey,
    runConfidence,
    runConfidenceReason,
    mission,
    deliverable,
    targetRepoContext,
    summary,
    guardrails,
    uncertainties,
    repos,
    codingStarter,
    nextSteps
  };
}

export function buildDiscoveryAgentView({ projectKey, discovery, discoveryProfile = null, projectProfile = null, binding = null }) {
  const candidates = discovery?.candidates ?? [];
  const profile = discoveryProfile ?? discovery?.discoveryProfile ?? resolveDiscoveryProfile("balanced", null);
  const profileMode = profile.publicId ?? profile.id;
  const searchErrors = discovery?.searchErrors ?? [];
  const actionableLead = candidates.find((candidate) => {
    const disposition = String(candidate?.discoveryDisposition ?? "").toLowerCase();
    const candidateClass = String(candidate?.discoveryClass ?? "").toLowerCase();
    return !["skip", "observe_only"].includes(disposition) && !["risk_signal", "weak_signal"].includes(candidateClass);
  });
  const topRecommendations = candidates
    .slice(0, 5)
    .map((candidate) => `${getCandidateName(candidate)}: ${getCandidateDecisionSummary(candidate)}`);
  const mission = buildSharedAgentMission({
    projectKey,
    reportType: "discovery",
    nextSteps: topRecommendations,
    topName: actionableLead ? getCandidateName(actionableLead) : "",
    topIntroOverride: !actionableLead && candidates.length > 0
      ? "Dieser Lauf hat noch keinen klaren Startkandidaten. Beginne mit einer manuellen Sichtpruefung der drei staerksten Grenzfaelle statt mit direkter Uebernahme."
      : null,
    runConfidence: discovery?.runConfidence
  });
  const guardrails = [
    `Profil: ${localizeModeValue(profileMode)}`,
    `Regelmodus: ${localizeModeValue(discovery?.policySummary?.mode ?? "aus")}`,
    `Vom Regelwerk markiert: ${discovery?.policySummary?.blocked ?? 0}`,
    `Suchfehler: ${searchErrors.length}`
  ];
  const context = [
    `Suchanfragen in diesem Lauf: ${discovery?.plan?.plans?.length ?? 0}`,
    `Projekt-Kohorten aktiv: ${(discovery?.plan?.seedContext?.priorityCohorts?.length ?? 0) + (discovery?.plan?.seedContext?.referenceCohorts?.length ?? 0)}`,
    `Gescannt: ${discovery?.scanned ?? 0}`,
    `Sichtbare Kandidaten: ${candidates.length}`,
    `Staerkster Kandidat: ${candidates[0] ? getCandidateName(candidates[0]) : "keiner"}`
  ];
  const uncertainties = [
    searchErrors.length > 0 ? `${searchErrors.length} Suchfehler schraenken die Discovery-Qualitaet dieses Laufs ein.` : null,
    (discovery?.policySummary?.blocked ?? 0) > 0 ? `${discovery.policySummary.blocked} Kandidaten wurden vom Regelwerk markiert und brauchen bei Bedarf eine bewusste Sichtpruefung.` : null,
    candidates.length === 0 ? "Dieser Lauf hat keine sichtbaren Kandidaten geliefert. Erst Suchrichtung und Regelmodus pruefen." : null
  ].filter(Boolean);
  const priorityRepos = candidates.slice(0, 3).map((candidate) => ({
    repo: getCandidateName(candidate),
    url: candidate.repo?.normalizedRepoUrl,
    action: candidate.prototypeReadiness?.ready
      ? `${getCandidateDecisionSummary(candidate)} | kleiner Prototyp moeglich`
      : getCandidateDecisionSummary(candidate)
  }));
  const repos = buildDiscoveryAgentRepos(candidates, binding);
  const codingReadyCount = candidates.filter((candidate) => candidate.prototypeReadiness?.ready || candidate.discoveryDisposition === "intake_now").length;
  const codingStarter = buildDiscoveryCodingStarter(candidates, binding);
  const targetRepoContext = buildTargetRepoContext({
    projectKey,
    projectProfile,
    binding
  });

  return {
    mission,
    priorityRepos,
    guardrails,
    context,
    uncertainties,
    deliverable: buildAgentDeliverable("discovery"),
    payload: buildAgentBrief({
      reportType: "discovery",
      projectKey,
      runConfidence: discovery?.runConfidence ?? "unbekannt",
      runConfidenceReason: discovery?.runConfidenceReason ?? null,
      mission,
      deliverable: buildAgentDeliverable("discovery"),
      targetRepoContext,
      summary: {
        profile: profileMode,
        scanned: discovery?.scanned ?? 0,
        candidateCount: candidates.length,
        queryCount: discovery?.plan?.plans?.length ?? 0,
        cohortCount: (discovery?.plan?.seedContext?.priorityCohorts?.length ?? 0) + (discovery?.plan?.seedContext?.referenceCohorts?.length ?? 0),
        policyMode: discovery?.policySummary?.mode ?? "off",
        blockedCandidates: discovery?.policySummary?.blocked ?? 0,
        newDiscoveryCount: discovery?.newCandidates?.length ?? 0,
        baselineAnchorCount: discovery?.baselineAnchors?.length ?? 0,
        codingReadyCount,
        researchMode: codingReadyCount > 0 ? "zielgerichtete Pruefung mit moeglichem Prototyp" : "Research zuerst, Code spaeter",
        prototypeReadyRepos: repos.filter((repo) => repo.prototypeReady).map((repo) => repo.repo),
        codingStarterAvailable: Boolean(codingStarter),
        codingStarterCount: (codingStarter?.primary ? 1 : 0) + (codingStarter?.secondary?.length ?? 0)
      },
      guardrails: [...guardrails, ...(targetRepoContext.guardrails ?? []).map((item) => `Projekt-Guardrail: ${item}`)],
      uncertainties,
      repos,
      codingStarter,
      nextSteps: topRecommendations
    }),
    codingStarter,
    downloadFileName: `patternpilot-agent-handoff-${projectKey}-discovery.json`
  };
}

export function buildReviewAgentView(review, options = {}) {
  const topItems = review?.topItems ?? [];
  const visibleCount = options.visibleCount ?? 3;
  const missingUrls = review?.missingUrls ?? review?.missingWatchlistUrls ?? [];
  const mission = buildSharedAgentMission({
    projectKey: review?.projectKey,
    reportType: "review",
    nextSteps: review?.nextSteps ?? [],
    topName: topItems[0]?.repoRef ?? "",
    runConfidence: review?.runConfidence
  });
  const priorityRepos = topItems.slice(0, 3).map((item) => ({
    repo: item.repoRef,
    url: `https://github.com/${item.repoRef}`,
    action: localizeGeneratedText(item.suggestedNextStep || item.reason || "Manuell pruefen.")
  }));
  const guardrails = [
    `Review-Umfang: ${localizeModeValue(review?.reviewScope)}`,
    `Fehlendes Intake: ${missingUrls.length}`,
    `Vertrauen in den Lauf: ${localizeModeValue(review?.runConfidence ?? "unbekannt")}`,
    `Top-Eintraege im Bericht: ${Math.min(topItems.length, visibleCount)}`
  ];
  const context = [
    `Staerkste Ebene: ${summarizeTopCoverageItem(review?.coverage?.mainLayers)}`,
    `Staerkster Lueckenbereich: ${summarizeTopCoverageItem(review?.coverage?.gapAreas)}`,
    `Staerkste Faehigkeit: ${summarizeTopCoverageItem(review?.coverage?.capabilities)}`,
    `Top-Repo fuer den Einstieg: ${topItems[0]?.repoRef ?? "keins"}`
  ];
  const uncertainties = [
    missingUrls.length > 0 ? `${missingUrls.length} ausgewaehlte URLs fehlen noch mit frischer Intake-Abdeckung.` : null,
    (review?.itemsDataStateSummary?.fallback ?? 0) > 0 ? `${review.itemsDataStateSummary.fallback} Eintraege sind nur per Fallback bewertet.` : null,
    (review?.itemsDataStateSummary?.stale ?? 0) > 0 ? `${review.itemsDataStateSummary.stale} Eintraege beruhen auf veralteten Bewertungsregeln.` : null,
    topItems.some((item) => (item.projectFitBand ?? "unknown") === "low") ? "Mindestens ein sichtbarer Kandidat hat niedrige Passung und sollte nicht vorschnell uebernommen werden." : null
  ].filter(Boolean);
  const deliverable = buildAgentDeliverable("review");
  const repos = buildReviewAgentRepos(topItems, review?.binding);
  const targetRepoContext = buildTargetRepoContext({
    projectKey: review?.projectKey,
    projectProfile: review?.projectProfile,
    binding: review?.binding
  });

  return {
    mission,
    priorityRepos,
    guardrails,
    context,
    uncertainties,
    deliverable,
    payload: buildAgentBrief({
      reportType: "review",
      projectKey: review?.projectKey,
      runConfidence: review?.runConfidence ?? "unbekannt",
      runConfidenceReason: review?.runConfidenceReason ?? null,
      mission,
      deliverable,
      targetRepoContext,
      summary: {
        reviewScope: review?.reviewScope,
        candidateCount: review?.items?.length ?? 0,
        visibleTopCount: Math.min(topItems.length, visibleCount),
        missingIntakeCount: missingUrls.length,
        context: {
          mainLayer: review?.coverage?.mainLayers?.[0]?.value ?? null,
          gapArea: review?.coverage?.gapAreas?.[0]?.value ?? null,
          capability: review?.coverage?.capabilities?.[0]?.value ?? null
        }
      },
      guardrails: [...guardrails, ...(targetRepoContext.guardrails ?? []).map((item) => `Projekt-Guardrail: ${item}`)],
      uncertainties,
      repos,
      nextSteps: (review?.nextSteps ?? []).map((item) => localizeGeneratedText(item))
    }),
    downloadFileName: `patternpilot-agent-handoff-${review?.projectKey ?? "projekt"}-review.json`
  };
}

export function buildOnDemandAgentView(summary) {
  const review = summary?.reviewRun?.review ?? null;
  const runPlan = summary?.runPlan ?? null;
  const runDrift = summary?.runDrift ?? null;
  const runStability = summary?.runStability ?? null;
  const runGovernance = summary?.runGovernance ?? null;
  const mission = buildSharedAgentMission({
    projectKey: summary?.projectKey,
    reportType: "on_demand",
    nextSteps: summary?.nextActions ?? [],
    topName: review?.topItems?.[0]?.repoRef ?? "",
    runConfidence: review?.runConfidence ?? "unbekannt"
  });
  const priorityRepos = (review?.topItems ?? []).slice(0, 3).map((item) => ({
    repo: item.repoRef,
    url: `https://github.com/${item.repoRef}`,
    action: localizeGeneratedText(item.suggestedNextStep || item.reason || "Manuell pruefen.")
  }));
  const guardrails = [
    `Laufart: ${localizeModeValue(runPlan?.runKind ?? "unbekannt")}`,
    `Governance: ${localizeModeValue(runGovernance?.status ?? "-")}`,
    `Drift: ${localizeModeValue(runDrift?.driftStatus ?? "-")}`,
    `Stabilitaet: ${localizeModeValue(runStability?.status ?? "-")}`
  ];
  const context = [
    `Quellmodus: ${localizeModeValue(summary?.sourceMode)}`,
    `Wirksame URLs: ${summary?.effectiveUrls?.length ?? 0}`,
    `Review-Umfang: ${localizeModeValue(review?.reviewScope ?? "nicht_gelaufen")}`,
    `Staerkstes Review-Repo: ${review?.topItems?.[0]?.repoRef ?? "keins"}`
  ];
  const uncertainties = [
    runGovernance?.status === "manual_gate" ? "Dieser Lauf ist operativ unter manueller Governance. Ein Agent sollte keine automatische Folgeaktion unterstellen." : null,
    runDrift?.driftStatus === "attention_required" ? "Die Laufdrift verlangt Aufmerksamkeit. Vor tieferen Veraenderungen zuerst den Laufkontext pruefen." : null,
    runStability?.status === "unstable_streak" ? "Die letzten vergleichbaren Laeufe wirken instabil. Ergebnisse vorsichtig behandeln." : null,
    !review ? "In diesem Ad-hoc-Lauf wurde kein Review erzeugt. Agentische Entscheidungen haben deshalb wenig Vergleichsbasis." : null
  ].filter(Boolean);
  const deliverable = buildAgentDeliverable("on_demand");
  const repos = buildReviewAgentRepos(review?.topItems ?? [], review?.binding);
  const targetRepoContext = buildTargetRepoContext({
    projectKey: summary?.projectKey,
    projectProfile: review?.projectProfile,
    binding: review?.binding
  });

  return {
    mission,
    priorityRepos,
    guardrails,
    context,
    uncertainties,
    deliverable,
    payload: buildAgentBrief({
      reportType: "on_demand",
      projectKey: summary?.projectKey,
      runConfidence: review?.runConfidence ?? "unbekannt",
      runConfidenceReason: review?.runConfidenceReason ?? null,
      mission,
      deliverable,
      targetRepoContext,
      summary: {
        runId: summary?.runId,
        sourceMode: summary?.sourceMode,
        effectiveUrls: summary?.effectiveUrls ?? [],
        governance: runGovernance?.status ?? null,
        drift: runDrift?.driftStatus ?? null,
        stability: runStability?.status ?? null,
        context: {
          reviewScope: review?.reviewScope ?? null,
          topRepo: review?.topItems?.[0]?.repoRef ?? null
        }
      },
      guardrails: [...guardrails, ...(targetRepoContext.guardrails ?? []).map((item) => `Projekt-Guardrail: ${item}`)],
      uncertainties,
      repos,
      nextSteps: (summary?.nextActions ?? []).map((item) => localizeGeneratedText(item))
    }),
    downloadFileName: `patternpilot-agent-handoff-${summary?.projectKey ?? "projekt"}-on-demand.json`
  };
}

function renderDiscoveryCandidateOverview({ baselineAnchors = [], newCandidates = [], view }) {
  const sections = [];

  if (newCandidates.length > 0) {
    sections.push(`<div class="report-subsection">
  <p class="report-subtitle">Neue Discovery-Treffer</p>
  <p class="report-subcopy">Diese Repos sind in diesem Lauf neu sichtbar geworden und zeigen, ob Discovery ueber bekannte Baselines hinaus neue projektnahe Signale findet.</p>
  ${renderDiscoveryCandidateCards(newCandidates, view)}
</div>`);
  }

  if (baselineAnchors.length > 0) {
    sections.push(`<div class="report-subsection">
  <p class="report-subtitle">Gesicherte Baseline-Anker</p>
  <p class="report-subcopy">Diese Repos sind bereits bekannte oder kuratierte Anker. Sie bleiben sichtbar, damit der Bericht Orientierung behaelt, sollen neue Discovery-Treffer aber nicht verdecken.</p>
  ${renderDiscoveryCandidateCards(baselineAnchors, view)}
</div>`);
  }

  if (sections.length === 0) {
    return `<p class="empty">Noch keine sichtbaren Kandidaten vorhanden.</p>`;
  }

  return sections.join("");
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
  const profileMode = profile.publicId ?? profile.id;
  const candidates = discovery.candidates ?? [];
  const baselineAnchors = discovery.baselineAnchors ?? candidates.filter((candidate) => candidate.discoveryTrack === "baseline_anchor");
  const newCandidates = discovery.newCandidates ?? candidates.filter((candidate) => candidate.discoveryTrack !== "baseline_anchor");
  const searchErrors = discovery.searchErrors ?? [];
  const agentView = buildDiscoveryAgentView({
    projectKey,
    discovery,
    discoveryProfile: profile,
    projectProfile,
    binding
  });

  const topRecommendations = candidates
    .slice(0, Math.min(5, view.candidateCount))
    .map((candidate) => {
      const transfer = getCandidateDecisionSummary(candidate);
      return `${getCandidateName(candidate)}: ${transfer}`;
    });
  const evaluatedCandidates = discovery.evaluatedCandidates ?? [];
  const highFitCount = evaluatedCandidates.filter((candidate) => candidate?.projectAlignment?.fitBand === "high").length;

  const sections = [
    {
      id: "empfehlungen",
      title: "Empfehlungen",
      navLabel: "Empfehlungen",
      skipSectionWrapper: true,
      body: renderEmpfehlungenSection({
        recommendations: topRecommendations,
        candidates,
        reportType: "discovery",
        runRoot: null,
        discovery,
        renderTopRecommendations,
        renderRecommendedActions
      })
    },
    {
      title: "Kandidatenuebersicht",
      id: "candidate-overview",
      navLabel: "Kandidaten",
      body: renderDiscoveryCandidateOverview({ baselineAnchors, newCandidates, view })
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
      body: `<div class="info-grid">${discovery.plan.plans.map((plan) => `<div class="info-card">
  <div class="info-card-title">${escapeHtml(plan.label)}</div>
  <p class="info-card-copy">${escapeHtml(plan.query)}</p>
  ${Array.isArray(plan.reasons) && plan.reasons.length > 0
    ? `<ul class="info-card-list">${plan.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
    : `<p class="info-card-empty">Keine Gruende erfasst.</p>`}
</div>`).join("")}</div>`
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
    collapsed: false,
    tone: "info",
    body: renderProjectContextSources(projectProfile, binding)
  });

  // Lauf-Gesundheit: Drift / Stabilitaet / Governance — Parity zu Landscape.
  // Discovery-Runs haben diese Daten typischerweise nicht direkt; sie entstehen
  // aus den Ops-Commands (run-drift, run-stability, run-governance). Section
  // wird trotzdem gezeigt, damit die Struktur einheitlich ist und der Nutzer
  // sieht, wo die Daten herkommen.
  const discoveryRunDrift = discovery?.runDrift ?? null;
  const discoveryRunStability = discovery?.runStability ?? null;
  const discoveryRunGovernance = discovery?.runGovernance ?? null;
  const hasDiscoveryRunHealth = Boolean(discoveryRunDrift || discoveryRunStability || discoveryRunGovernance);
  sections.push({
    id: "run-health",
    title: "Lauf-Gesundheit",
    navLabel: "Lauf-Gesundheit",
    skipSectionWrapper: true,
    body: hasDiscoveryRunHealth
      ? renderTabbedSection({
          id: "run-health",
          title: "Lauf-Gesundheit",
          sub: "Drift / Stabilitaet / Governance",
          accent: "purple",
          countChip: "3 Ansichten",
          tabs: [
            { label: "Drift", body: renderOnDemandRunDriftCards(discoveryRunDrift ?? {}) },
            { label: "Stabilitaet", body: renderOnDemandStabilityCards(discoveryRunStability ?? {}) },
            { label: "Governance", body: renderOnDemandGovernanceCards(discoveryRunGovernance ?? {}) }
          ]
        })
      : `<section class="section-preview accent-purple" id="run-health" data-nav-section data-section-empty="true">
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Lauf-Gesundheit</h2>
      <div class="sub">Drift / Stabilitaet / Governance</div>
    </div>
  </div>
  <p class="empty">Keine Ops-Gesundheits-Metriken fuer diesen Discovery-Lauf. Diese Daten kommen aus den Ops-Commands: <code>npm run run-drift -- --project ${projectKey}</code>, <code>npm run run-stability</code>, <code>npm run run-governance</code>. On-Demand-Reports und Problem-Landscapes zeigen sie automatisch.</p>
</section>`
  });

  // Technischer Lauf-Status: konsolidiert Queries + Luecken-Diagnose + Suchfehler
  // in einer 3-Tab-Section (Parity mit Landscape).
  const effectiveQueries = (discovery?.plan?.plans ?? []).map((p) => p.query ?? p.label ?? "").filter(Boolean);
  const searchErrorsList = searchErrors.map((item) =>
    `${localizeGeneratedText(item.label)}: ${localizeGeneratedText(item.error)}`
  );
  const techStatusGaps = [];
  if (effectiveQueries.length > 0 && candidates.length === 0) {
    techStatusGaps.push("Keine Kandidaten trotz aktiver Queries — Query-Seeds pruefen, Discovery-Profil erweitern oder --per-page erhoehen.");
  }
  const policyBlocked = discovery?.policySummary?.enforcedBlocked ?? discovery?.policySummary?.blocked ?? 0;
  if (policyBlocked > 0 && policyBlocked > candidates.length) {
    techStatusGaps.push(`Policy hat ${policyBlocked} Kandidaten blockiert — Regelwerk in projects/${projectKey}/ pruefen, ob das Gating zu eng ist.`);
  }
  if (candidates.length > 0 && (discovery.knownUrlCount ?? 0) > candidates.length * 2) {
    techStatusGaps.push(`Viele bekannte Repos uebersprungen (${discovery.knownUrlCount}) — Discovery kann frischere Gebiete erreichen wenn Watchlist oder Landkarte entstaubt wird.`);
  }
  sections.push({
    id: "tech-status",
    title: "Technischer Lauf-Status",
    navLabel: "Lauf-Status",
    skipSectionWrapper: true,
    body: renderTabbedSection({
      id: "tech-status",
      title: "Technischer Lauf-Status",
      sub: "Queries · Kandidaten-Luecken · Suchfehler",
      accent: "green",
      countChip: `${effectiveQueries.length} Queries · ${techStatusGaps.length} Luecken · ${searchErrorsList.length} Fehler`,
      tabs: [
        { label: "Wirksame Queries", body: renderHtmlList(effectiveQueries, "Keine Queries ausgefuehrt.") },
        { label: "Kandidaten-Luecken", body: renderHtmlList(techStatusGaps, "Keine Kandidaten-Luecken festgestellt.") },
        { label: "Suchfehler", body: renderHtmlList(searchErrorsList, "Keine Suchfehler.") }
      ]
    })
  });

  // Was jetzt? — 4-Tab Action-Steps (Parity mit Landscape).
  sections.push({
    id: "what-now",
    title: "Was jetzt?",
    navLabel: "Was jetzt",
    skipSectionWrapper: true,
    body: renderWhatNowSection({
      projectKey,
      compact: [
        `Top-${Math.min(5, candidates.length)}-Kandidaten in der Empfehlungen-Section einschaetzen (adopt/adapt/observe/ignore).`,
        "Fuer 'Uebernehmen'-Repos explizites Intake starten — bringt sie in die kuratierte Queue.",
        "Grenzfaelle in Watchlist parken statt sofort entscheiden."
      ],
      detailed: [
        {
          title: "1. Empfehlungen durchgehen",
          body: "Beginne mit den Top-Empfehlungen und lies die Entscheidungsbegruendung pro Kandidat. Pro und Contra sind automatisch aus Score, Fit-Band und Evidenz abgeleitet — dir gehoert die Entscheidung."
        },
        {
          title: "2. Intake fuer starke Repos ausloesen",
          body: `Fuer jedes klare Adopt-Kandidat: npm run intake -- --project ${projectKey} <repo-url>. Das wirft das Repo in die Queue und traegt es dort ein, wo es gegen den Projekt-Kontext weiter bewertet wird.`
        },
        {
          title: "3. Discovery-Linsen nachschaerfen",
          body: "Wenn die Landscape zu eng oder zu breit wirkt, schaerfe die Linsen — entweder ueber das Projekt-Binding (targetCapabilities) oder direkt im naechsten Discovery-Lauf mit --depth und --per-page."
        }
      ],
      checklist: [
        { impact: "hoch", text: "Top-5 Empfehlungen lesen, Entscheidung notieren" },
        { impact: "hoch", text: "Intake fuer 'Uebernehmen'-Repos starten" },
        { impact: "mittel", text: "Watchlist fuer Grenzfaelle pflegen" },
        { impact: "mittel", text: "Discovery-Regelwerk bei viel Policy-Blocking pruefen" },
        { impact: "niedrig", text: "Ignore-Kandidaten archivieren" }
      ],
      commands: [
        { cmd: `npm run intake -- --project ${projectKey} <repo-url>`, label: "Einzelnen Fund ins Intake" },
        { cmd: `npm run sync:watchlist -- --project ${projectKey}`, label: "Watchlist refreshen" },
        { cmd: `npm run review:watchlist -- --project ${projectKey}`, label: "Watchlist reviewen" },
        { cmd: `npm run patternpilot -- on-demand --project ${projectKey} --depth deep`, label: "Tiefen-Analyse neu fahren" }
      ]
    })
  });

  return renderHtmlDocument({
    title: `Patternpilot Bericht — ${projectKey}`,
    reportType: "discovery",
    projectKey,
    createdAt,
    heroSubtitle: `${localizeModeValue(profileMode)} Profil`,
    candidateCount: candidates.length,
    stats: [
      { label: "Kandidaten", value: candidates.length, primary: true },
      { label: "Neue Treffer", value: newCandidates.length, primary: true },
      { label: "Baseline-Anker", value: baselineAnchors.length, primary: true },
      { label: "Kohorten", value: (discovery?.plan?.seedContext?.priorityCohorts?.length ?? 0) + (discovery?.plan?.seedContext?.referenceCohorts?.length ?? 0), primary: true },
      { label: "Roh gefunden", value: discovery.rawCandidateCount ?? candidates.length, primary: true },
      { label: "Gescannt", value: discovery.scanned, primary: false },
      { label: "Suchtiefe", value: localizeModeValue(profileMode), primary: false },
      { label: "Hoch passend", value: highFitCount, primary: false },
      { label: "Ausgeblendet", value: discovery.policySummary?.enforcedBlocked ?? 0, primary: false },
      { label: "Bekannte uebersprungen", value: discovery.knownUrlCount, primary: false }
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
      id: "empfehlungen",
      title: "Empfehlungen",
      navLabel: "Empfehlungen",
      skipSectionWrapper: true,
      body: renderEmpfehlungenSection({
        recommendations: nextSteps,
        candidates: review.items ?? [],
        reportType: "review",
        runRoot: null,
        review,
        renderTopRecommendations,
        renderRecommendedActions
      })
    },
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
    collapsed: false,
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

  // Lauf-Gesundheit fuer Watchlist-Review — Parity zu Landscape.
  const reviewRunDrift = review?.runDrift ?? null;
  const reviewRunStability = review?.runStability ?? null;
  const reviewRunGovernance = review?.runGovernance ?? null;
  const hasReviewRunHealth = Boolean(reviewRunDrift || reviewRunStability || reviewRunGovernance);
  sections.push({
    id: "run-health",
    title: "Lauf-Gesundheit",
    navLabel: "Lauf-Gesundheit",
    skipSectionWrapper: true,
    body: hasReviewRunHealth
      ? renderTabbedSection({
          id: "run-health",
          title: "Lauf-Gesundheit",
          sub: "Drift / Stabilitaet / Governance",
          accent: "purple",
          countChip: "3 Ansichten",
          tabs: [
            { label: "Drift", body: renderOnDemandRunDriftCards(reviewRunDrift ?? {}) },
            { label: "Stabilitaet", body: renderOnDemandStabilityCards(reviewRunStability ?? {}) },
            { label: "Governance", body: renderOnDemandGovernanceCards(reviewRunGovernance ?? {}) }
          ]
        })
      : `<section class="section-preview accent-purple" id="run-health" data-nav-section data-section-empty="true">
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Lauf-Gesundheit</h2>
      <div class="sub">Drift / Stabilitaet / Governance</div>
    </div>
  </div>
  <p class="empty">Keine Ops-Gesundheits-Metriken fuer diesen Review-Lauf. Diese Daten kommen aus den Ops-Commands: <code>npm run run-drift -- --project ${review.projectKey}</code>, <code>npm run run-stability</code>, <code>npm run run-governance</code>. On-Demand-Reports und Problem-Landscapes zeigen sie automatisch.</p>
</section>`
  });

  // Tech-Status fuer Watchlist-Review: die Queries, die den aktuellen
  // Watchlist-Pool gebildet haben, plus Review-spezifische Diagnostik.
  const reviewQueries = Array.isArray(review?.watchlistUrls) ? review.watchlistUrls : [];
  const reviewSearchErrors = Array.isArray(review?.errors) ? review.errors.map(String) : [];
  const reviewGaps = [];
  if (missingUrls.length > 0) reviewGaps.push(`${missingUrls.length} Watchlist-URL(s) fehlen im Intake — npm run intake -- --project ${review.projectKey} <url>`);
  if ((review.watchlistCount ?? 0) === 0) reviewGaps.push("Watchlist leer — bindings/" + review.projectKey + "/WATCHLIST.txt befuellen und npm run sync:watchlist laufen lassen.");
  sections.push({
    id: "tech-status",
    title: "Technischer Lauf-Status",
    navLabel: "Lauf-Status",
    skipSectionWrapper: true,
    body: renderTabbedSection({
      id: "tech-status",
      title: "Technischer Lauf-Status",
      sub: "Watchlist-Quellen · Luecken · Fehler",
      accent: "green",
      countChip: `${reviewQueries.length} URLs · ${reviewGaps.length} Luecken · ${reviewSearchErrors.length} Fehler`,
      tabs: [
        { label: "Watchlist-Quellen", body: renderHtmlList(reviewQueries, "Keine Watchlist-Quellen in diesem Lauf.") },
        { label: "Kandidaten-Luecken", body: renderHtmlList(reviewGaps, "Keine Review-Luecken festgestellt.") },
        { label: "Fehler", body: renderHtmlList(reviewSearchErrors, "Keine Fehler im Lauf.") }
      ]
    })
  });

  // Was jetzt? — Action-Steps fuer Watchlist-Review
  sections.push({
    id: "what-now",
    title: "Was jetzt?",
    navLabel: "Was jetzt",
    skipSectionWrapper: true,
    body: renderWhatNowSection({
      projectKey: review.projectKey,
      compact: [
        `Top-${Math.min(5, items.length)}-Repos in Empfehlungen lesen und Entscheidungen notieren.`,
        "Fehlende Intake-Eintraege fuer Watchlist-URLs starten.",
        "Risikosignale pro Repo in den Decision-Log ueberfuehren."
      ],
      detailed: [
        {
          title: "1. Empfehlungen durchgehen",
          body: "Starte mit der Empfehlungen-Section. Die Disposition-Gruppierung zeigt dir direkt, welche Repos uebernommen, adaptiert oder nur beobachtet werden sollten."
        },
        {
          title: "2. Fehlende Intakes starten",
          body: `Die Tech-Status-Section zeigt, welche Watchlist-URLs noch nicht im Intake sind. Jede per npm run intake -- --project ${review.projectKey} <url> aufnehmen, damit die Queue vollstaendig ist.`
        },
        {
          title: "3. Risiken in Decisions ueberfuehren",
          body: "Die Risikosignale-Sektion ist nur Diagnose — der Wert entsteht, wenn du sie in knowledge/repo_decisions.md festhaeltst."
        }
      ],
      checklist: [
        { impact: "hoch", text: "Empfehlungen Top-5 entscheiden" },
        { impact: "hoch", text: "Fehlende Watchlist-Intakes anstossen" },
        { impact: "mittel", text: "Risikosignale in Decision-Log festhalten" },
        { impact: "niedrig", text: "Watchlist-Quellen entstauben (veraltete Links entfernen)" }
      ],
      commands: [
        { cmd: `npm run intake -- --project ${review.projectKey} <repo-url>`, label: "Einzelnen Fund ins Intake" },
        { cmd: `npm run sync:watchlist -- --project ${review.projectKey}`, label: "Watchlist refreshen" },
        { cmd: `npm run review:watchlist -- --project ${review.projectKey}`, label: "Review erneut fahren" }
      ]
    })
  });

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
      id: "empfehlungen",
      title: "Empfehlungen",
      navLabel: "Empfehlungen",
      skipSectionWrapper: true,
      body: renderEmpfehlungenSection({
        recommendations,
        candidates,
        reportType: "on_demand",
        runRoot: reviewRoot,
        review,
        renderTopRecommendations,
        renderRecommendedActions
      })
    },
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
