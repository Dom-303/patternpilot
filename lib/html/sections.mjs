import {
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

export function renderDiscoveryCandidateCards(candidates, reportView) {
  const visible = candidates.slice(0, reportView.candidateCount);
  if (visible.length === 0) {
    return `<p class="empty">In diesem Lauf sind keine Discovery-Kandidaten vorhanden.</p>`;
  }
  const joinList = (items = [], fallback = "-") => {
    const values = items
      .map((item) => localizeGeneratedText(localizeSystemTerm(item)))
      .filter(Boolean);
    return values.length > 0 ? values.join(", ") : fallback;
  };
  const buildOverviewCopy = (candidate) => {
    const fitBand = localizeFitBand(candidate.projectAlignment?.fitBand ?? "unknown");
    const gapArea = localizeSystemTerm(candidate.gapAreaCanonical ?? candidate.guess?.gapArea ?? "unknown");
    const mainLayer = localizeSystemTerm(candidate.guess?.mainLayer ?? "unknown");
    const capabilities = joinList(candidate.projectAlignment?.matchedCapabilities ?? [], "");
    const nextStep = localizeGeneratedText(candidate.projectAlignment?.suggestedNextStep ?? "");
    const capabilitySentence = capabilities ? ` Passende Faehigkeiten: ${capabilities}.` : "";
    const nextStepSentence = nextStep ? ` Naechster Schritt: ${nextStep}` : "";
    return `Patternpilot ordnet dieses Repo als ${fitBand} passende Spur im Bereich ${gapArea} ein. Die staerkste technische Naehe liegt in ${mainLayer}.${capabilitySentence}${nextStepSentence}`.trim();
  };
  const buildWhyRelevant = (candidate) => {
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
    const signalSentence = signalParts.length > 0
      ? ` Ausschlaggebend sind ${signalParts.join(", ")}.`
      : "";
    const familySentence = queryFamilies ? ` Aktiv wurde es ueber die Suchbahnen ${queryFamilies} gefunden.` : "";
    const capabilitySentence = matchedCapabilities ? ` Es beruehrt vor allem ${matchedCapabilities}.` : "";
    return `Das Repo zeigt fuer das Zielprojekt ein belastbares Muster in der Discovery.${signalSentence}${familySentence}${capabilitySentence}`.trim();
  };
  const buildEvidence = (candidate) => {
    const evidence = candidate.discoveryEvidence ?? {};
    const grade = localizeSystemTerm(evidence.grade ?? "light");
    const score = evidence.score ?? 0;
    const evidenceParts = [];
    if ((evidence.topicHits?.length ?? 0) > 0) evidenceParts.push(`Themen: ${evidence.topicHits.slice(0, 3).join(", ")}`);
    if ((evidence.readmeHits?.length ?? 0) > 0) evidenceParts.push(`README: ${evidence.readmeHits.slice(0, 3).join(", ")}`);
    if ((evidence.keywordHits?.length ?? 0) > 0) evidenceParts.push(`Projektbegriffe: ${evidence.keywordHits.slice(0, 3).join(", ")}`);
    const tail = evidenceParts.length > 0 ? ` · ${evidenceParts.join(" · ")}` : "";
    return `${grade} (${score})${tail}`;
  };
  const buildStrengths = (candidate) => {
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
  };
  const buildRisks = (candidate) => {
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
  };
  return `<div class="repo-grid repo-grid--stacked repo-grid--discovery">${visible.map((candidate) => {
    const whyRelevant = buildWhyRelevant(candidate);
    const transfer = localizeGeneratedText(candidate.landkarteCandidate?.possible_implication ?? candidate.projectAlignment?.suggestedNextStep ?? "-");
    const strengths = buildStrengths(candidate);
    const risks = buildRisks(candidate);
    const evidenceText = buildEvidence(candidate);
    const repoCopy = buildOverviewCopy(candidate);
    const teaserCopy = whyRelevant.length > 220
      ? `${whyRelevant.slice(0, 217).trimEnd()}...`
      : whyRelevant;
    const cardId = `repo-${slugifyForId(candidate.repo.owner + "-" + candidate.repo.name)}`;
      return `<details class="repo-card filter-card repo-card--collapsible" id="${cardId}"
  data-search="${escapeHtml([candidate.repo.owner, candidate.repo.name, candidate.enrichment?.repo?.description ?? "", candidate.projectAlignment?.matchedCapabilities?.join(" ") ?? "", candidate.guess?.mainLayer ?? "", candidate.discoveryDisposition ?? ""].join(" ").toLowerCase())}"
  data-fit="${escapeHtml(candidate.projectAlignment?.fitBand ?? "unknown")}"
  data-mode="${escapeHtml(candidate.discoveryDisposition ?? "watch_only")}"
  data-layer="${escapeHtml(candidate.guess?.mainLayer ?? "unknown")}">
  <summary class="repo-card-summary">
    <div class="repo-head">
      <h3>${escapeHtml(candidate.repo.owner)}/${escapeHtml(candidate.repo.name)}</h3>
      <div class="repo-badges">
        ${renderBadge(`Wertung ${candidate.discoveryScore}`, "accent")}
        ${renderBadge(`Passung ${localizeFitBand(candidate.projectAlignment?.fitBand ?? "unknown")}`, fitTone(candidate.projectAlignment?.fitBand))}
        ${renderBadge(localizeDisposition(candidate.discoveryDisposition), dispositionTone(candidate.discoveryDisposition))}
        ${candidate.discoveryEvidence?.grade ? renderBadge(`Evidenz ${localizeSystemTerm(candidate.discoveryEvidence.grade)}`, "neutral") : ""}
        ${candidate.discoveryClass ? renderBadge(localizeSystemTerm(candidate.discoveryClass), "neutral") : ""}
      </div>
    </div>
    <p class="repo-summary-copy">${escapeHtml(teaserCopy)}</p>
  </summary>
  <div class="repo-card-body">
    <p class="repo-url"><a href="${escapeHtml(candidate.repo.normalizedRepoUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(candidate.repo.normalizedRepoUrl)}</a></p>
    <p class="repo-copy">${escapeHtml(repoCopy)}</p>
    <dl class="mini-grid">
      <div><dt>Warum relevant</dt><dd>${escapeHtml(whyRelevant)}</dd></div>
      <div><dt>Evidenz</dt><dd>${escapeHtml(evidenceText)}</dd></div>
      <div><dt>Staerke</dt><dd>${escapeHtml(strengths)}</dd></div>
      <div><dt>Transferidee</dt><dd>${escapeHtml(transfer)}</dd></div>
      <div><dt>Risiken</dt><dd>${escapeHtml(risks)}</dd></div>
    </dl>
    <details class="repo-details">
      <summary>Begruendung oeffnen</summary>
      ${renderHtmlList(candidate.reasoning.map((item) => localizeGeneratedText(item)), "Keine Begruendung erfasst.")}
    </details>
  </div>
 </details>`;
  }).join("")}</div>`;
}

export function renderWatchlistTopCards(review, reportView) {
  const visible = review.topItems.slice(0, reportView.candidateCount);
  if (visible.length === 0) {
    return `<p class="empty">Noch keine geprueften Watchlist-Repositories vorhanden.</p>`;
  }
  return `<div class="repo-grid repo-grid--stacked">${visible.map((item) => {
    const cardId = `repo-${slugifyForId(item.repoRef)}`;
    const repoUrl = `https://github.com/${item.repoRef}`;
    const projectRelevance = localizeSystemTerm(getRenderedProjectRelevance(item, "-"));
    return `<article class="repo-card filter-card" id="${cardId}"
  data-search="${escapeHtml([item.repoRef, item.reason, item.learningForEventbaer, item.possibleImplication, item.mainLayer, item.gapArea, item.matchedCapabilities.join(" ")].join(" ").toLowerCase())}"
  data-fit="${escapeHtml(item.projectFitBand || "unknown")}"
  data-mode="${escapeHtml(item.gapArea || "unknown")}"
  data-layer="${escapeHtml(item.mainLayer || "unknown")}">
  <div class="repo-head">
    <h3>${escapeHtml(item.repoRef)}</h3>
    <div class="repo-badges">
      ${renderBadge(`Vergleich ${item.reviewScore}`, "accent")}
      ${renderBadge(`Passung ${localizeFitBand(item.projectFitBand || "unknown")}`, fitTone(item.projectFitBand))}
      ${renderBadge(localizeSystemTerm(item.mainLayer || "unbekannt"), "neutral")}
    </div>
  </div>
  <p class="repo-url"><a href="${escapeHtml(repoUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(repoUrl)}</a></p>
  <div class="repo-meta-strip">
    <span><strong>Passung</strong> ${escapeHtml(localizeFitBand(item.projectFitBand || "unknown"))} (${escapeHtml(item.projectFitScore ?? "-")})</span>
    <span><strong>Ebene</strong> ${escapeHtml(localizeSystemTerm(item.mainLayer || "-"))}</span>
    <span><strong>Lueckenbereich</strong> ${escapeHtml(localizeSystemTerm(item.gapArea || "-"))}</span>
    <span><strong>Relevanz</strong> ${escapeHtml(projectRelevance)}</span>
  </div>
  <p class="repo-copy">${escapeHtml(localizeGeneratedText(item.reason || "Braucht eine manuelle Pruefung."))}</p>
  <dl class="mini-grid">
    <div><dt>Warum wichtig</dt><dd>${escapeHtml(localizeGeneratedText(item.learningForEventbaer || item.strengths || "-"))}</dd></div>
    <div><dt>Was du mitnehmen kannst</dt><dd>${escapeHtml(localizeGeneratedText(item.possibleImplication || item.suggestedNextStep || "-"))}</dd></div>
    <div><dt>Staerke</dt><dd>${escapeHtml(localizeGeneratedText(item.strengths || "-"))}</dd></div>
    <div><dt>Schwaeche / Risiko</dt><dd>${escapeHtml(localizeGeneratedText(item.weaknesses || item.risks.join(", ") || "-"))}</dd></div>
  </dl>
  <details class="repo-details">
    <summary>Vergleichsdetails oeffnen</summary>
    ${renderHtmlList([
      `Passende Faehigkeiten: ${item.matchedCapabilities.map((cap) => localizeSystemTerm(cap)).join(", ") || "-"}`,
      `Empfohlene Worker-Bereiche: ${item.recommendedWorkerAreas.map((area) => localizeGeneratedText(area)).join(", ") || "-"}`,
      `Empfohlener naechster Schritt: ${localizeGeneratedText(item.suggestedNextStep || "-")}`
    ], "Keine weiteren Details vorhanden.")}
  </details>
</article>`;
  }).join("")}</div>`;
}

export function renderAgentField(agentView) {
  if (!agentView) {
    return `<p class="empty">Fuer diesen Bericht ist aktuell keine Agenten-Uebergabe vorhanden.</p>`;
  }

  const priorityItems = (agentView.priorityRepos ?? []).map((item) => {
    const link = item.url
      ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(item.repo)}</a>`
      : escapeHtml(item.repo);
    return `${link} — ${escapeHtml(item.action)}`;
  });

  const payloadJson = JSON.stringify(localizeAgentPayload(agentView.payload ?? {}), null, 2);
  const downloadName = escapeHtml(agentView.downloadFileName ?? "patternpilot-agent-handoff.json");
  const primaryStarter = agentView.codingStarter?.primary ?? null;
  const secondaryStarters = Array.isArray(agentView.codingStarter?.secondary) ? agentView.codingStarter.secondary : [];
  const renderStarterCard = (starter, emptyCopy = "Kein Coding-Starter hinterlegt.") => {
    if (!starter) {
      return `<p class="empty">${emptyCopy}</p>`;
    }
    return `
      <p class="repo-copy"><strong>${escapeHtml(starter.repo)}</strong></p>
      ${renderHtmlList([
        starter.starterLabel ? `Pfad: ${starter.starterLabel}` : null,
        starter.implementationGoal,
        `Erster Schnitt: ${starter.firstSlice}`,
        `Zielbereiche: ${(starter.targetAreas ?? []).join(", ") || "-"}`,
        `Modus: ${starter.starterMode}`
      ].filter(Boolean), emptyCopy)}
      <details class="repo-details">
        <summary>Checkliste oeffnen</summary>
        ${renderHtmlList(starter.compareChecklist ?? [], "Keine Vergleichscheckliste vorhanden.")}
        ${renderHtmlList((starter.stopIf ?? []).map((item) => `Stoppe, wenn ${item}`), "Keine Stoppregeln vorhanden.")}
      </details>
    `;
  };

  return `<div class="coverage-grid coverage-grid--balanced">
  <article class="coverage-card coverage-card--wide">
    <h3>Handlungsauftrag</h3>
    ${renderHtmlList(agentView.mission ?? [], "Kein Handlungsauftrag hinterlegt.")}
  </article>
  <article class="coverage-card coverage-card--wide">
    <h3>Lieferziel</h3>
    ${renderHtmlList(agentView.deliverable ?? [], "Kein Lieferziel hinterlegt.")}
  </article>
  <article class="coverage-card">
    <h3>Priorisierte Repos</h3>
    ${priorityItems.length > 0 ? `<ul class="bullets">${priorityItems.map((item) => `<li>${item}</li>`).join("")}</ul>` : `<p class="empty">Keine priorisierten Repos vorhanden.</p>`}
  </article>
  <article class="coverage-card">
    <h3>Wichtiger Kontext</h3>
    ${renderHtmlList(agentView.context ?? [], "Kein Zusatzkontext hinterlegt.")}
  </article>
  <article class="coverage-card">
    <h3>Leitplanken</h3>
    ${renderHtmlList(agentView.guardrails ?? [], "Keine besonderen Leitplanken erfasst.")}
  </article>
  <article class="coverage-card coverage-card--wide">
    <h3>Offene Unsicherheiten</h3>
    ${renderHtmlList(agentView.uncertainties ?? [], "Aktuell sind keine besonderen Unsicherheiten hervorgehoben.")}
  </article>
  <article class="coverage-card coverage-card--wide">
    <h3>Coding Starter</h3>
    ${primaryStarter ? `
      <div class="subsection-block">
        <h4>Primaerer Pfad</h4>
        ${renderStarterCard(primaryStarter)}
      </div>
      ${secondaryStarters.length > 0 ? `
        <div class="subsection-block">
          <h4>Sekundaere Vergleichspfade</h4>
          <div class="coverage-grid coverage-grid--stacked">
            ${secondaryStarters.map((starter) => `<article class="coverage-card">${renderStarterCard(starter)}</article>`).join("")}
          </div>
        </div>
      ` : ""}
    ` : `<p class="empty">Fuer diesen Lauf ist aktuell noch kein prototyp-tauglicher Coding-Starter vorhanden.</p>`}
  </article>
  <article class="coverage-card coverage-card--wide">
    <h3>Maschinenlesbares Snapshot</h3>
    <p class="repo-copy">Diese JSON-Sicht ist fuer Coding Agents gedacht. Sie enthaelt den kompakten Auftrag, Prioritaeten, Kontext, Leitplanken und Unsicherheiten in stabiler Form.</p>
    <div class="agent-actions">
      <button type="button" class="agent-action-button" data-agent-action="open">Agent Hand-Off oeffnen</button>
      <button type="button" class="agent-action-button" data-agent-action="download" data-agent-filename="${downloadName}">Agent Hand-Off herunterladen</button>
    </div>
    <details class="repo-details agent-json">
      <summary>JSON anzeigen</summary>
      <pre class="agent-pre">${escapeHtml(payloadJson)}</pre>
    </details>
  </article>
</div>`;
}

export function renderCoverageCards(coverage) {
  const groups = [
    { title: "Hauptlayer", items: coverage.mainLayers.map((item) => `${localizeSystemTerm(item.value)}: ${item.count}`) },
    { title: "Lueckenbereiche", items: coverage.gapAreas.map((item) => `${localizeSystemTerm(item.value)}: ${item.count}`) },
    { title: "Faehigkeiten", items: coverage.capabilities.map((item) => `${localizeSystemTerm(item.value)}: ${item.count}`) }
  ];
  return `<div class="coverage-grid coverage-grid--stacked">${groups.map((group) => {
    const parsed = group.items.map((item) => {
      const [value, count] = item.split(": ");
      return { value, count: Number(count || 0) };
    });
    const maxCount = parsed.reduce((highest, item) => Math.max(highest, item.count), 1);
    return `<article class="coverage-card">
  <h3>${escapeHtml(group.title)}</h3>
  ${parsed.length === 0 ? renderHtmlList([], "keine") : `<div class="bar-list">${parsed.map((item) => `<div class="bar-row">
    <span class="bar-label">${escapeHtml(item.value)}</span>
    <span class="bar-track"><span class="bar-fill" data-width="${Math.max(12, Math.round((item.count / maxCount) * 100))}"></span></span>
    <span class="bar-count">${item.count}</span>
  </div>`).join("")}</div>`}
</article>`;
  }).join("")}</div>`;
}

export function renderReviewScopeCards(review) {
  const scopeLabel = review.reviewScope === "selected_urls" ? "Explizite URLs" : "Beobachtungsliste";
  const scopeCopy = review.reviewScope === "selected_urls"
    ? "Dieser Lauf fokussiert nur die explizit uebergebenen Repository-URLs."
    : "Dieser Lauf vergleicht die aktuelle Watchlist des Projekts mit Intake-Daten aus der Queue.";
  const selectionLines = review.selectedUrls?.length > 0
    ? review.selectedUrls.map((url) => url)
    : [];

  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Umfang des Laufs</h3>
    ${renderHtmlList([
      `Umfang: ${scopeLabel}`,
      `Eingangs-URLs: ${review.inputUrlCount ?? 0}`,
      `Beobachtungslisten-URLs: ${review.watchlistCount ?? 0}`,
      scopeCopy
    ], "Keine Scope-Metadaten vorhanden.")}
  </article>
  <article class="coverage-card">
    <h3>Explizite Auswahl</h3>
    ${renderHtmlList(
      selectionLines,
      review.reviewScope === "selected_urls"
        ? "Fuer diesen Lauf wurden keine expliziten URLs erfasst."
        : "Dieser Lauf hat die Beobachtungsliste statt einer expliziten URL-Auswahl verwendet."
    )}
  </article>
  <article class="coverage-card">
    <h3>Zustand der Entscheidungsdaten</h3>
    ${renderHtmlList([
      `Vollstaendig: ${review.itemsDataStateSummary?.complete ?? 0}`,
      `Fallback: ${review.itemsDataStateSummary?.fallback ?? 0}`,
      `Veraltet: ${review.itemsDataStateSummary?.stale ?? 0}`,
      `Laufvertrauen: ${localizeGeneratedText(review.runConfidence ?? "unbekannt")}`
    ], "Keine Zusammenfassung zum Entscheidungszustand vorhanden.")}
  </article>
</div>`;
}

function renderArtifactCard(title, copy, href, label = href, options = {}) {
  const linkAttrs = [
    options.openInNewTab ? 'target="_blank"' : "",
    options.openInNewTab ? 'rel="noreferrer noopener"' : ""
  ].filter(Boolean).join(" ");
  return `<article class="coverage-card">
  <h3>${escapeHtml(title)}</h3>
  <p class="repo-copy">${escapeHtml(copy)}</p>
  ${href ? `<p class="repo-url"><a href="${escapeHtml(href)}" ${linkAttrs}>${escapeHtml(label || href)}</a></p>` : `<p class="empty">Kein Artefakt verfuegbar.</p>`}
</article>`;
}

export function renderOnDemandRunCards(summary) {
  const reviewScope = summary.reviewRun?.review?.reviewScope ?? "not_run";
  const reviewLabel = reviewScope === "selected_urls" ? "explizite URLs" : reviewScope === "watchlist" ? "Beobachtungsliste" : "nicht gelaufen";
  const runPlan = summary.runPlan ?? null;

  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Laufmodus</h3>
    ${renderHtmlList([
      `Laufart: ${runPlan?.runKind ?? "unbekannt"}`,
      `Fokus: ${localizeGeneratedText(runPlan?.recommendedFocus ?? "-")}`,
      `Quellmodus: ${localizeGeneratedText(summary.sourceMode)}`,
      `Explizite URLs: ${summary.explicitUrls.length}`,
      `Wirksame URLs: ${summary.effectiveUrls.length}`,
      `Watchlist anhaengen: ${summary.appendWatchlist ? "ja" : "nein"}`
    ], "Keine Laufmetadaten vorhanden.")}
  </article>
  <article class="coverage-card">
    <h3>Status der Phasen</h3>
    ${renderHtmlList([
      `Intake-Eintraege: ${summary.intakeRun?.items?.length ?? 0}`,
      `Neu bewertete Zeilen: ${summary.reEvaluateRun?.updates?.length ?? 0}`,
      `Review-Umfang: ${reviewLabel}`,
      `Promotions-Eintraege: ${summary.promoteRun?.items?.length ?? 0}`
    ], "Keine Phasendaten vorhanden.")}
  </article>
  <article class="coverage-card">
    <h3>Qualitaet der Review-Daten</h3>
    ${renderHtmlList([
      `Laufvertrauen: ${localizeGeneratedText(summary.reviewRun?.review?.runConfidence ?? "unbekannt")}`,
      `Vollstaendig: ${summary.reviewRun?.review?.itemsDataStateSummary?.complete ?? 0}`,
      `Fallback: ${summary.reviewRun?.review?.itemsDataStateSummary?.fallback ?? 0}`,
      `Veraltet: ${summary.reviewRun?.review?.itemsDataStateSummary?.stale ?? 0}`
    ], "Keine Zusammenfassung zur Datenqualitaet vorhanden.")}
  </article>
</div>`;
}

export function renderOnDemandArtifactCards(artifacts) {
  return `<div class="coverage-grid">
  ${renderArtifactCard(
    "Review-Bericht",
    "HTML-Bericht auf Projektebene, der fuer diesen On-Demand-Lauf erzeugt wurde.",
    artifacts.reviewReportHref,
    artifacts.reviewReportLabel
  )}
  ${renderArtifactCard(
    "Letzte Report-Metadaten",
    "Stabiler Projektzeiger auf den zuletzt erzeugten HTML-Bericht.",
    artifacts.latestReportHref,
    artifacts.latestReportLabel
  )}
  ${renderArtifactCard(
    "Agent Hand-Off",
    "Maschinenlesbare JSON-Uebergabe fuer Coding Agents mit Auftrag, Prioritaeten, Kontext, Leitplanken und Unsicherheiten.",
    artifacts.agentHandoffHref,
    artifacts.agentHandoffLabel,
    { openInNewTab: true }
  )}
  ${renderArtifactCard(
    "Browser-Link",
    "Lokaler Direktzeiger, um den letzten Projektbericht schnell zu oeffnen.",
    artifacts.browserLinkHref,
    artifacts.browserLinkLabel
  )}
</div>`;
}

export function renderOnDemandNextActions(actions) {
  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Was jetzt sinnvoll ist</h3>
    ${renderHtmlList((actions ?? []).map((item) => localizeGeneratedText(item)), "Fuer diesen Lauf gibt es gerade keine Folgeempfehlung.")}
  </article>
</div>`;
}

export function renderOnDemandRunPlanCards(runPlan) {
  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Lifecycle-Hinweise</h3>
    ${renderHtmlList(runPlan?.notes ?? [], "Fuer diesen Lauf sind keine Lifecycle-Hinweise vorhanden.")}
  </article>
  <article class="coverage-card">
    <h3>Standardform der Phasen</h3>
    ${renderHtmlList([
      `Intake: ${runPlan?.defaultPhases?.intake ?? "-"}`,
      `Re-evaluate: ${runPlan?.defaultPhases?.reEvaluate ?? "-"}`,
      `Review: ${runPlan?.defaultPhases?.review ?? "-"}`,
      `Promote: ${runPlan?.defaultPhases?.promote ?? "-"}`
    ], "Keine Phasenempfehlung verfuegbar.")}
  </article>
</div>`;
}

export function renderOnDemandRunDriftCards(runDrift) {
  const signalLines = (runDrift?.signals ?? []).map((item) => `${localizeGeneratedText(item.severity.toUpperCase())} · ${localizeGeneratedText(item.id)} · ${localizeGeneratedText(item.message)}`);
  const queueDecisionStateSummary = runDrift?.queueSnapshot?.decisionStateSummary ?? {};
  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Drift-Status</h3>
    ${renderHtmlList([
      `Status: ${localizeGeneratedText(runDrift?.driftStatus ?? "-")}`,
      `Signale: ${(runDrift?.signals ?? []).length}`,
      `Fortsetzungsmodus: ${localizeGeneratedText(runDrift?.resumeGuidance?.mode ?? "-")}`,
      `Naechster Wiederanlauf: ${localizeGeneratedText(runDrift?.resumeGuidance?.nextAction ?? "-")}`
    ], "Keine Drift-Zusammenfassung fuer diesen Lauf vorhanden.")}
  </article>
  <article class="coverage-card">
    <h3>Zustand der Queue</h3>
    ${renderHtmlList([
      `Complete: ${queueDecisionStateSummary.complete ?? 0}`,
      `Fallback: ${queueDecisionStateSummary.fallback ?? 0}`,
      `Stale: ${queueDecisionStateSummary.stale ?? 0}`
    ], "Keine Queue-Zusammenfassung zum Entscheidungszustand vorhanden.")}
  </article>
  <article class="coverage-card">
    <h3>Signale</h3>
    ${renderHtmlList(signalLines, "Aktuell sind keine Drift-Signale aktiv.")}
  </article>
</div>`;
}

export function renderOnDemandGovernanceCards(governance) {
  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Governance-Status</h3>
    ${renderHtmlList([
      `Status: ${localizeGeneratedText(governance?.status ?? "-")}`,
      `Automatischer Dispatch erlaubt: ${governance?.autoDispatchAllowed ? "ja" : "nein"}`,
      `Automatisches Apply erlaubt: ${governance?.autoApplyAllowed ? "ja" : "nein"}`,
      `Empfohlener Promotionsmodus: ${localizeGeneratedText(governance?.recommendedPromotionMode ?? "-")}`
    ], "Fuer diesen Lauf liegt kein Governance-Snapshot vor.")}
  </article>
  <article class="coverage-card">
    <h3>Blockierte Phasen</h3>
    ${renderHtmlList((governance?.blockedPhases ?? []).map((item) => localizeGeneratedText(item)), "Derzeit sind keine Phasen blockiert.")}
  </article>
  <article class="coverage-card">
    <h3>Naechster Schritt</h3>
    ${renderHtmlList([governance?.nextAction].filter(Boolean).map((item) => localizeGeneratedText(item)), "Es gibt gerade keinen Governance-Folgeschritt.")}
  </article>
</div>`;
}

export function renderOnDemandStabilityCards(stability) {
  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Stabilitaetsstatus</h3>
    ${renderHtmlList([
      `Status: ${localizeGeneratedText(stability?.status ?? "-")}`,
      `Stabile Serie: ${stability?.stableStreak ?? 0}`,
      `Instabile Serie: ${stability?.unstableStreak ?? 0}`,
      `Verglichene Paare: ${stability?.comparedPairs ?? 0}`
    ], "Keine Stabilitaetszusammenfassung fuer diesen Lauf vorhanden.")}
  </article>
</div>`;
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

  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Zuerst gelesene Dateien</h3>
    ${renderHtmlList(
      loadedFiles.length > 0 ? loadedFiles : declaredFiles,
      "Fuer dieses Ziel-Repository sind keine Kontextdateien konfiguriert."
    )}
  </article>
  <article class="coverage-card">
    <h3>Fehlende konfigurierte Dateien</h3>
    ${renderHtmlList(missingFiles, "Alle konfigurierten Kontextdateien waren verfuegbar.")}
  </article>
  <article class="coverage-card">
    <h3>Durchsuchte Verzeichnisse</h3>
    ${renderHtmlList(
      nonEmptyDirectories.length > 0
        ? nonEmptyDirectories.map((item) => localizeGeneratedText(`${item.path}/ (${item.entryCount} entries sampled)`))
        : declaredDirectories.map((item) => `${item}/`),
      "Es ist kein Verzeichniskontext konfiguriert."
    )}
  </article>
  <article class="coverage-card">
    <h3>Extrahierte Signale</h3>
    ${renderHtmlList(
      capabilitiesPresent.map((item) => `Faehigkeit: ${localizeSystemTerm(item)}`),
      "Aus dem aktuellen Kontext wurden keine Zielprojekt-Capabilities abgeleitet."
    )}
  </article>
</div>`;
}

export function renderReportToolbar({ modeOptions, layerOptions }) {
  return `<section class="toolbar-card section-card toolbar-card--compact" id="report-toolbar">
  <header class="section-head toolbar-headline">
    <div class="toolbar-title-group">
      <p class="panel-kicker">Filter</p>
      <h2>Bericht filtern</h2>
    </div>
    <p class="toolbar-inline-help">Nur fuer laengere Berichte. Fuer kurze Laeufe meist nicht noetig.</p>
  </header>
  <div class="toolbar-grid toolbar-grid--compact">
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
  ${renderFilterIndicator()}
</section>`;
}
