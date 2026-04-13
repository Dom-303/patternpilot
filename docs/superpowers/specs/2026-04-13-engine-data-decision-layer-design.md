# Engine Data for Decision Layer — Design Spec

- date: 2026-04-13
- author: brainstorming session (patternpilot)
- status: approved for writing-plans
- related: [docs/foundation/ENGINE_BACKLOG.md](../../foundation/ENGINE_BACKLOG.md), [OPEN_QUESTION.md](../../../OPEN_QUESTION.md)

## Zweck

Patternpilot's Report-Schicht ist seit Phase A/B/C ein decision-first Tool. Die Bewertungs-Aussagen im Report (Confidence-Badge, Top-3-Adopt-Ranking, Recommended-Actions-Buckets) rechnet heute das Template selbst — heuristisch, nachträglich, mit dem `(heuristic)`-Label als Entschuldigung.

Diese Spec verschiebt die Verantwortung dorthin, wo sie hingehoert: **in die Engine**. Ziel ist Klarheit fuer den Nutzer, keine neue Datentiefe.

## Scope

**In Scope:**
- **EB-001** — `reviewDisposition` fuer Watchlist-Review-Items, semantisch parallel zu `discoveryDisposition` fuer Discovery-Funde
- **EB-002** — `runConfidence` und `runConfidenceReason` als Run-Level-Meta-Aussage, strukturiert aus echten Run-Signalen
- **EB-003** — `effortBand` und `valueBand` pro Kandidat, als zwei neue Bewertungs-Achsen *relativ zum Zielprojekt* (hier: EventBaer)

**Out of Scope (bewusst):**
- **EB-004** — `runGapSignals` gegen echte Projekt-Luecken-Matrix. Braucht tiefere `projectProfile.capabilitiesPresent`-Basis, die heute nicht zuverlaessig genug ist. Separate Spec.
- **EB-005** — Neuer `evaluatedCandidate`-Wrapper-Typ. Wird passiv absorbiert (flache Feld-Additionen auf bestehenden Shapes, kein neuer Typ).
- **LLM-Einsatz** jeder Art. Spec bleibt rein heuristisch und reproduzierbar. OQ-005 haelt LLM-Einsatz explizit zurueck, bis die heuristische Basis stabil ist — diese Spec ist Teil dieser Basis.

## Erfolgs-Kriterien

Der Nutzer merkt nach Umsetzung im Report:
1. Das `(heuristic)`-Label am Confidence-Badge ist weg. Stattdessen steht dort eine kuratierte Aussage aus der Engine mit strukturierter Begruendung.
2. Die Top-3-Adopt-Liste ist echt priorisiert nach Wert minus Aufwand, nicht nach Array-Reihenfolge. Der `.ranked`-CSS-Hervorheber hat endlich Bedeutung.
3. Review-Reports und Discovery-Reports verhalten sich symmetrisch. Keine parallelen Logik-Zweige mehr im Template.
4. Bei den Top-Adopt-Empfehlungen ist sichtbar, welche Lizenz das Repo hat — speziell wenn Copyleft oder unbekannt.
5. Der Dossier-Eintrag pro Kandidat zeigt zusaetzlich zu `fit_band` auch `effort`, `value` und `review_disposition` — drei Zeilen mehr, nicht mehr.

Der Entwickler merkt:
1. `lib/html-renderer.mjs` hat keine Heuristik-Rechnungen mehr. Weniger Code, klarere Verantwortung.
2. Die Engine ist deterministisch. Gleicher Input = gleicher Output.
3. Kein neuer Datenwrapper, keine neue Pipeline-Stufe, kein Migrations-Skript.
4. Pruefbare Deterministik: jede Bewertung traegt einen `rules_fingerprint`, und pro Kandidat liegen im Dossier strukturierte `decision_reason_codes` — wenn ein Ranking unintuitiv wird, ist die Antwort nicht "heuristisch", sondern ein Blick ins Dossier.
5. Explizite Schema-Version im Report-Payload. Alte Runs erzeugen einen klaren Missing-Data-Error, nicht stilles Null-Rauschen.

## Architektur-Prinzipien

1. **Flat additions, no wrapper.** Neue Felder leben direkt auf bestehenden Shapes (Discovery-Kandidat, Review-Item, Queue-Row). Kein neuer Typ.
2. **Bands sind authoritative, Scores sind Helfer.** Das Template liest `effortBand` und `valueBand`. Die numerischen Scores sind nur fuer (a) Sortierung innerhalb Adopt-Bucket als Tiebreaker und (b) optional spaeteres `--explain`-Flag.
3. **Persistierte Kandidaten-Felder, ephemere Run-Felder.** `effort_*`, `value_*`, `review_disposition` landen in `state/repo_intake_queue.csv` (persistent, berechnet beim Intake). `runConfidence` existiert nur im Run-Output (berechnet bei jedem Run).
4. **Hard cutover.** Das Template behaelt keine Heuristik-Fallbacks. Fehlt ein Engine-Feld, zeigt das Template eine explizite Fehlermeldung "Engine-Daten unvollstaendig — Lauf erneut ausfuehren". Kein stiller Dual-Pfad.
5. **Keine Alignment-Rules-Pflege-Explosion.** `effort_bias` lebt nur auf `layerMappings`, `value_bias` lebt nur auf `gapMappings`. Semantisch sauber, halbiert die Kurations-Arbeit.
6. **Eine gemeinsame Disposition-Funktion fuer Discovery und Review.** Discovery und Review berechnen ihre Disposition durch *dieselbe* `deriveDisposition`-Funktion mit derselben 3x3-Matrix und denselben Overrides. Field-Namen auf den In-Memory-Objekten bleiben unterschiedlich (`discoveryDisposition` / `reviewDisposition`) fuer API-Klarheit, aber die Berechnung ist eine. Das ist der eigentliche EB-001-Schliesspunkt.
7. **Nachvollziehbarkeit ohne neues Subsystem.** Jede persistierte Bewertung traegt einen `rules_fingerprint`, damit ein Queue-Eintrag gegen eine bestimmte Regel-Version identifizierbar ist. Pro Kandidat landet im *Dossier* — nicht in der Queue-CSV — ein minimaler `decision_reason_codes`-Block (z.B. `["layer_bias:+8", "matched_capabilities:+16", "matrix:effort_low_value_high"]`). Kein Explain-System, kein Flag-Zoo: nur die Rohdaten, die eine spaetere Diskussion kurz halten.
8. **Unknown ist kein stiller Mittelwert.** `unknown` wird konsequent als "zu wenig Information fuer ein Adopt-Signal" behandelt. Es blockiert `intake_now` immer, cappt `runConfidence` bei genug Haeufung, und wird im Dossier sichtbar als Unsicherheit ausgewiesen.

## Beruehrte Dateien

| Datei | Rolle | Aenderung |
|---|---|---|
| `lib/classification.mjs` | Heuristik-Engine | Neue Exports: `buildCandidateEvaluation`, `deriveDisposition`, `buildRunConfidence` |
| `lib/intake.mjs` | Per-Kandidat-Pipeline | Ruft `buildCandidateEvaluation` nach `buildProjectAlignment`, merged Resultate in Kandidat, persistiert in Queue + Dossier |
| `lib/discovery.mjs` | Run-Pipeline | Per-Kandidat `buildCandidateEvaluation` + `deriveDisposition`, per-Run `buildRunConfidence`. Alte `buildDiscoveryDisposition`-Heuristik ersetzt. |
| `lib/review.mjs` | Run-Pipeline | Liest neue Felder aus Queue-Rows, ruft `deriveDisposition` als Fallback, `buildRunConfidence` pro Run |
| `lib/queue.mjs` | Queue-Schema | 6 neue Spalten im Header + Row-Writer + Row-Parser |
| `projects/eventbear-worker/ALIGNMENT_RULES.json` | Regelwerk | `effort_bias` pro `layerMappings`-Eintrag, `value_bias` pro `gapMappings`-Eintrag |
| `lib/html-renderer.mjs` | Template | Cutover: Heuristik-Pfade loeschen, Engine-Felder lesen, Adopt-Sortierung, Lizenz-Tags in Top-3-Adopt, Missing-Data-Fehler |

## Datenmodell

### Per Kandidat (persistent in Queue)

```js
{
  // bestehend, unveraendert
  projectFitBand: "high" | "medium" | "low" | "unknown",
  projectFitScore: 0..100,
  matchedCapabilities: string[],

  // NEU — Bewertungs-Felder
  effortBand: "low" | "medium" | "high" | "unknown",
  effortScore: 0..100,                                  // niedrig = billig zu adoptieren
  valueBand: "low" | "medium" | "high" | "unknown",
  valueScore: 0..100,                                   // hoch = EventBaer gewinnt viel
  reviewDisposition:                                    // fuer Review-Items; Discovery nutzt discoveryDisposition
    "intake_now" | "review_queue" | "observe_only" | "skip",

  // NEU — Provenance-Feld
  rulesFingerprint: string                              // SHA-1 der relevanten ALIGNMENT_RULES-Section, 12-stellig
}
```

### Per Kandidat (ephemer, nur Dossier)

```js
{
  // Wird waehrend buildCandidateEvaluation berechnet, landet im Intake-Dossier
  // als strukturierte Zeilen, aber NICHT in der Queue-CSV (zu breit).
  effortReasons: string[],         // z.B. ["layer_bias:+8", "language_match:-8", "size_penalty:+5"]
  valueReasons: string[],          // z.B. ["gap_bias:+22", "matched_capabilities:+16"]
  dispositionReason: string,       // z.B. "matrix:effort_low_value_high" oder "override:archived_cap"
  decisionSummary: string          // eine Zeile natuerlichsprachlich, z.B. "High value, medium effort, review before adoption"
}
```

### Per Run (ephemer, im Report-Payload)

```js
{
  reportSchemaVersion: 2,         // 1 = alt (pre-engine-decision), 2 = aktuell
  runConfidence: "high" | "medium" | "low",
  runConfidenceReason: string,    // strukturierter Vorlagen-Text, kein LLM
  confidenceFactors: {            // rohe Zahlen, die in runConfidence einflossen — fuer Tests und Snapshots
    candidateCount: number,
    highFitCount: number,
    unknownFitCount: number,
    riskyCount: number,           // Kandidaten mit archived_repo oder source_lock_in in risks
    capabilityDiversity: number   // 0..1
  }
}
```

`reportSchemaVersion` ist die explizite Umschaltung fuer den Template-Cutover. Das Template prueft diese Version, statt nullable Engine-Felder abzufragen. Ein alter Report-Payload aus einem Run vor der Umsetzung hat `reportSchemaVersion: 1` oder fehlend — beides loest den Missing-Data-Error aus.

### Queue-CSV Schema-Erweiterung

6 neue Spalten direkt nach `project_fit_score`:

```
...;project_fit_band;project_fit_score;effort_band;effort_score;value_band;value_score;review_disposition;rules_fingerprint;matched_capabilities;...
```

`rules_fingerprint` ist bewusst in der Queue persistiert, nicht in der Decision-Signals-Section im Dossier — weil *nur die Queue* der persistente Truth-Layer ist. Das Dossier ist ein Snapshot. Mit dem Fingerprint in der Row kann man spaeter sagen: "diese Row wurde gegen Regelstand X bewertet, die jetzigen Regeln sind Y, deswegen sollte sie neu bewertet werden".

Die `decision_reason_codes`-Felder (`effort_reasons`, `value_reasons`, `disposition_reason`, `decision_summary`) landen *nicht* in der Queue-CSV, nur im Intake-Dossier-Markdown. Das haelt die CSV schmal, ohne Debug-Information zu verlieren.

### Dossier-Erweiterung

Neuer Block `## Decision Signals`, direkt nach dem bestehenden `## Project Alignment`:

```markdown
## Decision Signals

- effort: medium
- value: high
- review_disposition: review_queue
- summary: High value, medium effort, review before adoption
- rules_fingerprint: a3f9c1b2d4e5

### Reasons

- effort: layer_bias:+8, language_match:-8, size_penalty:+5
- value: gap_bias:+22, matched_capabilities:+16, build_vs_borrow:+10
- disposition: matrix:effort_medium_value_high
```

**Warum so kurz:** Die Reason-Codes sind strukturierte Token, keine Erklaerungssaetze. Ein Mensch liest sie schnell, ein Unit-Test kann sie direkt asserten, und ein spaeteres `--explain`-Flag koennte sie in einen laengeren Text umformen. Aber heute reicht das als Debug-Fenster.

## Scoring-Formeln

### `effortScore` (0..100, niedrig = billig zu adoptieren)

```
start = 50   (neutral: "keine Information" → mittlerer Aufwand)

+ layer_effort_bias        (aus ALIGNMENT_RULES.layerMappings[mainLayer], Bereich ca. -20..+20)

Per-Repo Signale:
+ size_penalty:
    repo.size > 10000 KB      → +15
    1000 < repo.size ≤ 10000  → +5
    repo.size ≤ 1000          → -5

+ language_match:
    primaryLanguage in {JavaScript, TypeScript}       → -8
    primaryLanguage in {Python, Go, Ruby}             → +5
    primaryLanguage in {Rust, C++, Elixir, Haskell}   → +12

+ activity_penalty:
    activityStatus === "stale"    → +8
    activityStatus === "archived" → +12

+ license_adjustment:
    permissive (MIT, Apache-2.0, BSD-*, ISC, Unlicense)   → -3
    copyleft   (GPL-*, AGPL-*, LGPL-*)                    → +8
    unknown    (kein License-Feld)                        → +4

clamp 0..100

effortBand:
    0-35   → low
    36-65  → medium
    66-100 → high
```

### `valueScore` (0..100, hoch = EventBaer gewinnt viel)

```
start = 8   (pessimistisch: "keine Information" → niedriger Wert)

+ gap_value_bias           (aus ALIGNMENT_RULES.gapMappings[gapArea], Bereich ca. 0..+25)
+ matchedCapabilities.length * 8

+ buildVsBorrow_bonus:
    "adapt_pattern"    → +10
    "borrow_optional"  → +5

+ priority_bonus:
    "now"  → +8

- tension_penalty:
    tensions.length > 0   → -6

- archive_value_drop:
    repo.archived  → -15   (Wert ist nur Pattern-Signal, nicht Adoption)

clamp 0..100

valueBand:
    0-35   → low
    36-65  → medium
    66-100 → high
```

### Disposition — 3x3 Matrix + 4 Overrides (shared by Discovery and Review)

**Hauptentscheidung (3x3 Matrix, Effort-Band × Value-Band):**

|                   | Value: low     | Value: medium   | Value: high    |
|-------------------|----------------|-----------------|----------------|
| **Effort: low**   | observe_only   | review_queue    | **intake_now** |
| **Effort: medium**| skip           | observe_only    | review_queue   |
| **Effort: high**  | skip           | observe_only    | review_queue   |

**Prinzip:** `intake_now` ist das seltenste Signal — nur wenn gleichzeitig billiger Adoption-Pfad *und* hoher EventBaer-Gewinn. Alles andere braucht mindestens einen Review-Schritt. `skip` gibt es nur bei klarem Ressourcen-Verbrauch ohne proportionalen Gewinn.

**Overrides (werden in dieser Reihenfolge vor der Matrix geprueft):**

1. `risks.includes("archived_repo")` → cap bei `observe_only`
2. `risks.includes("source_lock_in")` und `valueBand !== "high"` → `observe_only`
3. `projectFitBand === "unknown"` → `observe_only` (kein sicheres Signal, auf keinen Fall intake_now)
4. `effortBand === "unknown" || valueBand === "unknown"` → cap bei `review_queue` (Unsicherheit blockiert den Adopt-Pfad, ohne den Eintrag gleich auf observe_only zu schieben)

Wenn keine Override greift, entscheidet die Matrix.

Keine Override fuer exotische Sprachen mehr — die sind durch das `language_match`-Penalty im `effortScore` bereits erfasst und landen automatisch in `effort: high`, wo die Matrix den `intake_now`-Pfad sperrt.

`dispositionReason` wird in jedem Fall gesetzt, auch bei Matrix-Durchlauf, damit das Dossier immer angeben kann, *warum* die Disposition rauskam:
- Matrix-Pfad: `"matrix:effort_low_value_high"` (oder welche Zelle auch immer)
- Override-Pfad: `"override:archived_cap"`, `"override:source_lock_in_cap"`, `"override:unknown_fit"`, `"override:unknown_band"`

### `runConfidence` — Meta-Aussage pro Run

**Phase 1 — Rohsignale berechnen:**

```
n               = candidates.length
highFitCount    = candidates.filter(c => c.projectFitBand === "high").length
unknownFitCount = candidates.filter(c => c.projectFitBand === "unknown").length
riskyCount      = candidates.filter(c => c.risks?.some(r =>
                    r === "archived_repo" || r === "source_lock_in")).length
capabilityDiversity = uniqueMatchedCapabilities.size / totalCapabilitiesInRules
```

**Phase 2 — Base-Entscheidung (wie bisher):**

```
if n < 3:
    base = "low"
    reason = `Only ${n} candidate(s) evaluated — too few to draw a pattern`

else if highFitCount >= 3 AND capabilityDiversity >= 0.4:
    base = "high"
    reason = `${highFitCount} high-fit candidates across ${uniqueCapabilityCount} capabilities`

else if highFitCount >= 2 OR capabilityDiversity >= 0.25:
    base = "medium"
    reason = `${highFitCount} high-fit candidates, capability diversity ${(capabilityDiversity * 100).toFixed(0)}%`

else:
    base = "low"
    reason = `${highFitCount} high-fit in ${n} total — signals are thin`
```

**Phase 3 — Reality-Guards (Caps auf die Base-Entscheidung):**

```
if unknownFitCount / n > 0.3:
    base = min(base, "medium")
    reason += ` — capped: ${unknownFitCount}/${n} candidates unknown fit`

if riskyCount / n > 0.4:
    base = min(base, "medium")
    reason += ` — capped: ${riskyCount}/${n} candidates risk-flagged`

runConfidence = base
runConfidenceReason = reason
```

Wobei `min("high", "medium") = "medium"`, `min("medium", "low") = "low"` etc. — Caps koennen also nur runter, nie hoch.

**Wichtig:** `runConfidenceReason` ist vorlagen-basiert, kein freier Text. Die Engine setzt nur Zahlen in feste Satzschablonen ein. So bleibt die Ausgabe reproduzierbar und ist kein verstecktes LLM-Einfallstor.

**Neben der Textausgabe** liefert die Engine die rohen `confidenceFactors` (siehe Datenmodell). Die sind primaer fuer Tests und Snapshots — das Template braucht sie nicht, kann sie aber optional in einem Debug-Tooltip zeigen. YAGNI fuer jetzt, aber die Daten liegen bereit.

## Alignment-Rules-Erweiterung

### Layer Mappings — `effort_bias` hinzufuegen

Jeder Eintrag in `layerMappings` bekommt ein `effort_bias`-Feld. Positive Werte = teurer zu adoptieren, negative Werte = billiger zu adoptieren.

**Kalibrierungs-Leitlinie fuer EventBaer:**

| Layer | Ungefaehrer `effort_bias` | Begruendung |
|---|---|---|
| `source_intake` | `-5` | Gut eingegrenzte Schicht, meist klar isolierbar |
| `access_fetch` | `+8` | Browser-/Fallback-Logik, oft tief verdrahtet |
| `parsing_extraction` | `0` | Neutral, stark variierend |
| `export_feed_api` | `-3` | Gut kapselbar, klare Interfaces |
| `distribution_plugin` | `+15` | Plattform-Abhaengigkeiten, oft Wordpress/CMS-Kopplung |
| `ui_discovery_surface` | `+12` | Frontend-Integration, weit weg vom Worker-Kern |
| `location_place_enrichment` | `+3` | Mittlere Integration |

Werte sind Start-Kalibrierung. Sie sollen nachjustierbar sein, ohne Code zu aendern.

### Gap Mappings — `value_bias` hinzufuegen

Jeder Eintrag in `gapMappings` bekommt ein `value_bias`-Feld. Positive Werte = EventBaer gewinnt mehr durch Abdeckung dieser Luecke.

**Kalibrierungs-Leitlinie fuer EventBaer:**

| Gap | Ungefaehrer `value_bias` | Begruendung |
|---|---|---|
| `source_systems_and_families` | `+22` | Kern-Hebel, direkte Worker-Staerkung |
| `connector_families` | `+18` | Zweiter Kern-Hebel |
| `adapter_handoff_contracts` | `+15` | Starker Hebel fuer Worker-Evolution |
| `location_and_gastro_intelligence` | `+14` | Wichtige Ergaenzungsschicht |
| `secondary_enrichment_layers` | `+10` | Optional, aber wertvoll |
| `vertical_depth_connectors` | `+10` | Nischen-Hebel |
| `distribution_surfaces` | `+8` | Ausserhalb Worker-Kern, aber relevant |
| `wordpress_plugin_distribution` | `+6` | Ausserhalb Worker-Kern |
| `frontend_and_surface_design` | `+4` | Weit weg vom Kern |
| `risk_and_dependency_awareness` | `+2` | Eher als Warn-Signal wertvoll |

Auch diese Werte sind Start-Kalibrierung.

## Integration pro Datei

### `lib/classification.mjs`

Neue Export-Funktionen, alle rein funktional, keine Seiteneffekte:

```js
export function buildCandidateEvaluation(repo, guess, enrichment, projectAlignment, alignmentRules) {
  // Berechnet Bewertung + Reasons + Summary.
  // Returns: {
  //   effortScore, effortBand,
  //   valueScore, valueBand,
  //   effortReasons: string[],       // ephemere Debug-Codes, wandern ins Dossier
  //   valueReasons: string[],
  //   decisionSummary: string        // eine Zeile fuer das Dossier
  // }
}

export function deriveDisposition(evaluation, risks, projectFitBand) {
  // Wendet 3x3-Matrix + 4 Overrides an.
  // Shared by Discovery (via candidate.discoveryDisposition) and Review (via item.reviewDisposition).
  // Returns: {
  //   disposition: "intake_now" | "review_queue" | "observe_only" | "skip",
  //   dispositionReason: string       // z.B. "matrix:effort_low_value_high" oder "override:archived_cap"
  // }
}

export function buildRunConfidence(candidates, totalCapabilitiesInRules) {
  // Berechnet runConfidence + runConfidenceReason + confidenceFactors (Base + Reality-Guards).
  // Returns: {
  //   runConfidence: "high" | "medium" | "low",
  //   runConfidenceReason: string,
  //   confidenceFactors: { candidateCount, highFitCount, unknownFitCount, riskyCount, capabilityDiversity }
  // }
}

export function computeRulesFingerprint(alignmentRules) {
  // Stabile 12-Zeichen-Kurz-Hash der bewertungsrelevanten Teile:
  // layerMappings, gapMappings, capabilities, patternTensions.
  // NICHT ueber Meta-Felder wie "updated_at" oder Kommentare.
  // Returns: string (z.B. "a3f9c1b2d4e5")
}

export function classifyLicense(licenseString) {
  // Gemeinsame Helper-Funktion fuer Engine (effortScore license_adjustment)
  // und Template (license-Tag im Top-3-Adopt).
  // Returns: "permissive" | "copyleft" | "unknown"
}
```

Bestehende `buildProjectAlignment` bleibt unveraendert. `fitBand`-Hilfsfunktion bleibt unveraendert (wir koennen sie fuer effort/value wiederverwenden).

**Warum `classifyLicense` in der Engine und nicht im Template:** Sonst gaebe es zwei unabhaengige Klassifikationen (Engine bewertet, Template zeigt) — wenn man eines aendert, driften beide auseinander. Eine Funktion, zwei Aufrufstellen.

### `lib/intake.mjs`

Nach dem bestehenden `buildProjectAlignment`-Aufruf:

```js
const projectAlignment = buildProjectAlignment(...);
const evaluation = buildCandidateEvaluation(repo, guess, enrichment, projectAlignment, alignmentRules);
const { disposition, dispositionReason } = deriveDisposition(
  evaluation,
  risks,
  projectAlignment.fitBand
);
const rulesFingerprint = computeRulesFingerprint(alignmentRules);

// Merge in candidate object:
Object.assign(candidate, {
  effortBand: evaluation.effortBand,
  effortScore: evaluation.effortScore,
  valueBand: evaluation.valueBand,
  valueScore: evaluation.valueScore,
  reviewDisposition: disposition,
  rulesFingerprint
});

// Persistiert in Queue-Row: effort_band, effort_score, value_band, value_score,
//                           review_disposition, rules_fingerprint
// (6 neue Felder — reasons gehen NICHT in die Queue)

// Schreibt in Intake-Dossier:
// - ## Decision Signals Block mit bands + summary + fingerprint
// - ### Reasons Sub-Block mit evaluation.effortReasons, .valueReasons, dispositionReason
```

### `lib/discovery.mjs`

Die alte `buildDiscoveryDisposition`-Funktion (die Disposition aus reinem `fitBand` ableitet) wird geloescht. Im bestehenden Discovery-Kandidaten-Loop nach `buildProjectAlignment`:

```js
const evaluation = buildCandidateEvaluation(repo, guess, enrichment, projectAlignment, alignmentRules);
Object.assign(candidate, {
  effortBand: evaluation.effortBand,
  effortScore: evaluation.effortScore,
  valueBand: evaluation.valueBand,
  valueScore: evaluation.valueScore
});
const { disposition, dispositionReason } = deriveDisposition(
  evaluation,
  candidate.risks,
  projectAlignment.fitBand
);
candidate.discoveryDisposition = disposition;
candidate.dispositionReason = dispositionReason;   // ephemer, fuer Run-Report-Payload
```

Discovery und Review teilen sich die `deriveDisposition`-Funktion. Der Field-Name auf dem In-Memory-Kandidaten bleibt `discoveryDisposition`, damit vorhandene Konsumenten (z.B. alte Report-Snapshots oder Downstream-Checks) stabil bleiben — aber die Berechnung ist dieselbe wie in Review.

`rulesFingerprint` wird im Discovery-Run *nicht* gesetzt, weil Discovery den Kandidaten nicht persistiert. Erst wenn der Fund spaeter durch Intake laeuft, bekommt er seinen Fingerprint.

Am Ende des Discovery-Runs, bevor das Report-Payload gebaut wird:

```js
const confidenceResult = buildRunConfidence(candidates, alignmentRules.capabilities.length);
discovery.reportSchemaVersion = 2;
discovery.runConfidence = confidenceResult.runConfidence;
discovery.runConfidenceReason = confidenceResult.runConfidenceReason;
discovery.confidenceFactors = confidenceResult.confidenceFactors;
```

### `lib/review.mjs`

Beim Item-Build aus Queue-Rows zusaetzliche Felder lesen:

```js
const item = {
  // ... bestehende Felder
  effortBand: row.effort_band || "unknown",
  effortScore: Number(row.effort_score || 0),
  valueBand: row.value_band || "unknown",
  valueScore: Number(row.value_score || 0),
  reviewDisposition: row.review_disposition || null,
  rulesFingerprint: row.rules_fingerprint || null
};

if (!item.reviewDisposition) {
  const fallback = deriveDisposition(
    { effortBand: item.effortBand, valueBand: item.valueBand },
    item.risks,
    item.projectFitBand
  );
  item.reviewDisposition = fallback.disposition;
  item.dispositionReason = fallback.dispositionReason;
}
```

`deriveDisposition` wird als Fallback aufgerufen, falls Queue-Row-Feld fehlt (z.B. Row wurde vor Schema-Erweiterung geschrieben). Nach einem erneuten Intake-Lauf ist das Feld persistiert und der Fallback wird nicht mehr gebraucht. Dies ist dieselbe Funktion, die Discovery aufruft — kein zweiter Code-Pfad.

**Staleness-Check (Hinweis, noch nicht enforced):** Nach dem Item-Build kann der Review-Run `computeRulesFingerprint(alignmentRules)` berechnen und mit den `item.rulesFingerprint`-Werten vergleichen. Wenn ein Item einen alten Fingerprint traegt, kann das im Logging vermerkt werden — aber Neubewerten ist fuer diese Spec out-of-scope. Die Info liegt bereit, ein spaeteres `re-evaluate`-Subcommand kann sie nutzen.

Am Ende des Review-Runs:

```js
const confidenceResult = buildRunConfidence(items, alignmentRules.capabilities.length);
review.reportSchemaVersion = 2;
review.runConfidence = confidenceResult.runConfidence;
review.runConfidenceReason = confidenceResult.runConfidenceReason;
review.confidenceFactors = confidenceResult.confidenceFactors;
```

### `lib/queue.mjs`

Queue-Header um 6 Spalten erweitern (`effort_band`, `effort_score`, `value_band`, `value_score`, `review_disposition`, `rules_fingerprint`). Row-Writer und Row-Parser symmetrisch anpassen. Bestehende Eintraege ohne die neuen Spalten werden beim Lesen als leere Strings behandelt und beim naechsten Intake-Lauf ersetzt.

Kein Migrations-Skript noetig: die Queue hat zum Zeitpunkt der Umsetzung 0 aktive Eintraege (`queue_entries: 0` laut STATUS.md). Sollte die Queue bis dahin waschsen, werden Altlasten beim naechsten Intake-Durchlauf des jeweiligen Eintrags upgegraded.

### `projects/eventbear-worker/ALIGNMENT_RULES.json`

Jede `layerMappings`-Zeile bekommt `effort_bias`. Jede `gapMappings`-Zeile bekommt `value_bias`. Werte gemaess Kalibrierungs-Leitlinie oben.

## Template Cutover (`lib/html-renderer.mjs`)

### Was geloescht wird

**In `renderDecisionSummary`:**
- Block `highFitCount` / `ratio` / `confidence` / `confidenceTone` / `confidenceReason` (Zeilen um 231-242 im aktuellen File) — komplett weg
- Parallel-Pfad `if (reportType === "discovery") { ... } else { ... }` fuer `recommendedMove` — kollabiert zu einem gemeinsamen Pfad, weil beide Report-Typen jetzt ein Disposition-Feld liefern

**In `renderRecommendedActions`:**
- Parallel-Pfad `if (reportType === "discovery") { ... } else { fitBand → bucket } ...` — kollabiert zu einem gemeinsamen Pfad, der `disposition = c.discoveryDisposition || c.reviewDisposition` liest

**In `renderDecisionSummary`:**
- Der `gapCounts` / `biggestGap`-Block bleibt fuer jetzt bestehen. Das ist EB-004 und expliziter Out-of-Scope. Der Nutzer sieht dort weiter eine heuristische Aussage, aber die ist deutlich kleiner als die Confidence-Heuristik und wird in einer separaten Spec geloest.

### Was hinzukommt

**Schema-Version-Check am Anfang:**

```js
const runRoot = reportType === "discovery" ? discovery : review;
const hasEngineDecisionFields = runRoot.reportSchemaVersion === 2;
```

Ein einziger Boolean entscheidet, ob Decision Summary und Recommended Actions gerendert werden oder ob der Missing-Data-Error-State erscheint. Kein null-Probing auf Einzelfeldern.

**Run-Confidence aus Engine:**

```js
const runConfidence = runRoot.runConfidence;
const runConfidenceReason = runRoot.runConfidenceReason;
```

Ohne `(heuristic)`-Label. Wenn `hasEngineDecisionFields === false`, erscheint der Missing-Data-Error-State (siehe unten) und dieser Block wird nicht ausgefuehrt.

**Adopt-Sortierung mit stabilen Tiebreakern:**

In `renderRecommendedActions`, nach der Bucket-Zuordnung:

```js
const netScore = (c) => (c.valueScore ?? 0) - (c.effortScore ?? 0);

groups.adopt.sort((a, b) => {
  // Primaer: Value - Effort (hoch gewinnt)
  const netDiff = netScore(b) - netScore(a);
  if (netDiff !== 0) return netDiff;

  // Tiebreaker 1: hoeherer projectFitScore
  const fitDiff = (b.projectFitScore ?? 0) - (a.projectFitScore ?? 0);
  if (fitDiff !== 0) return fitDiff;

  // Tiebreaker 2: mehr matched capabilities
  const capDiff = (b.matchedCapabilities?.length ?? 0) - (a.matchedCapabilities?.length ?? 0);
  if (capDiff !== 0) return capDiff;

  // Tiebreaker 3: alphabetisch (deterministisch, damit Tests nicht flaky werden)
  return (a.full_name ?? "").localeCompare(b.full_name ?? "");
});
// Study, Watch, Defer bleiben in natuerlicher Reihenfolge
```

Nur `adopt` wird sortiert. Die `.ranked`-Klasse auf den ersten 3 Eintraegen bleibt wie heute — sie traegt jetzt echte Bedeutung. Die Tiebreaker-Kette macht die Sortierung deterministisch auch bei numerischer Score-Kollision, sodass Snapshot-Tests nicht flaky werden.

**Lizenz-Tag in Top-3-Adopt:**

Im `action-item`-Template fuer Adopt-Bucket wird zusaetzlich ein `.action-item__license` Span gerendert, wenn `item.license` gesetzt ist:

```html
<a href="..." class="action-item ranked">
  <span class="action-item__rank">1.</span>
  <strong class="action-item__name">owner/name</strong>
  <span class="action-item__license license-permissive">MIT</span>
  <span class="action-item__reason">...</span>
</a>
```

Drei Varianten des License-Tags:
- `license-permissive` (MIT, Apache-2.0, BSD-*, ISC, Unlicense) — grauer Text, dezent
- `license-copyleft` (GPL-*, AGPL-*, LGPL-*) — orange Warn-Styling
- `license-unknown` (kein License-Feld) — grauer Text mit `?` Suffix

Lizenz-Klassifikation kommt aus der gemeinsamen `classifyLicense`-Funktion in `lib/classification.mjs` — dieselbe, die die Engine fuer `effortScore.license_adjustment` verwendet. Das Template importiert sie und ruft sie auf. So gibt es *eine* Wahrheit, was eine Lizenz ist.

Lizenz-Tag erscheint nur in der Adopt-Gruppe, nicht in Study/Watch/Defer. Nicht in Repo-Cards. Nicht in Decision Summary.

**CSS-Erweiterung:**

```css
.action-item__license {
  font-size: 11px;
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.license-permissive { color: var(--ink-muted); background: rgba(255,255,255,0.04); }
.license-copyleft  { color: var(--orange); background: rgba(255,145,0,0.12); }
.license-unknown   { color: var(--ink-muted); background: rgba(255,255,255,0.04); opacity: 0.7; }
```

### Missing-Data-Fehlerfall

Wenn `runRoot.reportSchemaVersion !== 2`, rendert die Decision-Summary-Section einen expliziten Error-State:

```html
<section class="section-card warn" id="decision-summary">
  <header class="section-head"><h2>Decision Summary</h2></header>
  <div class="section-body">
    <p class="empty">Engine-Daten unvollstaendig (reportSchemaVersion: 1 oder fehlend) — dieser Run wurde vor der Engine-Upgrade-Integration erzeugt. Lauf erneut ausfuehren, um aktuelle Bewertungen zu sehen.</p>
  </div>
</section>
```

`renderRecommendedActions` zeigt in diesem Fall nichts an (leerer Ausgabestring), damit der Nutzer nicht auf eine leere Adopt-Liste guckt und Fehlschluesse zieht.

Die anderen Sections rendern weiter (Kandidaten-Grid, Coverage etc.), damit der Report nicht komplett blockiert ist.

**Warum Schema-Version statt Einzelfeld-Check:** Ein alter Payload kann zufaellig ein `runConfidence`-Feld aus einem anderen Kontext haben oder durch Copy-Paste verunreinigt sein. Eine explizite Version sagt: "dieser Payload ist gegen das aktuelle Schema gebaut". Das ist robuster gegen partielle Regressions.

## Testing-Strategie

### Unit-Tests (neu)

`test/classification.test.mjs` — Tests fuer die neuen Funktionen:

- `buildCandidateEvaluation`:
  - Leere `alignmentRules` → alle Bands = `"unknown"`
  - Canonical "source_intake" + "source_systems_and_families" mit JavaScript-Repo → `effort: low`, `value: high`
  - Archived Repo → `value` gedruckt, `effort` erhoeht
  - Permissive License → `effort` leicht gedruckt
  - Copyleft License → `effort` erhoeht (+8)
  - Unknown License → `effort` leicht erhoeht (+4)
  - `effortReasons`-Array enthaelt die erwarteten Token fuer jeden aktiven Summand
  - `valueReasons`-Array enthaelt die erwarteten Token fuer jeden aktiven Summand
  - `decisionSummary` ist ein nicht-leerer String
- `deriveDisposition`:
  - Alle 9 Matrix-Zellen, jeweils einmal
  - Jeder der 4 Overrides isoliert (archived_repo, source_lock_in, unknown fit, unknown band)
  - Override-Reihenfolge (archived_repo vor source_lock_in vor unknown fit vor unknown band)
  - Aufruf von Discovery-Kontext und Review-Kontext liefert bei gleichem Input identisches Ergebnis
  - `dispositionReason` ist bei Matrix-Pfad `"matrix:effort_X_value_Y"`, bei Override-Pfad `"override:*"`
- `buildRunConfidence`:
  - n < 3 → "low"
  - n >= 3 mit 3+ high-fit und 40% diversity → "high"
  - Reality-Guard 1: >30% unknown fit cappt "high" auf "medium"
  - Reality-Guard 2: >40% risky cappt "high" auf "medium"
  - Beide Reality-Guards gleichzeitig aktiv → weiterhin nur auf "medium" gecappt (nicht auf "low")
  - `confidenceFactors` enthaelt alle 5 Rohzahlen
  - Grenzfaelle an den Schwellenwerten (30%, 40%)
- `computeRulesFingerprint`:
  - Deterministisch: zweimal gleicher Input → gleicher Output
  - Sensitiv: layer_bias-Aenderung → anderer Fingerprint
  - Insensitiv: Whitespace- oder Kommentar-Aenderungen aendern den Fingerprint NICHT
  - Laenge 12 Zeichen
- `classifyLicense`:
  - "MIT", "Apache-2.0", "BSD-3-Clause", "ISC" → `"permissive"`
  - "GPL-3.0", "AGPL-3.0", "LGPL-2.1" → `"copyleft"`
  - `null`, `""`, `"NOASSERTION"`, unbekannte Strings → `"unknown"`

### Integration-Tests (erweitern)

`test/discovery.test.mjs` und `test/review.test.mjs`:
- Full Discovery-Run mit Fixture Alignment-Rules, assert: jeder Kandidat hat `effortBand`, `valueBand`, `discoveryDisposition`; Run hat `reportSchemaVersion: 2`, `runConfidence`, `runConfidenceReason`, `confidenceFactors`
- Full Review-Run mit Fixture Queue-Seed, assert: jedes Item hat `reviewDisposition`, `rulesFingerprint`; Run hat `reportSchemaVersion: 2`; das Resultat ist deterministisch ueber mehrere Runs
- Snapshot-Test: Adopt-Sortierung mit bewusst kollidierendem `valueScore - effortScore` ist deterministisch (Tiebreaker greift)
- Fallback-Test: Review-Run mit einer Queue-Row ohne `review_disposition` ruft `deriveDisposition` und liefert ein Ergebnis

### Smoke-Test (manual)

Nach Umsetzung einmalig:
- `npm run discover -- --project eventbear-worker --profile balanced` → HTML-Report oeffnen → visuelle Pruefung: Confidence-Badge ohne Heuristic-Label, Adopt-Ranking sichtbar sinnvoll sortiert, Lizenz-Tags auf Top-3-Adopt (falls Lizenz-Info in Enrichment vorhanden)
- `npm run review -- --project eventbear-worker --profile balanced --depth standard` → dasselbe fuer Review-Report

## Rollout-Reihenfolge (fuer writing-plans)

Sechs Phasen, in dieser Reihenfolge. Jede Phase ist ein eigener Task-Block im Implementierungs-Plan.

1. **Schema & Alignment-Rules** — Queue-CSV-Header um 6 Spalten erweitern (inkl. `rules_fingerprint`), Row-Writer/Parser anpassen, `ALIGNMENT_RULES.json` um `effort_bias`/`value_bias`-Felder erweitern. Foundation, keine Verhaltensaenderung.
2. **Classification-Funktionen** — `buildCandidateEvaluation`, `deriveDisposition`, `buildRunConfidence`, `computeRulesFingerprint`, `classifyLicense` als pure Funktionen mit Unit-Tests. Isoliert testbar, kein Pipeline-Touch.
3. **Intake-Integration** — `intake.mjs` ruft neue Funktionen, persistiert 6 Felder in Queue, schreibt `## Decision Signals`-Block mit Reasons + Summary + Fingerprint in Intake-Dossier. Erste Stelle, an der die Engine-Felder real entstehen.
4. **Pipeline-Integration** — `discovery.mjs` + `review.mjs` lesen/schreiben die Felder, setzen `reportSchemaVersion: 2`, berechnen `runConfidence` + `confidenceFactors` pro Run. Report-Payload enthaelt jetzt die neuen Daten.
5. **Template-Cutover** — `html-renderer.mjs` Heuristik-Pfade loeschen, Schema-Version pruefen, Engine-Felder lesen, Adopt-Sort mit Tiebreakern, Lizenz-Tags via `classifyLicense`, Missing-Data-Error. Das sichtbare Delta fuer den Nutzer.
6. **Smoke-Test & Validation** — End-to-End-Lauf, visuelle Pruefung, Deterministik-Check (zwei Runs, diff leer), Commit.

Reihenfolge ist gewaehlt, damit jeder Task unabhaengig committen kann und das Template-Delta (Phase 5) erst greift, nachdem die Engine tatsaechlich liefert (Phasen 1-4).

## Non-Goals / Offene Risiken

### Nicht-Ziele

- **Keine LLM-Komponente** in dieser Spec. `runConfidenceReason` ist vorlagen-basiert.
- **Kein echtes Gap-Signal** (EB-004). Das Template zaehlt weiter `gapCounts` selbst. Klein und akzeptabel fuer diese Spec.
- **Kein `--explain`-Flag** fuer Formel-Transparenz im Dossier. YAGNI, kann spaeter kommen — die Rohdaten (`effortReasons`, `valueReasons`, `dispositionReason`) liegen aber schon im Dossier bereit.
- **Keine Queue-Migration**. 0 aktive Queue-Eintraege heute; kommende Eintraege kriegen die Felder beim Intake automatisch.
- **Kein automatisches Re-Evaluate** bei veraendertem `rules_fingerprint`. Diese Spec schreibt den Fingerprint nur — sie interpretiert ihn noch nicht. Ein spaeteres Subcommand (z.B. `npm run re-evaluate`) kann ihn nutzen.
- **Kein Decision-Log pro Kandidat** als separate Datei. Die In-Dossier-Reasons *sind* der Log.
- **Keine Multi-Projekt-Kalibrierung**. Die Start-Kalibrierung der Biases ist EventBaer-spezifisch. Andere Projekte liefern ihre eigenen Werte in ihren eigenen `ALIGNMENT_RULES.json`-Files.
- **Kein separates Lizenz-Subsystem.** Lizenz ist ein Effort-Signal plus ein Anzeige-Tag. Eine Funktion, zwei Call-Sites.
- **Keine Decision-Explain-UI** im HTML-Report-Default. Das Template zeigt Bands und Ranking — Reasons bleiben im Dossier.

### Offene Risiken

- **Kalibrierungs-Qualitaet der Biases.** Die Start-Werte in der Kalibrierungs-Leitlinie sind qualifizierte Schaetzungen aus dem bestehenden Alignment-Modell. Sie werden sich im ersten echten Lauf als zu hart oder zu weich zeigen. Risiko: die Top-3-Adopt-Liste im ersten Lauf ist unintuitiv. Mitigation: die Biases sind in der JSON-Datei, nicht im Code — Nachjustierung kostet einen Edit, keinen Deploy. Und `rules_fingerprint` markiert alte Bewertungen automatisch als gegen einen anderen Regelstand berechnet.
- **`runConfidence`-Schwellenwerte.** Die `capabilityDiversity >= 0.4`-Grenze und die Reality-Guard-Grenzen (30% unknown, 40% risky) sind Schaetzwerte. Bei EventBaer gibt es 6 Capabilities, also muessen 2-3 davon matchen fuer `0.4+`. Das ist der richtige Anspruchs-Level fuer `high`, muss aber im ersten Run validiert werden.
- **Lizenz-Information ist nicht immer im Enrichment**. Der GitHub-API-Call fuer Repo-Metadaten liefert `license` nur, wenn GitHub es erkannt hat. Fuer Repos ohne License-Feld rechnet `effortScore` mit `+4` (Unsicherheits-Malus) und das Template zeigt `license-unknown`. Das ist die richtige Aussage, nicht ein Bug.
- **Reason-Code-Drift zwischen Tests und Engine.** Die `effortReasons`/`valueReasons`-Token-Formate werden von Unit-Tests asserted. Wenn die Engine spaeter einen Format-Shift macht (z.B. `layer_bias:+8` → `layer:+8`), muessen Tests mit ziehen. Das ist der Preis fuer pruefbare Deterministik — akzeptabel, solange die Format-Entscheidung dokumentiert ist.

## Verhaeltnis zu ENGINE_BACKLOG.md

Diese Spec schliesst:
- **EB-001 vollstaendig** (reviewDisposition persistent und deterministisch)
- **EB-002 vollstaendig** (runConfidence + runConfidenceReason aus Engine)
- **EB-003 vollstaendig** (effortBand/valueBand als neue Achsen, adoption-relativ)
- **EB-005 passiv** (durch flache Feld-Additionen ohne neuen Wrapper-Typ)

Nach Umsetzung bleibt offen:
- **EB-004** — echtes Gap-Signal gegen Projekt-Luecken-Matrix. Eigene Spec, eigene Brainstorming-Session.

ENGINE_BACKLOG.md wird nach Umsetzung entsprechend aktualisiert (EB-001/002/003/005 als erledigt markiert, EB-004 bleibt als offener Punkt).
