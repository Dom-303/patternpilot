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

### Lauf 2 — Real-World mit Phase-1+2-Flags (offen)

Soll mit `--seed-strategy auto --pattern-family auto` gegen 10 frische
Problem-Slugs gefahren werden, davon mindestens einer mit leerer
Watchlist + `--auto-discover`. Erwartung: Median ≥ 8, alle Phasen
leisten den im Plan dokumentierten Lift.

Trigger:

```bash
# 1. 10 frische Slugs anlegen (Mix: 4 einfach, 3 mittel, 3 schwer)
for slug in <slug-list>; do
  npm run problem:create -- --slug "$slug" --project <project>
done

# 2. Jeden Slug mit den neuen Flags durchlaufen
for slug in <slug-list>; do
  npm run problem:explore -- "$slug" --project <project> \
    --seed-strategy auto --pattern-family auto
done

# 3. Auto-Discover-Pfad fuer mindestens einen Watchlist-Run pruefen
npm run review:watchlist -- --project <project> --auto-discover

# 4. Stability aggregieren
npm run stability-test -- --from-runs <project> \
  --output docs/foundation/stability/post-phase4-real-world.md
```

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
