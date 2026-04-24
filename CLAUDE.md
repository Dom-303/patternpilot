# CLAUDE.md

Diese Datei ist der knappe Einstiegspunkt fuer Claude Code in `patternpilot`.

## Erst lesen

@AGENT_CONTEXT.md
@STATUS.md
@OPEN_QUESTION.md
@docs/foundation/OPERATING_MODEL.md
@docs/foundation/V1_STATUS.md
@docs/system/REPO_INTELLIGENCE_SYSTEM.md

Wenn projektbezogen gearbeitet wird, zusaetzlich die Dateien des aktiven Zielprojekts lesen:

- `projects/<project>/PROJECT_CONTEXT.md`
- `bindings/<project>/PROJECT_BINDING.json`

## Rolle von Patternpilot

- Intake von externen Repos strukturieren
- Muster und Risiken verdichten
- Entscheidungen fuer Zielprojekte vorbereiten
- keine Produktionslogik eines Zielprojekts ersetzen

## Arbeitsstil

- **HTML-Report-Templates eingefroren** (Landscape + Discovery/Review/On-Demand): Struktur, Section-Reihenfolge, Nav-Labels, max-2-Col-Regel sind fix. Siehe Kopfkommentare in `lib/landscape/html-report.mjs` und `lib/html-renderer.mjs`. Nur Inhaltsqualitaet + Bugfixes ohne Rueckfrage aendern.
- Patternpilot laeuft auf macOS, Linux und Windows (inkl. WSL). Keine Shell-spezifischen Kommandos in npm-Scripts oder Code, Pfade immer ueber `path.*`, damit die Cross-Platform-Garantie nicht bricht.
- Intake zuerst in Queue und Dossier, nicht direkt in die Landkarte
- Auto-Guesses sichtbar als vorlaeufig markieren
- jedes Ergebnis auf Projektwirkung herunterbrechen
- lieber wenige klare Entscheidungen als viel lose Sammlung
- `STATUS.md` und `OPEN_QUESTION.md` als Einstieg und Uebergabe immer mitlesen
- Monolithen nicht rein ueber LOC beurteilen: ab ca. 800 Zeilen bei substanziellen Touches auf Modul-Schnitt pruefen, nach Verantwortung splitten, neue Familien direkt als eigenes Modul anlegen — Details in `AGENT_CONTEXT.md`
