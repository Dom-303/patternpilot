export async function runRerunMenu({ prompter, config }) {
  const projects = Object.keys(config.projects ?? {});
  const def = config.defaultProject;

  prompter.write("\nPatternpilot ist bereits eingerichtet.\n\n");
  prompter.write("  Konfigurierte Projekte:\n");
  for (const p of projects) {
    prompter.write(`    - ${p}${p === def ? "  (Default)" : ""}\n`);
  }
  prompter.write("\n");

  const choice = await prompter.choose("Was möchtest du tun?", [
    { key: "A", label: "Neues Projekt hinzufügen" },
    { key: "E", label: "Existierendes Projekt editieren" },
    { key: "T", label: "GitHub-Token erneuern oder ändern" },
    { key: "D", label: "Default-Projekt wechseln" },
    { key: "Z", label: "Zurück (nichts ändern)", default: true }
  ]);

  if (choice === "A") return { intent: "add-project" };
  if (choice === "T") return { intent: "reauth" };
  if (choice === "Z") return { intent: "cancel" };

  const projectChoice = await prompter.choose(
    "Welches Projekt?",
    projects.map((p, i) => ({ key: String(i + 1), label: p, default: p === def }))
  );
  const project = projects[Number(projectChoice) - 1];

  if (choice === "E") return { intent: "edit-project", project };
  if (choice === "D") return { intent: "set-default", project };
}
