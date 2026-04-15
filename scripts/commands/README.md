# Patternpilot Command Modules

Diese Ebene ist die kuenftige Werkzeug-Familien-Schicht fuer `patternpilot`.

Ziel:

- `scripts/patternpilot.mjs` bleibt nur der duenner CLI-Einstieg
- Command-Familien ziehen schrittweise in eigene Dateien unter `scripts/commands/`
- `lib/` bleibt weiterhin die Engine- und Fachlogik-Schicht

Phase 1 legt diese Struktur bewusst zuerst als Zielpfad an, bevor groessere Command-Bloecke umgezogen werden.
