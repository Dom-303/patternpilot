# Automation Roadmap

## Ziel

Diese Roadmap beschreibt die sinnvollen Ausbaustufen von `patternpilot` vom heutigen Startpunkt bis zur spaeteren Vollautomatisierung.

Wichtig:

Der aktuelle Produktkern soll zuerst im gezielten On-Demand-Modus stark sein.
Wiederkehrende Automation bleibt eine spaetere, optionale Betriebsschicht.

---

## Stufe 1: Strukturierter manueller Intake

Status: jetzt umgesetzt

Was passiert:

- Du gibst GitHub-Links manuell rein
- Patternpilot erzeugt Queue-Eintrag, Intake-Dossier und Run-Protokoll
- Das Zielprojekt ist bereits mitgebunden

Nutzen:

- keine losen Links mehr
- jeder Fund bekommt sofort eine klare Arbeitsform
- EventBaer-Bezug ist ab dem ersten Schritt sichtbar

Ergaenzung zum aktuellen Stand:

- `on-demand` buendelt den manuellen Primärpfad jetzt zu einem Lauf
- explizite Repo-Links koennen bis zum fokussierten Review gehen, ohne zuerst die Watchlist zu brauchen

---

## Stufe 2: Assistierter Review

Status: jetzt umgesetzt

Was dazu kommt:

- GitHub-Metadaten automatisch anreichern
- Repo-Readme oder Kerninfos in das Dossier ziehen
- Review-Fragen halbautomatisch vorbefuellen
- Promotion-Kandidaten fuer `knowledge/repo_landkarte.csv` vorschlagen
- Queue-Felder mit Aktivitaets- und Repo-Signalen anreichern
- mit optionalem GitHub-Token auf hoehere API-Limits vorbereiten

Nutzen:

- weniger manuelle Vorarbeit
- schnellere, konsistentere Erstbewertung

---

## Stufe 3: Projektabgleich gegen Referenz-Repo

Status: jetzt umgesetzt

Was dazu kommt:

- Patternpilot liest definierte Referenzdateien aus dem Zielrepo automatisch
- externe Muster werden gegen bekannte Worker-Schichten gemappt
- Luecken und Anschlussfaehigkeit werden konkreter benannt
- projektgebundene Alignment-Regeln liefern Fit-Band, Worker-Areas und naechste Schritte

Nutzen:

- externe Repos werden nicht nur beschrieben, sondern gegen reale Projektarchitektur geprueft

---

## Stufe 4: Teilautomatische Decision-Promotion

Status: jetzt umgesetzt

Was dazu kommt:

- eigener Promotion-Schritt zwischen Intake und kuratierten Artefakten
- Promotion-Pakete pro Repo unter `projects/<projekt>/promotions/`
- halbautomatische Updates fuer `knowledge/repo_landkarte.csv`
- candidate sections fuer `knowledge/repo_learnings.md` und `knowledge/repo_decisions.md`
- Queue-Status fuer `promotion_prepared` und `promoted`

Nutzen:

- Patternpilot wird vom Intake-Werkzeug zur echten Entscheidungsmaschine

---

## Stufe 5: Repo-/Workspace-Plugin-Modus

Status: jetzt umgesetzt

Was dazu kommt:

- Patternpilot dockt als Erweiterung an beliebige Repos an
- Projektbindung wird einmal konfiguriert und danach automatisch genutzt
- neue GitHub-Links, Watchlists oder Quellen koennen automatisch eingespeist werden
- der Kontext fuer das Zielprojekt wird aktiv mitgefuehrt
- Workspace-Discovery fuer lokale Git-Repos
- `init-project` fuer neue Projektbindungen ohne Handarbeit
- `doctor` fuer GitHub-Token-, API- und Workspace-Diagnose
- projektuebergreifende Watchlist-Syncs und `automation-run`
- GitHub-App- und Plugin-Scaffolds fuer spaetere Distribution

Nutzen:

- Patternpilot wird zu einem wiederverwendbaren Meta-System statt zu einer Einmal-Loesung fuer EventBaer

---

## Stufe 6: Autonome GitHub-Discovery

Status: jetzt umgesetzt

Was dazu kommt:

- Patternpilot leitet aus Projektkontext, Discovery-Hinweisen und Alignment-Signalen eigene GitHub-Suchplaene ab
- GitHub-Repositories werden heuristisch gesucht, vorgerankt und gegen bekannte Queue-, Watchlist- und Landkarten-Eintraege dedupliziert
- Kandidaten bekommen Discovery-Score, Disposition und direkten Handoff in Watchlist oder Intake
- projektbezogene Discovery-Policies koennen Blocklisten, Mindest-Fit und bevorzugte Musterfamilien erzwingen
- der Kern bleibt bewusst ohne LLM und arbeitet zuerst mit GitHub-Metadaten, Readmes und projektbezogenen Regeln

Nutzen:

- Patternpilot wartet nicht mehr nur auf manuell eingegebene Links
- passende Repositories koennen systematischer und stabiler gefunden werden
- die spaetere optionale LLM-Schicht wird auf ein sauberes, verifiziertes Fundament gesetzt

---

## Stufe 7: Vergleichende Watchlist-Reviews

Status: jetzt umgesetzt

Was dazu kommt:

- Watchlist-Repos koennen als Vergleichsraum gegen das Zielprojekt ausgewertet werden
- Analyse-Profile erlauben verschiedene Richtungen wie Architektur, Sources, Distribution oder Risk
- Analyse-Tiefen erlauben kompakte oder tiefere Review-Laeufe
- Review-Reports landen unter `projects/<projekt>/reviews/`

Nutzen:

- Patternpilot endet nicht mehr beim Einsammeln
- Staerken, Schwachstellen und konkrete Vergleichspotenziale werden sichtbar
- Nutzer koennen den Fokus des letzten Vergleichs-Runs bewusst steuern

---

## Stufe 8: Nutzerfreundliche Report-Schicht

Status: jetzt umgesetzt

Was dazu kommt:

- Discovery- und Review-Laeufe erzeugen standardisierte HTML-Reports
- Report-Views steuern die Detailtiefe der Ausgabe
- dieselben zugrunde liegenden Daten koennen so roh oder nutzerfreundlich gelesen werden
- die HTML-Schicht ist bewusst als Vorstufe einer spaeteren Produkt-UI gebaut
- Decision-Daten werden in Queue, Intake und Report als persistierte Engine-Signale sichtbar

Nutzen:

- auch groessere Repo-Mengen bleiben lesbar
- Empfehlungen und Transferpotenziale werden schneller sichtbar
- Patternpilot wird produktreifer und weniger nur ein CLI-/Dokumentensystem

---

## Stufe 9: Drift- und Betriebsfestigkeit

Status: im Ausbau

Was dazu kommt:

- stale oder fallback Decision-Daten koennen mit `re-evaluate` neu gerechnet werden
- der Kettenlauf zieht Re-Evaluate vor Reviews automatisch nach
- spaetere Scheduler koennen Regel-Drift und Wiederholungslasten kontrollierter behandeln
- `automation-run` schreibt einen eigenen Ops-Audit mit Projekt- und Phasenstatus
- Projektfehler koennen gesammelt und kontrolliert weitergefuehrt werden, statt den Gesamtfluss sofort unsichtbar zu zerlegen
- `automation-jobs` kann Jobs jetzt nach `ready`, `backoff`, `waiting_interval` und `blocked_manual` einordnen
- benannte Automation-Jobs koennen ihren letzten Zustand in `state/automation_jobs_state.json` hinterlegen
- `automation-alerts` verdichtet blockierte oder problematische Jobs fuer den operativen Blick
- `automation-job-clear` erlaubt bewusstes manuelles Resume nach einem Fix
- `automation-dispatch` kann den naechsten bereiten Job als Glue-Schicht fuer Cron/systemd/GitHub Actions starten

Nutzen:

- Rule-Changes bleiben nicht still in alter Queue-Logik haengen
- Reviews basieren konsistenter auf aktuellen Engine-Entscheidungen
- der Kern wird betriebssicherer, bevor spaeter Onboarding oder Produktoberflaechen draufgesetzt werden
