# Accepted Limits

## Zweck

Dieses Dokument haelt die bewusst akzeptierten Produktgrenzen des aktuellen `patternpilot`-Kerns fest.

Es geht **nicht** darum, Probleme kleinzureden.
Es geht darum, nach der finalen Haertung klar zu sagen:

- was heute bewusst stark ist
- was heute bewusst konservativ bleibt
- was heute kein Produktfehler ist, auch wenn es noch nicht maximal ausgebaut ist

## Bewusst starke Bereiche

- lokaler Golden Path ueber `bootstrap`, `intake`, `sync:watchlist`, `review:watchlist`, `on-demand`
- klare Trennung zwischen `bindings/`, `projects/`, `runs/` und `state/`
- produktive Next-Step-Fuehrung statt roher Tool-Ausgaben
- breite Fremdprojekt-Validierung gegen unterschiedliche Repo-Familien
- dokumentierte Produktgrenze fuer Automation

## Bewusst akzeptierte Grenzen

### 1. Frische Validierungs- und Erstlauf-Workspaces starten konservativ

`product-readiness` und `run-governance` koennen in frischen Projekt-Workspaces zunaechst auf `baseline_required` landen.

Das ist aktuell bewusst akzeptiert, weil:

- der erste Baseline-Lauf noch als bewusster Produktmoment behandelt wird
- der Nutzer dadurch einen klaren ersten naechsten Schritt bekommt
- das kein kryptischer Bruch, sondern eine konservative Freigabelogik ist

### 2. Discovery ist heuristisch, nicht magisch

`discover` kann GitHub bereits automatisch und projektbezogen durchsuchen.
Diese Suche ist aber bewusst heuristisch:

- sie nutzt Projekt-Bindung und Discovery-Policy
- sie kann gute Kandidaten finden
- sie ersetzt aber nicht jede bewusste Nutzerentscheidung

Darum bleiben Watchlist und explizites Intake weiterhin vollwertige Kernpfade und keine Altlast.

### 3. Automation ist optional und bewusst eingehegt

Die lokale Automation-/Governance-Linie ist kein Pflichtpfad fuer den Produktkern.

Das ist bewusst akzeptiert:

- weil der lokale Kern ohne Automation stark nutzbar sein soll
- weil die Automation heute eine erweiterte Betriebsoption ist
- weil konservative Gates hier produktseitig besser sind als scheinbare Vollautomatik

### 4. GitHub App und tiefe Service-Runtime sind nicht der Abschlussmassstab fuer den Kern

Diese Pfade koennen weiter wachsen.
Sie sind aber nicht die Messlatte dafuer, ob der Kern lokal als ausgereift gelten darf.

## Was kein akzeptierter Limit-Fall waere

Die folgenden Dinge waeren keine “bewussten Grenzen”, sondern echte Produktmacken:

- kryptische Fehler im Golden Path
- unstabile oder widerspruechliche Next-Step-Hinweise
- unerklaerte Brueche bei leeren oder halb vorbereiteten Zustaenden
- neue strukturelle Kernbrueche aus breiten Fremdprojekt-Laeufen

## Schlussregel

Solange neue Arbeit nicht klar einen solchen echten Produktmangel schliesst, gilt sie nach dem Kern-Closeout nicht mehr als Pflichtblocker fuer die Produktreife.
