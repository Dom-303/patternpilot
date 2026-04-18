# Projects Workspace

## Zweck

`projects/` ist der lokale Workspace fuer gebundene Zielrepos von `patternpilot`.

Jeder Unterordner unter `projects/<project>/` beschreibt ein externes Repo oder Produkt, fuer das Patternpilot Discovery, Review, Policy und Promotion kontextualisiert.

## Was `projects/` ist

- ein lesbarer Workspace fuer projektbezogene Ergebnisse und Arbeitsartefakte
- ein Ort fuer projektspezifische Kontexte, Notizen, Reviews und Reports
- ein lokaler Arbeitsbereich, den `patternpilot` per `init:project` erweitern kann

## Was `projects/` nicht ist

- nicht der technische Bindungsort von `patternpilot`
- nicht die Identitaet von Patternpilot selbst
- nicht automatisch eine Sammlung von dauerhaft versionierten Run-Artefakten

## Typischer Inhalt pro Projekt

- `PROJECT_CONTEXT.md`
- `README.md`
- `intake/`
- `promotions/`
- `reviews/`
- `reports/`
- optional `calibration/`
- optionale projektbezogene Notizen

## Frisches Setup

Bei einer frischen Installation kann `projects/` leer oder fast leer sein.

Neue Zielprojekte entstehen ueber:

```bash
npm run init:project -- --project sample-worker --target ../sample-worker --label "Sample Worker"
```

Danach erzeugt `patternpilot` den passenden Unterordner unter `projects/`.

Die technische Zielrepo-Bindung entsteht getrennt unter `bindings/`.

## Gebuendelter Dogfood-Fall

In diesem Repo ist `projects/eventbear-worker/` bewusst mit eingecheckt.

Das ist:

- ein Dogfood- und Realtest-Arbeitsraum
- ein Beispiel fuer die Struktur eines gebundenen Zielprojekts

Das ist nicht:

- eine harte Kopplung des Produktkerns an EventBaer
- ein Beweis, dass jedes Deployment denselben Projektordner mitbringen muss

Die technische Dogfood-Bindung fuer diesen Fall liegt unter `bindings/eventbear-worker/`.

## Versionierung

Bewusst versioniert werden hier in der Regel:

- kuratierte Notizen und README-Dateien
- stabile, bewusst gepflegte Kontextdateien

Lokal bleiben in der Regel:

- generierte Reports
- datierte Kalibrierungslaeufe
- Intake-/Review-/Promotion-Artefakte aus einzelnen Runs

Technische Projektdefinitionen wie Binding, Alignment, Discovery-Policy und Watchlist liegen bewusst nicht hier, sondern unter `bindings/<project>/`.
