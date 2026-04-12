# GitHub Integration

## Zweck

Dieses Dokument beschreibt, wie `patternpilot` GitHub in der Stage-2-Ausbaustufe nutzt.

## Aktueller Stand

Stage 2 nutzt die GitHub REST API fuer:

- Repo-Metadaten
- Themen und Aktivitaetssignale
- README-Inhalte
- Sprachverteilung

Die Anreicherung passiert beim Intake und verbessert Dossiers, Queue-Eintraege und Promotion-Kandidaten.

## Token-Strategie

Patternpilot liest optional eines dieser Environment-Variablen:

- `PATTERNPILOT_GITHUB_TOKEN`
- `GITHUB_TOKEN`
- `GITHUB_PAT`

Ohne Token:

- funktionieren oeffentliche Repos weiterhin
- aber mit deutlich niedrigeren API-Limits

Mit Token:

- hoehere Limits
- sauberere Automatisierung
- spaeter auch private Repo-Unterstuetzung

## Spaetere Stufen

Ab Stage 4/5 ist fuer tiefe Automatisierung eher ein GitHub-App-Modell sinnvoll als nur ein persoenlicher Token, weil Webhooks, Installationen und mehrfach wiederverwendbare Repo-Anbindung dann wichtiger werden.
