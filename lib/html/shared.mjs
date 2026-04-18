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
    ? "ENTDECKUNGSBERICHT"
    : reportType === "on_demand"
      ? "AD-HOC-LAUF"
      : "VERGLEICHSBERICHT";
  return `<header class="hero" id="hero">
  <img src="${LOGO_BASE64}" alt="Patternpilot" class="hero-logo">
  <h1 class="hero-brand">Pattern<span class="pilot">pilot</span></h1>
  <p class="hero-subtitle">Repository-Intelligenz-System</p>
  <div class="hero-divider"></div>
  <p class="hero-claim">
    <span class="word discover">Finden.</span>
    <span class="word">Einordnen.</span>
    <span class="word">Entscheiden.</span>
  </p>
  <div class="hero-project-card">
    <div class="hero-project-type">${escapeHtml(typeLabel)}</div>
    <div class="hero-project-name">${escapeHtml(projectKey)}</div>
    <div class="hero-project-meta">${escapeHtml(dateStr)} &middot; ${escapeHtml(subtitle)} &middot; ${escapeHtml(String(candidateCount))} Kandidaten</div>
  </div>
  <button class="pdf-export-btn" onclick="window.print()" type="button">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
    Als PDF exportieren
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
  if (disposition === "intake_now") return { label: "Uebernehmen", tone: "accent" };
  if (disposition === "review_queue") return { label: "Vertiefen", tone: "info" };
  if (disposition === "observe_only") return { label: "Beobachten", tone: "warn" };
  return { label: "Zurueckstellen", tone: "neutral" };
}

export function localizeFitBand(value) {
  if (value === "high") return "hoch";
  if (value === "medium") return "mittel";
  if (value === "low") return "niedrig";
  if (value === "unknown") return "unbekannt";
  return value ?? "unbekannt";
}

export function localizeDisposition(value) {
  if (value === "intake_now") return "jetzt aufnehmen";
  if (value === "review_queue") return "vertieft pruefen";
  if (value === "observe_only") return "beobachten";
  if (value === "watch_only") return "nur beobachten";
  return value ?? "unbekannt";
}

export function localizeGeneratedText(value) {
  const input = String(value ?? "");
  if (!input) {
    return "";
  }

  const replacements = [
    [/Needs manual review\./g, "Braucht eine manuelle Pruefung."],
    [/needs_review/g, "manuell pruefen"],
    [/Needs deeper repo reading to confirm system depth/gi, "Braucht eine tiefere Repo-Lektuere, um die Systemtiefe sicher zu bestaetigen"],
    [/Remote enrichment failed, so repo context is still shallow/gi, "Das Remote-Enrichment ist fehlgeschlagen, deshalb bleibt der Repo-Kontext noch oberflaechlich"],
    [/Needs review with remote metadata unavailable/gi, "Braucht eine Pruefung, weil keine Remote-Metadaten verfuegbar sind"],
    [/Scheduling infrastructure for absolutely everyone\./gi, "Terminplanungs-Infrastruktur fuer praktisch alle Anwendungsfaelle."],
    [/Scrape, standardize and share public meetings from local government websites/gi, "Oeffentliche Sitzungen von kommunalen Websites erfassen, standardisieren und bereitstellen"],
    [/A highly customizable homepage \(or startpage \/ application dashboard\) with Docker and service API integrations\./gi, "Eine stark anpassbare Startseite bzw. ein Anwendungs-Dashboard mit Docker- und Service-API-Integrationen."],
    [/keep on review watchlist until there is a sharper project need\./gi, "Auf der Review-Beobachtungsliste halten, bis es einen schaerferen Projektbedarf gibt."],
    [/Promote the top 3 candidates into focused manual review\./gi, "Die drei staerksten Kandidaten in eine gezielte manuelle Pruefung uebernehmen."],
    [/Discovery can be widened for uncovered areas/gi, "Die Discovery kann fuer offene Bereiche erweitert werden"],
    [/data model and semantics\./gi, "Datenmodell und Semantik."],
    [/([0-9]+) high-fit candidates, capability diversity ([0-9]+%)/gi, "$1 hoch passende Kandidaten, Faehigkeitsvielfalt $2"],
    [/Review and adapt the pattern into the target-project architecture, not as direct dependency\./g, "Muster pruefen und in die Zielarchitektur des Projekts uebertragen, nicht als direkte Abhaengigkeit."],
    [/Compare the repo against the target's source-system architecture\./g, "Vergleiche das Repo mit der Quellsystem-Architektur des Zielprojekts."],
    [/Read as a surface\/distribution signal layered on top of the core\./g, "Lies dieses Repo als Oberflaechen- oder Verteilungssignal, das auf dem Kern aufsetzt."],
    [/Use primarily as a risk or anti-pattern signal\./g, "Nutze dieses Repo vor allem als Risiko- oder Anti-Pattern-Signal."],
    [/Architecture, opportunities and risks in one pass\./g, "Architektur, Chancen und Risiken in einem Durchgang."],
    [/Open the review report and compare deeply\./g, "Oeffne den Review-Bericht und vergleiche gezielt."],
    [/Open the review report first\./g, "Oeffne zuerst den Review-Bericht."],
    [/Decide whether the repo should enter the watchlist\.?/g, "Entscheide bewusst, ob das Repo in die Beobachtungsliste aufgenommen werden soll."],
    [/Decide deliberately whether this repo should stay one-off or also enter the project watchlist\./g, "Entscheide bewusst, ob dieses Repo ein Einzelfall bleibt oder auch in die Beobachtungsliste kommt."],
    [/Refresh stale queue items before the next broader review:/g, "Frische veraltete Queue-Eintraege vor dem naechsten breiteren Review auf:"],
    [/At least one repo needs manual review because GitHub enrichment failed\./g, "Mindestens ein Repo braucht eine manuelle Pruefung, weil das GitHub-Enrichment fehlgeschlagen ist."],
    [/All supplied repos were already known\. Use review or re-evaluate before broadening the scope\./g, "Alle uebergebenen Repos waren bereits bekannt. Nutze Review oder Re-Evaluate, bevor du den Umfang weiter oeffnest."],
    [/clear source model/g, "klares Quellenmodell"],
    [/brittle_platform_changes/g, "anfaellig bei Plattformaenderungen"],
    [/balanced signals/g, "ausgewogene Signale"],
    [/fit=high/gi, "Passung=hoch"],
    [/fit=medium/gi, "Passung=mittel"],
    [/fit=low/gi, "Passung=niedrig"],
    [/fit=unknown/gi, "Passung=unbekannt"],
    [/capabilities=/gi, "Faehigkeiten="],
    [/Capabilities/g, "Faehigkeiten"],
    [/capability:/g, "Faehigkeit:"],
    [/Topics:/g, "Themen:"],
    [/Languages:/g, "Sprachen:"],
    [/Likely decision-relevant for (the )?target project soon/gi, "Wahrscheinlich bald entscheidungsrelevant fuer das Zielprojekt"],
    [/entries sampled/g, "Eintraege gelesen"],
    [/selected urls/gi, "explizite URLs"],
    [/watchlist/gi, "Beobachtungsliste"],
    [/none/gi, "keine"],
    [/High value, low effort/g, "hoher Wert, niedriger Aufwand"],
    [/High value, medium effort/g, "hoher Wert, mittlerer Aufwand"],
    [/High value, high effort/g, "hoher Wert, hoher Aufwand"],
    [/Medium value, low effort/g, "mittlerer Wert, niedriger Aufwand"],
    [/Medium value, medium effort/g, "mittlerer Wert, mittlerer Aufwand"],
    [/Medium value, high effort/g, "mittlerer Wert, hoher Aufwand"],
    [/Low value, low effort/g, "niedriger Wert, niedriger Aufwand"],
    [/Low value, medium effort/g, "niedriger Wert, mittlerer Aufwand"],
    [/Low value, high effort/g, "niedriger Wert, hoher Aufwand"],
    [/candidate for direct intake/gi, "direkt fuer die Aufnahme geeignet"],
    [/review before adoption/gi, "vor einer Uebernahme genauer pruefen"],
    [/observe or defer/gi, "beobachten oder zurueckstellen"],
    [/skip/gi, "ueberspringen"],
    [/Watch for later/g, "spaeter beobachten"],
    [/same net score and fit as /g, "gleicher Netto-Score und gleicher Fit wie "],
    [/same net score but better fit/g, "gleicher Netto-Score, aber besserer Fit"],
    [/same net score/g, "gleicher Netto-Score"],
    [/Review skipped in this run\./g, "In diesem Lauf wurde kein Review erzeugt."],
    [/manual review/gi, "manuelle Pruefung"],
    [/Balanced/g, "Ausgewogen"],
    [/\bingestion\b/gi, "Aufnahme"],
    [/\bdistribution\b/gi, "Ausspielung"],
    [/\bsource_first\b/gi, "Quelle zuerst"],
    [/Source First/g, "Quelle zuerst"],
    [/\bdata model\b/gi, "Datenmodell"],
    [/\bdistribution_surfaces\b/gi, "Ausspielungsflaechen"],
    [/\bquality_governance\b/gi, "Qualitaet und Governance"],
    [/\blocation_intelligence\b/gi, "Ortsintelligenz"],
    [/\bsource_intake\b/gi, "Quellaufnahme"],
    [/\bsource_systems_and_families\b/gi, "Quellsysteme und Familien"],
    [/\brisk_and_dependency_awareness\b/gi, "Risiko- und Abhaengigkeitsbewusstsein"],
    [/\bresearch_signal\b/gi, "Recherche-Signal"],
    [/\bhigh\b/g, "hoch"],
    [/\bmedium\b/g, "mittel"],
    [/\blow\b/g, "niedrig"],
    [/\bunknown\b/g, "unbekannt"]
  ];

  return replacements.reduce((current, [pattern, replacement]) => current.replaceAll(pattern, replacement), input);
}

export function localizeSystemTerm(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "-";
  const lowerNormalized = normalized.toLowerCase();
  const mapping = {
    source_intake: "Quellaufnahme",
    export_feed_api: "Export, Feeds und API",
    research_signal: "Recherche-Signal",
    source_systems_and_families: "Quellsysteme und Familien",
    distribution_surfaces: "Ausspielungsflaechen",
    risk_and_dependency_awareness: "Risiko- und Abhaengigkeitsbewusstsein",
    location_intelligence: "Ortsintelligenz",
    quality_governance: "Qualitaet und Governance",
    source_first: "Quelle zuerst",
    ingestion: "Aufnahme",
    distribution: "Ausspielung",
    "data model": "Datenmodell",
    semantics: "Semantik",
    high: "hoch",
    medium: "mittel",
    low: "niedrig",
    unknown: "unbekannt",
    none: "keine"
  };
  return mapping[lowerNormalized] ?? localizeGeneratedText(normalized.replaceAll("_", " "));
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
    return "Keine Kandidaten vorhanden";
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
  return candidate.repo?.full_name ?? "unbekannt";
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
  return summary ? localizeGeneratedText(String(summary)) : "Manuell pruefen.";
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
  const label = category === "unknown" ? "Lizenz ?" : raw.trim() || "Lizenz ?";
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
    return `<p class="empty">Noch keine Empfehlungen vorhanden.</p>`;
  }
  return `<div class="recommendations">${recommendations.map((rec, i) => {
    const [repoRef, ...actionParts] = rec.split(": ");
    const localizedWhole = localizeGeneratedText(rec);
    const action = localizeGeneratedText(actionParts.join(": ") || "Manuell pruefen.");
    const slug = slugifyForId(repoRef);

    const candidate = (candidates || []).find((c) => {
      const name = getCandidateName(c);
      return name === repoRef;
    });
    const disposition = getCandidateDisposition(candidate);
    const type = candidate ? mapDispositionToType(disposition) : { label: "Hinweis", tone: "neutral" };
    const displayName = candidate ? repoRef : "Laufhinweis";
    const displayAction = candidate ? action : localizedWhole;

    return `<a href="#repo-${slug}" class="rec-card">
  <span class="rec-rank">${i + 1}</span>
  <div class="rec-text">
    <div class="rec-name">${escapeHtml(displayName)}</div>
    <div class="rec-action">${escapeHtml(truncateText(displayAction, 120))}</div>
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
    return `<p class="empty">Kein Discovery-Regelwerk fuer dieses Projekt konfiguriert.</p>`;
  }

  const blockerLines = (summary.blockerCounts ?? []).slice(0, 6).map((item) => `${item.value}: ${item.count}`);
  const previewLines = (summary.blockedPreview ?? []).slice(0, 4).map((item) => {
    const detail = item.blockers?.slice(0, 2).join(", ") || item.summary || "blocked";
    return `${item.repoRef}: ${detail}`;
  });
  const preferenceLines = (summary.preferenceCounts ?? []).slice(0, 6).map((item) => `${item.value}: ${item.count}`);

  return `<div class="coverage-grid">
    <article class="coverage-card">
      <h3>Regelwerk-Ergebnis</h3>
      <p class="repo-copy">Der Modus ${escapeHtml(localizeGeneratedText(summary.mode ?? "enforce"))} hat ${escapeHtml(summary.visible ?? summary.allowed ?? 0)} von ${escapeHtml(summary.evaluated ?? 0)} bewerteten Kandidaten sichtbar gelassen.</p>
      ${renderHtmlList([
        `Vom Regelwerk markiert: ${summary.blocked ?? 0}`,
        `Erzwungen ausgeblendet: ${summary.enforcedBlocked ?? 0}`,
        `Bevorzugte Treffer: ${summary.preferred ?? 0}`
      ], "Keine Regelwerk-Kennzahlen vorhanden.")}
    </article>
    <article class="coverage-card">
      <h3>Haeufigste Blocker</h3>
      ${renderHtmlList(blockerLines, "Keine Blockergruende vorhanden.")}
    </article>
    <article class="coverage-card">
      <h3>Geblockte Beispiele</h3>
      ${renderHtmlList(previewLines, "Keine geblockten Kandidaten.")}
    </article>
    <article class="coverage-card">
      <h3>Bevorzugte Treffer</h3>
      ${renderHtmlList(preferenceLines, "Keine bevorzugten Treffer.")}
    </article>
  </div>`;
}

export function renderPolicyCalibrationCard(discovery) {
  const calibration = discovery?.policyCalibration ?? null;
  if (!calibration) {
    return `<p class="empty">Keine Kalibrierungshinweise vorhanden.</p>`;
  }

  const blockerLines = (calibration.topBlockers ?? []).slice(0, 6).map((item) => `${item.value}: ${item.count}`);
  const hintLines = (calibration.recommendations ?? []).slice(0, 6);

  return `<div class="coverage-grid">
    <article class="coverage-card">
      <h3>Kalibrierungsstatus</h3>
      <p class="repo-copy">${escapeHtml((calibration.status ?? "unbekannt").replaceAll("unknown", "unbekannt"))}</p>
    </article>
    <article class="coverage-card">
      <h3>Staerkste Blockersignale</h3>
      ${renderHtmlList(blockerLines, "Keine Blockermuster erfasst.")}
    </article>
    <article class="coverage-card">
      <h3>Kalibrierungshinweise</h3>
      ${renderHtmlList(hintLines.map((item) => localizeGeneratedText(item)), "Keine Kalibrierungshinweise vorhanden.")}
    </article>
  </div>`;
}

export function renderDecisionSummary({ candidates, reportType, runRoot, discovery, review }) {
  const root = getRunRoot({ reportType, runRoot, discovery, review });
  if (!hasDecisionRunFields(root)) {
    const reportSchemaVersion = root?.reportSchemaVersion ?? "fehlend";
    return `<section class="section-card warn" id="decision-summary">
  <header class="section-head"><h2>Entscheidungsuebersicht</h2></header>
  <div class="section-body">
    <p class="empty">Engine-Daten unvollstaendig (reportSchemaVersion: ${escapeHtml(reportSchemaVersion)}) - dieser Run wurde vor der Engine-Upgrade-Integration erzeugt oder ist unvollstaendig. Lauf erneut ausfuehren, um aktuelle Bewertungen zu sehen.</p>
  </div>
</section>`;
  }

  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  const top = safeCandidates[0] ?? null;
  const topName = getCandidateName(top);
  const topDisposition = getCandidateDisposition(top);
  const topDispositionType = top ? mapDispositionToType(topDisposition) : { label: "Unbekannt", tone: "neutral" };
  const topDecision = top ? getCandidateDecisionSummary(top) : "Keine Kandidaten vorhanden.";
  const topValueScore = getCandidateValueScore(top);
  const topEffortScore = getCandidateEffortScore(top);
  const topFitBand = getCandidateFitBand(top);
  const strongestGapSignal = Array.isArray(root.runGapSignals) ? root.runGapSignals[0] ?? null : null;
  const topGap = strongestGapSignal?.gap ?? "unbekannt";
  const topGapHint = strongestGapSignal
    ? `Anzahl ${strongestGapSignal.count} · Staerke ${strongestGapSignal.strength}`
    : "Kein gewichtetes Lueckensignal vorhanden";

  const runConfidence = String(root.runConfidence ?? "unbekannt");
  const confidenceTone = runConfidence === "high" ? "accent" : runConfidence === "medium" ? "warn" : "neutral";
  const runConfidenceReason = truncateText(localizeGeneratedText(root.runConfidenceReason), 200);
  const stateSummary = root.itemsDataStateSummary ?? { complete: 0, fallback: 0, stale: 0 };
  const warnBanner = renderDataStateWarnBanner(stateSummary);

  return `<section class="section-card accent decision-summary-card" id="decision-summary">
  <header class="section-head"><h2>Entscheidungsuebersicht</h2></header>
  <div class="section-body">
    ${warnBanner}
    <div class="decision-summary-layout">
      <div class="decision-primary">
        <span class="summary-label">Empfohlene Bewegung</span>
        <div class="decision-callout">
          <div class="decision-callout-head">
            ${renderBadge(topDispositionType.label, topDispositionType.tone)}
            <span class="decision-callout-name">${escapeHtml(topName)}</span>
          </div>
          <p class="decision-callout-text">${escapeHtml(truncateText(topDecision, 220))}</p>
          <p class="decision-callout-meta">Wert ${escapeHtml(topValueScore ?? "-")} · Aufwand ${escapeHtml(topEffortScore ?? "-")} · Passung ${escapeHtml(localizeFitBand(topFitBand))}</p>
        </div>
      </div>
      <div class="decision-facts">
        <div class="summary-item">
          <span class="summary-label">Vertrauen in den Lauf</span>
          <span class="summary-value">${renderBadge(localizeFitBand(runConfidence), confidenceTone)} <span class="summary-hint">${escapeHtml(runConfidenceReason)}</span></span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Staerkster Treffer</span>
          <span class="summary-value">${escapeHtml(topName)}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Staerkstes Lueckensignal</span>
          <span class="summary-value">${escapeHtml(localizeSystemTerm(topGap))} <span class="summary-hint">${escapeHtml(localizeGeneratedText(topGapHint))}</span></span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Umfang des Reports</span>
          <span class="summary-value">${safeCandidates.length} Kandidaten analysiert</span>
        </div>
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
    { key: "adopt", label: "Uebernehmen", color: "var(--green)", items: groups.adopt },
    { key: "study", label: "Vertiefen", color: "var(--cyan)", items: groups.study },
    { key: "watch", label: "Beobachten", color: "var(--orange)", items: groups.watch },
    { key: "defer", label: "Zurueckstellen", color: "var(--ink-muted)", items: groups.defer }
  ].filter((g) => g.items.length > 0);

  if (configs.length === 0) return "";

  return `<section class="section-card action-summary-card" id="recommended-actions">
  <header class="section-head"><h2>Empfohlene Aktionen</h2></header>
  <div class="section-body">
    <div class="actions-grid">${configs.map((g) => `<article class="action-group" style="--group-color:${g.color}">
      <div class="action-group-head">
        <h3>${escapeHtml(g.label)}</h3>
        <span class="action-group-count">${g.items.length}</span>
      </div>
      ${g.items.map((item, idx) => `<a href="#repo-${slugifyForId(item.name)}" class="action-item${g.key === "adopt" && idx < 3 ? " ranked" : ""}">
        ${g.key === "adopt" ? `<span class="action-item__rank">${idx + 1}.</span>` : ""}
        <strong class="action-item__name">${escapeHtml(item.name)}</strong>
        ${g.key === "adopt" ? renderLicenseTag(item.license) : ""}
        ${item.reason ? `<span class="action-item__reason">${escapeHtml(item.reason)}</span>` : ""}
      </a>`).join("")}
    </article>`).join("")}</div>
  </div>
</section>`;
}
