import { classifyLicense } from "../classification/evaluation.mjs";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

export { classifyLicense } from "../classification/evaluation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LOGO_BASE64 = `data:image/png;base64,${readFileSync(path.join(__dirname, "../../assets/logo-icon.png")).toString("base64")}`;

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderHtmlList(items, emptyText = "none") {
  if (!items || items.length === 0) {
    return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  }
  return `<ul class="bullets">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function renderHtmlStatCards(stats) {
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

export function renderHtmlSection(title, body, tone = "default", sectionId = "") {
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

export function renderBadge(value, tone = "neutral") {
  return `<span class="badge ${tone}">${escapeHtml(value)}</span>`;
}

export function slugifyForId(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function dispositionTone(value) {
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

export function fitTone(value) {
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

export function renderHeroSection({ reportType, projectKey, createdAt, subtitle, candidateCount }) {
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

export function renderStickyNav(sections) {
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

export function getCandidateName(candidate) {
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

export function getCandidateDecisionSummary(candidate) {
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

export function renderTopRecommendations(recommendations, candidates) {
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

export function renderCollapsibleSection(title, body, { tone = "default", sectionId = "", navLabel = "", collapsed = false } = {}) {
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

export function renderFilterIndicator() {
  return `<div class="filter-indicator" id="filter-indicator"></div>`;
}

export function renderPolicySummaryCard(discovery) {
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

export function renderPolicyCalibrationCard(discovery) {
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
