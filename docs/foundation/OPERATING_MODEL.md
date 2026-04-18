# Operating Model

## Zweck

Dieses Dokument beschreibt, wie `patternpilot` von einem reinen Denkmodell zu einem operativen Motor wird.

---

## Kernbausteine

### 1. Zielprojektbindung

`patternpilot` arbeitet nie komplett abstrakt.
Es bindet sich bewusst an ein Zielprojekt ueber:

- `bindings/<project>/PROJECT_BINDING.md`
- `bindings/<project>/PROJECT_BINDING.json`
- `projects/<project>/PROJECT_CONTEXT.md`

Damit wird festgelegt:

- welches Repo Referenz ist
- welche Dateien zuerst gelesen werden sollen
- welche Verzeichnisse relevant sind
- welche Fragen Patternpilot beantworten soll

Wichtig fuer die Produktlogik:

- `bindings/` enthaelt die technische Zielrepo-Anbindung
- `projects/` ist der lesbare Arbeits- und Ergebnisraum fuer gebundene Zielrepos, nicht der Produktkern von `patternpilot`
- neue Unterordner unter `projects/<project>/` koennen lokal per `init:project` entstehen
- ein mitgelieferter Fall wie `bindings/eventbear-worker/` plus `projects/eventbear-worker/` ist ein Dogfood-Setup, kein Beweis fuer harte Produktkopplung

### 2. Intake statt Direktbewertung

Neue GitHub-Links werden nicht sofort in `knowledge/repo_landkarte.csv` geschrieben.

Stattdessen entstehen:

- ein Queue-Eintrag in `state/repo_intake_queue.csv`
- ein Intake-Dossier unter `projects/<project>/intake/`
- ein Run-Protokoll unter `runs/<project>/<run-id>/`

Das trennt rohe Funde von kuratierter Repo-Intelligence.

### 3. Review-Promotion

Erst nach Review darf ein Fund aufsteigen in:

- `knowledge/repo_landkarte.csv`
- `knowledge/repo_learnings.md`
- `knowledge/repo_decisions.md`

### 3.1 Canonical Repo Handling im Pilotbetrieb

Im Realbetrieb gilt fuer GitHub-Repos zunaechst eine konservative Regel:

- Case-only-Varianten derselben URL duerfen in Queue und Intake zusammengefuehrt werden.
- Owner-Rename-, Redirect- oder Alias-Faelle werden nicht blind automatisch gemergt.
- Wenn bereits ein promovierter kanonischer Datensatz existiert und spaeter eine neue Owner-Variante auftaucht, bleibt der vorhandene kuratierte Datensatz massgeblich.
- Neue Pilot-Artefakte duerfen als Evidenz stehenbleiben, aber ein frischer Queue-Duplikatfall soll aus dem Live-State wieder entfernt werden, bis eine verlaessliche Canonical-Resolution existiert.

Diese Regel schuetzt die kuratierte Wissensschicht davor, im Pilotbetrieb unterschiedliche Owner-Slugs heuristisch zu frueh als identisch zu behandeln.

### 4. Projektwirksamer Output

Jeder Fund muss am Ende auf mindestens eine dieser Formen hinauslaufen:

- Schicht staerken
- Luecke benennen
- Entscheidung vorbereiten
- Folgearbeit ausloesen

---

## Der erste Motor

Der erste Motor in diesem Repo ist die CLI:

`npm run intake -- --project <project> <github-url>`

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

Ein frisches Zielprojekt entsteht zuerst ueber:

`npm run init:project -- --project sample-worker --target ../sample-worker --label "Sample Worker"`

Danach ist `projects/sample-worker/` Teil des lokalen Patternpilot-Workspace.

---

## Output-Artefakte

### Queue

`state/repo_intake_queue.csv`

Der operative Eingang fuer neue Repos.

### Intake-Dossier

`projects/<project>/intake/<owner>__<repo>.md`

Die Arbeitsdatei fuer Review, Projektbezug und spaetere Promotion.

### Run-Protokoll

`runs/<project>/<run-id>/manifest.json`
`runs/<project>/<run-id>/summary.md`
`runs/<project>/<run-id>/summary.html`

Nachvollziehbarkeit fuer einzelne Intake-Laeufe.

### HTML-Reports

`projects/<project>/reports/*.html`

Die menschenfreundliche Schicht fuer Discovery- und Vergleichslaeufe.
Sie soll auch bei groesseren Repo-Mengen schnell zeigen:

- welche Repos oben rauskommen
- warum sie relevant sind
- was daraus uebernommen werden koennte
- welche Risiken oder Spannungen sichtbar sind
- welche naechsten Schritte jetzt wirklich Sinn machen

### Uebergabe- und Einstiegsschicht

`STATUS.md`
`OPEN_QUESTION.md`

Diese beiden Dateien bilden die operative Uebergabe fuer neue Agenten und spaetere Sessions.

Sie sollen sichtbar halten:

- wo Patternpilot aktuell steht
- was der letzte sinnvolle Einstiegspunkt ist
- welche Fragen wirklich noch offen sind

Sie sind bewusst lokale, generierte Arbeitsdateien und keine versionierten Produktartefakte.

---

## Plugin-Richtung

Die spaetere Plugin-/Erweiterungsform von `patternpilot` baut auf denselben Bausteinen auf:

- Projektbindung
- Intake-Queue
- kanonische Vokabulare
- projektbezogene Review- und Decision-Outputs

Dadurch kann Patternpilot kuenftig pro Repo oder Arbeitsbereich "andocken", ohne seine Kernlogik neu zu erfinden.
