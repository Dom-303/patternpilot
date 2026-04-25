# PROJECT_BINDING — cross-domain-test

## Zweck

Diese Datei beschreibt die operative Bindung zwischen `patternpilot` und `Cross-Domain Stress Test`.

## Referenz-Repo

- Pfad: `.`
- Rolle: Zielsystem, fuer das Patternpilot externe Muster in verwertbare Entscheidungen uebersetzt
- Ablageort: `bindings/cross-domain-test/` ist die technische Bindung, waehrend `projects/cross-domain-test/` der Arbeits- und Ergebnisraum bleibt

## Kontextgewinnung fuer dieses Projekt

- Patternpilot bleibt produktseitig generisch und verankert keine harte Primaeroberflaeche.
- Stattdessen liest es fuer dieses Zielprojekt zuerst die unten definierten Leitdateien und Verzeichnisse.
- Wenn ein `docs/`-Bereich vorhanden ist, ist er meist ein schneller, hochwertiger Kontextlieferant, aber nie Produktidentitaet von Patternpilot selbst.

## Vor jedem tieferen Review zuerst lesen

- `AGENT_CONTEXT.md`
- `README.md`
- `docs/README.md`
- `package.json`

## Besonders relevante Verzeichnisse

- `lib/`
- `scripts/`
- `docs/`

## Discovery-Hinweise

- Noch offen

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
- Intake-Dossiers landen unter `../projects/cross-domain-test/intake/`
- Promotion-Pakete landen unter `../projects/cross-domain-test/promotions/`
- Erst der Promotion-Schritt darf kuratierte Artefakte veraendern
