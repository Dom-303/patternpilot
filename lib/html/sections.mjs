import {
  buildBadgeExplainAttrs,
  dispositionTone,
  escapeHtml,
  fitTone,
  localizeDisposition,
  localizeFitBand,
  localizeGeneratedText,
  localizeSystemTerm,
  renderBadge,
  renderFilterIndicator,
  renderHtmlList,
  slugifyForId
} from "./shared.mjs";
import { renderInfoGrid, renderInfoCard, renderTabs } from "./components.mjs";
import { getSectionInfo } from "./section-info.mjs";
import { termHtml } from "./glossary.mjs";

function renderInlineSectionDescription(sectionId) {
  const info = getSectionInfo(sectionId);
  if (!info) return "";
  return `<details class="section-description">
  <summary><span class="section-description-label">Beschreibung</span></summary>
  <div class="section-description-body"><p>${escapeHtml(info.body)}</p></div>
</details>`;
}

// Konsolidierte Empfehlungen-Section: buendelt drei komplementaere Sichten
// auf dieselben Daten in einer Section mit Tabs.
// Tab 1 "Top-Rang" = knackige Prio-Liste fuer den ersten Blick
// Tab 2 "Nach Disposition" = Gruppierung nach Handlungstyp fuer Planung
// Tab 3 "Entscheidungs-Begruendung" = pro Top-Kandidat WARUM + Impact
//   — fuer Leute die tatsaechlich entscheiden muessen
export function renderEmpfehlungenSection({
  recommendations = [],
  candidates = [],
  reportType,
  runRoot,
  discovery,
  review,
  renderTopRecommendations,
  renderRecommendedActions
} = {}) {
  if (typeof renderTopRecommendations !== "function" || typeof renderRecommendedActions !== "function") {
    throw new Error("renderEmpfehlungenSection: renderTopRecommendations + renderRecommendedActions Callbacks werden benoetigt (aus shared.mjs)");
  }
  const recsLen = recommendations?.length ?? 0;
  const candLen = candidates?.length ?? 0;
  const countChip = recsLen > 0 ? `${recsLen} Top · ${candLen} gruppiert` : candLen > 0 ? `${candLen} Kandidaten` : "leer";

  // Tab 3: Entscheidungs-Begruendung pro Top-Kandidat
  const topForReasoning = (candidates ?? []).slice(0, 5);
  const reasoningBody = topForReasoning.length === 0
    ? `<p class="empty">Noch keine Kandidaten mit Begruendung verfuegbar. Sobald Discovery Treffer liefert, werden sie hier mit Pro/Contra + Impact-Schaetzung einsortiert.</p>`
    : `<div class="decision-reasoning-list">${topForReasoning.map((c, i) => {
        const name = c.repo ? `${c.repo.owner}/${c.repo.name}` : (c.repoRef ?? "unbekannt");
        const disposition = c.discoveryDisposition ?? c.reviewDisposition ?? "unknown";
        const badge = disposition === "intake_now" ? { tone: "adopt", label: "Uebernehmen" }
                    : disposition === "review_queue" ? { tone: "adapt", label: "Vertiefen" }
                    : { tone: "observe", label: "Beobachten" };
        const score = c.discoveryScore ?? c.reviewScore ?? null;
        const fitBand = c.projectAlignment?.fitBand ?? c.projectFitBand ?? "unknown";
        const matchedCaps = c.projectAlignment?.matchedCapabilities ?? c.matchedCapabilities ?? [];
        const evidenceGrade = c.discoveryEvidence?.grade ?? "light";
        const pros = [];
        if (fitBand === "high") pros.push("Hohe Projekt-Passung");
        if (matchedCaps.length >= 3) pros.push(`${matchedCaps.length} matched capabilities`);
        if (evidenceGrade === "strong") pros.push("Starke Evidenz-Signale");
        if ((score ?? 0) >= 7) pros.push(`Score ${score} ueber 7`);
        const contras = [];
        if (fitBand === "low") contras.push("Niedrige Passung — Transfer unsicher");
        if (evidenceGrade === "light") contras.push("Wenig Evidenz — manuell pruefen");
        if (Array.isArray(c.risks) && c.risks.length > 0) contras.push(`${c.risks.length} explizite Risikosignale`);
        const impact = fitBand === "high" && matchedCaps.length >= 2 ? "hoch"
                     : fitBand === "medium" ? "mittel" : "niedrig";
        const alternative = topForReasoning[i + 1] ? `${topForReasoning[i + 1].repo?.owner ?? ""}/${topForReasoning[i + 1].repo?.name ?? topForReasoning[i + 1].repoRef ?? ""}` : null;
        return `<div class="decision-reasoning-item">
  <div class="decision-reasoning-head">
    <span class="decision-reasoning-rank">${String(i + 1).padStart(2, "0")}</span>
    <span class="decision-reasoning-name">${escapeHtml(name)}</span>
    <span class="badge ${badge.tone}">${escapeHtml(badge.label)}</span>
    <span class="decision-reasoning-impact impact-${impact}">Impact ${escapeHtml(impact)}</span>
  </div>
  <div class="decision-reasoning-body">
    <div class="decision-reasoning-col">
      <div class="decision-reasoning-col-title">Pro</div>
      <ul>${pros.length > 0 ? pros.map((p) => `<li>${escapeHtml(p)}</li>`).join("") : `<li class="empty-hint">Keine automatischen Pro-Signale.</li>`}</ul>
    </div>
    <div class="decision-reasoning-col">
      <div class="decision-reasoning-col-title">Contra / Pruefen</div>
      <ul>${contras.length > 0 ? contras.map((c) => `<li>${escapeHtml(c)}</li>`).join("") : `<li class="empty-hint">Keine automatischen Warnsignale.</li>`}</ul>
    </div>
  </div>
  ${alternative ? `<div class="decision-reasoning-alt">Alternative im gleichen Lauf: <strong>${escapeHtml(alternative)}</strong></div>` : ""}
</div>`;
      }).join("")}</div>`;

  return renderTabbedSection({
    id: "empfehlungen",
    title: "Empfehlungen",
    sub: "Top-Rang · Gruppiert · Begruendung",
    accent: "magenta",
    countChip,
    tabs: [
      {
        label: "Top-Rang (kurz)",
        body: renderTopRecommendations(recommendations, candidates)
      },
      {
        label: "Nach Disposition gruppiert",
        body: renderRecommendedActions({ candidates, reportType, runRoot, discovery, review, bodyOnly: true })
      },
      {
        label: "Entscheidungs-Begruendung",
        body: reasoningBody
      }
    ]
  });
}

// Konsolidierte Tab-Section: fasst mehrere verwandte Sub-Sections in einer
// section-preview mit Tabs zusammen. Nutzt getSectionInfo fuer die
// Haupt-Beschreibung, plus individuelle tabs mit label + body.
export function renderTabbedSection({ id, title, sub, accent = "magenta", countChip = "", tabs = [] } = {}) {
  const idAttr = id ? ` id="${escapeHtml(id)}" data-nav-section` : "";
  const accentClass = `accent-${accent}`;
  const description = renderInlineSectionDescription(id);
  const countFragment = countChip
    ? `<div class="head-actions"><span class="count-chip">${escapeHtml(countChip)}</span></div>`
    : "";
  const subFragment = sub ? `<div class="sub">${escapeHtml(sub)}</div>` : "";
  return `<section class="section-preview ${accentClass}"${idAttr}>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>${escapeHtml(title)}</h2>
      ${subFragment}
    </div>
    ${countFragment}
  </div>
  ${description}
  <div class="section-body">
    ${renderTabs(tabs)}
  </div>
</section>`;
}
import { getRenderedProjectRelevance } from "../legacy-project-fields.mjs";

function localizeAgentPayload(value) {
  const keyMap = {
    schemaVersion: "schemaVersion",
    handoffType: "handoffTyp",
    reportType: "berichtstyp",
    projectKey: "projekt",
    runConfidence: "laufvertrauen",
    runConfidenceReason: "laufvertrauenBegruendung",
    scanned: "gescannt",
    candidateCount: "kandidaten",
    topCandidates: "topKandidaten",
    reviewScope: "reviewUmfang",
    topRepos: "priorisierteRepos",
    repos: "repos",
    sourceMode: "quellmodus",
    effectiveUrls: "wirksameUrls",
    governance: "governance",
    drift: "drift",
    stability: "stabilitaet",
    fitBand: "passung",
    mainLayer: "ebene",
    gapArea: "lueckenbereich",
    nextStep: "naechsterSchritt",
    disposition: "einordnung",
    runId: "laufId",
    repo: "repo",
    url: "url",
    nextActions: "naechsteSchritte",
    mission: "auftrag",
    deliverable: "lieferziel",
    context: "kontext",
    summary: "zusammenfassung",
    targetRepoContext: "zielrepoKontext",
    projectLabel: "projektLabel",
    projectRoot: "projektRoot",
    firstReadFiles: "zuerstLesen",
    missingConfiguredFiles: "fehlendeKontextdateien",
    referenceDirectories: "referenzVerzeichnisse",
    extractedCapabilities: "extrahierteFaehigkeiten",
    targetCapabilities: "zielFaehigkeiten",
    analysisQuestions: "analysefragen",
    guardrails: "leitplanken",
    uncertainties: "unsicherheiten",
    whyRelevant: "warumRelevant",
    evidence: "evidenz",
    transferablePattern: "transfermuster",
    strengths: "staerken",
    risks: "risiken",
    reviewScore: "reviewScore",
    discoveryScore: "discoveryScore",
    matchedCapabilities: "passendeFaehigkeiten",
    recommendedTargetAreas: "empfohleneZielbereiche",
    observedRepoAreas: "beobachteteRepoBereiche",
    codingStarter: "codingStarter",
    primary: "primaer",
    secondary: "sekundaer",
    starterLabel: "starterLabel",
    starterMode: "starterModus",
    implementationGoal: "umsetzungsziel",
    firstSlice: "ersterSchnitt",
    compareChecklist: "vergleichscheckliste",
    stopIf: "stoppWenn",
    visibleTopCount: "sichtbareTopEintraege",
    missingIntakeCount: "fehlendesIntake",
    queryCount: "suchanfragen",
    policyMode: "regelmodus",
    blockedCandidates: "markierteKandidaten",
    codingStarterAvailable: "codingStarterVerfuegbar",
    codingStarterCount: "codingStarterAnzahl",
    prototypeReadyRepos: "prototypBereiteRepos"
  };

  if (Array.isArray(value)) {
    return value.map((entry) => localizeAgentPayload(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [keyMap[key] ?? key, localizeAgentPayload(entry)])
    );
  }
  if (typeof value === "string") {
    const valueMap = {
      review: "Vergleich",
      discovery: "Discovery",
      on_demand: "Ad-hoc-Lauf",
      selected_urls: "explizite URLs",
      watchlist: "Beobachtungsliste"
    };
    if (valueMap[value]) {
      return valueMap[value];
    }
    return localizeGeneratedText(localizeSystemTerm(value));
  }
  return value;
}

const DISCOVERY_BADGE_MAP = {
  intake_now: { tone: "adopt", label: "Uebernehmen" },
  review_queue: { tone: "adapt", label: "Vertiefen" },
  observe_only: { tone: "observe", label: "Beobachten" },
  watch_only: { tone: "observe", label: "Beobachten" }
};

function joinList(items, fallback = "-") {
  const values = (items ?? [])
    .map((item) => localizeGeneratedText(localizeSystemTerm(item)))
    .filter(Boolean);
  return values.length > 0 ? values.join(", ") : fallback;
}

function buildDiscoveryWhyRelevant(candidate) {
  const evidence = candidate.discoveryEvidence ?? {};
  const queryFamilies = joinList(candidate.queryFamilies ?? [], "");
  const matchedCapabilities = joinList(candidate.projectAlignment?.matchedCapabilities ?? [], "");
  const sourceFamilyHits = Number(evidence.sourceFamilyHits ?? 0) || 0;
  const publicEventHits = Number(evidence.publicEventIntakeHits ?? 0) || 0;
  const governanceHits = Number(evidence.governanceHits ?? 0) || 0;
  const normalizationHits = Number(evidence.normalizationHits ?? 0) || 0;
  const signalParts = [];
  if (sourceFamilyHits > 0) signalParts.push(`${sourceFamilyHits} Quellfamilien-Signale`);
  if (publicEventHits > 0) signalParts.push(`${publicEventHits} Public-Event-Signale`);
  if (governanceHits > 0) signalParts.push(`${governanceHits} Governance-Signale`);
  if (normalizationHits > 0) signalParts.push(`${normalizationHits} Normalisierungs-Signale`);
  const signalSentence = signalParts.length > 0 ? ` Ausschlaggebend sind ${signalParts.join(", ")}.` : "";
  const familySentence = queryFamilies ? ` Aktiv ueber die Suchbahnen ${queryFamilies} gefunden.` : "";
  const capabilitySentence = matchedCapabilities ? ` Beruehrt vor allem ${matchedCapabilities}.` : "";
  return `Das Repo zeigt fuer das Zielprojekt ein belastbares Muster in der Discovery.${signalSentence}${familySentence}${capabilitySentence}`.trim();
}

function buildDiscoveryEvidenceText(candidate) {
  const evidence = candidate.discoveryEvidence ?? {};
  const grade = localizeSystemTerm(evidence.grade ?? "light");
  const score = evidence.score ?? 0;
  const parts = [];
  if ((evidence.topicHits?.length ?? 0) > 0) parts.push(`Themen: ${evidence.topicHits.slice(0, 3).join(", ")}`);
  if ((evidence.readmeHits?.length ?? 0) > 0) parts.push(`README: ${evidence.readmeHits.slice(0, 3).join(", ")}`);
  if ((evidence.keywordHits?.length ?? 0) > 0) parts.push(`Projektbegriffe: ${evidence.keywordHits.slice(0, 3).join(", ")}`);
  const tail = parts.length > 0 ? ` · ${parts.join(" · ")}` : "";
  return `${grade} (${score})${tail}`;
}

function buildDiscoveryStrengths(candidate) {
  const repo = candidate.enrichment?.repo ?? {};
  const capabilities = joinList(candidate.projectAlignment?.matchedCapabilities ?? [], "");
  const topics = Array.isArray(repo.topics) ? repo.topics.slice(0, 4).join(", ") : "";
  const languageList = Array.isArray(candidate.enrichment?.languages) ? candidate.enrichment.languages.slice(0, 3).join(", ") : "";
  const parts = [];
  if (capabilities) parts.push(`Passende Faehigkeiten: ${capabilities}`);
  if (topics) parts.push(`Repo-Themen: ${topics}`);
  if (languageList) parts.push(`Sprachen: ${languageList}`);
  if (repo.stars) parts.push(`Sichtbarkeit: ${repo.stars} Sterne`);
  return parts.length > 0 ? parts.join(" · ") : "Der Treffer zeigt eine brauchbare technische Anschlussfaehigkeit und sollte fachlich eingeordnet werden.";
}

function buildDiscoveryRisks(candidate) {
  const risks = Array.isArray(candidate.risks) ? candidate.risks : [];
  const evidence = candidate.discoveryEvidence ?? {};
  const localizedRisks = risks
    .map((item) => localizeGeneratedText(localizeSystemTerm(item)))
    .filter(Boolean);
  if (localizedRisks.length > 0) {
    return `${localizedRisks.join(", ")}. Vor einer Uebernahme den realen Transfer ins Zielprojekt manuell pruefen.`;
  }
  if ((evidence.nicheVerticalHits ?? 0) > 0) {
    return "Das Repo wirkt fachlich spezialisiert. Vor einer Uebernahme pruefen, ob wirklich ein uebertragbares Infrastrukturmuster und nicht nur ein Nischenfall vorliegt.";
  }
  return "Vor einer Uebernahme pruefen, ob die sichtbaren Muster tragfaehig fuer das Zielprojekt sind und nicht nur lokal gut aussehen.";
}

function isEmptyCellValue(value) {
  const s = String(value ?? "").trim();
  return s === "" || s === "-" || s.toLowerCase() === "unbekannt" || s.toLowerCase() === "unknown";
}

function renderRepoBodyCell(key, value, options = {}) {
  const empty = isEmptyCellValue(value);
  const reason = options.emptyReason ?? "Dieses Repo liefert dazu keine verwertbaren Signale.";
  const bodyFragment = empty
    ? `<div class="repo-body-value repo-body-value--empty">Keine Information vorhanden<span class="repo-body-empty-reason">${escapeHtml(reason)}</span></div>`
    : `<div class="repo-body-value">${escapeHtml(value)}</div>`;
  return `<div class="repo-body-cell${options.wide ? " wide" : ""}">
      <div class="repo-body-key">${escapeHtml(key)}</div>
      ${bodyFragment}
    </div>`;
}

function renderRepoBodyListCell(key, items, fallback, fallbackReason) {
  const list = (items ?? []).filter(Boolean);
  const reason = fallbackReason ?? "Dieses Repo liefert dazu keine verwertbaren Signale.";
  const body = list.length > 0
    ? `<ul class="repo-body-list">${list.map((it) => `<li>${escapeHtml(it)}</li>`).join("")}</ul>`
    : `<div class="repo-body-value repo-body-value--empty">${escapeHtml(fallback)}<span class="repo-body-empty-reason">${escapeHtml(reason)}</span></div>`;
  return `<div class="repo-body-cell wide">
      <div class="repo-body-key">${escapeHtml(key)}</div>
      ${body}
    </div>`;
}

function renderDiscoveryRow(candidate) {
    const cardId = `repo-${slugifyForId(candidate.repo.owner + "-" + candidate.repo.name)}`;
    const repoRef = `${candidate.repo.owner}/${candidate.repo.name}`;
    const repoUrl = candidate.repo.normalizedRepoUrl;
    const description = candidate.enrichment?.repo?.description ?? "";
    const fitBand = localizeFitBand(candidate.projectAlignment?.fitBand ?? "unknown");
    const mainLayer = localizeSystemTerm(candidate.guess?.mainLayer ?? "unknown");
    const gapArea = localizeSystemTerm(candidate.gapAreaCanonical ?? candidate.guess?.gapArea ?? "unknown");
    const metaParts = [
      description ? description.slice(0, 140) : null,
      `Passung ${fitBand}`,
      `Ebene ${mainLayer}`,
      `Lücke ${gapArea}`
    ].filter(Boolean);
    const metaLine = metaParts.join(" · ");
    const badge = DISCOVERY_BADGE_MAP[candidate.discoveryDisposition] ?? DISCOVERY_BADGE_MAP.observe_only;
    const score = candidate.discoveryScore != null ? candidate.discoveryScore : "";
    const dataSearch = [
      candidate.repo.owner,
      candidate.repo.name,
      description,
      candidate.projectAlignment?.matchedCapabilities?.join(" ") ?? "",
      candidate.guess?.mainLayer ?? "",
      candidate.discoveryDisposition ?? ""
    ].join(" ").toLowerCase();

    const whyRelevant = buildDiscoveryWhyRelevant(candidate);
    const evidenceText = buildDiscoveryEvidenceText(candidate);
    const strengths = buildDiscoveryStrengths(candidate);
    const risks = buildDiscoveryRisks(candidate);
    const transfer = localizeGeneratedText(candidate.landkarteCandidate?.possible_implication ?? candidate.projectAlignment?.suggestedNextStep ?? "-");
    const reasoningItems = Array.isArray(candidate.reasoning)
      ? candidate.reasoning.map((item) => localizeGeneratedText(item)).filter(Boolean)
      : [];

  const body = `<div class="repo-body">
    <div class="repo-body-grid">
      ${renderRepoBodyCell("Warum relevant", whyRelevant, { wide: true, emptyReason: "Dieses Repo liefert keine ausreichend belastbaren Discovery-Signale." })}
      ${renderRepoBodyCell("Staerke", strengths, { emptyReason: "Keine verwertbaren Staerkesignale aus Enrichment oder Capability-Matching." })}
      ${renderRepoBodyCell("Transferidee", transfer, { emptyReason: "Keine konkrete Transferidee gesetzt (Landkarte oder Alignment)." })}
    </div>
    <details class="repo-body-secondary">
      <summary>Tiefen-Evidenz anzeigen</summary>
      <div class="repo-body-grid">
        ${renderRepoBodyCell("Evidenz", evidenceText, { wide: true, emptyReason: "Das Repo hat keine strukturierte Evidenz-Bewertung erhalten." })}
        ${renderRepoBodyCell("Risiken", risks, { wide: true, emptyReason: "Keine spezifischen Risikohinweise erfasst." })}
        ${renderRepoBodyListCell("Begruendung", reasoningItems, "Keine Begruendung erfasst.", "Die Heuristik hat keine einzelnen Regeln fuer dieses Repo protokolliert.")}
      </div>
    </details>
  </div>`;

  return `<details class="repo-row filter-card" id="${cardId}"
  data-search="${escapeHtml(dataSearch)}"
  data-fit="${escapeHtml(candidate.projectAlignment?.fitBand ?? "unknown")}"
  data-mode="${escapeHtml(candidate.discoveryDisposition ?? "watch_only")}"
  data-layer="${escapeHtml(candidate.guess?.mainLayer ?? "unknown")}">
  <summary>
    <div>
      <a class="name" href="${escapeHtml(repoUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(repoRef)}</a>
      <div class="meta">${escapeHtml(metaLine)}</div>
    </div>
    <button type="button" class="badge ${badge.tone} badge--clickable"${buildBadgeExplainAttrs(badge.tone)}>${escapeHtml(badge.label)}</button>
    <div class="score-cell">
      <div class="score-label">Score</div>
      <div class="score">${escapeHtml(score)}</div>
    </div>
    <span class="row-toggle" aria-hidden="true">▸</span>
  </summary>
  ${body}
</details>`;
}

export function renderDiscoveryCandidateCards(candidates, reportView) {
  const visible = candidates.slice(0, reportView.candidateCount);
  if (visible.length === 0) {
    return `<p class="empty">In diesem Lauf sind keine Discovery-Kandidaten vorhanden.</p>`;
  }
  const topCount = Math.min(3, visible.length);
  const topRows = visible.slice(0, topCount).map(renderDiscoveryRow).join("\n");
  const rest = visible.slice(topCount);
  if (rest.length === 0) {
    return topRows;
  }
  const restRows = rest.map(renderDiscoveryRow).join("\n");
  return `${topRows}
<details class="candidates-rest">
  <summary class="candidates-rest-toggle">
    <span class="candidates-rest-label">Weitere ${rest.length} Kandidaten anzeigen</span>
    <span class="candidates-rest-chevron" aria-hidden="true">▾</span>
  </summary>
  <div class="candidates-rest-body">
    ${restRows}
  </div>
</details>`;
}

const WATCHLIST_FIT_BADGE_MAP = {
  high: { tone: "adopt", label: "Uebernehmen" },
  medium: { tone: "adapt", label: "Vertiefen" },
  low: { tone: "observe", label: "Beobachten" },
  unknown: { tone: "observe", label: "Beobachten" }
};

export function renderWatchlistTopCards(review, reportView) {
  const visible = review.topItems.slice(0, reportView.candidateCount);
  if (visible.length === 0) {
    return `<p class="empty">Noch keine geprueften Watchlist-Repositories vorhanden.</p>`;
  }
  return visible.map((item) => {
    const cardId = `repo-${slugifyForId(item.repoRef)}`;
    const repoUrl = `https://github.com/${item.repoRef}`;
    const reason = localizeGeneratedText(item.reason || "");
    const fitBand = localizeFitBand(item.projectFitBand || "unknown");
    const mainLayer = localizeSystemTerm(item.mainLayer || "unbekannt");
    const gapArea = localizeSystemTerm(item.gapArea || "-");
    const metaParts = [
      reason ? reason.slice(0, 140) : null,
      `Passung ${fitBand} (${item.projectFitScore ?? "-"})`,
      `Ebene ${mainLayer}`,
      `Lücke ${gapArea}`
    ].filter(Boolean);
    const metaLine = metaParts.join(" · ");
    const badge = WATCHLIST_FIT_BADGE_MAP[item.projectFitBand || "unknown"] ?? WATCHLIST_FIT_BADGE_MAP.unknown;
    const score = item.reviewScore != null ? item.reviewScore : "";
    const dataSearch = [
      item.repoRef,
      item.reason,
      item.learningForEventbaer,
      item.possibleImplication,
      item.mainLayer,
      item.gapArea,
      (item.matchedCapabilities ?? []).join(" ")
    ].join(" ").toLowerCase();

    const whyImportant = localizeGeneratedText(item.learningForEventbaer || item.strengths || "-");
    const takeaway = localizeGeneratedText(item.possibleImplication || item.suggestedNextStep || "-");
    const strengths = localizeGeneratedText(item.strengths || "-");
    const weaknesses = localizeGeneratedText(item.weaknesses || (Array.isArray(item.risks) ? item.risks.join(", ") : item.risks) || "-");
    const detailsItems = [
      `Passende Faehigkeiten: ${(item.matchedCapabilities ?? []).map((cap) => localizeSystemTerm(cap)).join(", ") || "-"}`,
      `Empfohlene Worker-Bereiche: ${(item.recommendedWorkerAreas ?? []).map((area) => localizeGeneratedText(area)).join(", ") || "-"}`,
      `Empfohlener naechster Schritt: ${localizeGeneratedText(item.suggestedNextStep || "-")}`
    ];

    const body = `<div class="repo-body">
    <div class="repo-body-grid">
      ${renderRepoBodyCell("Warum wichtig", whyImportant, { wide: true, emptyReason: "Kein Lerninhalt fuer das Zielprojekt erfasst." })}
      ${renderRepoBodyCell("Was du mitnehmen kannst", takeaway, { emptyReason: "Kein Uebernahme-Hinweis aus dem Review." })}
      ${renderRepoBodyCell("Staerke", strengths, { emptyReason: "Keine expliziten Staerkesignale im Review vermerkt." })}
    </div>
    <details class="repo-body-secondary">
      <summary>Vergleichs-Details anzeigen</summary>
      <div class="repo-body-grid">
        ${renderRepoBodyCell("Schwaeche / Risiko", weaknesses, { wide: true, emptyReason: "Keine spezifischen Schwaechesignale im Review erfasst." })}
        ${renderRepoBodyListCell("Vergleichsdetails", detailsItems, "Keine Details vorhanden.", "Die Review-Runde hat keine Vergleichsdaten erzeugt.")}
      </div>
    </details>
  </div>`;

    return `<details class="repo-row filter-card" id="${cardId}"
  data-search="${escapeHtml(dataSearch)}"
  data-fit="${escapeHtml(item.projectFitBand || "unknown")}"
  data-mode="${escapeHtml(item.gapArea || "unknown")}"
  data-layer="${escapeHtml(item.mainLayer || "unknown")}">
  <summary>
    <div>
      <a class="name" href="${escapeHtml(repoUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.repoRef)}</a>
      <div class="meta">${escapeHtml(metaLine)}</div>
    </div>
    <button type="button" class="badge ${badge.tone} badge--clickable"${buildBadgeExplainAttrs(badge.tone)}>${escapeHtml(badge.label)}</button>
    <div class="score-cell">
      <div class="score-label">Score</div>
      <div class="score">${escapeHtml(score)}</div>
    </div>
    <span class="row-toggle" aria-hidden="true">▸</span>
  </summary>
  ${body}
</details>`;
  }).join("\n");
}

function renderAgentStarterCard(starter, opts = {}) {
  if (!starter) {
    return `<div class="info-card${opts.wide ? " wide" : ""}">
  <div class="info-card-title">${escapeHtml(opts.title ?? "Coding Starter")}</div>
  <p class="info-card-empty">${escapeHtml(opts.emptyText ?? "Kein Coding-Starter hinterlegt.")}</p>
</div>`;
  }
  const items = [
    starter.starterLabel ? `Pfad: ${starter.starterLabel}` : null,
    starter.implementationGoal,
    starter.firstSlice ? `Erster Schnitt: ${starter.firstSlice}` : null,
    `Zielbereiche: ${(starter.targetAreas ?? []).join(", ") || "-"}`,
    starter.starterMode ? `Modus: ${starter.starterMode}` : null
  ].filter(Boolean);
  const compareChecklist = Array.isArray(starter.compareChecklist) ? starter.compareChecklist.filter(Boolean) : [];
  const stopIf = Array.isArray(starter.stopIf) ? starter.stopIf.filter(Boolean) : [];
  const checklistFragment = (compareChecklist.length > 0 || stopIf.length > 0)
    ? `<details class="starter-details">
    <summary>Checkliste oeffnen</summary>
    ${compareChecklist.length > 0
      ? `<div class="starter-sublist">
      <div class="starter-sublist-title">Vergleichscheckliste</div>
      <ul class="starter-sublist-items">${compareChecklist.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
    </div>`
      : ""}
    ${stopIf.length > 0
      ? `<div class="starter-sublist">
      <div class="starter-sublist-title">Stoppregeln</div>
      <ul class="starter-sublist-items">${stopIf.map((i) => `<li>Stoppe, wenn ${escapeHtml(i)}</li>`).join("")}</ul>
    </div>`
      : ""}
  </details>`
    : "";
  return `<div class="info-card${opts.wide ? " wide" : ""}">
  <div class="info-card-title">${escapeHtml(opts.title ?? "Coding Starter")}</div>
  ${starter.repo ? `<p class="info-card-copy"><strong>${escapeHtml(starter.repo)}</strong></p>` : ""}
  <ul class="info-card-list">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
  ${checklistFragment}
</div>`;
}

export function renderAgentField(agentView) {
  if (!agentView) {
    return `<p class="empty">Fuer diesen Bericht ist aktuell keine Agenten-Uebergabe vorhanden.</p>`;
  }

  const priorityItems = (agentView.priorityRepos ?? []).map((item) => {
    return `${item.repo} → ${item.action}`;
  });

  const downloadName = escapeHtml(agentView.downloadFileName ?? "patternpilot-agent-handoff.json");
  const primaryStarter = agentView.codingStarter?.primary ?? null;
  const secondaryStarters = Array.isArray(agentView.codingStarter?.secondary) ? agentView.codingStarter.secondary : [];

  // Start-Hier-Anleitung: klare Eintritts-Instruktion fuer KI-Coding-Agenten,
  // damit der Agent die Handoff-Struktur nicht erst interpretieren muss.
  const startHereFragment = `<div class="agent-start-here">
  <div class="agent-start-here-label">Start-Hier</div>
  <p class="agent-start-here-body">
    ${primaryStarter
      ? `Beginne mit dem <strong>primaeren Coding-Starter</strong> unten. Lies Implementation-Ziel + erster Schnitt und arbeite die Vergleichs-Checkliste ab. Bei Unklarheit oder Schwelle wie in Stoppregeln beschrieben zurueck zum Menschen.`
      : `Kein prototyp-reifer Coding-Starter in diesem Lauf. Stuetze dich auf Handlungsauftrag + priorisierte Repos + wichtige Kontext-Signale. Klaere Unklarheiten bevor du implementierst.`}
  </p>
</div>`;

  // Tech-Stack + Referenzen (optional, nur wenn agentView.techStack / agentView.references existieren)
  const techStack = agentView.techStack ?? null;
  const references = Array.isArray(agentView.references) ? agentView.references : [];
  const techStackCard = techStack ? `<div class="info-card info-card--wide">
  <div class="info-card-title">Tech-Stack &amp; Zielprojekt-Struktur</div>
  <ul class="info-card-list">
    ${techStack.languages ? `<li><strong>Sprachen:</strong> ${escapeHtml((techStack.languages ?? []).join(", "))}</li>` : ""}
    ${techStack.runtime ? `<li><strong>Runtime:</strong> ${escapeHtml(techStack.runtime)}</li>` : ""}
    ${techStack.testCommand ? `<li><strong>Test-Befehl:</strong> <code>${escapeHtml(techStack.testCommand)}</code></li>` : ""}
    ${techStack.buildCommand ? `<li><strong>Build-Befehl:</strong> <code>${escapeHtml(techStack.buildCommand)}</code></li>` : ""}
    ${references.length > 0 ? `<li><strong>Referenz-Stellen:</strong> ${references.map((r) => `<code>${escapeHtml(r)}</code>`).join(", ")}</li>` : ""}
  </ul>
</div>` : "";

  // Success-Criteria: wie beweist der Agent dass seine Aenderung funktioniert?
  const successCriteria = Array.isArray(agentView.successCriteria) ? agentView.successCriteria : [];
  const successCard = successCriteria.length > 0 ? `<div class="info-card info-card--wide">
  <div class="info-card-title">Success-Criteria (Abnahme-Checks)</div>
  <p class="info-card-copy">Diese Checks sollten nach der Aenderung durchlaufen. Wenn einer schief geht, bleibe vor dem Merge stehen.</p>
  <ul class="info-card-list">
    ${successCriteria.map((c) => typeof c === "string"
      ? `<li>${escapeHtml(c)}</li>`
      : `<li><strong>${escapeHtml(c.label ?? "Check")}:</strong> <code>${escapeHtml(c.command ?? "")}</code>${c.expect ? ` — erwartet: ${escapeHtml(c.expect)}` : ""}</li>`).join("")}
  </ul>
</div>` : "";

  // Richer JSON: include localized agentView, not only payload field
  const localizedSnapshot = localizeAgentPayload({
    mission: agentView.mission ?? [],
    deliverable: agentView.deliverable ?? [],
    priorityRepos: agentView.priorityRepos ?? [],
    context: agentView.context ?? [],
    guardrails: agentView.guardrails ?? [],
    uncertainties: agentView.uncertainties ?? [],
    codingStarter: agentView.codingStarter ?? null,
    payload: agentView.payload ?? {}
  });
  const payloadJson = JSON.stringify(localizedSnapshot, null, 2);

  const coreCards = [
    { title: "Handlungsauftrag", items: agentView.mission ?? [], emptyText: "Kein Handlungsauftrag hinterlegt.", wide: true },
    { title: "Lieferziel", items: agentView.deliverable ?? [], emptyText: "Kein Lieferziel hinterlegt.", wide: true },
    { title: "Priorisierte Repos", items: priorityItems, emptyText: "Keine priorisierten Repos vorhanden.", wide: true },
    { title: "Wichtiger Kontext", items: agentView.context ?? [], emptyText: "Kein Zusatzkontext hinterlegt.", wide: true },
    { title: "Leitplanken", items: agentView.guardrails ?? [], emptyText: "Keine besonderen Leitplanken erfasst.", wide: true },
    { title: "Offene Unsicherheiten", items: agentView.uncertainties ?? [], emptyText: "Aktuell sind keine besonderen Unsicherheiten hervorgehoben.", wide: true }
  ];

  const primaryStarterFragment = renderAgentStarterCard(primaryStarter, {
    title: "Coding Starter · Primaerer Pfad",
    emptyText: "Fuer diesen Lauf ist aktuell noch kein prototyp-tauglicher Coding-Starter vorhanden.",
    wide: true
  });
  const secondaryStarterFragments = secondaryStarters
    .map((starter, i) => renderAgentStarterCard(starter, { title: `Sekundaerer Pfad ${i + 1}`, wide: true }))
    .join("\n");

  const jsonBlock = `<div class="info-card wide agent-snapshot">
  <div class="info-card-title">Maschinenlesbares Snapshot</div>
  <p class="info-card-copy">JSON-Sicht fuer Coding Agents mit Auftrag, Prioritaeten, Kontext, Leitplanken und Unsicherheiten in stabiler Form.</p>
  <div class="agent-actions">
    <button type="button" class="ghost-button agent-action-button" data-agent-action="open">Agent Hand-Off oeffnen</button>
    <button type="button" class="ghost-button agent-action-button" data-agent-action="download" data-agent-filename="${downloadName}">Agent Hand-Off herunterladen</button>
  </div>
  <details class="agent-json">
    <summary>JSON anzeigen (nur fuer KI-Agenten relevant)</summary>
    <pre class="agent-pre">${escapeHtml(payloadJson)}</pre>
  </details>
</div>`;

  return `${startHereFragment}<div class="info-grid info-grid--halves">
${coreCards.map((card) => renderInfoCard(card)).join("\n")}
${techStackCard}
${successCard}
${primaryStarterFragment}
${secondaryStarterFragments}
${jsonBlock}
</div>`;
}

export function renderCoverageCards(coverage) {
  const groups = [
    { title: "Hauptlayer", items: coverage.mainLayers ?? [] },
    { title: "Lueckenbereiche", items: coverage.gapAreas ?? [] },
    { title: "Faehigkeiten", items: coverage.capabilities ?? [] }
  ].filter((group) => group.items.length > 0);
  if (groups.length === 0) {
    return `<p class="empty">Keine Coverage-Daten fuer diesen Lauf vorhanden.</p>`;
  }
  const body = groups.map((group) => {
    const items = group.items.slice(0, 10);
    const maxCount = items.reduce((highest, item) => Math.max(highest, item.count), 1);
    const totalCount = items.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
    const rows = items.map((item) => {
      const percent = Math.max(6, Math.min(100, Math.round((item.count / maxCount) * 100)));
      const valueLabel = localizeSystemTerm(item.value);
      return `<div class="axis-row">
  <div class="axis-label">${escapeHtml(valueLabel)}</div>
  <div class="axis-track"><div class="axis-fill" style="width: ${percent}%;"></div></div>
  <div class="axis-percent" title="${escapeHtml(percent)}% vom Max (${escapeHtml(maxCount)}) dieser Gruppe">${percent}% <span class="axis-percent-hint">v. Max</span></div>
  <div class="axis-value">${escapeHtml(item.count)}</div>
</div>`;
    }).join("\n");
    return `<div class="coverage-axis-group">
  <div class="group-head"><h3>${escapeHtml(group.title)}</h3><span class="group-head-meta">${totalCount} Summe · Max ${maxCount}</span></div>
  ${rows}
</div>`;
  }).join("\n");
  return body;
}

export function renderReviewScopeCards(review) {
  const scopeLabel = review.reviewScope === "selected_urls" ? "Explizite URLs" : "Beobachtungsliste";
  const scopeCopy = review.reviewScope === "selected_urls"
    ? "Dieser Lauf fokussiert nur die explizit uebergebenen Repository-URLs."
    : "Dieser Lauf vergleicht die aktuelle Watchlist des Projekts mit Intake-Daten aus der Queue.";
  const selectionLines = review.selectedUrls?.length > 0
    ? review.selectedUrls.map((url) => url)
    : [];

  return renderInfoGrid([
    {
      title: "Umfang des Laufs",
      copy: scopeCopy,
      items: [
        `Umfang: ${scopeLabel}`,
        `Eingangs-URLs: ${review.inputUrlCount ?? 0}`,
        `Beobachtungslisten-URLs: ${review.watchlistCount ?? 0}`
      ]
    },
    {
      title: "Explizite Auswahl",
      items: selectionLines,
      emptyText: review.reviewScope === "selected_urls"
        ? "Fuer diesen Lauf wurden keine expliziten URLs erfasst."
        : "Dieser Lauf hat die Beobachtungsliste statt einer expliziten URL-Auswahl verwendet."
    },
    {
      title: "Zustand der Entscheidungsdaten",
      items: [
        `Vollstaendig: ${review.itemsDataStateSummary?.complete ?? 0}`,
        `Fallback: ${review.itemsDataStateSummary?.fallback ?? 0}`,
        `Veraltet: ${review.itemsDataStateSummary?.stale ?? 0}`,
        `Laufvertrauen: ${localizeGeneratedText(review.runConfidence ?? "unbekannt")}`
      ]
    }
  ]);
}

export function renderOnDemandRunCards(summary) {
  const reviewScope = summary.reviewRun?.review?.reviewScope ?? "not_run";
  const reviewLabel = reviewScope === "selected_urls" ? "explizite URLs" : reviewScope === "watchlist" ? "Beobachtungsliste" : "nicht gelaufen";
  const runPlan = summary.runPlan ?? null;
  return renderInfoGrid([
    {
      title: "Laufmodus",
      items: [
        `Laufart: ${runPlan?.runKind ?? "unbekannt"}`,
        `Fokus: ${localizeGeneratedText(runPlan?.recommendedFocus ?? "-")}`,
        `Quellmodus: ${localizeGeneratedText(summary.sourceMode)}`,
        `Explizite URLs: ${summary.explicitUrls.length}`,
        `Wirksame URLs: ${summary.effectiveUrls.length}`,
        `Watchlist anhaengen: ${summary.appendWatchlist ? "ja" : "nein"}`
      ],
      emptyText: "Keine Laufmetadaten vorhanden."
    },
    {
      title: "Status der Phasen",
      items: [
        `Intake-Eintraege: ${summary.intakeRun?.items?.length ?? 0}`,
        `Neu bewertete Zeilen: ${summary.reEvaluateRun?.updates?.length ?? 0}`,
        `Review-Umfang: ${reviewLabel}`,
        `Promotions-Eintraege: ${summary.promoteRun?.items?.length ?? 0}`
      ]
    },
    {
      title: "Qualitaet der Review-Daten",
      items: [
        `Laufvertrauen: ${localizeGeneratedText(summary.reviewRun?.review?.runConfidence ?? "unbekannt")}`,
        `Vollstaendig: ${summary.reviewRun?.review?.itemsDataStateSummary?.complete ?? 0}`,
        `Fallback: ${summary.reviewRun?.review?.itemsDataStateSummary?.fallback ?? 0}`,
        `Veraltet: ${summary.reviewRun?.review?.itemsDataStateSummary?.stale ?? 0}`
      ]
    }
  ]);
}

export function renderOnDemandArtifactCards(artifacts) {
  const cards = [
    {
      title: "Review-Bericht",
      copy: "HTML-Bericht auf Projektebene, der fuer diesen On-Demand-Lauf erzeugt wurde.",
      href: artifacts.reviewReportHref,
      label: artifacts.reviewReportLabel
    },
    {
      title: "Letzte Report-Metadaten",
      copy: "Stabiler Projektzeiger auf den zuletzt erzeugten HTML-Bericht.",
      href: artifacts.latestReportHref,
      label: artifacts.latestReportLabel
    },
    {
      title: "Agent Hand-Off",
      copy: "Maschinenlesbare JSON-Uebergabe fuer Coding Agents mit Auftrag, Prioritaeten, Kontext, Leitplanken und Unsicherheiten.",
      href: artifacts.agentHandoffHref,
      label: artifacts.agentHandoffLabel,
      external: true
    },
    {
      title: "Browser-Link",
      copy: "Lokaler Direktzeiger, um den letzten Projektbericht schnell zu oeffnen.",
      href: artifacts.browserLinkHref,
      label: artifacts.browserLinkLabel
    }
  ];
  return renderInfoGrid(cards.map((card) => ({
    title: card.title,
    copy: card.copy,
    emptyText: card.href ? "" : "Kein Artefakt verfuegbar.",
    link: card.href ? { href: card.href, label: card.label || card.href, external: card.external } : null
  })));
}

export function renderOnDemandNextActions(actions) {
  return renderInfoGrid([
    {
      title: "Was jetzt sinnvoll ist",
      items: (actions ?? []).map((item) => localizeGeneratedText(item)),
      emptyText: "Fuer diesen Lauf gibt es gerade keine Folgeempfehlung.",
      wide: true
    }
  ]);
}

// Landscape-spezifische Entscheidungen-Section (3 Tabs).
// Unterscheidet sich vom Haupt-Report-Empfehlungen darin, dass hier die
// Disposition nicht intake/review/observe ist, sondern Relation (divergent/
// adjacent/near_current_approach) + Cluster-Zugehoerigkeit.
const RELATION_BADGE_MAP = {
  divergent: { tone: "adopt", label: "Divergent" },
  adjacent: { tone: "adapt", label: "Benachbart" },
  near_current_approach: { tone: "observe", label: "Naher Ansatz" }
};

export function renderLandscapeEntscheidungenSection({ clusters = [], landscapeSignal = "" } = {}) {
  const totalMembers = clusters.reduce((sum, c) => sum + (c.member_ids?.length ?? 0), 0);
  const countChip = clusters.length > 0 ? `${clusters.length} Cluster · ${totalMembers} Repos` : "leer";

  // Tab 1 "Top-Rang": die wichtigsten Repos aus allen Clustern, sortiert nach
  // Relation-Prioritaet (divergent zuerst — divergent = hoechstes Lern-Potenzial)
  const topRepos = [];
  const relationOrder = ["divergent", "adjacent", "near_current_approach"];
  for (const rel of relationOrder) {
    for (const cluster of clusters) {
      if (cluster.relation === rel) {
        const members = cluster.member_ids ?? [];
        for (const m of members) {
          topRepos.push({ repo: m, cluster: cluster.label, relation: rel, patternFamily: cluster.pattern_family });
          if (topRepos.length >= 5) break;
        }
      }
      if (topRepos.length >= 5) break;
    }
    if (topRepos.length >= 5) break;
  }
  const topRangBody = topRepos.length === 0
    ? `<p class="empty">Noch keine Repos in den Clustern — keine Top-Rang-Empfehlungen ableitbar.</p>`
    : topRepos.map((item) => {
        const badge = RELATION_BADGE_MAP[item.relation] ?? { tone: "observe", label: item.relation };
        const url = /^[^/\s]+\/[^/\s]+$/.test(item.repo) ? `https://github.com/${item.repo}` : "";
        return `<div class="repo-row">
  <div>
    ${url ? `<a class="name" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.repo)}</a>` : `<div class="name">${escapeHtml(item.repo)}</div>`}
    <div class="meta">${escapeHtml(item.cluster)} · ${escapeHtml(item.patternFamily ?? "-")}</div>
  </div>
  <span class="badge ${badge.tone}">${escapeHtml(badge.label)}</span>
</div>`;
      }).join("\n");

  // Tab 2 "Nach Relation gruppiert": Cluster nach ihrer Beziehung zum
  // Zielprojekt in drei Gruppen buendeln
  const groupsByRelation = { divergent: [], adjacent: [], near_current_approach: [] };
  clusters.forEach((c) => {
    if (groupsByRelation[c.relation]) groupsByRelation[c.relation].push(c);
  });
  const relationLabels = {
    divergent: { title: "Divergent — Andere Denkweise", hint: "Hoechstes Lern-Potenzial, aber Transfer aufwendig" },
    adjacent: { title: "Benachbart — Verwandter Ansatz", hint: "Adaptierbar, wenige Schnitte noetig" },
    near_current_approach: { title: "Naher Ansatz — Bestaetigung", hint: "Bestaetigt aktuellen Weg, wenig neue Einsicht" }
  };
  const byRelationBody = relationOrder.every((r) => groupsByRelation[r].length === 0)
    ? `<p class="empty">Noch keine Cluster nach Relation gruppiert.</p>`
    : relationOrder.map((rel) => {
        const group = groupsByRelation[rel];
        if (group.length === 0) return "";
        const label = relationLabels[rel];
        return `<div class="coverage-axis-group">
  <div class="group-head"><h3>${escapeHtml(label.title)} · ${group.length}</h3><span class="group-head-meta">${escapeHtml(label.hint)}</span></div>
  ${group.map((c) => `<div class="repo-row">
    <div>
      <div class="name">${escapeHtml(c.label)}</div>
      <div class="meta">${escapeHtml(c.pattern_family ?? "-")} · ${escapeHtml(c.member_ids?.length ?? 0)} Mitglieder</div>
    </div>
    <span class="badge ${RELATION_BADGE_MAP[rel]?.tone ?? "observe"}">${escapeHtml(RELATION_BADGE_MAP[rel]?.label ?? rel)}</span>
  </div>`).join("\n")}
</div>`;
      }).filter(Boolean).join("\n");

  // Tab 3 "Entscheidungs-Begruendung": pro Top-3-Cluster Pro/Contra + Impact
  const topClusters = [...clusters].sort((a, b) => {
    const order = { divergent: 0, adjacent: 1, near_current_approach: 2 };
    return (order[a.relation] ?? 3) - (order[b.relation] ?? 3);
  }).slice(0, 5);
  const reasoningBody = topClusters.length === 0
    ? `<p class="empty">Noch keine Cluster mit Begruendung ableitbar.</p>`
    : `<div class="decision-reasoning-list">${topClusters.map((c, i) => {
        const badge = RELATION_BADGE_MAP[c.relation] ?? { tone: "observe", label: c.relation };
        const members = c.member_ids ?? [];
        const impact = c.relation === "divergent" ? "hoch" : c.relation === "adjacent" ? "mittel" : "niedrig";
        const pros = [];
        const contras = [];
        if (c.relation === "divergent") {
          pros.push("Echte Neu-Sicht auf das Problem");
          pros.push("Hoechstes Lern-Potenzial fuer den Projekt-Moat");
          if (members.length >= 3) pros.push(`${members.length} Belege — robuste Musterfamilie`);
          contras.push("Transfer ins Zielprojekt aufwendig");
          contras.push("Kann zu Scope-Creep fuehren wenn unkritisch uebernommen");
        } else if (c.relation === "adjacent") {
          pros.push("Verwandter Ansatz — niedrige Transferhuerde");
          pros.push("Wenige Schnitte noetig fuer Adaption");
          if (members.length >= 3) pros.push(`${members.length} Belege aus dem Cluster`);
          contras.push("Weniger Neu-Sicht als divergente Cluster");
          contras.push("Evtl. Inkrementelle Verbesserung statt strategischer Sprung");
        } else {
          pros.push("Bestaetigung, dass aktueller Weg tragfaehig ist");
          pros.push("Geringe Transfer-Hurde");
          contras.push("Wenig neue Einsicht — nicht Haupt-Investitions-Hebel");
          contras.push("Kann Routine-Bestaetigung sein statt echtem Lernen");
        }
        return `<div class="decision-reasoning-item">
  <div class="decision-reasoning-head">
    <span class="decision-reasoning-rank">${String(i + 1).padStart(2, "0")}</span>
    <span class="decision-reasoning-name">${escapeHtml(c.label)}</span>
    <span class="badge ${badge.tone}">${escapeHtml(badge.label)}</span>
    <span class="decision-reasoning-impact impact-${impact}">Impact ${escapeHtml(impact)}</span>
  </div>
  <div class="decision-reasoning-body">
    <div class="decision-reasoning-col">
      <div class="decision-reasoning-col-title">Pro</div>
      <ul>${pros.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
    </div>
    <div class="decision-reasoning-col">
      <div class="decision-reasoning-col-title">Contra / Pruefen</div>
      <ul>${contras.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
    </div>
  </div>
  ${c.pattern_family ? `<div class="decision-reasoning-alt">Musterfamilie: <strong>${escapeHtml(c.pattern_family)}</strong></div>` : ""}
</div>`;
      }).join("")}</div>`;

  return renderTabbedSection({
    id: "entscheidungen",
    title: "Entscheidungen",
    sub: "Top-Rang · Nach Relation · Begruendung",
    accent: "magenta",
    countChip,
    tabs: [
      { label: "Top-Rang", body: topRangBody },
      { label: "Nach Relation gruppiert", body: byRelationBody },
      { label: "Entscheidungs-Begruendung", body: reasoningBody }
    ]
  });
}

// Reichere What-Now-Section mit mehreren Tabs fuer verschiedene Zielgruppen.
// Kompakt fuer Zeitdruck, Ausfuehrlich fuer Kontext, Checkliste fuer Abarbeiten,
// CLI fuer sofortige Handlung. Helper wird von den html-renderer.mjs-Pfaden
// und den Smokes gemeinsam genutzt.
export function renderWhatNowSection({
  compact = [],
  detailed = [],
  checklist = [],
  commands = [],
  projectKey = "my-project"
} = {}) {
  const safeCompact = compact.length > 0 ? compact : ["Oeffne zuerst den Projekt-Review-Bericht aus diesem Lauf.", "Pruefe vor einer Promotion die expliziten URLs oder die Watchlist-Abdeckung.", "Gehe erst in die Promotion, wenn das Review klar in eine Richtung zeigt."];
  const compactBody = `<ul class="what-now-compact">${safeCompact.map((item, i) => `<li><span class="what-now-rank">${String(i + 1).padStart(2, "0")}</span><span>${escapeHtml(item)}</span></li>`).join("")}</ul>`;

  const defaultDetailed = [
    {
      title: "1. Kandidaten-Review oeffnen und Top-3 einschaetzen",
      body: "Der schnellste Hebel ist, die Top-3-Kandidaten aus der Empfehlungen-Section mit ihrem Deep-Content zu lesen. Das gibt dir in 5 Minuten ein Gefuehl, ob der Lauf inhaltlich passt oder ob die Discovery-Linsen nachgeschaerft werden muessen."
    },
    {
      title: "2. Bei interessanten Treffern ins Intake ueberfuehren",
      body: "Fuer Repos mit Disposition 'Uebernehmen' solltest du als naechstes ein explizites Intake starten. Das bringt sie in die kuratierte Queue und laesst das Pattern-Detection-System tiefer analysieren, was konkret uebertragbar ist."
    },
    {
      title: "3. Decision-Log konsolidieren",
      body: "Nach 2-3 Laeufen solltest du die wichtigsten Entscheidungen (adopt/adapt/observe/ignore) in das Decision-Log des Zielprojekts pushen. Das macht Lerngewinn durabel und vermeidet, dass du die gleiche Bewertung mehrfach triffst."
    }
  ];
  const finalDetailed = detailed.length > 0 ? detailed : defaultDetailed;
  const detailedBody = `<div class="info-grid">${finalDetailed.map((item) => `<div class="info-card info-card--wide">
  <div class="info-card-title">${escapeHtml(item.title)}</div>
  <p class="info-card-copy">${escapeHtml(item.body)}</p>
</div>`).join("")}</div>`;

  const defaultChecklist = [
    { impact: "hoch", text: "Top-3 Discovery-Kandidaten in 5 Min durchlesen", done: false },
    { impact: "hoch", text: "Fuer Adopt-Kandidaten ein explizites Intake starten", done: false },
    { impact: "mittel", text: "Watchlist um 2-3 ueberzeugende Fremd-Repos ergaenzen", done: false },
    { impact: "mittel", text: "Decision-Log pro adoptiertem Pattern fuehren", done: false },
    { impact: "niedrig", text: "Regel-Kalibrierung pruefen, wenn Blocker-Anteil > 30% ist", done: false }
  ];
  const finalChecklist = checklist.length > 0 ? checklist : defaultChecklist;
  const checklistBody = `<ul class="what-now-checklist">${finalChecklist.map((item) => `<li class="what-now-checklist-item impact-${escapeHtml(item.impact ?? "mittel")}">
  <span class="checklist-box" aria-hidden="true"></span>
  <span class="checklist-impact">${escapeHtml(item.impact ?? "mittel")}</span>
  <span class="checklist-text">${escapeHtml(item.text)}</span>
</li>`).join("")}</ul>`;

  const defaultCommands = [
    { cmd: `npm run on-demand -- --project ${projectKey}`, label: "Nächsten On-Demand-Lauf starten" },
    { cmd: `npm run intake -- --project ${projectKey} <repo-url>`, label: "Kandidat manuell ins Intake ziehen" },
    { cmd: `npm run review:watchlist -- --project ${projectKey}`, label: "Watchlist-Review neu fahren" },
    { cmd: `npm run patternpilot -- product-readiness`, label: "Aktuellen Produktreife-Stand pruefen" }
  ];
  const finalCommands = commands.length > 0 ? commands : defaultCommands;
  const commandsBody = `<ul class="what-now-commands">${finalCommands.map((c) => `<li>
  <div class="what-now-command-label">${escapeHtml(c.label)}</div>
  <code class="what-now-command-code">${escapeHtml(c.cmd)}</code>
</li>`).join("")}</ul>`;

  return renderTabbedSection({
    id: "what-now",
    title: "Was jetzt? — Action-Steps",
    sub: "Vom Bericht zur konkreten Handlung",
    accent: "green",
    countChip: `${safeCompact.length} Kernsaetze`,
    tabs: [
      { label: "Kompakt", body: compactBody },
      { label: "Ausfuehrlich", body: detailedBody },
      { label: "Aktions-Checkliste", body: checklistBody },
      { label: "CLI-Befehle", body: commandsBody }
    ]
  });
}

export function renderOnDemandRunPlanCards(runPlan) {
  return renderInfoGrid([
    {
      title: "Lifecycle-Hinweise",
      items: runPlan?.notes ?? [],
      emptyText: "Fuer diesen Lauf sind keine Lifecycle-Hinweise vorhanden."
    },
    {
      title: "Standardform der Phasen",
      items: [
        `Intake: ${runPlan?.defaultPhases?.intake ?? "-"}`,
        `Re-evaluate: ${runPlan?.defaultPhases?.reEvaluate ?? "-"}`,
        `Review: ${runPlan?.defaultPhases?.review ?? "-"}`,
        `Promote: ${runPlan?.defaultPhases?.promote ?? "-"}`
      ]
    }
  ]);
}

export function renderOnDemandRunDriftCards(runDrift) {
  const signalLines = (runDrift?.signals ?? []).map((item) => `${localizeGeneratedText(item.severity.toUpperCase())} · ${localizeGeneratedText(item.id)} · ${localizeGeneratedText(item.message)}`);
  const queueDecisionStateSummary = runDrift?.queueSnapshot?.decisionStateSummary ?? {};
  return renderInfoGrid([
    {
      title: "Drift-Status",
      items: [
        `Status: ${localizeGeneratedText(runDrift?.driftStatus ?? "-")}`,
        `Signale: ${(runDrift?.signals ?? []).length}`,
        `Fortsetzungsmodus: ${localizeGeneratedText(runDrift?.resumeGuidance?.mode ?? "-")}`,
        `Naechster Wiederanlauf: ${localizeGeneratedText(runDrift?.resumeGuidance?.nextAction ?? "-")}`
      ],
      emptyText: "Keine Drift-Zusammenfassung fuer diesen Lauf vorhanden."
    },
    {
      title: "Zustand der Queue",
      items: [
        `Complete: ${queueDecisionStateSummary.complete ?? 0}`,
        `Fallback: ${queueDecisionStateSummary.fallback ?? 0}`,
        `Stale: ${queueDecisionStateSummary.stale ?? 0}`
      ]
    },
    {
      title: "Signale",
      items: signalLines,
      emptyText: "Aktuell sind keine Drift-Signale aktiv."
    }
  ]);
}

export function renderOnDemandGovernanceCards(governance) {
  return renderInfoGrid([
    {
      title: "Governance-Status",
      items: [
        `Status: ${localizeGeneratedText(governance?.status ?? "-")}`,
        `Automatischer Dispatch erlaubt: ${governance?.autoDispatchAllowed ? "ja" : "nein"}`,
        `Automatisches Apply erlaubt: ${governance?.autoApplyAllowed ? "ja" : "nein"}`,
        `Empfohlener Promotionsmodus: ${localizeGeneratedText(governance?.recommendedPromotionMode ?? "-")}`
      ],
      emptyText: "Fuer diesen Lauf liegt kein Governance-Snapshot vor."
    },
    {
      title: "Blockierte Phasen",
      items: (governance?.blockedPhases ?? []).map((item) => localizeGeneratedText(item)),
      emptyText: "Derzeit sind keine Phasen blockiert."
    },
    {
      title: "Naechster Schritt",
      items: [governance?.nextAction].filter(Boolean).map((item) => localizeGeneratedText(item)),
      emptyText: "Es gibt gerade keinen Governance-Folgeschritt."
    }
  ]);
}

export function renderOnDemandStabilityCards(stability) {
  return renderInfoGrid([
    {
      title: "Stabilitaetsstatus",
      items: [
        `Status: ${localizeGeneratedText(stability?.status ?? "-")}`,
        `Stabile Serie: ${stability?.stableStreak ?? 0}`,
        `Instabile Serie: ${stability?.unstableStreak ?? 0}`,
        `Verglichene Paare: ${stability?.comparedPairs ?? 0}`
      ],
      emptyText: "Keine Stabilitaetszusammenfassung fuer diesen Lauf vorhanden.",
      wide: true
    }
  ]);
}

export function renderRepoMatrix(review, reportView) {
  if (!reportView.showMatrix) {
    return `<p class="empty">Die Repo-Matrix ist in der kompakten Ansicht ausgeblendet.</p>`;
  }
  const rows = review.items.slice(0, reportView.candidateCount);
  if (rows.length === 0) {
    return `<p class="empty">Es sind keine Review-Zeilen vorhanden.</p>`;
  }
  return `<div class="table-wrap"><table class="data-table">
  <thead>
    <tr>
      <th>Repo</th>
      <th>Ebene</th>
      <th>Lueckenbereich</th>
      <th>Passung</th>
      <th>Relevanz</th>
      <th>Naechster Schritt</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((item) => `<tr>
      <td data-search="${escapeHtml([item.repoRef, item.mainLayer, item.gapArea, item.suggestedNextStep].join(" ").toLowerCase())}">${escapeHtml(item.repoRef)}</td>
      <td>${escapeHtml(localizeSystemTerm(item.mainLayer || "-"))}</td>
      <td>${escapeHtml(localizeSystemTerm(item.gapArea || "-"))}</td>
      <td>${escapeHtml(`${localizeSystemTerm(item.projectFitBand || "-")} (${item.projectFitScore})`)}</td>
      <td>${escapeHtml(localizeSystemTerm(getRenderedProjectRelevance(item, "-")))}</td>
      <td>${escapeHtml(localizeGeneratedText(item.suggestedNextStep || "-"))}</td>
    </tr>`).join("")}
  </tbody>
</table></div>`;
}

export function renderProjectContextSources(projectProfile, binding) {
  const loadedFiles = projectProfile?.contextSources?.loadedFiles ?? [];
  const missingFiles = projectProfile?.contextSources?.missingFiles ?? [];
  const scannedDirectories = projectProfile?.contextSources?.scannedDirectories ?? [];
  const nonEmptyDirectories = scannedDirectories.filter((item) => item.entryCount > 0);
  const declaredFiles = projectProfile?.contextSources?.declaredFiles ?? binding?.readBeforeAnalysis ?? [];
  const declaredDirectories = projectProfile?.contextSources?.declaredDirectories ?? binding?.referenceDirectories ?? [];
  const capabilitiesPresent = projectProfile?.capabilitiesPresent ?? [];

  // Status-Zeile: kompakter Gesamtstand der Kontextquellen
  const expectedFiles = declaredFiles.length;
  const actualFiles = loadedFiles.length;
  const missingCount = missingFiles.length;
  const capabilityCount = capabilitiesPresent.length;
  const dirCount = nonEmptyDirectories.length;
  const statusTone = missingCount === 0 && actualFiles > 0 ? "ok" : actualFiles === 0 ? "warn" : "attention";
  const statusIcon = statusTone === "ok" ? "●" : statusTone === "warn" ? "▲" : "◆";
  const statusText = expectedFiles > 0
    ? `${actualFiles} von ${expectedFiles} Pflicht-Dateien gelesen · ${missingCount === 0 ? "alle vorhanden" : `${missingCount} fehlen`} · ${dirCount} Verzeichnisse gescannt · ${capabilityCount} Faehigkeiten extrahiert`
    : `${actualFiles} Dateien gelesen · ${dirCount} Verzeichnisse gescannt · ${capabilityCount} Faehigkeiten extrahiert`;
  const statusChip = `<div class="context-status context-status--${statusTone}"><span class="context-status-icon" aria-hidden="true">${statusIcon}</span><span class="context-status-text">${escapeHtml(statusText)}</span></div>`;

  // Bundle Dateien + Verzeichnisse als eine Card — das ist "was hat
  // Pattern Pilot eingelesen". Bei > 5 Eintraegen wird der Rest ausklappbar.
  const combinedSources = [];
  (loadedFiles.length > 0 ? loadedFiles : declaredFiles).forEach((f) => combinedSources.push(`📄 ${f}`));
  (nonEmptyDirectories.length > 0
    ? nonEmptyDirectories.map((item) => `📁 ${item.path}/ (${item.entryCount} Eintraege)`)
    : declaredDirectories.map((item) => `📁 ${item}/`)).forEach((d) => combinedSources.push(d));

  const PRIMARY_CUTOFF = 5;
  const primarySources = combinedSources.slice(0, PRIMARY_CUTOFF);
  const extraSources = combinedSources.slice(PRIMARY_CUTOFF);
  const extraFragment = extraSources.length > 0
    ? `<details class="sources-more"><summary>${extraSources.length} weitere Eintraege anzeigen</summary><ul class="info-card-list">${extraSources.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></details>`
    : "";
  const sourcesCardHtml = `<div class="info-card">
  <div class="info-card-title">Eingelesene Kontextquellen</div>
  ${combinedSources.length > 0
    ? `<ul class="info-card-list">${primarySources.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>${extraFragment}`
    : `<p class="info-card-empty">Keine Kontextquellen gelesen. Fuer dieses Ziel-Repo sind keine Kontextdateien oder Verzeichnisse in der Bindung konfiguriert.</p>`}
</div>`;

  // Extrahierte Faehigkeiten als zweite Card — das ist das Ergebnis-Signal
  const capabilitiesCardHtml = `<div class="info-card">
  <div class="info-card-title">Extrahierte Faehigkeiten</div>
  ${capabilitiesPresent.length > 0
    ? `<ul class="info-card-list">${capabilitiesPresent.map((c) => `<li>${escapeHtml(localizeSystemTerm(c))}</li>`).join("")}</ul>`
    : `<p class="info-card-empty">Keine Faehigkeiten abgeleitet. Entweder sind die Kontextquellen zu duenn oder der Capability-Detector hat keine Muster erkannt.</p>`}
</div>`;

  // Conditional dritte Card: nur wenn Dateien fehlen — dann wird's kritisch
  const missingCardHtml = missingCount > 0
    ? `<div class="info-card info-card--wide info-card--warn">
  <div class="info-card-title">Fehlende konfigurierte Dateien</div>
  <p class="info-card-copy">Diese Dateien waren laut Bindung erwartet, aber beim Scan nicht gefunden. Pattern Pilot arbeitet mit reduzierter Datenbasis.</p>
  <ul class="info-card-list">${missingFiles.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
</div>`
    : "";

  const grid = `<div class="info-grid">
${sourcesCardHtml}
${capabilitiesCardHtml}
${missingCardHtml}
</div>`;

  return `${statusChip}${grid}`;
}

export function renderReportToolbar({ modeOptions, layerOptions }) {
  return `<section class="section-preview accent-purple" id="report-toolbar" data-nav-section>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Bericht filtern</h2>
      <div class="sub">Nur fuer laengere Berichte</div>
    </div>
    <div class="head-actions">
      <label class="toolbar-toggle toolbar-toggle--prominent" for="show-empty-sections-toggle">
        <input type="checkbox" id="show-empty-sections-toggle">
        <span class="toolbar-toggle-label">Auch leere Felder anzeigen</span>
      </label>
    </div>
  </div>
  ${renderInlineSectionDescription("report-toolbar")}
  <div class="toolbar-body">
    <div class="toolbar-grid">
      <label class="control">
        <span>Suche</span>
        <input id="report-search" type="search" placeholder="Repo oder Thema">
      </label>
      <label class="control">
        <span>Passung</span>
        <select id="report-fit">
          <option value="">Alle</option>
          <option value="high">Hoch</option>
          <option value="medium">Mittel</option>
          <option value="low">Niedrig</option>
          <option value="unknown">Unbekannt</option>
        </select>
      </label>
      <label class="control">
        <span>Lueckenbereich</span>
        <select id="report-mode">
          <option value="">Alle</option>
          ${modeOptions.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(localizeSystemTerm(item))}</option>`).join("")}
        </select>
      </label>
      <label class="control">
        <span>Ebene</span>
        <select id="report-layer">
          <option value="">Alle</option>
          ${layerOptions.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(localizeSystemTerm(item))}</option>`).join("")}
        </select>
      </label>
      <button class="ghost-button" id="report-reset" type="button">Filter zuruecksetzen</button>
    </div>
    <p class="toolbar-inline-help">Toggle oben rechts zeigt leere Sektionen mit Empty-States. Default ist nur gefuellte Felder.</p>
    ${renderFilterIndicator()}
  </div>
</section>`;
}
