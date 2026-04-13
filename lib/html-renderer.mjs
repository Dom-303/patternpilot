import { uniqueStrings } from "./utils.mjs";
import { resolveReportView, resolveDiscoveryProfile } from "./constants.mjs";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

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
  const typeLabel = reportType === "discovery" ? "DISCOVERY REPORT" : "WATCHLIST REVIEW";
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
    <div class="hero-project-meta">${escapeHtml(dateStr)} &middot; ${escapeHtml(subtitle)} &middot; ${candidateCount} candidates</div>
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
    candidates: "var(--magenta)",
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

function renderTopRecommendations(recommendations, candidates, reportType) {
  if (!recommendations || recommendations.length === 0) {
    return `<p class="empty">No recommendations yet.</p>`;
  }
  return `<div class="recommendations">${recommendations.map((rec, i) => {
    const [repoRef, ...actionParts] = rec.split(": ");
    const action = actionParts.join(": ") || "Review manually.";
    const slug = slugifyForId(repoRef);

    const candidate = (candidates || []).find((c) => {
      const name = reportType === "discovery" ? `${c.repo.owner}/${c.repo.name}` : c.repoRef;
      return name === repoRef;
    });
    const disposition = reportType === "discovery" ? candidate?.discoveryDisposition : null;
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

function renderDecisionSummary({ candidates, reportType }) {
  if (!candidates || candidates.length === 0) {
    return `<section class="section-card accent" id="decision-summary">
  <header class="section-head"><h2>Decision Summary</h2></header>
  <div class="section-body"><p class="empty">No candidates to summarize. Run discovery with network access or widen the search.</p></div>
</section>`;
  }

  const top = candidates[0];
  const topName = reportType === "discovery"
    ? `${top.repo.owner}/${top.repo.name}`
    : top.repoRef || "unknown";
  const topScore = reportType === "discovery" ? top.discoveryScore : top.reviewScore;
  const topFit = reportType === "discovery"
    ? (top.projectAlignment?.fitBand ?? "unknown")
    : (top.projectFitBand || "unknown");
  const keyAction = reportType === "discovery"
    ? (top.projectAlignment?.suggestedNextStep ?? top.landkarteCandidate?.possible_implication ?? "Review manually.")
    : (top.suggestedNextStep || top.possibleImplication || "Review manually.");

  const gapCounts = {};
  candidates.forEach((c) => {
    const gap = reportType === "discovery"
      ? (c.projectAlignment?.matchedCapabilities?.[0] ?? c.guess?.mainLayer ?? "unknown")
      : (c.gapArea || "unknown");
    gapCounts[gap] = (gapCounts[gap] || 0) + 1;
  });
  const biggestGap = Object.entries(gapCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";

  const highFitCount = candidates.filter((c) => {
    const fit = reportType === "discovery" ? c.projectAlignment?.fitBand : c.projectFitBand;
    return fit === "high";
  }).length;
  const ratio = candidates.length > 0 ? highFitCount / candidates.length : 0;
  const confidence = candidates.length < 3 ? "low" : ratio > 0.4 ? "high" : ratio > 0.15 ? "medium" : "low";
  const confidenceTone = confidence === "high" ? "accent" : confidence === "medium" ? "warn" : "neutral";
  const confidenceReason = confidence === "high"
    ? "Strong convergence across candidates"
    : confidence === "medium"
      ? "Mixed signals \u2014 few high-fit candidates"
      : "Decision not reliable. Expand search or review manually.";

  const topDisposition = reportType === "discovery" ? top.discoveryDisposition : null;
  let recommendedMove;
  if (topFit === "high" && topDisposition === "intake_now") {
    recommendedMove = `Adopt ${topName} and prototype immediately`;
  } else if (topFit === "high" && topDisposition === "review_queue") {
    recommendedMove = `Study ${topName} in detail before committing`;
  } else if (topFit === "medium") {
    recommendedMove = "No strong match \u2014 review top candidates manually";
  } else {
    recommendedMove = "No strong match \u2014 expand search scope";
  }

  return `<section class="section-card accent" id="decision-summary">
  <header class="section-head"><h2>Decision Summary</h2></header>
  <div class="section-body">
    <div class="summary-grid">
      <div class="summary-item recommended-move">
        <span class="summary-label">Recommended move</span>
        <span class="summary-value" style="font-size:16px;color:var(--ink-bright);font-weight:600">${escapeHtml(recommendedMove)}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Best match</span>
        <span class="summary-value">${escapeHtml(topName)} ${topScore != null ? renderBadge("Score " + topScore, "accent") : ""} ${renderBadge("Fit " + topFit, fitTone(topFit))}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Key action</span>
        <span class="summary-value">${escapeHtml(truncateText(keyAction, 160))}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Most repeated gap signal</span>
        <span class="summary-value">${escapeHtml(biggestGap)}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Signal confidence <em style="font-weight:400;color:var(--ink-muted)">(heuristic)</em></span>
        <span class="summary-value">${renderBadge(confidence, confidenceTone)} <span style="color:var(--ink-muted);font-size:13px;margin-left:8px">${confidenceReason}</span></span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Report scope</span>
        <span class="summary-value">${candidates.length} candidates analyzed</span>
      </div>
    </div>
  </div>
</section>`;
}

function renderRecommendedActions(candidates, reportType) {
  if (!candidates || candidates.length === 0) return "";

  const groups = { adopt: [], study: [], watch: [], defer: [] };

  candidates.forEach((c) => {
    const disposition = reportType === "discovery" ? c.discoveryDisposition : null;
    const fit = reportType === "discovery"
      ? (c.projectAlignment?.fitBand ?? "unknown")
      : (c.projectFitBand || "unknown");
    const name = reportType === "discovery"
      ? `${c.repo.owner}/${c.repo.name}`
      : c.repoRef || "unknown";
    const reason = reportType === "discovery"
      ? (c.reasoning?.[0] ?? "")
      : (c.reason || c.learningForEventbaer || "");
    const slug = slugifyForId(name);
    const entry = { name, reason: truncateText(reason, 80), slug };

    if (disposition === "intake_now" || (fit === "high" && disposition === "review_queue")) {
      groups.adopt.push(entry);
    } else if (disposition === "review_queue") {
      groups.study.push(entry);
    } else if (disposition === "observe_only") {
      groups.watch.push(entry);
    } else {
      groups.defer.push(entry);
    }
  });

  const configs = [
    { key: "adopt", label: "Adopt", color: "var(--green)", items: groups.adopt },
    { key: "study", label: "Study", color: "var(--cyan)", items: groups.study },
    { key: "watch", label: "Watch", color: "var(--orange)", items: groups.watch },
    { key: "defer", label: "Needs Review", color: "var(--ink-muted)", items: groups.defer }
  ].filter((g) => g.items.length > 0);

  if (configs.length === 0) return "";

  return `<section class="section-card" id="recommended-actions">
  <header class="section-head"><h2>Recommended Actions</h2></header>
  <div class="section-body">
    <div class="actions-grid">${configs.map((g) => `<div class="action-group">
      <h3 style="color:${g.color};font-size:13px;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;font-weight:700">${escapeHtml(g.label)} (${g.items.length})</h3>
      ${g.items.map((item, idx) => `<a href="#repo-${item.slug}" class="action-item" style="display:block;padding:8px 0;color:var(--ink);text-decoration:none;border-bottom:1px solid var(--surface-border);font-size:14px;transition:color 0.2s${g.key === "adopt" && idx < 3 ? ";font-weight:600" : ""}">
        ${g.key === "adopt" ? `<span style="color:${g.color};font-size:12px;margin-right:6px;font-weight:700">${idx + 1}.</span>` : ""}
        <strong style="color:var(--ink-bright)">${escapeHtml(item.name)}</strong>
        ${item.reason ? `<span style="color:var(--ink-muted);margin-left:8px">${escapeHtml(item.reason)}</span>` : ""}
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
  stats,
  recommendations,
  candidates,
  sections,
  modeOptions = [],
  layerOptions = []
}) {
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
  --surface-hover: rgba(20, 20, 40, 0.8);
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

/* === Recommended Actions === */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 28px;
}
.action-group { min-width: 0; }
.action-item:hover { color: var(--cyan) !important; }
.action-item:hover strong { color: var(--cyan) !important; }

/* === Stats Primary/Secondary === */
.stat-card.secondary .stat-value {
  font-size: 28px;
  color: var(--ink-bright) !important;
  text-shadow: none !important;
}

/* === Recommendation Type Badge === */
.rec-type {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 6px;
  margin-left: auto;
  flex-shrink: 0;
}

/* === Content Truncation === */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
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
        ${renderHtmlStatCards(stats.filter((s) => s.primary !== false))}
      </div>
      <div class="stats-grid-secondary">
        ${renderHtmlStatCards(stats.filter((s) => s.primary === false))}
      </div>
    </section>

    ${renderDecisionSummary({ candidates, reportType })}

    <section id="recommendations">
      ${renderTopRecommendations(recommendations, candidates, reportType)}
    </section>

    ${renderRecommendedActions(candidates, reportType)}

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

      const applyFilters = () => {
        const search = (searchInput?.value || "").trim().toLowerCase();
        const fit = fitSelect?.value || "";
        const mode = modeSelect?.value || "";
        const layer = layerSelect?.value || "";

        const matches = (node, rowSearch) => {
          const text = (node.dataset.search || rowSearch || "").toLowerCase();
          const fitValue = node.dataset.fit || "";
          const modeValue = node.dataset.mode || "";
          const layerValue = node.dataset.layer || "";
          return (!search || text.includes(search))
            && (!fit || fitValue === fit)
            && (!mode || modeValue === mode)
            && (!layer || layerValue === layer);
        };

        cards.forEach((card) => {
          card.classList.toggle("hidden-by-filter", !matches(card, ""));
        });

        rows.forEach((row) => {
          const firstCell = row.querySelector("td");
          const fitValue = row.children[3]?.textContent?.toLowerCase() || "";
          const layerValue = row.children[1]?.textContent?.toLowerCase() || "";
          const modeValue = row.children[2]?.textContent?.toLowerCase() || "";
          const rowSearch = [firstCell?.dataset.search || "", row.textContent || ""].join(" ").toLowerCase();
          const pseudoNode = { dataset: { search: rowSearch, fit: fitValue.includes("high") ? "high" : fitValue.includes("medium") ? "medium" : fitValue.includes("low") ? "low" : "unknown", mode: modeValue, layer: layerValue } };
          row.classList.toggle("hidden-by-filter", !matches(pseudoNode, rowSearch));
        });
      };

      [searchInput, fitSelect, modeSelect, layerSelect].forEach((node) => {
        node?.addEventListener("input", applyFilters);
        node?.addEventListener("change", applyFilters);
      });
      resetButton?.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        if (fitSelect) fitSelect.value = "";
        if (modeSelect) modeSelect.value = "";
        if (layerSelect) layerSelect.value = "";
        applyFilters();
      });
      applyFilters();

      /* ---- Scroll reveal ---- */
      const revealTargets = document.querySelectorAll(".section-card, .repo-card, .coverage-card, .stat-card");
      revealTargets.forEach((el) => el.classList.add("reveal"));

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.06, rootMargin: "0px 0px -40px 0px" });

      requestAnimationFrame(() => {
        revealTargets.forEach((el, i) => {
          const siblingIndex = Array.from(el.parentElement?.children || []).indexOf(el);
          el.style.transitionDelay = Math.min(siblingIndex * 0.07, 0.28) + "s";
          observer.observe(el);
        });
      });
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
  const topRecommendations = discovery.candidates
    .slice(0, Math.min(5, view.candidateCount))
    .map((candidate) => {
      const transfer = candidate.landkarteCandidate?.possible_implication ?? candidate.projectAlignment?.suggestedNextStep ?? "Review manually.";
      return `${candidate.repo.owner}/${candidate.repo.name}: ${transfer}`;
    });
  const sections = [
    {
      title: "Top recommendations",
      id: "top-recommendations",
      tone: "accent",
      body: renderHtmlList(
        topRecommendations,
        "No candidates yet. Run discovery with network access or widen the search profile."
      )
    },
    {
      title: "Target repo context used",
      id: "target-repo-context-used",
      tone: "info",
      body: renderProjectContextSources(projectProfile, binding)
    },
    {
      title: "Candidate overview",
      id: "candidate-overview",
      body: renderDiscoveryCandidateCards(discovery.candidates, view)
    }
  ];

  if (view.showQueries) {
    sections.push({
      title: "Discovery lenses",
      id: "discovery-lenses",
      tone: "info",
      body: `<div class="coverage-grid">${discovery.plan.plans.map((plan) => `<article class="coverage-card">
  <h3>${escapeHtml(plan.label)}</h3>
  <p class="repo-copy">${escapeHtml(plan.query)}</p>
  ${renderHtmlList(plan.reasons, "No reasons recorded.")}
</article>`).join("")}</div>`
    });
  }

  sections.push({
    title: "Search errors",
    id: "search-errors",
    tone: discovery.searchErrors.length > 0 ? "warn" : "default",
    body: renderHtmlList(
        discovery.searchErrors.map((item) => `${item.label}: ${item.error}`),
        "No search errors."
      )
  });

  return renderHtmlDocument({
    title: `${projectKey} discovery report`,
    eyebrow: "Patternpilot Discovery",
    subtitle: `Heuristic GitHub scan for ${projectKey}.`,
    lead: "This report turns discovery candidates into a readable shortlist with direct transfer ideas and next actions.",
    stats: [
      { label: "Profile", value: profile.id },
      { label: "Profile limit", value: profile.limit },
      { label: "Queries", value: discovery.plan.plans.length },
      { label: "Known repos skipped", value: discovery.knownUrlCount },
      { label: "Search results scanned", value: discovery.scanned },
      { label: "Candidates", value: discovery.candidates.length },
      { label: "Created", value: createdAt.slice(0, 16).replace("T", " ") },
      { label: "View", value: view.id }
    ],
    sections,
    modeOptions: uniqueStrings(discovery.candidates.map((candidate) => candidate.discoveryDisposition)),
    layerOptions: uniqueStrings(discovery.candidates.map((candidate) => candidate.guess?.mainLayer ?? ""))
  });
}

export function renderWatchlistReviewHtmlReport(review, reportView = "standard") {
  const view = resolveReportView(reportView);
  const sections = [
    {
      title: "Top recommendations",
      id: "top-recommendations",
      tone: "accent",
      body: renderHtmlList(review.nextSteps, "No recommendations yet.")
    },
    {
      title: "Target repo context used",
      id: "target-repo-context-used",
      tone: "info",
      body: renderProjectContextSources(review.projectProfile, review.binding)
    },
    {
      title: "Top compared repositories",
      id: "top-compared-repositories",
      body: renderWatchlistTopCards(review, view)
    }
  ];

  if (view.showCoverage) {
    sections.push({
      title: "Coverage",
      id: "coverage",
      body: renderCoverageCards(review.coverage)
    });
  }

  sections.push({
    title: "Highest risk signals",
    id: "highest-risk-signals",
    tone: review.riskiestItems.length > 0 ? "warn" : "default",
    body: renderHtmlList(
        review.riskiestItems.map((item) => `${item.repoRef}: ${item.risks.join(", ") || item.weaknesses || "needs_review"}`),
        "No strong risk signals in the current review set."
      )
  });

  sections.push({
    title: "Missing watchlist intake",
    id: "missing-watchlist-intake",
    body: renderHtmlList(review.missingUrls, "All current watchlist URLs already have queue coverage.")
  });

  if (view.showMatrix) {
    sections.push({
      title: "Repo matrix",
      id: "repo-matrix",
      body: renderRepoMatrix(review, view)
    });
  }

  return renderHtmlDocument({
    title: `${review.projectKey} watchlist review`,
    eyebrow: "Patternpilot Review",
    subtitle: `Watchlist comparison for ${review.projectLabel}.`,
    lead: "This report condenses watchlist-backed repository analysis into strengths, transfer opportunities, and next actions for the target project.",
    stats: [
      { label: "Analysis profile", value: review.analysisProfile.id },
      { label: "Depth", value: review.analysisDepth.id },
      { label: "Watchlist URLs", value: review.watchlistCount },
      { label: "Reviewed repos", value: review.items.length },
      { label: "Missing intake", value: review.missingUrls.length },
      { label: "Top items shown", value: Math.min(review.topItems.length, view.candidateCount) },
      { label: "Created", value: review.createdAt.slice(0, 16).replace("T", " ") },
      { label: "View", value: view.id }
    ],
    sections,
    modeOptions: uniqueStrings(review.items.map((item) => item.gapArea || "")),
    layerOptions: uniqueStrings(review.items.map((item) => item.mainLayer || ""))
  });
}
