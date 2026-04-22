/**
 * lib/discovery/pass.mjs
 *
 * Thin orchestration layer for problem:explore discovery.
 * Wraps discoverGithubCandidates with minimal project-binding setup
 * and returns a flat repo shape that the Phase 4 problem-mode primitives
 * (problem-constraints, problem-ranking, problem-diversity) can consume.
 *
 * Strategy: Strategy A (pragmatic, project-bound).
 * Standalone mode (no projectKey) is NOT supported — discoverGithubCandidates
 * requires a full project binding. Standalone callers receive an explicit error.
 * TODO: support standalone mode by exporting searchGithubRepositories from
 *       lib/discovery/search.mjs and calling it directly with problem queries.
 */

import {
  loadProjectBinding,
  loadProjectAlignmentRules,
  loadProjectProfile
} from "../project.mjs";
import { discoverGithubCandidates } from "./search.mjs";

/**
 * Run a single discovery pass tuned for problem-mode.
 *
 * @param {object} params
 * @param {string}   params.rootDir        - patternpilot root directory
 * @param {object}   params.config         - loaded patternpilot config
 * @param {string}   params.projectKey     - required; standalone not yet supported
 * @param {string[]} params.queries        - problem query strings from buildProblemQueryFamily
 * @param {string}   [params.depth]        - discovery depth profile (e.g. "quick", "standard")
 * @param {boolean}  [params.standalone]   - if true, returns an error (not yet supported)
 * @returns {Promise<{ repos: FlatRepo[], error?: string }>}
 */
export async function runDiscoveryPass({ rootDir, config, projectKey, queries, depth, standalone }) {
  if (standalone || !projectKey) {
    // TODO: implement standalone path by exposing searchGithubRepositories from search.mjs
    //       and calling it directly per query string. For now, require projectKey.
    return {
      repos: [],
      error: "standalone_not_supported: problem:explore requires --project <key> for real discovery"
    };
  }

  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const projectProfile = await loadProjectProfile(rootDir, project, binding, alignmentRules);

  // Inject problem queries as a priorityCohort so buildDiscoveryPlan incorporates
  // them as familySignals alongside the normal project-based query planning.
  // This is additive — the existing broad/signal-lane plans still run.
  const injectedSeeds = queries.length > 0
    ? {
        priorityCohorts: [
          {
            id: "problem-mode-queries",
            label: "Problem discovery",
            signals: queries,
            boundarySignals: [],
            why: "problem:explore injected query seeds"
          }
        ]
      }
    : null;

  const discovery = await discoverGithubCandidates(
    rootDir,
    config,
    project,
    binding,
    alignmentRules,
    projectProfile,
    {
      discoveryProfile: depth ?? "standard",
      discoverySeeds: injectedSeeds,
      // Skip heavy README/license enrichment to keep problem-mode fast.
      // The primitives only need topics, description, language, and keywords.
      skipEnrich: true,
      // Disable policy blocking so problem-mode can surface even borderline repos
      // for human review; scoring + diversity selection act as the quality gate.
      discoveryPolicyMode: "off"
    }
  );

  // Normalize each candidate into the flat shape expected by problem-mode primitives.
  // Fields: url, owner, name, description, language, topics, readme, license,
  //         dependencies, id (used by selectWithDiversity)
  const repos = discovery.candidates.map((candidate) => {
    const repo = candidate.repo ?? {};
    const enrichment = candidate.enrichment ?? {};
    return {
      id: repo.normalizedRepoUrl ?? `${repo.owner}/${repo.name}`,
      url: repo.normalizedRepoUrl ?? null,
      owner: repo.owner ?? null,
      name: repo.name ?? null,
      description: repo.description ?? null,
      language: repo.language ?? null,
      topics: Array.isArray(repo.topics) ? repo.topics : [],
      readme: enrichment.readme ?? null,
      license: enrichment.licenseId ?? null,
      dependencies: Array.isArray(enrichment.dependencies) ? enrichment.dependencies : []
    };
  });

  return { repos };
}
