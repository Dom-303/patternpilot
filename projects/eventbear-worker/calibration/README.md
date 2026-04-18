# Eventbear Worker Calibration Notes

Diese Datei ist der feste Anker fuer die laufende Discovery-Kalibrierung des Projekts `eventbear-worker`.

Sie soll bewusst kurz bleiben und nur festhalten:

- welche Kalibrierungs-Tools vorhanden sind
- wie der aktuelle Stand aussieht
- welcher naechste echte Schleifenschritt sinnvoll ist

Die datierten Unterordner unter `calibration/` sind erzeugte Laufartefakte fuer Workbench, Trial, Handoff und Apply. Der feste, versionierbare Teil hier sind die Top-Level-Notizen und Beispiel-/Policy-Dateien, nicht die einzelnen Run-Snapshots.

## Aktueller Stand

- Phase im Masterplan: `Phase 1 — Real Discovery Calibration`
- Discovery-Policy-Datei: `projects/eventbear-worker/DISCOVERY_POLICY.json`
- verfuegbare Kalibrierungs-Commands:
  - `npm run policy:audit -- --project eventbear-worker --dry-run`
  - `npm run policy:review -- --project eventbear-worker`
  - `npm run policy:calibrate -- --project eventbear-worker`
  - `npm run policy:compare -- --project eventbear-worker --policy-file <json>`
  - `npm run policy:pack -- --project eventbear-worker --policy-file <json>`
  - `npm run policy:workbench-review -- --project eventbear-worker`
  - `npm run policy:suggest -- --project eventbear-worker`
  - `npm run policy:cycle -- --project eventbear-worker`
  - `npm run policy:handoff -- --project eventbear-worker`
  - `npm run policy:curate -- --project eventbear-worker --prepare-promotions`
  - `npm run policy:curation-review -- --project eventbear-worker --limit 1`
  - `npm run policy:curation-batch-review -- --project eventbear-worker --limit 2`
  - `npm run policy:curation-batch-plan -- --project eventbear-worker --limit 3`
  - `npm run policy:curation-batch-apply -- --project eventbear-worker --limit 2`
  - `npm run policy:curation-apply -- --project eventbear-worker --limit 1`
  - `npm run policy:trial -- --project eventbear-worker`
  - `npm run policy:apply -- --project eventbear-worker --workbench-dir <dir>`

## Was schon steht

- Discovery-Gates laufen direkt im Discovery-Pfad
- `policy-audit` zeigt pro Lauf Policy-Flagging, Top-Blocker und Tuning-Hinweise
- `policy-review` kann gespeicherte Discovery-Runs nachtraeglich gegen die aktuelle Policy spiegeln
- `policy-calibrate` fasst mehrere gespeicherte Discovery-Runs zu einer Projekt-Sicht zusammen
- `policy-compare` zeigt, wie sich eine alternative Policy-Datei gegen dieselben gespeicherten Runs auswirken wuerde
- `policy-pack` schreibt einen gebuendelten Kalibrierungs-Arbeitsstand mit Snapshot, Mehrlauf-Sicht und optionalem Policy-Vergleich
- `discover-import` kann eine manuell kuratierte Kandidatenliste als echten Discovery-Run schreiben
- `policy-workbench` erzeugt daraus eine Candidate-Level-Arbeitsflaeche mit `proposed-policy.json`
- `policy-workbench-review` fasst manuelle Verdikte plus Proposed-Policy-Wirkung zusammen
- `policy-suggest` erzeugt eine erste `suggested-policy.json` direkt aus Workbench-Signalen und spiegelt die Wirkung auf den Source-Run
- `policy-cycle` schliesst `review -> suggest -> trial -> replay` zu einem gebuendelten Kalibrierungslauf zusammen und kann die wirksame Policy optional direkt anwenden
- `policy-handoff` nimmt die sichtbar gewordenen Cycle-Kandidaten und schiebt sie direkt in den normalen `on-demand` Intake-/Review-Pfad
- der Handoff kann dabei Replay-Kandidaten direkt als Intake-Seed verwenden, damit starke importierte Signale im echten Review-Pfad nicht sofort wieder verarmen
- `policy-curate` rankt die Handoff-Kandidaten fuer die eigentliche Kurationsarbeit und kann direkt Promotion-Pakete vorbereiten
- `policy-curation-review` previewt die kanonischen Wissensberuehrungen eines Curation-Runs
- `policy-curation-batch-review` macht daraus eine Batch-Sicht mit Overlap, Skip-fuer-schon-promoted und einer klaren Apply-Menge
- `policy-curation-batch-plan` trennt dabei sichere Teil-Batches von echten Manual-Review-Faellen
- `policy-curation-batch-apply` fuehrt standardmaessig genau diese sichere Batch-Menge kontrolliert in `promote --apply`
- `policy-curation-apply` fuehrt daraus einen kontrollierten Apply-Lauf gegen Landkarte, Learnings und Decisions aus
- `policy-trial` spielt eine Trial-Policy gegen denselben Source-Run durch und zeigt `newly_visible` versus `newly_hidden`
- `policy-apply` kann eine vorgeschlagene Policy mit History-Snapshots sicher auf das Projekt zurueckschreiben
- Discovery-Manifeste koennen jetzt die volle policy-evaluated Kandidatenmenge behalten, auch wenn `enforce` am Ende nichts sichtbar laesst

## Aktueller Engpass

Die aktuell gespeicherten Discovery-Runs fuer `eventbear-worker` enthalten noch keine echten Kandidaten.

Das bedeutet:

- die Kalibrierungs-Mechanik ist da
- die inhaltliche Policy-Schaerfung ist vorbereitet
- die eigentliche Justierung braucht jetzt echte Discovery-Treffer oder zumindest bewusst kuratierte Kandidaten-Snapshots

## Naechste Schleife

1. echte Discovery-Runs mit realen Treffern fahren oder einen importierten Kandidaten-Seed bauen
2. dieselben Runs mit `policy-audit` spiegeln
3. bei Bedarf `policy-workbench` schreiben und `proposed-policy.json` gezielt anpassen
4. danach `policy-cycle` laufen lassen, um Suggestion, Trial und Replay als einen gemeinsamen Arbeitsstand zu sehen
5. mit `policy-handoff` die `newly_visible` Kandidaten direkt in den normalen On-Demand-Review-Pfad schicken
6. mit `policy-curate` die besten Handoff-Kandidaten fuer Promotion, Learnings und Decisions vorsortieren
7. vorhandene Discovery-Artefakte mit `policy-review`, `policy-calibrate`, `policy-compare` und `policy-pack` gegen den aktuellen Policy-Stand pruefen
8. danach `DISCOVERY_POLICY.json` bewusst enger oder weicher ziehen

## Kalibrierungsregel

Policy-Werte nicht nach einzelnen Zufallstreffern umbauen.

Erst dann nachjustieren, wenn sich ein Muster ueber mehrere reale Runs wiederholt, zum Beispiel:

- derselbe Blocker-Typ taucht haeufig auf
- brauchbare Kandidaten werden zu hart versteckt
- zu viele schwache Treffer bleiben trotz Policy sichtbar
