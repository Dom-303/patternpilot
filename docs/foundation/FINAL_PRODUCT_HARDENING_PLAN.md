# Final Product Hardening Plan

## Zweck

Dieses Dokument ist der bewusste Abschlussplan fuer die Phase:

- nicht mehr nur `v0.1.0` freigabefaehig
- sondern produktseitig so weit gehaertet, dass der Kern wirklich als `fertig-fertig` gelten darf

Gemeint ist dabei vor allem der **Produktkern**:

- Zielprojekt-Bindung
- Intake
- Watchlist
- Review
- Promotion-/Entscheidungslogik
- Readiness / Next Step

Nicht gemeint ist:

- dass danach fuer alle Zeiten nie wieder Bugs auftreten
- dass die GitHub-App-/Full-Automation-Linie schon dieselbe Abschlussreife haben muss
- dass jede spaetere Integrationsidee schon heute mitgebaut wird

## Aktueller Fortschritt

- Stand: `2026-04-18`
- Phase 1: im Kern abgeschlossen
- Naechster Fokus: Phase 2 `Automation- und Governance-Haertung`

## Zielbild

Am Ende dieser Phase soll `patternpilot` nicht mehr wie ein starker, aber noch junger Produktstand wirken.
Es soll sich im Kern wie ein **ausgereiftes lokales Produkt** anfuehlen.

Das heisst konkret:

- der Kernpfad ist klar, stabil und wiederholbar
- Randfaelle fuehren nicht zu kryptischen Bruechen
- Status- und Folgehinweise sind nachvollziehbar
- echte Fremdprojekt-Nutzung bestaetigt die Produktqualitaet
- die Automation-Schiene ist bewusst genug eingegrenzt und gehaertet, dass sie kein unscharfer Restblock mehr ist

## Ausdruecklich Nicht Im Scope

- GitHub-Release-Seite selbst veroeffentlichen
- Marketing-/Landingpage-Arbeit ausserhalb des Repo
- neue grosse Kernel-Erweiterungen ohne realen Hae rtungsnutzen
- neue App-/Automation-Unterzweige nur der Vollstaendigkeit halber

## Definition Von Fertig

Der Produktkern darf erst dann als `wirklich fertig` gelten, wenn **alle** folgenden Punkte erreicht sind:

### Kern-Qualitaet

- `bootstrap`, `intake`, `sync:watchlist`, `review:watchlist`, `analyze`, `product-readiness` funktionieren wiederholt ohne kryptische Fehler
- dieselben Kernbefehle geben bei leeren, halbvollen und gefuellten Zustaenden klare naechste Schritte aus
- keine stille Verwechslung zwischen Produktzustand, lokalem Zustand und Projektartefakten
- Reports, Review-Texte und Next-Step-Ausgaben fuehlen sich konsistent an

### Randfall-Stabilitaet

- kaputte oder halbgare Inputs brechen nicht unerklaert
- fehlende GitHub-Auth, leere Watchlists, doppelte Queue-Eintraege, bereits bekannte URLs und stale Reviews fuehren zu lesbaren Resultaten
- mindestens die haeufigsten realen Randfaelle sind mit Tests oder dokumentierten Repro-Laeufen abgesichert

### Automation-Schiene

- die lokale Automation-/Governance-/Control-Linie hat eine klare Produktgrenze
- der Nutzer versteht, was heute schon stabil lokal nutzbar ist und was noch bewusst konservativ oder manuell bleibt
- `product-readiness`, `run-governance`, `policy-control` und Automation-Status widersprechen sich nicht

### Fremdprojekt-Beweis

- mindestens `10-15` weitere oeffentliche Fremdprojekte sind einmal kontrolliert durch den Kernpfad geprueft worden
- die dabei gefundenen harten Produktmacken werden geschlossen, nicht nur notiert
- am Ende bleibt ein bewusst kuratierter Rest von “bekannten, akzeptierten Grenzen” statt unklarer Baustellen

## Die Vier Abschlussachsen

## 1. Produktkern-Haertung

### Ziel

Den Kernpfad so glattziehen, dass ein normaler Nutzer ihn wiederholt verwenden kann, ohne intern mitzudenken.

### Konkrete Arbeitsfragen

- Sind `bootstrap` und `init:project` in allen realistischen Ausgangszustaenden klar?
- Sind Watchlist- und Einzel-Intake wirklich dieselbe produktive Denkschiene oder wirken sie noch wie zwei Systeme?
- Sind Reviews inhaltlich gleichmaessig brauchbar oder kippen sie je nach Repo-Typ stark?
- Ist `product-readiness` fuer Nutzer wirklich hilfreich oder nur technisch korrekt?
- Ist die Promotion-/Decision-Linie einfach genug oder noch zu intern gedacht?

### Konkrete Aufgaben

- Kernbefehle auf eine kleine feste Referenzmenge reduzieren und als “golden path” behandeln
- alle Kernbefehle auf konsistente Summary-Struktur trimmen
- Next-Step-Formulierungen vereinheitlichen
- Output-Dokumente pro Phase gegeneinander sprachlich und strukturell abgleichen
- verbleibende EventBaer- oder interne Restdenkmuster aus Kerntexten entfernen

### Abnahmekriterium

Ein neuer Nutzer kann den Kernpfad mit nur Doku und CLI-Hinweisen sinnvoll durchlaufen.

## 2. Automation- und Governance-Haertung

### Ziel

Die Automation-Schiene soll nicht “maximal tief”, sondern **klar und belastbar** sein.

### Konkrete Arbeitsfragen

- Welche Teile sind heute schon stabil fuer lokale Nutzung?
- Welche Teile muessen bewusst konservativ/manual-gated bleiben?
- Wo erzeugt die Runtime-/Governance-Linie noch mehr Komplexitaet als Nutzwert?
- Wo widersprechen sich `run-governance`, `policy-control`, `product-readiness` und Automation-Alerts noch?

### Konkrete Aufgaben

- Produktgrenze fuer Automation dokumentieren und im Output explizit machen
- doppelte oder schwer unterscheidbare Statusklassen ausduennen
- die “manuell vs. unattended”-Linie im Output noch klarer markieren
- Recovery-/Loop-/Backpressure-Pfade auf echte lokale Betriebsrelevanz pruefen
- dort, wo noetig, auf konservative Defaults zurueckschneiden statt weiter auszubauen

### Abnahmekriterium

Automation fuehlt sich nicht mehr wie ein unfertiges Parallelprodukt an, sondern wie eine klar eingehegte erweiterte Betriebsoption.

## 3. Randfall- und Fehlerhaertung

### Ziel

Randfaelle duerfen noch Grenzen zeigen, aber keine unscharfen Produktbrueche.

### Testfelder

- kein Projekt konfiguriert
- falscher oder fehlender GitHub-Token
- leere Watchlist
- gleiche URL mehrfach
- Intake auf bereits bekanntes Repo
- Review ohne neue relevante Daten
- stale Run-Artefakte
- lokale State-Dateien fehlen oder sind leer
- Projektziel ist gross, langsam oder ungewoehnlich strukturiert
- Git-Transport ist lokal schwach, API aber gesund

### Konkrete Aufgaben

- bekannte Randfaelle als Regressionstests oder dokumentierte Repro-Saetze erfassen
- Fehlermeldungen in menschliche Sprache uebersetzen
- stilles Scheitern und implizite Annahmen reduzieren
- Dry-Run- und Real-Run-Ausgaben enger aneinander bringen

### Abnahmekriterium

Ein Randfall fuehrt zu einer verstehbaren, begrenzten und dokumentierbaren Reaktion statt zu Verwirrung.

## 4. Breite Fremdprojekt-Validierung

### Ziel

Nicht nur “ein erfolgreicher Pilot”, sondern echte Hae rtung gegen unterschiedliche Repo-Typen.

### Validierungsprinzip

Diese Welle dient **nicht** dazu, 15 neue Features zu finden.
Sie dient dazu, den bestehenden Kern gegen verschiedenes Material zu pruefen.

### Validierungs-Kohorte

Die folgenden oeffentlichen Repos sollen als breite Fremdprojekt-Stichprobe dienen.
Sie sind als GitHub-Repos oeffentlich auffindbar und wurden fuer die Planungsbasis am `2026-04-18` gegengeprueft.

#### AI / LLM / Evaluation

- `openai/openai-cookbook`
- `openai/evals` oder konservativ als Ersatz `openai/simple-evals`
- `langchain-ai/langchain`
- `microsoft/markitdown`

#### Workflow / Automation / Orchestration

- `City-Bureau/city-scrapers`
- `apache/airflow`
- `n8n-io/n8n`
- `home-assistant/core`

#### Platforms / Product Backends

- `supabase/supabase`
- `calcom/cal.com`
- `strapi/strapi`
- `directus/directus`
- `apache/superset`
- `AppFlowy-IO/AppFlowy`

### Wichtiger Hinweis

Diese Repos sind **nicht** automatisch “perfekte fachliche Matches”.
Gerade das ist hier der Punkt:

- unterschiedliche Groessen
- unterschiedliche Sprachen
- unterschiedliche Reifegrade
- unterschiedliche Repo-Strukturen
- unterschiedliche Lizenzen und Produktformen

`patternpilot` muss an dieser Vielfalt zeigen, wo der Kern robust ist und wo nicht.

### Pro Repo festzuhalten

Fuer jedes Validierungsprojekt mindestens:

- Setup lief / lief nicht
- Bootstrap war klar / unklar
- Intake war sinnvoll / unscharf
- Review war brauchbar / noisy
- Readiness war hilfreich / technisch aber schwach
- groesster Produktbruch
- groesste positive Staerke
- noetiger Fix ja/nein

### Abnahmekriterium

Nach der Kohorte bleiben nur noch bewusst akzeptierte Grenzen, keine diffusen Grundsatzoffenheiten.

## Ausfuehrungsreihenfolge

## Phase 1 — Kernpfad festziehen

- Golden Path definieren
- Kernkommandos vereinheitlichen
- wichtigste Randfaelle im Kern zuerst schliessen

Exit:

- der Kernpfad fuehlt sich lokal schon “sauber” an

## Phase 2 — Automation einkreisen

- Automation-/Governance-/Control-Linie auf Produktgrenze ziehen
- Statusklassen und Follow-up-Logik vereinfachen

Exit:

- keine grosse semantische Unschaerfe mehr zwischen Kern und Automation

## Phase 3 — Randfall-Haertung

- bekannte Fehlerbilder systematisch reproduzieren
- Regressionstests und bessere Fehlermeldungen einziehen

Exit:

- haeufige reale Stolperstellen sind abgesichert

## Phase 4 — Fremdprojekt-Welle

- `10-15` Repos kontrolliert durchpruefen
- harte Produktmacken schliessen
- Muster aus den Funden verdichten

Exit:

- breiter Realitaetsbeleg fuer den Kern

## Phase 5 — Finaler Kern-Closeout

- verbliebene Restpunkte bewusst einsortieren:
  - fixen
  - dokumentieren
  - bewusst akzeptieren

Exit:

- Abschlussdokument “Produktkern fertig” ist ehrlich vertretbar

## Konkrete Erfolgsmessung

Der Plan gilt als erfolgreich, wenn am Ende gilt:

- `release:smoke` bleibt stabil gruen
- Kernkommandos crashen nicht in den geprueften Standardszenarien
- die breite Validierungswelle liefert keine neue strukturelle Kernkrise
- `product-readiness` bleibt fuer neue Nutzer und fuer echte Projekte plausibel
- offene Punkte sind kurz, bewusst und nicht mehr systemisch

## Bewusste Schlussregel

Ab hier werden **keine neuen grossen Funktionspakete** mehr nur aus technischem Ehrgeiz gestartet.

Neue Arbeit ist nur noch gerechtfertigt, wenn sie:

- den Produktkern sichtbar haertet
- echte Fremdprojekt-Nutzung verbessert
- eine reale Produktverwirrung oder einen echten Fehler schliesst

Alles andere ist nachrangig gegenueber dieser finalen Haertung.
