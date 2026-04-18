# Setup Checklist

## Zweck

Diese Datei beschreibt die naechsten Angaben, die Patternpilot fuer den echten produktiven GitHub-Betrieb noch von dir braucht.

## Schnellster stabiler Zwischenzustand

### 1. Fine-grained PAT

- Wert fuer `PATTERNPILOT_GITHUB_TOKEN`
- eintragen in `.env.local`
- Beispielzeile:
  - `PATTERNPILOT_GITHUB_TOKEN=github_pat_...`
- finden unter:
  - GitHub
  - `Settings`
  - `Developer settings`
  - `Personal access tokens`
  - `Fine-grained tokens`
- offizielle Doku:
  - https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

Danach direkt pruefen:

```bash
npm run doctor
```

Gewuenschter Zustand:

- `auth_mode: token`
- `auth_assessment: token_verified`
- `network_status: ok`

Wenn das nicht so aussieht, ist der GitHub-Zugang noch nicht sauber angeschlossen.

## Voller GitHub-App-Betrieb

### 2. GitHub App ID

- Wert fuer `PATTERNPILOT_GITHUB_APP_ID`
- eintragen in `deployment/github-app/.env.local`
- finden unter:
  - GitHub
  - `Settings`
  - `Developer settings`
  - `GitHub Apps`
  - deine App
  - `General`
  - `App ID`
- offizielle Doku:
  - https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app

### 3. GitHub App Client ID

- Wert fuer `PATTERNPILOT_GITHUB_APP_CLIENT_ID`
- eintragen in `deployment/github-app/.env.local`
- finden unter:
  - GitHub App
  - `General`
  - `Client ID`
- offizielle Doku:
  - https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app

### 4. GitHub App Client Secret

- Wert fuer `PATTERNPILOT_GITHUB_APP_CLIENT_SECRET`
- eintragen in `deployment/github-app/.env.local`
- finden unter:
  - GitHub App
  - `General`
  - `Generate a new client secret`
- offizielle Doku:
  - https://docs.github.com/enterprise-cloud@latest/apps/maintaining-github-apps/modifying-a-github-app-registration

### 5. GitHub App Private Key

- Pfad fuer `PATTERNPILOT_GITHUB_APP_PRIVATE_KEY_PATH`
- eintragen in `deployment/github-app/.env.local`
- Datei erzeugen unter:
  - GitHub App
  - `General`
  - `Private keys`
  - `Generate a private key`
- offizielle Doku:
  - https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps

### 6. Webhook Secret

- Wert fuer `PATTERNPILOT_GITHUB_WEBHOOK_SECRET`
- eintragen in `deployment/github-app/.env.local`
- den Wert erzeugst du selbst beim Webhook-Setup
- offizielle Doku:
  - https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries

## Nützliche Befehle

```bash
npm run init:env
npm run setup:checklist
npm run doctor
```
