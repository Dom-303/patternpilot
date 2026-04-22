/**
 * lib/discovery/pass.mjs
 *
 * Standalone discovery pass for problem:explore.
 * One GitHub search per problem phrase, verbatim — no project anchor in the
 * query string. After search collection, each candidate is enriched with
 * README/license/dependencies in parallel so the downstream keyword extractor
 * (lib/clustering/keywords.mjs) receives its full four-source signature.
 * Project context re-enters at the ranking / clustering / brief stages.
 *
 * Spec: docs/superpowers/specs/2026-04-22-clustering-enrichment-design.md
 */

import { searchGithubRepositories } from "./search.mjs";
import { enrichGithubRepo } from "../github/enrichment.mjs";

/**
 * @param {object} params
 * @param {object}   params.config
 * @param {string}   params.projectKey
 * @param {string[]} params.queries
 * @param {Function} [params.searchFn]
 * @param {Function} [params.enrichFn]  - (repo, config) => enrichment; defaults to enrichGithubRepo
 * @returns {Promise<{ repos: FlatRepo[], error?: string }>}
 */
export async function runDiscoveryPass({
  config,
  projectKey,
  queries,
  searchFn = searchGithubRepositories,
  enrichFn = enrichGithubRepo
}) {
  if (!projectKey) {
    return { repos: [], error: "projectKey required for problem-mode discovery" };
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

  const items = [...collected.values()];
  const enriched = await Promise.all(
    items.map(async (item) => {
      try {
        const enrichment = await enrichFn({ owner: item.owner, name: item.name }, config);
        return { item, enrichment };
      } catch (err) {
        console.warn(`[problem-mode] enrichment failed for ${item.owner}/${item.name}: ${err.message}`);
        return { item, enrichment: null };
      }
    })
  );

  const repos = enriched.map(({ item, enrichment }) => ({
    id: item.normalizedRepoUrl ?? `${item.owner}/${item.name}`,
    url: item.normalizedRepoUrl ?? null,
    owner: item.owner ?? null,
    name: item.name ?? null,
    description: item.description ?? null,
    language: item.language ?? null,
    topics: Array.isArray(item.topics) ? item.topics : [],
    readme: enrichment?.readme?.excerpt ?? null,
    license: enrichment?.licenseId ?? null,
    dependencies: Array.isArray(enrichment?.dependencies) ? enrichment.dependencies : []
  }));

  return { repos };
}
