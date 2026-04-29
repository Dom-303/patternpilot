export function renderStaleDataBanner(summary, projectKey) {
  if (!summary || summary.totalStale === 0) return "";

  const lines = [
    "",
    `╭── Stale data notice ──────────────────────────`,
    `│  ${summary.totalStale} stale entr${summary.totalStale === 1 ? "y" : "ies"} in project '${projectKey}'`
  ];

  const reasons = Object.entries(summary.byReason)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${reason} (${count})`);
  if (reasons.length > 0) {
    lines.push(`│  drift reasons: ${reasons.join(", ")}`);
  }

  for (const url of summary.examples) {
    lines.push(`│    - ${url}`);
  }

  lines.push(`│`);
  lines.push(`│  Refresh with:  npm run re-evaluate -- --project ${projectKey} --stale-only`);
  lines.push(`╰────────────────────────────────────────────`);
  lines.push("");

  return lines.join("\n");
}
