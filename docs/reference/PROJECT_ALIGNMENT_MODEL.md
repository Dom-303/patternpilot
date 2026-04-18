# Project Alignment Model

## Zweck

Dieses Dokument beschreibt die Stage-3-Erweiterung von `patternpilot`.

Stage 3 bedeutet:

- externe Repos werden nicht nur beschrieben
- sie werden gegen ein konkretes Zielprojekt gelesen
- daraus entstehen projektgebundene Fit-, Risk- und Next-Step-Signale

## Kernidee

Jedes Zielprojekt kann eigene Alignment-Regeln mitbringen.

Bei einem Zielprojekt passiert das ueber:

- `bindings/<project>/PROJECT_BINDING.json`
- `bindings/<project>/ALIGNMENT_RULES.json`

## Was Stage 3 erzeugt

Bei jedem Intake kann Patternpilot jetzt zusaetzlich ableiten:

- welche Projektfaehigkeiten getroffen werden
- welche Worker-Bereiche relevant sind
- wie stark der Fit zum operativen Kern ist
- welche Spannung zwischen Pattern und Zielarchitektur besteht
- welcher naechste Review- oder Umsetzungszug sinnvoll ist

## Warum das wichtig ist

Ohne diese Schicht bleibt ein Repo-Review zu generisch.

Mit dieser Schicht wird aus

- "interessantes Repo"

eher

- "interessant fuer genau diese Worker-Schicht"
- "gut fuer spaetere Distribution, aber nicht fuer den Kern"
- "stark fuer Source Systems, schwach fuer Governance"

## Langfristige Richtung

Das Alignment-Modell ist bewusst projektgebunden und produktneutral.

Die Struktur soll spaeter fuer weitere Projekte wiederverwendbar sein:

- anderes Zielrepo
- andere Bindung
- andere Alignment-Regeln
- gleicher Patternpilot-Kern
