// lib/review/watchlist-health.mjs
//
// Phase-4-Kern (Layer 1) aus docs/foundation/SCORE_STABILITY_PLAN.md:
// Diagnose des Watchlist-Zustands vor einem review:watchlist-Lauf.
//
// Zweck: Wenn die Watchlist leer oder duenn ist, soll der Report dem
// Nutzer **konkret** sagen, was als naechstes zu tun ist — nicht bloss
// 15 leere Sections rendern und runConfidence=low setzen.
//
// Layer 1 (dieses Modul): rein additive Diagnose — produziert Health-
// Objekt + Gap-Signal + Next-Steps fuer den Report.
// Layer 2 (folgt separat): tatsaechlicher Auto-Discover-Trigger via
// `--auto-discover` Flag, der Watchlist inline befuellt. Bewusst nicht
// in diesem Commit, weil das Trigger-Design (focused-Profile, Cost-
// Cap, Banner-Pflicht) eigene Real-World-Validierung braucht.
//
// Reine Funktionen: keine I/O, kein Side-Effect, deterministisch.

const DEFAULT_THRESHOLD = 3;

export const HEALTH_STATE = {
  EMPTY: "empty",
  SPARSE: "sparse",
  HEALTHY: "healthy",
};

export function assessWatchlistHealth({
  watchlistCount = 0,
  queueCount = 0,
  threshold = DEFAULT_THRESHOLD,
} = {}) {
  const count = Math.max(0, Number(watchlistCount) || 0);
  const queue = Math.max(0, Number(queueCount) || 0);
  let state;
  if (count === 0) state = HEALTH_STATE.EMPTY;
  else if (count < threshold) state = HEALTH_STATE.SPARSE;
  else state = HEALTH_STATE.HEALTHY;

  return {
    state,
    count,
    queue_count: queue,
    threshold,
    recommended_action: state === HEALTH_STATE.HEALTHY ? null : "discovery",
  };
}

function discoveryCommand(projectKey) {
  const project = projectKey ?? "<project>";
  return `npm run discover -- --project ${project} --discovery-profile focused`;
}

function intakeCommand(projectKey) {
  const project = projectKey ?? "<project>";
  return `npm run intake -- --project ${project} <github-url>`;
}

export function buildWatchlistHealthGapSignal(health, projectKey) {
  if (!health || health.state === HEALTH_STATE.HEALTHY) return null;
  const strength = health.state === HEALTH_STATE.EMPTY ? 90 : 60;
  return {
    gap: "watchlist_intake",
    count: 1,
    strength,
    detail: health.state === HEALTH_STATE.EMPTY
      ? `Watchlist enthaelt 0 Eintraege fuer Projekt ${projectKey ?? "?"} — Discovery oder manuelles Intake fehlt.`
      : `Watchlist enthaelt nur ${health.count} Eintrag/Eintraege fuer Projekt ${projectKey ?? "?"} — unter Empfehlung von ${health.threshold}.`,
    recommended_command: discoveryCommand(projectKey),
  };
}

export function buildWatchlistHealthNextSteps(health, projectKey) {
  if (!health || health.state === HEALTH_STATE.HEALTHY) return [];
  const empty = health.state === HEALTH_STATE.EMPTY;
  const lead = empty
    ? `Watchlist ist leer — fuelle sie via Discovery oder Intake, bevor Reviews Sinn ergeben (count=0, threshold=${health.threshold}).`
    : `Watchlist ist mit ${health.count} Eintrag/Eintraegen unterbesetzt — fuelle sie auf mindestens ${health.threshold} Eintraege auf.`;
  // Diese Funktion liefert reine Strings, kompatibel mit dem bestehenden
  // nextSteps-Array-Vertrag (Array<string>). Strukturierte Daten leben in
  // review.watchlistHealth; die Strings hier sind nur die Renderform.
  return [
    `${lead} Empfehlung: ${discoveryCommand(projectKey)}`,
    `Alternative bei bekannten URLs: ${intakeCommand(projectKey)}`,
  ];
}

export { DEFAULT_THRESHOLD };
