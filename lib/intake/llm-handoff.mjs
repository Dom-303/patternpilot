import path from "node:path";

export function intakeSummaryPromptPath(intakeDocPath) {
  const dir = path.dirname(intakeDocPath);
  const baseWithoutExt = path.basename(intakeDocPath, path.extname(intakeDocPath));
  return path.join(dir, `${baseWithoutExt}.summary-prompt.md`);
}

export function buildIntakeSummaryPrompt({
  dossierContent,
  repoSlug,
  repoUrl,
  projectKey,
  projectLabel
}) {
  return `# Intake-Summary Prompt für Pattern Pilot

**Was das ist:** Patternpilot hat soeben das Repo **${repoUrl}** in das Intake-Dossier von Projekt **${projectLabel}** (\`${projectKey}\`) aufgenommen. Dieser Prompt hilft dir, mit deinem bevorzugten LLM (Claude / ChatGPT / Gemini / etc.) eine strukturierte Bewertung zu erzeugen, die du dann manuell zurück in die Dossier-Datei \`${repoSlug}.md\` paste.

**Workflow:**
1. Kopiere den GESAMTEN Inhalt unter dem "---"-Separator in dein LLM
2. Wenn du möchtest, ergänze am Ende deine eigene Sicht ("ich glaube X ist relevant für uns weil…")
3. Übernimm die strukturierte LLM-Antwort als neuen Abschnitt \`## LLM-Augmented Summary\` in das Dossier — markiert als LLM-generated, please verify

---

Du bist ein Research-Assistent. Lies das folgende Patternpilot-Intake-Dossier und erzeuge eine **strukturierte 4-Felder-Bewertung** im Markdown-Format.

**Kontext:** Patternpilot ist ein Repo-Intelligence-Tool. Jeder Intake wird relativ zu einem Zielprojekt bewertet. Hier ist das Zielprojekt: **${projectLabel}** (\`${projectKey}\`).

**Dein Job:** Verdichte das Dossier zu vier prägnanten Feldern — keine Wiederholung der Rohdaten, sondern Interpretation. Halluziniere nichts, was nicht im Dossier oder in der README erkennbar ist.

## Output-Format (genau diese Struktur, in Markdown)

\`\`\`markdown
## LLM-Augmented Summary

**Was es macht (1-2 Sätze):**
<eine prägnante Erklärung der Kernfunktion>

**Strengths (2-3 Bullets):**
- <konkrete technische oder konzeptionelle Stärke>
- <…>

**Weaknesses / Limits (2-3 Bullets):**
- <konkrete Schwäche, Risiko oder Limit>
- <…>

**Suggested category** (eine der: connector / aggregator / framework / plugin / product_surface / enricher / research_signal):
\`<category>\`

**Suggested pattern_family** (kurz, 1-3 Wörter, beschreibt das Grundmuster):
\`<pattern_family>\`

**Relevance for ${projectLabel}** (1-2 Sätze, konkret):
<warum das für ${projectLabel} interessant oder irrelevant ist>

> _LLM-generated, please verify_
\`\`\`

## Das Intake-Dossier

\`\`\`markdown
${dossierContent}
\`\`\`

---

**Optional:** Deine eigene Sicht (was an dem Repo dich besonders interessiert oder skeptisch macht):

<<HIER deine formlosen Gedanken einfügen — oder leer lassen>>
`;
}
