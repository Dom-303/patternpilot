# PROJECT_BINDING — eventbear-web

## Zweck

Diese Datei beschreibt die operative Bindung zwischen `patternpilot` und `EventBaer Web`.

## Referenz-Repo

- Pfad: `../eventbear-web`
- Rolle: Zielsystem, fuer das Patternpilot externe Muster in verwertbare Entscheidungen uebersetzt

## Vor jedem tieferen Review zuerst lesen

- `package.json`

## Besonders relevante Verzeichnisse

- `docs/`
- `packages/`

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

- Intake-Dossiers landen unter `intake/`
- Promotion-Pakete landen unter `promotions/`
- Erst der Promotion-Schritt darf kuratierte Artefakte veraendern
