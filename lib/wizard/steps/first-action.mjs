export async function runFirstActionStep({
  prompter, state, replay = null,
  githubAvailable = true
} = {}) {
  if (replay) {
    const value = replay.get("first_action");
    state.recordStep("first-action", { value });
    if (value === "intake") return { action: "intake", url: replay.get("first_action_url") };
    if (value === "problem") return { action: "problem", question: replay.get("first_action_question") };
    return { action: value };
  }

  prompter.write("\n[5/5] Gleich loslegen?\n\n");
  const choice = await prompter.choose("> ", [
    { key: "nothing", label: "Nichts (Setup speichern und beenden)", default: true },
    { key: "intake", label: "intake    — eine bekannte Repo-URL einlesen" },
    { key: "discover", label: "discover  — automatisch passende Repos im GitHub-Universum suchen" },
    { key: "problem", label: "problem   — eine konkrete Frage formulieren und dazu eine Repo-Landschaft erzeugen" }
  ]);

  if ((choice === "intake" || choice === "discover") && !githubAvailable) {
    prompter.write(`\n  ${choice} braucht einen GitHub-Token. Wird übersprungen.\n`);
    state.recordStep("first-action", { value: "nothing", reason: `${choice}-needs-token` });
    return { action: "nothing" };
  }

  if (choice === "intake") {
    const url = await prompter.ask("URL:");
    state.recordStep("first-action", { value: "intake", url });
    return { action: "intake", url };
  }
  if (choice === "problem") {
    const question = await prompter.ask("Welche Frage willst du beantworten? (ein Satz)");
    state.recordStep("first-action", { value: "problem", question });
    return { action: "problem", question };
  }

  state.recordStep("first-action", { value: choice });
  return { action: choice };
}
