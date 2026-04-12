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

Sehr sinnvoll fuer EventBaer

Was dazu kommt:

- Patternpilot liest definierte Referenzdateien aus dem Zielrepo automatisch
- externe Muster werden gegen bekannte Worker-Schichten gemappt
- Luecken und Anschlussfaehigkeit werden konkreter benannt

Nutzen:

- externe Repos werden nicht nur beschrieben, sondern gegen reale Projektarchitektur geprueft

---

## Stufe 4: Teilautomatische Decision-Promotion

Spaetere Ausbaustufe

Was dazu kommt:

- Vorschlaege fuer `repo_learnings.md` und `repo_decisions.md`
- Watchlists und Clusterbildung ueber aehnliche Repos
- priorisierte Review-Queues je Gap Area oder Pattern Family

Nutzen:

- Patternpilot wird vom Intake-Werkzeug zur echten Entscheidungsmaschine

---

## Stufe 5: Repo-/Workspace-Plugin-Modus

Endstufe

Was dazu kommt:

- Patternpilot dockt als Erweiterung an beliebige Repos an
- Projektbindung wird einmal konfiguriert und danach automatisch genutzt
- neue GitHub-Links, Watchlists oder Quellen koennen automatisch eingespeist werden
- der Kontext fuer das Zielprojekt wird aktiv mitgefuehrt

Nutzen:

- Patternpilot wird zu einem wiederverwendbaren Meta-System statt zu einer Einmal-Loesung fuer EventBaer
