# V1 Status

## Urteil

`patternpilot` ist heute ein ausgereiftes lokales `v1`-Produkt.

Das bedeutet:

- der Kernpfad ist stabil
- die Nutzerfuehrung ist klar
- Discovery ist professionell genug fuer echten Einsatz
- Automation ist sauber als optionaler Modus eingehegt

Das bedeutet nicht:

- nie wieder ein Bug
- jede kuenftige Integrationslinie schon fertig
- jede GitHub-App- oder Service-Runtime-Schicht schon maximal ausgebaut

## Was stark steht

- Produktkern fuer `bootstrap`, `intake`, `sync:watchlist`, `review:watchlist`, `on-demand`, `product-readiness`
- klare Trennung zwischen `bindings/`, `projects/`, `runs/`, `state/` und `knowledge/`
- gefuehrtes Onboarding mit einfacher und technischer Doku
- neutrale oeffentliche Produktoberflaeche ohne aktive Kunden- oder Dogfood-Defaults
- stabile GitHub-Token-Fuehrung
- Discovery mit:
  - projektbezogenem Corpus
  - Query-Familien
  - Ranking und Evidenz
  - Feedback-Loop
  - Evaluation
- breite Fremdprojekt-Validierung

## Belege

### 1. Fremdprojekt-Pilot

Ein frischer Temp-Workspace mit fremdem Zielprojekt lief erfolgreich durch:

- `getting-started`
- `doctor`
- `bootstrap`
- `sync:watchlist`
- `review:watchlist`
- `analyze`
- `product-readiness`
- `run-governance`

### 2. Breite Kohortenvalidierung

`patternpilot` wurde gegen `14` oeffentliche Fremdprojekte validiert.

Ergebnis:

- kein offener struktureller Kernbruch
- keine offenen `failed`- oder `needs_fix`-Faelle in der Abschlusswelle

### 3. Discovery-Ausbau im Kern abgeschlossen

Der Discovery-Exzellenz-Pfad ist im Kern fertig:

- D1 Corpus Upgrade
- D2 Query Engineering
- D3 Ranking Upgrade
- D4 Feedback Loop
- D5 Discovery Evaluation

## Bewusst akzeptierte Grenzen

Diese Grenzen sind aktuell bewusst akzeptiert und kippen den `v1`-Status nicht:

### 1. Discovery ist heuristisch, nicht magisch

`discover` ist stark, aber nicht allwissend.

Darum bleiben Watchlist und explizites Intake weiterhin vollwertige Kernpfade.

### 2. Automation ist optional

Der lokale Kern muss auch ohne Automation voll sinnvoll nutzbar bleiben.

### 3. Frische Workspaces bleiben konservativ

Ein neuer Workspace kann in `product-readiness` oder `run-governance` zunaechst bewusst auf Baseline-/Follow-up-Status landen.

Das ist aktuelle Produktlogik, kein verdeckter Kernbruch.

### 4. Tiefe GitHub-App- und Service-Runtime-Linien sind Zusatzpfade

Sie koennen weiter wachsen, sind aber nicht der Massstab dafuer, ob der lokale Produktkern ausgereift ist.

## Was jetzt nicht mehr der Hauptblocker ist

- Kernmechanik
- Repo-Struktur
- Onboarding-Grundfuehrung
- Public-vs-Local-Trennung
- Discovery-Grundqualitaet

## Was jetzt noch echter Fortschritt waere

Sinnvolle naechste Schritte kommen jetzt nicht mehr aus Pflicht-Haertung, sondern aus echter Nutzung:

- weitere Discovery- oder Ranking-Verfeinerung aus realen Projekten
- weitere Automation nur dort, wo sie realen Nutzwert bringt
- spaetere GitHub-App-/Service-Runtime-Ausbauschritte
- optionale Oberflaechen- und Reporting-Politur

## Dauerhafte Referenzen

- Produkt- und Systembild: [OPERATING_MODEL.md](OPERATING_MODEL.md)
- Discovery-Logik: [../reference/GITHUB_DISCOVERY_MODEL.md](../reference/GITHUB_DISCOVERY_MODEL.md)
- Automation-Grenze: [AUTOMATION_OPERATING_MODE.md](AUTOMATION_OPERATING_MODE.md)
- Public-vs-Local: [PUBLIC_VS_LOCAL.md](PUBLIC_VS_LOCAL.md)
- Release-Disziplin: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
