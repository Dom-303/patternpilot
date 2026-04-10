Lege **kein** Patternpilot-Unterverzeichnis im EventBär-Repo an.

Arbeite stattdessen in einem **eigenen neuen Repo** unter diesem Pfad:

`D:\eventbaer\dev\patternpilot`

Zusätzlich soll dieser Datenpfad vorbereitet werden:

`D:\eventbaer\data\patternpilot`

Wichtig:
- Nichts in `D:\eventbaer\dev\eventbaer-worker` ändern
- Keine Dateien im EventBär-Repo anlegen, verschieben oder umbenennen
- Keine Dependencies hinzufügen
- Keine Git-Operationen ausführen, wenn nicht ausdrücklich nötig
- Nur den neuen Ordner `D:\eventbaer\dev\patternpilot` sauber aufsetzen
- `D:\eventbaer\data\patternpilot` nur als leeren Datenordner anlegen, falls er noch nicht existiert

## Aufgabe

Erstelle in `D:\eventbaer\dev\patternpilot` exakt diese Struktur:

- `README.md`
- `REPO_INTELLIGENCE_SYSTEM.md`
- `PATTERN_FAMILIES.md`
- `EVENTBAER_GAP_AREAS.md`
- `BUILD_VS_BORROW.md`
- `PRIORITY_FOR_REVIEW.md`
- `repo_landkarte.csv`
- `repo_learnings.md`
- `repo_decisions.md`
- `distribution_surfaces.md`
- `controlled_vocabulary_pattern_families.csv`
- `controlled_vocabulary_eventbaer_gap_areas.csv`
- `controlled_vocabulary_build_vs_borrow.csv`
- `controlled_vocabulary_priority_for_review.csv`
- `projects/eventbear-worker/PROJECT_CONTEXT.md`
- `projects/eventbear-worker/project_notes.md`
- `prompts/CLAUDE_VSCODE_SETUP_PROMPT.md`
- `prompts/repo_intake_prompt.md`
- `prompts/repo_review_prompt.md`
- `prompts/pattern_extraction_prompt.md`

## Regeln

- Nur diese Dateien erzeugen
- Keine zusätzlichen Dateien
- Keine Refactors außerhalb dieses neuen Repos
- `repo_landkarte.csv` mit Semikolon `;` als Trenner schreiben
- Inhalte exakt aus dem gelieferten Paket übernehmen
- `repo_landkarte.csv` als Seed-Stand behandeln, nicht als abgeschlossene Wahrheit

## Abschluss

Gib am Ende nur kurz aus:
- welche Dateien angelegt wurden
- ob der Datenordner existiert
- ob irgendetwas vom Soll abwich
