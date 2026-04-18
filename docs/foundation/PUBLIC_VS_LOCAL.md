# Public vs. Local

## Die einfache Regel

Wenn du `patternpilot` in genau einem oeffentlichen GitHub-Repo fuehrst, gilt:

- Alles, was committed und gepusht ist, ist oeffentlich.
- Alles, was ignoriert oder nur lokal vorhanden ist, bleibt lokal.

Es gibt hier keinen geheimen Zwischenzustand.

## Was typischerweise oeffentlich ist

- Produktcode unter `lib/`, `scripts/`, `automation/`, `deployment/`
- Tests unter `test/`
- Doku unter `docs/`
- bewusst gepflegte Referenzdateien unter `examples/`, `knowledge/`, `taxonomy/`
- versionierte Projekt- und Binding-Struktur, wenn du sie bewusst mit ins Repo nimmst

## Was typischerweise lokal bleibt

- `patternpilot.config.local.json`
- die meisten `state/*.json` und `state/*.md` Dateien
- lokale Alert-Digests und Runtime-Snapshots
- datierte Run-Artefakte unter `runs/`
- frisch erzeugte Reports und viele laufbezogene Dateien unter `projects/<project>/...`
- lokale Operator-Dateien wie `STATUS.md` und `OPEN_QUESTION.md`

## Was mit Testdaten ist

Testdaten sind nur dann lokal, wenn sie nicht versioniert sind.

Wenn eine Testdatei unter `test/` committed ist, ist sie Teil des oeffentlichen Repos.
Darum sollten dort keine privaten Kundeninterna, Tokens oder vertraulichen Inhalte stehen.

## Was mit `state/` ist

`state/` ist gemischt:

- `state/repo_intake_queue.csv` kann bewusst als persistente Arbeitsdatei versioniert werden
- Alert-, Digest-, Dispatch- und Runtime-Dateien in `state/` sind bewusst lokale Betriebsartefakte

Wenn du maximal sauber trennen willst, ist die richtige Denkweise:

- Produktwahrheit und Referenzwissen duerfen ins Repo
- laufende Betriebszustandsdateien gehoeren nicht ins oeffentliche Repo

## Was mit `projects/` ist

`projects/` ist kein reiner Code-Ordner.
Es ist der Arbeits- und Ergebnisraum pro Zielprojekt.

Darum gilt dort bewusst eine Trennung:

- langlebige Struktur und Referenzdateien koennen versioniert sein
- frische Intake-, Review-, Promotion- und Report-Artefakte bleiben lokal oder werden gezielt kuratiert

## Empfehlung fuer den Betrieb

Wenn du `patternpilot` selbst nutzt und spaeter oeffentlich anbietest, ist das robusteste Modell:

1. Das Produkt-Repo bleibt oeffentlich und sauber.
2. Lokale Betriebsdaten bleiben ignoriert.
3. Reale Kunden- oder interne Projektinhalte werden nur dann committed, wenn sie ausdruecklich oeffentlich sein duerfen.

So bleibt `patternpilot` ein Produkt und wird nicht versehentlich zu einem Leak-Container fuer Betriebszustand.
