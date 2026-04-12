# GitHub Token Setup

## Zweck

Diese Datei erklaert, welche GitHub-Zugaenge Patternpilot spaeter sinnvoll nutzen kann und was ein Token in diesem Zusammenhang ueberhaupt bedeutet.

## Was hier mit "Token" gemeint ist

Im Patternpilot-Kontext bedeutet "Token" zunaechst:

- ein GitHub-API-Zugangsschluessel
- kein LLM-Token
- keine direkte OpenAI- oder Modellabrechnung

Ein GitHub-Token verbessert vor allem:

- API-Limits
- Stabilitaet bei vielen Requests
- Zugriff auf private Repositories

## Aktueller Patternpilot-Stand

Patternpilot prueft derzeit diese Umgebungsvariablen:

- `PATTERNPILOT_GITHUB_TOKEN`
- `GITHUB_TOKEN`
- `GITHUB_PAT`

Wenn eine davon gesetzt ist, authentifiziert sich der Intake gegen die GitHub-REST-API.

## Empfohlene Stufen

### Jetzt

- ein `fine-grained personal access token` fuer stabile REST-API-Nutzung

Geeignet fuer:

- hoehere Rate Limits
- private Repos
- weniger anonyme Ausfaelle bei groesseren Intake-Laeufen

### Spaeter fuer Stage 4/5

- eine GitHub App

Geeignet fuer:

- repo-uebergreifende Wiederverwendbarkeit
- sauberere Rechtevergabe
- spaeteren Plugin- oder Workspace-Modus

## Wichtige Einordnung zu Kosten

- Das GitHub-Token selbst ist normalerweise kein nutzungsbasierter Kostenposten.
- Kosten entstehen eher indirekt ueber GitHub-Plans, Team-Features oder spaetere Infrastruktur.
- Fuer oeffentliche Repos ist das Hauptthema derzeit nicht Preis, sondern Stabilitaet, Limits und Zugriff.

## Offizielle Referenzen

- https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api
- https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28
