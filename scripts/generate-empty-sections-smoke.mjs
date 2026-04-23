// scripts/generate-empty-sections-smoke.mjs
//
// Realistischer Ausgangs-Zustand des Reports: keine Fake-Repos, keine
// aufgebauschten Texte, nur Section-Shells mit Empty-States. So wuerde
// ein Pattern-Pilot-Erstlauf aussehen, bevor echte Daten drin sind.
//
// Zweck: User sieht die komplette 27-Section-Struktur inkl. aller
// Nav-Eintraege, aber ohne irgendwelche erfundenen Inhalte.
// Jede Section kommt mit Empty-State-Meldung + Begruendung.
//
// Output: runs/_ui-test/empty-sections-smoke.html

import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { renderHtmlDocument } from "../lib/html/document.mjs";
import {
  renderDiscoveryCandidateCards,
  renderWatchlistTopCards,
  renderCoverageCards,
  renderReviewScopeCards,
  renderProjectContextSources,
  renderAgentField,
  renderRepoMatrix,
  renderOnDemandRunCards,
  renderOnDemandArtifactCards,
  renderOnDemandNextActions,
  renderOnDemandRunPlanCards,
  renderOnDemandRunDriftCards,
  renderOnDemandGovernanceCards,
  renderOnDemandStabilityCards,
  renderTabbedSection,
  renderWhatNowSection,
  renderEmpfehlungenSection
} from "../lib/html/sections.mjs";
import { renderPolicySummaryCard, renderPolicyCalibrationCard, renderHtmlList, renderTopRecommendations, renderRecommendedActions } from "../lib/html/shared.mjs";
import { renderInfoGrid } from "../lib/html/components.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "../runs/_ui-test/empty-sections-smoke.html");

// Minimal-Daten — wie ein echter Erstlauf ohne fertige Ergebnisse

const reportView = { candidateCount: 0, showMatrix: true };
const emptyCoverage = { mainLayers: [], gapAreas: [], capabilities: [] };

const emptyWatchlistReview = {
  topItems: [],
  items: [],
  coverage: emptyCoverage,
  reviewScope: "watchlist",
  inputUrlCount: 0,
  watchlistCount: 0,
  selectedUrls: [],
  runConfidence: "unbekannt",
  itemsDataStateSummary: { complete: 0, fallback: 0, stale: 0 },
  projectProfile: null,
  binding: null,
  projectKey: "eventbear-worker"
};

const emptyProjectProfile = {
  contextSources: {
    loadedFiles: [],
    missingFiles: [],
    scannedDirectories: [],
    declaredFiles: [],
    declaredDirectories: []
  },
  capabilitiesPresent: []
};

const emptyAgentView = {
  mission: [],
  deliverable: [],
  priorityRepos: [],
  context: [],
  guardrails: [],
  uncertainties: [],
  codingStarter: { primary: null, secondary: [] },
  payload: {},
  downloadFileName: "patternpilot-agent-handoff.json",
  techStack: null,
  references: [],
  successCriteria: []
};

const emptyDiscovery = {
  policySummary: { enabled: false },
  policyCalibration: null
};

const emptyOnDemandSummary = {
  runKind: "not_run",
  recommendedFocus: "-",
  sourceMode: "not_run",
  explicitUrls: [],
  effectiveUrls: [],
  appendWatchlist: false,
  runPlan: { runKind: "not_run", recommendedFocus: "-", notes: [], defaultPhases: {} },
  intakeRun: { items: [] },
  reEvaluateRun: { updates: [] },
  reviewRun: { review: emptyWatchlistReview },
  promoteRun: { items: [] },
  artifacts: {},
  nextActions: []
};

const emptyDrift = {
  driftStatus: "unbekannt",
  signals: [],
  resumeGuidance: { mode: "-", nextAction: "-" },
  queueSnapshot: { decisionStateSummary: { complete: 0, fallback: 0, stale: 0 } }
};

const emptyGovernance = {
  status: "unbekannt",
  autoDispatchAllowed: false,
  autoApplyAllowed: false,
  recommendedPromotionMode: "-",
  blockedPhases: [],
  nextAction: null
};

const emptyStability = {
  status: "unbekannt",
  stableStreak: 0,
  unstableStreak: 0,
  comparedPairs: 0
};

// Konsolidierte Bundles
const discoveryPolicyBundle = renderTabbedSection({
  id: "discovery-policy", title: "Discovery-Regelwerk", sub: "Wirkung + Kalibrierung",
  accent: "orange", countChip: "2 Ansichten",
  tabs: [
    { label: "Aktuelle Wirkung", body: renderPolicySummaryCard(emptyDiscovery) },
    { label: "Kalibrierung", body: renderPolicyCalibrationCard(emptyDiscovery) }
  ]
});

const runHealthBundle = renderTabbedSection({
  id: "run-health", title: "Lauf-Gesundheit", sub: "Drift / Stabilitaet / Governance",
  accent: "purple", countChip: "3 Ansichten",
  tabs: [
    { label: "Drift", body: renderOnDemandRunDriftCards(emptyDrift) },
    { label: "Stabilitaet", body: renderOnDemandStabilityCards(emptyStability) },
    { label: "Governance", body: renderOnDemandGovernanceCards(emptyGovernance) }
  ]
});

const techStatusBundle = renderTabbedSection({
  id: "tech-status", title: "Technischer Lauf-Status", sub: "URLs / Intake-Luecken / Suchfehler",
  accent: "green", countChip: "3 Ansichten",
  tabs: [
    { label: "Wirksame URLs", body: renderHtmlList([], "Zu diesem Lauf gehoerten keine wirksamen URLs.") },
    { label: "Fehlendes Intake", body: renderHtmlList([], "Alle Watchlist-URLs sind abgedeckt.") },
    { label: "Suchfehler", body: renderHtmlList([], "Keine Suchfehler in diesem Lauf.") }
  ]
});

const empfehlungenBundle = renderEmpfehlungenSection({
  recommendations: [],
  candidates: [],
  reportType: "discovery",
  runRoot: null,
  renderTopRecommendations,
  renderRecommendedActions
});

const sections = [
  { id: "empfehlungen", title: "Empfehlungen", navLabel: "Empfehlungen", body: empfehlungenBundle, skipSectionWrapper: true },
  {
    id: "candidates", title: "Discovery-Kandidaten", navLabel: "Kandidaten",
    body: renderDiscoveryCandidateCards([], reportView)
  },
  {
    id: "discovery-lenses", title: "Discovery-Linsen", navLabel: "Linsen",
    body: `<p class="empty">Noch keine Discovery-Linsen fuer diesen Lauf aufgebaut. Sie entstehen sobald Pattern Pilot echte GitHub-Queries gegen dein Projekt ausfuehrt.</p>`
  },
  { id: "discovery-policy", title: "Discovery-Regelwerk", navLabel: "Regelwerk", body: discoveryPolicyBundle, skipSectionWrapper: true },

  // Watchlist-Review
  {
    id: "top-compared-repositories", title: "Staerkste Vergleichs-Repos", navLabel: "Top Repos",
    body: renderWatchlistTopCards(emptyWatchlistReview, reportView)
  },
  { id: "coverage", title: "Coverage", navLabel: "Coverage", body: renderCoverageCards(emptyCoverage) },
  { id: "review-scope", title: "Review-Umfang", navLabel: "Umfang", body: renderReviewScopeCards(emptyWatchlistReview) },
  {
    id: "highest-risk-signals", title: "Staerkste Risikosignale", navLabel: "Risiken",
    body: renderHtmlList([], "Keine Risikosignale vorhanden. Sie erscheinen, sobald Review-Items mit niedrigem Fit-Band oder offenen Warnsignalen auftauchen.")
  },
  { id: "repo-matrix", title: "Repo-Matrix", navLabel: "Matrix", body: renderRepoMatrix(emptyWatchlistReview, reportView) },

  // On-Demand
  { id: "run-summary", title: "Laufzusammenfassung", navLabel: "Lauf", body: renderOnDemandRunCards(emptyOnDemandSummary) },
  { id: "artifacts", title: "Artefakte", navLabel: "Artefakte", body: renderOnDemandArtifactCards(emptyOnDemandSummary.artifacts) },
  { id: "run-plan", title: "Laufplan", navLabel: "Plan", body: renderOnDemandRunPlanCards(emptyOnDemandSummary.runPlan) },
  { id: "run-health", title: "Lauf-Gesundheit", navLabel: "Lauf-Gesundheit", body: runHealthBundle, skipSectionWrapper: true },
  { id: "tech-status", title: "Technischer Lauf-Status", navLabel: "Lauf-Status", body: techStatusBundle, skipSectionWrapper: true },

  // Kontext + Agent
  { id: "agent-view", title: "KI Coding Agents", navLabel: "Agents", body: renderAgentField(emptyAgentView) },
  { id: "target-repo-context", title: "Zielrepo-Kontext", navLabel: "Kontext", body: renderProjectContextSources(emptyProjectProfile, null) },

  // "Was jetzt?" ganz unten als Abschluss-CTA
  {
    id: "what-now", title: "Was jetzt? — Action-Steps", navLabel: "Was jetzt?",
    body: renderWhatNowSection({ projectKey: "eventbear-worker" }),
    skipSectionWrapper: true
  }
];

const html = renderHtmlDocument({
  title: "Pattern Pilot — Alle 27 Sections (leerer Erstlauf)",
  reportType: "discovery",
  projectKey: "eventbear-worker",
  createdAt: "2026-04-23T14:00:00Z",
  heroSubtitle: "balanced",
  candidateCount: 0,
  runRoot: null,
  stats: [
    { label: "Kandidaten", value: 0, primary: true },
    { label: "Empfehlungen", value: 0, primary: true },
    { label: "Risiken", value: 0, primary: true },
    { label: "Lauf-Datum", value: "23.04.2026", primary: false },
    { label: "Profil", value: "balanced", primary: false },
    { label: "Ziel-Repo", value: "eventbear-worker", primary: false }
  ],
  recommendations: [],
  candidates: [],
  sections,
  agentPayloadScript: "",
  modeOptions: [],
  layerOptions: []
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${html.length} bytes, ${sections.length} sections)`);
