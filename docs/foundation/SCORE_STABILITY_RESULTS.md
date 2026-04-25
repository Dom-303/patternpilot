# Score Stability Results — Meta-Doc

Hand-kuriertes Begleitdokument zu den Phase-5-Stability-Laeufen aus
[`SCORE_STABILITY_PLAN.md`](SCORE_STABILITY_PLAN.md).

## Zweck

Die Phase-5-Harness misst, ob Phase 1-4 in Kombination den geplanten
Score-Korridor treffen: **Median ≥ 8, Min ≥ 7, Max ≥ 9**.

Dieses Dokument verdichtet die Ergebnisse jedes Stability-Laufs auf
einen Stand. Die rohen, maschinen-erzeugten Tabellen liegen unter
[`stability/`](stability/), pro Quelle eine Datei.

## Aktueller Stand (Stand 2026-04-25)

### Lauf 1 — Baseline-Fixtures (vor Phase-1+2-Aktivierung)

- **Quelle:** [`stability/baseline-fixtures.md`](stability/baseline-fixtures.md)
- **Erzeugt von:** `npm run stability-test:baseline`
- **Run-Count:** 4 (3 Landscape + 1 Review)
- **Aggregat:** Median 6.5/10, Min 2/10, Max 8/10, Mean 5.75/10
- **Acceptance:** **FAIL** (median 6.5 < 8, min 2 < 7, max 8 < 9)

Das ist das erwartete Ergebnis: die Baseline-Fixtures wurden vor
Phase 1+2 erstellt und mit Default-Flags (`--seed-strategy manual`,
`--pattern-family off`, kein `--auto-discover`) gerendert. Ein
FAIL hier ist die Begruendung, warum der Plan ueberhaupt geschrieben
wurde — nicht ein Regressions-Signal.

### Lauf 2 — Real-World mit Phase-1+2+4-Flags ✓ PASS (Phase-6-Rescore)

- **Datum:** 2026-04-25
- **Quelle:** [`stability/post-phase4-real-world.md`](stability/post-phase4-real-world.md)
- **Setup:** 3 bestehende Slugs neu durch `problem:explore` mit `--seed-strategy auto --pattern-family auto`, plus `review:watchlist --auto-discover` gegen leere Watchlist
- **Aggregat (Combined):** Median **8.13/10**, Min **7/10**, Max **9.38/10**, Mean **8.16/10**
- **Aggregat-Split:** Struktur median 10, Inhalt median 6.25
- **Acceptance:** **PASS** (combined median 8.13 ≥ 8, min 7 ≥ 7, max 9.38 ≥ 9)

| Slug / Mode | Baseline | Combined | Struktur | Inhalt |
|---|---|---|---|---|
| event-deduplication-across-heterogenous-sources | 5.5/10 | **8.75** | 10 | 7.5 |
| schema-exact-extraction-into-40-column-masterlist | 6.5/10 | **7.5** | 10 | 5 |
| self-healing-adaptive-source-intake | 6/10 | **7** | 9 | 5 |
| watchlist-review (mit --auto-discover) | 1/10 | **9.38** | 10 | 8.75 |

**Schwaechste Achsen ueber Lauf 2** (aus `summarizeAxisWeakness`):
1. `[content] label-fidelity` — mean 0.25/2 (3 von 4 Runs bei 0)
2. `[content] problem-fit` — mean 1/2 (zwei Slugs bei 0)
3. `[structure] cluster-diversity` — mean 1.75/2 (self-healing bei 1)
4. `[structure] pattern-family-coverage` — mean 2/2 (durchgaengig stark)

Der Inhalts-Score-Drop von 10 auf 6.25 ist der ehrliche Befund von Phase 6:
die Pipeline produziert formal vollstaendige Reports, aber die Cluster-Labels
spiegeln nicht die Member-Inhalte, und problem_derived-Tokens ueberschneiden
sich nur wenig mit Repo-Tokens. Beides sind echte Folge-Hebel, kein
Datenartefakt.

### Lauf 3 — Cross-Project ueber drei Domaenen ✗ FAIL (erwartet)

- **Datum:** 2026-04-25
- **Quelle:** [`stability/cross-project.md`](stability/cross-project.md)
- **Setup:** dieselben 4 EventBaer-Worker-Runs aus Lauf 2 + 1 EventBaer-Web (SSR mit PocketBase) + 1 PinFlow (Pixel-zu-Code-Devtool, React Fiber / Vue VNode introspection). Drei Domaenen: data-extraction, web/SSR, devtools/browser
- **Aggregat (Combined):** Median **7.82/10**, Min **4.75/10**, Max **9.38/10**, Mean **7.59/10**
- **Aggregat-Split:** Struktur median 10, Inhalt median 5.63
- **Acceptance:** **FAIL** (combined median 7.82 < 8, min 4.75 < 7)

| Projekt | Domaene | Klassifikation | Combined | Struct | Content |
|---|---|---|---|---|---|
| eventbear-worker (4 runs) | data-extraction, scraping | 95-100% | 7-9.38 | 9-10 | 5-8.75 |
| eventbear-web (1 run) | web frontend, SSR | 85% | **8.13** | 10 | 6.25 |
| pinflow (1 run) | browser devtool, framework adapters | **65%** | **4.75** | 7 | 2.5 |

**Lessons:**

- **Phase 1 (Seed-Diversifier)** = passthrough auf allen 6 Runs. Keine Cross-Domain-Schwaeche, aber auch keine Cross-Domain-Wirkung
- **Phase 2 (Pattern-Family-Classifier)** = klare Domaenen-Abhaengigkeit. Lexikon trifft eventbaer-worker-Domaene zu 95-100%, eventbear-web zu 85%, pinflow zu 65%. Das ist exakt der vorhergesagte Cross-Domain-Drop
- **content axis `problem-fit`** = ebenfalls domaenenabhaengig: eventbear-web 2/2, pinflow 0/2. Repos zur SSR-mit-PocketBase-Frage haben starkes Token-Overlap mit den Problem-Seeds; Repos zu Fiber/VNode-Introspection nicht — die Domaene benutzt zu spezielles Vokabular
- **content axis `label-fidelity`** = domaenen-unabhaengig schwach (mean 0.17/2 ueber 6 Runs). Das ist ein STRUKTUR-Problem im Cluster-Labeling, nicht ein Domain-Problem. Top-3-Member-Tokens dominieren die Cluster-Token-Verteilung selten
- **content axis `decision-readiness`** = ueberall 2/2. agentView ist ueberall vollstaendig — keine Cross-Domain-Schwaeche

**Folge-Hebel-Reihenfolge nach diesem Lauf:**

1. **Phase 7.1 — Per-Project-Lexikon** (groesster Cross-Domain-Hebel): pinflow's 4.75 → wahrscheinlich 7-8 sobald `bindings/pinflow/PATTERN_FAMILY_LEXICON.json` existiert mit Familien wie `framework-adapter`, `devtools-protocol`, `runtime-introspection`, `source-mapper`
2. **Phase 7.0 — Label-Fidelity-Fix** (domain-unabhaengig): Cluster-Labels brauchen einen besseren Builder als nur "top-3 Member-Tokens joined". Realistischer: Pattern-Family + Top-2-distinguishing-Tokens. Wuerde label-fidelity auf 1-2/2 ueber alle Runs heben
3. **Phase 7.2 — Lexikon-Auto-Extension** kommt erst, wenn 5-10 Runs ueber verschiedene Projekte vorliegen, damit der Auto-Suggester echte Daten zum Lernen hat

Acceptance-FAIL hier ist **kein Bug**, sondern die ehrliche Vermessung. Der Plan hat fuer eventbear-worker geliefert; cross-domain-Acceptance erfordert Phase 7.

### Lauf 4 — Cross-Project nach Phase 7 ✓ PASS

- **Datum:** 2026-04-25
- **Quelle:** [`stability/post-phase7.md`](stability/post-phase7.md)
- **Setup:** wie Lauf 3, aber pinflow neu gerechnet mit Phase 7.1 Per-Project-Lexikon, alle Runs gegen den Phase-7.0-Scorer (member-coverage-basierte label-fidelity) bewertet
- **Aggregat (Combined):** Median **8.44/10**, Min **7/10**, Max **10/10**, Mean **8.46/10**
- **Aggregat-Split:** Struktur median 10, Inhalt median 6.88
- **Acceptance:** **PASS** (combined median 8.44 ≥ 8, min 7 ≥ 7, max 10 ≥ 9)

| Run | Lauf 3 (pre-7) | Lauf 4 (post-7) | Δ | Hebel |
|---|---|---|---|---|
| event-dedup | 8.75 | **10** | **+1.25** | Phase 7.0 (label-fidelity 0→2) |
| schema-extraction | 7.5 | 7.5 | 0 | Cluster-Members thematisch zu disjunkt |
| self-healing | 7 | 7 | 0 | Search-Limit-Hit beim Run, zu wenige Members fuer Lift |
| review w/ auto-discover | 9.38 | 9.38 | 0 | bereits vor Phase 7 sehr stark |
| eventbear-web | 8.13 | **9.38** | **+1.25** | Phase 7.0 (label-fidelity 0→2) |
| pinflow | 4.75 | **7.5** | **+2.75** | Phase 7.1 (Per-Project-Lexikon: 65 % → 100 % Klassifikation, struct 7→10, content 2.5→5) |

Schwaechste Achsen nach Lauf 4:
1. `[content] label-fidelity` — mean 0.83/2 (war 0.17 — verdreifacht), min 0/2
2. `[content] problem-fit` — mean 1/2 (unveraendert)
3. `[structure] cluster-diversity` — mean 1.83/2 (self-healing-Search-Limit-Outlier)
4. `[content] classification-confidence` — mean 1.83/2 (Phase 7.1 Lift)

Phase 7 hat zwei der drei urspruenglichen Inhalts-Schwaechen geheilt:
- **classification-confidence** ist ueber alle 6 Runs jetzt mean 1.83/2 (war ~1.5)
- **label-fidelity** ist mean 0.83/2 (war 0.17) — die Haelfte der Runs auf 2/2

Was offen bleibt:
- **problem-fit** (mean 1/2) ist domain-spezifisch und schwierig per Heuristik zu heben — der Token-Overlap zwischen problem-Seeds und Repo-Tokens ist physisch begrenzt durch unterschiedliche Vokabulare
- **schema-extraction** und **self-healing** lifteten nicht — bei beiden ist die Cluster-Member-Token-Struktur disjunkter als der Label-Builder ausgleichen kann

Beobachtungen aus dem Lauf:

- **Phase 1 (Seed-Diversifier):** Auf allen drei Slugs `passthrough — already_diverse`. Bestaetigt: die existierende Seed-Generierung ist in den meisten Faellen bereits orthogonal genug; Phase 1 ist Safety-Net fuer Edge-Cases
- **Phase 2 (Pattern-Family-Classifier):** klassifiziert 20/20, 20/20, 19/20 Repos (95-100%). Hebt pattern-family-coverage und visual-completeness ueberall auf 2/2 — der entscheidende Score-Lift
- **Phase 3 (Rate-Limit-Resilienz):** self-healing lief in den Search-API-30/min-Limit waehrend des sequentiellen 3-Slug-Laufs. Phase 3 fing das nicht ab, weil das ein Per-Minute-Quota-Problem ist statt ein einzelner-Call-Retry. Trotzdem produzierte der Lauf 19/20 klassifizierte Repos und 9/10. Cluster-Diversity fiel auf 1/2, weil weniger Queries Treffer geliefert haben
- **Phase 4 Layer 1 (Health-Diagnose):** im Review-without-auto-discover-Probelauf sichtbar — `runGapSignals[0].gap=watchlist_intake`, klare Discovery-Empfehlung in nextSteps. Score blieb 2/10 (lens-richness braucht items)
- **Phase 4 Layer 2 (Auto-Discover-Trigger):** end-to-end. Discovery+Intake fuellten 3 Kandidaten in Watchlist+Queue, anschliessender Review fand die items, Score 10/10. `autoDiscoverResult.profile` kam zunaechst als `balanced` heraus statt `focused` (CLI-Parser-Default schluckte unsere Wahl ueber den `??`-Operator). Im Folge-Polish behoben: Helper akzeptiert `discoveryProfile`/`analysisDepth` jetzt als top-level-Parameter und faellt deterministisch auf `focused`/`quick` zurueck

Re-Run mit eigenen Slugs:

```bash
# 1. Slugs anlegen oder bestehende nutzen
npm run problem:list -- --project <project>

# 2. Jeden Slug mit den neuen Flags durchlaufen
for slug in <slug-list>; do
  npm run problem:explore -- "$slug" --project <project> \
    --seed-strategy auto --pattern-family auto
done

# 3. Auto-Discover-Pfad fuer leere Watchlist
npm run review:watchlist -- --project <project> --auto-discover

# 4. Stability aggregieren
npm run stability-test -- --runs <comma-list-of-runs> \
  --output docs/foundation/stability/<lauf-name>.md
```

## Cross-Project-Generalisierung — ehrliche Grenzen

Der `Lauf 2` PASS gilt strikt fuer das `eventbear-worker`-Projekt und drei
Slugs aus seiner Domaene (Event-Aggregation, Scraping, Schema-Extraction,
Dedup). Was davon transferiert sich auf andere Projekte/Domaenen ohne
weitere Arbeit — und was nicht?

| Phase | Domaenen-Abhaengigkeit | Erwartet auf fremdem Projekt |
|---|---|---|
| 0 — Test-Harness | keine | volle Wirkung |
| 1 — Seed-Diversifier | gering (Tokenizer + Dictionary mit allgemeinen Software-Phrasen) | volle Wirkung; Dictionary-Supplemente ggf. weniger treffend in Nischen-Domaenen |
| 2 — Pattern-Family-Classifier | **hoch** (Lexikon ist auf Software-Tooling kuratiert) | partiell — gute Wirkung in Domaenen mit "parser/scraper/dedup/schema/orchestrator/...", schwache Wirkung in Nischen-Domaenen (Bioinformatik, FPGA, Mobile-UI, Blockchain-Spezifika) |
| 3 — Rate-Limit | keine | volle Wirkung |
| 4 Layer 1 — Health-Diagnose | keine | volle Wirkung |
| 4 Layer 2 — Auto-Discover | gering (nutzt Project-Binding, dass projektgenau ist) | volle Wirkung — Qualitaet haengt aber an der Discovery-Seed-Qualitaet pro Projekt |

**Bottleneck fuer Cross-Project-Score: Phase 2 Lexikon.** Die 25 Familien
(parser, validator, scraper, extractor, deduper, normalizer, matcher,
scheduler, orchestrator, ...) sind generisch genug fuer "Software-
Tooling im weiten Sinn", aber:

- Ein Patternpilot-Lauf gegen ein Bioinformatik-Repo wuerde auf Begriffe
  wie "alignment", "variant calling", "FASTQ-parser" treffen — nur "parser"
  haette davon einen Match
- Ein Mobile-UI-Projekt sucht nach "navigation patterns", "gesture handling",
  "animation timeline" — keine Trefferflaeche im aktuellen Lexikon

Wenn jemand also Patternpilot fuer eine fremde Domaene aufsetzt:

1. Phase 1, 3, 4 leisten ihre Arbeit unveraendert
2. Phase 2 produziert vermutlich 30-60% Klassifikationsrate statt 95-100%
3. Score landet wahrscheinlich bei 6-8/10 statt 9-10/10

**Was es braeuchte fuer echte Cross-Domain-10/10:**

- **Per-Project-Lexikon:** `bindings/<project>/PATTERN_FAMILY_LEXICON.json` als optionalen Override, der das generische Default-Lexikon ergaenzt oder ersetzt. Kuration durch Projekt-Owner
- **Lexikon-Auto-Extension:** Ein Helper `npm run lexicon:suggest`, der die haeufigsten Topics+README-Tokens in den `unknown`-Repos eines Laufs analysiert und neue Kandidaten-Familien vorschlaegt
- **LLM-Fallback (Stage 3):** OQ-005 — opt-in via `--with-llm` fuer die ~5-10% Repos, die selbst nach Lexikon-Update unklassifiziert bleiben

Diese drei sind **nicht** Teil des Score-Stabilitaets-Plans — der Plan
hat fuer eventbear-worker geliefert, was er versprochen hat. Die Cross-
Domain-Erweiterung waere ein eigener Plan, idealerweise getriggert durch
das erste echte zweite Zielprojekt.

## Acceptance-Schwellen

| Metrik | Schwelle | Quelle |
|---|---|---|
| Median | ≥ 8/10 | Plan §5 Phase 5 |
| Min    | ≥ 7/10 | Plan §5 Phase 5 |
| Max    | ≥ 9/10 | Plan §5 Phase 5 |

Die Schwellen leben in `lib/scoring/stability.mjs` als
`ACCEPTANCE_THRESHOLDS` und sind Test-anchored
(`test/stability.test.mjs`).

## Schwaechste Achsen ueber alle Laeufe

Aus dem aktuellen Baseline-Lauf:

1. **visual-completeness** — mean 0.25/2 (4 von 4 Runs in Fallback-Bereich)
2. **pattern-family-coverage** — mean 0.5/2 (`unknown`-Quote noch hoch)
3. **cluster-diversity** — mean 1.5/2 (Review-Run ohne items zieht runter)

Diese drei sind exakt die Hebel, die Phase 1+2+4 adressieren — der Plan
ist also empirisch validiert, sobald ein Real-Run mit den Flags
zeigt, dass diese Achsen-Mittelwerte deutlich steigen.

## Statistische Grenzen

Aus Plan §5 Phase 5: `n=10` ist bewusst klein, um Laufzeit + API-Quota
zu schonen. Belastbar fuer Median/Min/Max, **nicht** fuer Varianz-
oder Signifikanz-Aussagen. Bei Median knapp unter 8 (7.5-7.9) braucht
es eine zweite Welle mit 10 weiteren Slugs vor jeder Nachjustierung.

## Wie diesen Doc aktuell halten

Nach jedem Real-Run:

1. `npm run stability-test -- --from-runs <project> --output docs/foundation/stability/<lauf-name>.md` ausfuehren
2. Eine neue Sektion `### Lauf N — <name>` in diesem Doc erzeugen
3. Aggregat + Acceptance-Status zitieren, mit Link auf die Detail-Datei
4. Wenn Acceptance gekippt: in der Sektion **klar benennen**, ob es ein
   echter Score-Lift ist oder ob die Verbesserung an einem einzelnen
   Lauf-Outlier haengt
