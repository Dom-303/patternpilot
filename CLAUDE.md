# CLAUDE.md

Diese Datei ist der knappe Einstiegspunkt fuer Claude Code in `patternpilot`.

## Erst lesen

@AGENT_CONTEXT.md
@STATUS.md
@OPEN_QUESTION.md
@docs/foundation/MISSION_VISION.md
@docs/system/REPO_INTELLIGENCE_SYSTEM.md

Wenn projektbezogen gearbeitet wird, zusaetzlich:

@projects/eventbear-worker/PROJECT_CONTEXT.md
@projects/eventbear-worker/PROJECT_BINDING.md

## Rolle von Patternpilot

- Intake von externen Repos strukturieren
- Muster und Risiken verdichten
- Entscheidungen fuer Zielprojekte vorbereiten
- keine Produktionslogik fuer EventBaer ersetzen

## Arbeitsstil

- Intake zuerst in Queue und Dossier, nicht direkt in die Landkarte
- Auto-Guesses sichtbar als vorlaeufig markieren
- jedes Ergebnis auf Projektwirkung herunterbrechen
- lieber wenige klare Entscheidungen als viel lose Sammlung
- `STATUS.md` und `OPEN_QUESTION.md` als Einstieg und Uebergabe immer mitlesen
- Monolithen nicht rein ueber LOC beurteilen: ab ca. 800 Zeilen bei substanziellen Touches auf Modul-Schnitt pruefen, nach Verantwortung splitten, neue Familien direkt als eigenes Modul anlegen — Details in `AGENT_CONTEXT.md`
