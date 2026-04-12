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
    <button class="ghost-button" id="report-reset" type="button">Reset</button>
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
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
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
      --red: #ff1744;
      --blue: #2979ff;
      --yellow: #ffea00;
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

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background:
        radial-gradient(1200px circle at 5% 0%, rgba(0, 229, 255, 0.07), transparent 70%),
        radial-gradient(1000px circle at 95% 20%, rgba(224, 64, 251, 0.055), transparent 70%),
        radial-gradient(1100px circle at 30% 85%, rgba(0, 230, 118, 0.04), transparent 70%),
        radial-gradient(800px circle at 80% 70%, rgba(255, 145, 0, 0.03), transparent 70%);
      pointer-events: none;
      z-index: 0;
    }

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.07); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.14); }

    a { color: var(--accent); text-decoration: none; transition: color 0.2s; }
    a:hover { color: #80f0ff; }

    /* ---- Page ---- */
    .page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 56px 140px;
      position: relative;
      z-index: 1;
    }

    /* ---- Hero ---- */
    .hero {
      padding: 100px 0 80px;
      position: relative;
    }

    .hero::after {
      content: "";
      position: absolute;
      top: 80px;
      right: 0;
      width: 44px;
      height: 44px;
      border-radius: 10px;
      opacity: 0.07;
      background: var(--cyan);
      box-shadow:
        56px 0 0 var(--magenta),
        112px 0 0 var(--magenta),
        56px 56px 0 var(--orange),
        112px 56px 0 var(--green),
        112px 112px 0 var(--blue),
        0 56px 0 var(--cyan);
      pointer-events: none;
      animation: deco-drift 20s ease-in-out infinite alternate;
    }

    @keyframes deco-drift {
      0% { transform: translate(0, 0) rotate(0deg); opacity: 0.07; }
      50% { opacity: 0.12; }
      100% { transform: translate(-12px, 16px) rotate(3deg); opacity: 0.07; }
    }

    @keyframes block-fall {
      0% { transform: translateY(-32px); opacity: 0; }
      70% { transform: translateY(3px); opacity: 1; }
      100% { transform: translateY(0); opacity: 1; }
    }
    .hero .brand-logo rect {
      animation: block-fall 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .hero .brand-logo rect:nth-child(1) { animation-delay: 0.08s; }
    .hero .brand-logo rect:nth-child(2) { animation-delay: 0.16s; }
    .hero .brand-logo rect:nth-child(3) { animation-delay: 0.24s; }
    .hero .brand-logo rect:nth-child(4) { animation-delay: 0.32s; }
    .hero .brand-logo rect:nth-child(5) { animation-delay: 0.4s; }

    @keyframes rise-in {
      0% { transform: translateY(40px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }

    .brand-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 52px;
      animation: rise-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;
    }
    .brand-logo {
      width: 48px;
      height: auto;
      filter: drop-shadow(0 0 20px rgba(0, 229, 255, 0.3));
    }
    .brand-name {
      font-family: 'Syne', sans-serif;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }

    .eyebrow {
      font-family: 'Manrope', sans-serif;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      font-size: 13px;
      color: var(--cyan);
      margin: 0 0 24px;
      font-weight: 700;
      text-shadow: 0 0 36px rgba(0, 229, 255, 0.5);
      animation: rise-in 0.6s ease 0.2s both;
    }

    h1 {
      font-family: 'Syne', sans-serif;
      font-size: clamp(52px, 7.5vw, 104px);
      font-weight: 800;
      line-height: 0.92;
      letter-spacing: -0.04em;
      max-width: 900px;
      color: #fff;
      animation: rise-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both;
    }

    .subtitle {
      margin: 36px 0 0;
      color: var(--ink);
      font-size: 20px;
      max-width: 720px;
      line-height: 1.65;
      font-weight: 400;
      animation: rise-in 0.7s ease 0.45s both;
    }
    .lead {
      margin: 14px 0 0;
      color: var(--ink-muted);
      font-size: 16px;
      max-width: 720px;
      line-height: 1.6;
      font-weight: 400;
      animation: rise-in 0.6s ease 0.55s both;
    }

    /* ---- Stats ---- */
    .stats-strip {
      padding: 0 0 56px;
      animation: rise-in 0.6s ease 0.65s both;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
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
      border-color: rgba(255, 255, 255, 0.12);
      transform: translateY(-3px);
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
    }
    .stat-label {
      display: block;
      color: var(--ink-muted);
      font-size: 12px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-weight: 700;
      margin-bottom: 14px;
    }
    .stat-value {
      font-family: 'Syne', sans-serif;
      font-size: 36px;
      font-weight: 800;
      color: var(--ink-bright);
      line-height: 1;
    }

    /* ---- Navigation ---- */
    .nav-strip {
      padding: 0 0 52px;
      animation: rise-in 0.5s ease 0.8s both;
    }
    .nav-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .nav-pills a, .ghost-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 14px 28px;
      border-radius: 999px;
      text-decoration: none;
      color: var(--ink-muted);
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--surface-border);
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.3s;
      letter-spacing: 0.02em;
    }
    .nav-pills a:hover, .ghost-button:hover {
      background: var(--accent-soft);
      border-color: var(--accent-border);
      color: var(--accent);
      text-decoration: none;
      transform: translateY(-2px);
      box-shadow: 0 4px 24px rgba(0, 229, 255, 0.1);
    }

    /* ---- Sections ---- */
    .sections {
      display: grid;
      gap: 36px;
    }

    .section-card {
      background: var(--surface);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius-lg);
      padding: 56px 60px;
      scroll-margin-top: 32px;
      border-left: 4px solid transparent;
    }
    .section-card.accent { border-left-color: var(--cyan); }
    .section-card.info { border-left-color: var(--magenta); }
    .section-card.warn { border-left-color: var(--orange); }

    .section-head h2 {
      font-family: 'Syne', sans-serif;
      margin: 0;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #fff;
    }
    .section-body { margin-top: 32px; }

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
      line-height: 1.6;
    }

    /* ---- Toolbar ---- */
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
    .control {
      display: grid;
      gap: 10px;
    }
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
      background: rgba(255, 255, 255, 0.03);
      color: var(--ink);
      font: inherit;
      font-size: 15px;
      transition: border-color 0.3s, box-shadow 0.3s;
    }
    .control input:focus, .control select:focus {
      outline: none;
      border-color: var(--accent-border);
      box-shadow: 0 0 0 4px var(--accent-soft), 0 0 32px rgba(0, 229, 255, 0.08);
    }
    .control input::placeholder { color: var(--ink-faint); }
    .control select option { background: var(--surface-solid); color: var(--ink); }

    /* ---- Cards ---- */
    .coverage-grid, .repo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 24px;
    }
    .coverage-card, .repo-card {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--surface-border);
      border-radius: var(--radius);
      padding: 40px 44px;
      transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s;
    }
    .coverage-card h3, .repo-card h3 {
      font-family: 'Syne', sans-serif;
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 700;
      color: var(--ink-bright);
    }

    .repo-grid .repo-card:nth-child(5n+1):hover { border-color: rgba(0, 229, 255, 0.35); box-shadow: 0 12px 56px rgba(0, 229, 255, 0.1), 0 0 0 1px rgba(0, 229, 255, 0.12); transform: translateY(-4px); }
    .repo-grid .repo-card:nth-child(5n+2):hover { border-color: rgba(224, 64, 251, 0.35); box-shadow: 0 12px 56px rgba(224, 64, 251, 0.1), 0 0 0 1px rgba(224, 64, 251, 0.12); transform: translateY(-4px); }
    .repo-grid .repo-card:nth-child(5n+3):hover { border-color: rgba(255, 145, 0, 0.35); box-shadow: 0 12px 56px rgba(255, 145, 0, 0.1), 0 0 0 1px rgba(255, 145, 0, 0.12); transform: translateY(-4px); }
    .repo-grid .repo-card:nth-child(5n+4):hover { border-color: rgba(0, 230, 118, 0.35); box-shadow: 0 12px 56px rgba(0, 230, 118, 0.1), 0 0 0 1px rgba(0, 230, 118, 0.12); transform: translateY(-4px); }
    .repo-grid .repo-card:nth-child(5n+5):hover { border-color: rgba(41, 121, 255, 0.35); box-shadow: 0 12px 56px rgba(41, 121, 255, 0.1), 0 0 0 1px rgba(41, 121, 255, 0.12); transform: translateY(-4px); }

    .coverage-card:hover {
      border-color: rgba(224, 64, 251, 0.25);
      box-shadow: 0 12px 56px rgba(224, 64, 251, 0.08);
      transform: translateY(-3px);
    }

    .repo-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 4px;
    }
    .repo-badges {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }

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
    .badge.accent {
      background: var(--accent-soft);
      color: var(--accent);
      border-color: var(--accent-border);
      text-shadow: 0 0 14px rgba(0, 229, 255, 0.3);
    }
    .badge.info {
      background: var(--info-soft);
      color: var(--info);
      border-color: var(--info-border);
      text-shadow: 0 0 14px rgba(224, 64, 251, 0.3);
    }
    .badge.warn {
      background: var(--warn-soft);
      color: var(--warn);
      border-color: var(--warn-border);
      text-shadow: 0 0 14px rgba(255, 145, 0, 0.3);
    }
    .badge.neutral {
      background: rgba(85, 88, 120, 0.14);
      color: #8890b0;
      border-color: rgba(85, 88, 120, 0.2);
    }

    .repo-url { margin: 16px 0 0; font-size: 15px; }
    .repo-copy {
      color: var(--ink-muted);
      font-size: 16px;
      line-height: 1.6;
      margin: 14px 0 0;
    }

    .mini-grid {
      margin: 28px 0 0;
      display: grid;
      gap: 20px;
    }
    .mini-grid dt {
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--ink-muted);
      font-weight: 700;
      margin-bottom: 6px;
    }
    .mini-grid dd {
      margin: 0;
      line-height: 1.6;
      color: var(--ink);
      font-size: 16px;
    }

    .repo-details {
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid var(--surface-border);
    }
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

    /* ---- Bar charts ---- */
    .bar-list {
      display: grid;
      gap: 16px;
      margin-top: 20px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(120px, 1fr) minmax(140px, 3fr) 40px;
      gap: 14px;
      align-items: center;
    }
    .bar-label {
      font-size: 14px;
      color: var(--ink-muted);
      font-weight: 500;
    }
    .bar-count {
      font-size: 14px;
      color: var(--ink-muted);
      text-align: right;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .bar-track {
      position: relative;
      height: 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      overflow: hidden;
    }
    .bar-fill {
      position: absolute;
      inset: 0 auto 0 0;
      border-radius: inherit;
      transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .bar-row:nth-child(5n+1) .bar-fill { background: var(--cyan); box-shadow: 0 0 14px rgba(0, 229, 255, 0.4); }
    .bar-row:nth-child(5n+2) .bar-fill { background: var(--magenta); box-shadow: 0 0 14px rgba(224, 64, 251, 0.4); }
    .bar-row:nth-child(5n+3) .bar-fill { background: var(--orange); box-shadow: 0 0 14px rgba(255, 145, 0, 0.4); }
    .bar-row:nth-child(5n+4) .bar-fill { background: var(--green); box-shadow: 0 0 14px rgba(0, 230, 118, 0.4); }
    .bar-row:nth-child(5n+5) .bar-fill { background: var(--blue); box-shadow: 0 0 14px rgba(41, 121, 255, 0.4); }

    /* ---- Data table ---- */
    .table-wrap { overflow-x: auto; }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 15px;
    }
    .data-table th, .data-table td {
      padding: 18px 16px;
      text-align: left;
      border-bottom: 1px solid var(--surface-border);
      vertical-align: top;
    }
    .data-table th {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: var(--ink-muted);
      font-weight: 700;
    }
    .data-table tbody tr { transition: background 0.2s; }
    .data-table tbody tr:hover { background: rgba(255, 255, 255, 0.025); }

    /* ---- Footer ---- */
    .report-footer {
      text-align: center;
      padding: 100px 24px 0;
      color: var(--ink-faint);
      font-size: 14px;
      letter-spacing: 0.06em;
    }
    .report-footer .brand-logo {
      width: 32px;
      height: auto;
      opacity: 0.25;
      margin: 0 auto 16px;
      display: block;
      filter: none;
    }

    /* ---- Scroll reveal ---- */
    .reveal {
      opacity: 0;
      transform: translateY(32px);
      transition: opacity 0.6s ease, transform 0.6s ease;
    }
    .reveal.in-view {
      opacity: 1;
      transform: translateY(0);
    }

    .hidden-by-filter { display: none !important; }

    /* ---- Responsive ---- */
    @media (max-width: 720px) {
      .page { padding: 0 20px 72px; }
      .hero { padding: 56px 0 40px; }
      .hero::after { display: none; }
      .stats-strip { padding: 0 0 36px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
      .stat-card { padding: 24px; }
      .stat-value { font-size: 28px; }
      .nav-strip { padding: 0 0 32px; }
      .nav-pills a { padding: 12px 20px; font-size: 13px; }
      .section-card { padding: 36px 28px; border-radius: var(--radius); }
      .coverage-card, .repo-card { padding: 28px; }
      .coverage-grid, .repo-grid { grid-template-columns: 1fr; }
      .repo-head { flex-direction: column; }
      .repo-badges { justify-content: flex-start; }
      h1 { font-size: 40px; line-height: 1; }
      .toolbar-card { padding: 28px 24px; }
    }
  </style>
</head>
<body>
  <svg class="grain" aria-hidden="true" style="position:fixed;inset:0;width:100%;height:100%;opacity:0.022;pointer-events:none;z-index:9999;mix-blend-mode:overlay"><filter id="g"><feTurbulence baseFrequency="0.55" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>

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
    </header>
    <section class="stats-strip">
      <div class="stats-grid">
        ${renderHtmlStatCards(stats)}
      </div>
    </section>
    ${navItems ? `<nav class="nav-strip"><div class="nav-pills">${navItems}</div></nav>` : ""}
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
