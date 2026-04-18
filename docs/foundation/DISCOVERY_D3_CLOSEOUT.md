# Discovery D3 Closeout

## Ziel

Phase D3 sollte aus den gefundenen Repos nicht nur eine Reihenfolge, sondern eine belastbarere Priorisierung machen.

Nicht nur:

- Treffer finden
- auf Discovery-Score sortieren

sondern:

- Evidenz staerker sichtbar machen
- Top-Treffer besser begruenden
- Kandidaten klarer trennen in:
  - Fit-Kandidat
  - Research-Signal
  - Boundary-Signal
  - Risk-Signal

## Umgesetzt

Discovery-Kandidaten tragen jetzt zusaetzlich:

- `discoveryEvidence`
  - Score
  - Grade
  - Keyword-, Topic- und README-Hits
  - Metadatastaerke
  - Query-Family-Breite
- `discoveryClass`
  - `fit_candidate`
  - `research_signal`
  - `boundary_signal`
  - `risk_signal`
  - `weak_signal`

Die Discovery-Bewertung gewichtet jetzt staerker:

- Projekt-Fit
- Capability-Matches
- Query-Family-Diversitaet
- Topic-/README-/Keyword-Evidenz
- Metadatastaerke
- Aktivitaet und Repo-Reife

und bestraft bewusster:

- Forks
- Archive
- Spannungen zum Zielprojekt
- fehlende README-Evidenz
- fehlende Enrichment-Qualitaet

## Sichtbarer Effekt

Die Kandidaten-Outputs zeigen jetzt nicht mehr nur:

- `score`
- `fit`
- `disposition`

sondern auch:

- `evidence`
- `class`

Dadurch wird schneller sichtbar, ob ein Repo ein echter Top-Kandidat ist oder eher nur ein Rand- oder Risikosignal.

## Verifiziert

Automatisch:

- `node --test test/discovery.test.mjs test/discovery-shared.test.mjs test/project-profile.test.mjs`
- `npm run release:smoke`

Praktischer Referenzlauf:

- importierter D3-Referenzlauf mit einem High-Fit- und einem Boundary-Kandidaten
- dabei sichtbare Summary mit `evidence=` und `class=`

## Ergebnis

Phase D3 ist damit abgeschlossen.

Discovery priorisiert jetzt nicht nur haerter, sondern erklaert auch besser, warum ein Kandidat oben oder unten landet.

## Bewusster Rest

Noch nicht geloest durch D3:

- Lernen aus Promotions und Rejections
- Query- und Candidate-Feedback als Verlaufssignal
- sichtbare Erfolgsmetriken pro Query-Familie

Genau diese Punkte sind der naechste aktive Discovery-Block.
