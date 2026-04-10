# PROJECT_CONTEXT — eventbear-worker

## Zweck

Diese Datei beschreibt, wie `patternpilot` das Projekt `eventbear-worker` liest.

Sie ist **kein Ersatz** für die kanonischen Architektur- und Kontextdateien im EventBär-Repo.
Sie ist die projektbezogene Arbeitslinse von Patternpilot.

---

## Projektrolle

`eventbear-worker` ist der operative Daten-Worker für EventBär.

Er ist kein allgemeines Meta-Research-System, sondern ein fachlicher Worker für:

- Sources als Input
- Kandidatenbildung
- Validierung
- Quality Gate
- Export in Zielmasterlisten

Patternpilot liest EventBär deshalb nicht als beliebiges Repo, sondern als:

- lokales Data-/Ingestion-System
- audit-first Worker
- source-first System
- candidate-first Pipeline
- System mit potenziell starkem Governance- und Truth-Kern

---

## Was Patternpilot für dieses Projekt leisten soll

Für `eventbear-worker` soll Patternpilot helfen bei:

- externer Mustererkennung
- sauberem Build-vs-Borrow-Denken
- Kartierung relevanter Repo- und Produkt-Analogien
- Identifikation fehlender Schichten
- Distribution-Denken außerhalb des Worker-Kerns
- Entscheidungsvorbereitung für spätere Ausbauschritte

---

## Harte Grenze

Patternpilot ist für EventBär:

- Analyse- und Entscheidungsschicht
- nicht Produktionslogik
- nicht Source of Truth
- nicht stiller Scope-Zuwachs im Worker-Repo

---

## Aktuelle Lesart

Die wichtigsten Lernachsen für EventBär sind aktuell:

- Connector-Familien
- Source-Systeme statt Einzelfälle
- Handoff-Disziplin zwischen schmalen Adaptern und starkem Kern
- Distribution-Surfaces
- Place-/Location-/Gastro-Schichten
- Risiko- und Abhängigkeitsbewusstsein

---

## Arbeitsregel

Jede Patternpilot-Analyse zu EventBär soll am Ende diese Frage beantworten:

**Was bedeutet das konkret für den Worker oder das spätere Produktsystem von EventBär?**
