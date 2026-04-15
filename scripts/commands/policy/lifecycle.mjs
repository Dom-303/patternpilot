import fs from "node:fs/promises";
import path from "node:path";
import {
  applyProjectPolicy,
  buildPolicySuggestion,
  buildPolicyTrial,
  buildPolicyWorkbenchReview,
  buildReplayImportPayloadFromDiscovery,
  createRunId,
  discoverImportedCandidates,
  ensureDirectory,
  findLatestPolicyCycle,
  loadDiscoveryPolicyFromFile,
  loadPolicyCycle,
  loadProjectAlignmentRules,
  loadProjectBinding,
  loadProjectProfile,
  renderDiscoveryHtmlReport,
  renderDiscoverySummary,
  renderPolicyCycleSummary,
  renderPolicyHandoffSummary,
  renderPolicySuggestionSummary,
  renderPolicyTrialSummary,
  renderPolicyWorkbenchReviewSummary,
  selectPolicyHandoffCandidates,
  upsertManagedMarkdownBlock
} from "../../../lib/index.mjs";
import { refreshContext } from "../../shared/runtime-helpers.mjs";
import { runOnDemand } from "../on-demand.mjs";
import {
  loadWorkbenchSourceRecord,
  resolveLoadedPolicyWorkbench
} from "./shared.mjs";

export async function runPolicyCycle(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const projectProfile = await loadProjectProfile(rootDir, project, binding, alignmentRules);
  const loaded = await resolveLoadedPolicyWorkbench(rootDir, projectKey, options.workbenchDir);
  const workbenchId = path.basename(loaded.workbenchDir);
  const sourceRecord = await loadWorkbenchSourceRecord(rootDir, loaded);
  if (!sourceRecord) {
    throw new Error("Workbench has no source manifest path.");
  }

  const review = buildPolicyWorkbenchReview({
    rows: loaded.rows,
    sourceRecord,
    currentPolicy: loaded.currentPolicy,
    proposedPolicy: loaded.proposedPolicy
  });
  const suggestion = buildPolicySuggestion({
    rows: loaded.rows,
    currentPolicy: loaded.currentPolicy,
    sourceRecord
  });

  let effectivePolicy = suggestion.changed
    ? suggestion.nextPolicy
    : (loaded.proposedPolicy ?? loaded.currentPolicy);
  let effectivePolicyLabel = "suggested-policy";
  if (options.policyFile) {
    effectivePolicy = await loadDiscoveryPolicyFromFile(rootDir, projectKey, options.policyFile);
    effectivePolicyLabel = options.policyFile;
  } else if (!suggestion.changed && loaded.proposedPolicy) {
    effectivePolicyLabel = path.join(loaded.relativeWorkbenchDir, "proposed-policy.json");
  }

  const trial = buildPolicyTrial({
    discovery: sourceRecord.manifest.discovery,
    currentPolicy: loaded.currentPolicy,
    trialPolicy: effectivePolicy,
    sourceRecord
  });

  const replayImportPayload = buildReplayImportPayloadFromDiscovery(
    sourceRecord.manifest.discovery,
    `policy-cycle-${workbenchId}`
  );
  const replayDiscovery = await discoverImportedCandidates(
    rootDir,
    config,
    project,
    binding,
    alignmentRules,
    projectProfile,
    replayImportPayload,
    {
      ...options,
      discoveryPolicy: effectivePolicy,
      discoveryPolicyMode: options.discoveryPolicyMode ?? "enforce"
    }
  );

  const generatedAt = new Date().toISOString();
  const cycleId = createRunId(new Date(generatedAt));
  const cycleDir = path.join(rootDir, "projects", projectKey, "calibration", "cycles", cycleId);
  const notesPath = path.join(rootDir, "projects", projectKey, "calibration", "DISCOVERY_POLICY_NOTES.md");
  const effectivePolicyPath = path.join(cycleDir, "effective-policy.json");
  const replaySummary = renderDiscoverySummary({
    runId: cycleId,
    projectKey,
    createdAt: generatedAt,
    discovery: replayDiscovery,
    dryRun: options.dryRun
  });
  const replayHtml = renderDiscoveryHtmlReport({
    projectKey,
    createdAt: generatedAt,
    discovery: replayDiscovery,
    projectProfile,
    binding,
    reportView: options.reportView
  });

  let applyResult = null;
  if (options.apply) {
    if (!options.dryRun) {
      await ensureDirectory(cycleDir, false);
      await fs.writeFile(effectivePolicyPath, `${JSON.stringify(effectivePolicy, null, 2)}\n`, "utf8");
      await fs.writeFile(
        path.join(loaded.workbenchDir, "proposed-policy.json"),
        `${JSON.stringify(effectivePolicy, null, 2)}\n`,
        "utf8"
      );
    }

    const currentPolicyPath = binding.discoveryPolicyFile ?? project.discoveryPolicyFile;
    if (!currentPolicyPath) {
      throw new Error(`Project '${projectKey}' has no configured discovery policy file.`);
    }

    if (options.dryRun) {
      const currentPolicyRaw = JSON.stringify(loaded.currentPolicy, null, 2).trim();
      const nextPolicyRaw = JSON.stringify(effectivePolicy, null, 2).trim();
      const changed = currentPolicyRaw !== nextPolicyRaw;
      applyResult = {
        changed,
        currentPolicyPath,
        nextPolicyPath: options.policyFile ?? `${path.join(loaded.relativeWorkbenchDir, "proposed-policy.json")} (simulated)`,
        summaryPath: path.join("projects", projectKey, "calibration", "history", `discovery-policy-apply-${generatedAt.replace(/[:.]/g, "-")}.md`),
        summary: [
          "# Patternpilot Discovery Policy Apply",
          "",
          `- project: ${projectKey}`,
          `- generated_at: ${generatedAt}`,
          `- changed: ${changed ? "yes" : "no"}`,
          `- simulated: yes`,
          ""
        ].join("\n")
      };
    } else {
      applyResult = await applyProjectPolicy({
        rootDir,
        projectKey,
        currentPolicyPath,
        nextPolicyPath: path.relative(rootDir, effectivePolicyPath),
        notesPath,
        generatedAt,
        dryRun: false,
        summaryLines: [
          `workbench_dir=${loaded.relativeWorkbenchDir}`,
          `cycle_dir=${path.relative(rootDir, cycleDir)}`,
          `rows_with_verdict=${review.rowsWithVerdict}`,
          `trial_newly_visible=${trial.newlyVisibleCount}`,
          `replay_visible=${replayDiscovery.candidateCount}`,
          ...review.recommendations
        ]
      });
    }
  }

  const summary = renderPolicyCycleSummary({
    projectKey,
    cycleId,
    generatedAt,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    review,
    suggestion,
    trial,
    applyResult,
    replay: {
      candidateCount: replayDiscovery.rawCandidateCount ?? replayDiscovery.evaluatedCandidates?.length ?? 0,
      visibleCount: replayDiscovery.candidateCount ?? replayDiscovery.candidates?.length ?? 0
    }
  });

  const cycleManifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    cycleId,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId ?? null,
    sourceManifestPath: loaded.manifest.sourceManifestPath ?? null,
    workbenchDir: loaded.relativeWorkbenchDir,
    effectivePolicyLabel,
    applyRequested: Boolean(options.apply),
    review,
    suggestion,
    trial,
    replay: {
      candidateCount: replayDiscovery.rawCandidateCount ?? replayDiscovery.evaluatedCandidates?.length ?? 0,
      visibleCount: replayDiscovery.candidateCount ?? replayDiscovery.candidates?.length ?? 0,
      blockedCount: replayDiscovery.blockedCandidates?.length ?? 0,
      policyMode: replayDiscovery.policySummary?.mode ?? "off",
      policySummary: replayDiscovery.policySummary ?? null
    },
    applyResult: applyResult
      ? {
          changed: applyResult.changed,
          currentPolicyPath: applyResult.currentPolicyPath ?? null,
          nextPolicyPath: applyResult.nextPolicyPath ?? null,
          summaryPath: applyResult.summaryPath ?? null
        }
      : null
  };

  const reviewSummary = renderPolicyWorkbenchReviewSummary({
    projectKey,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    review
  });
  const suggestionSummary = renderPolicySuggestionSummary({
    projectKey,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    suggestion
  });
  const trialSummary = renderPolicyTrialSummary({
    projectKey,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    trialPolicyPath: effectivePolicyLabel,
    trial
  });

  if (!options.dryRun) {
    await ensureDirectory(cycleDir, false);
    await fs.writeFile(path.join(cycleDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "manifest.json"), `${JSON.stringify(cycleManifest, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "review-summary.md"), `${reviewSummary}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "review-summary.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "suggestion-summary.md"), `${suggestionSummary}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "suggestion-summary.json"), `${JSON.stringify(suggestion, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "suggested-policy.json"), `${JSON.stringify(suggestion.nextPolicy, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "effective-policy.json"), `${JSON.stringify(effectivePolicy, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "trial-summary.md"), `${trialSummary}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "trial-summary.json"), `${JSON.stringify(trial, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "trial-candidate-matrix.json"), `${JSON.stringify(trial.rows, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "replay-import.json"), `${JSON.stringify(replayImportPayload, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "replay-summary.md"), `${replaySummary}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "replay-manifest.json"), `${JSON.stringify(replayDiscovery, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "replay-report.html"), `${replayHtml}\n`, "utf8");
    await upsertManagedMarkdownBlock({
      filePath: notesPath,
      sectionKey: "policy-cycles",
      sectionTitle: "Discovery Policy Cycles",
      blockKey: cycleId,
      blockContent: [
        `- generated_at: ${generatedAt}`,
        `- workbench_id: ${workbenchId}`,
        `- source_run: ${loaded.manifest.sourceRunId ?? "-"}`,
        `- cycle_dir: ${path.relative(rootDir, cycleDir)}`,
        `- trial_newly_visible: ${trial.newlyVisibleCount}`,
        `- trial_newly_hidden: ${trial.newlyHiddenCount}`,
        `- replay_visible: ${replayDiscovery.candidateCount ?? replayDiscovery.candidates?.length ?? 0}`,
        `- policy_applied: ${applyResult ? (applyResult.changed ? "yes" : "no_change") : "no"}`
      ].join("\n"),
      dryRun: false
    });
  }

  console.log(summary);
  console.log(`- workbench_dir: ${loaded.relativeWorkbenchDir}`);
  console.log(`- cycle_dir: ${path.relative(rootDir, cycleDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- cycle_manifest: ${path.relative(rootDir, path.join(cycleDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- replay_summary: ${path.relative(rootDir, path.join(cycleDir, "replay-summary.md"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- replay_report: ${path.relative(rootDir, path.join(cycleDir, "replay-report.html"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  if (applyResult) {
    console.log(`- apply_summary: ${applyResult.summaryPath}${options.dryRun ? " (simulated dry-run)" : ""}`);
  }

  await refreshContext(rootDir, config, {
    command: "policy-cycle",
    projectKey,
    mode: options.dryRun ? "dry_run" : options.apply ? "write_apply" : "write",
    reportPath: path.relative(rootDir, path.join(cycleDir, "summary.md"))
  });

  return {
    projectKey,
    cycleId,
    workbenchId,
    review,
    suggestion,
    trial,
    replayDiscovery,
    applyResult
  };
}

export async function runPolicyHandoff(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  let resolvedCycleDir = options.cycleDir;
  if (!resolvedCycleDir) {
    const latest = await findLatestPolicyCycle(rootDir, projectKey);
    if (!latest) {
      throw new Error(`No policy cycle found for project '${projectKey}'.`);
    }
    resolvedCycleDir = latest.relativeCycleDir;
  }

  const cycle = await loadPolicyCycle(rootDir, resolvedCycleDir);
  const cycleId = cycle.manifest.cycleId ?? path.basename(cycle.cycleDir);
  const selection = selectPolicyHandoffCandidates({
    scope: options.scope ?? "newly_visible",
    trialRows: cycle.trialRows,
    replayManifest: cycle.replayManifest
  });
  const generatedAt = new Date().toISOString();
  const handoffId = createRunId(new Date(generatedAt));
  const handoffDir = path.join(rootDir, "projects", projectKey, "calibration", "handoffs", handoffId);
  const notesPath = path.join(rootDir, "projects", projectKey, "calibration", "DISCOVERY_POLICY_NOTES.md");

  let onDemandResult = null;
  const preloadedCandidates = (cycle.replayManifest?.candidates ?? []).filter((candidate) =>
    selection.urls.includes(candidate?.repo?.normalizedRepoUrl ?? candidate?.repoUrl ?? candidate?.normalizedRepoUrl)
  );
  if (selection.urls.length > 0) {
    onDemandResult = await runOnDemand(rootDir, config, {
      ...options,
      project: projectKey,
      file: null,
      urls: selection.urls,
      preloadedCandidates,
      notes: options.notes
        ? `policy-handoff:${cycleId} | ${options.notes}`
        : `policy-handoff from cycle ${cycleId}`,
      appendWatchlist: options.appendWatchlist ?? false
    });
  }

  const summary = renderPolicyHandoffSummary({
    projectKey,
    handoffId,
    generatedAt,
    cycleId,
    workbenchId: cycle.manifest.workbenchId ?? null,
    scope: selection.scope,
    selection,
    onDemandResult,
    dryRun: options.dryRun
  });
  const handoffManifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    handoffId,
    cycleId,
    cycleDir: cycle.relativeCycleDir,
    sourceRunId: cycle.manifest.sourceRunId ?? null,
    workbenchId: cycle.manifest.workbenchId ?? null,
    scope: selection.scope,
    selection,
    onDemandResult: onDemandResult
      ? {
          runId: onDemandResult.runId,
          runDir: path.relative(rootDir, onDemandResult.runDir),
          effectiveUrls: onDemandResult.effectiveUrls,
          intakeItems: onDemandResult.intakeRun?.items?.length ?? 0,
          reviewItems: onDemandResult.reviewRun?.review?.items?.length ?? 0,
          reportPath: onDemandResult.reviewRun?.htmlReportPath ?? null
        }
      : null
  };

  if (!options.dryRun) {
    await ensureDirectory(handoffDir, false);
    await fs.writeFile(path.join(handoffDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(handoffDir, "manifest.json"), `${JSON.stringify(handoffManifest, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(handoffDir, "selected-urls.txt"), `${selection.urls.join("\n")}${selection.urls.length ? "\n" : ""}`, "utf8");
    await fs.writeFile(path.join(handoffDir, "selection.json"), `${JSON.stringify(selection, null, 2)}\n`, "utf8");
    await upsertManagedMarkdownBlock({
      filePath: notesPath,
      sectionKey: "policy-handoffs",
      sectionTitle: "Policy Handoffs",
      blockKey: handoffId,
      blockContent: [
        `- generated_at: ${generatedAt}`,
        `- cycle_id: ${cycleId}`,
        `- cycle_dir: ${cycle.relativeCycleDir}`,
        `- scope: ${selection.scope}`,
        `- selected_repos: ${selection.count}`,
        `- handoff_dir: ${path.relative(rootDir, handoffDir)}`,
        `- on_demand_run: ${onDemandResult?.runId ?? "-"}`,
        `- review_items: ${onDemandResult?.reviewRun?.review?.items?.length ?? 0}`
      ].join("\n"),
      dryRun: false
    });
  }

  console.log(summary);
  console.log(`- cycle_dir: ${cycle.relativeCycleDir}`);
  console.log(`- handoff_dir: ${path.relative(rootDir, handoffDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- handoff_manifest: ${path.relative(rootDir, path.join(handoffDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  if (onDemandResult?.reviewRun?.htmlReportPath) {
    console.log(`- handoff_report: ${onDemandResult.reviewRun.htmlReportPath}${options.dryRun ? " (dry-run not written)" : ""}`);
  }

  await refreshContext(rootDir, config, {
    command: "policy-handoff",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, path.join(handoffDir, "summary.md"))
  });

  return {
    projectKey,
    handoffId,
    selection,
    onDemandResult
  };
}

export async function runPolicyApply(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const currentPolicyPath = binding.discoveryPolicyFile ?? project.discoveryPolicyFile;
  if (!currentPolicyPath) {
    throw new Error(`Project '${projectKey}' has no configured discovery policy file.`);
  }

  let loadedWorkbench = null;
  let nextPolicyPath = options.policyFile;
  if (options.workbenchDir) {
    loadedWorkbench = await resolveLoadedPolicyWorkbench(rootDir, projectKey, options.workbenchDir);
    nextPolicyPath = nextPolicyPath ?? path.join(loadedWorkbench.relativeWorkbenchDir, "proposed-policy.json");
  } else if (!nextPolicyPath) {
    try {
      loadedWorkbench = await resolveLoadedPolicyWorkbench(rootDir, projectKey, null);
      nextPolicyPath = path.join(loadedWorkbench.relativeWorkbenchDir, "proposed-policy.json");
    } catch {
      loadedWorkbench = null;
    }
  }

  if (!nextPolicyPath) {
    throw new Error("policy-apply requires --policy-file <path> or an existing workbench with proposed-policy.json.");
  }

  let summaryLines = [];
  if (loadedWorkbench) {
    const sourceRecord = await loadWorkbenchSourceRecord(rootDir, loadedWorkbench);
    const review = buildPolicyWorkbenchReview({
      rows: loadedWorkbench.rows,
      sourceRecord,
      currentPolicy: loadedWorkbench.currentPolicy,
      proposedPolicy: loadedWorkbench.proposedPolicy
    });
    summaryLines = [
      `workbench_dir=${loadedWorkbench.relativeWorkbenchDir}`,
      `rows_with_verdict=${review.rowsWithVerdict}`,
      ...review.recommendations
    ];
  }

  const notesPath = path.join(rootDir, "projects", projectKey, "calibration", "DISCOVERY_POLICY_NOTES.md");
  const out = await applyProjectPolicy({
    rootDir,
    projectKey,
    currentPolicyPath,
    nextPolicyPath,
    notesPath,
    generatedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    summaryLines
  });

  console.log(out.summary);
  console.log(`- before_policy: ${out.beforePath}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- after_policy: ${out.afterPath}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- apply_summary: ${out.summaryPath}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-apply",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: out.summaryPath
  });

  return out;
}
