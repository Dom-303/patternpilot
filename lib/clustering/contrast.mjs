function countTokens(clusters) {
  const counts = new Map();
  let memberTotal = 0;
  for (const cluster of clusters) {
    for (const member of cluster.members ?? []) {
      memberTotal += 1;
      for (const token of member.keywords ?? []) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
  }
  return { counts, memberTotal };
}

export function buildSignatureContrast(target, others, { topN = 3 } = {}) {
  const { counts: targetCounts, memberTotal: targetTotal } = countTokens([target]);
  const { counts: otherCounts, memberTotal: otherTotal } = countTokens(others);

  if (targetTotal === 0) return [];

  const scores = [];
  for (const [token, tCount] of targetCounts.entries()) {
    const targetFreq = tCount / targetTotal;
    const otherFreq = otherTotal === 0 ? 0 : (otherCounts.get(token) ?? 0) / otherTotal;
    const delta = targetFreq - otherFreq;
    if (delta > 0) scores.push([token, delta]);
  }

  scores.sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  return scores.slice(0, topN).map(([token]) => token);
}
