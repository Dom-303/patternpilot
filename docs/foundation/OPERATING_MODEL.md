# Operating Model

## Kurzfassung

`patternpilot` ist ein lokales Repo-Intelligence-Produkt.

Es sammelt externe GitHub-Repositories nicht blind, sondern bewertet sie immer relativ zu einem Zielprojekt.

Die Kernfrage lautet nicht:

- Welche Links haben wir gefunden?

sondern:

- Welche externen Muster sind fuer dieses Zielprojekt wirklich relevant?
- Was lernen wir daraus?
- Was ist der naechste sinnvolle Schritt?

## Mission und Zielbild

`patternpilot` soll aus externen Repos, Tools und GitHub-Funden belastbare Entscheidungen fuer ein Zielprojekt machen.

Das Zielbild ist:

- Zielprojekt anbinden
- externe Repos intaken oder automatisch entdecken
- Relevanz, Muster und Risiken projektbezogen verdichten
- daraus lesbare Reviews, Reports und Entscheidungen erzeugen

`patternpilot` ist bewusst nicht:

- ein Bookmark-Ordner
- ein chaotisches Repo-Archiv
- ein Ersatz fuer die Produktionslogik des Zielprojekts
- eine Sammlung automatischer Scheinbewertungen

## Produktmodell

Der Betriebsmodus hat immer zwei Ebenen:

- Produktkern
- Zielprojektbindung

### Produktkern

Der generische Produktkern lebt in:

- `lib/`
- `scripts/`
- `automation/`
- `deployment/`
- `docs/`

Dieser Teil bleibt repo-unabhaengig und oeffentlich.

### Zielprojektbindung

Ein Zielprojekt wird ueber zwei getrennte Flaechen eingebunden:

- `bindings/<project>/`
- `projects/<project>/`

`bindings/<project>/` beschreibt, wie `patternpilot` das Zielprojekt lesen soll.

`projects/<project>/` ist der lesbare Arbeits- und Ergebnisraum fuer dieses Zielprojekt.

## Die vier Hauptbereiche

`patternpilot` trennt bewusst:

- `bindings/`
  technische Zielprojekt-Anbindung
- `projects/`
  lesbarer Arbeitsraum je Zielprojekt
- `runs/`
  technische Laufhistorie und Artefakte
- `state/`
  lokaler Betriebszustand

Zusätzlich gibt es:

- `knowledge/`
  kuratierte, langlebige Wissensartefakte

## Golden Path

Der stabile Kernpfad ist:

1. Zielprojekt anbinden
2. einen einzelnen Fund intaken oder eine Watchlist synchronisieren
3. den Review lesen
4. bewusst entscheiden
5. den naechsten Schritt aus `product-readiness` nehmen

Der kuerzeste typische Ablauf:

```bash
npm install
npm run doctor -- --offline
npm run bootstrap -- --project my-project --target ../my-project --label "My Project"
npm run intake -- --project my-project https://github.com/example/repo
```

Danach folgen typischerweise:

```bash
npm run sync:watchlist -- --project my-project
npm run review:watchlist -- --project my-project --dry-run
npm run patternpilot -- product-readiness
```

## Discovery-Schicht

Discovery ist heute bereits ein eigener professioneller Produktpfad.

Sie arbeitet projektkontextbasiert:

- Zielprojekt lesen
- Query-Familien bauen
- Kandidaten anreichern
- Fit, Evidenz und Disposition ableiten
- aus echten Outcomes ruecklernen
- Query-Qualitaet sichtbar evaluieren

Der Discovery-Ausbau ist im Kern abgeschlossen:

- D1 Corpus Upgrade
- D2 Query Engineering
- D3 Ranking Upgrade
- D4 Feedback Loop
- D5 Discovery Evaluation

Die Details der Suchlogik stehen in:

- [GITHUB_DISCOVERY_MODEL.md](../reference/GITHUB_DISCOVERY_MODEL.md)

## Automation-Schicht

Automation ist eine optionale Betriebsoberflaeche, nicht der Pflichtkern.

Das heisst:

- der lokale Kern muss auch ohne Automation voll sinnvoll nutzbar bleiben
- Automation darf konservativ gebremst sein
- `product-readiness` soll den Kern nicht kuenstlich schlechtreden, nur weil keine Automation konfiguriert ist

Die Produktgrenze steht in:

- [AUTOMATION_OPERATING_MODE.md](AUTOMATION_OPERATING_MODE.md)

## Oeffentlich vs. lokal

Das Repo trennt bewusst zwischen:

- oeffentlichem Produktcode und dauerhafter Doku
- lokalem Betriebszustand
- datierten Run-Artefakten
- projektspezifischen Ergebnissen

Faustregel:

- Was committed und gepusht ist, ist Teil des Produkts.
- Was ignoriert oder nur lokal vorhanden ist, bleibt lokal.

Die Detailregel steht in:

- [PUBLIC_VS_LOCAL.md](PUBLIC_VS_LOCAL.md)

## Produktreife

Der Kern gilt heute als ausgereifter lokaler `v1`-Kern.

Das beruht auf drei Belegen:

- erfolgreicher Frischstart-Pilot mit fremdem Zielprojekt
- breite Kohortenvalidierung ueber `14` oeffentliche Fremdprojekte
- abgeschlossener Discovery-Exzellenz-Pfad

Die kompakte Reife-Sicht steht in:

- [V1_STATUS.md](V1_STATUS.md)

## Was dauerhaft wichtig bleibt

Die dauerhaft wichtigsten Foundations-Dokumente sind:

- [SIMPLE_GUIDE.md](SIMPLE_GUIDE.md)
- [GETTING_STARTED.md](GETTING_STARTED.md)
- [ADVANCED_GUIDE.md](ADVANCED_GUIDE.md)
- [OPERATING_MODEL.md](OPERATING_MODEL.md)
- [V1_STATUS.md](V1_STATUS.md)
- [AUTOMATION_OPERATING_MODE.md](AUTOMATION_OPERATING_MODE.md)
- [PUBLIC_VS_LOCAL.md](PUBLIC_VS_LOCAL.md)
- [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
