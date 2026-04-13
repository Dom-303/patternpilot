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

## Architektur-Prinzipien

1. **Flat additions, no wrapper.** Neue Felder leben direkt auf bestehenden Shapes (Discovery-Kandidat, Review-Item, Queue-Row). Kein neuer Typ.
2. **Bands sind authoritative, Scores sind Helfer.** Das Template liest `effortBand` und `valueBand`. Die numerischen Scores sind nur fuer (a) Sortierung innerhalb Adopt-Bucket als Tiebreaker und (b) optional spaeteres `--explain`-Flag.
3. **Persistierte Kandidaten-Felder, ephemere Run-Felder.** `effort_*`, `value_*`, `review_disposition` landen in `state/repo_intake_queue.csv` (persistent, berechnet beim Intake). `runConfidence` existiert nur im Run-Output (berechnet bei jedem Run).
4. **Hard cutover.** Das Template behaelt keine Heuristik-Fallbacks. Fehlt ein Engine-Feld, zeigt das Template eine explizite Fehlermeldung "Engine-Daten unvollstaendig — Lauf erneut ausfuehren". Kein stiller Dual-Pfad.
5. **Keine Alignment-Rules-Pflege-Explosion.** `effort_bias` lebt nur auf `layerMappings`, `value_bias` lebt nur auf `gapMappings`. Semantisch sauber, halbiert die Kurations-Arbeit.
6. **Eine gemeinsame Disposition-Funktion fuer Discovery und Review.** Discovery und Review berechnen ihre Disposition durch *dieselbe* `deriveDisposition`-Funktion mit derselben 3x3-Matrix und denselben Overrides. Field-Namen auf den In-Memory-Objekten bleiben unterschiedlich (`discoveryDisposition` / `reviewDisposition`) fuer API-Klarheit, aber die Berechnung ist eine. Das ist der eigentliche EB-001-Schliesspunkt.

## Beruehrte Dateien

| Datei | Rolle | Aenderung |
|---|---|---|
| `lib/classification.mjs` | Heuristik-Engine | Neue Exports: `buildCandidateEvaluation`, `deriveDisposition`, `buildRunConfidence` |
| `lib/intake.mjs` | Per-Kandidat-Pipeline | Ruft `buildCandidateEvaluation` nach `buildProjectAlignment`, merged Resultate in Kandidat, persistiert in Queue + Dossier |
| `lib/discovery.mjs` | Run-Pipeline | Per-Kandidat `buildCandidateEvaluation` + `deriveDisposition`, per-Run `buildRunConfidence`. Alte `buildDiscoveryDisposition`-Heuristik ersetzt. |
| `lib/review.mjs` | Run-Pipeline | Liest neue Felder aus Queue-Rows, ruft `deriveDisposition` als Fallback, `buildRunConfidence` pro Run |
| `lib/queue.mjs` | Queue-Schema | 5 neue Spalten im Header + Row-Writer + Row-Parser |
| `projects/eventbear-worker/ALIGNMENT_RULES.json` | Regelwerk | `effort_bias` pro `layerMappings`-Eintrag, `value_bias` pro `gapMappings`-Eintrag |
| `lib/html-renderer.mjs` | Template | Cutover: Heuristik-Pfade loeschen, Engine-Felder lesen, Adopt-Sortierung, Lizenz-Tags in Top-3-Adopt, Missing-Data-Fehler |

## Datenmodell

### Per Kandidat (persistent)

```js
{
  // bestehend, unveraendert
  projectFitBand: "high" | "medium" | "low" | "unknown",
  projectFitScore: 0..100,
  matchedCapabilities: string[],

  // NEU
  effortBand: "low" | "medium" | "high" | "unknown",
  effortScore: 0..100,                                  // niedrig = billig zu adoptieren
  valueBand: "low" | "medium" | "high" | "unknown",
  valueScore: 0..100,                                   // hoch = EventBaer gewinnt viel
  reviewDisposition:                                    // fuer Review-Items; Discovery nutzt discoveryDisposition wie bisher
    "intake_now" | "review_queue" | "observe_only" | "skip"
}
```

### Per Run (ephemer)

```js
{
  runConfidence: "high" | "medium" | "low",
  runConfidenceReason: string   // strukturierter Vorlagen-Text, kein LLM
}
```

### Queue-CSV Schema-Erweiterung

5 neue Spalten direkt nach `project_fit_score`:

```
...;project_fit_band;project_fit_score;effort_band;effort_score;value_band;value_score;review_disposition;matched_capabilities;...
```

### Dossier-Erweiterung

Neuer Block `## Decision Signals`, direkt nach dem bestehenden `## Project Alignment`:

```markdown
## Decision Signals

- effort: medium
- value: high
- review_disposition: review_queue
```

Drei Zeilen. Keine Formel-Breakdowns im Default-Output.

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

+ license_bonus:
    license in {MIT, Apache-2.0, BSD-*, ISC, Unlicense}  → -3

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

### Disposition — 3x3 Matrix + 3 Overrides (shared by Discovery and Review)

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

Keine Override fuer exotische Sprachen mehr — die sind durch das `language_match`-Penalty im `effortScore` bereits erfasst und landen automatisch in `effort: high`, wo die Matrix den `intake_now`-Pfad sperrt.

### `runConfidence` — Meta-Aussage pro Run

```
n = candidates.length
highFitCount = candidates.filter(c => c.projectFitBand === "high").length
capabilityDiversity = uniqueMatchedCapabilities.size / totalCapabilitiesInRules

Entscheidungsbaum:

if n < 3:
    confidence = "low"
    reason = `Only ${n} candidate(s) evaluated — too few to draw a pattern`

else if highFitCount >= 3 AND capabilityDiversity >= 0.4:
    confidence = "high"
    reason = `${highFitCount} high-fit candidates across ${uniqueCapabilities} capabilities`

else if highFitCount >= 2 OR capabilityDiversity >= 0.25:
    confidence = "medium"
    reason = `${highFitCount} high-fit candidates, capability diversity ${(capabilityDiversity * 100).toFixed(0)}%`

else:
    confidence = "low"
    reason = `${highFitCount} high-fit candidates in ${n} total — signals are thin`
```

**Wichtig:** `runConfidenceReason` ist vorlagen-basiert, kein freier Text. Die Engine setzt nur Zahlen in feste Satzschablonen ein. So bleibt die Ausgabe reproduzierbar und ist kein verstecktes LLM-Einfallstor.

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

Drei neue Export-Funktionen, alle rein funktional, keine Seiteneffekte:

```js
export function buildCandidateEvaluation(repo, guess, enrichment, projectAlignment, alignmentRules) {
  // Berechnet effortScore, effortBand, valueScore, valueBand
  // Returns: { effortScore, effortBand, valueScore, valueBand }
}

export function deriveDisposition(evaluation, risks, projectFitBand) {
  // Wendet 3x3-Matrix + 3 Overrides an
  // Shared by Discovery (via candidate.discoveryDisposition) and Review (via item.reviewDisposition)
  // Returns: "intake_now" | "review_queue" | "observe_only" | "skip"
}

export function buildRunConfidence(candidates, totalCapabilitiesInRules) {
  // Berechnet runConfidence + runConfidenceReason
  // Returns: { runConfidence, runConfidenceReason }
}
```

Bestehende `buildProjectAlignment` bleibt unveraendert. `fitBand`-Hilfsfunktion bleibt unveraendert (wir koennen sie fuer effort/value wiederverwenden).

### `lib/intake.mjs`

Nach dem bestehenden `buildProjectAlignment`-Aufruf:

```js
const projectAlignment = buildProjectAlignment(...);
const evaluation = buildCandidateEvaluation(repo, guess, enrichment, projectAlignment, alignmentRules);
// merge evaluation fields into candidate object
// persist 5 new fields into queue row
// write Decision Signals block into intake dossier markdown
```

### `lib/discovery.mjs`

Die alte `buildDiscoveryDisposition`-Funktion (die Disposition aus reinem `fitBand` ableitet) wird geloescht. Im bestehenden Discovery-Kandidaten-Loop nach `buildProjectAlignment`:

```js
const evaluation = buildCandidateEvaluation(repo, guess, enrichment, projectAlignment, alignmentRules);
Object.assign(candidate, evaluation);   // effortBand, effortScore, valueBand, valueScore
candidate.discoveryDisposition = deriveDisposition(
  evaluation,
  risks,
  projectAlignment.fitBand
);
```

Discovery und Review teilen sich die `deriveDisposition`-Funktion. Der Field-Name auf dem In-Memory-Kandidaten bleibt `discoveryDisposition`, damit vorhandene Konsumenten (z.B. alte Report-Snapshots oder Downstream-Checks) stabil bleiben — aber die Berechnung ist dieselbe wie in Review.

Am Ende des Discovery-Runs, bevor das Report-Payload gebaut wird:

```js
const { runConfidence, runConfidenceReason } = buildRunConfidence(candidates, alignmentRules.capabilities.length);
discovery.runConfidence = runConfidence;
discovery.runConfidenceReason = runConfidenceReason;
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
  reviewDisposition: row.review_disposition || deriveDisposition(
    { effortBand: ..., valueBand: ... },
    item.risks,
    item.projectFitBand
  )
};
```

`deriveDisposition` wird als Fallback aufgerufen, falls Queue-Row-Feld fehlt (z.B. Row wurde vor Schema-Erweiterung geschrieben). Nach einem erneuten Intake-Lauf ist das Feld persistiert und der Fallback wird nicht mehr gebraucht. Dies ist dieselbe Funktion, die Discovery aufruft — kein zweiter Code-Pfad.

Am Ende des Review-Runs:

```js
const { runConfidence, runConfidenceReason } = buildRunConfidence(items, alignmentRules.capabilities.length);
review.runConfidence = runConfidence;
review.runConfidenceReason = runConfidenceReason;
```

### `lib/queue.mjs`

Queue-Header um 5 Spalten erweitern. Row-Writer und Row-Parser symmetrisch anpassen. Bestehende Eintraege ohne die neuen Spalten werden beim Lesen als leere Strings behandelt und beim naechsten Intake-Lauf ersetzt.

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

**Run-Confidence aus Engine:**

```js
const runConfidence = reportType === "discovery"
  ? (discovery.runConfidence ?? null)
  : (review.runConfidence ?? null);
const runConfidenceReason = reportType === "discovery"
  ? (discovery.runConfidenceReason ?? "")
  : (review.runConfidenceReason ?? "");
```

Ohne `(heuristic)`-Label. Falls `runConfidence` `null` ist (alter Run-Output, der vor Umsetzung erzeugt wurde), Fehlermeldung siehe unten.

**Adopt-Sortierung:**

In `renderRecommendedActions`, nach der Bucket-Zuordnung:

```js
groups.adopt.sort((a, b) =>
  (b.valueScore ?? 0) - (b.effortScore ?? 0) - ((a.valueScore ?? 0) - (a.effortScore ?? 0))
);
// Study, Watch, Defer bleiben in natuerlicher Reihenfolge
```

Nur `adopt` wird sortiert. Die `.ranked`-Klasse auf den ersten 3 Eintraegen bleibt wie heute — sie traegt jetzt echte Bedeutung.

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

Lizenz-Klassifikation erfolgt im Template, nicht in der Engine — es ist eine reine Anzeige-Frage. Eine kleine Hilfsfunktion `licenseClass(licenseString)` reicht.

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

Wenn `runConfidence` oder die Kandidaten-Bewertungsfelder fehlen, rendert die Decision-Summary-Section einen expliziten Error-State statt durch `null`-Werte zu rauschen:

```html
<section class="section-card warn" id="decision-summary">
  <header class="section-head"><h2>Decision Summary</h2></header>
  <div class="section-body">
    <p class="empty">Engine-Daten unvollstaendig — dieser Run wurde vor der Engine-Upgrade-Integration erzeugt. Lauf erneut ausfuehren, um aktuelle Bewertungen zu sehen.</p>
  </div>
</section>
```

Die anderen Sections rendern weiter (Kandidaten-Grid, Coverage etc.), damit der Report nicht komplett blockiert ist.

## Testing-Strategie

### Unit-Tests (neu)

`test/classification.test.mjs` — Tests fuer die drei neuen Funktionen:

- `buildCandidateEvaluation`:
  - Leere `alignmentRules` → alle Bands = `"unknown"`
  - Canonical "source_intake" + "source_systems_and_families" mit JavaScript-Repo → `effort: low`, `value: high`
  - Archived Repo → `value` gedruckt, `effort` erhoeht
  - Permissive License → `effort` leicht gedruckt
- `deriveDisposition`:
  - Alle 9 Matrix-Zellen, jeweils einmal
  - Jeder der 3 Overrides isoliert
  - Override-Reihenfolge (archived_repo vor source_lock_in vor unknown fit)
  - Aufruf von Discovery-Kontext und Review-Kontext liefert bei gleichem Input identisches Ergebnis
- `buildRunConfidence`:
  - n < 3 → "low"
  - n >= 3 mit 3+ high-fit und 40% diversity → "high"
  - Grenzfaelle an den Schwellenwerten

### Integration-Tests (erweitern)

`test/discovery.test.mjs` und `test/review.test.mjs`:
- Full Discovery-Run mit Fixture Alignment-Rules, assert: jeder Kandidat hat `effortBand`, `valueBand`; Run hat `runConfidence` + `runConfidenceReason`
- Full Review-Run mit Fixture Queue-Seed, assert: jedes Item hat `reviewDisposition`; Run hat Confidence-Felder; das Resultat ist deterministisch ueber mehrere Runs

### Smoke-Test (manual)

Nach Umsetzung einmalig:
- `npm run discover -- --project eventbear-worker --profile balanced` → HTML-Report oeffnen → visuelle Pruefung: Confidence-Badge ohne Heuristic-Label, Adopt-Ranking sichtbar sinnvoll sortiert, Lizenz-Tags auf Top-3-Adopt (falls Lizenz-Info in Enrichment vorhanden)
- `npm run review -- --project eventbear-worker --profile balanced --depth standard` → dasselbe fuer Review-Report

## Rollout-Reihenfolge (fuer writing-plans)

Sechs Phasen, in dieser Reihenfolge. Jede Phase ist ein eigener Task-Block im Implementierungs-Plan.

1. **Schema & Alignment-Rules** — Queue-CSV-Header um 5 Spalten erweitern, Row-Writer/Parser anpassen, `ALIGNMENT_RULES.json` um `effort_bias`/`value_bias`-Felder erweitern. Foundation, keine Verhaltensaenderung.
2. **Classification-Funktionen** — `buildCandidateEvaluation`, `deriveDisposition`, `buildRunConfidence` als pure Funktionen mit Unit-Tests. Isoliert testbar, kein Pipeline-Touch.
3. **Intake-Integration** — `intake.mjs` ruft neue Funktionen, persistiert in Queue + Dossier. Erste Stelle, an der die Engine-Felder real entstehen.
4. **Pipeline-Integration** — `discovery.mjs` + `review.mjs` lesen/schreiben die Felder und berechnen `runConfidence` pro Run. Report-Payload enthaelt jetzt die neuen Daten.
5. **Template-Cutover** — `html-renderer.mjs` Heuristik-Pfade loeschen, Engine-Felder lesen, Adopt-Sort, Lizenz-Tags, Missing-Data-Error. Das sichtbare Delta fuer den Nutzer.
6. **Smoke-Test & Validation** — End-to-End-Lauf, visuelle Pruefung, Deterministik-Check, Commit.

Reihenfolge ist gewaehlt, damit jeder Task unabhaengig committen kann und das Template-Delta (Phase 5) erst greift, nachdem die Engine tatsaechlich liefert (Phasen 1-4).

## Non-Goals / Offene Risiken

### Nicht-Ziele

- **Keine LLM-Komponente** in dieser Spec. `runConfidenceReason` ist vorlagen-basiert.
- **Kein echtes Gap-Signal** (EB-004). Das Template zaehlt weiter `gapCounts` selbst. Klein und akzeptabel fuer diese Spec.
- **Kein `--explain`-Flag** fuer Formel-Transparenz im Dossier. YAGNI, kann spaeter kommen.
- **Keine Queue-Migration**. 0 aktive Queue-Eintraege heute; kommende Eintraege kriegen die Felder beim Intake automatisch.
- **Keine Multi-Projekt-Kalibrierung**. Die Start-Kalibrierung der Biases ist EventBaer-spezifisch. Andere Projekte liefern ihre eigenen Werte in ihren eigenen `ALIGNMENT_RULES.json`-Files.
- **Kein Decision-Log** pro Kandidat. Die Felder *sind* die Aussage.

### Offene Risiken

- **Kalibrierungs-Qualitaet der Biases.** Die Start-Werte in der Kalibrierungs-Leitlinie sind qualifizierte Schaetzungen aus dem bestehenden Alignment-Modell. Sie werden sich im ersten echten Lauf als zu hart oder zu weich zeigen. Risiko: die Top-3-Adopt-Liste im ersten Lauf ist unintuitiv. Mitigation: die Biases sind in der JSON-Datei, nicht im Code — Nachjustierung kostet einen Edit, keinen Deploy.
- **Deterministische Scoring-Reihenfolge bei gleichem `valueScore - effortScore`.** Wenn zwei Adopt-Kandidaten numerisch identisch sind, haengt die Reihenfolge von der ursprueglichen Array-Reihenfolge ab. Akzeptabel, weil bei echten EventBaer-Runs die numerische Kollision selten auftritt und die Folge-Reihenfolge trotzdem stabil ist.
- **`runConfidence`-Schwellenwerte.** Die `capabilityDiversity >= 0.4`-Grenze ist ein Schaetzwert. Bei EventBaer gibt es 6 Capabilities, also muessen 2-3 davon matchen fuer `0.4+`. Das ist der richtige Anspruchs-Level fuer `high`, muss aber im ersten Run validiert werden.
- **Lizenz-Information ist nicht immer im Enrichment**. Der GitHub-API-Call fuer Repo-Metadaten liefert `license` nur, wenn GitHub es erkannt hat. Fuer Repos ohne License-Feld zeigt das Template `license-unknown`. Das ist die richtige Aussage, nicht ein Bug.

## Verhaeltnis zu ENGINE_BACKLOG.md

Diese Spec schliesst:
- **EB-001 vollstaendig** (reviewDisposition persistent und deterministisch)
- **EB-002 vollstaendig** (runConfidence + runConfidenceReason aus Engine)
- **EB-003 vollstaendig** (effortBand/valueBand als neue Achsen, adoption-relativ)
- **EB-005 passiv** (durch flache Feld-Additionen ohne neuen Wrapper-Typ)

Nach Umsetzung bleibt offen:
- **EB-004** — echtes Gap-Signal gegen Projekt-Luecken-Matrix. Eigene Spec, eigene Brainstorming-Session.

ENGINE_BACKLOG.md wird nach Umsetzung entsprechend aktualisiert (EB-001/002/003/005 als erledigt markiert, EB-004 bleibt als offener Punkt).
