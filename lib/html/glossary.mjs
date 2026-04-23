// lib/html/glossary.mjs
//
// Kurz-Definitionen fuer Pattern-Pilot-Fachbegriffe, die im Report
// mehrfach auftauchen. Wird im UI als <abbr> mit data-explain-*
// gerendert: Hover = HTML-Tooltip ueber title-Attribut, Klick =
// Info-Modal mit ausfuehrlicher Erklaerung.
//
// Einsatz: termHtml(begriff, options?) liefert fertiges HTML, das
// den Begriff als kursiv + Dashed-Underline markiert und beim Klick
// das Info-Modal oeffnet.

const GLOSSARY = {
  gaparea: {
    title: "gapArea",
    short: "Luecken-Bereich",
    body: "Ein gapArea (Luecken-Bereich) ist eine Patternpilot-Kategorie fuer Themen, in denen das Zielprojekt noch schwach oder unvollstaendig ist — z.B. dedupe_and_identity, source_discovery, quality_gate. Discovery-Kandidaten werden nach ihrem gapArea-Match bewertet: ein Repo, das genau die aktuelle Luecke adressiert, bekommt einen starken Fit."
  },
  "matched-capabilities": {
    title: "matched-capabilities",
    short: "Passende Faehigkeiten",
    body: "matched-capabilities sind die Zielprojekt-Faehigkeiten, die ein Kandidat nach Alignment-Check trifft. Sie werden aus dem Zielrepo-Kontext abgeleitet (z.B. 'parsing_extraction', 'record_linkage') und dann gegen Topics, README und Struktur des Kandidaten gematcht. Hohe Overlap = hoher Fit."
  },
  disposition: {
    title: "Disposition",
    short: "Einordnung",
    body: "Disposition ist die Handlungs-Empfehlung, die Patternpilot aus Score, Evidenzgrad und Alignment ableitet: intake_now (jetzt aufnehmen), review_queue (vertieft pruefen), observe_only (nur beobachten) oder watch_only (Watchlist). Das entspricht direkt dem Badge auf jeder Repo-Zeile."
  },
  evidenzgrad: {
    title: "Evidenzgrad",
    short: "Qualitaet der Belege",
    body: "Evidenzgrad sagt, wie belastbar Patternpilot einen Kandidaten bewertet: strong (starke Topic/README/Keyword-Treffer), solid (solide Signale) oder light (wenig Signale, weiter pruefen). Ein starker Score mit Evidenzgrad 'light' ist ein Warnzeichen — die Heuristik hat noch zu wenig Datenbasis."
  },
  "query-families": {
    title: "Query-Families",
    short: "Suchbahnen",
    body: "Query-Families sind Gruppen verwandter GitHub-Suchanfragen, die Patternpilot pro Lauf ausfuehrt — z.B. 'record_linkage_libs' oder 'civic_events'. Jeder Kandidat merkt sich, ueber welche Families er gefunden wurde. Mehr Families = breiterer Evidenz-Fundus."
  },
  "fit-band": {
    title: "Fit-Band",
    short: "Passungs-Stufe",
    body: "Fit-Band verdichtet den numerischen Fit-Score in drei Stufen — hoch (>70%), mittel (40-70%), niedrig (<40%). Damit bekommt die Kandidatenliste eine schnell scannbare Triage-Ebene zusaetzlich zum exakten Score."
  },
  watchlist: {
    title: "Watchlist",
    short: "Beobachtungsliste",
    body: "Die Watchlist ist die kuratierte Liste von Ziel-GitHub-URLs, die Patternpilot pro Projekt regelmaessig re-reviewed. Steht in bindings/<project>/WATCHLIST.txt. Discovery-Kandidaten wandern nach Promotion in die Watchlist."
  },
  "run-drift": {
    title: "Run-Drift",
    short: "Lauf-Drift",
    body: "Run-Drift misst, wie stark sich operative Signale von Lauf zu Lauf verschieben: Kandidatenrate, Layer-Verteilung, Regelwerk-Wirkung. Attention_required bedeutet: die letzten Laeufe weichen auffaellig vom Trend ab und sollten manuell geprueft werden."
  },
  governance: {
    title: "Governance",
    short: "Regel- und Freigabe-Schicht",
    body: "Governance buendelt Regeln, Manual-Gates und Automation-Flags, die bestimmen, welche Phasen eines Laufs automatisch und welche nur nach Freigabe laufen duerfen. manual_gate = menschliche Freigabe noetig; auto-Mode = Patternpilot darf allein dispatchen."
  }
};

function normalize(key) {
  return String(key ?? "").toLowerCase().replace(/_/g, "-");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getGlossary(key) {
  return GLOSSARY[normalize(key)] ?? null;
}

// termHtml("gapArea") -> <abbr>-Markup mit Explain-Attributes
export function termHtml(key, options = {}) {
  const entry = getGlossary(key);
  const displayText = options.label ?? (entry?.title ?? key);
  if (!entry) return escapeHtml(displayText);
  return `<abbr class="glossary-term" tabindex="0" role="button" aria-haspopup="dialog" title="${escapeHtml(entry.short)} — klicken fuer Details" data-explain-title="${escapeHtml(entry.title)}" data-explain-body="${escapeHtml(entry.body)}">${escapeHtml(displayText)}</abbr>`;
}

export { GLOSSARY };
