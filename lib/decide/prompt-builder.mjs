import path from "node:path";

export function decidePromptPath(rootDir, projectKey, repoUrl) {
  const slug = repoUrlToSlug(repoUrl);
  return path.join(rootDir, "projects", projectKey, "decisions", `${slug}.decide-prompt.md`);
}

function repoUrlToSlug(repoUrl) {
  const match = String(repoUrl ?? "").match(/github\.com[/:]([^/]+)\/([^/.#?]+)/);
  if (!match) return "unknown";
  return `${match[1]}-${match[2]}`.toLowerCase();
}

export function buildDecidePrompt({
  projectKey,
  projectLabel,
  projectContextSnippet,
  queueEntry,
  landkarteEntry
}) {
  const lkBlock = landkarteEntry
    ? renderLandkarteBlock(landkarteEntry)
    : "_(noch nicht in der Landkarte — Repo wurde nur intaket, aber noch nicht promovet)_";

  return `# Decision-Prompt für Pattern Pilot

**Was das ist:** Du sollst entscheiden, wie das Repo **${queueEntry.normalized_repo_url || queueEntry.repo_url}** im Kontext von **${projectLabel}** (\`${projectKey}\`) behandelt wird. Patternpilot's Entscheidungs-Klassen sind **adopt / adapt / observe / ignore**.

**Workflow:**
1. Kopiere den Inhalt unter dem "---"-Separator in dein bevorzugtes LLM (Claude / ChatGPT / Gemini / etc.)
2. Wenn du möchtest, ergänze am Ende deine eigene Sicht
3. Übernimm die Entscheidung manuell in \`knowledge/repo_decisions.md\` und/oder als \`decision\`-Feld in \`knowledge/repo_landkarte.csv\`

---

Du bist ein Strategie-Assistent für ein technisches Projekt. Lies den folgenden Kontext und gib eine **klare, begründete Entscheidung** im Format adopt / adapt / observe / ignore.

## Projekt-Kontext (${projectLabel})

${projectContextSnippet}

## Repo-Eintrag (Queue)

- url: ${queueEntry.normalized_repo_url || queueEntry.repo_url}
- project_key: ${queueEntry.project_key}
${queueEntry.decision_data_state ? `- decision_data_state: ${queueEntry.decision_data_state}\n` : ""}

## Landkarte-Eintrag

${lkBlock}

## Patternpilot's Entscheidungs-Klassen

- **adopt** — direkt übernehmbar, keine größeren Anpassungen nötig
- **adapt** — Grundidee wertvoll, aber nur in angepasster Form sinnvoll
- **observe** — strategisch im Blick behalten, jetzt nicht handeln
- **ignore** — nicht relevant oder nicht tragfähig

## Output-Format

\`\`\`markdown
## LLM-Suggested Decision

**Empfehlung:** \`<adopt|adapt|observe|ignore>\`

**Begründung (3-4 Sätze):**
<warum diese Klasse, ehrlich, mit konkretem Bezug zu ${projectLabel}>

**Konkreter nächster Schritt (1 Satz):**
<was sollte ${projectLabel} jetzt damit tun, oder bewusst nicht tun>

**Risiken/Caveats (1-2 Bullets):**
- <was schiefgehen könnte oder was übersehen sein könnte>

> _LLM-suggested, please verify before promoting to repo_decisions.md_
\`\`\`

---

**Optional:** Deine eigene Sicht auf dieses Repo:

<<HIER deine formlosen Gedanken einfügen — oder leer lassen>>
`;
}

function renderLandkarteBlock(entry) {
  const fields = [
    ["name", entry.name],
    ["category", entry.category],
    ["pattern_family", entry.pattern_family],
    ["main_layer", entry.main_layer],
    ["maturity", entry.maturity],
    ["strengths", entry.strengths],
    ["weaknesses", entry.weaknesses],
    ["risks", entry.risks],
    ["learning_for_project", entry.learning_for_project],
    ["build_vs_borrow", entry.build_vs_borrow]
  ].filter(([, v]) => v != null && String(v).trim() !== "");
  return fields.map(([k, v]) => `- ${k}: ${v}`).join("\n");
}
