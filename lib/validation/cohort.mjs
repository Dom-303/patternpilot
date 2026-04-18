import { normalizeGithubUrl } from "../queue.mjs";

export const DEFAULT_VALIDATION_COHORT = [
  {
    category: "AI / LLM / Evaluation",
    repoUrl: "https://github.com/openai/openai-cookbook"
  },
  {
    category: "AI / LLM / Evaluation",
    repoUrl: "https://github.com/openai/simple-evals"
  },
  {
    category: "AI / LLM / Evaluation",
    repoUrl: "https://github.com/langchain-ai/langchain"
  },
  {
    category: "AI / LLM / Evaluation",
    repoUrl: "https://github.com/microsoft/markitdown"
  },
  {
    category: "Workflow / Automation / Orchestration",
    repoUrl: "https://github.com/City-Bureau/city-scrapers"
  },
  {
    category: "Workflow / Automation / Orchestration",
    repoUrl: "https://github.com/apache/airflow"
  },
  {
    category: "Workflow / Automation / Orchestration",
    repoUrl: "https://github.com/n8n-io/n8n"
  },
  {
    category: "Workflow / Automation / Orchestration",
    repoUrl: "https://github.com/home-assistant/core"
  },
  {
    category: "Platforms / Product Backends",
    repoUrl: "https://github.com/supabase/supabase"
  },
  {
    category: "Platforms / Product Backends",
    repoUrl: "https://github.com/calcom/cal.com"
  },
  {
    category: "Platforms / Product Backends",
    repoUrl: "https://github.com/strapi/strapi"
  },
  {
    category: "Platforms / Product Backends",
    repoUrl: "https://github.com/directus/directus"
  },
  {
    category: "Platforms / Product Backends",
    repoUrl: "https://github.com/apache/superset"
  },
  {
    category: "Platforms / Product Backends",
    repoUrl: "https://github.com/AppFlowy-IO/AppFlowy"
  }
];

function toSentenceCase(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function freqMapToSortedEntries(items) {
  const counts = new Map();
  for (const item of items) {
    const key = String(item ?? "").trim();
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

export function normalizeValidationCohort(entries, options = {}) {
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : null;
  const normalized = [];

  for (const entry of entries ?? []) {
    const repoUrl = entry?.repoUrl ?? entry?.url ?? null;
    if (!repoUrl) {
      continue;
    }
    const repo = normalizeGithubUrl(repoUrl);
    normalized.push({
      category: String(entry.category ?? "General").trim() || "General",
      repoUrl: repo.normalizedRepoUrl,
      repoRef: `${repo.owner}/${repo.name}`,
      owner: repo.owner,
      name: repo.name,
      slug: repo.slug,
      label: String(entry.label ?? `${repo.owner}/${repo.name}`).trim() || `${repo.owner}/${repo.name}`
    });
  }

  return limit ? normalized.slice(0, limit) : normalized;
}

export function buildValidationCohortReport({
  runId,
  generatedAt,
  manifestLabel,
  results
}) {
  const safeResults = Array.isArray(results) ? results : [];
  const statusCounts = {
    passed: safeResults.filter((item) => item.validationStatus === "passed").length,
    passedWithFollowups: safeResults.filter((item) => item.validationStatus === "passed_with_followups").length,
    needsFix: safeResults.filter((item) => item.validationStatus === "needs_fix").length,
    failed: safeResults.filter((item) => item.validationStatus === "failed").length
  };
  const fixCount = safeResults.filter((item) => item.needsFix).length;
  const issueTags = freqMapToSortedEntries(safeResults.flatMap((item) => item.issueTags ?? []));
  const strengthTags = freqMapToSortedEntries(safeResults.flatMap((item) => item.strengthTags ?? []));
  const categories = freqMapToSortedEntries(safeResults.map((item) => item.category));

  const topIssuePatterns = issueTags.slice(0, 5).map(([tag, count]) => ({
    tag,
    count
  }));
  const topStrengthPatterns = strengthTags.slice(0, 5).map(([tag, count]) => ({
    tag,
    count
  }));

  return {
    runId,
    generatedAt,
    manifestLabel,
    totalRepos: safeResults.length,
    statuses: statusCounts,
    fixCount,
    categories: categories.map(([category, count]) => ({ category, count })),
    topIssuePatterns,
    topStrengthPatterns,
    results: safeResults
  };
}

export function renderValidationCohortSummary(report) {
  const lines = [
    "# Patternpilot Validation Cohort",
    "",
    `- run_id: ${report.runId}`,
    `- generated_at: ${report.generatedAt}`,
    `- manifest: ${report.manifestLabel}`,
    `- repos_validated: ${report.totalRepos}`,
    `- passed: ${report.statuses.passed}`,
    `- passed_with_followups: ${report.statuses.passedWithFollowups}`,
    `- needs_fix: ${report.statuses.needsFix}`,
    `- failed: ${report.statuses.failed}`,
    `- fixes_needed: ${report.fixCount}`,
    "",
    "## Category Coverage",
    "",
    ...(report.categories.length > 0
      ? report.categories.map((item) => `- ${item.category}: ${item.count}`)
      : ["- none"]),
    "",
    "## Top Issue Patterns",
    "",
    ...(report.topIssuePatterns.length > 0
      ? report.topIssuePatterns.map((item) => `- ${item.tag}: ${item.count}`)
      : ["- none"]),
    "",
    "## Top Strength Patterns",
    "",
    ...(report.topStrengthPatterns.length > 0
      ? report.topStrengthPatterns.map((item) => `- ${item.tag}: ${item.count}`)
      : ["- none"]),
    "",
    "## Repo Results",
    ""
  ];

  for (const result of report.results) {
    lines.push(`### ${result.repoRef}`);
    lines.push(`- category: ${result.category}`);
    lines.push(`- validation_status: ${result.validationStatus}`);
    lines.push(`- setup: ${result.setupStatus}`);
    lines.push(`- bootstrap: ${result.bootstrapStatus}`);
    lines.push(`- intake: ${result.intakeStatus}`);
    lines.push(`- review: ${result.reviewStatus}`);
    lines.push(`- readiness: ${result.readinessStatus}`);
    lines.push(`- governance: ${result.governanceStatus ?? "-"}`);
    lines.push(`- fix_needed: ${result.needsFix ? "yes" : "no"}`);
    lines.push(`- biggest_strength: ${result.biggestStrength}`);
    lines.push(`- biggest_break: ${result.biggestBreak}`);
    lines.push(`- next_action: ${result.nextAction ?? "-"}`);
    lines.push("");
  }

  return lines.join("\n");
}

export function buildValidationCloseoutMarkdown(report) {
  const passedEnough = report.statuses.failed === 0 && report.statuses.needsFix === 0;
  const statusLabel = passedEnough ? "completed_with_stable_core" : "completed_with_followup_fixes";
  const headlineIssue = report.topIssuePatterns[0]?.tag ?? "no_structural_issue_pattern";
  const headlineStrength = report.topStrengthPatterns[0]?.tag ?? "golden_path_clear";

  return `# Phase 4 Validation Closeout

- run_id: ${report.runId}
- generated_at: ${report.generatedAt}
- manifest: ${report.manifestLabel}
- repos_validated: ${report.totalRepos}
- status: ${statusLabel}
- passed: ${report.statuses.passed}
- passed_with_followups: ${report.statuses.passedWithFollowups}
- needs_fix: ${report.statuses.needsFix}
- failed: ${report.statuses.failed}
- fixes_needed: ${report.fixCount}

## Kurzfazit

Phase 4 ist als breite Fremdprojekt-Welle gelaufen.
Der Produktkern wurde nicht nur an einem einzelnen Pilot, sondern gegen ${report.totalRepos} oeffentliche Repos aus mehreren Repo-Familien geprueft.

- staerkstes positives Muster: ${headlineStrength}
- staerkstes negatives Muster: ${headlineIssue}

## Was diese Welle gezeigt hat

- Bootstrap, Watchlist-Sync, Review und Readiness koennen kontrolliert in isolierten Fremdprojekt-Workspaces durchlaufen werden.
- Die Kohortenvalidierung ist jetzt selbst ein Produktwerkzeug statt einer einmaligen manuellen Uebung.
- Offene Kanten werden pro Repo sichtbar als klarer Fix- oder Follow-up-Bedarf gesammelt statt diffus im Raum zu bleiben.

## Ergebnis fuer den Abschlussplan

- Phase 4 gilt als erledigt.
- Der naechste Schritt ist Phase 5: verbleibende Restpunkte bewusst fixen, dokumentieren oder akzeptieren.
`;
}

export function buildValidationRepoAssessment(input) {
  const repoRef = input.repoRef;
  const intakeItems = input.intakeItems ?? 0;
  const enrichmentFailed = input.enrichmentFailed ?? 0;
  const reviewItems = input.reviewItems ?? 0;
  const missingUrls = input.missingUrls ?? 0;
  const readinessOverall = input.readinessOverallStatus ?? "unknown";
  const governanceStatus = input.governanceStatus ?? "unknown";
  const issueTags = [];
  const strengthTags = [];

  let setupStatus = "ok";
  let bootstrapStatus = "clear";
  let intakeStatus = "sensible";
  let reviewStatus = "usable";
  let readinessStatus = "helpful";
  let validationStatus = "passed";
  let biggestBreak = "No structural break found in this repo path.";
  let biggestStrength = "The golden path stayed coherent from bootstrap through readiness.";
  let nextAction = input.readinessNextAction ?? input.governanceNextAction ?? null;

  if (input.errorStage) {
    validationStatus = input.errorStage === "bootstrap" ? "failed" : "needs_fix";
    setupStatus = input.errorStage === "bootstrap" ? "failed" : "ok";
    bootstrapStatus = input.errorStage === "bootstrap" ? "failed" : "clear";
    intakeStatus = ["sync", "review", "readiness", "governance"].includes(input.errorStage) ? "blocked" : "sensible";
    reviewStatus = ["review", "readiness", "governance"].includes(input.errorStage) ? "blocked" : "usable";
    readinessStatus = ["readiness", "governance"].includes(input.errorStage) ? "blocked" : "helpful";
    issueTags.push(`${input.errorStage}_failed`);
    biggestBreak = toSentenceCase(input.errorMessage ?? `${input.errorStage} failed for ${repoRef}.`);
    biggestStrength = input.completedStage === "bootstrap"
      ? "Bootstrap still completed before the later failure surfaced."
      : "The failure surfaced as a bounded product error instead of a silent break.";
    return {
      ...input,
      setupStatus,
      bootstrapStatus,
      intakeStatus,
      reviewStatus,
      readinessStatus,
      validationStatus,
      biggestBreak,
      biggestStrength,
      needsFix: true,
      nextAction,
      issueTags,
      strengthTags
    };
  }

  if (intakeItems === 0) {
    intakeStatus = "empty";
    validationStatus = "needs_fix";
    issueTags.push("intake_empty");
    biggestBreak = "The repo reached the watchlist flow but produced no intake items.";
  } else if (enrichmentFailed > 0) {
    intakeStatus = "degraded";
    validationStatus = "needs_fix";
    issueTags.push("intake_enrichment_failed");
    biggestBreak = "GitHub enrichment failed during intake, so the dossier quality degraded.";
  } else {
    strengthTags.push("intake_stable");
  }

  if (reviewItems === 0) {
    reviewStatus = "weak";
    validationStatus = "needs_fix";
    issueTags.push("review_empty");
    biggestBreak = "Review completed but did not produce a usable comparison item.";
  } else if (missingUrls > 0) {
    reviewStatus = "noisy";
    validationStatus = validationStatus === "failed" ? validationStatus : "needs_fix";
    issueTags.push("review_missing_urls");
    biggestBreak = "Review needed manual URL coverage before it felt complete.";
  } else {
    strengthTags.push("review_usable");
  }

  if (readinessOverall === "not_ready" && governanceStatus === "baseline_required" && input.readinessNextAction) {
    readinessStatus = "guided_followup";
    if (validationStatus === "passed") {
      validationStatus = "passed_with_followups";
    }
    issueTags.push("governance_baseline_required");
    biggestBreak = biggestBreak === "No structural break found in this repo path."
      ? "No structural break found. Readiness still expects one deliberate baseline run in this fresh workspace."
      : biggestBreak;
  } else if (readinessOverall === "not_ready") {
    readinessStatus = "weak";
    validationStatus = validationStatus === "failed" ? validationStatus : "needs_fix";
    issueTags.push("readiness_not_ready");
    biggestBreak = "Product readiness stayed too weak after the repo flow completed.";
  } else if (!input.readinessNextAction) {
    readinessStatus = "technical_only";
    validationStatus = validationStatus === "passed" ? "passed_with_followups" : validationStatus;
    issueTags.push("readiness_no_next_action");
  } else {
    strengthTags.push("readiness_helpful");
  }

  if (governanceStatus === "baseline_required" || governanceStatus === "manual_gate" || governanceStatus === "limited_unattended") {
    if (validationStatus === "passed") {
      validationStatus = "passed_with_followups";
    }
    issueTags.push(`governance_${governanceStatus}`);
    biggestBreak = validationStatus === "passed_with_followups" && biggestBreak === "No structural break found in this repo path."
      ? "Governance stayed intentionally conservative after the first broad validation pass."
      : biggestBreak;
  } else {
    strengthTags.push("governance_consistent");
  }

  if (strengthTags.includes("intake_stable") && strengthTags.includes("review_usable") && strengthTags.includes("readiness_helpful")) {
    biggestStrength = "The full golden path stayed clear: sync, review, readiness and next action all made sense.";
    strengthTags.push("golden_path_clear");
  } else if (strengthTags.includes("review_usable")) {
    biggestStrength = "Review stayed usable across this repo shape.";
  } else if (strengthTags.includes("intake_stable")) {
    biggestStrength = "Intake stayed stable for this repo shape.";
  }

  return {
    ...input,
    setupStatus,
    bootstrapStatus,
    intakeStatus,
    reviewStatus,
    readinessStatus,
    validationStatus,
    biggestBreak,
    biggestStrength,
    needsFix: validationStatus === "needs_fix" || validationStatus === "failed",
    nextAction,
    issueTags: [...new Set(issueTags)],
    strengthTags: [...new Set(strengthTags)]
  };
}
