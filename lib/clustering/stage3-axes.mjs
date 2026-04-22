import { normalizeKeyword } from "./keywords.mjs";

function tokenizeAxis(axis) {
  return new Set(
    axis.toLowerCase().split(/[^a-z0-9-]+/).filter((t) => t.length >= 3).map(normalizeKeyword)
  );
}

function overlapCount(a, b) {
  let n = 0;
  for (const x of a) if (b.has(x)) n += 1;
  return n;
}

export function mapToAxes(repos, axisDefinitions) {
  const axes = axisDefinitions.map((label) => ({ label, tokens: tokenizeAxis(label), members: [] }));
  const unmatched = [];

  for (const repo of repos) {
    let best = null;
    let bestOverlap = 0;
    for (const axis of axes) {
      const n = overlapCount(repo.keywords, axis.tokens);
      if (n > bestOverlap) { bestOverlap = n; best = axis; }
    }
    if (best) best.members.push(repo); else unmatched.push(repo);
  }

  return {
    axes: axes.map((a) => ({
      label: a.label,
      members: a.members,
      status: a.members.length === 0 ? "axis_not_found_in_landscape" : "ok"
    })),
    unmatched
  };
}
