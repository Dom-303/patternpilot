# Operating Model

## Zweck

Dieses Dokument beschreibt, wie `patternpilot` von einem reinen Denkmodell zu einem operativen Motor wird.

---

## Kernbausteine

### 1. Zielprojektbindung

`patternpilot` arbeitet nie komplett abstrakt.
Es bindet sich bewusst an ein Zielprojekt ueber:

- `projects/<project>/PROJECT_CONTEXT.md`
- `projects/<project>/PROJECT_BINDING.md`
- `projects/<project>/PROJECT_BINDING.json`

Damit wird festgelegt:

- welches Repo Referenz ist
- welche Dateien zuerst gelesen werden sollen
- welche Verzeichnisse relevant sind
- welche Fragen Patternpilot beantworten soll

### 2. Intake statt Direktbewertung

Neue GitHub-Links werden nicht sofort in `repo_landkarte.csv` geschrieben.

Stattdessen entstehen:

- ein Queue-Eintrag in `repo_intake_queue.csv`
- ein Intake-Dossier unter `projects/<project>/intake/`
- ein Run-Protokoll unter `runs/<project>/<run-id>/`

Das trennt rohe Funde von kuratierter Repo-Intelligence.

### 3. Review-Promotion

Erst nach Review darf ein Fund aufsteigen in:

- `repo_landkarte.csv`
- `repo_learnings.md`
- `repo_decisions.md`

### 4. Projektwirksamer Output

Jeder Fund muss am Ende auf mindestens eine dieser Formen hinauslaufen:

- Schicht staerken
- Luecke benennen
- Entscheidung vorbereiten
- Folgearbeit ausloesen

---

## Der erste Motor

Der erste Motor in diesem Repo ist die CLI:

`npm run intake -- --project eventbear-worker <github-url>`

Sie macht heute schon:

- GitHub-URLs normalisieren
- Repo-Metadaten aus dem Link ableiten
- heuristische Erst-Einordnung erzeugen
- projektgebundene Intake-Dossiers anlegen
- Queue und Run-Artefakte schreiben

Sie macht bewusst noch nicht:

- GitHub remote crawlen
- Repo-Inhalte automatisch tief analysieren
- kuratierte Entscheidungen vollautomatisch finalisieren

---

## Output-Artefakte

### Queue

`repo_intake_queue.csv`

Der operative Eingang fuer neue Repos.

### Intake-Dossier

`projects/<project>/intake/<owner>__<repo>.md`

Die Arbeitsdatei fuer Review, Projektbezug und spaetere Promotion.

### Run-Protokoll

`runs/<project>/<run-id>/manifest.json`
`runs/<project>/<run-id>/summary.md`

Nachvollziehbarkeit fuer einzelne Intake-Laeufe.

---

## Plugin-Richtung

Die spaetere Plugin-/Erweiterungsform von `patternpilot` baut auf denselben Bausteinen auf:

- Projektbindung
- Intake-Queue
- kanonische Vokabulare
- projektbezogene Review- und Decision-Outputs

Dadurch kann Patternpilot kuenftig pro Repo oder Arbeitsbereich "andocken", ohne seine Kernlogik neu zu erfinden.
