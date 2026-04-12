# Automation Roadmap

## Ziel

Diese Roadmap beschreibt die sinnvollen Ausbaustufen von `patternpilot` vom heutigen Startpunkt bis zur spaeteren Vollautomatisierung.

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

---

## Stufe 2: Assistierter Review

Status: jetzt umgesetzt

Was dazu kommt:

- GitHub-Metadaten automatisch anreichern
- Repo-Readme oder Kerninfos in das Dossier ziehen
- Review-Fragen halbautomatisch vorbefuellen
- Promotion-Kandidaten fuer `repo_landkarte.csv` vorschlagen
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
- halbautomatische Updates fuer `repo_landkarte.csv`
- candidate sections fuer `repo_learnings.md` und `repo_decisions.md`
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
- der Kern bleibt bewusst ohne LLM und arbeitet zuerst mit GitHub-Metadaten, Readmes und projektbezogenen Regeln

Nutzen:

- Patternpilot wartet nicht mehr nur auf manuell eingegebene Links
- passende Repositories koennen systematischer und stabiler gefunden werden
- die spaetere optionale LLM-Schicht wird auf ein sauberes, verifiziertes Fundament gesetzt
