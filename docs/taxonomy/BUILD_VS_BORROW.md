# Build vs Borrow

## Zweck

Diese Datei definiert die kanonischen `build_vs_borrow`-Werte.

Die Spalte beschreibt, wie ein Zielprojekt die relevante Faehigkeit grundsaetzlich behandeln sollte:

- selbst besitzen
- externes Muster adaptieren
- optional übernehmen
- nur beobachten
- bewusst nicht als Kern verwenden

---

## Erlaubte Werte

### `build_core`
Das Zielprojekt sollte diese Faehigkeit als Kern selbst besitzen.

### `adapt_pattern`
Die Grundidee ist wertvoll, aber nur in angepasster Form sinnvoll.

### `borrow_optional`
Optional übernehmbar oder als Hilfsschicht nutzbar, aber nicht Kern.

### `observe_only`
Interessant, aber noch keine konkrete Umsetzungsbasis.

### `avoid_as_core_dependency`
Nicht als Kernabhängigkeit verwenden.

---

## Entscheidungslogik

### `build_core`
Für:
- audit-first-Kern
- source-first-Kern
- candidate-first-Kern
- quality gate
- review/reject/governance
- lokale Produkt-Wahrheit

### `adapt_pattern`
Für:
- Connector-Muster
- Plattformadapter
- wiederverwendbare Fetch-/Retry-Patterns
- Distribution-Ideen
- Handoff-Muster

### `borrow_optional`
Für:
- Hilfswerkzeuge
- Enricher
- Zusatzoberflächen
- sekundäre Module

### `observe_only`
Für:
- interessante, aber noch nicht priorisierte Muster

### `avoid_as_core_dependency`
Für:
- ToS-heikle Plattformpfade
- schwach gepflegte Repos
- fragilen Scraping-Kern
- starke externe Lock-ins

---

## Regel

Pro Repo wird genau ein Wert gesetzt.

Frage:

**Soll das Zielprojekt diese Faehigkeit selbst besitzen, anpassen, optional nutzen, nur beobachten oder bewusst nicht als Kernabhaengigkeit behandeln?**
