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
import { renderInfoGrid, renderInfoCard, renderExplainButton } from "./components.mjs";
import { getSectionInfo } from "./section-info.mjs";
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
  <details class="agent-json" open>
    <summary>JSON anzeigen / verstecken</summary>
    <pre class="agent-pre">${escapeHtml(payloadJson)}</pre>
  </details>
</div>`;

  return `<div class="info-grid info-grid--halves">
${coreCards.map((card) => renderInfoCard(card)).join("\n")}
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
  return groups.map((group) => {
    const items = group.items.slice(0, 10);
    const maxCount = items.reduce((highest, item) => Math.max(highest, item.count), 1);
    const rows = items.map((item) => {
      const percent = Math.max(6, Math.min(100, Math.round((item.count / maxCount) * 100)));
      const valueLabel = localizeSystemTerm(item.value);
      return `<div class="axis-row">
  <div class="axis-label">${escapeHtml(valueLabel)}</div>
  <div class="axis-track"><div class="axis-fill" style="width: ${percent}%;"></div></div>
  <div class="axis-percent">${percent}%</div>
  <div class="axis-value">${escapeHtml(item.count)}</div>
</div>`;
    }).join("\n");
    return `<div class="coverage-axis-group">
  <div class="group-head"><h3>${escapeHtml(group.title)}</h3></div>
  ${rows}
</div>`;
  }).join("\n");
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

  return renderInfoGrid([
    {
      title: "Zuerst gelesene Dateien",
      items: loadedFiles.length > 0 ? loadedFiles : declaredFiles,
      emptyText: "Keine Information vorhanden — Grund: Fuer dieses Ziel-Repository sind keine Kontextdateien konfiguriert."
    },
    {
      title: "Fehlende konfigurierte Dateien",
      items: missingFiles,
      emptyText: "Keine Information vorhanden — Grund: Alle konfigurierten Kontextdateien waren verfuegbar."
    },
    {
      title: "Durchsuchte Verzeichnisse",
      items: nonEmptyDirectories.length > 0
        ? nonEmptyDirectories.map((item) => localizeGeneratedText(`${item.path}/ (${item.entryCount} entries sampled)`))
        : declaredDirectories.map((item) => `${item}/`),
      emptyText: "Keine Information vorhanden — Grund: Es ist kein Verzeichniskontext konfiguriert."
    },
    {
      title: "Extrahierte Signale",
      items: capabilitiesPresent.map((item) => `Faehigkeit: ${localizeSystemTerm(item)}`),
      emptyText: "Keine Information vorhanden — Grund: Aus dem aktuellen Kontext wurden keine Zielprojekt-Capabilities abgeleitet."
    }
  ], { variant: "halves" });
}

export function renderReportToolbar({ modeOptions, layerOptions }) {
  const toolbarInfo = getSectionInfo("report-toolbar");
  const toolbarExplain = toolbarInfo
    ? renderExplainButton({ title: toolbarInfo.title, body: toolbarInfo.body })
    : "";
  return `<section class="section-preview accent-purple" id="report-toolbar" data-nav-section>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Bericht filtern</h2>
      <div class="sub">Nur fuer laengere Berichte</div>
    </div>
    ${toolbarExplain ? `<div class="head-actions">${toolbarExplain}</div>` : ""}
  </div>
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
    <p class="toolbar-inline-help">Fuer kurze Laeufe meist nicht noetig.</p>
    ${renderFilterIndicator()}
  </div>
</section>`;
}
