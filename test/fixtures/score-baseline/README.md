# Score-Baseline Fixtures

Gefrorene JSON-Artefakte fuer den Phase-0-Scorer
(`lib/scoring/score-report.mjs`). Diese Fixtures sind die Referenz-Basis,
gegen die jede Phase-1-bis-4-Aenderung gemessen wird.

## Enthaltene Runs

| Fixture | Art | Quelle | Erwartete Score |
|---|---|---|---|
| `01-event-dedup-landscape` | Landscape | `projects/.../event-deduplication.../landscape/2026-04-24T20-15-36-247Z/` | 6/10 |
| `02-schema-extraction-landscape` | Landscape | `projects/.../schema-exact-extraction.../landscape/2026-04-24T20-15-54-490Z/` | 8/10 |
| `03-self-healing-landscape` | Landscape | `projects/.../self-healing-adaptive.../landscape/2026-04-24T20-16-00-772Z/` | 7/10 |
| `04-watchlist-review-empty` | Review | `runs/eventbear-worker/2026-04-24T20-15-11-309Z/` | 2/10 |

## Warum gefroren

Die Original-Runs unter `projects/` und `runs/` koennen durch spaetere
Runs ueberschrieben oder veraendert werden. Fixtures hier bleiben stabil,
damit Score-Deltas zwischen den Phasen beweisbar sind.

## Aufbau

Pro Fixture eine Datei:

- Landscape-Runs: `landscape.json` (vollstaendig, wie vom Landscape-Renderer erzeugt)
- Review-Runs: `manifest.json` (vollstaendig, aus `runs/<project>/<run-id>/`)

Der Scorer erkennt die Datei-Art automatisch.

## Aktualisieren

Fixtures werden **nicht** bei jeder Aenderung neu gezogen.
Wann ein Refresh berechtigt ist:

1. Wenn die Landscape-JSON-Schema-Version sich inkompatibel aendert
2. Wenn ein Scorer-Bug einen grundsaetzlich anderen Baseline-Wert produziert
3. Nach Abschluss aller Phasen als neuer "stabiler" Baseline-Stand

Refresh-Prozedur:
```bash
# aus dem entsprechenden Projekt-Run kopieren:
cp projects/.../landscape.json test/fixtures/score-baseline/<fixture>/landscape.json
# erwartete Score im Test (test/score-report.test.mjs) + README anpassen
node scripts/score-report.mjs --baseline --pretty
```

## Lizenz / Sensitivitaet

Die Fixtures enthalten nur oeffentliche GitHub-Metadaten
(Repo-URLs, Descriptions, READMEs, Topics, Stars). Keine Secrets,
keine Tokens, keine Nutzer-IDs.
