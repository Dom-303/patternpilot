function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const x of a) if (b.has(x)) intersect += 1;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

class DSU {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x) {
    while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x]; }
    return x;
  }
  union(a, b) {
    const ra = this.find(a); const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

export function clusterByKeywords(repos, { threshold = 0.35 } = {}) {
  const dsu = new DSU(repos.length);
  for (let i = 0; i < repos.length; i += 1) {
    for (let j = i + 1; j < repos.length; j += 1) {
      if (jaccard(repos[i].keywords, repos[j].keywords) >= threshold) {
        dsu.union(i, j);
      }
    }
  }

  const groups = new Map();
  for (let i = 0; i < repos.length; i += 1) {
    const root = dsu.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(repos[i]);
  }

  return [...groups.values()].map((members, idx) => ({
    key: `keyword-${idx}`,
    stage: "keyword",
    members
  }));
}

export { jaccard };
