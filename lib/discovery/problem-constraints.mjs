const LICENSE_COMPAT = {
  "license:apache-compatible": new Set([
    "APACHE-2.0", "MIT", "BSD-2-CLAUSE", "BSD-3-CLAUSE", "ISC", "CC0-1.0"
  ])
};

function licenseIncompatible(repoLicense, tag) {
  const set = LICENSE_COMPAT[tag];
  if (!set) return false;
  return !set.has((repoLicense ?? "").toUpperCase());
}

export function applyHardConstraints(repos, constraintTags) {
  const kept = [];
  for (const repo of repos) {
    let reject = false;
    const warnings = [];
    for (const tag of constraintTags ?? []) {
      if (tag.startsWith("license:")) {
        if (!repo.license) { warnings.push("license_unknown"); continue; }
        if (licenseIncompatible(repo.license, tag)) { reject = true; break; }
      }
    }
    if (reject) continue;
    kept.push(warnings.length > 0 ? { ...repo, constraint_warnings: warnings } : repo);
  }
  return kept;
}

export function applySoftBoost(repo, techTags, bonusPerMatch = 0.05) {
  const keywords = repo.keywords ?? new Set();
  let boost = 0;
  for (const tag of techTags ?? []) if (keywords.has(tag)) boost += bonusPerMatch;
  return { ...repo, score: (repo.score ?? 0) + boost };
}
