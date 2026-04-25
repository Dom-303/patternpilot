# Score-Stabilitaets-Plan — auf Weg zu reproduzierbaren 9-10/10 Reports

- last_updated: 2026-04-25
- status: Phase 0-4 done; Phase 5 done (Stability-Harness + Initial-Baseline-Lauf, Real-World-10-Slug-Lauf folgt asynchron mit GitHub-API-Quota)
- scope: Landscape- und Discovery-Report
- zielkorridor: Median 9, Min 8, Max 10 ueber beliebige Problem-Slugs und Zielprojekte
- begriff: "Problem-Slug" = Eingangsargument von `npm run problem:explore -- <slug>`, z. B. `event-dedup`, `schema-extraction`
- baseline nach Phase 0: `01-event-dedup` 6/10, `02-schema-extraction` 8/10, `03-self-healing` 7/10, `04-watchlist-review-empty` 2/10 (Median 6.5, Min 2, Max 8) — siehe `npm run score:baseline`

## 1. Warum dieser Plan ueberhaupt

Nach vier echten Laeufen (drei Landscape, ein Discovery/Review) ist sichtbar: der Report-Kernel liefert, aber die Datenqualitaet pendelt zwischen `2-3/10` (Review-Report mit leerer Watchlist) und `9/10` (`schema-extraction`-Landscape mit orthogonalen Seeds). Das ist kein einzelner Bug, sondern ein Bouquet aus vier strukturellen Ursachen.

Der Plan macht diese Ursachen sichtbar und leitet fuenf Phasen ab, die den Score-Korridor auf stabile `8-10` heben sollen — ohne das eingefrorene Template-Geruest zu beruehren (siehe [`TEMPLATE_LOCK.md`](../reference/TEMPLATE_LOCK.md)).

## 2. Status-Quo — die vier Referenz-Laeufe

| Report | Slug / Mode | Score | Dominante Ursache |
|---|---|---|---|
| Review/Discovery | `review:watchlist` | 2-3/10 | Watchlist leer, Report besteht zu 80 % aus leeren Sections |
| Landscape | `event-dedup` | 7/10 | Ein einziges Cluster ueberlebt, `pattern_family: unknown` bei 40 % der Repos |
| Landscape | `schema-extraction` | 9/10 | orthogonale Seeds, 6 stabile Cluster, Diagnose-Linsen voll befuellt |
| Landscape | `self-healing` | 7/10 | Rate-Limit-Drosselung mid-run, Cluster-Qualitaet ok aber Corpus klein |

Was daraus folgt: der Report ist so gut wie sein Eingangskorpus. Die Schwachstelle ist nicht das Rendering, sondern die Pipeline **davor**.

## 3. Vier identifizierte Ursachen

### U1 — Seed-Diversitaet variiert extrem

Manche Problem-Slugs erzeugen sechs orthogonale Query-Familien (z. B. `schema-extraction` → `json-ld`, `microdata`, `event-schema`, `structured-data-parser`, `html-to-json`, `validator`). Andere fallen auf zwei bis drei lexikalisch aehnliche Queries zurueck (z. B. `event-dedup` → `event dedup`, `event deduplication`, `duplicate events`), die alle denselben Cluster zurueckliefern.

### U2 — `pattern_family: unknown`

Die Heuristik in `lib/discovery/pattern-family.mjs` laesst 30-40 % der Kandidaten als `unknown` durch. Jedes `unknown` reisst zwei Report-Linsen auf einmal ein: Pattern-Family-Panel und Sidenav-Label (`shortClusterNavLabel` faellt auf den Repo-Namen zurueck).

### U3 — Rate-Limit-Fragilitaet

Ab ~60 Kandidaten pro Lauf trifft der Worker `403 rate limit exceeded` (Search 30/min). Der Code re-tried zwar, aber einzelne Enrichment-Calls (`getRepoTopics`, `getReadme`) fallen still auf `null` zurueck — und `null`-Topics sind der zweithaeufigste Grund fuer `pattern_family: unknown`.

### U4 — Discovery-Report ohne Watchlist ist leer

`review:watchlist` rendert alle Sections, auch wenn die Watchlist `0` Eintraege hat. Der Nutzer sieht 15 Sections voller "keine Daten" — und denkt, der Report sei kaputt, obwohl nur der Intake leer ist.

## 4. Scoring-Modell (so bewerte ich die Phasen)

Jede Phase wird gegen drei Kriterien abgeklopft:

- **Score-Delta** — realistische Punkte-Verschiebung in der Median-Score, nicht Best-Case
- **Aufwand** — geschaetzt in Stunden Hand-Arbeit, ohne Rueckfrage-Schleifen
- **Risiko** — Chance, dass die Aenderung den bereits guten Lauf (`schema-extraction`) verschlechtert

## 5. Die fuenf Phasen

### Phase 0 — Test-Harness ✓ done

- **Status:** 2026-04-24 geliefert. Implementierung: `lib/scoring/score-report.mjs` (pure functions), `scripts/score-report.mjs` (CLI), `test/fixtures/score-baseline/` (4 gefreezte Runs), `test/score-report.test.mjs` (21 Tests, in `npm run release:smoke` enthalten)
- **Aufrufe:** `npm run score -- <run-path> [--pretty]` fuer Einzel-Scores, `npm run score:baseline` fuer die Baseline-Tabelle
- **Ziel:** reproduzierbare Score-Messung pro Run, damit jede Phase messbar verbessert/verschlechtert
- **Konkret:**
  - `scripts/score-report.mjs` schreiben: liest einen Landscape- oder Discovery-Run aus den gefreezten JSON-Artefakten (**kein Live-API-Call**) und spuckt eine numerische Score (0-10) mit Teil-Noten pro Achse aus
  - Achsen mit Messvorschrift:
    - **cluster-diversity (0-2)** — `0` bei 1 Cluster, `1` bei 2-3 Cluster mit `shared_token_ratio ≥ 0.5`, `2` bei ≥3 Cluster mit `shared_token_ratio < 0.5`
    - **pattern-family-coverage (0-2)** — `0` bei `unknown_ratio > 0.30`, `1` bei `0.10-0.30`, `2` bei `< 0.10` (Population: alle Cluster-Member-Repos)
    - **lens-richness (0-2)** — `0` wenn ≥3 Sections leer, `1` wenn 1-2 Sections leer, `2` wenn alle Sections befuellt
    - **context-alignment (0-2)** — `0` wenn Project-Context-Section fehlt oder `empty`, `1` wenn teilweise, `2` wenn vollstaendig mit Binding + Signals
    - **visual-completeness (0-2)** — `0` wenn Sidenav-Labels zu > 20 % Fallback (Repo-Name), `1` wenn 5-20 %, `2` wenn < 5 %
  - Fixture-Set: die vier Referenz-Runs (`event-dedup`, `schema-extraction`, `self-healing`, `review:watchlist`) als minimierte JSON-Snapshots in `tests/fixtures/score-baseline/` einchecken (nur `*.json` unterhalb `runs/.../artifacts/`, keine HTMLs)
  - `npm run score -- <run-path>` wired in `package.json`
- **Aufwand:** ~3 h
- **Score-Delta:** 0 direkt — aber ohne Phase 0 sind die spaeteren Deltas nicht beweisbar
- **Risiko:** niedrig — nur lesender Zugriff auf Artefakte
- **Rollback:** Script-only, kein Produkt-Code beruehrt — revert = `git revert`
- **Acceptance:** vier Baseline-Runs liefern deterministisch dieselbe Score auf zwei Maschinen (identische Fixtures)

### Phase 1 — Seed-Diversifikation ✓ scaffolding done, default off

- **Status:** 2026-04-24 ausgerollt als opt-in. Implementierung: `lib/discovery/seed-diversifier.mjs` (pure fns), `lib/discovery/seed-dictionary.json` (35 kuratierte Phrasen), CLI-Flag `--seed-strategy=auto|manual|off` (Default `manual` = Baseline-Verhalten). Integration in `scripts/commands/problem-explore.mjs`. 17 neue Tests in `release:smoke`. Baseline-Scores unveraendert (6/8/7/2)
- **Aufruf:** `npm run problem:explore -- <slug> --project <project> --seed-strategy auto`
- **Verifikation am realen Korpus:** 12-Seed event-dedup-Input ergibt `passthrough` (bereits 7 orthogonale Seeds); pathologisches 3-Seed-Kollaps ergibt `diversified` mit 3 Dictionary-Supplements. Diversifier ist Safety-Net fuer Edge-Cases, nicht Default-Transform — das matcht die real beobachtete Seed-Qualitaet
- **Offen fuer spaeter:** Default von `manual` auf `auto` flippen, sobald ein echter Run mit `--seed-strategy auto` das Score-Delta beweisbar macht; LLM-Stage-3 (`--with-llm`) ist bewusst nicht enthalten (siehe OQ-005)
- **Ziel:** U1 — keinen Run mehr mit < 3 orthogonalen Query-Familien
- **Konkret:**
  - `lib/discovery/query-seeds.mjs`: nach der bestehenden Seed-Erzeugung eine Diversity-Check-Stufe einziehen. Wenn weniger als 3 Seeds strukturell unterschiedlich sind (Jaccard-Distanz < 0.5 auf Token-Ebene), **primaer** aus dem kuratierten Seed-Dictionary (`lib/discovery/seed-dictionary.json` mit ~40 Achsen: parser, validator, extractor, transformer, crawler, scheduler, ...) orthogonale Kombinationen ziehen
  - **Sekundaer**, nur wenn `--with-llm` gesetzt: Klassifier-Call mit Haiku (nicht Opus — Kosten/Reproduzierbarkeit), Budget **max 1 Call pro Run**, 2-3 Ersatz-Seeds generieren lassen
  - Diversity-Check wird auch auf den LLM-Output angewandt (LLM kann schwache Outputs liefern)
  - CLI-Flag `--seed-strategy=auto|manual` (Default `auto`) — manuell, wenn der Nutzer bewusst engen Fokus will
- **Aufwand:** 5-7 h (inkl. Dictionary-Kuration)
- **Score-Delta:** +1.5 bis +2 auf schlechten Laeufen (`event-dedup` von 7 → 9), null Delta auf bereits guten Laeufen
- **Risiko:** mittel — LLM-Generierung kann bei neuen Slugs abdriften. Mitigator: Dictionary-primaer, LLM nur Opt-in, Diversity-Check auf Output
- **Rollback:** CLI-Flag `--seed-strategy=manual` deaktiviert die Diversity-Stufe komplett; Dictionary-Datei loeschen laesst Code still auf Legacy-Pfad zuruecklaufen
- **Acceptance:** `event-dedup` und `self-healing` zeigen in Phase-0-Score einen Anstieg um ≥1.0 Punkt; `schema-extraction` zeigt Score-Delta im Bereich `±0.2` (kein Regression)

### Phase 2 — Pattern-Family-Hardening ✓ scaffolding done, default off

- **Status:** 2026-04-24 ausgerollt als opt-in. Implementierung: `lib/clustering/pattern-family-classifier.mjs` (pure `classifyRepoPatternFamily` + `classifyRepos`), `lib/clustering/pattern-family-lexicon.json` (25 Familien mit Keyword-Listen), CLI-Flag `--pattern-family=off|auto` (Default `off` = Baseline-Verhalten). Integration: problem-explore.mjs klassifiziert Repos zwischen enrichment und buildLandscape, wenn Flag `auto`. 19 neue Tests in `release:smoke`. Baseline-Scores unveraendert (6/8/7/2)
- **Aufruf:** `npm run problem:explore -- <slug> --project <project> --pattern-family auto`
- **Architektonische Entdeckung:** Der im Plan angenommene Stage-1-Classifier (`classification/core.mjs#guessClassification`) wird im Worker-Intake-Pfad aufgerufen, **nicht** im problem:explore-Pfad. Phase 2 schliesst damit keine "zweite Stufe" zu einer "ersten" — sie ist die **erste** Pattern-Family-Heuristik im Landscape-Pfad ueberhaupt. Stage-3-LLM bleibt explizit draussen (siehe OQ-005)
- **Verifikation am realen Korpus:** Auf den gefreezten Baseline-Fixtures klassifiziert der Classifier 6/6 (event-dedup) und 2/2 (schema-extraction) bisher `unknown`-Member-Repos. Labels plausibel: `deduper`, `matcher`, `scraper`, `orchestrator`
- **Offen:** Default von `off` auf `auto` flippen, sobald ein Real-Run Score-Delta zeigt; Lexikon-Kurations-Loop nach 5-10 Real-Runs (Familien auf Baseline der tatsaechlich klassifizierten Repos haerten)
- **Ziel:** U2 — `unknown`-Quote von 30-40 % auf < 10 % (Population: alle Cluster-Member-Repos, nicht rohe Discovery-Treffer)
- **Konkret:**
  - `lib/discovery/pattern-family.mjs`: zweite Evidenz-Stufe einziehen, wenn Primary-Heuristik `unknown` ergibt
    - Stage 1 (bestehend): Topics + Language + stacksignal
    - Stage 2 (neu): README-First-Paragraph + Repo-Description gegen ein fest verdrahtetes Pattern-Family-Lexikon matchen (`parser`, `validator`, `scraper`, `orchestrator`, `enricher`, `dedupe`, `schema`, ...)
    - Stage 3 (neu, nur wenn `--with-llm`): kurzer Klassifier-Call mit 3-Zeilen-Kontext, 8-Wort-Antwort, Budget max 5 Calls/Run
  - `unknown`-Quote im Run-Health-Panel sichtbar ausweisen (neue Metric `pattern_family_unknown_ratio`, berechnet ueber Cluster-Member-Population)
- **Beziehung zu Phase 3:** Stage 1 funktioniert auch ohne Rate-Limit-Haertung (Topics kommen aus dem regulaeren `/repos`-Call). Stage 2 braucht `getReadme`, das bei Rate-Limit aktuell still `null` liefert. Phase 3 hebt damit die Obergrenze von Stage 2, ist aber nicht strict Voraussetzung
- **Aufwand:** 3-5 h
- **Score-Delta:** +1 auf Laeufen mit hoher `unknown`-Quote; zusaetzlich Lift der `shortClusterNavLabel`-Qualitaet (Sidenav wird lesbar)
- **Risiko:** niedrig — Stage 2 ist reiner Keyword-Match, Stage 3 ist opt-in
- **Rollback:** Stage 2/3 hinter Feature-Flag `PATTERN_FAMILY_MULTI_STAGE` (Default `true`). Flag auf `false` setzt Pipeline auf Stage-1-only zurueck
- **Acceptance:** `event-dedup` und `self-healing` zeigen `pattern_family_unknown_ratio ≤ 0.10` im Run-Health-Panel (gemessen ueber Cluster-Member-Population)

### Phase 3 — Rate-Limit-Resilienz ✓ done

- **Status:** 2026-04-24 geliefert. Implementierung: `lib/github/rate-limit.mjs` (pure utils), erweitertes `lib/github/api-client.mjs` (statusCode + responseHeaders an Errors, Rate-Limit-Retry mit `x-ratelimit-reset`-Awareness), `lib/discovery/pass.mjs` (enrichment_incomplete-Flag + optionaler Hard-Throttle), neues CLI-Flag `--slow`. 23 neue Tests (18 pure + 5 mocked https.request). Baseline-Scores unveraendert (6/8/7/2)
- **Default ON:** Rate-Limit-Retry ist rein additiv — bei keinem Rate-Limit-Hit laeuft die Pipeline identisch wie vorher. Ein 403-Hit triggert jetzt Backoff (Reset-Header-aware, gekappt auf 90s) statt stillem Enrichment-Fail. Der Fix ist Backwards-Compatible fuer bestehende Aufrufer
- **Aufrufe:** automatisch aktiv; `npm run problem:explore -- <slug> --slow` fuer sequentiellen 1-req/s-Modus auf Tokens ohne Premium-Limit
- **Neue Observability:** Repos tragen jetzt `enrichment_incomplete: boolean` + `enrichment_error`; `landscape.json.enrichment_health = { total, incomplete, incomplete_ratio, throttle_ms }`
- **Ziel:** U3 — keine stillen `null`-Enrichments mehr bei Laeufen mit > 40 Kandidaten
- **Konkret:**
  - `lib/github/client.mjs`: zentrale Rate-Limit-Awareness. Beim naechsten Request Header `x-ratelimit-remaining` lesen, unterhalb 10 in backoff gehen (exp. Backoff mit Jitter, max 90 s)
  - Retry-Budget pro Enrichment-Call auf 3 erhoehen (aktuell 1), mit 2-4-8-s-Waittimes
  - **Wichtig:** Enrichment-Failures nicht mehr still auf `null` kollabieren — stattdessen `enrichment_incomplete: true` auf dem Kandidaten setzen und im Run-Health-Panel aggregieren
  - CLI-Flag `--slow` fuer Nutzer ohne premium-Token: 1 Request/s Hard-Throttle
- **Aufwand:** 2.5-3.5 h
- **Score-Delta:** +0.5 bis +1 auf grossen Corpora (>40 Kandidaten)
- **Risiko:** niedrig — reiner Robustheits-Layer, keine neue Logik
- **Rollback:** Backoff-Schwelle auf `-1` setzen (env var `GITHUB_RATE_LIMIT_FLOOR=-1`) deaktiviert den neuen Pfad, bestehendes Retry bleibt
- **Acceptance:** Lauf mit 80 Kandidaten auf Standard-Token ohne `403 rate limit` durchlaeuft; Run-Health zeigt `enrichment_incomplete_ratio ≤ 0.05`

### Phase 4 — Discovery-Auto-Fallback ✓ done (Layer 1 + Layer 2)

- **Status Layer 1:** 2026-04-25 geliefert. Implementierung: `lib/review/watchlist-health.mjs` (pure functions), Integration in `lib/review.mjs`, `--auto-discover` + `--no-auto-discover` Flags in `lib/config.mjs`. 18 neue Tests in `release:smoke`. Baseline-Scores unveraendert (6/8/7/2)
- **Layer 1 (Default ON, additiv):** Bei watchlist-laeufen mit `count < 3` enthaelt der Review-Report jetzt
  - ein **runGapSignal** `gap=watchlist_intake` mit konkretem Discovery-Command
  - **konkrete nextSteps** (zwei Strings) mit `npm run discover` und `npm run intake` plus Begruendung
  - ein **strukturiertes Health-Objekt** `review.watchlistHealth = { state, count, threshold, ... }` fuer downstream Konsumenten
  - bei `selectedUrls > 0` wird Health-Injection unterdrueckt (User hat Korridor explizit gewaehlt)
- **Status Layer 2:** 2026-04-25 geliefert. Implementierung: `lib/review/auto-discover.mjs` (DI-faehiges Trigger-Modul), Integration in `scripts/commands/watchlist.mjs`. 11 neue Tests in `release:smoke` (169/169) mit gemocktem `runDiscover` — kein Real-World-Lauf erforderlich, um die Trigger-Logik zu validieren
- **Layer 2 (opt-in via `--auto-discover`):** runReviewWatchlist ruft jetzt vor `buildWatchlistReview` den Auto-Discover-Helper. Wenn Flag gesetzt UND Watchlist nicht-healthy UND keine selectedUrls: `runDiscover` mit `discoveryProfile=focused`, `analysisDepth=quick`, `appendWatchlist=true`, `intake=true`. Die Kandidaten landen damit in Watchlist-File UND Queue, sodass das anschliessende `buildWatchlistReview` sie als items findet. Fail-safe: bei Exception wird der Fehler protokolliert und der Review laeuft mit dem unveraenderten Stand weiter — Layer 1 sorgt fuer aussagekraeftigen Empty-Report
- **Score-Auswirkung Layer 1:** Auf der `04-watchlist-review-empty`-Fixture **kein** Score-Sprung (Layer 1 fuellt `runGapSignals` von 0 auf 1 hits, aber lens-richness braucht ≥3 hits). Der Lift entsteht in der UX (Report ist nicht mehr leer)
- **Score-Auswirkung Layer 2 (erwartet):** Real-Run mit `--auto-discover` fuellt Watchlist + Queue → Review-Items > 0 → cluster-diversity + pattern-family-coverage + lens-richness + visual-completeness koennen alle Punkte holen. Erwarteter Sprung von 2/10 auf 7-9/10. Empirische Verifikation ist Phase 5
- **Aufruf:** Layer 1 immer aktiv (additive Diagnose). Layer 2 opt-in: `npm run review:watchlist -- --project <project> --auto-discover` triggert tatsaechliche Discovery + Intake vor dem Review
- **Ziel:** U4 — kein leerer Review-Report mehr. Wenn Watchlist leer ist, macht der Report Discovery-on-the-fly
- **Konkret:**
  - `scripts/commands/review-watchlist.mjs`: Pre-Check. Wenn Watchlist `< 3` Eintraege, automatisch `npm run discover` im `focused`-Profil mit dem Zielprojekt-Kontext triggern, Ergebnisse in die Watchlist injizieren, dann Review laufen lassen
  - CLI-Flag `--no-auto-discover` als Opt-out
  - Neues Meldbanner im Report-Intro: "Watchlist war leer, Discovery wurde automatisch ergaenzt um X Kandidaten aus Profil `focused`" — **pflicht**, damit der Nutzer nicht denkt, er sehe seine kuratierte Watchlist
  - Optional (Stretch): wenn auch Discovery `< 3` Kandidaten liefert, Sections mit leeren Datensaetzen ueber den bestehenden `renderEmpty`-Pfad markieren statt weiter durchzurendern. **Keine Template-Aenderung** — derselbe Renderer, nur mit `skip: true` auf den betroffenen Sections
- **Aufwand:** 5-7 h
- **Score-Delta:** +5 bis +6 (von 2-3 auf 8-9) — der mit Abstand groesste Einzel-Hebel, weil der Ausgangswert so schlecht ist
- **Risiken:**
  - **UX:** Nutzer koennte denken, Report zeige kuratierte Watchlist. Mitigator: pflicht-Banner, siehe oben
  - **Kosten:** Discovery kann in `max`-Profil teuer werden. Mitigator: fester `focused`-Fallback, kein `max`
  - **Seed-Qualitaet:** Auto-Discovery ist nur so gut wie die Seeds, die Phase 1 bereitstellt. **Deshalb muss Phase 1 vor Phase 4 stehen**
- **Rollback:** CLI-Flag `--no-auto-discover` setzt das Feature fuer einzelne Runs aus; env var `PATTERNPILOT_AUTO_DISCOVERY=false` global
- **Acceptance:** `npm run review:watchlist` mit leerer Watchlist rendert einen Report mit ≥ 8 gefuellten Sections und sichtbarem Auto-Discovery-Banner im Intro

### Phase 5 — Stability-Test ✓ done (Harness)

- **Status:** 2026-04-25 geliefert. Implementierung: `lib/scoring/stability.mjs` (pure aggregation: median/min/max/mean, per-axis stats, weakness summary, acceptance check), `scripts/run-stability.mjs` (Harness mit drei Modi: `--from-fixtures`, `--from-runs <project>`, `--runs <comma-list>`), `npm run stability-test` + `npm run stability-test:baseline`. 13 neue Tests in `release:smoke`. Initial-Lauf gegen Baseline-Fixtures geschrieben unter `docs/foundation/stability/baseline-fixtures.md`. Hand-kuratiertes Meta-Doc unter [`SCORE_STABILITY_RESULTS.md`](SCORE_STABILITY_RESULTS.md)
- **Acceptance-Schwellen** als Code-Konstanten (`ACCEPTANCE_THRESHOLDS` in `lib/scoring/stability.mjs`): median ≥ 8, min ≥ 7, max ≥ 9. Test-anchored. Ein Stability-Lauf mit `npm run stability-test` exited mit Code 1, wenn diese Schwellen nicht erreicht sind — taugt damit fuer CI-Integration
- **Aktueller Baseline-Lauf (vor Phase-1+2-Aktivierung):** Median 6.5/10, Min 2/10, Max 8/10 — **FAIL** (median 6.5 < 8, min 2 < 7, max 8 < 9). Das ist erwartungsgemaess: die Fixtures wurden mit Default-Flags erstellt
- **Real-World-Lauf offen:** der echte Phase-5-Beleg ist ein Lauf mit `--seed-strategy auto --pattern-family auto` gegen 10 frische Slugs plus mindestens einem `--auto-discover`-Watchlist-Run. Trigger-Sequenz steht in `SCORE_STABILITY_RESULTS.md`. Dieser Lauf braucht GitHub-API-Quota + ~60 Min Laufzeit und gehoert in eine eigene Session
- **Ziel:** nachweisen, dass Phase 1-4 zusammen wirken und die Median-Score stabil ueber 8 liegt
- **Konkret:**
  - 10 frisch gezogene Problem-Slugs (Mix: 4 einfach, 3 mittel, 3 schwer — darunter explizit `event-dedup` und `self-healing`) durch die Pipeline schicken
  - Phase-0-Score auf jeden Lauf anwenden, Median/Min/Max dokumentieren
  - Report `docs/foundation/SCORE_STABILITY_RESULTS.md` mit Tabelle + Regression-Notes
  - Falls Median < 8: Nachjustierung Phase 1 oder 2 notwendig — das ist explizit Teil des Plans, kein Fehlschlag
- **Aufwand:** 2-3 h (Laufzeit ~60 min fuer 10 Runs, Rest Auswertung)
- **Score-Delta:** 0 — Messphase
- **Statistische Grenze:** `n=10` ist bewusst klein, um Laufzeit und API-Quota zu schonen. Belastbar fuer Median/Min/Max, **nicht** fuer Varianz- oder Signifikanz-Aussagen. Wenn Median knapp unter 8 landet (7.5-7.9), ist eine zweite Welle mit 10 weiteren Slugs noetig, bevor Nachjustiert wird
- **Acceptance:** Median ≥ 8, Min ≥ 7, Max ≥ 9 ueber die 10 Runs

## 6. Reihenfolge und Abhaengigkeiten

```
Phase 0 (Test-Harness)
  │
  ├── Phase 1 (Seed-Diversifikation) ────────┐
  │                                          │
  ├── Phase 3 (Rate-Limit-Resilienz) ─────┐  │
  │                                       │  │
  │   Phase 2 (Pattern-Family-Hardening) ←┘  │   (Phase 3 hebt Obergrenze,
  │                                          │    nicht strict prerequisite)
  │                                          │
  │   Phase 4 (Discovery-Auto-Fallback) ←────┘   (braucht Phase-1-Seeds
  │                                               fuer gute Auto-Discovery)
  │
  └── Phase 5 (Stability-Test) ← nach allen anderen
```

Empfohlene Ausfuehrungs-Reihenfolge: **Phase 0 → 1 → 3 → 2 → 4 → 5**.

Begruendung:

- **Phase 0 zuerst**, damit jede folgende Phase messbar ist
- **Phase 1 vor Phase 4**, weil Phase 4 intern Discovery aufruft und nur mit guten Seeds sinnvolle Kandidaten liefert
- **Phase 3 vor Phase 2**, weil Phase-2-Stage-2 auf README-Text angewiesen ist, der bei Rate-Limit aktuell still `null` wird
- **Phase 4 spaet**, weil sie den groessten Einzel-Hebel hat — aber nur unter der Voraussetzung, dass die Pipeline davor solide ist. Phase 4 frueh zu ziehen, waere ein Strohfeuer auf Basis schwacher Seeds
- **Phase 5 zuletzt**, um die Gesamtwirkung zu messen

Gesamt-Aufwand: **20-28 h**.

## 7. Zielkorridor

Nach Abschluss aller Phasen:

- **Median:** 9/10 ueber beliebige Problem-Slugs mit sinnvollem Zielprojekt-Kontext
- **Minimum:** 8/10 — auch auf engen/obskuren Slugs
- **Maximum:** 10/10 auf gut passenden Slugs mit reichem Kontext

## 8. Ehrliche Grenzen

Nicht jeder Lauf kann 10/10 erreichen:

- Slugs in extrem kleinen Nischen (< 5 relevante Repos auf GitHub) bleiben bei ~6-7/10, unabhaengig von Pipeline-Qualitaet
- Zielprojekte mit leerem `PROJECT_CONTEXT.md` liefern schwache Context-Alignment-Scores — das ist ein Nutzer-Input-Problem, kein Pipeline-Problem
- Der Discovery-Auto-Fallback ist ein Workaround fuer den Edge-Case "leere Watchlist", nicht eine generelle Aufwertung des Review-Flows
- LLM-basierte Seed-Generierung ist nicht reproduzierbar zwischen Modell-Versionen — Phase 1 wird daher primaer auf Dictionary-Fallback setzen, LLM nur als Dritt-Stufe

## 9. Was bewusst NICHT in diesem Plan steht

- keine Template-Aenderungen (Template-Lock)
- keine neuen Report-Sections
- keine Architektur-Umbauten im Clustering (Stage 0-2 Provenance/Structural/Semantic bleibt)
- keine Migration auf GitHub-App (siehe OQ-004)
- kein LLM-Augmentation-Boundary (siehe OQ-005)

## 10. Handoff-Notiz fuer den naechsten Agenten

Wenn dieser Plan umgesetzt wird, beginnt die Arbeit immer mit **Phase 0**. Ohne Test-Harness laesst sich kein Phase-Delta beweisen, und das Risiko, einen guten Lauf (`schema-extraction`, 9/10) zu verschlechtern, ist real. Die Fixture-Runs liegen unter `runs/eventbear-worker/` — die vier Referenz-Runs werden in `tests/fixtures/score-baseline/` minimiert eingecheckt (nur JSON-Artefakte, keine HTMLs, keine Secrets).

Pro Phase gilt zusaetzlich:

- Vor dem Merge **alle vier Baseline-Runs** durch den Scorer schicken und Delta prokollieren
- Regression ≥ `-0.5` auf einem bereits guten Lauf ist Abbruchgrund — Rollback-Pfad pro Phase nutzen
- STATUS.md und OPEN_QUESTION.md am Ende jeder Phase nachziehen

## 11. Autoritative Referenzen

- [OPERATING_MODEL.md](OPERATING_MODEL.md)
- [V1_STATUS.md](V1_STATUS.md)
- [TEMPLATE_LOCK.md](../reference/TEMPLATE_LOCK.md)
- [REPORT_OUTPUT_MODEL.md](../reference/REPORT_OUTPUT_MODEL.md)
- [GITHUB_DISCOVERY_MODEL.md](../reference/GITHUB_DISCOVERY_MODEL.md)
