import { classifyLicense } from "../classification/evaluation.mjs";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { getSectionInfo } from "./section-info.mjs";

export { classifyLicense } from "../classification/evaluation.mjs";

function renderSectionExplainButton(sectionId, fallbackTitle) {
  const info = getSectionInfo(sectionId);
  if (!info) return "";
  const title = info.title || fallbackTitle || sectionId;
  return `<button type="button" class="info-btn" aria-label="Erklaerung: ${escapeHtml(title)}" aria-haspopup="dialog" data-explain-title="${escapeHtml(title)}" data-explain-body="${escapeHtml(info.body)}">i</button>`;
}

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

const STAT_ACCENT_ROTATION = ["magenta", "purple", "orange", "green", "cyan", "mixed"];

export function renderHtmlStatCards(stats) {
  return stats
    .map((stat, index) => {
      const variant = stat.primary === false ? "meta" : "primary";
      const accent = STAT_ACCENT_ROTATION[index % STAT_ACCENT_ROTATION.length];
      const variantClass = variant === "meta" ? " meta" : "";
      const accentClass = ` accent-${accent}`;
      return `<div class="stat${variantClass}${accentClass}">
  <div class="k">${escapeHtml(stat.label)}</div>
  <div class="v">${escapeHtml(stat.value)}</div>
</div>`;
    })
    .join("\n");
}

export function renderHtmlSection(title, body, tone = "default", sectionId = "") {
  const idAttr = sectionId ? ` id="${escapeHtml(sectionId)}" data-nav-section` : "";
  const accentClass = sectionPreviewAccent(sectionId, tone);
  const explainBtn = renderSectionExplainButton(sectionId, title);
  const headActions = explainBtn ? `<div class="head-actions">${explainBtn}</div>` : "";
  return `<section class="section-preview ${accentClass}"${idAttr}>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>${escapeHtml(title)}</h2>
    </div>
    ${headActions}
  </div>
  <div class="section-body">
    ${body}
  </div>
</section>`;
}

function sectionPreviewAccent(sectionId, tone) {
  const id = String(sectionId || "").toLowerCase();
  if (id.includes("recommendations") || id.includes("empfehl")) return "accent-magenta";
  if (id.includes("coverage") || id.includes("achsen")) return "accent-purple";
  if (id.includes("decision") || id.includes("entscheid")) return "accent-orange";
  if (id.includes("context") || id.includes("lauf") || id.includes("kontext")) return "accent-green";
  if (tone === "warn") return "accent-orange";
  if (tone === "info") return "accent-purple";
  return "accent-magenta";
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
    ? "Entdeckungsbericht"
    : reportType === "on_demand"
      ? "Ad-hoc-Lauf"
      : "Vergleichsbericht";
  const metaLine = `${escapeHtml(typeLabel)} · ${escapeHtml(projectKey)} · ${escapeHtml(dateStr)} · ${escapeHtml(subtitle)} · ${escapeHtml(String(candidateCount))} Kandidaten`;
  return `<section class="hero" id="hero">
  <h1>Pattern<br><span class="pilot">Pilot</span></h1>
  <p class="slogan">Repository-Intelligenz fuer dein Zielprojekt — Finden, Einordnen, Entscheiden.</p>
  <p class="hero-meta" style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); margin-top: 28px;">${metaLine}</p>
</section>`;
}

export function renderStickyNav(sections) {
  const items = sections
    .filter((s) => s.id && s.navLabel)
    .map((s, index) => {
      const number = String(index + 1).padStart(2, "0");
      return `    <li><a href="#${escapeHtml(s.id)}"><span class="n">${number}</span>${escapeHtml(s.navLabel)}</a></li>`;
    })
    .join("\n");
  return `<nav class="sidenav" id="sticky-nav">
  <a href="#top" class="sidenav-logo-link" aria-label="Zum Seitenanfang">
    <img src="${LOGO_BASE64}" alt="Patternpilot" class="sidenav-logo">
  </a>
  <div class="sidenav-eyebrow">Inhalt</div>
  <ul class="sidenav-list">
${items}
  </ul>
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
    [/Matched discovery lenses:/gi, "Treffer in Discovery-Linsen:"],
    [/Query families:/gi, "Suchbahnen:"],
    [/Project fit is high \(([0-9]+)\)\./gi, "Projektpassung ist hoch ($1)."],
    [/Project fit is medium \(([0-9]+)\)\./gi, "Projektpassung ist mittel ($1)."],
    [/Project fit is low \(([0-9]+)\)\./gi, "Projektpassung ist niedrig ($1)."],
    [/Matched capabilities:/gi, "Passende Faehigkeiten:"],
    [/Candidate class:/gi, "Kandidatenklasse:"],
    [/Evidence grade is strong \(([0-9]+)\)\./gi, "Evidenzgrad ist stark ($1)."],
    [/Evidence grade is solid \(([0-9]+)\)\./gi, "Evidenzgrad ist solide ($1)."],
    [/Evidence grade is light \(([0-9]+)\)\./gi, "Evidenzgrad ist leicht ($1)."],
    [/Source-family signals:/gi, "Quellfamilien-Signale:"],
    [/Public-event-intake signals:/gi, "Public-Event-Intake-Signale:"],
    [/Governance signals:/gi, "Governance-Signale:"],
    [/Normalization signals:/gi, "Normalisierungs-Signale:"],
    [/Topic overlap:/gi, "Themen-Ueberschneidung:"],
    [/README overlap:/gi, "README-Ueberschneidung:"],
    [/Project-keyword overlap:/gi, "Projekt-Schluesselwort-Ueberschneidung:"],
    [/Main tensions:/gi, "Hauptspannungen:"],
    [/Feedback-loop positives:/gi, "Positive Feedback-Signale:"],
    [/Feedback-loop negatives:/gi, "Negative Feedback-Signale:"],
    [/Vertical-specialization signals:/gi, "Vertikale Spezialisierungs-Signale:"],
    [/Archived repos are downgraded to pattern-signal only\./gi, "Archivierte Repos werden nur noch als Muster-Signal gewertet."],
    [/Architecture and layer patterns/gi, "Architektur- und Schichtmuster"],
    [/Dependency and tooling neighbors/gi, "Abhaengigkeits- und Tooling-Nachbarn"],
    [/capability, architecture, dependency/gi, "Faehigkeit, Architektur, Abhaengigkeit"],
    [/capability, architecture/gi, "Faehigkeit, Architektur"],
    [/architecture, dependency/gi, "Architektur, Abhaengigkeit"],
    [/capability, dependency/gi, "Faehigkeit, Abhaengigkeit"],
    [/\bcapability\b/gi, "Faehigkeit"],
    [/\barchitecture\b/gi, "Architektur"],
    [/\bdependency\b/gi, "Abhaengigkeit"],
    [/\bsignal lane\b/gi, "Signalbahn"],
    [/Ingestion and adapters/gi, "Aufnahme und Adapter"],
    [/Data model and semantics/gi, "Datenmodell und Semantik"],
    [/Distribution and surfaces/gi, "Ausspielung und Oberflaechen"],
    [/Civic and public-event intake/gi, "Civic- und Public-Event-Intake"],
    [/Governed normalization and QA/gi, "Gesteuerte Normalisierung und QA"],
    [/Static site with a calendar of scraped events from City Scrapers projects/gi, "Statische Site mit einem Kalender aus gescrapten Eventdaten der City-Scrapers-Projekte."],
    [/Scraper autom[aá]tico de la agenda de Lumiton que genera calendarios ICS y CSV\./gi, "Automatisierter Scraper fuer die Lumiton-Agenda, der ICS- und CSV-Kalender erzeugt."],
    [/No public description available\./gi, "Keine oeffentliche Beschreibung vorhanden."],
    [/Treat as a research or pattern signal until a sharper project need exists\./gi, "Vor allem als Recherche- oder Mustersignal lesen, bis ein schaerferer Projektbedarf vorliegt."],
    [/This repo should be read as a pattern signal for the target project rather than copied as-is\./gi, "Dieses Repo sollte als Mustersignal fuer das Zielprojekt gelesen und nicht einfach uebernommen werden."],
    [/Review whether this should inform adapter families, not just one-off integrations\./gi, "Pruefe, ob dieses Repo Adapter-Familien staerkt und nicht nur einmalige Integrationen."],
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
    [/Quick/g, "Schnell"],
    [/Balanced/g, "Ausgewogen"],
    [/Standard/g, "Standard"],
    [/Deep/g, "Tief"],
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
    [/\bfit_candidate\b/gi, "Passungs-Kandidat"],
    [/\bboundary_signal\b/gi, "Grenzsignal"],
    [/\brisk_signal\b/gi, "Risikosignal"],
    [/\bweak_signal\b/gi, "Schwaches Signal"],
    [/\bfit candidate\b/gi, "Passungs-Kandidat"],
    [/\bresearch signal\b/gi, "Recherche-Signal"],
    [/\bboundary signal\b/gi, "Grenzsignal"],
    [/\brisk signal\b/gi, "Risikosignal"],
    [/\bweak signal\b/gi, "Schwaches Signal"],
    [/\bstrong\b/gi, "stark"],
    [/\bsolid\b/gi, "solide"],
    [/\blight\b/gi, "leicht"],
    [/\bmaintenance_risk\b/gi, "Wartungsrisiko"],
    [/\bmaintenance risk\b/gi, "Wartungsrisiko"],
    [/\bsource_lock_in\b/gi, "Quell-Lock-in"],
    [/\bsource lock in\b/gi, "Quell-Lock-in"],
    [/\bplatform_bound\b/gi, "plattformgebunden"],
    [/\bplatform bound\b/gi, "plattformgebunden"],
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
    quick: "Schnell",
    standard: "Standard",
    deep: "Tief",
    strong: "stark",
    solid: "solide",
    light: "leicht",
    source_intake: "Quellaufnahme",
    access_fetch: "Zugriff und Abruf",
    parsing_extraction: "Parsing und Extraktion",
    location_place_enrichment: "Orts- und Platzanreicherung",
    connector_families: "Connector-Familien",
    capability: "Faehigkeit",
    architecture: "Architektur",
    dependency: "Abhaengigkeit",
    signal_lane: "Signalbahn",
    export_feed_api: "Export, Feeds und API",
    research_signal: "Recherche-Signal",
    fit_candidate: "Passungs-Kandidat",
    boundary_signal: "Grenzsignal",
    risk_signal: "Risikosignal",
    weak_signal: "Schwaches Signal",
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

const DISPOSITION_TO_BADGE = {
  intake_now: { tone: "adopt", label: "Uebernehmen" },
  review_queue: { tone: "adapt", label: "Vertiefen" },
  observe_only: { tone: "observe", label: "Beobachten" },
  watch_only: { tone: "observe", label: "Beobachten" }
};

const DISPOSITION_EXPLAIN = {
  adopt: {
    title: "Warum uebernehmen?",
    body: "Uebernehmen bedeutet: Dieses Repo oder Muster ist nach Bewertung stark genug, dass Pattern Pilot zu einer direkten Integration in dein Zielprojekt raet. Es sollte jetzt ins Intake ueberfuehrt und fuer die Aufnahme in die Landkarte vorbereitet werden."
  },
  adapt: {
    title: "Warum vertiefen?",
    body: "Vertiefen bedeutet: Das Muster ist tragfaehig, aber nicht 1:1 uebertragbar. Du solltest es manuell pruefen, relevante Teile identifizieren und eine angepasste Uebernahme skizzieren, bevor du es produktiv einsetzt."
  },
  observe: {
    title: "Warum beobachten?",
    body: "Beobachten bedeutet: Dieses Repo ist strategisch interessant, aber aktuell nicht dringend genug fuer eine Uebernahme oder Adaption. Patternpilot empfiehlt, es im Blick zu halten — z.B. ueber die Watchlist — und bei spaeterer Entwicklung neu zu bewerten."
  }
};

export function buildBadgeExplainAttrs(tone) {
  const explain = DISPOSITION_EXPLAIN[tone];
  if (!explain) return "";
  return ` data-explain-title="${escapeHtml(explain.title)}" data-explain-body="${escapeHtml(explain.body)}"`;
}

export function renderTopRecommendations(recommendations, candidates) {
  if (!recommendations || recommendations.length === 0) {
    return `<p class="empty">Noch keine Empfehlungen vorhanden.</p>`;
  }
  return recommendations.map((rec) => {
    const [repoRef, ...actionParts] = rec.split(": ");
    const localizedWhole = localizeGeneratedText(rec);
    const action = localizeGeneratedText(actionParts.join(": ") || "Manuell pruefen.");
    const slug = slugifyForId(repoRef);

    const candidate = (candidates || []).find((c) => getCandidateName(c) === repoRef);
    const disposition = getCandidateDisposition(candidate);
    const badge = candidate ? (DISPOSITION_TO_BADGE[disposition] ?? { tone: "observe", label: "Beobachten" }) : null;
    const displayName = candidate ? repoRef : "Laufhinweis";
    const displayAction = truncateText(candidate ? action : localizedWhole, 140);
    const rawScore = candidate ? (getCandidateNetScore(candidate) || getCandidateFitScore(candidate)) : null;
    const score = rawScore != null && rawScore !== 0 ? rawScore : "";

    const badgeFragment = badge
      ? `<button type="button" class="badge ${badge.tone} badge--clickable"${buildBadgeExplainAttrs(badge.tone)}>${escapeHtml(badge.label)}</button>`
      : `<button type="button" class="badge observe badge--clickable"${buildBadgeExplainAttrs("observe")}>Hinweis</button>`;
    const scoreFragment = score !== ""
      ? `<div class="score-cell">
    <div class="score-label">Score</div>
    <div class="score">${escapeHtml(score)}</div>
  </div>`
      : "";

    const nameFragment = candidate
      ? `<a class="name" href="#repo-${escapeHtml(slug)}">${escapeHtml(displayName)}</a>`
      : `<div class="name">${escapeHtml(displayName)}</div>`;

    return `<div class="repo-row">
  <div>
    ${nameFragment}
    <div class="meta">${escapeHtml(displayAction)}</div>
  </div>
  ${badgeFragment}
  ${scoreFragment}
</div>`;
  }).join("\n");
}

export function renderCollapsibleSection(title, body, { tone = "default", sectionId = "", navLabel = "", collapsed = false } = {}) {
  const idAttr = sectionId ? ` id="${escapeHtml(sectionId)}" data-nav-section` : "";
  const accentClass = sectionPreviewAccent(sectionId, tone);
  const openAttr = collapsed ? "" : " open";
  const explainBtn = renderSectionExplainButton(sectionId, title);
  return `<section class="section-preview collapsible ${accentClass}"${idAttr}>
  <details${openAttr} class="section-preview-details">
    <summary class="section-head">
      <div class="title">
        <h2><span class="marker"></span>${escapeHtml(title)}</h2>
      </div>
      <div class="head-actions">${explainBtn}<span class="count-chip">Mehr</span></div>
    </summary>
    <div class="section-body">
      ${body}
    </div>
  </details>
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

  const cards = [
    {
      title: "Regelwerk-Ergebnis",
      copy: `Modus ${localizeGeneratedText(summary.mode ?? "enforce")} hat ${summary.visible ?? summary.allowed ?? 0} von ${summary.evaluated ?? 0} Kandidaten sichtbar gelassen.`,
      items: [
        `Vom Regelwerk markiert: ${summary.blocked ?? 0}`,
        `Erzwungen ausgeblendet: ${summary.enforcedBlocked ?? 0}`,
        `Bevorzugte Treffer: ${summary.preferred ?? 0}`
      ]
    },
    {
      title: "Haeufigste Blocker",
      items: blockerLines,
      emptyText: "Keine Blockergruende vorhanden."
    },
    {
      title: "Geblockte Beispiele",
      items: previewLines,
      emptyText: "Keine geblockten Kandidaten."
    },
    {
      title: "Bevorzugte Treffer",
      items: preferenceLines,
      emptyText: "Keine bevorzugten Treffer."
    }
  ];
  return renderInfoGridInline(cards);
}

function renderInfoGridInline(cards) {
  return `<div class="info-grid">
${cards.map((card) => `<div class="info-card">
  <div class="info-card-title">${escapeHtml(card.title)}</div>
  ${card.copy ? `<p class="info-card-copy">${escapeHtml(card.copy)}</p>` : ""}
  ${Array.isArray(card.items) && card.items.length > 0
    ? `<ul class="info-card-list">${card.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : (card.emptyText ? `<p class="info-card-empty">${escapeHtml(card.emptyText)}</p>` : "")}
</div>`).join("\n")}
</div>`;
}

export function renderPolicyCalibrationCard(discovery) {
  const calibration = discovery?.policyCalibration ?? null;
  if (!calibration) {
    return `<p class="empty">Keine Kalibrierungshinweise vorhanden.</p>`;
  }

  const blockerLines = (calibration.topBlockers ?? []).slice(0, 6).map((item) => `${item.value}: ${item.count}`);
  const hintLines = (calibration.recommendations ?? []).slice(0, 6);

  return renderInfoGridInline([
    {
      title: "Kalibrierungsstatus",
      copy: (calibration.status ?? "unbekannt").replaceAll("unknown", "unbekannt")
    },
    {
      title: "Staerkste Blockersignale",
      items: blockerLines,
      emptyText: "Keine Blockermuster erfasst."
    },
    {
      title: "Kalibrierungshinweise",
      items: hintLines.map((item) => localizeGeneratedText(item)),
      emptyText: "Keine Kalibrierungshinweise vorhanden."
    }
  ]);
}

const DECISION_BADGE_MAP = {
  intake_now: { tone: "adopt", label: "Uebernehmen" },
  review_queue: { tone: "adapt", label: "Vertiefen" },
  observe_only: { tone: "observe", label: "Beobachten" },
  watch_only: { tone: "observe", label: "Beobachten" }
};

export function renderDecisionSummary({ candidates, reportType, runRoot, discovery, review }) {
  const root = getRunRoot({ reportType, runRoot, discovery, review });
  if (!hasDecisionRunFields(root)) {
    const reportSchemaVersion = root?.reportSchemaVersion ?? "fehlend";
    return `<section class="section-preview accent-orange" id="decision-summary" data-nav-section>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Entscheidungsuebersicht</h2>
      <div class="sub">Engine-Daten unvollstaendig</div>
    </div>
  </div>
  <p class="empty">Engine-Daten unvollstaendig (reportSchemaVersion: ${escapeHtml(reportSchemaVersion)}) — dieser Run wurde vor der Engine-Upgrade-Integration erzeugt oder ist unvollstaendig. Lauf erneut ausfuehren, um aktuelle Bewertungen zu sehen.</p>
</section>`;
  }

  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  const top = safeCandidates[0] ?? null;
  const topName = getCandidateName(top);
  const topDisposition = getCandidateDisposition(top);
  const topBadge = top ? (DECISION_BADGE_MAP[topDisposition] ?? { tone: "observe", label: "Beobachten" }) : { tone: "observe", label: "Unbekannt" };
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
  const runConfidenceReason = truncateText(localizeGeneratedText(root.runConfidenceReason), 200);
  const stateSummary = root.itemsDataStateSummary ?? { complete: 0, fallback: 0, stale: 0 };
  const warnBanner = renderDataStateWarnBanner(stateSummary);

  const calloutMeta = `Wert ${topValueScore ?? "-"} · Aufwand ${topEffortScore ?? "-"} · Passung ${localizeFitBand(topFitBand)}`;
  const calloutRow = `<div class="repo-row">
  <div>
    <div class="name">${escapeHtml(topName)}</div>
    <div class="meta">${escapeHtml(truncateText(topDecision, 220))} · ${escapeHtml(calloutMeta)}</div>
  </div>
  <button type="button" class="badge ${topBadge.tone} badge--clickable"${buildBadgeExplainAttrs(topBadge.tone)}>${escapeHtml(topBadge.label)}</button>
</div>`;

  const factCards = [
    {
      title: "Vertrauen in den Lauf",
      copy: localizeFitBand(runConfidence),
      items: runConfidenceReason ? [runConfidenceReason] : []
    },
    {
      title: "Staerkstes Lueckensignal",
      copy: localizeSystemTerm(topGap),
      items: [localizeGeneratedText(topGapHint)]
    },
    {
      title: "Umfang des Reports",
      copy: `${safeCandidates.length} Kandidaten analysiert`,
      items: []
    }
  ];
  const factsGrid = `<div class="info-grid">
${factCards.map((card) => `<div class="info-card">
  <div class="info-card-title">${escapeHtml(card.title)}</div>
  <p class="info-card-copy">${escapeHtml(card.copy)}</p>
  ${card.items.length > 0 ? `<ul class="info-card-list">${card.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
</div>`).join("\n")}
</div>`;

  const decisionExplainBtn = renderSectionExplainButton("decision-summary", "Entscheidungsuebersicht");
  return `<section class="section-preview accent-orange" id="decision-summary" data-nav-section>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Entscheidungsuebersicht</h2>
      <div class="sub">Empfohlene Bewegung für diesen Lauf</div>
    </div>
    ${decisionExplainBtn ? `<div class="head-actions">${decisionExplainBtn}</div>` : ""}
  </div>
  ${warnBanner}
  <div class="section-body">
    ${calloutRow}
  </div>
  ${factsGrid}
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
    { key: "adopt", label: "Uebernehmen", tone: "adopt", items: groups.adopt },
    { key: "study", label: "Vertiefen", tone: "adapt", items: groups.study },
    { key: "watch", label: "Beobachten", tone: "observe", items: groups.watch },
    { key: "defer", label: "Zurueckstellen", tone: "observe", items: groups.defer }
  ].filter((g) => g.items.length > 0);

  if (configs.length === 0) return "";

  const totalItems = configs.reduce((sum, g) => sum + g.items.length, 0);

  const renderGroup = (g) => {
    const rows = g.items.map((item, idx) => {
      const slug = slugifyForId(item.name);
      const prefix = g.key === "adopt" ? `${String(idx + 1).padStart(2, "0")}. ` : "";
      return `<div class="repo-row">
  <div>
    <a class="name" href="#repo-${escapeHtml(slug)}">${escapeHtml(prefix)}${escapeHtml(item.name)}</a>
    <div class="meta">${escapeHtml(item.reason || "-")}</div>
  </div>
  <button type="button" class="badge ${g.tone} badge--clickable"${buildBadgeExplainAttrs(g.tone)}>${escapeHtml(g.label)}</button>
</div>`;
    }).join("\n");
    return `<div class="coverage-axis-group">
  <div class="group-head"><h3>${escapeHtml(g.label)} · ${g.items.length}</h3></div>
  ${rows}
</div>`;
  };

  const actionsExplainBtn = renderSectionExplainButton("recommended-actions", "Empfohlene Aktionen");
  return `<section class="section-preview accent-green" id="recommended-actions" data-nav-section>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Empfohlene Aktionen</h2>
      <div class="sub">Nach Disposition gruppiert</div>
    </div>
    <div class="head-actions">${actionsExplainBtn}<span class="count-chip">${totalItems} Kandidaten</span></div>
  </div>
  <div class="section-body">
    ${configs.map(renderGroup).join("\n")}
  </div>
</section>`;
}
