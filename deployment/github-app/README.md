# GitHub App Scaffold

## Zweck

Dieser Ordner enthaelt die vorbereitenden Dateien fuer einen spaeteren Patternpilot-GitHub-App-Betrieb.

## Inhalt

- `.env.example` fuer lokale oder CI-Umgebungsvariablen
- `app-manifest.template.json` als Startpunkt fuer die App-Konfiguration
- `webhook-events.md` als Mapping zwischen GitHub-Ereignissen und Patternpilot-Flows

## Geplanter Einsatz

- Webhook-getriebene Watchlist- oder Repo-Syncs
- spaeterer Ersatz oder Ergaenzung zum PAT-basierten Zugriff
- stabilere Multi-Repo-Automation

## Noch offen

Diese App ist bewusst nur gescaffoldet.
Fuer den echten Betrieb brauchst du spaeter:

- GitHub App Registrierung
- Private Key
- App ID
- Installationen auf den Zielrepos oder in der Ziel-Organisation
