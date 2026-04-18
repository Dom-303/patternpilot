# Discovery D4 Closeout

## Ziel

Phase D4 sollte Discovery von einer rein heuristischen Suchschicht zu einer Suchschicht mit echtem Verlaufsgedaechtnis weiterziehen.

Nicht nur:

- Zielprojekt lesen
- Querys bauen
- Kandidaten ranken

sondern zusaetzlich:

- aus Promotions lernen
- aus Skip-/Ignore-Entscheidungen lernen
- Observe-only getrennt beruecksichtigen
- diese Rueckkopplung als lokales Projektwissen persistieren

## Umgesetzt

Discovery zieht jetzt echtes Projektfeedback aus `state/repo_intake_queue.csv`.

Neu hinzugekommen ist:

- `lib/discovery/feedback.mjs`
  - laedt Projektfeedback aus Queue-Historie
  - leitet `positive`, `negative`, `observe` und `pending` Outcomes ab
  - verdichtet daraus:
    - `preferredTerms`
    - `avoidTerms`
    - `preferredSignals`
    - `avoidSignals`
    - `queryFamilyOutcomes`
    - `feedbackStrength`
- persistente Snapshots unter:
  - `state/discovery_feedback/<project>.json`
  - `state/discovery_feedback/<project>.md`
- Discovery-Planung nutzt diese Signale jetzt aktiv:
  - positive Terms gehen sichtbar in Query-Anker ein
  - negative Terms gehen sichtbar in Anti-Noise-Terme ein
  - Query-Familien werden ueber vergangene Outcomes priorisiert
- Discovery-Ranking nutzt die Feedback-Schicht jetzt ebenfalls:
  - Kandidaten tragen `discoveryFeedbackMatch`
  - positives und negatives Verlaufssignal fliesst in Score und Reasoning ein
- Intake schreibt relevante Discovery-Metadaten jetzt in die Queue zurück:
  - Score
  - Class
  - Evidence Grade
  - Query Families / Labels
  - positive / negative Feedback-Hits

## Sichtbarer Effekt

Discovery zeigt jetzt nicht mehr nur einen statischen Projektkontext, sondern auch einen Verlaufskontext.

Im Referenzlauf war sichtbar:

- `feedback_positive_rows: 1`
- `feedback_negative_rows: 1`
- `feedback_observe_rows: 1`
- `feedback_strength: 0.3333333333333333`

und die Querys wurden dadurch sichtbar geschaerft, zum Beispiel:

- `calendar connector fetch -frontend ...`
- `calendar validation governance -frontend ...`

Statt rohem Verlaufsmuell landen diese Signale jetzt zusaetzlich lesbar in einem Snapshot:

- `state/discovery_feedback/sample-project.md`

## Verifiziert

Automatisch:

- `node --test test/discovery-feedback.test.mjs test/discovery-shared.test.mjs test/discovery.test.mjs test/discovery-import.test.mjs`
- `npm run release:smoke`

Praktischer Referenzlauf:

- isolierter Temp-Workspace
- echtes `bootstrap` gegen ein lokales Zielprojekt
- kontrollierte Queue-Historie mit:
  - einem positiven Fall
  - einem negativen Fall
  - einem Observe-Fall
- anschliessender echter `discover`-Run
- sichtbarer Feedback-Block in:
  - `summary.md`
  - `discovery-feedback.md`
  - `state/discovery_feedback/sample-project.md`

## Ergebnis

Phase D4 ist damit abgeschlossen.

Discovery lernt jetzt sichtbar aus echtem Verlauf, statt nur aus statischen Zielprojektsignalen.

## Bewusster Rest

Noch nicht geloest durch D4:

- systematische Erfolgsmetriken ueber alle Query-Familien und Runs hinweg
- explizite Sicht darauf, welche Query-Familien spaeter wirklich Promotions statt nur Research-Signale liefern
- eine kleine Discovery-Evaluationsoberflaeche fuer wiederholbare Vergleichslaeufe

Genau diese Punkte sind der naechste aktive Discovery-Block.
