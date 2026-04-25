// Phase 0 + Phase 6 scorer for Patternpilot Landscape- und Review-Reports.
//
// Diese Datei ist rein funktional: sie nimmt bereits geparste JSON-Objekte
// entgegen und gibt deterministische Scores zurueck. Keine File-I/O, keine
// Live-API-Calls. Das erlaubt reproduzierbare Messungen auf gefreezten
// Fixtures ueber alle Phasen hinweg.
//
// Schema v2 (Phase 6, 2026-04-25):
//   - Strukturachsen (5x 0-2 = 0-10): cluster-diversity, pattern-family-
//     coverage, lens-richness, context-alignment, visual-completeness.
//     Misst, ob der Report formal vollstaendig ist.
//   - Inhaltsachsen (4x 0-2 = 0-8 → normalisiert 0-10): problem-fit,
//     label-fidelity, classification-confidence, decision-readiness.
//     Misst per Heuristik, ob die DATEN im Report dem Nutzer wirklich
//     helfen.
//   - total = (structure + content) / 2 → 0-10 als Top-Line-Score.
//
// Wichtig: Inhaltsachsen sind bewusst Heuristiken mit Token-/Set-Overlap-
// Proxies. Sie ersetzen kein menschliches Urteil und kein LLM. Sie messen
// das, was strukturell unsichtbar bleibt — falsch positiv und falsch
// negativ moeglich. Aber: ein Report mit 10/10 Struktur und 4/10 Inhalt
// signalisiert, dass die Pipeline Daten ausspuckt, die formal stimmen aber
// thematisch danebenliegen. Das war vor Phase 6 unsichtbar.

const SCHEMA_VERSION = 2;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const STRUCTURE_AXIS_NAMES = [
  'cluster-diversity',
  'pattern-family-coverage',
  'lens-richness',
  'context-alignment',
  'visual-completeness',
];

const CONTENT_AXIS_NAMES = [
  'problem-fit',
  'label-fidelity',
  'classification-confidence',
  'decision-readiness',
];

// Backwards-compat: AXIS_NAMES bleibt = Strukturachsen, weil bestehende
// Aufrufer (Stability-Harness, Tests) damit indizieren.
const AXIS_NAMES = STRUCTURE_AXIS_NAMES;

function tokenize(value) {
  if (typeof value !== 'string' || value.length === 0) return [];
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function maxPairwiseJaccard(signatures) {
  if (signatures.length < 2) return 0;
  let max = 0;
  for (let i = 0; i < signatures.length; i += 1) {
    for (let j = i + 1; j < signatures.length; j += 1) {
      const value = jaccard(signatures[i], signatures[j]);
      if (value > max) max = value;
    }
  }
  return max;
}

function clampAxis(value) {
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 2) return 2;
  return rounded;
}

function buildAxis(score, measured, options = {}) {
  return {
    score: clampAxis(score),
    measured,
    applicable: options.applicable !== false,
  };
}

function sumAxes(axes, names = STRUCTURE_AXIS_NAMES) {
  return names.reduce((sum, name) => sum + (axes[name]?.score ?? 0), 0);
}

function buildTotals(structureAxes, contentAxes) {
  const structureTotal = sumAxes(structureAxes, STRUCTURE_AXIS_NAMES);
  // Inhalts-Achsen, die nicht anwendbar sind (z.B. problem_derived fehlt
  // bei alten Fixtures), werden aus dem Inhalts-Mittel ausgeschlossen.
  // Anwendbar = `applicable: true` UND eine konkrete Score-Zahl.
  const applicableContentAxes = CONTENT_AXIS_NAMES
    .map((name) => contentAxes[name])
    .filter((axis) => axis && axis.applicable !== false);
  let contentTotal = 0;
  if (applicableContentAxes.length > 0) {
    const sumScores = applicableContentAxes.reduce((sum, axis) => sum + axis.score, 0);
    // Normalisiere auf 0-10: applicable_count * 2 = max moeglich.
    contentTotal = Number(((sumScores / (applicableContentAxes.length * 2)) * 10).toFixed(2));
  }
  const combinedTotal = Number(((structureTotal + contentTotal) / 2).toFixed(2));
  return {
    structure: structureTotal,
    content: contentTotal,
    combined: combinedTotal,
    content_applicable_count: applicableContentAxes.length,
    content_total_count: CONTENT_AXIS_NAMES.length,
  };
}

// ---------------------------------------------------------------------------
// Token-helper fuer Inhaltsachsen
// ---------------------------------------------------------------------------

function gatherTokens(values) {
  const tokens = new Set();
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        for (const token of tokenize(typeof item === 'string' ? item : '')) tokens.add(token);
      }
    } else if (typeof value === 'string') {
      for (const token of tokenize(value)) tokens.add(token);
    }
  }
  return tokens;
}

function gatherAxisMembers(landscape) {
  const seen = new Set();
  const members = [];
  const axes = Array.isArray(landscape?.axis_view?.axes) ? landscape.axis_view.axes : [];
  for (const axis of axes) {
    const axisMembers = Array.isArray(axis?.members) ? axis.members : [];
    for (const member of axisMembers) {
      const id = typeof member?.id === 'string' ? member.id : null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      members.push(member);
    }
  }
  return members;
}

// ---------------------------------------------------------------------------
// Landscape axes
// ---------------------------------------------------------------------------

function landscapeClusterDiversity(landscape) {
  const clusters = Array.isArray(landscape?.clusters) ? landscape.clusters : [];
  const count = clusters.length;
  const signatures = clusters.map((cluster) => {
    const label = typeof cluster?.label === 'string' ? cluster.label : '';
    const family = typeof cluster?.pattern_family === 'string' ? cluster.pattern_family : '';
    return new Set(tokenize(`${label} ${family}`));
  });
  const overlap = maxPairwiseJaccard(signatures);
  const measured = {
    cluster_count: count,
    max_pairwise_jaccard: Number(overlap.toFixed(3)),
  };
  if (count <= 1) return buildAxis(0, measured);
  if (count === 2) return buildAxis(1, measured);
  return buildAxis(overlap < 0.5 ? 2 : 1, measured);
}

function landscapePatternFamilyCoverage(landscape) {
  const clusters = Array.isArray(landscape?.clusters) ? landscape.clusters : [];
  const total = clusters.length;
  if (total === 0) {
    return buildAxis(0, { cluster_count: 0, unknown_ratio: null });
  }
  let totalMembers = 0;
  let unknownMembers = 0;
  let unknownClusters = 0;
  for (const cluster of clusters) {
    const memberIds = Array.isArray(cluster?.member_ids) ? cluster.member_ids : [];
    const size = memberIds.length;
    totalMembers += size;
    const family = cluster?.pattern_family;
    const isUnknown = !family || family === 'unknown';
    if (isUnknown) {
      unknownClusters += 1;
      unknownMembers += size;
    }
  }
  const ratio = totalMembers === 0
    ? (unknownClusters === 0 ? 0 : 1)
    : unknownMembers / totalMembers;
  const measured = {
    cluster_count: total,
    unknown_clusters: unknownClusters,
    total_members: totalMembers,
    unknown_members: unknownMembers,
    unknown_ratio: Number(ratio.toFixed(3)),
  };
  if (ratio < 0.10) return buildAxis(2, measured);
  if (ratio <= 0.30) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

function landscapeLensRichness(landscape) {
  const checks = {
    clusters: Array.isArray(landscape?.clusters) && landscape.clusters.length > 0,
    query_plans: Array.isArray(landscape?.queryPlans) && landscape.queryPlans.length > 0,
    axis_view: Array.isArray(landscape?.axis_view?.axes) && landscape.axis_view.axes.length > 0,
    agent_priority: Array.isArray(landscape?.agentView?.priorityRepos) && landscape.agentView.priorityRepos.length > 0,
    tech_status: Array.isArray(landscape?.techStatus?.effectiveQueries) && landscape.techStatus.effectiveQueries.length > 0,
  };
  const hits = Object.values(checks).filter(Boolean).length;
  const measured = { ...checks, hits, total: Object.keys(checks).length };
  if (hits === 5) return buildAxis(2, measured);
  if (hits >= 3) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

function isPopulated(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return false;
}

function landscapeContextAlignment(landscape) {
  const agentView = landscape?.agentView ?? {};
  const hasMission = isPopulated(agentView.mission);
  const hasDeliverable = isPopulated(agentView.deliverable);
  const hasContext = isPopulated(agentView.context);
  const hits = [hasMission, hasDeliverable, hasContext].filter(Boolean).length;
  const measured = {
    has_mission: hasMission,
    has_deliverable: hasDeliverable,
    has_context: hasContext,
    hits,
  };
  if (hits === 3) return buildAxis(2, measured);
  if (hits === 2) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

function landscapeVisualCompleteness(landscape) {
  // Visual-Completeness misst die Sidenav-Lesbarkeit: Wie viele Cluster
  // landen im pattern_family=unknown-Fallback und bekommen damit als
  // Sidenav-Label den rohen Repo-Namen statt eines Kurz-Labels.
  const clusters = Array.isArray(landscape?.clusters) ? landscape.clusters : [];
  const fallbackLabels = clusters.filter((cluster) => {
    const family = cluster?.pattern_family;
    return !family || family === 'unknown';
  }).length;
  const fallbackRatio = clusters.length === 0 ? 1 : fallbackLabels / clusters.length;

  const axes = Array.isArray(landscape?.axis_view?.axes) ? landscape.axis_view.axes : [];
  const seen = new Set();
  const members = [];
  for (const axis of axes) {
    const axisMembers = Array.isArray(axis?.members) ? axis.members : [];
    for (const member of axisMembers) {
      const id = typeof member?.id === 'string' ? member.id : null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      members.push(member);
    }
  }
  const missingTopics = members.filter((member) => {
    const topics = member?.topics;
    return !Array.isArray(topics) || topics.length === 0;
  }).length;
  const noTopicsRatio = members.length === 0 ? null : missingTopics / members.length;

  const measured = {
    fallback_label_ratio: Number(fallbackRatio.toFixed(3)),
    no_topics_member_ratio: noTopicsRatio === null ? null : Number(noTopicsRatio.toFixed(3)),
    unique_axis_members: members.length,
  };
  // Schwellen aus docs/foundation/SCORE_STABILITY_PLAN.md §5 Phase 0:
  // < 5 % → 2, 5-20 % → 1, > 20 % → 0.
  if (fallbackRatio < 0.05) return buildAxis(2, measured);
  if (fallbackRatio <= 0.20) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

// ---------------------------------------------------------------------------
// Landscape Inhaltsachsen (Phase 6)
// ---------------------------------------------------------------------------

function landscapeProblemFit(landscape) {
  // Misst Token-Overlap zwischen problem-derived (query_seeds + approach_signature
  // + tech_tags) und den Repo-Keywords/Topics. Hoher Overlap = Pipeline hat
  // tatsaechlich themen-relevante Repos gefunden.
  const derived = landscape?.problem_derived;
  if (!derived) {
    return buildAxis(0, { reason: 'problem_derived_missing' }, { applicable: false });
  }
  const problemTokens = gatherTokens([
    derived.query_seeds,
    derived.approach_signature,
    derived.tech_tags,
  ]);
  const members = gatherAxisMembers(landscape);
  if (members.length === 0) {
    return buildAxis(0, { problem_token_count: problemTokens.size, member_count: 0 });
  }
  const repoTokens = new Set();
  for (const member of members) {
    for (const t of tokenize(typeof member?.description === 'string' ? member.description : '')) repoTokens.add(t);
    if (Array.isArray(member?.topics)) {
      for (const topic of member.topics) {
        for (const t of tokenize(typeof topic === 'string' ? topic : '')) repoTokens.add(t);
      }
    }
    if (Array.isArray(member?.keywords)) {
      for (const kw of member.keywords) {
        for (const t of tokenize(typeof kw === 'string' ? kw : '')) repoTokens.add(t);
      }
    }
  }
  const overlap = jaccard(problemTokens, repoTokens);
  const measured = {
    problem_token_count: problemTokens.size,
    repo_token_count: repoTokens.size,
    member_count: members.length,
    jaccard: Number(overlap.toFixed(3)),
  };
  if (overlap >= 0.15) return buildAxis(2, measured);
  if (overlap >= 0.05) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

function landscapeLabelFidelity(landscape) {
  // Pro Cluster: zaehle, wie sehr die Top-3-Tokens des Cluster-Labels
  // tatsaechlich die haeufigsten Tokens unter den Member-Keywords sind.
  // Hohe Konzentration = das Label dominiert wirklich den Cluster-Inhalt.
  const clusters = Array.isArray(landscape?.clusters) ? landscape.clusters : [];
  if (clusters.length === 0) {
    return buildAxis(0, { reason: 'no_clusters' });
  }
  const memberById = new Map();
  for (const member of gatherAxisMembers(landscape)) memberById.set(member.id, member);

  let perClusterCoverage = [];
  let analyzedClusters = 0;
  for (const cluster of clusters) {
    const labelTokens = new Set(tokenize(typeof cluster?.label === 'string' ? cluster.label : ''));
    if (labelTokens.size === 0) continue;
    const memberIds = Array.isArray(cluster?.member_ids) ? cluster.member_ids : [];
    const tokenCounts = new Map();
    let totalTokens = 0;
    for (const id of memberIds) {
      const member = memberById.get(id);
      if (!member) continue;
      const tokens = new Set();
      if (Array.isArray(member.keywords)) {
        for (const kw of member.keywords) for (const t of tokenize(typeof kw === 'string' ? kw : '')) tokens.add(t);
      }
      if (Array.isArray(member.topics)) {
        for (const topic of member.topics) for (const t of tokenize(typeof topic === 'string' ? topic : '')) tokens.add(t);
      }
      for (const t of tokens) {
        tokenCounts.set(t, (tokenCounts.get(t) ?? 0) + 1);
        totalTokens += 1;
      }
    }
    if (totalTokens === 0) continue;
    let labelTokenHits = 0;
    for (const labelToken of labelTokens) {
      labelTokenHits += tokenCounts.get(labelToken) ?? 0;
    }
    const coverage = labelTokenHits / totalTokens;
    perClusterCoverage.push(coverage);
    analyzedClusters += 1;
  }
  if (analyzedClusters === 0) {
    return buildAxis(0, { reason: 'no_resolvable_member_keywords' });
  }
  const meanCoverage = perClusterCoverage.reduce((sum, v) => sum + v, 0) / perClusterCoverage.length;
  const measured = {
    analyzed_clusters: analyzedClusters,
    mean_label_token_coverage: Number(meanCoverage.toFixed(3)),
    per_cluster_coverage: perClusterCoverage.map((v) => Number(v.toFixed(3))),
  };
  if (meanCoverage >= 0.40) return buildAxis(2, measured);
  if (meanCoverage >= 0.20) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

function landscapeClassificationConfidence(landscape) {
  // Nutzt pattern_family_summary aus Phase 2 (wenn aktiv): hoher
  // classified_ratio = Pipeline hat fuer fast alle Repos eine Pattern-
  // Family vergeben. Wenn Phase 2 nicht aktiv war, nicht anwendbar.
  const summary = landscape?.pattern_family_summary;
  if (!summary || typeof summary.classified_ratio !== 'number') {
    return buildAxis(0, { reason: 'phase2_summary_missing' }, { applicable: false });
  }
  const ratio = summary.classified_ratio;
  const measured = {
    strategy: summary.strategy ?? null,
    total: summary.total ?? null,
    classified: summary.classified ?? null,
    classified_ratio: Number(ratio.toFixed(3)),
  };
  if (ratio >= 0.95) return buildAxis(2, measured);
  if (ratio >= 0.70) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

function landscapeDecisionReadiness(landscape) {
  // Misst, ob der Report dem Nutzer konkrete naechste Schritte gibt.
  const agent = landscape?.agentView ?? {};
  const relations = landscape?.relation_counts ?? {};
  const checks = {
    priority_repos: Array.isArray(agent.priorityRepos) && agent.priorityRepos.length >= 2,
    coding_starter: !!agent.codingStarter && (
      typeof agent.codingStarter === 'object'
        ? Object.keys(agent.codingStarter).length > 0
        : (typeof agent.codingStarter === 'string' && agent.codingStarter.trim().length > 0)
    ),
    deliverable: Array.isArray(agent.deliverable)
      ? agent.deliverable.length >= 2
      : (typeof agent.deliverable === 'string' && agent.deliverable.trim().length > 0),
    uncertainties: Array.isArray(agent.uncertainties) && agent.uncertainties.length >= 1,
    alternatives: ((relations.divergent ?? 0) + (relations.adjacent ?? 0)) >= 2,
  };
  const hits = Object.values(checks).filter(Boolean).length;
  const measured = { ...checks, hits, total: Object.keys(checks).length };
  if (hits >= 5) return buildAxis(2, measured);
  if (hits >= 3) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

export function scoreLandscape(landscape) {
  const structureAxes = {
    'cluster-diversity': landscapeClusterDiversity(landscape),
    'pattern-family-coverage': landscapePatternFamilyCoverage(landscape),
    'lens-richness': landscapeLensRichness(landscape),
    'context-alignment': landscapeContextAlignment(landscape),
    'visual-completeness': landscapeVisualCompleteness(landscape),
  };
  const contentAxes = {
    'problem-fit': landscapeProblemFit(landscape),
    'label-fidelity': landscapeLabelFidelity(landscape),
    'classification-confidence': landscapeClassificationConfidence(landscape),
    'decision-readiness': landscapeDecisionReadiness(landscape),
  };
  const totals = buildTotals(structureAxes, contentAxes);
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'landscape',
    total: totals.combined,
    totals,
    axes: { structure: structureAxes, content: contentAxes },
    meta: {
      run_id: landscape?.run_id ?? null,
      problem: landscape?.problem?.slug ?? landscape?.problem ?? null,
      project: landscape?.project?.key ?? landscape?.project ?? null,
      generated_at: landscape?.generated_at ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Review axes
// ---------------------------------------------------------------------------

function reviewKind(manifest) {
  return manifest?.review ?? null;
}

function reviewClusterDiversity(manifest) {
  const review = reviewKind(manifest);
  const itemCount = Array.isArray(review?.items) ? review.items.length : 0;
  const strongestPatterns = Array.isArray(review?.strongestPatterns) ? review.strongestPatterns.length : 0;
  const measured = {
    item_count: itemCount,
    strongest_patterns: strongestPatterns,
  };
  if (itemCount === 0) return buildAxis(0, measured);
  if (itemCount >= 3 && strongestPatterns >= 2) return buildAxis(2, measured);
  if (itemCount >= 2) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

function reviewPatternFamilyCoverage(manifest) {
  const review = reviewKind(manifest);
  const items = Array.isArray(review?.items) ? review.items : [];
  if (items.length === 0) {
    return buildAxis(0, { item_count: 0, unknown_ratio: null });
  }
  const unknown = items.filter((item) => {
    const family = item?.pattern_family ?? item?.patternFamily;
    return !family || family === 'unknown';
  }).length;
  const ratio = unknown / items.length;
  const measured = {
    item_count: items.length,
    unknown_items: unknown,
    unknown_ratio: Number(ratio.toFixed(3)),
  };
  if (ratio < 0.10) return buildAxis(2, measured);
  if (ratio <= 0.30) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

function reviewLensRichness(manifest) {
  const review = reviewKind(manifest);
  const checks = {
    top_items: Array.isArray(review?.topItems) && review.topItems.length > 0,
    strongest_patterns: Array.isArray(review?.strongestPatterns) && review.strongestPatterns.length > 0,
    riskiest_items: Array.isArray(review?.riskiestItems) && review.riskiestItems.length > 0,
    main_layers: Array.isArray(review?.coverage?.mainLayers) && review.coverage.mainLayers.length > 0,
    run_gap_signals: Array.isArray(review?.runGapSignals) && review.runGapSignals.length > 0,
  };
  const hits = Object.values(checks).filter(Boolean).length;
  const measured = { ...checks, hits, total: Object.keys(checks).length };
  if (hits === 5) return buildAxis(2, measured);
  if (hits >= 3) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

function reviewContextAlignment(manifest) {
  const review = reviewKind(manifest);
  const hasBinding = !!review?.binding && typeof review.binding === 'object'
    && Object.keys(review.binding).length > 0;
  const hasProfile = !!review?.projectProfileSummary && typeof review.projectProfileSummary === 'object'
    && Object.keys(review.projectProfileSummary).length > 0;
  const coverage = review?.coverage;
  const hasCoverage = !!coverage && (
    (Array.isArray(coverage.uncoveredCapabilities) && coverage.uncoveredCapabilities.length > 0)
    || (Array.isArray(coverage.capabilities) && coverage.capabilities.length > 0)
  );
  const hits = [hasBinding, hasProfile, hasCoverage].filter(Boolean).length;
  const measured = {
    has_binding: hasBinding,
    has_project_profile: hasProfile,
    has_coverage: hasCoverage,
    hits,
  };
  if (hits === 3) return buildAxis(2, measured);
  if (hits === 2) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

function reviewVisualCompleteness(manifest) {
  const review = reviewKind(manifest);
  const itemCount = Array.isArray(review?.items) ? review.items.length : 0;
  const mainLayerCount = Array.isArray(review?.coverage?.mainLayers) ? review.coverage.mainLayers.length : 0;
  const watchlistCount = typeof review?.watchlistCount === 'number' ? review.watchlistCount : 0;
  const measured = {
    item_count: itemCount,
    main_layer_count: mainLayerCount,
    watchlist_count: watchlistCount,
  };
  if (itemCount > 0 && mainLayerCount > 0) return buildAxis(2, measured);
  if (itemCount > 0) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

// ---------------------------------------------------------------------------
// Review Inhaltsachsen (Phase 6)
// ---------------------------------------------------------------------------

function reviewProblemFit(manifest) {
  // Misst, ob die items zum Projektkontext passen: ratio of items mit
  // hohem projectFit-Score zum total. Wenn keine items: nicht anwendbar.
  const review = reviewKind(manifest);
  const items = Array.isArray(review?.items) ? review.items : [];
  if (items.length === 0) {
    return buildAxis(0, { reason: 'no_items' }, { applicable: false });
  }
  const highFit = items.filter((item) => {
    const band = item?.projectFitBand;
    const score = Number(item?.projectFitScore ?? 0);
    return band === 'high' || score >= 60;
  }).length;
  const ratio = highFit / items.length;
  const measured = {
    item_count: items.length,
    high_fit_items: highFit,
    high_fit_ratio: Number(ratio.toFixed(3)),
  };
  if (ratio >= 0.50) return buildAxis(2, measured);
  if (ratio >= 0.20) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

function reviewLabelFidelity(manifest) {
  // Review hat keine Cluster — wir messen stattdessen, wie viele items
  // mindestens eine matchedCapability haben. Hoch = items werden gegen
  // den Projektkontext gemappt, nicht nur als rohe Funde gelistet.
  const review = reviewKind(manifest);
  const items = Array.isArray(review?.items) ? review.items : [];
  if (items.length === 0) {
    return buildAxis(0, { reason: 'no_items' }, { applicable: false });
  }
  const withMatch = items.filter((item) => Array.isArray(item?.matchedCapabilities) && item.matchedCapabilities.length >= 1).length;
  const ratio = withMatch / items.length;
  const measured = {
    item_count: items.length,
    items_with_capability_match: withMatch,
    match_ratio: Number(ratio.toFixed(3)),
  };
  if (ratio >= 0.70) return buildAxis(2, measured);
  if (ratio >= 0.40) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

function reviewClassificationConfidence(manifest) {
  // Wie viele items haben pattern_family/main_layer? Hoch = die Pipeline
  // hat tatsaechlich klassifiziert, nicht nur Funde aufgereiht.
  const review = reviewKind(manifest);
  const items = Array.isArray(review?.items) ? review.items : [];
  if (items.length === 0) {
    return buildAxis(0, { reason: 'no_items' }, { applicable: false });
  }
  const classified = items.filter((item) => {
    const family = item?.patternFamily ?? item?.pattern_family;
    return typeof family === 'string' && family.trim().length > 0 && family !== 'unknown';
  }).length;
  const ratio = classified / items.length;
  const measured = {
    item_count: items.length,
    classified_items: classified,
    classified_ratio: Number(ratio.toFixed(3)),
  };
  if (ratio >= 0.95) return buildAxis(2, measured);
  if (ratio >= 0.70) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

function reviewDecisionReadiness(manifest) {
  const review = reviewKind(manifest);
  const items = Array.isArray(review?.items) ? review.items : [];
  const withDisposition = items.filter((item) => {
    const disp = item?.reviewDisposition;
    return typeof disp === 'string' && disp.trim().length > 0;
  }).length;
  const checks = {
    has_top_items: Array.isArray(review?.topItems) && review.topItems.length >= 1,
    has_riskiest_or_gap_signals:
      (Array.isArray(review?.riskiestItems) && review.riskiestItems.length >= 1)
      || (Array.isArray(review?.runGapSignals) && review.runGapSignals.length >= 1),
    items_have_disposition: items.length === 0 ? false : (withDisposition / items.length) >= 0.5,
    has_next_steps: Array.isArray(review?.nextSteps) && review.nextSteps.length >= 2,
  };
  const hits = Object.values(checks).filter(Boolean).length;
  const measured = { ...checks, items_with_disposition: withDisposition, item_count: items.length, hits };
  if (hits >= 4) return buildAxis(2, measured);
  if (hits >= 2) return buildAxis(1, measured);
  return buildAxis(0, measured);
}

export function scoreReview(manifest) {
  const structureAxes = {
    'cluster-diversity': reviewClusterDiversity(manifest),
    'pattern-family-coverage': reviewPatternFamilyCoverage(manifest),
    'lens-richness': reviewLensRichness(manifest),
    'context-alignment': reviewContextAlignment(manifest),
    'visual-completeness': reviewVisualCompleteness(manifest),
  };
  const contentAxes = {
    'problem-fit': reviewProblemFit(manifest),
    'label-fidelity': reviewLabelFidelity(manifest),
    'classification-confidence': reviewClassificationConfidence(manifest),
    'decision-readiness': reviewDecisionReadiness(manifest),
  };
  const totals = buildTotals(structureAxes, contentAxes);
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'review',
    total: totals.combined,
    totals,
    axes: { structure: structureAxes, content: contentAxes },
    meta: {
      run_id: manifest?.runId ?? null,
      project: manifest?.projectKey ?? manifest?.review?.projectKey ?? null,
      report_path: manifest?.reportPath ?? null,
      created_at: manifest?.createdAt ?? null,
      input_url_count: manifest?.inputUrlCount ?? null,
      watchlist_count: manifest?.review?.watchlistCount ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Auto-detect entry
// ---------------------------------------------------------------------------

function looksLikeLandscape(json) {
  return json && Array.isArray(json?.clusters) && Array.isArray(json?.queryPlans);
}

function looksLikeReviewManifest(json) {
  return json && typeof json?.reviewScope === 'string' && json?.review && typeof json.review === 'object';
}

export function scoreFromJson(json) {
  if (looksLikeLandscape(json)) return scoreLandscape(json);
  if (looksLikeReviewManifest(json)) return scoreReview(json);
  const error = new Error('scoreFromJson: input is neither a landscape.json nor a review manifest.json');
  error.code = 'UNSUPPORTED_RUN_KIND';
  throw error;
}

export {
  AXIS_NAMES,
  STRUCTURE_AXIS_NAMES,
  CONTENT_AXIS_NAMES,
  SCHEMA_VERSION,
};
