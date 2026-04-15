import fs from "node:fs/promises";
import path from "node:path";
import {
  buildDiscoveryPolicyCalibrationReport,
  buildDiscoveryPolicyComparisonReport,
  buildDiscoveryPolicyReview,
  createRunId,
  ensureDirectory,
  listDiscoveryManifests,
  loadDiscoveryPolicyFromFile,
  loadProjectBinding,
  loadProjectDiscoveryPolicy,
  renderDiscoveryPolicyCalibrationReport,
  renderDiscoveryPolicyComparisonReport,
  renderDiscoveryPolicyReviewSummary,
  upsertManagedMarkdownBlock
} from "../../../lib/index.mjs";
import { refreshContext } from "../../shared/runtime-helpers.mjs";
import { resolveDiscoveryManifestRecord } from "./shared.mjs";

export async function runPolicyReview(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);
  const manifestRecord = await resolveDiscoveryManifestRecord(rootDir, config, projectKey, options);

  const review = buildDiscoveryPolicyReview(manifestRecord.manifest.discovery, discoveryPolicy);
  const summary = renderDiscoveryPolicyReviewSummary({
    projectKey,
    sourceRunId: manifestRecord.runId,
    sourceManifestPath: manifestRecord.relativeManifestPath,
    review
  });
  const reviewJson = {
    schemaVersion: 1,
    projectKey,
    sourceRunId: manifestRecord.runId,
    sourceManifestPath: manifestRecord.relativeManifestPath,
    reviewedAt: new Date().toISOString(),
    review
  };
  const sourceRunDir = path.dirname(manifestRecord.manifestPath);
  const markdownPath = path.join(sourceRunDir, "policy-review-current.md");
  const jsonPath = path.join(sourceRunDir, "policy-review-current.json");

  if (!options.dryRun) {
    await fs.writeFile(markdownPath, `${summary}\n`, "utf8");
    await fs.writeFile(jsonPath, `${JSON.stringify(reviewJson, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- source_manifest: ${manifestRecord.relativeManifestPath}`);
  console.log(`- policy_review_markdown: ${path.relative(rootDir, markdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- policy_review_json: ${path.relative(rootDir, jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-review",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: manifestRecord.relativeManifestPath
  });

  return {
    projectKey,
    sourceRunId: manifestRecord.runId,
    sourceManifestPath: manifestRecord.relativeManifestPath,
    review
  };
}

export async function runPolicyCompare(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  if (!options.policyFile) {
    throw new Error("policy-compare requires --policy-file <relative-or-absolute-json-path>.");
  }
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const baselinePolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);
  const candidatePolicy = await loadDiscoveryPolicyFromFile(rootDir, projectKey, options.policyFile);
  const manifests = await listDiscoveryManifests(rootDir, config, projectKey);
  const limitedManifests = options.limit ? manifests.slice(0, Math.max(1, options.limit)) : manifests;
  const report = buildDiscoveryPolicyComparisonReport(limitedManifests, baselinePolicy, candidatePolicy);
  const generatedAt = new Date().toISOString();
  const runId = createRunId(new Date(generatedAt));
  const markdown = renderDiscoveryPolicyComparisonReport({
    projectKey,
    generatedAt,
    limit: options.limit,
    candidatePolicyPath: options.policyFile,
    report
  });
  const jsonPayload = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    candidatePolicyPath: options.policyFile,
    limit: options.limit ?? null,
    reviewedManifestCount: limitedManifests.length,
    report
  };

  const calibrationDir = path.join(rootDir, "projects", projectKey, "calibration");
  const datedMarkdownPath = path.join(calibrationDir, `discovery-policy-compare-${runId}.md`);
  const datedJsonPath = path.join(calibrationDir, `discovery-policy-compare-${runId}.json`);
  const latestMarkdownPath = path.join(calibrationDir, "latest-discovery-policy-compare.md");
  const latestJsonPath = path.join(calibrationDir, "latest-discovery-policy-compare.json");

  if (!options.dryRun) {
    await ensureDirectory(calibrationDir, false);
    await fs.writeFile(datedMarkdownPath, `${markdown}\n`, "utf8");
    await fs.writeFile(datedJsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`, "utf8");
    await fs.writeFile(latestMarkdownPath, `${markdown}\n`, "utf8");
    await fs.writeFile(latestJsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`, "utf8");
  }

  console.log(markdown);
  console.log(`- comparison_markdown: ${path.relative(rootDir, datedMarkdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- comparison_json: ${path.relative(rootDir, datedJsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- comparison_latest_markdown: ${path.relative(rootDir, latestMarkdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- comparison_latest_json: ${path.relative(rootDir, latestJsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-compare",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, datedMarkdownPath)
  });

  return {
    projectKey,
    generatedAt,
    report
  };
}

export async function runPolicyCalibrate(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);
  const manifests = await listDiscoveryManifests(rootDir, config, projectKey);
  const limitedManifests = options.limit ? manifests.slice(0, Math.max(1, options.limit)) : manifests;
  const report = buildDiscoveryPolicyCalibrationReport(limitedManifests, discoveryPolicy);
  const generatedAt = new Date().toISOString();
  const runId = createRunId(new Date(generatedAt));
  const markdown = renderDiscoveryPolicyCalibrationReport({
    projectKey,
    generatedAt,
    limit: options.limit,
    report
  });
  const jsonPayload = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    limit: options.limit ?? null,
    reviewedManifestCount: limitedManifests.length,
    report
  };

  const calibrationDir = path.join(rootDir, "projects", projectKey, "calibration");
  const datedMarkdownPath = path.join(calibrationDir, `discovery-policy-calibration-${runId}.md`);
  const datedJsonPath = path.join(calibrationDir, `discovery-policy-calibration-${runId}.json`);
  const latestMarkdownPath = path.join(calibrationDir, "latest-discovery-policy-calibration.md");
  const latestJsonPath = path.join(calibrationDir, "latest-discovery-policy-calibration.json");

  if (!options.dryRun) {
    await ensureDirectory(calibrationDir, false);
    await fs.writeFile(datedMarkdownPath, `${markdown}\n`, "utf8");
    await fs.writeFile(datedJsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`, "utf8");
    await fs.writeFile(latestMarkdownPath, `${markdown}\n`, "utf8");
    await fs.writeFile(latestJsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`, "utf8");
  }

  console.log(markdown);
  console.log(`- calibration_markdown: ${path.relative(rootDir, datedMarkdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- calibration_json: ${path.relative(rootDir, datedJsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- calibration_latest_markdown: ${path.relative(rootDir, latestMarkdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- calibration_latest_json: ${path.relative(rootDir, latestJsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-calibrate",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, datedMarkdownPath)
  });

  return {
    projectKey,
    generatedAt,
    report
  };
}

export async function runPolicyPack(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);
  const generatedAt = new Date().toISOString();
  const packetId = createRunId(new Date(generatedAt));
  const manifestRecord = await resolveDiscoveryManifestRecord(rootDir, config, projectKey, options).catch((error) => {
    if (options.manifest) {
      throw error;
    }
    return null;
  });

  const manifests = await listDiscoveryManifests(rootDir, config, projectKey);
  const limitedManifests = options.limit ? manifests.slice(0, Math.max(1, options.limit)) : manifests;
  const calibrationReport = buildDiscoveryPolicyCalibrationReport(limitedManifests, discoveryPolicy);
  const calibrationMarkdown = renderDiscoveryPolicyCalibrationReport({
    projectKey,
    generatedAt,
    limit: options.limit,
    report: calibrationReport
  });

  let latestReview = null;
  let latestReviewMarkdown = null;
  if (manifestRecord) {
    latestReview = buildDiscoveryPolicyReview(manifestRecord.manifest.discovery, discoveryPolicy);
    latestReviewMarkdown = renderDiscoveryPolicyReviewSummary({
      projectKey,
      sourceRunId: manifestRecord.runId,
      sourceManifestPath: manifestRecord.relativeManifestPath,
      review: latestReview
    });
  }

  let comparisonReport = null;
  let comparisonMarkdown = null;
  if (options.policyFile) {
    const candidatePolicy = await loadDiscoveryPolicyFromFile(rootDir, projectKey, options.policyFile);
    comparisonReport = buildDiscoveryPolicyComparisonReport(limitedManifests, discoveryPolicy, candidatePolicy);
    comparisonMarkdown = renderDiscoveryPolicyComparisonReport({
      projectKey,
      generatedAt,
      limit: options.limit,
      candidatePolicyPath: options.policyFile,
      report: comparisonReport
    });
  }

  const summaryMarkdown = [
    "# Patternpilot Discovery Policy Packet",
    "",
    `- project: ${projectKey}`,
    `- generated_at: ${generatedAt}`,
    `- packet_id: ${packetId}`,
    `- reviewed_manifests: ${limitedManifests.length}`,
    `- source_run: ${manifestRecord?.runId ?? "-"}`,
    `- source_manifest: ${manifestRecord?.relativeManifestPath ?? "-"}`,
    `- comparison_policy: ${options.policyFile ?? "-"}`,
    "",
    "## Current Calibration Snapshot",
    "",
    `- runs_with_candidates: ${calibrationReport.runsWithCandidates}`,
    `- source_candidates: ${calibrationReport.sourceCandidates}`,
    `- audit_flagged: ${calibrationReport.auditFlagged}`,
    `- enforce_hidden: ${calibrationReport.enforceHidden}`,
    `- preferred_hits: ${calibrationReport.preferredHits}`,
    "",
    "## Next Loop",
    "",
    ...(calibrationReport.recommendations.length > 0
      ? calibrationReport.recommendations.map((item) => `- ${item}`)
      : ["- none"]),
    ...(comparisonReport?.recommendations?.length
      ? ["", "## Comparison Hints", "", ...comparisonReport.recommendations.map((item) => `- ${item}`)]
      : []),
    ""
  ].join("\n");

  const packetDir = path.join(rootDir, "projects", projectKey, "calibration", "packets", packetId);
  const notesPath = path.join(rootDir, "projects", projectKey, "calibration", "DISCOVERY_POLICY_NOTES.md");
  const packetManifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    packetId,
    reviewedManifestCount: limitedManifests.length,
    sourceRunId: manifestRecord?.runId ?? null,
    sourceManifestPath: manifestRecord?.relativeManifestPath ?? null,
    comparisonPolicyPath: options.policyFile ?? null,
    calibrationReport,
    latestReview,
    comparisonReport
  };

  if (!options.dryRun) {
    await ensureDirectory(packetDir, false);
    await fs.writeFile(path.join(packetDir, "summary.md"), `${summaryMarkdown}\n`, "utf8");
    await fs.writeFile(path.join(packetDir, "manifest.json"), `${JSON.stringify(packetManifest, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(packetDir, "current-policy.json"), `${JSON.stringify(discoveryPolicy, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(packetDir, "current-calibration.md"), `${calibrationMarkdown}\n`, "utf8");
    await fs.writeFile(path.join(packetDir, "current-calibration.json"), `${JSON.stringify(calibrationReport, null, 2)}\n`, "utf8");
    if (latestReview && latestReviewMarkdown) {
      await fs.writeFile(path.join(packetDir, "latest-review.md"), `${latestReviewMarkdown}\n`, "utf8");
      await fs.writeFile(path.join(packetDir, "latest-review.json"), `${JSON.stringify(latestReview, null, 2)}\n`, "utf8");
    }
    if (comparisonReport && comparisonMarkdown) {
      await fs.writeFile(path.join(packetDir, "policy-compare.md"), `${comparisonMarkdown}\n`, "utf8");
      await fs.writeFile(path.join(packetDir, "policy-compare.json"), `${JSON.stringify(comparisonReport, null, 2)}\n`, "utf8");
    }
    await upsertManagedMarkdownBlock({
      filePath: notesPath,
      sectionKey: "policy-packets",
      sectionTitle: "Discovery Policy Packets",
      blockKey: packetId,
      blockContent: [
        `- generated_at: ${generatedAt}`,
        `- packet_dir: ${path.relative(rootDir, packetDir)}`,
        `- reviewed_manifests: ${limitedManifests.length}`,
        `- source_run: ${manifestRecord?.runId ?? "-"}`,
        `- source_candidates: ${calibrationReport.sourceCandidates}`,
        `- audit_flagged: ${calibrationReport.auditFlagged}`,
        `- enforce_hidden: ${calibrationReport.enforceHidden}`,
        `- comparison_policy: ${options.policyFile ?? "-"}`,
        ...(comparisonReport?.recommendations?.length
          ? comparisonReport.recommendations.map((item) => `- compare_hint: ${item}`)
          : [])
      ].join("\n"),
      dryRun: false
    });
  }

  console.log(summaryMarkdown);
  console.log(`- packet_dir: ${path.relative(rootDir, packetDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- packet_manifest: ${path.relative(rootDir, path.join(packetDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- packet_notes: ${path.relative(rootDir, notesPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-pack",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, path.join(packetDir, "summary.md"))
  });

  return {
    projectKey,
    generatedAt,
    packetId,
    calibrationReport,
    comparisonReport
  };
}
