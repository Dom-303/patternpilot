import fs from "node:fs/promises";
import path from "node:path";

const RUNTIME_CLAIMS_PATH = path.join("state", "github-app-service-runtime-claims.json");

function normalizeRuntimeClaim(claim = {}) {
  return {
    laneKey: String(claim.laneKey ?? "").trim() || "unknown:lane",
    workerId: String(claim.workerId ?? "").trim() || "local-worker",
    claimedAt: claim.claimedAt ?? new Date().toISOString(),
    leaseMinutes: Number.isFinite(claim.leaseMinutes) && claim.leaseMinutes > 0
      ? Number(claim.leaseMinutes)
      : 15,
    leaseExpiresAt: claim.leaseExpiresAt
      ?? new Date(Date.now() + ((Number.isFinite(claim.leaseMinutes) && claim.leaseMinutes > 0 ? Number(claim.leaseMinutes) : 15) * 60 * 1000)).toISOString()
  };
}

export function getGithubWebhookServiceRuntimeClaimsPath(rootDir) {
  return path.join(rootDir, RUNTIME_CLAIMS_PATH);
}

export async function loadGithubWebhookServiceRuntimeClaims(rootDir) {
  const claimsPath = getGithubWebhookServiceRuntimeClaimsPath(rootDir);
  try {
    const raw = await fs.readFile(claimsPath, "utf8");
    const parsed = JSON.parse(raw);
    const claims = Array.isArray(parsed.claims) ? parsed.claims.map((claim) => normalizeRuntimeClaim(claim)) : [];
    return {
      schemaVersion: 1,
      claimsPath,
      claims
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schemaVersion: 1,
        claimsPath,
        claims: []
      };
    }
    throw error;
  }
}

export async function writeGithubWebhookServiceRuntimeClaims(rootDir, state, options = {}) {
  const claimsPath = getGithubWebhookServiceRuntimeClaimsPath(rootDir);
  if (options.dryRun) {
    return claimsPath;
  }
  await fs.mkdir(path.dirname(claimsPath), { recursive: true });
  await fs.writeFile(claimsPath, `${JSON.stringify({
    schemaVersion: 1,
    claims: Array.isArray(state.claims) ? state.claims.map((claim) => normalizeRuntimeClaim(claim)) : []
  }, null, 2)}\n`, "utf8");
  return claimsPath;
}

export function isExpiredGithubWebhookServiceRuntimeClaim(claim, options = {}) {
  if (!claim?.leaseExpiresAt) {
    return false;
  }
  const now = options.now ? new Date(options.now) : new Date();
  return now >= new Date(claim.leaseExpiresAt);
}

export function buildGithubWebhookServiceRuntimeClaim(options = {}) {
  const claimedAt = options.claimedAt ?? new Date().toISOString();
  const leaseMinutes = Number.isFinite(options.leaseMinutes) && options.leaseMinutes > 0
    ? Number(options.leaseMinutes)
    : 15;
  return normalizeRuntimeClaim({
    laneKey: options.laneKey,
    workerId: options.workerId,
    claimedAt,
    leaseMinutes,
    leaseExpiresAt: new Date(new Date(claimedAt).getTime() + (leaseMinutes * 60 * 1000)).toISOString()
  });
}

export async function reclaimExpiredGithubWebhookServiceRuntimeClaims(rootDir, options = {}) {
  const currentState = options.state ?? await loadGithubWebhookServiceRuntimeClaims(rootDir);
  const reclaimed = [];
  const activeClaims = [];

  for (const claim of currentState.claims) {
    if (isExpiredGithubWebhookServiceRuntimeClaim(claim, options)) {
      reclaimed.push(claim);
      continue;
    }
    activeClaims.push(claim);
  }

  const nextState = {
    ...currentState,
    claims: activeClaims
  };
  await writeGithubWebhookServiceRuntimeClaims(rootDir, nextState, options);

  return {
    state: nextState,
    reclaimed
  };
}

export async function claimGithubWebhookServiceRuntimeLanes(rootDir, lanes = [], options = {}) {
  const currentState = options.state ?? await loadGithubWebhookServiceRuntimeClaims(rootDir);
  const reclaimed = await reclaimExpiredGithubWebhookServiceRuntimeClaims(rootDir, {
    ...options,
    state: currentState
  });
  const activeClaims = [...reclaimed.state.claims];
  const claimed = [];
  const blocked = [];

  for (const lane of lanes) {
    const existingClaim = activeClaims.find((claim) => claim.laneKey === lane.laneKey);
    if (existingClaim) {
      if (existingClaim.workerId === options.workerId) {
        claimed.push({
          laneKey: lane.laneKey,
          workerId: options.workerId,
          outcome: "already_claimed_by_worker",
          claim: existingClaim
        });
      } else {
        blocked.push({
          laneKey: lane.laneKey,
          workerId: options.workerId,
          outcome: "runtime_claimed_elsewhere",
          claim: existingClaim
        });
      }
      continue;
    }

    const claim = buildGithubWebhookServiceRuntimeClaim({
      laneKey: lane.laneKey,
      workerId: options.workerId,
      claimedAt: options.claimedAt,
      leaseMinutes: options.leaseMinutes
    });
    activeClaims.push(claim);
    claimed.push({
      laneKey: lane.laneKey,
      workerId: options.workerId,
      outcome: "runtime_claimed",
      claim
    });
  }

  const nextState = {
    ...reclaimed.state,
    claims: activeClaims
  };
  await writeGithubWebhookServiceRuntimeClaims(rootDir, nextState, options);

  return {
    state: nextState,
    reclaimed: reclaimed.reclaimed,
    claimed,
    blocked
  };
}

export async function releaseGithubWebhookServiceRuntimeLanes(rootDir, laneKeys = [], options = {}) {
  const currentState = options.state ?? await loadGithubWebhookServiceRuntimeClaims(rootDir);
  const laneKeySet = new Set(laneKeys.map((laneKey) => String(laneKey)));
  const released = [];
  const claims = [];

  for (const claim of currentState.claims) {
    if (laneKeySet.has(claim.laneKey) && (!options.workerId || claim.workerId === options.workerId)) {
      released.push(claim);
      continue;
    }
    claims.push(claim);
  }

  const nextState = {
    ...currentState,
    claims
  };
  await writeGithubWebhookServiceRuntimeClaims(rootDir, nextState, options);

  return {
    state: nextState,
    released
  };
}
