import path from "node:path";
import {
  buildPromotionCandidate,
  buildPromotionDocPath,
  createRunId,
  ensureDirectory,
  loadProjectBinding,
  loadQueueEntries,
  normalizeGithubUrl,
  renderDecisionBlock,
  renderLearningBlock,
  renderPromotionPacket,
  resolveDecisionsPath,
  resolveLearningsPath,
  upsertLandkarteEntry,
  upsertManagedMarkdownBlock,
  upsertQueueEntry,
  writePromotionPacket,
  writeRunArtifacts
} from "../../lib/index.mjs";
import { refreshContext } from "../shared/runtime-helpers.mjs";

function buildPromotionSummary({ runId, projectKey, createdAt, items, dryRun, apply }) {
  const lines = items.map((item) => {
    const mode = item.applied ? "applied" : "prepared";
    return `- ${item.repo.owner}/${item.repo.name} -> ${item.promotionDocRelativePath} (${mode}; queue_status=${item.queueStatus})`;
  });
  const applyCount = items.filter((item) => item.applied).length;
  const decisionStatus =
    items.length === 0 ? "no_items"
      : apply ? "promotion_applied"
        : "promotion_prepared";
  const nextCommand =
    apply
      ? `npm run patternpilot -- re-evaluate --project ${projectKey} --stale-only`
      : `npm run patternpilot -- promote --project ${projectKey} --apply --from-status promotion_prepared`;

  return `# Patternpilot Promotion Run

- run_id: ${runId}
- project: ${projectKey}
- created_at: ${createdAt}
- dry_run: ${dryRun ? "yes" : "no"}
- apply: ${apply ? "yes" : "no"}
- promotion_items: ${items.length}
- applied_items: ${applyCount}
- decision_status: ${decisionStatus}

## Items

${lines.join("\n")}

## Next Step

- next_command: ${nextCommand}
`;
}

export async function runPromote(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const queueRows = await loadQueueEntries(rootDir, config);
  const requestedUrls = options.urls.map((url) => normalizeGithubUrl(url).normalizedRepoUrl);

  let targets = queueRows.filter((row) => row.project_key === projectKey);
  if (requestedUrls.length > 0) {
    targets = targets.filter((row) => requestedUrls.includes(row.normalized_repo_url || row.repo_url));
  } else {
    const fromStatus = options.fromStatus || "pending_review";
    targets = targets.filter((row) => row.status === fromStatus);
  }

  if (options.limit && Number.isFinite(options.limit) && options.limit > 0) {
    targets = targets.slice(0, options.limit);
  }

  if (targets.length === 0) {
    throw new Error("No matching queue entries found for promotion. Run intake first or adjust --from-status.");
  }

  const createdAt = new Date().toISOString();
  const runId = createRunId(new Date(createdAt));
  const items = [];

  await ensureDirectory(path.join(rootDir, project.promotionRoot), options.dryRun);

  for (const queueEntry of targets) {
    const promotion = buildPromotionCandidate(queueEntry, binding);
    const promotionDocPath = buildPromotionDocPath(rootDir, project, promotion.repo);
    const promotionDocRelativePath = path.relative(rootDir, promotionDocPath);
    const promotionPacket = renderPromotionPacket({
      queueEntry,
      promotion,
      binding,
      createdAt,
      applyMode: options.apply
    });

    await writePromotionPacket({
      promotionDocPath,
      content: promotionPacket,
      dryRun: options.dryRun
    });

    let nextStatus = "promotion_prepared";
    if (options.apply) {
      await upsertLandkarteEntry(rootDir, promotion.landkarteRow, options.dryRun);
      await upsertManagedMarkdownBlock({
        filePath: resolveLearningsPath(rootDir, config),
        sectionKey: "learning-candidates",
        sectionTitle: "Patternpilot Candidate Learnings",
        blockKey: promotion.repo.slug,
        blockContent: renderLearningBlock(promotion, queueEntry, binding),
        dryRun: options.dryRun
      });
      await upsertManagedMarkdownBlock({
        filePath: resolveDecisionsPath(rootDir, config),
        sectionKey: "decision-candidates",
        sectionTitle: "Patternpilot Candidate Decisions",
        blockKey: promotion.repo.slug,
        blockContent: renderDecisionBlock(promotion, queueEntry, binding),
        dryRun: options.dryRun
      });
      nextStatus = "promoted";
    }

    const queueUpdate = {
      ...queueEntry,
      project_key: projectKey,
      status: nextStatus,
      updated_at: createdAt,
      promotion_status: options.apply ? "applied" : "prepared",
      promotion_packet: promotionDocRelativePath,
      promoted_at: options.apply ? createdAt : queueEntry.promoted_at ?? ""
    };

    if (!options.dryRun) {
      await upsertQueueEntry(rootDir, config, queueUpdate);
    }

    items.push({
      repo: promotion.repo,
      applied: options.apply,
      queueStatus: nextStatus,
      promotionDocRelativePath
    });
  }

  const summary = buildPromotionSummary({
    runId,
    projectKey,
    createdAt,
    items,
    dryRun: options.dryRun,
    apply: options.apply
  });
  const manifest = {
    runId,
    projectKey,
    createdAt,
    dryRun: options.dryRun,
    apply: options.apply,
    items
  };
  const runDir = await writeRunArtifacts({
    rootDir,
    config,
    projectKey,
    runId,
    manifest,
    summary,
    projectProfile: null,
    dryRun: options.dryRun
  });

  console.log(summary);
  console.log(`Run directory: ${path.relative(rootDir, runDir)}`);
  if (options.dryRun) {
    console.log("Dry run only: promotion files and curated artifacts were not written.");
  }
  await refreshContext(rootDir, config, {
    command: "promote",
    projectKey,
    mode: options.dryRun ? "dry_run" : options.apply ? "apply" : "prepare",
    reportPath: path.relative(rootDir, runDir)
  });

  return {
    runId,
    projectKey,
    createdAt,
    items,
    runDir
  };
}
