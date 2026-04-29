export async function runDiscoveryStep({
  prompter, state, replay = null,
  githubAvailable = true
} = {}) {
  if (replay) {
    const value = replay.get("discovery");
    state.recordStep("discovery", { value });
    return { profile: value };
  }

  prompter.write("\n[4/5] Wie breit soll Discovery suchen?\n\n");

  if (!githubAvailable) {
    prompter.write("  Discovery braucht einen GitHub-Token. Default `balanced` wird\n");
    prompter.write("  gespeichert und greift, sobald du den Token nachreichst.\n\n");
    state.recordStep("discovery", { value: "balanced", note: "deferred-no-token" });
    return { profile: "balanced" };
  }

  const choice = await prompter.choose("> ", [
    { key: "balanced", label: "balanced   empfohlen — solide Treffer, wenig Rauschen", default: true },
    { key: "focused", label: "focused    eng am Projekt — weniger, aber sehr passende Treffer" }
  ]);
  state.recordStep("discovery", { value: choice });
  return { profile: choice };
}
