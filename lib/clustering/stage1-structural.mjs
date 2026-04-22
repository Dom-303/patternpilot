function keyOf(repo) {
  return `${repo.pattern_family ?? "unknown"}|${repo.main_layer ?? "unknown"}`;
}

export function clusterByStructure(repos) {
  const groups = new Map();
  for (const repo of repos) {
    const k = keyOf(repo);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(repo);
  }

  const clusters = [];
  const outliers = [];
  for (const [key, members] of groups.entries()) {
    if (members.length < 2) {
      outliers.push(...members);
      continue;
    }
    const [pattern_family, main_layer] = key.split("|");
    clusters.push({
      key,
      stage: "structural",
      pattern_family,
      main_layer,
      members,
      has_suggested_members: members.some((m) => m.pattern_family_source === "suggested")
    });
  }
  return { clusters, outliers };
}
