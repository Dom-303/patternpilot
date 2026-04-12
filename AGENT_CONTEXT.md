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
2. `docs/foundation/MISSION_VISION.md`
3. `docs/system/REPO_INTELLIGENCE_SYSTEM.md`
4. `docs/foundation/OPERATING_MODEL.md`
5. `patternpilot.config.json`
6. `projects/<project>/PROJECT_CONTEXT.md`
7. `projects/<project>/PROJECT_BINDING.md`

---

## Betriebsregeln

- `repo_landkarte.csv` ist kuratierter Wissensbestand, nicht rohe Intake-Ablage.
- Neue GitHub-Links gehen zuerst in `repo_intake_queue.csv` und in ein projektbezogenes Intake-Dossier.
- Auto-Guesses sind Hilfssignale, keine Wahrheit.
- Entscheidungen muessen am Zielprojekt rueckgebunden sein.
- Projektbindung nie implizit ueberschreiben: pro Analyse ist klar, fuer welches Projekt gearbeitet wird.
- Patternpilot soll den Worker staerken, nicht seinen Scope still aufblaehen.

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
