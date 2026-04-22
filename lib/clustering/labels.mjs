export function buildClusterLabel(cluster, { topN = 3 } = {}) {
  const frequency = new Map();
  for (const member of cluster.members) {
    for (const token of member.keywords ?? []) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  if (frequency.size === 0) return "unlabeled";

  const sorted = [...frequency.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([token]) => token)
    .sort();

  return sorted.join("+");
}
