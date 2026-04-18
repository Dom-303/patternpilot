# State

Dieser Ordner enthaelt operative, laufende Zustandsdateien von `patternpilot`.

Aktuell liegt hier:

- `repo_intake_queue.csv`

Die Queue ist bewusst keine kuratierte Wahrheit, sondern die operative Vorstufe vor Review, Promotion und Wissensuebernahme.

Nicht alles unter `state/` hat denselben Charakter:

- `repo_intake_queue.csv` ist persistente Arbeitsdatenhaltung fuer Intake und Review-Fortschritt.
- `automation_*.json`, `automation_*.md` und `runtime_context.json` sind ephemere Laufzeit-/Alert-/Operator-Artefakte.

Faustregel:

- Persistente Arbeitsdaten duerfen bewusst versioniert werden, wenn sie Teil der Produktwahrheit sein sollen.
- Laufzeit-Snapshots, Dispatch-Historien, Alert-Digests und letzte CLI-Kontexte sollten nicht nach GitHub.
