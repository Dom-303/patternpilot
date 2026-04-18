# Getting Started

## Fuer wen das ist

Diese Anleitung ist fuer Menschen, die `patternpilot` einfach erstmal zum Laufen bringen wollen.

Du musst dafuer kein Entwickler sein.
Du musst auch nicht zuerst die ganze Architektur verstehen.

## Das Einzige, was du zuerst wissen musst

`patternpilot` arbeitet immer fuer ein eigenes Zielprojekt.

Darum ist der erste echte Schritt:

- nicht direkt GitHub scannen
- sondern zuerst dein eigenes Repo anbinden

## Der schnellste sinnvolle Start

```bash
npm install
npm run doctor -- --offline
npm run bootstrap -- --project my-project --target ../my-project --label "My Project"
npm run intake -- --project my-project https://github.com/example/repo
```

## Was diese vier Schritte tun

### 1. `npm install`

Laedt die lokale CLI und alles, was sie braucht.

### 2. `npm run doctor -- --offline`

Prueft den lokalen Zustand.

Du siehst danach:

- ob `patternpilot` sauber installiert ist
- ob schon Projekte verbunden sind
- ob spaeter GitHub-Zugang noch fehlt

### 3. `npm run bootstrap -- --project my-project --target ../my-project --label "My Project"`

Verbindet dein eigenes Repo mit `patternpilot`.

Dabei entstehen zwei klar getrennte Orte:

- `bindings/my-project/`
  Das ist die technische Projektanbindung.
- `projects/my-project/`
  Das ist der lesbare Arbeits- und Ergebnisraum.

### 4. `npm run intake -- --project my-project https://github.com/example/repo`

Legt einen ersten GitHub-Fund sauber an.

Danach schreibt `patternpilot` unter anderem:

- in `state/repo_intake_queue.csv`
- nach `projects/my-project/intake/`
- nach `runs/my-project/`

## Wenn du GitHub stabil und professionell anbinden willst

Fuer den ersten lokalen Test geht es notfalls auch anonym.
Fuer echte Nutzung ist ein GitHub-Token aber klar empfohlen.

Der gefuehrte Pfad ist:

```bash
npm run init:env
npm run setup:checklist
npm run doctor
```

Danach willst du im Doctor sehen:

- `auth_mode: token`
- `auth_assessment: token_verified`
- `network_status: ok`

Wenn dort stattdessen `token_missing` oder `token_present_but_api_failed` steht, ist der GitHub-Zugang noch nicht sauber eingerichtet.

## Wenn du lieber mit mehreren Repos startest

Dann arbeite mit einer Watchlist:

1. Repos in `bindings/my-project/WATCHLIST.txt` eintragen
2. Dann:

```bash
npm run sync:watchlist -- --project my-project
```

3. Danach:

```bash
npm run review:watchlist -- --project my-project --dry-run
```

## Wenn du erst einmal nur verstehen willst, wie das aussieht

Es gibt ein bewusst fiktives Beispiel unter:

[examples/demo-city-guide/README.md](../../examples/demo-city-guide/README.md)

Dieses Beispiel ist nur zur Orientierung da.
Es ist kein reales Kundenprojekt und kein aktiver Default.

## Wenn du mehr Technik willst

Dann geh weiter zu:

[ADVANCED_GUIDE.md](ADVANCED_GUIDE.md)

## Wenn du wissen willst, was oeffentlich wird

Dann lies als Naechstes:

[PUBLIC_VS_LOCAL.md](PUBLIC_VS_LOCAL.md)
