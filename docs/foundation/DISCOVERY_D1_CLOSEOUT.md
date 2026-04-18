# Discovery D1 Closeout

## Ziel

Phase D1 sollte die Discovery-Basis deutlich technischer und projektnaeher machen.

Nicht nur:

- freie Binding-Texte
- `README.md`
- manuelle `discoveryHints`

sondern auch:

- Manifestdaten
- Abhaengigkeiten
- Scriptnamen
- Dateinamen
- Verzeichnisstruktur

## Umgesetzt

Die Discovery liest jetzt fuer das Zielprojekt zusaetzlich aus:

- `package.json`
- `pyproject.toml`
- Referenzverzeichnissen aus `referenceDirectories`

Dabei werden unter anderem als Discovery-Signale verdichtet:

- Paket- und Projektnamen
- Beschreibungen
- Keywords
- Abhaengigkeiten
- Scriptnamen
- Dateinamen
- Dateierweiterungen
- Verzeichnis- und Schichtsignale

Diese Signale fliessen jetzt direkt in:

- `projectProfile.corpus`
- `projectProfile.manifestSignals`
- `projectProfile.architectureSignals`
- `projectProfile.discoverySignals`

und werden von der Discovery-Planung aktiv fuer Query-Anker und breite Suchsignale genutzt.

## Verifiziert

Automatisch:

- `node --test test/project-profile.test.mjs test/discovery-shared.test.mjs`
- `npm run release:smoke`

Praktischer Referenzlauf:

- temporaerer Bootstrap gegen `eventbear-worker`
- anschliessender `discover --dry-run` in einem isolierten Temp-Workspace

## Beobachteter Effekt

Der reale Referenzlauf baute sichtbar technischere Suchqueries, zum Beispiel:

- `script doc fetch`
- `script fetch source`
- `script schema model`
- `script review quality`

Das ist noch nicht die Endstufe der Discovery-Qualitaet, aber ein klarer Schritt weg von nur beschreibungsgetriebener Suche hin zu projektfoermigerem technischen Kontext.

## Ergebnis

Phase D1 ist damit abgeschlossen.

Die Discovery arbeitet jetzt auf einem reicheren Zielprojekt-Korpus und ist besser vorbereitet fuer:

- Phase D2 — Query Engineering
- Phase D3 — Ranking Upgrade

## Bewusster Rest

Noch nicht geloest durch D1:

- gezielte Anti-Noise-Queries
- projekttypbezogene Query-Familien
- staerkeres Reranking
- Lernschleifen aus Promotions und Rejections

Genau diese Punkte sind die naechsten aktiven Discovery-Bloecke.
