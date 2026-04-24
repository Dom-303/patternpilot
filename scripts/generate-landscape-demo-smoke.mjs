// scripts/generate-landscape-demo-smoke.mjs
//
// Generiert ein Landscape-Demo-HTML mit ALLEN Sections voll befuellt —
// dient als visuelle Vollstaendigkeits-Referenz, damit User und Designer
// sehen, wie eine Landscape mit komplettem Datenbestand aussieht.
//
// Output: runs/_ui-test/landscape-demo-smoke.html

import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { renderLandscapeHtml } from "../lib/landscape/html-report.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "../runs/_ui-test/landscape-demo-smoke.html");

// --- Rich Demo-Daten ---

const problem = {
  title: "Event-Deduplication ueber heterogene Quellen",
  slug: "event-deduplication-across-heterogenous-sources",
  project: "eventbear-worker",
  fields: {
    description: "Derselbe physische Event wird von mehreren Quellen eingesammelt — mit leicht unterschiedlichen Titeln, Adressschreibweisen, Start-Zeiten. Ziel: alle Varianten zu einer kanonischen Event-Entity zusammenfuehren, ohne unterschiedliche Events desselben Veranstalters faelschlich zu mergen.",
    current_approach: "Simple String-Match auf Titel + Datum. Funktioniert bei ~60% der Faelle; der Rest bleibt Dublette oder wird falsch gemerged.",
    success_criteria: [
      "Zwei Varianten desselben Events werden zu 1 kanonischer Entity gemerged",
      "Zwei verschiedene Events desselben Veranstalters bleiben getrennt",
      "Merge-Entscheidungen inspectable mit pro-Feld Begruendung"
    ],
    constraints: [
      "Node.js / TypeScript Worker, Open-Source-Referenzen bevorzugt",
      "Matching ohne zentrale ID — nur via Inhalt und Metadaten",
      "Inspectable merge logic, keine Black-Box-Deep-Learning"
    ],
    non_goals: [
      "Kein manuelles Merge-Review als Default-Flow",
      "Kein DB-natives Merging (Postgres extensions o.ae.)",
      "Keine ML-Model-Training-Pipeline"
    ]
  },
  derived: {
    query_seeds: ["record linkage library", "entity resolution", "fuzzy matching", "blocking key dedup"],
    tech_tags: ["nodejs", "typescript", "python"],
    constraint_tags: ["opensource"],
    approach_signature: ["record-linkage", "entity-resolution", "fuzzy-matching", "blocking", "similarity-scoring"]
  }
};

const clusters = [
  {
    key: "c1",
    label: "Record-Linkage-Libraries",
    pattern_family: "python record linkage",
    main_layer: "dedupe_identity",
    relation: "divergent",
    signature_contrast: ["python", "record-linkage", "probabilistic", "fellegi-sunter"],
    member_ids: [
      "https://github.com/AI-team-UoA/pyJedAI",
      "https://github.com/J535D165/recordlinkage",
      "https://github.com/moj-analytical-services/splink",
      "https://github.com/zinggAI/zingg",
      "https://github.com/dedupeio/dedupe"
    ],
    has_suggested_members: false,
    has_constraint_violation: false
  },
  {
    key: "c2",
    label: "Blocking-Strategien",
    pattern_family: "sorted-neighborhood",
    main_layer: "dedupe_identity",
    relation: "divergent",
    signature_contrast: ["blocking", "sorted-neighborhood", "canopy", "lsh"],
    member_ids: [
      "https://github.com/scify/JedAIToolkit",
      "https://github.com/usc-isi-i2/rltk",
      "https://github.com/RecordLinkage/RecordLinkage.jl"
    ],
    has_suggested_members: false,
    has_constraint_violation: false
  },
  {
    key: "c3",
    label: "Fuzzy-String-Matching",
    pattern_family: "levenshtein",
    main_layer: "normalize_semantics",
    relation: "adjacent",
    signature_contrast: ["levenshtein", "jaro-winkler", "fuzzy", "similarity"],
    member_ids: [
      "https://github.com/seatgeek/fuzzywuzzy",
      "https://github.com/maxbachmann/RapidFuzz",
      "https://github.com/jamesturk/jellyfish",
      "https://github.com/life4/textdistance"
    ],
    has_suggested_members: false,
    has_constraint_violation: false
  },
  {
    key: "c4",
    label: "Schema-Aligner",
    pattern_family: "schema alignment",
    main_layer: "normalize_semantics",
    relation: "adjacent",
    signature_contrast: ["schema-mapping", "ontology", "alignment"],
    member_ids: [
      "https://github.com/dbs-leipzig/coma-3.0",
      "https://github.com/AKSW/LIMES"
    ],
    has_suggested_members: false,
    has_constraint_violation: true
  },
  {
    key: "c5",
    label: "Event-spezifische Canonicalization",
    pattern_family: "ical canonicalization",
    main_layer: "dedupe_identity",
    relation: "near_current_approach",
    signature_contrast: ["ical", "rrule", "canonicalization", "event"],
    member_ids: [
      "https://github.com/kewisch/ical.js",
      "https://github.com/jkbrzt/rrule"
    ],
    has_suggested_members: true,
    has_constraint_violation: false
  }
];

const landscape = {
  clusters,
  outliers: ["https://github.com/outlier-example/orphan-repo"],
  relation_counts: { divergent: 2, adjacent: 2, near_current_approach: 1 },
  landscape_signal: "divergent_rich",
  axis_view: {
    dimensions: [
      { label: "Latenz", percent: 72, value: "Batch" },
      { label: "Datenmodell", percent: 58, value: "relational" },
      { label: "Distribution", percent: 34, value: "Library" },
      { label: "Genauigkeit", percent: 82, value: "hoch" },
      { label: "Ressourcen-Bedarf", percent: 45, value: "mittel" }
    ]
  },
  queryPlans: [
    {
      label: "Query 1",
      query: '"record linkage library"',
      hitCount: 5,
      reasons: ["Zielt auf etablierte Python-Libs", "Deckt Academic + Industry ab", "Hohe Trefferquote in pilot runs"]
    },
    {
      label: "Query 2",
      query: '"entity resolution deduplication"',
      hitCount: 4,
      reasons: ["Approach-Signature-Match", "Breiter Begriff, gute Coverage"]
    },
    {
      label: "Query 3",
      query: '"fuzzy string matching" language:javascript',
      hitCount: 3,
      reasons: ["JS/TS-Oekosystem gezielt", "Tech-Tag-Filter aktiv"]
    },
    {
      label: "Query 4",
      query: '"blocking strategy dedup"',
      hitCount: 2,
      reasons: ["Technik-Fokus Blocking", "Performance-relevant"]
    },
    {
      label: "Query 5",
      query: '"schema alignment library"',
      hitCount: 1,
      reasons: ["Normalisierungs-Schicht", "Wenig Mainstream"]
    }
  ],
  agentView: {
    mission: [
      "Record-Linkage-Basis-Schicht im eventbear-worker verankern",
      "Divergente Cluster-Insights in konkrete Adapter-Strategie uebersetzen",
      "Bestehenden heuristischen Dedup als Fallback erhalten"
    ],
    deliverable: [
      "adapters/record-linkage-bridge.mjs als Prototyp",
      "Mapping-Doku: 40-Spalten-Event-Schema -> pyJedAI-Blocker",
      "Benchmark-Report: Heuristik vs pyJedAI auf 3 Referenz-Datensaetzen"
    ],
    priorityRepos: [
      { repo: "AI-team-UoA/pyJedAI", action: "Als Basis uebernehmen, Mapping skizzieren", url: "https://github.com/AI-team-UoA/pyJedAI" },
      { repo: "moj-analytical-services/splink", action: "Alternativer Pfad — probabilistic matching vergleichen", url: "https://github.com/moj-analytical-services/splink" },
      { repo: "maxbachmann/RapidFuzz", action: "Fuzzy-Layer drunterhaengen fuer String-Toleranz", url: "https://github.com/maxbachmann/RapidFuzz" }
    ],
    context: [
      "Zielprojekt: eventbear-worker",
      "Aktuelles Dedup: Heuristik auf Titel+Datum",
      "Produktionsdaten: ~10k Events/Monat, 5 Quellen",
      "Landscape-Signal: divergent_rich"
    ],
    guardrails: [
      "Keine GPL/AGPL-Lizenzen ohne Legal-Check",
      "Schema darf nicht gebrochen werden — Dedup als Add-on-Layer",
      "Python-Bridge nur via Subprocess-Call, keine native-Bindings"
    ],
    uncertainties: [
      "Performance von pyJedAI auf 10k+ Events ungeprueft",
      "Fuzzy-Matching-Thresholds fuer deutsche Event-Titel nicht kalibriert",
      "Record-Linkage-Libs vs Fuzzy-Ansatz — beide Cluster stark"
    ],
    codingStarter: {
      primary: {
        repo: "AI-team-UoA/pyJedAI",
        starterLabel: "adapters/pyJedAI-bridge.mjs",
        implementationGoal: "Subprocess-Bruecke zu pyJedAI, die 100 Events in Blocking-Keys + Matching-Pairs ueberfuehrt",
        firstSlice: "CLI-Demo: Batch von 100 Events -> JSON-Output mit confidence-score",
        targetAreas: ["dedupe_layer", "worker_pipeline"],
        starterMode: "prototype",
        compareChecklist: [
          "Wie unterscheiden sich Blocking-Strategien zu aktueller Heuristik?",
          "Wie werden fehlende Felder behandelt?",
          "Latency pro Batch unter 5 Sekunden?"
        ],
        stopIf: [
          "Python-Bridge > Heuristik-Overhead ohne bessere Precision",
          "Matching-Precision unter 90% auf dem Referenz-Set"
        ]
      },
      secondary: [
        {
          repo: "moj-analytical-services/splink",
          starterLabel: "adapters/splink-bridge.mjs",
          implementationGoal: "Alternativer probabilistic-matching-Pfad via Fellegi-Sunter",
          firstSlice: "Fellegi-Sunter-Scoring auf Event-Titel",
          targetAreas: ["dedupe_layer"],
          starterMode: "exploration",
          compareChecklist: ["Wie unterscheidet sich Scoring von pyJedAI?"],
          stopIf: ["Keine klaren Unterschiede zu pyJedAI"]
        }
      ]
    },
    payload: {
      schemaVersion: "2",
      handoffType: "landscape-to-worker",
      problemSlug: "event-deduplication-across-heterogenous-sources",
      project: "eventbear-worker",
      relationCounts: { divergent: 2, adjacent: 2, near_current_approach: 1 }
    },
    downloadFileName: "patternpilot-landscape-handoff-event-dedup.json",
    techStack: {
      languages: ["JavaScript (ES Modules)", "Node.js 20", "Python 3.11 (via subprocess)"],
      runtime: "Node.js 20 mit Sub-Process-Bruecke zu Python",
      testCommand: "npm test",
      buildCommand: "npm run build"
    },
    references: [
      "lib/dedup/heuristic.mjs",
      "lib/extract/schema.mjs",
      "adapters/*.mjs",
      "test/dedup.test.mjs"
    ],
    successCriteria: [
      { label: "Unit-Tests", command: "npm test -- test/dedup.test.mjs", expect: "alle tests pass" },
      { label: "Integration-Benchmark", command: "npm run bench:dedup", expect: "precision > 0.9, recall > 0.85" },
      { label: "Schema-Kompatibilitaet", command: "npm run validate-schema", expect: "40/40 Spalten bleiben befuellt" },
      "Keine neue Non-MIT/Apache Dependency ohne Legal-OK"
    ]
  },
  runHealth: {
    drift: {
      driftStatus: "stable",
      signals: [
        { severity: "info", id: "cluster_count_stable", message: "Cluster-Anzahl stabil bei 5 ueber letzte 3 Laeufe" }
      ],
      resumeGuidance: { mode: "continue", nextAction: "Naechster Problem-Refresh in 7 Tagen" },
      queueSnapshot: { decisionStateSummary: { complete: 4, fallback: 1, stale: 0 } }
    },
    stability: {
      status: "stable_streak",
      stableStreak: 3,
      unstableStreak: 0,
      comparedPairs: 4
    },
    governance: {
      status: "automatic",
      autoDispatchAllowed: true,
      autoApplyAllowed: false,
      recommendedPromotionMode: "dry_run",
      blockedPhases: [],
      nextAction: "Nach 2 weiteren stable-Laeufen auto-apply evaluieren"
    }
  },
  techStatus: {
    effectiveQueries: [
      '"record linkage library"',
      '"entity resolution deduplication"',
      '"fuzzy string matching" language:javascript',
      '"blocking strategy dedup"',
      '"schema alignment library"'
    ],
    missingCandidates: [
      "Keine Kandidaten aus Rust-Oekosystem — Query fuer rust-spezifisch ergaenzen fuer vollstaendigere Sicht"
    ],
    searchErrors: [
      "Timeout bei phrase 'probabilistic record matching library' (retry nach 6s erfolgreich)"
    ]
  }
};

// Fake Project-Profile + Binding, damit Zielrepo-Kontext-Section rendert
const projectProfile = {
  contextSources: {
    loadedFiles: ["PROJECT_CONTEXT.md", "STATUS.md", "OPEN_QUESTION.md", "docs/dedup-spec.md"],
    missingFiles: ["docs/legacy-dedup.md"],
    scannedDirectories: [
      { path: "lib/dedup", entryCount: 8 },
      { path: "adapters", entryCount: 3 },
      { path: "test/dedup", entryCount: 12 }
    ],
    declaredFiles: ["PROJECT_CONTEXT.md", "STATUS.md", "OPEN_QUESTION.md", "docs/dedup-spec.md", "docs/legacy-dedup.md"],
    declaredDirectories: ["lib/dedup", "adapters", "test/dedup"]
  },
  capabilitiesPresent: ["deduplication", "schema_mapping", "event_canonicalization", "fuzzy_matching"]
};

const binding = {
  projectKey: "eventbear-worker",
  projectLabel: "EventBaer Worker",
  readBeforeAnalysis: ["PROJECT_CONTEXT.md", "STATUS.md"],
  referenceDirectories: ["lib/dedup", "adapters"]
};

const html = renderLandscapeHtml({
  problem,
  landscape,
  runId: "2026-04-24T-demo",
  projectProfile,
  binding
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${html.length} bytes, ${clusters.length} clusters, all sections filled)`);
