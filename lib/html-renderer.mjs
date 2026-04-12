import { uniqueStrings } from "./utils.mjs";
import { resolveReportView, resolveDiscoveryProfile } from "./constants.mjs";

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 54" class="brand-logo" role="img" aria-label="Patternpilot">
  <rect x="0" y="0" width="14" height="14" rx="3" fill="#00e5ff"/>
  <rect x="18" y="0" width="14" height="14" rx="3" fill="#e040fb"/>
  <rect x="18" y="18" width="14" height="14" rx="3" fill="#ff9100"/>
  <rect x="36" y="18" width="14" height="14" rx="3" fill="#00e676"/>
  <rect x="36" y="36" width="14" height="14" rx="3" fill="#2979ff"/>
</svg>`;

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
      (stat) => `<article class="stat-card">
  <span class="stat-label">${escapeHtml(stat.label)}</span>
  <strong class="stat-value">${escapeHtml(stat.value)}</strong>
</article>`
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
    return `<article class="repo-card filter-card"
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
  return `<div class="repo-grid">${visible.map((item) => `<article class="repo-card filter-card"
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
</article>`).join("")}</div>`;
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
    <span class="bar-track"><span class="bar-fill" style="width:${Math.max(12, Math.round((item.count / maxCount) * 100))}%"></span></span>
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
    <button class="ghost-button" id="report-reset" type="button">Reset filters</button>
  </div>
</section>`;
}

function renderHtmlDocument({ title, eyebrow, subtitle, lead, stats, sections, modeOptions = [], layerOptions = [] }) {
  const navItems = sections
    .map((section) => section.id ? `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.navLabel ?? section.title)}</a>` : "")
    .filter(Boolean)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      /* Base */
      --bg: #08080f;
      --bg-grid: rgba(255, 255, 255, 0.022);
      --surface: rgba(14, 14, 28, 0.82);
      --surface-solid: #10101e;
      --surface-border: rgba(255, 255, 255, 0.06);
      --surface-hover: rgba(20, 20, 44, 0.9);
      /* Text */
      --ink: #e0e0ec;
      --ink-muted: #6b7394;
      --ink-faint: #2e3350;
      /* Tetris palette */
      --cyan: #00e5ff;
      --magenta: #e040fb;
      --orange: #ff9100;
      --green: #00e676;
      --red: #ff1744;
      --blue: #2979ff;
      --yellow: #ffea00;
      /* Semantic */
      --accent: #00e5ff;
      --accent-soft: rgba(0, 229, 255, 0.08);
      --accent-border: rgba(0, 229, 255, 0.2);
      --info: #e040fb;
      --info-soft: rgba(224, 64, 251, 0.08);
      --info-border: rgba(224, 64, 251, 0.2);
      --warn: #ff9100;
      --warn-soft: rgba(255, 145, 0, 0.08);
      --warn-border: rgba(255, 145, 0, 0.2);
      /* Effects */
      --shadow: 0 4px 48px rgba(0, 0, 0, 0.45);
      --glow-cyan: 0 0 80px rgba(0, 229, 255, 0.08);
      --glow-magenta: 0 0 80px rgba(224, 64, 251, 0.06);
      --radius: 16px;
      --radius-lg: 24px;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; }
    html { scroll-behavior: smooth; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      color: var(--ink);
      background-color: var(--bg);
      background-image:
        repeating-linear-gradient(0deg, transparent, transparent 59px, var(--bg-grid) 59px, var(--bg-grid) 60px),
        repeating-linear-gradient(90deg, transparent, transparent 59px, var(--bg-grid) 59px, var(--bg-grid) 60px);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.16); }

    a { color: var(--accent); text-decoration: none; transition: color 0.15s; }
    a:hover { color: #66f0ff; text-decoration: underline; }

    .page {
      max-width: 1360px;
      margin: 0 auto;
      padding: 40px 28px 80px;
      position: relative;
    }

    /* ---- Decorative Tetris blocks ---- */
    .page::before,
    .page::after {
      content: "";
      position: fixed;
      pointer-events: none;
      border-radius: 6px;
      opacity: 0.07;
      animation: tetris-float 12s ease-in-out infinite alternate;
    }
    .page::before {
      top: 80px;
      right: 4vw;
      width: 22px;
      height: 22px;
      background: var(--cyan);
      box-shadow:
        0 28px 0 var(--magenta),
        -28px 28px 0 var(--magenta),
        -28px 56px 0 var(--orange);
    }
    .page::after {
      bottom: 120px;
      left: 3vw;
      width: 18px;
      height: 18px;
      background: var(--green);
      box-shadow:
        24px 0 0 var(--blue),
        24px 24px 0 var(--blue),
        48px 24px 0 var(--magenta);
      animation-delay: -6s;
    }
    @keyframes tetris-float {
      0% { transform: translateY(0); }
      100% { transform: translateY(16px); }
    }

    /* ---- Hero ---- */
    .hero {
      position: relative;
      background:
        radial-gradient(ellipse at 15% 40%, rgba(0, 229, 255, 0.07), transparent 55%),
        radial-gradient(ellipse at 85% 60%, rgba(224, 64, 251, 0.05), transparent 55%),
        var(--surface);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-lg);
      padding: 40px 40px 36px;
      box-shadow: var(--shadow), var(--glow-cyan);
      overflow: hidden;
    }
    .hero::after {
      content: "";
      position: absolute;
      top: 20px;
      right: 32px;
      width: 20px;
      height: 20px;
      background: var(--cyan);
      opacity: 0.09;
      border-radius: 5px;
      box-shadow:
        26px 0 0 var(--magenta),
        52px 0 0 var(--magenta),
        26px 26px 0 var(--orange),
        52px 26px 0 var(--green),
        52px 52px 0 var(--blue);
      pointer-events: none;
      animation: tetris-float 10s ease-in-out infinite alternate;
    }

    .brand-bar {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 28px;
    }
    .brand-logo { width: 30px; height: auto; }
    .brand-name {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }

    .eyebrow {
      letter-spacing: 0.2em;
      text-transform: uppercase;
      font-size: 11px;
      color: var(--cyan);
      margin: 0 0 16px;
      font-weight: 700;
      text-shadow: 0 0 24px rgba(0, 229, 255, 0.35);
    }

    h1 {
      font-size: clamp(36px, 5.5vw, 68px);
      font-weight: 900;
      line-height: 0.95;
      letter-spacing: -0.03em;
      max-width: 860px;
      color: #fff;
    }

    .subtitle {
      margin: 20px 0 0;
      color: var(--ink-muted);
      font-size: 17px;
      max-width: 800px;
      line-height: 1.55;
    }
    .lead {
      margin: 8px 0 0;
      color: var(--ink-faint);
      font-size: 14px;
      max-width: 800px;
      line-height: 1.5;
    }

    /* ---- Stats ---- */
    .stats-grid {
      margin-top: 28px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }
    .stat-card {
      padding: 16px 18px;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid var(--surface-border);
      border-radius: 14px;
      transition: border-color 0.2s;
    }
    .stat-card:hover {
      border-color: var(--accent-border);
    }
    .stat-label {
      display: block;
      color: var(--ink-muted);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .stat-value {
      font-size: 22px;
      font-weight: 800;
      color: #fff;
    }

    /* ---- Navigation ---- */
    .nav-pills {
      margin-top: 24px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .nav-pills a, .ghost-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      border-radius: 999px;
      text-decoration: none;
      color: var(--ink-muted);
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--surface-border);
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
      letter-spacing: 0.02em;
    }
    .nav-pills a:hover, .ghost-button:hover {
      background: var(--accent-soft);
      border-color: var(--accent-border);
      color: var(--accent);
      text-decoration: none;
    }

    /* ---- Sections ---- */
    .sections {
      margin-top: 24px;
      display: grid;
      gap: 18px;
    }

    .section-card {
      background: var(--surface);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 28px;
      scroll-margin-top: 24px;
      transition: border-color 0.2s;
    }
    .section-card.accent { border-left: 3px solid var(--cyan); }
    .section-card.info { border-left: 3px solid var(--magenta); }
    .section-card.warn { border-left: 3px solid var(--orange); }

    .section-head h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #fff;
    }
    .section-body { margin-top: 16px; }

    .bullets {
      margin: 0;
      padding-left: 20px;
      line-height: 1.6;
      color: var(--ink);
    }
    .bullets li + li { margin-top: 4px; }
    .empty {
      color: var(--ink-muted);
      font-style: italic;
      font-size: 14px;
    }

    /* ---- Toolbar ---- */
    .toolbar-card {
      background: var(--surface);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 20px 22px;
    }
    .toolbar-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 14px;
      align-items: end;
    }
    .control {
      display: grid;
      gap: 6px;
    }
    .control span {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--ink-muted);
      font-weight: 700;
    }
    .control input, .control select {
      appearance: none;
      width: 100%;
      padding: 11px 14px;
      border-radius: 12px;
      border: 1px solid var(--surface-border);
      background: rgba(255, 255, 255, 0.03);
      color: var(--ink);
      font: inherit;
      font-size: 13px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .control input:focus, .control select:focus {
      outline: none;
      border-color: var(--accent-border);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
    .control input::placeholder { color: var(--ink-faint); }
    .control select option {
      background: var(--surface-solid);
      color: var(--ink);
    }

    /* ---- Repo & Coverage Cards ---- */
    .coverage-grid, .repo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
    }
    .coverage-card, .repo-card {
      background: var(--surface);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 22px;
      transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
    }
    .repo-card:hover {
      border-color: var(--accent-border);
      box-shadow: var(--shadow), var(--glow-cyan);
      transform: translateY(-2px);
    }
    .coverage-card:hover {
      border-color: rgba(224, 64, 251, 0.18);
      box-shadow: var(--shadow), var(--glow-magenta);
    }
    .coverage-card h3, .repo-card h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #fff;
    }

    .repo-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .repo-badges {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
      flex-shrink: 0;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      border: 1px solid transparent;
      white-space: nowrap;
      letter-spacing: 0.02em;
    }
    .badge.accent {
      background: var(--accent-soft);
      color: var(--accent);
      border-color: var(--accent-border);
    }
    .badge.info {
      background: var(--info-soft);
      color: var(--info);
      border-color: var(--info-border);
    }
    .badge.warn {
      background: var(--warn-soft);
      color: var(--warn);
      border-color: var(--warn-border);
    }
    .badge.neutral {
      background: rgba(107, 115, 148, 0.1);
      color: #8b93b8;
      border-color: rgba(107, 115, 148, 0.15);
    }

    .repo-url { margin: 10px 0 0; font-size: 13px; }
    .repo-url a { color: var(--accent); }
    .repo-copy {
      color: var(--ink-muted);
      font-size: 14px;
      line-height: 1.5;
      margin: 8px 0 0;
    }

    .mini-grid {
      margin: 16px 0 0;
      display: grid;
      gap: 14px;
    }
    .mini-grid dt {
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--ink-muted);
      font-weight: 600;
      margin-bottom: 4px;
    }
    .mini-grid dd {
      margin: 0;
      line-height: 1.5;
      color: var(--ink);
      font-size: 14px;
    }

    .repo-details {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--surface-border);
    }
    .repo-details summary {
      cursor: pointer;
      font-weight: 700;
      font-size: 13px;
      color: var(--accent);
      letter-spacing: 0.02em;
      transition: color 0.15s;
    }
    .repo-details summary:hover { color: #66f0ff; }

    /* ---- Bar charts ---- */
    .bar-list {
      display: grid;
      gap: 10px;
      margin-top: 14px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(100px, 1fr) minmax(120px, 3fr) 36px;
      gap: 10px;
      align-items: center;
    }
    .bar-label {
      font-size: 12px;
      color: var(--ink-muted);
      font-weight: 500;
    }
    .bar-count {
      font-size: 12px;
      color: var(--ink-muted);
      text-align: right;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .bar-track {
      position: relative;
      height: 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      overflow: hidden;
    }
    .bar-fill {
      position: absolute;
      inset: 0 auto 0 0;
      background: linear-gradient(90deg, var(--cyan), var(--magenta));
      border-radius: inherit;
      transition: width 0.4s ease;
    }

    /* ---- Data table ---- */
    .table-wrap { overflow-x: auto; }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .data-table th, .data-table td {
      padding: 12px 10px;
      text-align: left;
      border-bottom: 1px solid var(--surface-border);
      vertical-align: top;
    }
    .data-table th {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--ink-muted);
      font-weight: 700;
    }
    .data-table tbody tr {
      transition: background 0.15s;
    }
    .data-table tbody tr:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    /* ---- Footer ---- */
    .report-footer {
      text-align: center;
      padding: 56px 24px 0;
      color: var(--ink-faint);
      font-size: 12px;
      letter-spacing: 0.04em;
    }
    .report-footer .brand-logo {
      width: 22px;
      height: auto;
      opacity: 0.35;
      margin: 0 auto 10px;
      display: block;
    }

    /* ---- Filter state ---- */
    .hidden-by-filter { display: none !important; }

    /* ---- Responsive ---- */
    @media (max-width: 720px) {
      .page { padding: 18px 14px 48px; }
      .hero { padding: 24px 20px; border-radius: var(--radius); }
      .hero::after { display: none; }
      .page::before, .page::after { display: none; }
      .section-card, .coverage-card, .repo-card { padding: 18px; border-radius: 14px; }
      .repo-head { flex-direction: column; }
      .repo-badges { justify-content: flex-start; }
      h1 { font-size: 32px; }
      .stats-grid { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <div class="brand-bar">
        ${LOGO_SVG}
        <span class="brand-name">Patternpilot</span>
      </div>
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
      <p class="lead">${escapeHtml(lead)}</p>
      <section class="stats-grid">
        ${renderHtmlStatCards(stats)}
      </section>
      ${navItems ? `<nav class="nav-pills">${navItems}</nav>` : ""}
    </header>
    <div class="sections">
      ${renderReportToolbar({ modeOptions, layerOptions })}
      ${sections.map((section) => renderHtmlSection(section.title, section.body, section.tone ?? "default", section.id ?? slugifyForId(section.title))).join("\n")}
    </div>
    <footer class="report-footer">
      ${LOGO_SVG}
      <p>Generated by Patternpilot &mdash; Repo Intelligence System</p>
    </footer>
  </main>
  <script>
    (() => {
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
