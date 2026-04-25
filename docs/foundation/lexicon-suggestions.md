# Lexicon Suggestions

- generated_at: 2026-04-25T21:28:57.027Z
- scope: all-projects (3)
- runs_analyzed: 73
- unknown_member_pool_size: 22

## Vorgeschlagene Kandidaten-Tokens


| Token | Auftritt in Members | Coverage |
| --- | --- | --- |
| schema | 10 | 45.5 % |
| data | 7 | 31.8 % |
| json | 4 | 18.2 % |
| linkage | 4 | 18.2 % |
| matching | 4 | 18.2 % |
| record | 4 | 18.2 % |
| across | 3 | 13.6 % |
| analytics | 3 | 13.6 % |
| config | 3 | 13.6 % |
| fastapi | 3 | 13.6 % |
| match | 3 | 13.6 % |
| model | 3 | 13.6 % |
| pipeline | 3 | 13.6 % |
| similarity | 3 | 13.6 % |
| using | 3 | 13.6 % |

## So uebernimmst du einen Vorschlag

1. Pruefe das Token semantisch: ist es eine echte Pattern-Familie (z.B. `wrapper-induction`) oder bloss ein generisches Wort (`framework`)?
2. Wenn ja: erweitere `lib/clustering/pattern-family-lexicon.json` ODER `bindings/<project>/PATTERN_FAMILY_LEXICON.json` mit einem Eintrag wie:

```json
{
  "label": "wrapper-induction",
  "keywords": ["wrapper induction", "wrapper learning", "automatic wrapper"],
  "min_matches": 1
}
```

3. Re-run `npm run problem:explore` und pruefe, ob `pattern_family_summary.classified_ratio` steigt.

