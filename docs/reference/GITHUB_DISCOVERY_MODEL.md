# GitHub Discovery Model

## Zweck

Diese Datei beschreibt, wie `patternpilot` passende externe GitHub-Repositories selbststaendig findet, ohne den Kernfluss auf ein LLM zu stuetzen.

## Prinzip

Die Discovery-Schicht arbeitet bewusst heuristikbasiert:

- Zielprojekt lesen
- Discovery-Hinweise und Alignment-Signale einsammeln
- daraus mehrere GitHub-Suchlensen bauen
- Suchtreffer gegen bekannte Queue-, Watchlist- und Landkarten-Repos deduplizieren
- verbleibende Treffer voranreichern, klassifizieren und gegen das Zielprojekt abgleichen
- daraus einen Discovery-Score und eine Disposition ableiten

## Inputs

Die Discovery-Linse speist sich aus:

- `PROJECT_BINDING.json`
- `ALIGNMENT_RULES.json`
- Referenzdateien aus `readBeforeAnalysis`
- Verzeichnisstruktur aus `referenceDirectories`
- optionalen `discoveryHints`
- bereits bekannten Repos in:
  - `knowledge/repo_landkarte.csv`
  - `state/repo_intake_queue.csv`
  - `WATCHLIST.txt`

## Warum erst ohne LLM

Der Kern soll zuerst stabil, reproduzierbar und moeglichst halluzinationsarm sein.

Deshalb nutzt die aktuelle Discovery:

- GitHub Repository Search
- Repo-Metadaten
- README-Exzerpte
- regelbasierte Klassifizierung
- projektgebundenes Alignment

Eine spaetere LLM-Schicht kann darauf aufsetzen, zum Beispiel fuer:

- bessere Query-Verfeinerung
- semantische Clusterbildung
- Musterverdichtung ueber mehrere Repos
- priorisierte Review-Briefs

## Dispositionen

Die Discovery vergibt aktuell eine grobe operative Disposition:

- `intake_now`
- `review_queue`
- `watch_only`
- `observe_only`

Sie ist bewusst nicht die finale Entscheidung, sondern nur die naechste sinnvolle Bearbeitungsstufe.

## CLI

Nur Discovery-Plan und Kandidaten:

```bash
npm run discover:github -- --project eventbear-worker --limit 8 --dry-run
```

Discovery plus direkte Intake-Uebergabe:

```bash
npm run patternpilot -- discover --project eventbear-worker --intake
```

Discovery plus Watchlist-Aktualisierung:

```bash
npm run patternpilot -- discover --project eventbear-worker --append-watchlist
```
