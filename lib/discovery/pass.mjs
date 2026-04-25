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
import { wait } from "../utils.mjs";
import { isRateLimitError } from "../github/rate-limit.mjs";

const SEARCH_RATE_LIMIT_SHORT_CIRCUIT = 3;

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
  // perPage: steuert wieviele Repos GitHub pro Query zurueckgibt (1-100
  // erlaubt vom API). Default 20 ist Produktions-Balance: genug Mitglieder
  // pro Query-Linse damit Stage-0-Provenance-Clustering echte Cluster
  // bildet (>= 3 Mitglieder), ohne dass 12 Queries × 100 sofort ins Rate-
  // Limit fallen. User koennen via `--per-page` hochdrehen.
  perPage = 20,
  // slow: 1-Request-pro-Sekunde Hard-Throttle fuer Nutzer ohne Premium-
  // Token. Opt-in via CLI-Flag `--slow`. Vermeidet Secondary-Rate-Limit-
  // Treffer auf grossen Korpora (>40 Kandidaten). Default off.
  slow = false,
  // throttleMs: benutzerdefinierte Pause zwischen Enrichment-Calls in ms.
  // Wenn `slow=true`, wird mindestens 1000ms angesetzt.
  throttleMs = null,
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
  // provenanceByUrl: pro Repo die Set aller Query-Phrasen, die es gefunden haben.
  // Dient als zusaetzliches Clustering-Signal: Repos aus derselben Query-Lense
  // bilden natuerliche Unter-Familien, selbst wenn ihre Keyword-Overlap duenn ist.
  const provenanceByUrl = new Map();
  // Phase-3-Polish: Search API hat ein 30-req/min-Quota, das nicht mit
  // dem Per-Call-Retry aus api-client.mjs adressiert werden kann (selbst
  // 4 Retries warten kollektiv weniger als 60 s). Wenn ≥3 aufeinander-
  // folgende Queries an Rate-Limit scheitern, schlucken wir die rest-
  // lichen Queries und liefern zurueck was wir haben — plus klarer Hint
  // an den Nutzer, dass `--slow` (1 req/s Hard-Throttle) das Phaenomen
  // praeemptiv vermeidet.
  let consecutiveRateLimitFailures = 0;
  let shortCircuited = false;
  for (const phrase of queries) {
    if (shortCircuited) break;
    try {
      const result = await searchFn(
        config,
        { query: phrase, minSearchResults: 1 },
        { perPage }
      );
      consecutiveRateLimitFailures = 0;
      for (const item of result?.items ?? []) {
        if (!item.normalizedRepoUrl) continue;
        if (!collected.has(item.normalizedRepoUrl)) collected.set(item.normalizedRepoUrl, item);
        if (!provenanceByUrl.has(item.normalizedRepoUrl)) {
          provenanceByUrl.set(item.normalizedRepoUrl, new Set());
        }
        provenanceByUrl.get(item.normalizedRepoUrl).add(phrase);
      }
    } catch (error) {
      if (isRateLimitError(error)) {
        consecutiveRateLimitFailures += 1;
        console.warn(`[problem-mode] phrase '${phrase}' hit GitHub Search API rate limit (30/min). Re-run with --slow (1 req/s) to avoid this.`);
        if (consecutiveRateLimitFailures >= SEARCH_RATE_LIMIT_SHORT_CIRCUIT) {
          console.warn(`[problem-mode] ${consecutiveRateLimitFailures} consecutive rate-limit failures — skipping remaining ${queries.length - queries.indexOf(phrase) - 1} quer${queries.length - queries.indexOf(phrase) - 1 === 1 ? "y" : "ies"} and proceeding with ${collected.size} candidate(s) collected so far. Re-run with --slow to capture the full corpus.`);
          shortCircuited = true;
        }
      } else {
        console.warn(`[problem-mode] phrase '${phrase}' search failed: ${error.message}`);
        consecutiveRateLimitFailures = 0;
      }
    }
  }

  const items = [...collected.values()];
  const effectiveThrottleMs = slow
    ? Math.max(1000, throttleMs ?? 1000)
    : (throttleMs ?? 0);

  let enriched;
  if (effectiveThrottleMs > 0) {
    // Sequentiell mit Hard-Throttle. Schoner fuer ratenlimitierte Tokens,
    // aber spuerbar langsamer (throttleMs × N).
    enriched = [];
    for (const item of items) {
      try {
        const enrichment = await enrichFn({ owner: item.owner, name: item.name }, config);
        enriched.push({ item, enrichment });
      } catch (err) {
        console.warn(`[problem-mode] enrichment failed for ${item.owner}/${item.name}: ${err.message}`);
        enriched.push({ item, enrichment: null, enrichmentError: err.message });
      }
      if (effectiveThrottleMs > 0) await wait(effectiveThrottleMs);
    }
  } else {
    enriched = await Promise.all(
      items.map(async (item) => {
        try {
          const enrichment = await enrichFn({ owner: item.owner, name: item.name }, config);
          return { item, enrichment };
        } catch (err) {
          console.warn(`[problem-mode] enrichment failed for ${item.owner}/${item.name}: ${err.message}`);
          return { item, enrichment: null, enrichmentError: err.message };
        }
      })
    );
  }

  const repos = enriched.map(({ item, enrichment, enrichmentError }) => {
    const provenance = provenanceByUrl.get(item.normalizedRepoUrl) ?? new Set();
    // enrichment_incomplete wird gesetzt, wenn der Enrichment-Call entweder
    // ganz geworfen hat oder intern als failed zurueckkam. So koennen nach-
    // gelagerte Scorer + Run-Health-Panels zuverlaessig auswerten, wie viele
    // Repos mit degradiertem Signal ins Clustering gehen.
    const incomplete = !enrichment || enrichment.status === "failed";
    return {
      id: item.normalizedRepoUrl ?? `${item.owner}/${item.name}`,
      url: item.normalizedRepoUrl ?? null,
      owner: item.owner ?? null,
      name: item.name ?? null,
      description: item.description ?? null,
      language: item.language ?? null,
      topics: Array.isArray(item.topics) ? item.topics : [],
      readme: enrichment?.readme?.excerpt ?? null,
      license: enrichment?.licenseId ?? null,
      dependencies: Array.isArray(enrichment?.dependencies) ? enrichment.dependencies : [],
      discoveryProvenance: [...provenance],
      enrichment_incomplete: incomplete,
      enrichment_error: incomplete ? (enrichmentError ?? enrichment?.error ?? null) : null
    };
  });

  const incompleteCount = repos.filter((r) => r.enrichment_incomplete).length;
  const enrichmentHealth = {
    total: repos.length,
    incomplete: incompleteCount,
    incomplete_ratio: repos.length === 0 ? 0 : Number((incompleteCount / repos.length).toFixed(3)),
    throttle_ms: effectiveThrottleMs
  };

  return { repos, enrichmentHealth };
}
