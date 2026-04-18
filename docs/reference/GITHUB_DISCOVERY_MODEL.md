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

Die Suchschaerfe ist dabei bewusst **projektkonfigurierbar** und nicht fest auf EventBaer zugeschnitten.

## Inputs

Die Discovery-Linse speist sich aus:

- `bindings/<project>/PROJECT_BINDING.json`
- `bindings/<project>/ALIGNMENT_RULES.json`
- Referenzdateien aus `readBeforeAnalysis`
- Verzeichnisstruktur aus `referenceDirectories`
- optionalen `discoveryHints`
- optionaler `discoveryStrategy` in `bindings/<project>/PROJECT_BINDING.json`
- bereits bekannten Repos in:
  - `knowledge/repo_landkarte.csv`
  - `state/repo_intake_queue.csv`
  - `bindings/<project>/WATCHLIST.txt`

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

## Projektkonfiguration

Pro Zielprojekt kann `bindings/<project>/PROJECT_BINDING.json` die Discovery-Suche enger oder breiter setzen, zum Beispiel:

```json
{
  "discoveryStrategy": {
    "broadAnchorCount": 2,
    "capabilitySignalCount": 2,
    "seedSignalSources": ["discoveryHints"],
    "seedRepoFields": ["fullName", "name", "description", "topics"],
    "minSeedSignalHits": 2,
    "minStrongSeedSignalHits": 1
  }
}
```

Damit bleibt `patternpilot` als Produktkern generisch, waehrend einzelne Zielprojekte ihre eigene Discovery-Schaerfe definieren koennen.

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
