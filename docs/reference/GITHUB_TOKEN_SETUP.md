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

Als Startpunkt liegt jetzt auch eine `.env.example` im Repo.

## Empfohlener Nutzerpfad

Der einfachste stabile Ablauf ist:

```bash
npm run init:env
npm run setup:checklist
npm run doctor
```

Danach sollte `doctor` idealerweise zeigen:

- `auth_mode: token`
- `auth_assessment: token_verified`
- `network_status: ok`

## Diagnose

Du kannst den aktuellen Zustand mit dem Doctor pruefen:

```bash
npm run doctor -- --offline
```

Oder mit API-Check:

```bash
npm run doctor
```

Wenn `doctor` stattdessen zeigt:

- `auth_assessment: token_missing`
  Dann ist noch kein Token in der laufenden Session angekommen.
- `auth_assessment: token_present_but_api_failed`
  Dann wurde zwar ein Token gefunden, aber die Live-Pruefung gegen GitHub ist fehlgeschlagen. In dem Fall Token, Session oder Rechte pruefen.

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

Das Repo enthaelt dafuer jetzt auch ein erstes Scaffold unter `deployment/github-app/`.

## Wichtige Einordnung zu Kosten

- Das GitHub-Token selbst ist normalerweise kein nutzungsbasierter Kostenposten.
- Kosten entstehen eher indirekt ueber GitHub-Plans, Team-Features oder spaetere Infrastruktur.
- Fuer oeffentliche Repos ist das Hauptthema derzeit nicht Preis, sondern Stabilitaet, Limits und Zugriff.

## Offizielle Referenzen

- https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api
- https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28
