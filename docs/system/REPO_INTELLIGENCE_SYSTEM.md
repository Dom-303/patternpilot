# REPO_INTELLIGENCE_SYSTEM

## Zweck

Dieses Dokument beschreibt das kanonische Arbeitsprinzip von `patternpilot`.

Es legt fest:

- warum externe Repositories, Produkte und Tools analysiert werden
- wie diese Analyse strukturiert abläuft
- welche Kategorien und Schichten verwendet werden
- wie daraus Learnings für ein Zielprojekt entstehen
- wie aus Learnings konkrete Entscheidungen abgeleitet werden
- welche Dateien im Repo welche Rolle haben

Dieses Dokument ist die Betriebslogik des Repo-Intelligence-Systems.

---

## Ausgangspunkt

Kein Projekt entsteht im Vakuum.

Im Umfeld von:

- Scraping
- lokalen APIs
- Aggregatoren
- Plugin-Distribution
- Data-Enrichment
- UI-/Embedding-Lösungen
- Repo-Strukturen
- Research- und Decision-Systemen

existiert bereits viel Vorwissen.

Dieses Wissen soll nicht nur gesammelt, sondern systematisch nutzbar gemacht werden.

---

## Kernproblem

Externe Repos und Tools liefern oft nur Teilantworten.

Typische Probleme:

- eng auf eine Plattform begrenzt
- fragiler Scraping-Ansatz
- schwache Wartung
- Einzellösung statt System
- kein sauberer Qualitätslayer
- keine klare Entitätentrennung
- kein Review-/Reject-/Dedupe-Modell
- keine saubere Distribution außerhalb des Einzelkontexts

Gleichzeitig steckt in vielen dieser Lösungen wertvolles Wissen.

Deshalb braucht ein ernsthaftes Projekt kein blindes Nachbauen, sondern ein System zur strukturierten Auswertung.

---

## Ziel

Das Ziel von `patternpilot` ist nicht, möglichst viele Repos zu sammeln.

Das Ziel ist:

- relevante Lösungen früh zu erkennen
- Muster statt nur Einzelfälle zu verstehen
- wiederverwendbare Bausteine sichtbar zu machen
- Risiken und Grenzen klar zu benennen
- konkrete Konsequenzen für das Zielprojekt abzuleiten
- langfristig einen strategischen Wissensvorsprung aufzubauen

---

## Nicht-Ziele

Dieses System ist nicht dafür da:

- beliebig Repos zu sammeln
- externe Projekte schönzureden
- Stars mit Qualität zu verwechseln
- das Zielprojekt gegen fremde Repos zu verbiegen
- Analyse mit Umsetzung zu verwechseln

Analyse erzeugt noch keinen Fortschritt.
Fortschritt entsteht erst, wenn Learnings zu Entscheidungen und Entscheidungen zu umsetzbaren Schritten werden.

---

## Leitprinzipien

### 1. Relevanz vor Menge
Nicht viele Repos sind wertvoll, sondern die richtigen.

### 2. Muster vor Staunen
Ein Repo ist nur dann nützlich, wenn es ein Muster zeigt, das über den Einzelfall hinaus wertvoll ist.

### 3. Projektkontext bleibt bindend
Externe Lösungen werden gegen das Zielprojekt bewertet, nicht umgekehrt.

### 4. Build-vs-Borrow muss sichtbar werden
Jede Analyse soll helfen zu unterscheiden:
- selbst bauen
- adaptieren
- beobachten
- ignorieren

### 5. Risiken sind gleichwertig mit Chancen
Technische Eleganz ohne operative Tragfähigkeit ist kein echter Vorteil.

### 6. Distribution mitdenken
Ein starkes Datensystem wird wertvoller, wenn es in mehreren Produktflächen nutzbar wird.

### 7. Learnings müssen verdichtet werden
Repo-Einzelerkenntnisse sind nur Rohstoff. Ziel sind Muster.

### 8. Entscheidungen schlagen Sammlung
Die Qualität dieses Systems zeigt sich daran, ob es echte Entscheidungen ermöglicht.

---

## Arbeitsmodell

`patternpilot` arbeitet in sechs Stufen:

### Stufe 1: Finden
Relevante Repos, Tools oder Produkte identifizieren.

### Stufe 2: Einordnen
Den Fund in Kategorien, Schichten, Musterfamilien und Reife einordnen.

### Stufe 3: Verstehen
Klären, was die Lösung eigentlich tut, welche Annahmen sie macht und wo sie stark oder schwach ist.

### Stufe 4: Verdichten
Learnings und Muster extrahieren, die über das Einzelfall-Repo hinausgehen.

### Stufe 5: Entscheiden
Festlegen, was das konkret für das Zielprojekt bedeutet.

### Stufe 6: Übersetzen
Die Erkenntnisse in Architektur, Produktoberflächen oder spätere Maßnahmen überführen.

---

## Operative Intake-Schicht

Zwischen "Finden" und "Einordnen" existiert nun bewusst eine operative Intake-Schicht.

Sie verhindert, dass rohe GitHub-Funde direkt als kuratierte Repo-Intelligence behandelt werden.

Neue Repos durchlaufen deshalb zuerst:

1. `state/repo_intake_queue.csv`
2. projektbezogenes Intake-Dossier unter `projects/<projekt>/intake/`
3. Run-Protokoll unter `runs/<projekt>/<run-id>/`

Erst nach Review darf ein Fund in die kuratierten Artefakte uebergehen:

- `knowledge/repo_landkarte.csv`
- `knowledge/repo_learnings.md`
- `knowledge/repo_decisions.md`

Fuer den ersten Realbetrieb gilt zusaetzlich:

- URL-Casing allein ist keine neue Repo-Identitaet.
- Redirect-, Owner-Rename- oder Alias-Faelle werden aber ohne verlaessliche Canonical-Aufloesung nicht automatisch zusammengefaltet.
- Wenn ein bereits promovierter Fund spaeter unter einer neuen Owner-Variante wieder auftaucht, bleibt der kuratierte Datensatz kanonisch, waehrend frische Pilot-Artefakte nur als Evidenz dienen.

---

## Autonome Discovery-Schicht

Vor dem manuellen Intake kann `patternpilot` nun auch selbst nach passenden GitHub-Repositories suchen.

Wichtig:

- Discovery ist eine Such- und Priorisierungsschicht, noch keine Wahrheit
- der Kern arbeitet zunaechst heuristikbasiert und bewusst ohne LLM
- bekannte Repos aus Watchlist, Queue und Landkarte werden vorab dedupliziert
- erst der Intake- und Review-Fluss macht aus einem Treffer einen verwertbaren Fund

---

## Analyseobjekte

Jeder Fund wird zunächst als eines der folgenden Analyseobjekte gelesen:

- connector
- aggregator
- framework
- plugin
- product_surface
- enricher
- research_signal

---

## Schichtenmodell für die Bewertung

Externe Repos sollen nicht nur als Ganzes beschrieben, sondern nach Schichten verstanden werden.

Mögliche Schichten:

- source_discovery
- source_intake
- source_audit
- access_fetch
- actions_browser_fallback
- parsing_extraction
- normalize_semantics
- candidate_layer
- quality_gate
- dedupe_identity
- review_moderation
- export_feed_api
- distribution_plugin
- location_place_enrichment
- governance_backoffice
- ui_discovery_surface

Nicht jedes Repo deckt mehrere Schichten ab.
Viele gute Repos sind nur auf einer oder zwei Schichten stark.

---

## Zentrale Leitfrage

Jeder Fund wird am Ende gegen diese Frage gelesen:

**Welche Schicht stärkt dieses Repo, und was bedeutet das konkret für das Zielprojekt?**

Ohne diese Frage bleibt der Fund nur ein interessanter Link.

---

## Zentrale Felder der Landkarte

Die Datei `knowledge/repo_landkarte.csv` ist die operative Kernübersicht.

Wichtig:

Sie ist die kuratierte Landkarte, nicht der rohe Eingang fuer neue GitHub-Links.
Der rohe Eingang liegt in `state/repo_intake_queue.csv`.

Pflichtspalten:

- `name`
- `repo_url`
- `owner`
- `category`
- `pattern_family`
- `main_layer`
- `secondary_layers`
- `source_focus`
- `geographic_model`
- `data_model`
- `distribution_type`
- `stars`
- `activity_status`
- `last_checked_at`
- `maturity`
- `strengths`
- `weaknesses`
- `risks`
- `learning_for_eventbaer`
- `possible_implication`
- `eventbaer_gap_area`
- `build_vs_borrow`
- `priority_for_review`
- `eventbaer_relevance`
- `decision`
- `notes`

---

## Projektfähigkeit

`patternpilot` ist nicht nur für EventBär gedacht.

Es soll so aufgebaut sein, dass mehrere Projekte später sauber nebeneinander analysiert werden können.

Darum gilt:

- allgemeine Arbeitslogik bleibt im Repo-Root
- projektspezifische Kontexte liegen unter `projects/<projektname>/`
- projektspezifische Bindings liegen ebenfalls unter `projects/<projektname>/`
- projektbezogene Deutung darf die allgemeine Kernlogik nicht still überschreiben

---

## Projektbindung

Damit `patternpilot` wie eine Erweiterung fuer verschiedene Repos andocken kann, braucht jedes Zielprojekt eine explizite Bindung.

Diese besteht aus:

- `PROJECT_CONTEXT.md` fuer die strategische Lesart
- `PROJECT_BINDING.md` fuer die menschlich lesbare Arbeitsbindung
- `PROJECT_BINDING.json` fuer die maschinenlesbare Intake- und Automationsbindung

Diese Bindung legt fest:

- auf welches Referenz-Repo sich Patternpilot bezieht
- welche Dateien zuerst gelesen werden
- welche Verzeichnisse besonders wichtig sind
- welche Fragen fuer dieses Projekt im Zentrum stehen

---

## Bedeutung der Zusatzfelder

### `pattern_family`
Das wiederkehrende Grundmuster eines Repos.

### `project_gap_area`
Der Bereich, in dem dieses Repo auf eine relevante Projekt-Lücke, Ausbaufläche oder Lernfläche zeigt.

### `build_vs_borrow`
Vorläufige Einordnung, ob das Zielprojekt diese Fähigkeit eher selbst besitzen, adaptieren oder extern inspiriert behandeln sollte.

### `priority_for_review`
Wie dringend das Repo oder Muster näher geprüft werden sollte.

---

## Bewertungslogik

Jeder Fund soll entlang weniger harter Fragen bewertet werden:

### A. Schichtwert
Deckt das Repo eine für das Zielprojekt wichtige Schicht ab?

### B. Musterwert
Zeigt es ein wiederverwendbares Muster oder nur einen Einzelfall?

### C. Qualitätswert
Ist die Lösung robust, brauchbar und nachvollziehbar oder nur ein Bastelprojekt?

### D. Übertragungswert
Lässt sich die Idee sinnvoll auf das Zielprojekt übertragen?

### E. Risikowert
Wie groß sind rechtliche, technische oder operative Grenzen?

### F. Distributionswert
Zeigt es etwas über Produkt- oder Ausspielflächen, das später helfen könnte?

---

## Entscheidungsklassen

### `adopt`
Direkt oder nahezu direkt übernehmbar.

### `adapt`
Grundidee wertvoll, aber nur in angepasster Form sinnvoll.

### `observe`
Noch nicht unmittelbar übernehmen, aber strategisch im Blick behalten.

### `ignore`
Aktuell nicht relevant oder nicht tragfähig.

---

## Learnings-Ebene

`knowledge/repo_learnings.md` ist bewusst keine Wiederholung der Tabelle.

Dort werden verdichtete Erkenntnisse dokumentiert wie:

- welche Muster bei Single-Source-Scrapern immer wieder auftauchen
- wo Aggregatoren typischerweise schwach sind
- wie Plugins Distribution vereinfachen
- welche Risiken immer wieder auftreten
- welche Schichten am Markt oft gut gelöst werden
- welche Schichten meist fehlen
- wo ein Zielprojekt potenziell einen stärkeren Moat aufbauen kann

---

## Entscheidungs-Ebene

`knowledge/repo_decisions.md` dokumentiert konkrete Konsequenzen.

Nicht:
- lange Beschreibung fremder Repos

Sondern:
- was das Zielprojekt daraus jetzt oder später macht

Typische Formen:

- Wir bauen eine neue Connector-Familie
- Wir prüfen eine Plugin-/Widget-Fläche
- Wir übernehmen ein Muster nicht
- Wir halten Abstand von ToS-riskantem Plattform-Scraping
- Wir priorisieren Place-/Location-Enrichment später stärker

---

## Pflegeprinzipien

### 1. Klein, aber hochwertig starten
Lieber wenige saubere Analysen als viele lose Einträge.

### 2. Jede Analyse braucht eine Projekt-Folge
Kein Repo ohne klare Aussage, was es für das Zielprojekt bedeutet.

### 3. Keine tote Sammlung erzeugen
Die Tabelle soll lebendig bleiben. Alte, irrelevante oder schlecht eingeordnete Einträge sollen bereinigt werden.

### 4. Reife offen benennen
Nicht so tun, als wären alle Funde gleich wichtig.

### 5. Wiederkehrende Muster bündeln
Einzelwissen soll in Learnings überführt werden.

### 6. Produktidee und aktueller Nutzen sauber trennen
`patternpilot` kann später ein eigenes Produkt werden, dient heute aber zuerst als internes Projekt-Intelligence-System.

---

## Start-Setup

Für den Start besteht `patternpilot` aus:

- Kernlogik-Dateien im Root
- Seed-Landkarte und Learnings
- Projektkontext für `eventbear-worker`
- Prompt-Dateien für Agentenarbeit

---

## Langfristige Richtung

Langfristig kann `patternpilot` über EventBär hinauswachsen.

Mögliche spätere Entwicklungsrichtungen:

- allgemeines Idea-Intelligence-System
- Produktforschungs- und Repo-Learning-Plattform
- Build-vs-Borrow-Entscheidungssystem
- Pattern- und Wettbewerbs-Intelligence für Gründer oder Teams

Heute gilt:

**Patternpilot dient zuerst dazu, EventBär durch systematische externe Lern- und Entscheidungskraft besser zu machen.**
