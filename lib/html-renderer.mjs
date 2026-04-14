import { uniqueStrings } from "./utils.mjs";
import { resolveReportView, resolveDiscoveryProfile } from "./constants.mjs";
import { classifyLicense } from "./classification.mjs";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

export { classifyLicense } from "./classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_BASE64 = `data:image/png;base64,${readFileSync(path.join(__dirname, "../assets/logo-icon.png")).toString("base64")}`;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtmlList(items, emptyText = "none") {
  if (!items || items.length === 0) {
    return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  }
  return `<ul class="bullets">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderHtmlStatCards(stats) {
  return stats
    .map(
      (stat) => {
        const isNumeric = typeof stat.value === "number" && Number.isFinite(stat.value) && stat.value >= 0;
        const countAttr = isNumeric ? ` data-count="${stat.value}"` : "";
        const secondaryClass = stat.primary === false ? " secondary" : "";
        return `<article class="stat-card${secondaryClass}">
  <span class="stat-label">${escapeHtml(stat.label)}</span>
  <strong class="stat-value"${countAttr}>${escapeHtml(stat.value)}</strong>
</article>`;
      }
    )
    .join("");
}

function renderHtmlSection(title, body, tone = "default", sectionId = "") {
  const idAttr = sectionId ? ` id="${escapeHtml(sectionId)}"` : "";
  return `<section class="section-card ${tone}"${idAttr}>
  <header class="section-head">
    <h2>${escapeHtml(title)}</h2>
  </header>
  <div class="section-body">
    ${body}
  </div>
</section>`;
}

function renderBadge(value, tone = "neutral") {
  return `<span class="badge ${tone}">${escapeHtml(value)}</span>`;
}

function slugifyForId(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dispositionTone(value) {
  if (value === "intake_now") {
    return "accent";
  }
  if (value === "review_queue") {
    return "info";
  }
  if (value === "observe_only") {
    return "warn";
  }
  return "neutral";
}

function fitTone(value) {
  if (value === "high") {
    return "accent";
  }
  if (value === "medium") {
    return "info";
  }
  if (value === "low") {
    return "warn";
  }
  return "neutral";
}

function renderHeroSection({ reportType, projectKey, createdAt, subtitle, candidateCount }) {
  const dateStr = createdAt.slice(0, 10);
  const typeLabel = reportType === "discovery"
    ? "DISCOVERY REPORT"
    : reportType === "on_demand"
      ? "ON-DEMAND RUN"
      : "WATCHLIST REVIEW";
  return `<header class="hero" id="hero">
  <img src="${LOGO_BASE64}" alt="Patternpilot" class="hero-logo">
  <h1 class="hero-brand">Pattern<span class="pilot">pilot</span></h1>
  <p class="hero-subtitle">Repo Intelligence System</p>
  <div class="hero-divider"></div>
  <p class="hero-claim">
    <span class="word discover">Discover.</span>
    <span class="word">Align.</span>
    <span class="word">Decide.</span>
  </p>
  <div class="hero-project-card">
    <div class="hero-project-type">${escapeHtml(typeLabel)}</div>
    <div class="hero-project-name">${escapeHtml(projectKey)}</div>
    <div class="hero-project-meta">${escapeHtml(dateStr)} &middot; ${escapeHtml(subtitle)} &middot; ${escapeHtml(String(candidateCount))} candidates</div>
  </div>
  <button class="pdf-export-btn" onclick="window.print()" type="button">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
    Export PDF
  </button>
</header>`;
}

function renderStickyNav(sections) {
  const colorMap = {
    stats: "var(--cyan)",
    recommendations: "var(--green)",
    candidate: "var(--magenta)",
    compared: "var(--magenta)",
    coverage: "var(--orange)",
    context: "var(--blue)",
    matrix: "var(--ink-muted)",
    errors: "var(--orange)",
    risks: "var(--orange)",
    lenses: "var(--blue)",
    missing: "var(--ink-muted)"
  };
  const items = sections
    .filter((s) => s.id && s.navLabel)
    .map((s) => {
      const colorKey = Object.keys(colorMap).find((k) => s.id.includes(k)) || "";
      const dotColor = colorMap[colorKey] || "var(--ink-muted)";
      return `<a href="#${escapeHtml(s.id)}" class="sticky-nav-item"><span class="sticky-nav-dot" style="background:${dotColor}"></span>${escapeHtml(s.navLabel)}</a>`;
    })
    .join("");
  return `<nav class="sticky-nav" id="sticky-nav">
  <span class="sticky-nav-brand">Pattern<span class="pilot">pilot</span></span>
  <div class="sticky-nav-items">${items}</div>
</nav>`;
}

function mapDispositionToType(disposition) {
  if (disposition === "intake_now") return { label: "Adopt", tone: "accent" };
  if (disposition === "review_queue") return { label: "Study", tone: "info" };
  if (disposition === "observe_only") return { label: "Watch", tone: "warn" };
  return { label: "Defer", tone: "neutral" };
}

function truncateText(text, maxLen) {
  const str = String(text ?? "");
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}

const DATA_STATE_WARN_THRESHOLD = 0.3;

function getRunRoot({ reportType, runRoot, discovery, review }) {
  return runRoot ?? (reportType === "discovery" ? discovery : review);
}

function hasDecisionRunFields(root) {
  return Boolean(
    root &&
      root.reportSchemaVersion === 2 &&
      root.runConfidence != null &&
      root.runConfidenceReason != null &&
      root.itemsDataStateSummary != null
  );
}

function getCandidateName(candidate) {
  if (!candidate) {
    return "No candidates available";
  }
  if (candidate.full_name) {
    return candidate.full_name;
  }
  if (candidate.repo?.owner && candidate.repo?.name) {
    return `${candidate.repo.owner}/${candidate.repo.name}`;
  }
  if (candidate.repoRef) {
    return candidate.repoRef;
  }
  return candidate.repo?.full_name ?? "unknown";
}

function getCandidateDisposition(candidate) {
  return candidate?.discoveryDisposition ?? candidate?.reviewDisposition ?? "unknown";
}

function getCandidateDecisionSummary(candidate) {
  const summary =
    candidate?.decisionSummary ??
    candidate?.suggestedNextStep ??
    candidate?.possibleImplication ??
    candidate?.reason ??
    candidate?.learningForEventbaer ??
    "";
  return summary ? String(summary) : "Review manually.";
}

function getCandidateFitBand(candidate) {
  return candidate?.projectFitBand ?? candidate?.projectAlignment?.fitBand ?? "unknown";
}

function getCandidateFitScore(candidate) {
  return candidate?.projectFitScore ?? candidate?.projectAlignment?.fitScore ?? null;
}

function getCandidateValueScore(candidate) {
  return candidate?.valueScore ?? null;
}

function getCandidateEffortScore(candidate) {
  return candidate?.effortScore ?? null;
}

function getCandidateMatchedCapabilities(candidate) {
  return (
    candidate?.matchedCapabilities ??
    candidate?.projectAlignment?.matchedCapabilities ??
    []
  );
}

function getCandidateNetScore(candidate) {
  return (Number(candidate?.valueScore ?? 0) || 0) - (Number(candidate?.effortScore ?? 0) || 0);
}

export function renderLicenseTag(licenseString) {
  const raw =
    typeof licenseString === "object" && licenseString
      ? licenseString.spdx_id ?? licenseString.name ?? ""
      : String(licenseString ?? "");
  const category = classifyLicense(licenseString);
  const label = category === "unknown" ? "License ?" : raw.trim() || "License ?";
  return `<span class="action-item__license license-${category}">${escapeHtml(label)}</span>`;
}

export function renderDataStateWarnBanner(stateSummary) {
  const summary = stateSummary ?? {};
  const complete = Number(summary.complete ?? 0);
  const fallback = Number(summary.fallback ?? 0);
  const stale = Number(summary.stale ?? 0);
  const total = complete + fallback + stale;
  if (total <= 0) {
    return "";
  }
  const nonComplete = fallback + stale;
  const ratio = nonComplete / total;
  if (ratio <= DATA_STATE_WARN_THRESHOLD) {
    return "";
  }
  const percent = Math.round(ratio * 100);
  return `<div class="section-warn">
  <strong>Engine-Daten nur teilweise vollstaendig.</strong>
  ${fallback} Items mit Fallback-Bewertung, ${stale} Items gegen alte Regelversion bewertet (${percent}% nicht vollstaendig).
  Die Top-Empfehlungen koennen sich nach einem frischen Intake-Lauf verschieben.
</div>`;
}

export function sortAdoptGroup(items = []) {
  items.sort((a, b) => {
    const netDiff = getCandidateNetScore(b) - getCandidateNetScore(a);
    if (netDiff !== 0) {
      return netDiff;
    }

    const fitDiff = (Number(getCandidateFitScore(b) ?? 0) || 0) - (Number(getCandidateFitScore(a) ?? 0) || 0);
    if (fitDiff !== 0) {
      return fitDiff;
    }

    const capDiff = getCandidateMatchedCapabilities(b).length - getCandidateMatchedCapabilities(a).length;
    if (capDiff !== 0) {
      return capDiff;
    }

    const nameA = getCandidateName(a);
    const nameB = getCandidateName(b);
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
  return items;
}

function renderTopRecommendations(recommendations, candidates) {
  if (!recommendations || recommendations.length === 0) {
    return `<p class="empty">No recommendations yet.</p>`;
  }
  return `<div class="recommendations">${recommendations.map((rec, i) => {
    const [repoRef, ...actionParts] = rec.split(": ");
    const action = actionParts.join(": ") || "Review manually.";
    const slug = slugifyForId(repoRef);

    const candidate = (candidates || []).find((c) => {
      const name = getCandidateName(c);
      return name === repoRef;
    });
    const disposition = getCandidateDisposition(candidate);
    const type = mapDispositionToType(disposition);

    return `<a href="#repo-${slug}" class="rec-card">
  <span class="rec-rank">${i + 1}</span>
  <div class="rec-text">
    <div class="rec-name">${escapeHtml(repoRef)}</div>
    <div class="rec-action">${escapeHtml(truncateText(action, 120))}</div>
  </div>
  ${renderBadge(type.label, type.tone)}
  <span class="rec-arrow">&rarr;</span>
</a>`;
  }).join("")}</div>`;
}

function renderCollapsibleSection(title, body, { tone = "default", sectionId = "", navLabel = "", collapsed = false } = {}) {
  const idAttr = sectionId ? ` id="${escapeHtml(sectionId)}"` : "";
  const collapsedClass = collapsed ? " collapsed" : "";
  return `<section class="section-card collapsible ${tone}${collapsedClass}"${idAttr}>
  <header class="section-head">
    <h2>${escapeHtml(title)}</h2>
  </header>
  <div class="section-body">
    ${body}
  </div>
</section>`;
}

function renderFilterIndicator() {
  return `<div class="filter-indicator" id="filter-indicator"></div>`;
}

function renderPolicySummaryCard(discovery) {
  const summary = discovery?.policySummary ?? {};
  if (!summary.enabled) {
    return `<p class="empty">No project discovery policy configured.</p>`;
  }

  const blockerLines = (summary.blockerCounts ?? []).slice(0, 6).map((item) => `${item.value}: ${item.count}`);
  const previewLines = (summary.blockedPreview ?? []).slice(0, 4).map((item) => {
    const detail = item.blockers?.slice(0, 2).join(", ") || item.summary || "blocked";
    return `${item.repoRef}: ${detail}`;
  });
  const preferenceLines = (summary.preferenceCounts ?? []).slice(0, 6).map((item) => `${item.value}: ${item.count}`);

  return `<div class="coverage-grid">
    <article class="coverage-card">
      <h3>Gate results</h3>
      <p class="repo-copy">Mode ${escapeHtml(summary.mode ?? "enforce")} kept ${escapeHtml(summary.visible ?? summary.allowed ?? 0)} of ${escapeHtml(summary.evaluated ?? 0)} evaluated candidates visible.</p>
      ${renderHtmlList([
        `Flagged by policy: ${summary.blocked ?? 0}`,
        `Enforced hidden: ${summary.enforcedBlocked ?? 0}`,
        `Preferred hits: ${summary.preferred ?? 0}`
      ], "No policy metrics.")}
    </article>
    <article class="coverage-card">
      <h3>Top blocker reasons</h3>
      ${renderHtmlList(blockerLines, "No blocker reasons.")}
    </article>
    <article class="coverage-card">
      <h3>Blocked examples</h3>
      ${renderHtmlList(previewLines, "No blocked candidates.")}
    </article>
    <article class="coverage-card">
      <h3>Preference hits</h3>
      ${renderHtmlList(preferenceLines, "No preference hits.")}
    </article>
  </div>`;
}

function renderPolicyCalibrationCard(discovery) {
  const calibration = discovery?.policyCalibration ?? null;
  if (!calibration) {
    return `<p class="empty">No calibration hints available.</p>`;
  }

  const blockerLines = (calibration.topBlockers ?? []).slice(0, 6).map((item) => `${item.value}: ${item.count}`);
  const hintLines = (calibration.recommendations ?? []).slice(0, 6);

  return `<div class="coverage-grid">
    <article class="coverage-card">
      <h3>Calibration status</h3>
      <p class="repo-copy">${escapeHtml(calibration.status ?? "unknown")}</p>
    </article>
    <article class="coverage-card">
      <h3>Top blocker signals</h3>
      ${renderHtmlList(blockerLines, "No blocker patterns recorded.")}
    </article>
    <article class="coverage-card">
      <h3>Calibration hints</h3>
      ${renderHtmlList(hintLines, "No calibration hints available.")}
    </article>
  </div>`;
}

export function renderDecisionSummary({ candidates, reportType, runRoot, discovery, review }) {
  const root = getRunRoot({ reportType, runRoot, discovery, review });
  if (!hasDecisionRunFields(root)) {
    const reportSchemaVersion = root?.reportSchemaVersion ?? "fehlend";
    return `<section class="section-card warn" id="decision-summary">
  <header class="section-head"><h2>Decision Summary</h2></header>
  <div class="section-body">
    <p class="empty">Engine-Daten unvollstaendig (reportSchemaVersion: ${escapeHtml(reportSchemaVersion)}) - dieser Run wurde vor der Engine-Upgrade-Integration erzeugt oder ist unvollstaendig. Lauf erneut ausfuehren, um aktuelle Bewertungen zu sehen.</p>
  </div>
</section>`;
  }

  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  const top = safeCandidates[0] ?? null;
  const topName = getCandidateName(top);
  const topDisposition = getCandidateDisposition(top);
  const topDispositionType = top ? mapDispositionToType(topDisposition) : { label: "Unknown", tone: "neutral" };
  const topDecision = top ? getCandidateDecisionSummary(top) : "No candidates available.";
  const topValueScore = getCandidateValueScore(top);
  const topEffortScore = getCandidateEffortScore(top);
  const topFitBand = getCandidateFitBand(top);
  const strongestGapSignal = Array.isArray(root.runGapSignals) ? root.runGapSignals[0] ?? null : null;
  const topGap = strongestGapSignal?.gap ?? "unknown";
  const topGapHint = strongestGapSignal
    ? `count ${strongestGapSignal.count} · strength ${strongestGapSignal.strength}`
    : "No weighted gap signal recorded";

  const runConfidence = String(root.runConfidence ?? "unknown");
  const confidenceTone = runConfidence === "high" ? "accent" : runConfidence === "medium" ? "warn" : "neutral";
  const runConfidenceReason = truncateText(root.runConfidenceReason, 200);
  const stateSummary = root.itemsDataStateSummary ?? { complete: 0, fallback: 0, stale: 0 };
  const warnBanner = renderDataStateWarnBanner(stateSummary);

  return `<section class="section-card accent" id="decision-summary">
  <header class="section-head"><h2>Decision Summary</h2></header>
  <div class="section-body">
    ${warnBanner}
    <div class="summary-grid">
      <div class="summary-item">
        <span class="summary-label">Run confidence</span>
        <span class="summary-value">${renderBadge(runConfidence, confidenceTone)} <span class="summary-hint">${escapeHtml(runConfidenceReason)}</span></span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Top decision</span>
        <span class="summary-value">${renderBadge(topDispositionType.label, topDispositionType.tone)} <span>${escapeHtml(truncateText(topDecision, 180))}</span></span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Best match</span>
        <span class="summary-value">${escapeHtml(topName)} <span class="summary-hint">Value ${escapeHtml(topValueScore ?? "-")} · Effort ${escapeHtml(topEffortScore ?? "-")} · Fit ${escapeHtml(topFitBand)}</span></span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Top gap signal</span>
        <span class="summary-value">${escapeHtml(topGap)} <span class="summary-hint">${escapeHtml(topGapHint)}</span></span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Report scope</span>
        <span class="summary-value">${safeCandidates.length} candidates analyzed</span>
      </div>
    </div>
  </div>
</section>`;
}

export function renderRecommendedActions({ candidates, reportType, runRoot, discovery, review } = {}) {
  const root = getRunRoot({ reportType, runRoot, discovery, review });
  if (!hasDecisionRunFields(root)) {
    return "";
  }

  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  if (safeCandidates.length === 0) {
    return "";
  }

  const groups = { adopt: [], study: [], watch: [], defer: [] };

  safeCandidates.forEach((c) => {
    const disposition = getCandidateDisposition(c);
    const name = getCandidateName(c);
    const reason = truncateText(getCandidateDecisionSummary(c), 80);
    const entry = { ...c, name, reason };

    if (disposition === "intake_now") {
      groups.adopt.push(entry);
    } else if (disposition === "review_queue") {
      groups.study.push(entry);
    } else if (disposition === "observe_only") {
      groups.watch.push(entry);
    } else {
      groups.defer.push(entry);
    }
  });

  sortAdoptGroup(groups.adopt);

  const configs = [
    { key: "adopt", label: "Adopt", color: "var(--green)", items: groups.adopt },
    { key: "study", label: "Study", color: "var(--cyan)", items: groups.study },
    { key: "watch", label: "Watch", color: "var(--orange)", items: groups.watch },
    { key: "defer", label: "Defer", color: "var(--ink-muted)", items: groups.defer }
  ].filter((g) => g.items.length > 0);

  if (configs.length === 0) return "";

  return `<section class="section-card" id="recommended-actions">
  <header class="section-head"><h2>Recommended Actions</h2></header>
  <div class="section-body">
    <div class="actions-grid">${configs.map((g) => `<div class="action-group" style="--group-color:${g.color}">
      <h3>${escapeHtml(g.label)} (${g.items.length})</h3>
      ${g.items.map((item, idx) => `<a href="#repo-${slugifyForId(item.name)}" class="action-item${g.key === "adopt" && idx < 3 ? " ranked" : ""}">
        ${g.key === "adopt" ? `<span class="action-item__rank">${idx + 1}.</span>` : ""}
        <strong class="action-item__name">${escapeHtml(item.name)}</strong>
        ${g.key === "adopt" ? renderLicenseTag(item.license) : ""}
        ${item.reason ? `<span class="action-item__reason">${escapeHtml(item.reason)}</span>` : ""}
      </a>`).join("")}
    </div>`).join("")}</div>
  </div>
</section>`;
}

function renderDiscoveryCandidateCards(candidates, reportView) {
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

function renderWatchlistTopCards(review, reportView) {
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

function renderCoverageCards(coverage) {
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

function renderReviewScopeCards(review) {
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

function renderOnDemandRunCards(summary) {
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

function renderOnDemandArtifactCards(artifacts) {
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

function renderOnDemandNextActions(actions) {
  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>What now</h3>
    ${renderHtmlList(actions, "No follow-up guidance available for this run.")}
  </article>
</div>`;
}

function renderOnDemandRunPlanCards(runPlan) {
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

function renderOnDemandRunDriftCards(runDrift) {
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

function renderOnDemandGovernanceCards(governance) {
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

function renderOnDemandStabilityCards(stability) {
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

function renderRepoMatrix(review, reportView) {
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
      <td>${escapeHtml(item.eventbaerRelevance || "-")}</td>
      <td>${escapeHtml(item.suggestedNextStep || "-")}</td>
    </tr>`).join("")}
  </tbody>
</table></div>`;
}

function renderProjectContextSources(projectProfile, binding) {
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

function renderReportToolbar({ modeOptions, layerOptions }) {
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

function renderHtmlDocument({
  title,
  reportType,
  projectKey,
  createdAt,
  heroSubtitle,
  candidateCount,
  runRoot,
  stats = [],
  recommendations,
  candidates,
  sections,
  modeOptions = [],
  layerOptions = []
}) {
  const primaryStats = stats.filter((s) => s.primary !== false);
  const secondaryStats = stats.filter((s) => s.primary === false);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
/* === Tokens === */
:root {
  --bg: #050509;
  --surface: rgba(14, 14, 28, 0.6);
  --surface-solid: #0e0e1c;
  --surface-border: rgba(255, 255, 255, 0.06);
  --ink: #b8b8d0;
  --ink-bright: #eeeef8;
  --ink-muted: #5c5f82;
  --ink-faint: #2a2c48;
  --cyan: #00e5ff;
  --magenta: #e040fb;
  --orange: #ff9100;
  --green: #00e676;
  --blue: #2979ff;
  --accent: #00e5ff;
  --accent-soft: rgba(0, 229, 255, 0.08);
  --accent-border: rgba(0, 229, 255, 0.25);
  --info: #e040fb;
  --info-soft: rgba(224, 64, 251, 0.08);
  --info-border: rgba(224, 64, 251, 0.25);
  --warn: #ff9100;
  --warn-soft: rgba(255, 145, 0, 0.08);
  --warn-border: rgba(255, 145, 0, 0.25);
  --radius: 20px;
  --radius-lg: 28px;
}

/* === Reset + Body === */
*, *::before, *::after { box-sizing: border-box; margin: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Manrope', sans-serif;
  font-weight: 400;
  font-size: 16px;
  color: var(--ink);
  background: var(--bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  line-height: 1.65;
  overflow-x: hidden;
}

/* === Atmosphere === */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  background:
    radial-gradient(1200px circle at 5% 0%, rgba(0,229,255,0.07), transparent 70%),
    radial-gradient(1000px circle at 95% 20%, rgba(224,64,251,0.055), transparent 70%),
    radial-gradient(1100px circle at 30% 85%, rgba(0,230,118,0.04), transparent 70%),
    radial-gradient(800px circle at 80% 70%, rgba(255,145,0,0.03), transparent 70%);
  pointer-events: none;
  z-index: 0;
}

/* === Scrollbar === */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }

a { color: var(--accent); text-decoration: none; transition: color 0.2s; }
a:hover { color: #80f0ff; }

/* === Page === */
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 56px 140px;
  position: relative;
  z-index: 1;
}

/* === Scroll Progress === */
.scroll-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  width: 0%;
  background: linear-gradient(90deg, var(--cyan), var(--magenta));
  box-shadow: 0 0 12px rgba(0,229,255,0.5);
  z-index: 200;
  transition: width 0.1s linear;
}

/* === Hero (centered) === */
.hero {
  padding: 100px 0 110px;
  text-align: center;
  position: relative;
}
.hero-logo {
  width: 96px;
  height: 96px;
  border-radius: 20px;
  filter: drop-shadow(0 0 24px rgba(0,229,255,0.4)) drop-shadow(0 0 48px rgba(224,64,251,0.2));
  animation: hero-float-in 0.8s cubic-bezier(0.22,1,0.36,1) both;
}
@keyframes hero-float-in {
  0% { transform: translateY(-40px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes glow-pulse {
  0%, 100% { filter: drop-shadow(0 0 24px rgba(0,229,255,0.4)) drop-shadow(0 0 48px rgba(224,64,251,0.2)); }
  50% { filter: drop-shadow(0 0 32px rgba(0,229,255,0.55)) drop-shadow(0 0 56px rgba(224,64,251,0.3)); }
}
.hero-logo.animated { animation: glow-pulse 4s ease-in-out infinite; }

.hero-brand {
  font-family: 'Syne', sans-serif;
  font-size: 56px;
  font-weight: 800;
  color: #fff;
  margin: 28px 0 0;
  letter-spacing: -0.02em;
  animation: hero-fade-up 0.7s ease 0.3s both;
}
.hero-brand .pilot {
  background: linear-gradient(90deg, var(--cyan), var(--orange));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-subtitle {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: var(--ink-muted);
  margin: 12px 0 0;
  animation: hero-fade-up 0.6s ease 0.5s both;
}
.hero-divider {
  width: 56px;
  height: 2px;
  margin: 32px auto;
  background: linear-gradient(90deg, var(--cyan), var(--magenta));
  box-shadow: 0 0 16px rgba(0,229,255,0.4);
  border-radius: 1px;
  animation: hero-fade-up 0.5s ease 0.65s both;
}
.hero-claim {
  font-family: 'Syne', sans-serif;
  font-size: 28px;
  font-weight: 800;
  color: var(--ink-bright);
  margin: 0 0 40px;
}
.hero-claim .word {
  display: inline-block;
  animation: word-reveal 0.5s ease both;
  opacity: 0;
}
.hero-claim .word:nth-child(1) { animation-delay: 0.8s; }
.hero-claim .word:nth-child(2) { animation-delay: 0.95s; }
.hero-claim .word:nth-child(3) { animation-delay: 1.1s; }
.hero-claim .discover {
  color: var(--cyan);
  text-shadow: 0 0 24px rgba(0,229,255,0.4);
}
@keyframes word-reveal {
  0% { opacity: 0; filter: blur(8px); transform: translateY(8px); }
  100% { opacity: 1; filter: blur(0); transform: translateY(0); }
}
@keyframes hero-fade-up {
  0% { opacity: 0; transform: translateY(24px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* Hero Project Card */
.hero-project-card {
  display: inline-block;
  padding: 28px 40px;
  background: var(--surface);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  text-align: center;
  animation: hero-fade-up 0.6s ease 1.3s both;
}
.hero-project-type {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--cyan);
  margin-bottom: 8px;
}
.hero-project-name {
  font-family: 'Syne', sans-serif;
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  margin-bottom: 8px;
}
.hero-project-meta {
  font-size: 12px;
  color: var(--ink-muted);
}

/* === PDF Export Button === */
.pdf-export-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
  padding: 12px 24px;
  border-radius: 999px;
  border: 1px solid var(--surface-border);
  background: rgba(255,255,255,0.03);
  color: var(--ink-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  letter-spacing: 0.04em;
}
.pdf-export-btn:hover {
  border-color: var(--accent-border);
  color: var(--cyan);
  background: var(--accent-soft);
  transform: translateY(-2px);
  box-shadow: 0 4px 24px rgba(0,229,255,0.12);
}
.pdf-export-btn svg { width: 16px; height: 16px; }

/* === Sticky Nav === */
.sticky-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(5,5,9,0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding: 0 40px;
  display: flex;
  align-items: center;
  height: 52px;
  transform: translateY(-100%);
  transition: transform 0.3s ease;
}
.sticky-nav.visible { transform: translateY(0); }
.sticky-nav-brand {
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  white-space: nowrap;
  margin-right: 24px;
  padding-right: 24px;
  border-right: 1px solid rgba(255,255,255,0.08);
}
.sticky-nav-brand .pilot {
  background: linear-gradient(90deg, var(--cyan), var(--orange));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.sticky-nav-items {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.sticky-nav-items::-webkit-scrollbar { display: none; }
.sticky-nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-muted);
  white-space: nowrap;
  text-decoration: none;
  transition: all 0.2s;
}
.sticky-nav-item:hover {
  background: rgba(0,229,255,0.06);
  color: var(--cyan);
}
.sticky-nav-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* === Stats === */
.stats-strip { padding: 0 0 56px; }
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}
.stats-grid-secondary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  margin-top: 16px;
}
.stat-card {
  padding: 32px 36px;
  background: var(--surface);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
}
.stat-card:nth-child(5n+1) { border-top: 3px solid var(--cyan); }
.stat-card:nth-child(5n+2) { border-top: 3px solid var(--magenta); }
.stat-card:nth-child(5n+3) { border-top: 3px solid var(--orange); }
.stat-card:nth-child(5n+4) { border-top: 3px solid var(--green); }
.stat-card:nth-child(5n+5) { border-top: 3px solid var(--blue); }
.stat-card:hover {
  border-color: rgba(255,255,255,0.12);
  transform: translateY(-4px);
  box-shadow: 0 8px 40px rgba(0,0,0,0.3);
}
.stat-label {
  display: block;
  color: var(--ink-muted);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 14px;
}
.stat-value {
  font-family: 'Syne', sans-serif;
  font-size: 38px;
  font-weight: 800;
  line-height: 1;
}
.stat-card:nth-child(5n+1) .stat-value { color: var(--cyan); text-shadow: 0 0 20px rgba(0,229,255,0.3); }
.stat-card:nth-child(5n+2) .stat-value { color: var(--magenta); text-shadow: 0 0 20px rgba(224,64,251,0.3); }
.stat-card:nth-child(5n+3) .stat-value { color: var(--orange); text-shadow: 0 0 20px rgba(255,145,0,0.3); }
.stat-card:nth-child(5n+4) .stat-value { color: var(--green); text-shadow: 0 0 20px rgba(0,230,118,0.3); }
.stat-card:nth-child(5n+5) .stat-value { color: var(--blue); text-shadow: 0 0 20px rgba(41,121,255,0.3); }

/* === Top Recommendations === */
.recommendations { margin-bottom: 48px; }
.rec-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 28px;
  border-radius: 16px;
  border: 1px solid var(--surface-border);
  background: var(--surface);
  cursor: pointer;
  transition: all 0.3s;
  text-decoration: none;
  color: inherit;
  margin-bottom: 12px;
}
.rec-card:hover {
  transform: translateX(6px);
  border-color: var(--accent-border);
  background: var(--accent-soft);
}
.rec-card:hover .rec-arrow { transform: translateX(4px); }
.rec-rank {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Syne', sans-serif;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}
.rec-card:nth-child(1) .rec-rank {
  width: 52px; height: 52px; font-size: 22px;
  background: linear-gradient(135deg, var(--cyan), var(--magenta));
}
.rec-card:nth-child(2) .rec-rank { background: rgba(224,64,251,0.2); color: var(--magenta); }
.rec-card:nth-child(3) .rec-rank { background: rgba(255,145,0,0.2); color: var(--orange); }
.rec-card:nth-child(n+4) .rec-rank { background: rgba(255,255,255,0.06); color: var(--ink-muted); }
.rec-card:nth-child(1) {
  padding: 28px 32px;
  border-color: rgba(0,229,255,0.15);
  background: rgba(0,229,255,0.03);
}
.rec-card:nth-child(1) .rec-name { font-size: 17px; }
.rec-text { flex: 1; min-width: 0; }
.rec-name {
  font-family: 'Syne', sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-bright);
  margin-bottom: 2px;
}
.rec-action {
  font-size: 14px;
  color: var(--ink-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rec-arrow {
  color: var(--ink-faint);
  font-size: 18px;
  transition: transform 0.3s;
  flex-shrink: 0;
}

/* === Sections === */
.sections { display: grid; gap: 36px; }
.section-card {
  background: var(--surface);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  padding: 56px 60px;
  scroll-margin-top: 72px;
  border-left: 4px solid transparent;
}
.section-card.accent { border-left-color: var(--cyan); }
.section-card.info { border-left-color: var(--magenta); }
.section-card.warn { border-left-color: var(--orange); }
.section-warn {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(255, 145, 0, 0.12);
  border-left: 3px solid var(--orange);
  color: var(--ink);
  font-size: 14px;
  line-height: 1.5;
}
.section-warn strong {
  color: var(--orange);
  display: block;
  margin-bottom: 4px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-head h2 {
  font-family: 'Syne', sans-serif;
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #fff;
}
.section-body { margin-top: 32px; }

/* Collapsible */
.section-card.collapsible .section-head { cursor: pointer; }
.section-card.collapsible .section-head::after {
  content: "";
  width: 10px;
  height: 10px;
  border-right: 2px solid var(--ink-muted);
  border-bottom: 2px solid var(--ink-muted);
  transform: rotate(45deg);
  transition: transform 0.3s;
  flex-shrink: 0;
  margin-left: 16px;
}
.section-card.collapsible.collapsed .section-head::after {
  transform: rotate(-45deg);
}
.section-card.collapsible .section-body {
  overflow: hidden;
  transition: max-height 0.4s ease, opacity 0.3s ease;
}
.section-card.collapsible.collapsed .section-body {
  max-height: 0 !important;
  opacity: 0;
  margin-top: 0;
}

/* Section contents */
.bullets {
  margin: 0;
  padding-left: 24px;
  line-height: 1.85;
  color: var(--ink);
  font-size: 16px;
}
.bullets li + li { margin-top: 10px; }
.empty {
  color: var(--ink-muted);
  font-style: italic;
  font-size: 16px;
}

/* === Toolbar === */
.toolbar-card {
  background: var(--surface);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  padding: 36px 44px;
}
.toolbar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px;
  align-items: end;
}
.control { display: grid; gap: 10px; }
.control span {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--ink-muted);
  font-weight: 700;
}
.control input, .control select {
  appearance: none;
  width: 100%;
  padding: 14px 20px;
  border-radius: 14px;
  border: 1px solid var(--surface-border);
  background: rgba(255,255,255,0.03);
  color: var(--ink);
  font: inherit;
  font-size: 15px;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.control input:focus, .control select:focus {
  outline: none;
  border-color: var(--accent-border);
  box-shadow: 0 0 0 4px var(--accent-soft), 0 0 32px rgba(0,229,255,0.08);
}
.control input::placeholder { color: var(--ink-faint); }
.control select option { background: var(--surface-solid); color: var(--ink); }
.ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 28px;
  border-radius: 999px;
  color: var(--ink-muted);
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--surface-border);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}
.ghost-button:hover {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent);
}

/* Filter indicator */
.filter-indicator {
  text-align: center;
  padding: 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--cyan);
  text-shadow: 0 0 16px rgba(0,229,255,0.3);
  display: none;
}
.filter-indicator.active { display: block; }

/* === Cards === */
.coverage-grid, .repo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 24px;
}
.coverage-card, .repo-card {
  background: rgba(255,255,255,0.02);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  padding: 36px 40px;
  transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s;
}
.repo-card { border-top: 3px solid transparent; }
.repo-grid .repo-card:nth-child(5n+1) { border-top-color: var(--cyan); }
.repo-grid .repo-card:nth-child(5n+2) { border-top-color: var(--magenta); }
.repo-grid .repo-card:nth-child(5n+3) { border-top-color: var(--orange); }
.repo-grid .repo-card:nth-child(5n+4) { border-top-color: var(--green); }
.repo-grid .repo-card:nth-child(5n+5) { border-top-color: var(--blue); }

.repo-grid .repo-card:nth-child(5n+1):hover { border-color: rgba(0,229,255,0.35); box-shadow: 0 12px 56px rgba(0,229,255,0.12), inset 0 1px 0 rgba(0,229,255,0.15); transform: translateY(-6px); }
.repo-grid .repo-card:nth-child(5n+2):hover { border-color: rgba(224,64,251,0.35); box-shadow: 0 12px 56px rgba(224,64,251,0.12), inset 0 1px 0 rgba(224,64,251,0.15); transform: translateY(-6px); }
.repo-grid .repo-card:nth-child(5n+3):hover { border-color: rgba(255,145,0,0.35); box-shadow: 0 12px 56px rgba(255,145,0,0.12), inset 0 1px 0 rgba(255,145,0,0.15); transform: translateY(-6px); }
.repo-grid .repo-card:nth-child(5n+4):hover { border-color: rgba(0,230,118,0.35); box-shadow: 0 12px 56px rgba(0,230,118,0.12), inset 0 1px 0 rgba(0,230,118,0.15); transform: translateY(-6px); }
.repo-grid .repo-card:nth-child(5n+5):hover { border-color: rgba(41,121,255,0.35); box-shadow: 0 12px 56px rgba(41,121,255,0.12), inset 0 1px 0 rgba(41,121,255,0.15); transform: translateY(-6px); }

.coverage-card h3, .repo-card h3 {
  font-family: 'Syne', sans-serif;
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink-bright);
}
.coverage-card:hover {
  border-color: rgba(224,64,251,0.25);
  box-shadow: 0 12px 56px rgba(224,64,251,0.08);
  transform: translateY(-3px);
}
.repo-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 4px;
}
.repo-badges { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; flex-shrink: 0; }
.badge {
  display: inline-flex;
  align-items: center;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid transparent;
  white-space: nowrap;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.badge.accent { background: var(--accent-soft); color: var(--accent); border-color: var(--accent-border); text-shadow: 0 0 14px rgba(0,229,255,0.3); }
.badge.info { background: var(--info-soft); color: var(--info); border-color: var(--info-border); text-shadow: 0 0 14px rgba(224,64,251,0.3); }
.badge.warn { background: var(--warn-soft); color: var(--warn); border-color: var(--warn-border); text-shadow: 0 0 14px rgba(255,145,0,0.3); }
.badge.neutral { background: rgba(85,88,120,0.14); color: #8890b0; border-color: rgba(85,88,120,0.2); }

.repo-url { margin: 16px 0 0; font-size: 15px; }
.repo-copy { color: var(--ink-muted); font-size: 15px; line-height: 1.6; margin: 14px 0 0; }
.mini-grid { margin: 28px 0 0; display: grid; gap: 20px; }
.mini-grid dt { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-muted); font-weight: 700; margin-bottom: 6px; }
.mini-grid dd { margin: 0; line-height: 1.6; color: var(--ink); font-size: 15px; }

.repo-details { margin-top: 28px; padding-top: 24px; border-top: 1px solid var(--surface-border); }
.repo-details summary {
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
  color: var(--accent);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: color 0.2s;
}
.repo-details summary:hover { color: #80f0ff; }

/* === Bar Charts === */
.bar-list { display: grid; gap: 16px; margin-top: 20px; }
.bar-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(140px, 3fr) 40px;
  gap: 14px;
  align-items: center;
}
.bar-label { font-size: 14px; color: var(--ink-muted); font-weight: 500; }
.bar-count { font-size: 14px; color: var(--ink-muted); text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.bar-track { position: relative; height: 10px; border-radius: 999px; background: rgba(255,255,255,0.04); overflow: hidden; }
.bar-fill { position: absolute; inset: 0 auto 0 0; border-radius: inherit; width: 0%; transition: width 0.7s cubic-bezier(0.22,1,0.36,1); }
.bar-row:nth-child(5n+1) .bar-fill { background: var(--cyan); box-shadow: 0 0 14px rgba(0,229,255,0.4); }
.bar-row:nth-child(5n+2) .bar-fill { background: var(--magenta); box-shadow: 0 0 14px rgba(224,64,251,0.4); }
.bar-row:nth-child(5n+3) .bar-fill { background: var(--orange); box-shadow: 0 0 14px rgba(255,145,0,0.4); }
.bar-row:nth-child(5n+4) .bar-fill { background: var(--green); box-shadow: 0 0 14px rgba(0,230,118,0.4); }
.bar-row:nth-child(5n+5) .bar-fill { background: var(--blue); box-shadow: 0 0 14px rgba(41,121,255,0.4); }

/* === Data Table === */
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 15px; }
.data-table th, .data-table td { padding: 18px 16px; text-align: left; border-bottom: 1px solid var(--surface-border); vertical-align: top; }
.data-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--ink-muted); font-weight: 700; }
.data-table tbody tr { transition: background 0.2s; }
.data-table tbody tr:hover { background: rgba(255,255,255,0.025); }

/* === Footer === */
.report-footer {
  text-align: center;
  padding: 100px 24px 0;
  color: var(--ink-faint);
  font-size: 14px;
  letter-spacing: 0.06em;
}
.report-footer img {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  opacity: 0.25;
  margin: 0 auto 16px;
  display: block;
  filter: none;
}

/* === Decision Summary === */
.summary-grid { display: grid; gap: 20px; }
.summary-item { display: flex; flex-direction: column; gap: 4px; }
.section-warn {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(255, 145, 0, 0.12);
  border-left: 3px solid var(--orange);
  color: var(--ink);
  font-size: 14px;
  line-height: 1.5;
}
.section-warn strong {
  color: var(--orange);
  display: block;
  margin-bottom: 4px;
}
.summary-item.recommended-move {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--surface-border);
  margin-bottom: 4px;
}
.summary-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--ink-muted);
  font-weight: 700;
}
.summary-value {
  font-size: 16px;
  color: var(--ink-bright);
  line-height: 1.5;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.summary-item.recommended-move .summary-value { font-weight: 600; }
.summary-heuristic-label { font-weight: 400; color: var(--ink-muted); }
.summary-hint { color: var(--ink-muted); font-size: 13px; margin-left: 8px; }

/* === Recommended Actions === */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 28px;
}
.action-group {
  min-width: 0;
  --group-color: var(--ink-muted);
}
.action-group h3 {
  color: var(--group-color);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 12px;
  font-weight: 700;
}
.action-item {
  display: block;
  padding: 8px 0;
  color: var(--ink);
  text-decoration: none;
  border-bottom: 1px solid var(--surface-border);
  font-size: 14px;
  transition: color 0.2s;
}
.action-item.ranked { font-weight: 600; }
.action-item__rank {
  color: var(--group-color);
  font-size: 12px;
  margin-right: 6px;
  font-weight: 700;
}
.action-item__name { color: var(--ink-bright); }
.action-item__license {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
  vertical-align: middle;
}
.license-permissive { color: var(--ink-muted); background: rgba(255,255,255,0.04); }
.license-copyleft { color: var(--orange); background: rgba(255,145,0,0.12); }
.license-unknown { color: var(--ink-muted); background: rgba(255,255,255,0.04); opacity: 0.7; }
.action-item__reason { color: var(--ink-muted); margin-left: 8px; }
.action-item:hover { color: var(--cyan) !important; }
.action-item:hover .action-item__name { color: var(--cyan) !important; }

/* === Stats Primary/Secondary === */
.stat-card.secondary .stat-value {
  font-size: 28px;
  color: var(--ink-bright) !important;
  text-shadow: none !important;
}

/* === Scroll Reveal === */
.reveal { opacity: 0; transform: translateY(32px); transition: opacity 0.6s ease, transform 0.6s ease; }
.reveal.in-view { opacity: 1; transform: translateY(0); }
.hidden-by-filter { display: none !important; }

/* === Responsive === */
@media (max-width: 720px) {
  .page { padding: 0 20px 72px; }
  .hero { padding: 56px 0 48px; }
  .hero-brand { font-size: 36px; }
  .hero-claim { font-size: 20px; }
  .hero-project-card { padding: 20px 28px; }
  .hero-project-name { font-size: 18px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .stats-grid-secondary { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .stat-card { padding: 24px; }
  .stat-value { font-size: 28px; }
  .section-card { padding: 36px 28px; border-radius: var(--radius); }
  .section-head h2 { font-size: 22px; }
  .coverage-card, .repo-card { padding: 28px; }
  .coverage-grid, .repo-grid { grid-template-columns: 1fr; }
  .repo-head { flex-direction: column; }
  .repo-badges { justify-content: flex-start; }
  .toolbar-card { padding: 28px 24px; }
  .sticky-nav { padding: 0 16px; }
  .rec-card { padding: 16px 20px; gap: 14px; }
  .rec-card:nth-child(1) { padding: 20px 24px; }
}

/* === Print / PDF Export === */
@media print {
  body { background: #fff !important; color: #222 !important; font-size: 11pt; }
  body::before, .grain, .scroll-progress, .sticky-nav, .toolbar-card, .pdf-export-btn, .filter-indicator { display: none !important; }
  .page { padding: 0; max-width: none; }
  .hero { padding: 32px 0 24px; }
  .hero-logo { width: 48px; height: 48px; filter: none; }
  .hero-brand { font-size: 28px; color: #222; }
  .hero-brand .pilot { -webkit-text-fill-color: #555; }
  .hero-divider { background: #ccc; box-shadow: none; }
  .hero-claim { color: #222; font-size: 18px; }
  .hero-claim .discover { color: #222; text-shadow: none; }
  .hero-project-card { background: #f8f8f8; border: 1px solid #ddd; backdrop-filter: none; }
  .hero-project-type { color: #555; }
  .hero-project-name { color: #222; }
  .hero-project-meta { color: #666; }
  .stat-card, .section-card, .repo-card, .coverage-card { background: #fff; border: 1px solid #ddd; backdrop-filter: none; -webkit-backdrop-filter: none; box-shadow: none; break-inside: avoid; }
  .stat-card { border-top-width: 2px; }
  .stat-value { color: #222 !important; text-shadow: none !important; }
  .stat-label, .control span, .mini-grid dt { color: #666; }
  .section-head h2 { color: #222; }
  .section-body, .section-card.collapsible.collapsed .section-body { max-height: none !important; opacity: 1 !important; margin-top: 24px !important; overflow: visible !important; }
  .section-card.collapsible .section-head::after { display: none; }
  .badge { border: 1px solid #ccc; background: #f0f0f0; color: #444; text-shadow: none; }
  .rec-card { border: 1px solid #ddd; background: #fafafa; }
  .rec-rank { background: #eee !important; color: #444 !important; }
  .bar-fill { box-shadow: none; }
  .repo-grid .repo-card, .coverage-grid { grid-template-columns: 1fr; }
  .reveal { opacity: 1 !important; transform: none !important; }
  a { color: #222; }
  .report-footer img { opacity: 0.4; }
  .report-footer { color: #999; }
}
  </style>
</head>
<body>
  <svg class="grain" aria-hidden="true" style="position:fixed;inset:0;width:100%;height:100%;opacity:0.022;pointer-events:none;z-index:9999;mix-blend-mode:overlay"><filter id="g"><feTurbulence baseFrequency="0.55" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>
  <div class="scroll-progress" id="scroll-progress"></div>
  ${renderStickyNav(sections)}

  <main class="page">
    ${renderHeroSection({ reportType, projectKey, createdAt, subtitle: heroSubtitle, candidateCount })}

    <section class="stats-strip" id="stats">
      <div class="stats-grid">
        ${renderHtmlStatCards(primaryStats)}
      </div>
      ${secondaryStats.length ? `<div class="stats-grid-secondary">${renderHtmlStatCards(secondaryStats)}</div>` : ""}
    </section>

    ${renderDecisionSummary({ candidates, reportType, runRoot })}

    <section id="recommendations" aria-label="Top Recommendations">
      ${renderTopRecommendations(recommendations, candidates)}
    </section>

    ${renderRecommendedActions({ candidates, reportType, runRoot })}

    ${renderReportToolbar({ modeOptions, layerOptions })}

    <div class="sections">
      ${sections.map((section) => {
        if (section.collapsible) {
          return renderCollapsibleSection(section.title, section.body, {
            tone: section.tone ?? "default",
            sectionId: section.id ?? slugifyForId(section.title),
            navLabel: section.navLabel ?? "",
            collapsed: section.collapsed ?? false
          });
        }
        return renderHtmlSection(section.title, section.body, section.tone ?? "default", section.id ?? slugifyForId(section.title));
      }).join("\n")}
    </div>

    <footer class="report-footer">
      <img src="${LOGO_BASE64}" alt="Patternpilot">
      <p>Generated by Patternpilot &mdash; Repo Intelligence System</p>
    </footer>
  </main>
  <script>
(() => {
  /* ---- Filters ---- */
  const searchInput = document.getElementById("report-search");
  const fitSelect = document.getElementById("report-fit");
  const modeSelect = document.getElementById("report-mode");
  const layerSelect = document.getElementById("report-layer");
  const resetButton = document.getElementById("report-reset");
  const cards = Array.from(document.querySelectorAll(".filter-card"));
  const rows = Array.from(document.querySelectorAll(".data-table tbody tr"));
  const indicator = document.getElementById("filter-indicator");
  const totalCount = cards.length;

  const applyFilters = () => {
    const search = (searchInput?.value || "").trim().toLowerCase();
    const fit = (fitSelect?.value || "").toLowerCase();
    const mode = (modeSelect?.value || "").toLowerCase();
    const layer = (layerSelect?.value || "").toLowerCase();

    const matches = (node, rowSearch) => {
      const text = (node.dataset.search || rowSearch || "").toLowerCase();
      const fitVal = node.dataset.fit || "";
      const modeVal = node.dataset.mode || "";
      const layerVal = node.dataset.layer || "";
      return (!search || text.includes(search))
        && (!fit || fitVal === fit)
        && (!mode || modeVal === mode)
        && (!layer || layerVal === layer);
    };

    let visibleCount = 0;
    cards.forEach((card) => {
      const visible = matches(card, "");
      card.classList.toggle("hidden-by-filter", !visible);
      if (visible) visibleCount++;
    });

    rows.forEach((row) => {
      const firstCell = row.querySelector("td");
      const fitVal = row.children[3]?.textContent?.toLowerCase() || "";
      const layerVal = row.children[1]?.textContent?.toLowerCase() || "";
      const modeVal = row.children[2]?.textContent?.toLowerCase() || "";
      const rowSearch = [firstCell?.dataset.search || "", row.textContent || ""].join(" ").toLowerCase();
      const pseudoNode = {
        dataset: {
          search: rowSearch,
          fit: fitVal.includes("high") ? "high" : fitVal.includes("medium") ? "medium" : fitVal.includes("low") ? "low" : "unknown",
          mode: modeVal,
          layer: layerVal
        }
      };
      row.classList.toggle("hidden-by-filter", !matches(pseudoNode, rowSearch));
    });

    if (indicator) {
      const hasFilter = search || fit || mode || layer;
      indicator.classList.toggle("active", hasFilter);
      if (hasFilter) {
        indicator.textContent = "Showing " + visibleCount + " of " + totalCount + " candidate cards";
      } else {
        indicator.textContent = "";
      }
    }
  };

  [searchInput, fitSelect, modeSelect, layerSelect].forEach((n) => {
    n?.addEventListener("input", applyFilters);
    n?.addEventListener("change", applyFilters);
  });
  resetButton?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (fitSelect) fitSelect.value = "";
    if (modeSelect) modeSelect.value = "";
    if (layerSelect) layerSelect.value = "";
    applyFilters();
  });
  applyFilters();

  /* ---- Scroll Reveal ---- */
  const revealTargets = document.querySelectorAll(".section-card, .repo-card, .coverage-card, .stat-card, .rec-card");
  revealTargets.forEach((el) => el.classList.add("reveal"));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06, rootMargin: "0px 0px -40px 0px" });

  requestAnimationFrame(() => {
    revealTargets.forEach((el) => {
      const idx = Array.from(el.parentElement?.children || []).indexOf(el);
      el.style.transitionDelay = Math.min(idx * 0.07, 0.28) + "s";
      revealObserver.observe(el);
    });
  });

  /* ---- Counter Animation ---- */
  const counters = document.querySelectorAll(".stat-value[data-count]");
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count, 10);
      if (!Number.isFinite(target)) return;
      counterObserver.unobserve(el);
      const duration = 1200;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(ease * target);
        if (t < 1) requestAnimationFrame(tick);
      };
      el.textContent = "0";
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.3 });
  counters.forEach((el) => counterObserver.observe(el));

  /* ---- Bar Fill Animation ---- */
  const barFills = document.querySelectorAll(".bar-fill[data-width]");
  const barObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.style.width = entry.target.dataset.width + "%";
      barObserver.unobserve(entry.target);
    });
  }, { threshold: 0.1 });
  barFills.forEach((el) => barObserver.observe(el));

  /* ---- Sticky Nav ---- */
  const hero = document.getElementById("hero");
  const stickyNav = document.getElementById("sticky-nav");
  if (hero && stickyNav) {
    const heroObserver = new IntersectionObserver(([entry]) => {
      stickyNav.classList.toggle("visible", !entry.isIntersecting);
    }, { threshold: 0 });
    heroObserver.observe(hero);
  }

  /* ---- Scroll Progress ---- */
  const progressBar = document.getElementById("scroll-progress");
  if (progressBar) {
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollTop = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          progressBar.style.width = docHeight > 0 ? (scrollTop / docHeight * 100) + "%" : "0%";
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  /* ---- Collapsible Sections ---- */
  document.querySelectorAll(".section-card.collapsible .section-head").forEach((head) => {
    head.addEventListener("click", () => {
      const card = head.closest(".section-card");
      const body = card.querySelector(".section-body");
      if (card.classList.contains("collapsed")) {
        body.style.maxHeight = body.scrollHeight + "px";
        card.classList.remove("collapsed");
      } else {
        body.style.maxHeight = body.scrollHeight + "px";
        requestAnimationFrame(() => {
          body.style.maxHeight = "0px";
          card.classList.add("collapsed");
        });
      }
    });
  });

  /* Initialize collapsible max-heights */
  document.querySelectorAll(".section-card.collapsible:not(.collapsed) .section-body").forEach((body) => {
    body.style.maxHeight = body.scrollHeight + "px";
  });

  /* ---- Hero logo glow pulse after entrance ---- */
  const heroLogo = document.querySelector(".hero-logo");
  if (heroLogo) {
    heroLogo.addEventListener("animationend", () => {
      heroLogo.classList.add("animated");
    }, { once: true });
  }
})();
  </script>
</body>
</html>`;
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
