# Patternpilot

`patternpilot` ist ein lokales Produkt fuer Repo-Intelligence.

Es hilft dir, externe GitHub-Repositories nicht nur zu sammeln, sondern im Kontext deines eigenen Produkts zu bewerten:

- Was ist wirklich relevant?
- Was ist nur interessant?
- Was solltest du uebernehmen, beobachten oder bewusst nicht uebernehmen?

## Der kuerzeste Einstieg

Wenn du neu bist, nimm genau diese vier Schritte:

```bash
npm install
npm run doctor -- --offline
npm run bootstrap -- --project my-project --target ../my-project --label "My Project"
npm run intake -- --project my-project https://github.com/example/repo
```

Danach hast du einen ersten echten Durchlauf.

## Was danach im Repo passiert

`patternpilot` trennt bewusst vier Bereiche:

- `bindings/<project>/`
  Die technische Anbindung an dein Zielprojekt.
- `projects/<project>/`
  Der lesbare Arbeits- und Ergebnisraum fuer dieses Zielprojekt.
- `runs/<project>/`
  Laufprotokolle und technische Nachvollziehbarkeit.
- `state/`
  Lokaler Betriebszustand wie Queue, Alerts und Runtime-Snapshots.

Wichtig:

- Dieses Repo startet jetzt produktseitig leer.
- Es wird kein reales Kunden- oder Dogfood-Projekt mehr als aktives Beispiel mitgeliefert.
- Wenn du ein Beispiel sehen willst, nutze das bewusst fiktive Paket unter [examples/demo-city-guide/README.md](examples/demo-city-guide/README.md).

## Onboarding

Es gibt jetzt zwei Einstiegsebenen:

- Einfach und kurz:
  [GETTING_STARTED.md](docs/foundation/GETTING_STARTED.md)
- Technischer und ausfuehrlicher:
  [ADVANCED_GUIDE.md](docs/foundation/ADVANCED_GUIDE.md)
- Oeffentlich vs. lokal:
  [PUBLIC_VS_LOCAL.md](docs/foundation/PUBLIC_VS_LOCAL.md)
- Release-Disziplin:
  [RELEASE_CHECKLIST.md](docs/foundation/RELEASE_CHECKLIST.md)

Wenn du lieber direkt in der CLI gefuehrt werden willst:

```bash
npm run getting-started
```

## Die wichtigsten Befehle

- `npm run bootstrap -- --project my-project --target ../my-project --label "My Project"`
  Erstellt die lokale Konfiguration und bindet dein erstes Zielrepo.
- `npm run intake -- --project my-project <github-url>`
  Legt einen einzelnen Fund sauber an.
- `npm run sync:watchlist -- --project my-project`
  Arbeitet die Watchlist fuer ein Projekt ab.
- `npm run review:watchlist -- --project my-project --dry-run`
  Verdichtet Watchlist-Funde zu einem Review.
- `npm run patternpilot -- product-readiness`
  Zeigt, wie nah dein lokaler Setup an einem belastbaren Betriebszustand ist.

## Produktlogik in einem Satz

`patternpilot` bewertet fremde Repos nie abstrakt, sondern immer relativ zu einem Zielprojekt.

Darum ist der erste echte Schritt fast nie `discover`, sondern fast immer `bootstrap` oder `init:project`.

## Fuer fortgeschrittene Nutzer

Wenn du tiefer einsteigen willst:

- Betriebsmodell:
  [OPERATING_MODEL.md](docs/foundation/OPERATING_MODEL.md)
- Projekt-Alignment:
  [PROJECT_ALIGNMENT_MODEL.md](docs/reference/PROJECT_ALIGNMENT_MODEL.md)
- GitHub-Discovery:
  [GITHUB_DISCOVERY_MODEL.md](docs/reference/GITHUB_DISCOVERY_MODEL.md)
- Automation und Alerts:
  [AUTOMATION_ALERT_DELIVERY.md](docs/reference/AUTOMATION_ALERT_DELIVERY.md)

## Wichtige Produktentscheidung

`patternpilot` versioniert Produktcode und bewusst gepflegte Referenzdokumente.

Faustregel:

- Was in Git committed und nach GitHub gepusht wird, ist oeffentlich.
- Was von `.gitignore` erfasst ist oder nur lokal untracked bleibt, bleibt lokal.

Es versioniert nicht automatisch:

- lokale Runtime-Zustaende aus `state/`
- datierte Run-Artefakte
- frische Intake-, Review- oder Promotion-Ausgaben aus Einzelruns

Dadurch bleibt das Repo ein Produkt-Repo und nicht ein Sammelbehaelter fuer lokale Betriebsdaten.
