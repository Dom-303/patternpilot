import fs from "node:fs/promises";
import path from "node:path";
import {
  buildPolicySuggestion,
  buildPolicyTrial,
  buildPolicyWorkbench,
  buildPolicyWorkbenchReview,
  createRunId,
  ensureDirectory,
  loadDiscoveryPolicyFromFile,
  loadProjectBinding,
  loadProjectDiscoveryPolicy,
  renderPolicySuggestionSummary,
  renderPolicyTrialSummary,
  renderPolicyWorkbenchReviewSummary,
  renderPolicyWorkbenchSummary,
  upsertManagedMarkdownBlock
} from "../../../lib/index.mjs";
import { refreshContext } from "../../shared/runtime-helpers.mjs";
import {
  loadWorkbenchSourceRecord,
  resolveDiscoveryManifestRecord,
  resolveLoadedPolicyWorkbench
} from "./shared.mjs";

export async function runPolicyWorkbench(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);
  const manifestRecord = await resolveDiscoveryManifestRecord(rootDir, config, projectKey, options);

  const generatedAt = new Date().toISOString();
  const workbenchId = createRunId(new Date(generatedAt));
  const workbench = buildPolicyWorkbench(manifestRecord.manifest.discovery, discoveryPolicy);
  const summary = renderPolicyWorkbenchSummary({
    projectKey,
    sourceRunId: manifestRecord.runId,
    sourceManifestPath: manifestRecord.relativeManifestPath,
    workbench
  });
  const workbenchDir = path.join(rootDir, "projects", projectKey, "calibration", "workbench", workbenchId);
  const notesPath = path.join(rootDir, "projects", projectKey, "calibration", "DISCOVERY_POLICY_NOTES.md");
  const currentPolicyPath = path.join(workbenchDir, "current-policy.json");
  const proposedPolicyPath = path.join(workbenchDir, "proposed-policy.json");
  const rowsPath = path.join(workbenchDir, "rows.json");
  const manifestPath = path.join(workbenchDir, "manifest.json");
  const summaryPath = path.join(workbenchDir, "summary.md");
  const workbenchManifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    workbenchId,
    sourceRunId: manifestRecord.runId,
    sourceManifestPath: manifestRecord.relativeManifestPath,
    workbench
  };

  if (!options.dryRun) {
    await ensureDirectory(workbenchDir, false);
    await fs.writeFile(summaryPath, `${summary}\n`, "utf8");
    await fs.writeFile(manifestPath, `${JSON.stringify(workbenchManifest, null, 2)}\n`, "utf8");
    await fs.writeFile(rowsPath, `${JSON.stringify(workbench.rows, null, 2)}\n`, "utf8");
    await fs.writeFile(currentPolicyPath, `${JSON.stringify(discoveryPolicy, null, 2)}\n`, "utf8");
    await fs.writeFile(proposedPolicyPath, `${JSON.stringify(discoveryPolicy, null, 2)}\n`, "utf8");
    await upsertManagedMarkdownBlock({
      filePath: notesPath,
      sectionKey: "policy-workbench",
      sectionTitle: "Discovery Policy Workbench",
      blockKey: workbenchId,
      blockContent: [
        `- generated_at: ${generatedAt}`,
        `- source_run: ${manifestRecord.runId}`,
        `- source_manifest: ${manifestRecord.relativeManifestPath}`,
        `- workbench_dir: ${path.relative(rootDir, workbenchDir)}`,
        `- source_candidates: ${workbench.sourceCandidateCount}`,
        `- policy_blocked: ${workbench.blockedCount}`,
        `- policy_preferred: ${workbench.preferredCount}`,
        `- proposed_policy: ${path.relative(rootDir, proposedPolicyPath)}`
      ].join("\n"),
      dryRun: false
    });
  }

  console.log(summary);
  console.log(`- workbench_dir: ${path.relative(rootDir, workbenchDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- workbench_manifest: ${path.relative(rootDir, manifestPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- workbench_rows: ${path.relative(rootDir, rowsPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- proposed_policy: ${path.relative(rootDir, proposedPolicyPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- policy_notes: ${path.relative(rootDir, notesPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-workbench",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, summaryPath)
  });

  return {
    projectKey,
    generatedAt,
    workbenchId,
    workbench
  };
}

export async function runPolicyWorkbenchReview(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const loaded = await resolveLoadedPolicyWorkbench(rootDir, projectKey, options.workbenchDir);
  const sourceRecord = await loadWorkbenchSourceRecord(rootDir, loaded);

  const review = buildPolicyWorkbenchReview({
    rows: loaded.rows,
    sourceRecord,
    currentPolicy: loaded.currentPolicy,
    proposedPolicy: loaded.proposedPolicy
  });
  const workbenchId = path.basename(loaded.workbenchDir);
  const summary = renderPolicyWorkbenchReviewSummary({
    projectKey,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    review
  });
  const reviewJson = {
    schemaVersion: 1,
    projectKey,
    generatedAt: new Date().toISOString(),
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId ?? null,
    review
  };
  const summaryPath = path.join(loaded.workbenchDir, "review-summary.md");
  const jsonPath = path.join(loaded.workbenchDir, "review-summary.json");

  if (!options.dryRun) {
    await fs.writeFile(summaryPath, `${summary}\n`, "utf8");
    await fs.writeFile(jsonPath, `${JSON.stringify(reviewJson, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- workbench_dir: ${loaded.relativeWorkbenchDir}`);
  console.log(`- review_summary: ${path.relative(rootDir, summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- review_json: ${path.relative(rootDir, jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-workbench-review",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, summaryPath)
  });

  return {
    projectKey,
    workbenchId,
    review
  };
}

export async function runPolicySuggest(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const loaded = await resolveLoadedPolicyWorkbench(rootDir, projectKey, options.workbenchDir);
  const sourceRecord = await loadWorkbenchSourceRecord(rootDir, loaded);

  const suggestion = buildPolicySuggestion({
    rows: loaded.rows,
    currentPolicy: loaded.currentPolicy,
    sourceRecord
  });
  const workbenchId = path.basename(loaded.workbenchDir);
  const summary = renderPolicySuggestionSummary({
    projectKey,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    suggestion
  });
  const summaryPath = path.join(loaded.workbenchDir, "suggestion-summary.md");
  const jsonPath = path.join(loaded.workbenchDir, "suggestion-summary.json");
  const suggestedPolicyPath = path.join(loaded.workbenchDir, "suggested-policy.json");
  const proposedPolicyPath = path.join(loaded.workbenchDir, "proposed-policy.json");
  const suggestionJson = {
    schemaVersion: 1,
    projectKey,
    generatedAt: new Date().toISOString(),
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId ?? null,
    suggestion
  };

  if (!options.dryRun) {
    await fs.writeFile(summaryPath, `${summary}\n`, "utf8");
    await fs.writeFile(jsonPath, `${JSON.stringify(suggestionJson, null, 2)}\n`, "utf8");
    await fs.writeFile(suggestedPolicyPath, `${JSON.stringify(suggestion.nextPolicy, null, 2)}\n`, "utf8");
    if (options.apply) {
      await fs.writeFile(proposedPolicyPath, `${JSON.stringify(suggestion.nextPolicy, null, 2)}\n`, "utf8");
    }
  }

  console.log(summary);
  console.log(`- workbench_dir: ${loaded.relativeWorkbenchDir}`);
  console.log(`- suggestion_summary: ${path.relative(rootDir, summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- suggestion_json: ${path.relative(rootDir, jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- suggested_policy: ${path.relative(rootDir, suggestedPolicyPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  if (options.apply) {
    console.log(`- proposed_policy_updated: ${path.relative(rootDir, proposedPolicyPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  }

  await refreshContext(rootDir, config, {
    command: "policy-suggest",
    projectKey,
    mode: options.dryRun ? "dry_run" : options.apply ? "write_apply" : "write",
    reportPath: path.relative(rootDir, summaryPath)
  });

  return {
    projectKey,
    workbenchId,
    suggestion
  };
}

export async function runPolicyTrial(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const loaded = await resolveLoadedPolicyWorkbench(rootDir, projectKey, options.workbenchDir);
  const sourceRecord = await loadWorkbenchSourceRecord(rootDir, loaded);
  if (!sourceRecord) {
    throw new Error("Workbench has no source manifest path.");
  }

  let trialPolicy = loaded.proposedPolicy ?? loaded.currentPolicy;
  let trialPolicyPath = path.join(loaded.relativeWorkbenchDir, "proposed-policy.json");
  if (options.policyFile) {
    trialPolicy = await loadDiscoveryPolicyFromFile(rootDir, projectKey, options.policyFile);
    trialPolicyPath = options.policyFile;
  } else {
    const suggestedPolicyPath = path.join(loaded.workbenchDir, "suggested-policy.json");
    try {
      const raw = await fs.readFile(suggestedPolicyPath, "utf8");
      trialPolicy = JSON.parse(raw);
      trialPolicyPath = path.relative(rootDir, suggestedPolicyPath);
    } catch {
      // keep proposed policy fallback
    }
  }

  const trial = buildPolicyTrial({
    discovery: sourceRecord.manifest.discovery,
    currentPolicy: loaded.currentPolicy,
    trialPolicy,
    sourceRecord
  });
  const workbenchId = path.basename(loaded.workbenchDir);
  const summary = renderPolicyTrialSummary({
    projectKey,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    trialPolicyPath,
    trial
  });
  const summaryPath = path.join(loaded.workbenchDir, "trial-summary.md");
  const jsonPath = path.join(loaded.workbenchDir, "trial-summary.json");
  const matrixPath = path.join(loaded.workbenchDir, "trial-candidate-matrix.json");
  const trialJson = {
    schemaVersion: 1,
    projectKey,
    generatedAt: new Date().toISOString(),
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId ?? null,
    trialPolicyPath,
    trial
  };

  if (!options.dryRun) {
    await fs.writeFile(summaryPath, `${summary}\n`, "utf8");
    await fs.writeFile(jsonPath, `${JSON.stringify(trialJson, null, 2)}\n`, "utf8");
    await fs.writeFile(matrixPath, `${JSON.stringify(trial.rows, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- workbench_dir: ${loaded.relativeWorkbenchDir}`);
  console.log(`- trial_summary: ${path.relative(rootDir, summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- trial_json: ${path.relative(rootDir, jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- trial_matrix: ${path.relative(rootDir, matrixPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-trial",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, summaryPath)
  });

  return {
    projectKey,
    workbenchId,
    trial
  };
}
