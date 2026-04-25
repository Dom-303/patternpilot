// lib/review/auto-discover.mjs
//
// Phase-4-Layer-2 aus docs/foundation/SCORE_STABILITY_PLAN.md:
// Auto-Discover-Trigger fuer review:watchlist, wenn die Watchlist
// leer/duenn ist und der Nutzer `--auto-discover` gesetzt hat.
//
// Vertrag:
//   - Reines DI-faehiges Modul (runDiscoverFn injizierbar fuer Tests)
//   - Greift NUR, wenn explizit `--auto-discover` UND health.state !== healthy
//   - Ruft runDiscover mit profile=focused + intake=true + appendWatchlist=true
//     auf, sodass die Watchlist UND Queue gefuellt werden
//   - Faengt Fehler ab und macht den Review nicht kaputt — die Health-Layer-1-
//     Diagnose sorgt dafuer, dass auch bei einem Fail der Report aussagekraeftig
//     bleibt
//
// Sicherheits-Konstanten: focused-Profil + quick-Depth halten den Auto-Trigger
// guenstig. Default-Cap auf 5 Candidates verhindert, dass der Watchlist-File
// im Fehlerfall mit Hunderten Eintraegen ueberflutet wird.

import { HEALTH_STATE } from "./watchlist-health.mjs";

const DEFAULT_DISCOVERY_PROFILE = "focused";
const DEFAULT_ANALYSIS_DEPTH = "quick";
const DEFAULT_REPORT_VIEW = "compact";

export const AUTO_DISCOVER_REASON = {
  FLAG_OFF: "flag_off",
  HEALTHY: "watchlist_healthy",
  EXECUTED: "executed",
  FAILED: "failed",
  NO_CANDIDATES: "no_candidates_returned",
};

export async function runAutoDiscoverForReview({
  rootDir,
  config,
  projectKey,
  health,
  options = {},
  runDiscoverFn,
  logger = console,
  // discoveryProfile + analysisDepth sind bewusst NICHT aus `options`
  // gezogen, weil der CLI-Parser dort schon Defaults sitzen hat
  // (z.B. discoveryProfile: "balanced"), die unseren focused/quick-
  // Default-Wunsch via `??` schlucken wuerden. Auto-Discover ist eine
  // Safety-Net-Operation: cheap-by-default. Wer einen breiteren Profile
  // will, kann manuell `npm run discover` mit eigenen Flags fahren.
  discoveryProfile = DEFAULT_DISCOVERY_PROFILE,
  analysisDepth = DEFAULT_ANALYSIS_DEPTH,
  reportView = DEFAULT_REPORT_VIEW,
} = {}) {
  if (!options.autoDiscover) {
    return { triggered: false, reason: AUTO_DISCOVER_REASON.FLAG_OFF };
  }
  if (!health || health.state === HEALTH_STATE.HEALTHY) {
    return { triggered: false, reason: AUTO_DISCOVER_REASON.HEALTHY };
  }
  if (typeof runDiscoverFn !== "function") {
    return {
      triggered: false,
      reason: AUTO_DISCOVER_REASON.FAILED,
      error: "runDiscoverFn dependency missing",
    };
  }

  if (logger?.log) {
    logger.log(`[review:watchlist] --auto-discover: triggering discovery (profile=${discoveryProfile}, depth=${analysisDepth}, project=${projectKey ?? "?"}) — Watchlist count was ${health.count}.`);
  }

  let result;
  try {
    result = await runDiscoverFn(rootDir, config, {
      ...options,
      project: projectKey,
      discoveryProfile,
      analysisDepth,
      reportView,
      // appendWatchlist + intake sind notwendig, damit der unmittelbar
      // folgende Review die Kandidaten als Queue-Rows findet.
      appendWatchlist: true,
      intake: true,
      // Auto-Discover ist immer ein write-Lauf — sonst fuellt er die
      // Watchlist nicht.
      dryRun: false,
      // Befreie runDiscover von einem evtl. von der CLI mitgereichten
      // 'urls'-Array (Review hatte keine URL-Argumente).
      urls: [],
      // Markiere als auto-Trigger fuer downstream-Pointer.
      commandName: "review-watchlist:auto-discover",
    });
  } catch (error) {
    if (logger?.warn) {
      logger.warn(`[review:watchlist] auto-discover failed: ${error?.message ?? error}. Review continues with existing watchlist state.`);
    }
    return {
      triggered: false,
      reason: AUTO_DISCOVER_REASON.FAILED,
      error: error?.message ?? String(error),
    };
  }

  const candidateUrls = Array.isArray(result?.candidateUrls) ? result.candidateUrls : [];
  if (candidateUrls.length === 0) {
    if (logger?.log) {
      logger.log(`[review:watchlist] auto-discover finished with 0 candidates. Watchlist state unchanged.`);
    }
    return {
      triggered: true,
      reason: AUTO_DISCOVER_REASON.NO_CANDIDATES,
      candidates_added: 0,
      run_id: result?.runId ?? null,
      profile: discoveryProfile,
    };
  }

  if (logger?.log) {
    logger.log(`[review:watchlist] auto-discover added ${candidateUrls.length} candidate(s) to watchlist + queue.`);
  }
  return {
    triggered: true,
    reason: AUTO_DISCOVER_REASON.EXECUTED,
    candidates_added: candidateUrls.length,
    candidate_urls: candidateUrls.slice(0, 20),
    run_id: result?.runId ?? null,
    profile: discoveryProfile,
  };
}

export { DEFAULT_DISCOVERY_PROFILE, DEFAULT_ANALYSIS_DEPTH, DEFAULT_REPORT_VIEW };
