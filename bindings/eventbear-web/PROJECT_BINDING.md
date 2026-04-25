# PROJECT_BINDING — eventbear-web

## Zweck

Diese Datei beschreibt die operative Bindung zwischen `patternpilot` und `EventBaer Web`.

## Referenz-Repo

- Pfad: `../eventbear-web`
- Rolle: Zielsystem, fuer das Patternpilot externe Muster in verwertbare Entscheidungen uebersetzt
- Ablageort: `bindings/eventbear-web/` ist die technische Bindung, waehrend `projects/eventbear-web/` der Arbeits- und Ergebnisraum bleibt

## Kontextgewinnung fuer dieses Projekt

- Patternpilot bleibt produktseitig generisch und verankert keine harte Primaeroberflaeche.
- Stattdessen liest es fuer dieses Zielprojekt zuerst die unten definierten Leitdateien und Verzeichnisse.
- Wenn ein `docs/`-Bereich vorhanden ist, ist er meist ein schneller, hochwertiger Kontextlieferant, aber nie Produktidentitaet von Patternpilot selbst.

## Vor jedem tieferen Review zuerst lesen

- `package.json`

## Besonders relevante Verzeichnisse

- `docs/`
- `packages/`

## Discovery-Hinweise

- `package`

## Discovery-Strategie

- Query-Breite, Query-Familien, Anti-Noise-Begriffe und Seed-Gates koennen pro Projekt ueber `discoveryStrategy` in `PROJECT_BINDING.json` geschaerft werden.
- Damit bleibt Patternpilot als Produkt generisch, waehrend Zielprojekte ihre eigene Suchschaerfe und Rauschgrenzen setzen.

## Fragen, die Patternpilot fuer dieses Projekt beantworten soll

- Welche Schicht im Zielrepo wird durch das externe Repo beleuchtet?
- Welche Luecke, Staerkung oder Spannungsflaeche zeigt sich?
- Ist das eher build_core, adapt_pattern, borrow_optional, observe_only oder avoid_as_core_dependency?
- Welche konkrete Folgearbeit sollte fuer das Zielprojekt entstehen?

## Guardrails

- patternpilot bleibt Analyse- und Entscheidungsschicht, nicht Produktionslogik
- externe Repos nie blind als Kernarchitektur uebernehmen
- Distribution-, Surface- und Core-Logik bewusst getrennt halten

## Promotion-Fluss

- Watchlist-Datei liegt unter `WATCHLIST.txt`
- Intake-Dossiers landen unter `../projects/eventbear-web/intake/`
- Promotion-Pakete landen unter `../projects/eventbear-web/promotions/`
- Erst der Promotion-Schritt darf kuratierte Artefakte veraendern
