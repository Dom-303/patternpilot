/**
 * lib/discovery/pass.mjs
 *
 * Standalone discovery pass for problem:explore.
 * One GitHub search per problem phrase, verbatim — no project anchor in the
 * query string. Project context re-enters at the ranking / clustering /
 * brief stages, not here.
 *
 * Spec: docs/superpowers/specs/2026-04-22-problem-mode-standalone-search-design.md
 */

import { searchGithubRepositories } from "./search.mjs";

/**
 * @param {object} params
 * @param {object}   params.config       - loaded patternpilot config
 * @param {string}   params.projectKey   - required for the caller contract
 *                                         (ranking downstream needs it)
 * @param {string[]} params.queries      - verbatim problem phrases
 * @param {Function} [params.searchFn]   - optional injection point for tests;
 *                                         defaults to searchGithubRepositories
 * @returns {Promise<{ repos: FlatRepo[], error?: string }>}
 */
export async function runDiscoveryPass({
  config,
  projectKey,
  queries,
  searchFn = searchGithubRepositories
}) {
  if (!projectKey) {
    return {
      repos: [],
      error: "projectKey required for problem-mode discovery"
    };
  }
  if (!Array.isArray(queries) || queries.length === 0) {
    return { repos: [] };
  }

  const collected = new Map();
  for (const phrase of queries) {
    try {
      const result = await searchFn(
        config,
        { query: phrase, minSearchResults: 1 },
        { perPage: 10 }
      );
      for (const item of result?.items ?? []) {
        if (item.normalizedRepoUrl && !collected.has(item.normalizedRepoUrl)) {
          collected.set(item.normalizedRepoUrl, item);
        }
      }
    } catch (error) {
      console.warn(`[problem-mode] phrase '${phrase}' search failed: ${error.message}`);
    }
  }

  const repos = Array.from(collected.values()).map((item) => ({
    id: item.normalizedRepoUrl ?? `${item.owner}/${item.name}`,
    url: item.normalizedRepoUrl ?? null,
    owner: item.owner ?? null,
    name: item.name ?? null,
    description: item.description ?? null,
    language: item.language ?? null,
    topics: Array.isArray(item.topics) ? item.topics : [],
    readme: null,
    license: null,
    dependencies: []
  }));

  return { repos };
}
