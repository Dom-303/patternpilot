# AGENT_CONTEXT.md

## Zweck

Diese Datei ist der operative Startkontext fuer Agenten, die in `patternpilot` arbeiten.

`patternpilot` ist kein Bookmark-Ablageort und kein zweites Zielprojekt-Repo.
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
4. `docs/foundation/OPERATING_MODEL.md`
5. `docs/foundation/V1_STATUS.md`
6. `docs/system/REPO_INTELLIGENCE_SYSTEM.md`
7. `docs/reference/REPORT_OUTPUT_MODEL.md`
8. `docs/reference/REPORT_UI_FRAMEWORK.md`
9. `patternpilot.config.json`
10. `projects/<project>/PROJECT_CONTEXT.md`
11. `projects/<project>/PROJECT_BINDING.md`

---

## Betriebsregeln

- **HTML-Report-Templates sind strukturell eingefroren** (Stand commit 22f6587, 24.04.2026): `lib/landscape/html-report.mjs` + `lib/html-renderer.mjs`. Erlaubt: inhaltliche Qualitaet, Bugfixes, neue Daten-Builder. Nicht erlaubt ohne User-Freigabe: Section-Reihenfolge umbauen, Renderer-Helper austauschen, Nav-Label-Konvention aendern, max-2-Col-Grundregel aufweichen. Details in den Datei-Kopfkommentaren.
- Patternpilot muss auf allen drei Haupt-Betriebssystemen laufen: macOS, Linux und Windows (inkl. WSL). Keine Shell-spezifischen Aufrufe in npm-Scripts, Pfade immer ueber `path.*`, keine harten POSIX- oder Windows-Separatoren im Code.
- `knowledge/repo_landkarte.csv` ist kuratierter Wissensbestand, nicht rohe Intake-Ablage.
- Neue GitHub-Links gehen zuerst in `state/repo_intake_queue.csv` und in ein projektbezogenes Intake-Dossier.
- Auto-Guesses sind Hilfssignale, keine Wahrheit.
- Entscheidungen muessen am Zielprojekt rueckgebunden sein.
- Projektbindung nie implizit ueberschreiben: pro Analyse ist klar, fuer welches Projekt gearbeitet wird.
- Patternpilot soll den Worker staerken, nicht seinen Scope still aufblaehen.
- Repo-Kontext ist laufbezogen: Patternpilot liest die konfigurierten Kontextquellen eines Zielrepos, verankert aber keine harte Projektidentitaet in seinem Produktkern.
- Projekt-Alignment ist verpflichtender Teil ab Stage 3, wenn ein Zielprojekt Bindings und Alignment-Regeln hat.
- `STATUS.md` und `OPEN_QUESTION.md` sind die operative Uebergabeschicht fuer den naechsten Agenten und muessen aktuell bleiben.
- `knowledge/repo_decisions.md` gehoert zur kuratierten Wissensschicht und nicht neben `STATUS.md` / `OPEN_QUESTION.md`.
- menschenfreundliche HTML-Reports sind verbindlicher Teil der Output-Schicht, nicht nur nettes Beiwerk.

## Modul- und Monolith-Regel

Monolithisches Wachstum ist normal, aber nicht unbegrenzt fortzufuehren.

- Zeilenzahl ist nur ein Warnsignal, kein Selbstzweck. Richtwert: ab ca. 800 Zeilen bei einem substanziellen Touch Modul-Schnitt pruefen.
- Massgeblich ist fachliche Verantwortung: Splitten, wenn eine Datei mehrere getrennte Aufgaben, Familien, Flows oder wiederholt getrennte Aenderungszonen vereint.
- Mini-Fixes erzwingen keinen begleitenden Split. Strukturarbeit folgt dem naechsten substanziellen Touch, nicht jedem Einzeiler.
- Neue fachliche Familien oder eigenstaendige Flows von Anfang an als eigenes Modul anlegen und nur zentral verdrahten.
- Splits folgen bestehenden Repo-Patterns, keine ad-hoc Sonderstruktur pro Datei.

---

## Standardfluss fuer neue GitHub-Links

1. `npm run intake -- --project <project> <github-url> [weitere URLs]`
2. Queue-Eintrag und Intake-Dossier erzeugen
3. GitHub-Metadaten und README anreichern
4. Dossier gegen Projektkontext und Referenz-Repo lesen
5. Nur nach Review in `knowledge/repo_landkarte.csv`, `knowledge/repo_learnings.md` oder `knowledge/repo_decisions.md` ueberfuehren

---

## Guardrails

- Keine unbewerteten Intake-Eintraege als kuratierte Learnings ausgeben.
- Keine Projektrelevanz behaupten, ohne sie gegen den Projektkontext zu begruenden.
- Keine Repo-Bewertung nur auf Stars oder Eindruck stuetzen.
- Keine Vermischung von Intake-Rohdaten und kanonischen Entscheidungen.
