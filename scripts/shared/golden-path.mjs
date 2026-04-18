function uniqueNonEmpty(items) {
  return [...new Set((items ?? []).map((item) => String(item ?? "").trim()).filter(Boolean))];
}

export function buildGoldenPathCommands(projectKey = "my-project") {
  return {
    gettingStarted: "npm run getting-started",
    bootstrap: `npm run bootstrap -- --project ${projectKey} --target ../${projectKey} --label "My Project"`,
    intake: `npm run intake -- --project ${projectKey} https://github.com/example/repo`,
    syncWatchlist: `npm run sync:watchlist -- --project ${projectKey}`,
    reviewWatchlist: `npm run review:watchlist -- --project ${projectKey} --dry-run`,
    showProject: `npm run show:project -- --project ${projectKey}`,
    releaseCheck: "npm run release:check"
  };
}

export function selectPrimaryNextStep(items = []) {
  return uniqueNonEmpty(items)[0] ?? null;
}

export function renderNextCommandSections({ primary = null, additional = [] } = {}) {
  const primaryCommand = String(primary ?? "").trim();
  const additionalCommands = uniqueNonEmpty(additional).filter((item) => item !== primaryCommand);
  const lines = [];

  if (primaryCommand) {
    lines.push("## Next Step", "", `- ${primaryCommand}`);
  }

  if (additionalCommands.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("## Also Useful", "");
    for (const command of additionalCommands) {
      lines.push(`- ${command}`);
    }
  }

  return lines.join("\n");
}
