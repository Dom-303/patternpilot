import { uniqueStrings } from "./utils.mjs";
import { resolveReportView, resolveDiscoveryProfile } from "./constants.mjs";

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
  <style>
    :root {
      --bg: #f5f1e8;
      --panel: #fffdf8;
      --ink: #16202a;
      --muted: #5d6b78;
      --line: #ddd4c5;
      --accent: #bb4d00;
      --accent-soft: #ffe3cf;
      --info: #0b7285;
      --info-soft: #dff4f8;
      --warn: #8f3d2e;
      --warn-soft: #f8ddd7;
      --shadow: 0 22px 60px rgba(22, 32, 42, 0.08);
      --radius: 20px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(187, 77, 0, 0.12), transparent 32%),
        linear-gradient(180deg, #fbf8f2 0%, var(--bg) 100%);
    }
    .page {
      max-width: 1320px;
      margin: 0 auto;
      padding: 40px 24px 72px;
    }
    .hero {
      background: linear-gradient(135deg, rgba(255,255,255,0.96), rgba(255,249,240,0.96));
      border: 1px solid rgba(221, 212, 197, 0.9);
      border-radius: 28px;
      padding: 32px;
      box-shadow: var(--shadow);
      position: relative;
      overflow: hidden;
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: auto -60px -80px auto;
      width: 240px;
      height: 240px;
      background: radial-gradient(circle, rgba(187, 77, 0, 0.18), transparent 66%);
    }
    .eyebrow {
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-size: 12px;
      color: var(--accent);
      margin: 0 0 12px;
      font-weight: 700;
    }
    h1 {
      margin: 0;
      font-size: clamp(32px, 5vw, 56px);
      line-height: 0.96;
      max-width: 900px;
    }
    .subtitle {
      margin: 16px 0 0;
      color: var(--muted);
      font-size: 18px;
      max-width: 900px;
      line-height: 1.5;
    }
    .stats-grid {
      margin-top: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 14px;
    }
    .stat-card, .section-card, .coverage-card, .repo-card, .toolbar-card {
      background: var(--panel);
      border: 1px solid rgba(221, 212, 197, 0.95);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
    .stat-card {
      padding: 18px;
    }
    .stat-label {
      display: block;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .stat-value {
      font-size: 26px;
    }
    .sections {
      margin-top: 24px;
      display: grid;
      gap: 20px;
    }
    .nav-pills {
      margin-top: 18px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .nav-pills a, .ghost-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 14px;
      border-radius: 999px;
      text-decoration: none;
      color: var(--ink);
      background: rgba(255,255,255,0.82);
      border: 1px solid rgba(221, 212, 197, 0.9);
      font-weight: 600;
      cursor: pointer;
    }
    .toolbar-card {
      padding: 18px 20px;
    }
    .toolbar-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      align-items: end;
    }
    .control {
      display: grid;
      gap: 8px;
    }
    .control span {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      font-weight: 700;
    }
    .control input, .control select {
      appearance: none;
      width: 100%;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(221, 212, 197, 0.95);
      background: rgba(255,255,255,0.96);
      color: var(--ink);
      font: inherit;
    }
    .section-card {
      padding: 24px;
      scroll-margin-top: 24px;
    }
    .section-head h2, .coverage-card h3, .repo-card h3 {
      margin: 0;
      font-size: 22px;
    }
    .section-body { margin-top: 16px; }
    .bullets {
      margin: 0;
      padding-left: 18px;
      line-height: 1.55;
    }
    .empty, .repo-copy, .repo-url, .mini-grid dd, .mini-grid dt, .table-wrap table {
      color: var(--muted);
    }
    .coverage-grid, .repo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    .coverage-card, .repo-card {
      padding: 20px;
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
      gap: 8px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .badge.accent { background: var(--accent-soft); color: var(--accent); border-color: rgba(187, 77, 0, 0.18); }
    .badge.info { background: var(--info-soft); color: var(--info); border-color: rgba(11, 114, 133, 0.18); }
    .badge.warn { background: var(--warn-soft); color: var(--warn); border-color: rgba(143, 61, 46, 0.16); }
    .badge.neutral { background: #f1ece4; color: #50606f; border-color: rgba(80, 96, 111, 0.12); }
    .repo-url a { color: var(--accent); text-decoration: none; }
    .mini-grid {
      margin: 14px 0 0;
      display: grid;
      gap: 12px;
    }
    .mini-grid dt {
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .mini-grid dd { margin: 0; line-height: 1.5; }
    .table-wrap { overflow-x: auto; }
    .repo-details {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(221, 212, 197, 0.9);
    }
    .repo-details summary {
      cursor: pointer;
      font-weight: 700;
      color: var(--accent);
    }
    .bar-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(110px, 1fr) minmax(120px, 3fr) 40px;
      gap: 12px;
      align-items: center;
    }
    .bar-label, .bar-count {
      font-size: 13px;
      color: var(--muted);
    }
    .bar-track {
      position: relative;
      height: 10px;
      border-radius: 999px;
      background: #efe5d8;
      overflow: hidden;
    }
    .bar-fill {
      position: absolute;
      inset: 0 auto 0 0;
      background: linear-gradient(90deg, #ffb98c, #bb4d00);
      border-radius: inherit;
    }
    .hidden-by-filter {
      display: none !important;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .data-table th, .data-table td {
      padding: 12px 10px;
      text-align: left;
      border-bottom: 1px solid rgba(221, 212, 197, 0.9);
      vertical-align: top;
    }
    .data-table th {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    @media (max-width: 720px) {
      .page { padding: 18px 14px 44px; }
      .hero, .section-card, .coverage-card, .repo-card { padding: 18px; }
      .repo-head { flex-direction: column; }
      .repo-badges { justify-content: flex-start; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
      <p class="subtitle">${escapeHtml(lead)}</p>
      <section class="stats-grid">
        ${renderHtmlStatCards(stats)}
      </section>
      ${navItems ? `<nav class="nav-pills">${navItems}</nav>` : ""}
    </header>
    <div class="sections">
      ${renderReportToolbar({ modeOptions, layerOptions })}
      ${sections.map((section) => renderHtmlSection(section.title, section.body, section.tone ?? "default", section.id ?? slugifyForId(section.title))).join("\n")}
    </div>
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
