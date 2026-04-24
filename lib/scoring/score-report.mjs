// Phase 0 scorer for Patternpilot Landscape- und Review-Reports.
//
// Diese Datei ist rein funktional: sie nimmt bereits geparste JSON-Objekte
// entgegen und gibt deterministische Scores zurueck. Keine File-I/O, keine
// Live-API-Calls. Das erlaubt reproduzierbare Messungen auf gefreezten
// Fixtures ueber Phase 1-4 hinweg.
//
// Score-Modell (siehe docs/foundation/SCORE_STABILITY_PLAN.md §5, Phase 0):
// Fuenf Achsen zu je 0-2 Punkten, Summe = Gesamt-Score 0-10.

const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const AXIS_NAMES = [
  'cluster-diversity',
  'pattern-family-coverage',
  'lens-richness',
  'context-alignment',
  'visual-completeness',
];

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

function buildAxis(score, measured) {
  return { score: clampAxis(score), measured };
}

function sumAxes(axes) {
  return AXIS_NAMES.reduce((sum, name) => sum + (axes[name]?.score ?? 0), 0);
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

export function scoreLandscape(landscape) {
  const axes = {
    'cluster-diversity': landscapeClusterDiversity(landscape),
    'pattern-family-coverage': landscapePatternFamilyCoverage(landscape),
    'lens-richness': landscapeLensRichness(landscape),
    'context-alignment': landscapeContextAlignment(landscape),
    'visual-completeness': landscapeVisualCompleteness(landscape),
  };
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'landscape',
    total: sumAxes(axes),
    axes,
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

export function scoreReview(manifest) {
  const axes = {
    'cluster-diversity': reviewClusterDiversity(manifest),
    'pattern-family-coverage': reviewPatternFamilyCoverage(manifest),
    'lens-richness': reviewLensRichness(manifest),
    'context-alignment': reviewContextAlignment(manifest),
    'visual-completeness': reviewVisualCompleteness(manifest),
  };
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'review',
    total: sumAxes(axes),
    axes,
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

export { AXIS_NAMES, SCHEMA_VERSION };
