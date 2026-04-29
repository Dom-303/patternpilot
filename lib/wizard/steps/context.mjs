import { detectProjectContext } from "../detect/project-context.mjs";
import { detectWatchlistSeed } from "../detect/npm-watchlist-seed.mjs";

export async function runContextStep({
  prompter, state, replay = null,
  targetPath,
  detectFn = detectProjectContext,
  seedFn = detectWatchlistSeed
} = {}) {
  const context = detectFn(targetPath);
  const seed = await seedFn(targetPath);

  if (replay) {
    const action = replay.get("context");
    state.recordStep("context", { value: action });
    return { context, watchlistSeed: seed };
  }

  prompter.write("\n[2/5] Erkannter Projekt-Kontext (bitte bestätigen):\n\n");
  prompter.write(`  Label:           "${context.label}"\n`);
  prompter.write(`  Sprache:         ${context.language}\n`);
  prompter.write(`  Domäne-Hinweis:  ${context.domainHint || "-"}\n`);
  prompter.write(`  Context-Files:   ${context.contextFiles.join(", ")}\n`);
  prompter.write(`  Watchlist-Seed:  ${formatSeed(seed)}\n\n`);

  const ans = await prompter.choose("> ", [
    { key: "Y", label: "passt", default: true },
    { key: "E", label: "anpassen" }
  ]);

  if (ans === "Y") {
    state.recordStep("context", { value: "accepted" });
    return { context, watchlistSeed: seed };
  }

  const edited = await editLoop(prompter, context);
  state.recordStep("context", { value: "edited", edits: edited.fields });
  return { context: edited.context, watchlistSeed: seed };
}

function formatSeed(seed) {
  if (seed.status === "offline") return "(übersprungen — kein Netz)";
  if (seed.urls.length === 0) return "(keine GitHub-Dependencies erkannt)";
  return `${seed.urls.length} Repos aus dependencies erkannt`;
}

async function editLoop(prompter, ctx) {
  const fields = [];
  while (true) {
    const choice = await prompter.choose("Was anpassen?", [
      { key: "L", label: `Label  (aktuell: ${ctx.label})` },
      { key: "S", label: `Sprache  (aktuell: ${ctx.language})` },
      { key: "D", label: `Domäne  (aktuell: ${ctx.domainHint})` },
      { key: "X", label: "Fertig", default: true }
    ]);
    if (choice === "X") return { context: ctx, fields };
    if (choice === "L") { ctx = { ...ctx, label: await prompter.ask("Label:") }; fields.push("label"); }
    if (choice === "S") { ctx = { ...ctx, language: await prompter.ask("Sprache:") }; fields.push("language"); }
    if (choice === "D") { ctx = { ...ctx, domainHint: await prompter.ask("Domäne:") }; fields.push("domainHint"); }
  }
}
