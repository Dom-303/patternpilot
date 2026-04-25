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

### Lauf 2 — Real-World mit Phase-1+2+4-Flags ✓ PASS

- **Datum:** 2026-04-25
- **Quelle:** [`stability/post-phase4-real-world.md`](stability/post-phase4-real-world.md)
- **Setup:** 3 bestehende Slugs neu durch `problem:explore` mit `--seed-strategy auto --pattern-family auto`, plus `review:watchlist --auto-discover` gegen leere Watchlist
- **Aggregat:** Median **10/10**, Min **9/10**, Max **10/10**, Mean **9.75/10**
- **Acceptance:** **PASS** (median 10 ≥ 8, min 9 ≥ 7, max 10 ≥ 9)

| Slug / Mode | Baseline | Phase 1+2+4 | Δ |
|---|---|---|---|
| event-deduplication-across-heterogenous-sources | 6/10 | **10/10** | **+4** |
| schema-exact-extraction-into-40-column-masterlist | 8/10 | **10/10** | **+2** |
| self-healing-adaptive-source-intake | 7/10 | **9/10** | **+2** |
| watchlist-review (mit --auto-discover) | 2/10 | **10/10** | **+8** |

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
