export function markRelation(cluster, signature) {
  if (!signature || signature.length === 0) return "divergent";
  const pool = new Set();
  for (const member of cluster.members ?? []) {
    for (const kw of member.keywords ?? []) pool.add(kw);
  }
  let overlap = 0;
  for (const token of signature) if (pool.has(token)) overlap += 1;

  const ratio = overlap / signature.length;
  if (ratio >= 2 / 3) return "near_current_approach";
  if (overlap >= 1) return "adjacent";
  return "divergent";
}
