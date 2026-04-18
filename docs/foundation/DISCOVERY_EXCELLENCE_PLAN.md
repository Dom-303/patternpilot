# Discovery Excellence Plan

## Zweck

Der Produktkern von `patternpilot` ist jetzt ausgereift.
Die naechste echte Qualitaetsstufe liegt nicht mehr im Grundfluss, sondern in der Discovery-Schicht:

- bessere Suchqualitaet
- bessere Query-Schaerfe
- bessere Kandidaten-Priorisierung
- weniger Noise
- mehr echte Treffer mit Produktwert

Dieses Dokument ist der aktive Ausbauplan fuer genau diese Schicht.

## Aktueller Stand

- Phase D1 — Corpus Upgrade: abgeschlossen
- Phase D2 — Query Engineering: abgeschlossen
- Phase D3 — Ranking Upgrade: abgeschlossen
- Phase D4 — Feedback Loop: abgeschlossen
- Naechster aktiver Block: Phase D5 — Discovery Evaluation
- Referenzbeleg fuer D1: [DISCOVERY_D1_CLOSEOUT.md](DISCOVERY_D1_CLOSEOUT.md)
- Referenzbeleg fuer D2: [DISCOVERY_D2_CLOSEOUT.md](DISCOVERY_D2_CLOSEOUT.md)
- Referenzbeleg fuer D3: [DISCOVERY_D3_CLOSEOUT.md](DISCOVERY_D3_CLOSEOUT.md)
- Referenzbeleg fuer D4: [DISCOVERY_D4_CLOSEOUT.md](DISCOVERY_D4_CLOSEOUT.md)

## Was Discovery heute schon kann

Die aktuelle Discovery ist bereits **projektkontextbasiert**.

Sie arbeitet heute so:

1. Zielprojekt lesen
   - `PROJECT_BINDING.json`
   - `ALIGNMENT_RULES.json`
   - `analysisQuestions`
   - `discoveryHints`
   - Referenzdateien aus `readBeforeAnalysis`
   - Verzeichnisstruktur aus `referenceDirectories`
   - `projectProfile.corpus`
2. daraus mehrere Suchlensen bauen
   - breiter Projekt-Scan
   - capability-bezogene Queries
   - optional manueller Query-Boost
3. GitHub Search ausfuehren
4. bekannte Repos deduplizieren
   - Queue
   - Watchlist
   - Landkarte
5. Treffer anreichern
   - Repo-Metadaten
   - README-Exzerpt
   - Sprachen
6. Treffer klassifizieren und gegen das Zielprojekt abgleichen
7. Discovery-Score und Disposition ableiten

Kurz:

- Ja, Discovery ist schon kontextbasiert.
- Nein, sie ist noch nicht auf ihrem bestmoeglichen professionellen Niveau.

## Wo die groessten heutigen Grenzen liegen

### 1. Der Zielprojekt-Korpus ist noch zu flach

Die Suche nutzt schon Binding, Rules und Project Profile.
Aber sie zieht noch nicht systematisch genug:

- technische Kernbegriffe
- Bibliotheks- und Paketnamen
- API- und Adapter-Begriffe
- Datenmodell-Begriffe
- Workflow- und Governance-Begriffe
- negative Signale

### 2. Die Suche lernt noch zu wenig aus echten Entscheidungen

Heute ist die Discovery stark heuristisch, aber noch kaum verlaufsbasiert.

Sie sollte staerker auswerten:

- was promoted wurde
- was rejected wurde
- was nur beobachtet wurde
- welche Query-Familien spaeter wirklich gute Kandidaten geliefert haben

### 3. Das Reranking ist noch nicht stark genug

GitHub Search ist nur der Rohinput.
Die eigentliche Produktqualitaet entsteht im Ranking danach.

Hier fehlt noch mehr Staerke in:

- semantischer Naehe zum Zielprojekt
- Pattern-Family-Passung
- Architektur- und Layer-Aehnlichkeit
- negativen Ausschlusskriterien
- Relevanz gegen echte Projektluecken

### 4. Query-Qualitaet wird noch zu wenig gemessen

Noch fehlt ein klarer Blick darauf:

- welche Query hat gute Kandidaten gebracht
- welche Query war zu noisy
- welche Query-Familie liefert spaeter Promotions statt nur Watch-only-Faelle

## Zielbild

Discovery soll sich am Ende nicht mehr wie “gute Heuristik” anfuehlen, sondern wie eine **belastbare Repo-Suchoberflaeche mit echter Projektschaerfe**.

Das heisst konkret:

- mehr relevante Kandidaten
- weniger unpassende Treffer
- klarere Erklaerung, warum ein Repo gesucht und vorgeschlagen wurde
- bessere Wiederholbarkeit ueber verschiedene Projekte hinweg
- spaetere echte Lernfaehigkeit aus Promotions und Rejections

## Die Fuenf Ausbauachsen

## 1. Zielprojekt-Korpus professionalisieren

### Ziel

Die Suchbasis fuer jedes Projekt soll deutlich reicher und technischer werden.

### Konkrete Arbeit

- Project Profile staerker aus Code- und Strukturhinweisen fuettern
- Bibliotheks- und Paketnamen aus dem Zielrepo extrahieren
- Layer-/Capability-/Data-Model-Signale besser aufbereiten
- negative Begriffe und Ausschlusswoerter je Projekt ergaenzen

### Ergebnis

Die Query-Basis wird schaerfer, ohne dass der Nutzer alles haendisch pflegen muss.

## 2. Query-Familien ausbauen

### Ziel

Nicht nur “breite Keywords”, sondern mehrere professionelle Suchlinien.

### Konkrete Arbeit

- capability-basierte Queries ausbauen
- Layer-/Pattern-Family-Queries ergaenzen
- negative Filter und Anti-Noise-Queries einfuehren
- Query-Templates je Projekttyp vorbereiten

### Ergebnis

Die Suche wird vielseitiger und liefert weniger gleichfoermiges Rauschen.

## 3. Reranking und Evidenz verbessern

### Ziel

Treffer sollen nicht nur gefunden, sondern besser eingeordnet werden.

### Konkrete Arbeit

- Discovery-Score staerker auf Zielprojektnaehe trimmen
- mehr Evidenz aus README, Topics, Sprache, Aktivitaet und Repo-Struktur ziehen
- staerkere Trennung zwischen:
  - echter Fit-Kandidat
  - Research-Signal
  - Boundary- oder Risk-Signal
- spaeter optional: semantisches Reranking / Embeddings / LLM-Briefing

### Ergebnis

Die Top-Treffer werden spuerbar brauchbarer.

## 4. Feedback-Schleife aus echten Entscheidungen

### Ziel

Discovery soll aus dem operativen Verlauf lernen.

### Konkrete Arbeit

- Promotions als positives Signal verwerten
- Rejections und Skip-Entscheidungen als negative Signale verwerten
- Watch-only-Items getrennt analysieren
- Query- und Candidate-Feedback als Projektwissen speichern

### Ergebnis

Die Suche wird mit echter Nutzung besser statt nur mit neuen Regeln.

## 5. Messbarkeit und Evaluationsoberflaeche

### Ziel

Discovery-Qualitaet soll sichtbar und testbar werden.

### Konkrete Arbeit

- Query-Familien mit Erfolgsraten auswerten
- pro Discovery-Run die besten und noisigsten Querys markieren
- spaeter eine kleine Discovery-Evaluationssuite mit Referenzprojekten pflegen

### Ergebnis

Discovery wird nicht mehr nach Bauchgefuehl, sondern nach realem Output verbessert.

## Ausfuehrungsphasen

## Phase D1 — Corpus Upgrade

- Zielprojekt-Signale breiter und technischer einsammeln
- Project Profile als echten Discovery-Input schaerfen
- Status: abgeschlossen

Exit:

- Discovery arbeitet auf einem reicheren Projektkorpus

## Phase D2 — Query Engineering

- Query-Familien erweitern
- negative Filter und Projektprofile einziehen
- Status: abgeschlossen

Exit:

- deutlich weniger breit-noisige Queries

## Phase D3 — Ranking Upgrade

- bessere Discovery-Scores
- bessere Evidenz pro Kandidat
- Status: abgeschlossen

Exit:

- Top-Treffer fuehlen sich klarer und belastbarer an

## Phase D4 — Feedback Loop

- Promotion-/Rejection-Signale in die Suche rueckfuehren
- Status: abgeschlossen

Exit:

- Discovery lernt aus echtem Verlauf

## Phase D5 — Discovery Evaluation

- Suchqualitaet sichtbar messen
- Query-Qualitaet auswerten
- Status: naechster aktiver Block

Exit:

- Discovery wird systematisch statt ad hoc verbessert

## Definition Von Fertig

Discovery darf erst dann als wirklich exzellent gelten, wenn:

- Treffer ueber mehrere Projekte hinweg spuerbar relevanter werden
- Noise sichtbar sinkt
- Query-Familien messbar bewertet werden koennen
- Promotions und Rejections die Suche spaeter beeinflussen
- Discovery fuer Nutzer nicht nur “mehr Treffer”, sondern bessere Treffer liefert
