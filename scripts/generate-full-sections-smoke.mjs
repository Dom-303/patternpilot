// scripts/generate-full-sections-smoke.mjs
//
// Generiert ein Smoke-HTML, das ALLE Report-Sektionen aus allen drei
// Report-Typen (Discovery / Watchlist-Review / On-Demand) gleichzeitig
// zeigt — mit fiktiven aber strukturell korrekten Beispieldaten.
//
// Nutzen: visuelle Vollstaendigkeits-Pruefung. Zeigt jede migrierte
// Section im Cockpit-Night-Look, damit User UX und Verstaendlichkeit
// jeder einzelnen Stelle bewerten kann.
//
// Output: runs/_ui-test/full-sections-smoke.html

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
  renderOnDemandStabilityCards
} from "../lib/html/sections.mjs";
import { renderPolicySummaryCard, renderPolicyCalibrationCard, renderHtmlList } from "../lib/html/shared.mjs";
import { renderInfoGrid } from "../lib/html/components.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "../runs/_ui-test/full-sections-smoke.html");

// --- Fiktiven aber strukturell korrekten Daten-Fundus zusammenbauen ---

const richCandidate = (owner, name, description, disposition, score, fitBand, mainLayer, gapArea) => ({
  repo: { owner, name, normalizedRepoUrl: `https://github.com/${owner}/${name}` },
  discoveryDisposition: disposition,
  discoveryScore: score,
  discoveryClass: "tool_library",
  guess: { mainLayer, gapArea },
  gapAreaCanonical: gapArea,
  projectAlignment: {
    fitBand,
    matchedCapabilities: ["record_linkage", "entity_resolution", "blocking"],
    suggestedNextStep: "Als Record-Linkage-Basis pruefen und einen Adapter fuer das 40-Spalten-Schema skizzieren."
  },
  discoveryEvidence: {
    grade: "strong",
    score,
    sourceFamilyHits: 3,
    publicEventIntakeHits: 0,
    governanceHits: 1,
    normalizationHits: 2,
    topicHits: ["record-linkage", "entity-resolution", "deduplication"],
    readmeHits: ["pandas", "fuzzy matching", "blocking"],
    keywordHits: ["python", "library"]
  },
  enrichment: {
    repo: { description, topics: ["record-linkage", "entity-resolution", "python"], stars: 1240 },
    languages: ["Python", "Cython", "Jupyter Notebook"]
  },
  risks: ["fachlich_spezifisch", "reifegrad_mittel"],
  reasoning: [
    "Starke README-Signale zu Entity-Resolution und Record-Linkage.",
    "Stabile Sterne-Entwicklung und juengste Commits in den letzten 30 Tagen.",
    "Passt zur matched-capability 'record_linkage' im Zielprojekt."
  ],
  queryFamilies: ["record_linkage_libs", "entity_resolution_python"],
  landkarteCandidate: {
    possible_implication: "Basis fuer Dedup-Layer im Worker; eigener Adapter fuer Event-Schema."
  }
});

const candidates = [
  richCandidate("AI-team-UoA", "pyJedAI", "Python toolkit for entity resolution and link discovery.", "intake_now", 8.4, "high", "dedupe_identity", "dedupe_and_identity"),
  richCandidate("J535D165", "recordlinkage", "Toolkit for record linkage and duplicate detection.", "review_queue", 7.1, "medium", "dedupe_identity", "dedupe_and_identity"),
  richCandidate("example", "trade-record-linker", "Domain-specific record linker for trade data.", "observe_only", 5.8, "low", "dedupe_identity", "dedupe_and_identity"),
  richCandidate("example", "dedup-titled", "Fuzzy title-based dedup for event feeds.", "observe_only", 5.1, "low", "parsing_extraction", "dedupe_and_identity"),
  richCandidate("example", "event-canonicalizer", "Event schema canonicalizer for multi-source intake.", "review_queue", 6.4, "medium", "normalize_semantics", "quality_gate")
];

const coverage = {
  mainLayers: [
    { value: "dedupe_identity", count: 5 },
    { value: "parsing_extraction", count: 3 },
    { value: "source_discovery", count: 2 }
  ],
  gapAreas: [
    { value: "dedupe_and_identity", count: 4 },
    { value: "quality_gate", count: 2 }
  ],
  capabilities: [
    { value: "record_linkage", count: 4 },
    { value: "entity_resolution", count: 3 },
    { value: "blocking", count: 2 }
  ]
};

const agentView = {
  mission: [
    "Record-Linkage-Stack in den Event-Worker einbauen",
    "40-Spalten-Event-Schema auf pyJedAI mappen",
    "Baseline-Benchmark gegen bestehenden Dedup-Heuristik-Layer"
  ],
  deliverable: [
    "Prototyp mit pyJedAI-Integration",
    "Mapping-Doku fuer Event-Felder -> pyJedAI-Blocker",
    "Erste Messwerte auf drei Referenz-Datensaetzen"
  ],
  priorityRepos: [
    { repo: "AI-team-UoA/pyJedAI", action: "Basis uebernehmen, Mapping skizzieren", url: "https://github.com/AI-team-UoA/pyJedAI" },
    { repo: "J535D165/recordlinkage", action: "Blocking-Strategie adaptieren", url: "https://github.com/J535D165/recordlinkage" }
  ],
  context: [
    "Zielprojekt: eventbear-worker",
    "Aktuelles Dedup-Verfahren: Heuristik auf Titel+Datum",
    "Produktionsdaten: ca. 10k Events / Monat, 5 Quellen"
  ],
  guardrails: [
    "Keine Abhaengigkeit auf Nicht-MIT/Apache-Lizenzen ohne Legal-Check",
    "Schema darf nicht gebrochen werden — Dedup nur als Add-on-Layer"
  ],
  uncertainties: [
    "Performance bei 10k+ Events ungeprueft",
    "Fuzzy-Matching-Thresholds muessen fuer Deutsche Titel kalibriert werden"
  ],
  codingStarter: {
    primary: {
      repo: "AI-team-UoA/pyJedAI",
      starterLabel: "adapters/pyJedAI-bridge.mjs",
      implementationGoal: "Minimaler Adapter, der ein Batch von Events entgegennimmt und pyJedAI-Kandidatenpaare zurueckgibt.",
      firstSlice: "Batch von 100 Events -> Blocking-Keys -> Matching-Pairs mit confidence-score.",
      targetAreas: ["dedupe_layer", "worker_pipeline"],
      starterMode: "prototype",
      compareChecklist: [
        "Python-Abhaengigkeit ueber PyO3 oder Subprocess-Call?",
        "Blocking auf Titel+Datum+Venue-Feldern sinnvoll?",
        "Wie umgehen wir fehlende Felder bei Quellen mit schwacher Qualitaet?"
      ],
      stopIf: [
        "Python-Bridge mehr Overhead als die aktuelle Heuristik bringt",
        "Matching-Precision unter 90% auf dem Referenz-Set"
      ]
    },
    secondary: [
      {
        repo: "J535D165/recordlinkage",
        starterLabel: "adapters/recordlinkage-bridge.mjs",
        implementationGoal: "Alternativer Adapter mit fokussiertem probabilistic-matching.",
        firstSlice: "Fellegi-Sunter-Scoring auf Event-Titel.",
        targetAreas: ["dedupe_layer"],
        starterMode: "exploration",
        compareChecklist: ["Wie unterscheidet sich das Scoring von pyJedAI?"],
        stopIf: ["Keine klaren Unterschiede zu pyJedAI"]
      }
    ]
  },
  payload: { schemaVersion: "2", handoffType: "discovery-to-worker" },
  downloadFileName: "patternpilot-agent-handoff-eventbear-worker.json"
};

const projectProfile = {
  contextSources: {
    loadedFiles: ["README.md", "CLAUDE.md", "lib/extract/events.mjs", "lib/detect/source-type.mjs", "docs/extraction-pipeline.md"],
    missingFiles: ["docs/legacy-module.md"],
    scannedDirectories: [
      { path: "lib/extract", entryCount: 18 },
      { path: "lib/detect", entryCount: 7 },
      { path: "data/sources", entryCount: 42 }
    ],
    declaredFiles: ["README.md", "CLAUDE.md"],
    declaredDirectories: ["lib/extract", "lib/detect"]
  },
  capabilitiesPresent: ["source_intake", "parsing_extraction", "normalization", "dedup_heuristic"]
};

const watchlistReview = {
  topItems: [
    {
      repoRef: "citybureau/city-scrapers",
      reason: "Civic event scraping framework with tested Illinois coverage.",
      reviewScore: 8.2,
      projectFitBand: "high",
      projectFitScore: 82,
      mainLayer: "source_intake",
      gapArea: "source_discovery",
      matchedCapabilities: ["scrapy", "civic_events"],
      recommendedWorkerAreas: ["source_adapter"],
      suggestedNextStep: "Scrapy-Adapter-Muster uebernehmen und auf DE-Kommunen mappen.",
      learningForEventbaer: "Standardisiertes Adapter-Interface fuer hetorgene Quellen.",
      possibleImplication: "Mehrquellen-Framework-Layer im Worker ableiten.",
      strengths: "Breite Praxis-Validierung ueber 100+ Scraper.",
      weaknesses: "Primaer Python, weniger direkt in Node.js uebernehmbar.",
      risks: ["sprachbruch"]
    },
    {
      repoRef: "j-e-d/agenda-lumiton",
      reason: "Kommunale Agenda-Parser mit Fokus DACH.",
      reviewScore: 6.9,
      projectFitBand: "medium",
      projectFitScore: 65,
      mainLayer: "parsing_extraction",
      gapArea: "source_intake",
      matchedCapabilities: ["agenda_parsing"],
      recommendedWorkerAreas: ["parser"],
      suggestedNextStep: "Parser-Strategie fuer PDF-Agenden adaptieren.",
      learningForEventbaer: "Regex-basierter Fallback fuer semi-strukturierte Quellen.",
      possibleImplication: "Parser-Familie fuer kommunale PDFs.",
      strengths: "DACH-Fokus, echte Produktionsdaten.",
      weaknesses: "Wenig Test-Coverage.",
      risks: ["wartung_unklar"]
    }
  ],
  items: [
    { repoRef: "citybureau/city-scrapers", mainLayer: "source_intake", gapArea: "source_discovery", projectFitBand: "high", projectFitScore: 82, suggestedNextStep: "Scrapy-Adapter adaptieren.", projectRelevance: "hoch" },
    { repoRef: "j-e-d/agenda-lumiton", mainLayer: "parsing_extraction", gapArea: "source_intake", projectFitBand: "medium", projectFitScore: 65, suggestedNextStep: "Parser-Familie.", projectRelevance: "mittel" }
  ],
  coverage,
  reviewScope: "watchlist",
  inputUrlCount: 0,
  watchlistCount: 12,
  selectedUrls: [],
  runConfidence: "high",
  itemsDataStateSummary: { complete: 10, fallback: 1, stale: 1 },
  projectProfile,
  binding: null,
  projectKey: "eventbear-worker"
};

const reportView = { candidateCount: 5, showMatrix: true };

// --- Discovery-Regelwerk + Kalibrierung (fiktive aber realistische Shape) ---

const discovery = {
  policySummary: {
    enabled: true,
    mode: "enforce",
    evaluated: 42,
    visible: 34,
    allowed: 34,
    blocked: 8,
    enforcedBlocked: 3,
    preferred: 5,
    blockerCounts: [
      { value: "low_stars", count: 4 },
      { value: "stale_commits", count: 2 },
      { value: "license_restricted", count: 1 },
      { value: "niche_vertical", count: 1 }
    ],
    preferenceCounts: [
      { value: "matched_capability", count: 3 },
      { value: "active_maintenance", count: 2 }
    ],
    blockedPreview: [
      { repoRef: "abandoned/stale-scraper", blockers: ["stale_commits", "low_stars"] },
      { repoRef: "example/rights-restricted", blockers: ["license_restricted"], summary: "GPL-3 ohne dual-license" }
    ]
  },
  policyCalibration: {
    status: "well_calibrated",
    topBlockers: [
      { value: "low_stars", count: 4 },
      { value: "stale_commits", count: 2 }
    ],
    recommendations: [
      "Star-Threshold koennte von 10 auf 5 gesenkt werden — verliert nur 2 false-positives",
      "Stale-Commits-Threshold (>18 Monate) sitzt passend zum aktuellen Corpus"
    ]
  }
};

// --- On-Demand Run (fiktiv) ---

const onDemandSummary = {
  runKind: "on_demand_chain",
  recommendedFocus: "watchlist_review_refresh",
  sourceMode: "watchlist",
  explicitUrls: [],
  effectiveUrls: ["https://github.com/citybureau/city-scrapers", "https://github.com/j-e-d/agenda-lumiton"],
  appendWatchlist: true,
  runPlan: {
    runKind: "on_demand_chain",
    recommendedFocus: "watchlist_review_refresh",
    notes: ["Watchlist seit 14 Tagen unveraendert", "Letzter erfolgreicher Full-Review vor 7 Tagen"],
    defaultPhases: { intake: "skip", reEvaluate: "apply", review: "apply", promote: "dry_run" }
  },
  intakeRun: { items: [] },
  reEvaluateRun: { updates: [{ repo: "citybureau/city-scrapers" }, { repo: "j-e-d/agenda-lumiton" }] },
  reviewRun: { review: watchlistReview },
  promoteRun: { items: [] },
  artifacts: {
    reviewReportHref: "runs/eventbear-worker/2026-04-23/patternpilot-report.html",
    reviewReportLabel: "patternpilot-report.html",
    latestReportHref: "projects/eventbear-worker/reports/latest-report.json",
    latestReportLabel: "latest-report.json",
    agentHandoffHref: "projects/eventbear-worker/reports/agent-handoff.json",
    agentHandoffLabel: "agent-handoff.json",
    browserLinkHref: "projects/eventbear-worker/reports/browser-link",
    browserLinkLabel: "browser-link"
  },
  nextActions: [
    "Watchlist um 2-3 Quellen fuer Bayern-Kommunen erweitern",
    "Decision-Log aus heutigem Lauf konsolidieren",
    "Intake-Pipeline auf 24h-Zyklus umstellen"
  ]
};

const runDrift = {
  driftStatus: "attention_required",
  signals: [
    { severity: "warn", id: "decreasing_candidate_rate", message: "Kandidatenrate faellt seit 3 Laeufen um >15%" },
    { severity: "info", id: "shifted_mainLayer", message: "Main-Layer-Verteilung verschiebt sich von parsing_extraction zu dedupe_identity" }
  ],
  resumeGuidance: { mode: "continue", nextAction: "Naechster Lauf in 24h, Watchlist-Erweiterung vorher pruefen" },
  queueSnapshot: { decisionStateSummary: { complete: 8, fallback: 2, stale: 1 } }
};

const governance = {
  status: "manual_gate",
  autoDispatchAllowed: false,
  autoApplyAllowed: false,
  recommendedPromotionMode: "dry_run",
  blockedPhases: [],
  nextAction: "Manuelle Freigabe durch Projekt-Owner fuer Auto-Dispatch"
};

const stability = {
  status: "stable_streak",
  stableStreak: 5,
  unstableStreak: 0,
  comparedPairs: 8
};

// --- Sections zusammenbauen ---

const sections = [
  // Discovery-spezifisch
  {
    id: "candidates",
    title: "Discovery-Kandidaten",
    navLabel: "Kandidaten",
    body: renderDiscoveryCandidateCards(candidates, reportView)
  },
  {
    id: "discovery-lenses",
    title: "Discovery-Linsen",
    navLabel: "Linsen",
    body: renderInfoGrid([
      { title: "Query-Familie: record_linkage_libs", copy: "entity resolution OR record linkage language:python stars:>50", items: ["Zielt auf etablierte Python-Libs", "Filtert nach Popularity"] },
      { title: "Query-Familie: event_dedup", copy: "event deduplication OR event canonicalization", items: ["Fokus auf Event-spezifische Loesungen"] },
      { title: "Query-Familie: civic_events", copy: "city scrapers OR municipal events", items: ["Civic-Data-Ecosystem", "Fallback fuer DACH-Anpassung"] }
    ])
  },
  { id: "discovery-policy", title: "Discovery-Regelwerk", navLabel: "Regeln", body: renderPolicySummaryCard(discovery) },
  { id: "policy-calibration", title: "Regel-Kalibrierung", navLabel: "Kalibrierung", body: renderPolicyCalibrationCard(discovery) },

  // Watchlist-Review-spezifisch
  {
    id: "top-compared-repositories",
    title: "Staerkste Vergleichs-Repos",
    navLabel: "Top Repos",
    body: renderWatchlistTopCards(watchlistReview, reportView)
  },
  { id: "coverage", title: "Coverage", navLabel: "Coverage", body: renderCoverageCards(coverage) },
  { id: "review-scope", title: "Review-Umfang", navLabel: "Umfang", body: renderReviewScopeCards(watchlistReview) },
  {
    id: "highest-risk-signals",
    title: "Staerkste Risikosignale",
    navLabel: "Risiken",
    body: renderHtmlList([
      "citybureau/city-scrapers: Sprachbruch Python vs. Node",
      "j-e-d/agenda-lumiton: Wartung unklar, letzter Commit vor 14 Monaten"
    ], "Keine Risikosignale vorhanden.")
  },
  {
    id: "missing-watchlist-intake",
    title: "Fehlendes Intake fuer Watchlist",
    navLabel: "Fehlendes Intake",
    body: renderHtmlList(
      ["https://github.com/example/new-watchlist-entry", "https://github.com/another/fresh-watchlist-item"],
      "Alle aktuellen Watchlist-URLs sind bereits in der Queue abgedeckt."
    )
  },
  { id: "repo-matrix", title: "Repo-Matrix", navLabel: "Matrix", body: renderRepoMatrix(watchlistReview, reportView) },

  // On-Demand-spezifisch
  { id: "run-summary", title: "Laufzusammenfassung", navLabel: "Lauf", body: renderOnDemandRunCards(onDemandSummary) },
  {
    id: "effective-urls",
    title: "Wirksame URLs",
    navLabel: "URLs",
    body: renderHtmlList(onDemandSummary.effectiveUrls, "Keine wirksamen URLs.")
  },
  { id: "artifacts", title: "Artefakte", navLabel: "Artefakte", body: renderOnDemandArtifactCards(onDemandSummary.artifacts) },
  { id: "run-plan", title: "Laufplan", navLabel: "Plan", body: renderOnDemandRunPlanCards(onDemandSummary.runPlan) },
  { id: "run-drift", title: "Laufdrift", navLabel: "Drift", body: renderOnDemandRunDriftCards(runDrift) },
  { id: "run-stability", title: "Stabilitaet", navLabel: "Stabilitaet", body: renderOnDemandStabilityCards(stability) },
  { id: "run-governance", title: "Governance", navLabel: "Governance", body: renderOnDemandGovernanceCards(governance) },
  { id: "what-now", title: "Was jetzt?", navLabel: "Was jetzt?", body: renderOnDemandNextActions(onDemandSummary.nextActions) },

  // Kontext + Agent
  { id: "agent-view", title: "KI Coding Agents", navLabel: "Agents", body: renderAgentField(agentView) },
  { id: "target-repo-context", title: "Zielrepo-Kontext", navLabel: "Kontext", body: renderProjectContextSources(projectProfile, null) },

  // Suchfehler
  {
    id: "search-errors",
    title: "Suchfehler",
    navLabel: "Suchfehler",
    body: renderHtmlList([
      "Query 'event dedup' lieferte 0 Treffer — GitHub-Rate-Limit-Warnung vor Abfrage",
      "Timeout bei github.com/search?q=civic_events (retry erfolgreich nach 8s)"
    ], "Keine Suchfehler in diesem Lauf.")
  }
];

const html = renderHtmlDocument({
  title: "Pattern Pilot — Alle Sektionen (Demo)",
  reportType: "discovery",
  projectKey: "eventbear-worker",
  createdAt: "2026-04-23T14:00:00Z",
  heroSubtitle: "balanced",
  candidateCount: 42,
  runRoot: "runs/eventbear-worker/2026-04-23T14-00-00-000Z",
  stats: [
    { label: "Kandidaten", value: 42, primary: true },
    { label: "Empfehlungen", value: 7, primary: true },
    { label: "Risiken", value: 3, primary: true },
    { label: "Lauf-Datum", value: "23.04.2026", primary: false },
    { label: "Profil", value: "balanced", primary: false },
    { label: "Ziel-Repo", value: "eventbear-worker", primary: false }
  ],
  recommendations: [
    "AI-team-UoA/pyJedAI: als Record-Linkage-Basis uebernehmen",
    "J535D165/recordlinkage: Blocking-Strategie adaptieren",
    "citybureau/city-scrapers: Adapter-Muster pruefen"
  ],
  candidates,
  sections,
  agentPayloadScript: JSON.stringify({ schemaVersion: "2", handoff: "sample" }),
  modeOptions: ["dedupe_and_identity", "source_discovery", "quality_gate"],
  layerOptions: ["dedupe_identity", "parsing_extraction", "source_intake", "normalize_semantics"]
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${html.length} bytes, ${sections.length} sections)`);
