# GitHub Webhook Service

Diese Schicht ist inzwischen gross genug, dass man sie nicht mehr nur als flache Dateiliste lesen sollte.

Die Dateien bleiben bewusst am bisherigen Ort, damit:

- bestehende relative Imports stabil bleiben
- `git blame` und bestehende Diff-Historien lesbar bleiben
- wir kurz vor dem Abschluss keine reine Verschiebe-Churn erzeugen

Zur Orientierung ist der Bereich jetzt logisch in vier Gruppen zu lesen.

## 1. Core Queue und Service

Diese Dateien bilden den unteren Betriebsboden:

- `shared.mjs`
- `queue-store.mjs`
- `classification.mjs`
- `leases.mjs`
- `plans.mjs`
- `scheduler.mjs`
- `artifacts.mjs`
- `runtime-claims.mjs`

Gedanklich: Queue, Claims, Klassifikation, Auswahllogik, Artefakte.

## 2. Runtime

Diese Dateien beschreiben die eigentliche worker-/lane-/loop-seitige Laufzeit:

- `runtime.mjs`
- `runtime-cycle.mjs`
- `runtime-session.mjs`
- `runtime-loop.mjs`
- `runtime-history.mjs`

Gedanklich: von einem Tick ueber Cycle und Session bis zum laengeren Loop.

## 3. Recovery und Governance

Diese Gruppe ist der groesste Block und haengt bewusst zusammen:

- `runtime-loop-recovery.mjs`
- `runtime-loop-recovery-runtime.mjs`
- `runtime-loop-recovery-receipts.mjs`
- `runtime-loop-recovery-runtime-cycle*.mjs`
- `runtime-loop-recovery-runtime-cycle-runtime*.mjs`

Gedanklich:

- Recovery-Vertraege und Receipts
- Recovery-Cycles
- Family-/Coordination-/Backpressure-Governance
- mehrstufige Folgepflege ueber Cycle, Session und Loop

## 4. Abschlusskante

Diese Dateien sind die gemeinsame Schlussbewertung:

- `runtime-ops.mjs`
- `runtime-integrity.mjs`
- `runtime-maintenance.mjs`
- `runtime-control.mjs`
- `runtime-closeout.mjs`

Gedanklich:

- Betriebslage sehen
- Konsistenz pruefen
- sichere Maintenance-Aktionen ableiten
- alles in einer Schlusskante zusammenziehen
- den Road-to-100-Abschluss explizit bewerten

## Unterordner

Es gibt jetzt bewusst thematische Unterordner mit `index.mjs`-Einstiegen:

- `core/`
- `runtime/`
- `recovery/`
- `oversight/`

Diese Unterordner dienen zunaechst als Navigations- und Import-Anker.

Die eigentlichen Dateien wurden **noch nicht** physisch verschoben, weil das an diesem Punkt mehr Bewegungsrauschen als echten Strukturgewinn erzeugt haette.

Wenn spaeter wieder substanziell an diesem Bereich gearbeitet wird, kann ein zweiter Schritt sinnvoll sein:

- echte Verschiebung der Dateien in diese Ordner
- danach nur noch relative Imports sauber nachziehen

Fuer den aktuellen Stand ist diese Lesestruktur aus meiner Sicht die bessere Balance aus:

- Uebersicht
- Stabilitaet
- geringer Umbaurisiko
