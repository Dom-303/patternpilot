import fs from "node:fs/promises";
import path from "node:path";

import { safeReadDirEntries } from "../utils.mjs";
import {
  ALLOWED_CONTRACT_KINDS,
  SERVICE_QUEUE_DIR,
  applyGithubWebhookServiceState,
  buildGithubWebhookServiceIdentity,
  buildQueuedContractFilename
} from "./shared.mjs";

export function getGithubWebhookServicePaths(rootDir) {
  const rootPath = path.join(rootDir, SERVICE_QUEUE_DIR);
  return {
    rootPath,
    pendingPath: path.join(rootPath, "pending"),
    claimedPath: path.join(rootPath, "claimed"),
    blockedPath: path.join(rootPath, "blocked"),
    deadLetterPath: path.join(rootPath, "dead-letter"),
    processedPath: path.join(rootPath, "processed")
  };
}

export async function queueGithubWebhookServiceContract(rootDir, contract, options = {}) {
  if (!ALLOWED_CONTRACT_KINDS.has(contract.contractKind)) {
    throw new Error(`Unsupported queued contract kind '${contract.contractKind ?? "unknown"}'.`);
  }

  const paths = getGithubWebhookServicePaths(rootDir);
  const targetState = options.targetState === "blocked"
    ? "blocked"
    : options.targetState === "dead_letter"
      ? "dead_letter"
      : "pending";
  const targetDir = targetState === "blocked"
    ? paths.blockedPath
    : targetState === "dead_letter"
      ? paths.deadLetterPath
      : paths.pendingPath;
  const lease = options.lease ?? null;
  const statefulContract = applyGithubWebhookServiceState(contract, {
    maxServiceAttempts: options.maxServiceAttempts,
    lastQueuedState: targetState
  });
  const queuedContract = lease
    ? {
        ...statefulContract,
        serviceLease: lease
      }
    : {
        ...statefulContract,
        serviceLease: null
      };
  const duplicate = options.allowDuplicate ? null : await findGithubWebhookServiceDuplicate(rootDir, queuedContract);
  const fileName = buildQueuedContractFilename(queuedContract, {
    timestamp: options.timestamp
  });
  const targetPath = path.join(targetDir, fileName);

  if (options.dryRun) {
    return {
      targetState,
      targetPath,
      duplicate
    };
  }

  if (duplicate) {
    return {
      targetState: duplicate.queueState,
      targetPath: duplicate.contractPath,
      duplicate
    };
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(queuedContract, null, 2)}\n`, "utf8");
  return {
    targetState,
    targetPath,
    contract: queuedContract
  };
}

export async function enqueueGithubWebhookServiceContractFromFile(rootDir, contractPath, options = {}) {
  const absolutePath = path.isAbsolute(contractPath)
    ? contractPath
    : path.join(rootDir, contractPath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const contract = JSON.parse(raw);
  const queued = await queueGithubWebhookServiceContract(rootDir, contract, options);
  return {
    contract,
    sourcePath: absolutePath,
    queued
  };
}

export async function loadGithubWebhookServiceQueue(rootDir) {
  const paths = getGithubWebhookServicePaths(rootDir);
  const pendingEntries = await safeReadDirEntries(paths.pendingPath);
  const claimedEntries = await safeReadDirEntries(paths.claimedPath);
  const blockedEntries = await safeReadDirEntries(paths.blockedPath);
  const deadLetterEntries = await safeReadDirEntries(paths.deadLetterPath);
  const pendingQueue = [];
  const claimedQueue = [];
  const blockedQueue = [];
  const deadLetterQueue = [];

  for (const entry of pendingEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const contractPath = path.join(paths.pendingPath, entry.name);
    const raw = await fs.readFile(contractPath, "utf8");
    const contract = JSON.parse(raw);
    pendingQueue.push({
      fileName: entry.name,
      contractPath,
      contract,
      queueState: "pending"
    });
  }

  for (const entry of claimedEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const contractPath = path.join(paths.claimedPath, entry.name);
    const raw = await fs.readFile(contractPath, "utf8");
    const contract = JSON.parse(raw);
    claimedQueue.push({
      fileName: entry.name,
      contractPath,
      contract,
      queueState: "claimed"
    });
  }

  for (const entry of blockedEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const contractPath = path.join(paths.blockedPath, entry.name);
    const raw = await fs.readFile(contractPath, "utf8");
    const contract = JSON.parse(raw);
    blockedQueue.push({
      fileName: entry.name,
      contractPath,
      contract,
      queueState: "blocked"
    });
  }

  for (const entry of deadLetterEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const contractPath = path.join(paths.deadLetterPath, entry.name);
    const raw = await fs.readFile(contractPath, "utf8");
    const contract = JSON.parse(raw);
    deadLetterQueue.push({
      fileName: entry.name,
      contractPath,
      contract,
      queueState: "dead_letter"
    });
  }

  pendingQueue.sort((left, right) => left.fileName.localeCompare(right.fileName));
  claimedQueue.sort((left, right) => left.fileName.localeCompare(right.fileName));
  blockedQueue.sort((left, right) => left.fileName.localeCompare(right.fileName));
  deadLetterQueue.sort((left, right) => left.fileName.localeCompare(right.fileName));
  return {
    paths,
    queue: [...pendingQueue, ...claimedQueue, ...blockedQueue, ...deadLetterQueue],
    pendingQueue,
    claimedQueue,
    blockedQueue,
    deadLetterQueue
  };
}

export async function findGithubWebhookServiceDuplicate(rootDir, contract) {
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const identity = buildGithubWebhookServiceIdentity(contract);
  return queueState.queue.find((entry) => {
    const entryIdentity = entry.contract?.serviceState?.identity ?? buildGithubWebhookServiceIdentity(entry.contract ?? {});
    return entryIdentity === identity;
  }) ?? null;
}
