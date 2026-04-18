# Simple Guide

<p align="center">
  <img src="../../assets/onboarding-map.svg" alt="Patternpilot onboarding map" width="860">
</p>

## Was `patternpilot` fuer dich macht

`patternpilot` hilft dir dabei, andere GitHub-Repos nicht nur zu sammeln, sondern sinnvoll einzuordnen.

Es beantwortet fuer dich:

- Was passt wirklich zu meinem Produkt?
- Was ist nur interessant, aber nicht wichtig?
- Was sollte ich beobachten, uebernehmen oder bewusst nicht verfolgen?

## Was du nicht zuerst koennen musst

Du musst nicht:

- programmieren koennen
- die ganze Architektur verstehen
- sofort einen GitHub-Token haben

Fuer den ersten Test reicht ein sehr kleiner Start.

## Der einfachste erste Lauf

```bash
npm install
npm run doctor -- --offline
npm run bootstrap -- --project my-project --target ../my-project --label "My Project"
npm run intake -- --project my-project https://github.com/example/repo
```

## Was dann passiert

### 1. `doctor --offline`

Prueft, ob `patternpilot` lokal sauber laeuft.

### 2. `bootstrap`

Verbindet dein eigenes Zielprojekt mit `patternpilot`.

Danach gibt es zwei wichtige Orte:

- `bindings/my-project/`
  Die technische Anbindung an dein Projekt.
- `projects/my-project/`
  Der lesbare Bereich fuer Ergebnisse.

### 3. `intake`

Legt einen ersten externen Repo-Fund an.

Danach findest du erste Spuren in:

- `projects/my-project/intake/`
- `runs/my-project/`
- `state/repo_intake_queue.csv`

## Wenn du danach weitergehen willst

Der naechste gute Schritt ist meist:

```bash
npm run review:watchlist -- --project my-project --dry-run
```

Oder, wenn du nur einen einzelnen Fund pruefen willst:

```bash
npm run patternpilot -- product-readiness
```

## Wenn du GitHub richtig anbinden willst

Fuer echte, stabile GitHub-Laeufe solltest du danach den gefuehrten Token-Pfad machen:

```bash
npm run init:env
npm run setup:checklist
npm run doctor
```

Der gute Zustand ist:

- `auth_mode: token`
- `auth_assessment: token_verified`
- `network_status: ok`

## Welche Anleitung du als Naechstes nehmen solltest

- Wenn du nur schnell starten willst:
  [GETTING_STARTED.md](GETTING_STARTED.md)
- Wenn du mehr Technik verstehen willst:
  [ADVANCED_GUIDE.md](ADVANCED_GUIDE.md)
- Wenn du wissen willst, was lokal bleibt:
  [PUBLIC_VS_LOCAL.md](PUBLIC_VS_LOCAL.md)
