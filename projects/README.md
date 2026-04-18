# Projects Workspace

`projects/` ist der lesbare Arbeits- und Ergebnisraum von `patternpilot`.

Hier landen projektbezogene Dinge wie:

- `PROJECT_CONTEXT.md`
- Intake-Dossiers
- Reviews
- Promotion-Pakete
- Reports

## Wichtig

`projects/` ist nicht der Produktkern.

Es ist auch nicht der technische Bindungsort.

Die technische Seite liegt immer getrennt unter:

- `bindings/<project>/`

## Frischer Produktzustand

Bei einer frischen Installation kann `projects/` leer sein.

Neue Unterordner entstehen erst, wenn du selbst ein Zielprojekt anlegst:

```bash
npm run init:project -- --project my-project --target ../my-project --label "My Project"
```

## Wenn du ein Beispiel sehen willst

Nutze das fiktive Referenzpaket unter:

[examples/demo-city-guide/README.md](/home/domi/eventbaer/dev/patternpilot/examples/demo-city-guide/README.md:1)
