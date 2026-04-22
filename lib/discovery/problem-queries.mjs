export function buildProblemQueryFamily({ seeds, budget }) {
  if (!Array.isArray(seeds) || seeds.length === 0) return [];
  return seeds.slice(0, budget);
}

export function buildCrossFamily({ projectSeeds, problemSeeds, budget }) {
  if (!projectSeeds?.length || !problemSeeds?.length) return [];
  const combos = [];
  for (const ps of projectSeeds) {
    for (const qs of problemSeeds) {
      combos.push(`${ps} ${qs}`);
      if (combos.length >= budget) return combos;
    }
  }
  return combos;
}

export function splitBudget({ totalBudget, standalone }) {
  if (standalone) return { project: 0, problem: totalBudget, cross: 0 };
  const project = Math.floor(totalBudget * 0.4);
  const cross = Math.floor(totalBudget * 0.2);
  const problem = totalBudget - project - cross;
  return { project, problem, cross };
}
