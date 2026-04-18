# Discovery D2 Closeout

## Ziel

Phase D2 sollte aus der reicheren Zielprojektbasis eine professionellere Suchoberflaeche machen.

Nicht nur:

- eine breite Standardquery
- mehrere Capability-Queries

sondern:

- klarere Query-Familien
- Anti-Noise-Filter
- projekttypische Archetypen
- besser priorisierte Suchplaene

## Umgesetzt

Discovery erzeugt jetzt neben dem breiten Projekt-Scan auch weitere Query-Familien:

- Archetype-Queries
- Architecture-and-layer-Queries
- Dependency-and-tooling-neighbor-Queries
- priorisierte Capability-Queries
- weiterhin manuelle Query-Boosts ueber `--query`

Zusaetzlich sind jetzt eingebaut:

- negative Suchterme gegen typische Noise-Repos
- priorisierte Query-Familien ueber `preferredQueryFamilies`
- staerkere Bereinigung generischer Discovery-Hints
- weniger Abhaengigkeit von internen Dateinamen und Dokumenttiteln

## Verifiziert

Automatisch:

- `node --test test/discovery-shared.test.mjs test/project-profile.test.mjs`
- `npm run release:smoke`

Praktischer Referenzlauf:

- temporaerer Bootstrap gegen `eventbear-worker`
- anschliessender `discover --dry-run` in einem isolierten Temp-Workspace

## Beobachteter Effekt

Der sichtbare Discovery-Plan ist jetzt klarer in Suchfamilien getrennt, zum Beispiel:

- Broad project scan
- ingestion and adapters
- quality and governance
- Architecture and layer patterns
- data model and semantics

Die Queries tragen ausserdem jetzt Anti-Noise-Begriffe wie:

- `-awesome`
- `-boilerplate`
- `-starter`

Dadurch fuehlt sich die Suche weniger wie rohe Keyword-Streuung und mehr wie eine kontrollierte Repo-Suchoberflaeche an.

## Ergebnis

Phase D2 ist damit abgeschlossen.

Die Discovery baut jetzt:

- diversere Suchlinien
- bewusstere Noise-Abwehr
- besser priorisierte Query-Plaene

## Bewusster Rest

Noch nicht geloest durch D2:

- staerkeres kandidatenseitiges Reranking
- bessere Evidenz- und Prioritaetslogik nach dem Search-Hit
- Lernen aus Promotions und Rejections
- sichtbare Query-Erfolgsmetriken

Genau diese Punkte sind die naechsten aktiven Discovery-Bloecke.
