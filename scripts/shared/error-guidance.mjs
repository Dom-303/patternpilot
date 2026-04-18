import {
  buildGoldenPathCommands,
  renderNextCommandSections
} from "./golden-path.mjs";

function extractUnknownProject(message) {
  const match = String(message ?? "").match(/Unknown project '([^']+)'/i);
  return match?.[1] ?? null;
}

function extractWatchlistProject(message, fallbackProject = null) {
  const match = String(message ?? "").match(/Project '([^']+)' has no watchlistFile configured/i);
  return match?.[1] ?? fallbackProject;
}

export function buildCommandFailureGuidance(message, context = {}) {
  const text = String(message ?? "");
  const projectKey = context.projectKey ?? null;
  const commands = buildGoldenPathCommands(projectKey || "my-project");

  if (/No project is configured yet/i.test(text)) {
    return renderNextCommandSections({
      primary: commands.bootstrap,
      additional: [commands.gettingStarted]
    });
  }

  const unknownProject = extractUnknownProject(text);
  if (unknownProject) {
    const projectCommands = buildGoldenPathCommands(unknownProject);
    return renderNextCommandSections({
      primary: "npm run list:projects",
      additional: [projectCommands.bootstrap, commands.gettingStarted]
    });
  }

  if (/No GitHub URLs supplied/i.test(text)) {
    return renderNextCommandSections({
      primary: commands.intake,
      additional: [commands.syncWatchlist, commands.gettingStarted]
    });
  }

  if (/has no watchlistFile configured and no explicit URLs were supplied/i.test(text)) {
    return renderNextCommandSections({
      primary: commands.intake,
      additional: [commands.showProject, commands.syncWatchlist]
    });
  }

  const watchlistProject = extractWatchlistProject(text, projectKey);
  if (watchlistProject) {
    const watchlistCommands = buildGoldenPathCommands(watchlistProject);
    return renderNextCommandSections({
      primary: `edit bindings/${watchlistProject}/WATCHLIST.txt`,
      additional: [watchlistCommands.intake, watchlistCommands.showProject]
    });
  }

  if (/Target project path does not exist or is not a directory/i.test(text)) {
    return renderNextCommandSections({
      primary: commands.bootstrap,
      additional: [commands.gettingStarted]
    });
  }

  return null;
}
