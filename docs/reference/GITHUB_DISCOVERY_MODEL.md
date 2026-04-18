# GitHub Discovery Model

## Zweck

Diese Datei beschreibt, wie `patternpilot` passende externe GitHub-Repositories selbststaendig findet, ohne den Kernfluss auf ein LLM zu stuetzen.

## Prinzip

Die Discovery-Schicht arbeitet bewusst heuristikbasiert:

- Zielprojekt lesen
- Discovery-Hinweise und Alignment-Signale einsammeln
- technischen Projektkorpus aus Manifesten, Abhaengigkeiten, Scriptnamen, Dateinamen und Verzeichnisstruktur verdichten
- daraus mehrere GitHub-Suchlensen bauen
- Suchtreffer gegen bekannte Queue-, Watchlist- und Landkarten-Repos deduplizieren
- verbleibende Treffer voranreichern, klassifizieren und gegen das Zielprojekt abgleichen
- daraus einen Discovery-Score und eine Disposition ableiten

Die Suchschaerfe ist dabei bewusst **projektkonfigurierbar** und nicht auf ein einzelnes Dogfood-Projekt zugeschnitten.

## Query-Familien

Discovery baut heute nicht nur eine einzige breite Query, sondern mehrere Suchfamilien:

- Broad project scan
- Archetype-Queries
- Architecture-and-layer-Queries
- Dependency-and-tooling-neighbor-Queries
- Capability-Queries
- optional manueller Query-Boost via `--query`

Dadurch wird die Suche vielseitiger und weniger monoton.

## Anti-Noise

Discovery fuegt jetzt bewusst negative Suchterme gegen typische Rauschquellen ein, zum Beispiel:

- `-awesome`
- `-boilerplate`
- `-starter`
- `-template`

Diese Begriffe bleiben pro Projekt ueber `discoveryStrategy` anpassbar.

## Ranking und Evidenz

Nach dem Search-Hit priorisiert Discovery Kandidaten heute nicht mehr nur ueber einen einfachen Gesamtscore.

Es kombiniert jetzt:

- Projekt-Fit
- Capability-Matches
- Query-Family-Breite
- Keyword-, Topic- und README-Evidenz
- Metadatastaerke
- Aktivitaet und Reife

Zusaetzlich traegt jeder Kandidat jetzt:

- ein `discoveryEvidence`-Profil
- eine `discoveryClass`, zum Beispiel:
  - `fit_candidate`
  - `research_signal`
  - `boundary_signal`
  - `risk_signal`

Dadurch wird klarer, welche Treffer wirklich oben stehen sollten und welche eher nur Kontext oder Risiko liefern.

## Inputs

Die Discovery-Linse speist sich aus:

- `bindings/<project>/PROJECT_BINDING.json`
- `bindings/<project>/ALIGNMENT_RULES.json`
- Referenzdateien aus `readBeforeAnalysis`
- Verzeichnisstruktur aus `referenceDirectories`
- technische Signale aus dem Zielrepo, zum Beispiel:
  - Paket- und Projektnamen
  - Beschreibungen und Keywords aus Manifesten
  - Abhaengigkeiten
  - Scriptnamen
  - Dateinamen und Erweiterungen in Referenzverzeichnissen
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

## Was das praktisch bedeutet

Discovery baut seine Queries heute nicht nur aus freiem Text wie `README.md`, sondern auch aus technischeren Signalschichten des Zielprojekts.

Beispiele:

- ein Paketname wie `calendar-sync`
- eine Abhaengigkeit wie `airtable`
- ein Scriptname wie `ingest`
- ein Verzeichnisname wie `connectors`

Dadurch wird die Suche projektnaeher und weniger rein beschreibungsgetrieben.

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
npm run discover:github -- --project my-project --limit 8 --dry-run
```

Discovery plus direkte Intake-Uebergabe:

```bash
npm run patternpilot -- discover --project my-project --intake
```

Discovery plus Watchlist-Aktualisierung:

```bash
npm run patternpilot -- discover --project my-project --append-watchlist
```
