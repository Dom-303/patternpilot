# AGENT_CONTEXT.md

## Zweck

Diese Datei ist der operative Startkontext fuer Agenten, die in `patternpilot` arbeiten.

`patternpilot` ist kein Bookmark-Ablageort und kein zweites EventBaer-Worker-Repo.
Es ist die Intelligence- und Entscheidungs-Schicht zwischen externen GitHub-Funden und konkreten Konsequenzen fuer ein Zielprojekt.

---

## Mission in einem Satz

Aus externen Repos, Tools und Produktmustern belastbare Entscheidungen und umsetzbare Stoerke fuer ein Zielprojekt machen.

---

## Autoritative Dateien

Diese Dateien in dieser Reihenfolge zuerst lesen:

1. `README.md`
2. `STATUS.md`
3. `OPEN_QUESTION.md`
4. `docs/foundation/MISSION_VISION.md`
5. `docs/system/REPO_INTELLIGENCE_SYSTEM.md`
6. `docs/foundation/OPERATING_MODEL.md`
7. `docs/reference/REPORT_OUTPUT_MODEL.md`
8. `docs/reference/REPORT_UI_FRAMEWORK.md`
9. `patternpilot.config.json`
10. `projects/<project>/PROJECT_CONTEXT.md`
11. `projects/<project>/PROJECT_BINDING.md`

---

## Betriebsregeln

- `repo_landkarte.csv` ist kuratierter Wissensbestand, nicht rohe Intake-Ablage.
- Neue GitHub-Links gehen zuerst in `repo_intake_queue.csv` und in ein projektbezogenes Intake-Dossier.
- Auto-Guesses sind Hilfssignale, keine Wahrheit.
- Entscheidungen muessen am Zielprojekt rueckgebunden sein.
- Projektbindung nie implizit ueberschreiben: pro Analyse ist klar, fuer welches Projekt gearbeitet wird.
- Patternpilot soll den Worker staerken, nicht seinen Scope still aufblaehen.
- Repo-Kontext ist laufbezogen: Patternpilot liest die konfigurierten Kontextquellen eines Zielrepos, verankert aber keine harte Projektidentitaet in seinem Produktkern.
- Projekt-Alignment ist verpflichtender Teil ab Stage 3, wenn ein Zielprojekt Bindings und Alignment-Regeln hat.
- `STATUS.md` und `OPEN_QUESTION.md` sind die operative Uebergabeschicht fuer den naechsten Agenten und muessen aktuell bleiben.
- menschenfreundliche HTML-Reports sind verbindlicher Teil der Output-Schicht, nicht nur nettes Beiwerk.

---

## Standardfluss fuer neue GitHub-Links

1. `npm run intake -- --project <project> <github-url> [weitere URLs]`
2. Queue-Eintrag und Intake-Dossier erzeugen
3. GitHub-Metadaten und README anreichern
4. Dossier gegen Projektkontext und Referenz-Repo lesen
5. Nur nach Review in `repo_landkarte.csv`, `repo_learnings.md` oder `repo_decisions.md` ueberfuehren

---

## Guardrails

- Keine unbewerteten Intake-Eintraege als kuratierte Learnings ausgeben.
- Keine Projektrelevanz behaupten, ohne sie gegen den Projektkontext zu begruenden.
- Keine Repo-Bewertung nur auf Stars oder Eindruck stuetzen.
- Keine Vermischung von Intake-Rohdaten und kanonischen Entscheidungen.
