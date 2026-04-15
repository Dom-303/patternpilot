import path from "node:path";
import {
  appendUrlsToWatchlist,
  buildRunResumeRecommendation,
  collectUrls,
  createRunId,
  loadAutomationJobState,
  loadProjectAlignmentRules,
  loadProjectBinding,
  loadProjectDiscoveryPolicy,
  updateAutomationJobState,
  writeAutomationJobState,
  writeRunArtifacts
} from "../../../lib/index.mjs";
import { computeRulesFingerprint } from "../../../lib/classification.mjs";
import {
  acquireAutomationLock,
  buildAutomationOpsReport,
  classifyAutomationFailure,
  createAutomationProjectRun,
  finalizeAutomationProjectRun,
  releaseAutomationLock,
  renderAutomationRunSummary,
  selectAutomationDiscoveryCandidates,
  setAutomationPhase,
  summarizeAutomationProjects
} from "../../../lib/automation/automation.mjs";
import {
  buildProjectRunDiagnostics,
  buildProjectRunGovernanceSnapshot,
  refreshContext
} from "../../shared/runtime-helpers.mjs";
import { runDiscover, runIntake } from "../discovery.mjs";
import { runPromote } from "../promotion.mjs";
import { runReEvaluate, runReviewWatchlist } from "../watchlist.mjs";

export async function runAutomation(rootDir, config, options) {
  const projectEntries = Object.entries(config.projects ?? {});
  const targetEntries = options.project && !options.allProjects
    ? projectEntries.filter(([projectKey]) => projectKey === options.project)
    : projectEntries;
  const createdAt = new Date().toISOString();
  const runId = createRunId(new Date(createdAt));
  const promotionMode = options.promotionMode ?? "skip";
  const projectRuns = [];
  const failures = [];
  const lockInfo = await acquireAutomationLock(rootDir, config, {
    project: options.project || null,
    allProjects: options.allProjects,
    dryRun: options.dryRun,
    forceLock: options.automationForceLock,
    lockTimeoutMinutes: options.automationLockTimeoutMinutes
  });

  function skipPendingPhases(projectRun, reason) {
    for (const [phase, phaseState] of Object.entries(projectRun.phases)) {
      if (phaseState.status === "pending") {
        setAutomationPhase(projectRun, phase, {
          status: "skipped",
          reason
        });
      }
    }
  }

  console.log(`# Patternpilot Automation Run`);
  console.log(``);
  console.log(`- run_id: ${runId}`);
  console.log(`- automation_job: ${options.automationJob ?? "-"}`);
  console.log(`- projects: ${targetEntries.length}`);
  console.log(`- promotion_mode: ${promotionMode}`);
  console.log(`- dry_run: ${options.dryRun ? "yes" : "no"}`);
  console.log(`- skip_discovery: ${options.skipDiscovery ? "yes" : "no"}`);
  console.log(`- skip_review: ${options.skipReview ? "yes" : "no"}`);
  console.log(`- automation_min_confidence: ${options.automationMinConfidence}`);
  console.log(`- automation_max_new_candidates: ${options.automationMaxNewCandidates}`);
  console.log(`- automation_continue_on_project_error: ${options.automationContinueOnProjectError ? "yes" : "no"}`);
  console.log(`- automation_force_lock: ${options.automationForceLock ? "yes" : "no"}`);
  console.log(`- automation_lock_timeout_minutes: ${options.automationLockTimeoutMinutes}`);
  console.log(`- automation_re_evaluate_limit: ${options.automationReevaluateLimit ?? "-"}`);
  console.log(`- automation_lock_status: ${lockInfo.status}`);
  console.log(`- automation_lock_path: ${path.relative(rootDir, lockInfo.lockPath)}`);
  console.log(``);

  try {
    for (const [projectKey, project] of targetEntries) {
      const projectRun = createAutomationProjectRun(projectKey);
      projectRuns.push(projectRun);
      let currentPhase = null;

      if (!project.watchlistFile) {
        console.log(`- ${projectKey}: skipped (no watchlist_file configured)`);
        skipPendingPhases(projectRun, "no_watchlist_file");
        finalizeAutomationProjectRun(projectRun);
        continue;
      }

      try {
        const { binding } = await loadProjectBinding(rootDir, config, projectKey);
        const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
        const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);

        const watchlistUrls = await collectUrls(rootDir, {
          ...options,
          file: project.watchlistFile,
          urls: []
        });
        const diagnostics = await buildProjectRunDiagnostics(rootDir, config, {
          projectKey,
          sourceMode: "watchlist",
          explicitUrlCount: 0,
          watchlistCount: watchlistUrls.length,
          watchlistUrls,
          currentFingerprint: computeRulesFingerprint(alignmentRules),
          isAutomation: true
        });
        const runPlan = diagnostics.lifecycle;
        const runDrift = diagnostics.drift;
        const runStability = diagnostics.stability;
        const runGovernance = buildProjectRunGovernanceSnapshot({
          projectKey,
          lifecycle: runPlan,
          drift: runDrift,
          stability: runStability,
          scope: "automation",
          job: {
            name: options.automationJob ?? null,
            command: `automation-run --project ${projectKey} --promotion-mode ${promotionMode}`
          }
        });
        projectRun.metrics.runKind = runPlan.runKind;
        projectRun.metrics.recommendedFocus = runPlan.recommendedFocus;
        projectRun.metrics.defaultPhases = runPlan.defaultPhases;
        projectRun.metrics.executionPolicy = runPlan.executionPolicy;
        projectRun.metrics.defaultPromotionMode = runPlan.defaultPromotionMode;
        projectRun.metrics.runDriftStatus = runDrift.driftStatus;
        projectRun.metrics.runDriftSignals = runDrift.signals.length;
        projectRun.metrics.runStabilityStatus = runStability.status;
        projectRun.metrics.stableStreak = runStability.stableStreak;
        projectRun.metrics.unstableStreak = runStability.unstableStreak;
        projectRun.metrics.resumeGuidance = runDrift.resumeGuidance;
        projectRun.metrics.runGovernanceStatus = runGovernance.status;
        projectRun.metrics.autoDispatchAllowed = runGovernance.autoDispatchAllowed;
        projectRun.metrics.autoApplyAllowed = runGovernance.autoApplyAllowed;
        projectRun.metrics.recommendedPromotionMode = runGovernance.recommendedPromotionMode;
        projectRun.metrics.governanceNextAction = runGovernance.nextAction;

        console.log(`- ${projectKey}: run_kind=${runPlan.runKind} | focus=${runPlan.recommendedFocus} | drift=${runDrift.driftStatus} | stability=${runStability.status} | governance=${runGovernance.status}`);
        let discoveredUrls = [];

        if (options.skipDiscovery) {
          setAutomationPhase(projectRun, "discover", {
            status: "skipped",
            reason: "cli_skip_discovery"
          });
          setAutomationPhase(projectRun, "gate", {
            status: "skipped",
            reason: "discovery_skipped"
          });
          setAutomationPhase(projectRun, "watchlist_handoff", {
            status: "skipped",
            reason: "discovery_skipped"
          });
        } else {
          currentPhase = "discover";
          console.log(`## Discover ${projectKey}`);
          const discoveryRun = await runDiscover(rootDir, config, {
            ...options,
            project: projectKey,
            appendWatchlist: false,
            intake: false
          });
          setAutomationPhase(projectRun, "discover", {
            status: "completed",
            reason: "run_complete",
            count: discoveryRun.discovery?.candidates?.length ?? 0,
            runConfidence: discoveryRun.discovery?.runConfidence ?? "unknown",
            reportPath: discoveryRun.htmlReportPath
          });

          currentPhase = "gate";
          const gate = selectAutomationDiscoveryCandidates(discoveryRun.discovery, {
            minConfidence: options.automationMinConfidence,
            maxCandidates: options.automationMaxNewCandidates,
            policy: discoveryPolicy
          });

          console.log(``);
          console.log(`## Discovery Gate ${projectKey}`);
          console.log(`- status: ${gate.status}`);
          console.log(`- reason: ${gate.reason}`);
          console.log(`- considered: ${gate.considered}`);
          console.log(`- actionable: ${gate.actionable}`);
          console.log(`- rejected: ${gate.rejected}`);
          console.log(`- policy_blocked: ${gate.policyBlocked ?? 0}`);
          console.log(`- policy_preferred: ${gate.policyPreferred ?? 0}`);

          setAutomationPhase(projectRun, "gate", {
            status: gate.status.startsWith("blocked_") ? "blocked" : gate.selectedUrls.length > 0 ? "completed" : "skipped",
            reason: gate.reason,
            count: gate.considered,
            selected: gate.selectedUrls.length,
            policyBlocked: gate.policyBlocked ?? 0,
            policyPreferred: gate.policyPreferred ?? 0
          });

          currentPhase = "watchlist_handoff";
          if (gate.selectedUrls.length > 0) {
            const watchlistResult = await appendUrlsToWatchlist(
              rootDir,
              project,
              gate.selectedUrls,
              options.dryRun
            );
            console.log(`- selected_urls: ${gate.selectedUrls.length}`);
            console.log(`- watchlist_status: ${watchlistResult.status}`);
            console.log(`- watchlist_appended: ${watchlistResult.appended}`);
            console.log(`- watchlist_kept_existing: ${watchlistResult.keptExisting}`);
            discoveredUrls = gate.selectedUrls;
            setAutomationPhase(projectRun, "watchlist_handoff", {
              status: "completed",
              reason: watchlistResult.status,
              selected: gate.selectedUrls.length,
              appended: watchlistResult.appended,
              keptExisting: watchlistResult.keptExisting
            });
          } else {
            console.log(`- selected_urls: 0`);
            setAutomationPhase(projectRun, "watchlist_handoff", {
              status: "skipped",
              reason: "no_selected_urls",
              selected: 0
            });
          }
          console.log(``);
        }

        const effectiveUrls = [...new Set([...watchlistUrls, ...discoveredUrls])];
        projectRun.metrics.watchlistUrls = watchlistUrls.length;
        projectRun.metrics.discoveredUrls = discoveredUrls.length;
        projectRun.metrics.effectiveUrls = effectiveUrls.length;

        if (effectiveUrls.length === 0) {
          console.log(`- ${projectKey}: skipped (no effective watchlist or discovery handoff)`);
          setAutomationPhase(projectRun, "intake", {
            status: "skipped",
            reason: "no_effective_urls"
          });
          setAutomationPhase(projectRun, "re_evaluate", {
            status: "skipped",
            reason: "no_effective_urls"
          });
          setAutomationPhase(projectRun, "review", {
            status: "skipped",
            reason: "no_effective_urls"
          });
          setAutomationPhase(projectRun, "promote", {
            status: "skipped",
            reason: "no_effective_urls"
          });
          finalizeAutomationProjectRun(projectRun);
          console.log(``);
          continue;
        }

        currentPhase = "intake";
        console.log(`## Intake ${projectKey}`);
        const intakeRun = await runIntake(rootDir, config, {
          ...options,
          project: projectKey,
          file: null,
          urls: effectiveUrls
        });
        setAutomationPhase(projectRun, "intake", {
          status: "completed",
          reason: "run_complete",
          count: intakeRun.items.length,
          runDir: path.relative(rootDir, intakeRun.runDir)
        });

        if (options.dryRun) {
          setAutomationPhase(projectRun, "re_evaluate", {
            status: "skipped",
            reason: "dry_run_follow_up_skipped"
          });
          setAutomationPhase(projectRun, "review", {
            status: "skipped",
            reason: options.skipReview ? "cli_skip_review" : "dry_run_follow_up_skipped"
          });
          setAutomationPhase(projectRun, "promote", {
            status: "skipped",
            reason: promotionMode === "skip" ? "promotion_disabled" : "dry_run_follow_up_skipped"
          });
          if (!options.skipReview) {
            console.log(``);
            console.log(`## Review ${projectKey}`);
            console.log(`Skipped review because dry-run intake does not persist queue entries for the follow-up comparison.`);
          }
          if (promotionMode === "prepared" || promotionMode === "apply") {
            console.log(``);
            console.log(`## Promote ${projectKey}`);
            console.log(`Skipped promotion because dry-run intake does not persist queue entries.`);
          }
          finalizeAutomationProjectRun(projectRun);
          console.log(``);
          continue;
        }

        currentPhase = "re_evaluate";
        console.log(``);
        console.log(`## Re-Evaluate ${projectKey}`);
        const reEvaluateRun = await runReEvaluate(rootDir, config, {
          ...options,
          project: projectKey,
          allowedUrls: effectiveUrls,
          limit: options.automationReevaluateLimit,
          staleOnly: runPlan.executionPolicy?.reEvaluateScope === "stale_only"
        });
        setAutomationPhase(projectRun, "re_evaluate", {
          status: reEvaluateRun.targetRows > 0 ? "completed" : "skipped",
          reason: reEvaluateRun.targetRows > 0
            ? (runPlan.executionPolicy?.reEvaluateScope === "stale_only" ? "recomputed_stale_targets" : "recomputed_targets")
            : "no_targets",
          count: reEvaluateRun.updates.length,
          targetRows: reEvaluateRun.targetRows
        });

        if (options.skipReview) {
          setAutomationPhase(projectRun, "review", {
            status: "skipped",
            reason: "cli_skip_review"
          });
        } else {
          currentPhase = "review";
          console.log(``);
          console.log(`## Review ${projectKey}`);
          const reviewRun = await runReviewWatchlist(rootDir, config, {
            ...options,
            project: projectKey
          });
          setAutomationPhase(projectRun, "review", {
            status: "completed",
            reason: "run_complete",
            count: reviewRun.review?.items?.length ?? 0,
            reportPath: reviewRun.htmlReportPath
          });
        }

        if (promotionMode === "prepared" || promotionMode === "apply") {
          currentPhase = "promote";
          console.log(``);
          console.log(`## Promote ${projectKey}`);
          try {
            const promoteRun = await runPromote(rootDir, config, {
              ...options,
              project: projectKey,
              apply: promotionMode === "apply"
            });
            setAutomationPhase(projectRun, "promote", {
              status: "completed",
              reason: promotionMode === "apply" ? "promotion_applied" : "promotion_prepared",
              count: promoteRun.items.length,
              runDir: path.relative(rootDir, promoteRun.runDir)
            });
          } catch (error) {
            if (error.message.includes("No matching queue entries found for promotion")) {
              console.log(`No promotion candidates for ${projectKey}.`);
              setAutomationPhase(projectRun, "promote", {
                status: "skipped",
                reason: "no_promotion_candidates"
              });
            } else {
              throw error;
            }
          }
        } else {
          setAutomationPhase(projectRun, "promote", {
            status: "skipped",
            reason: "promotion_disabled"
          });
        }

        finalizeAutomationProjectRun(projectRun);
        console.log(``);
      } catch (error) {
        const failureClass = classifyAutomationFailure(error);
        const resumeRecommendation = buildRunResumeRecommendation({
          lifecycle: projectRun.metrics,
          failedPhase: currentPhase,
          failure: failureClass
        });
        if (currentPhase) {
          setAutomationPhase(projectRun, currentPhase, {
            status: "failed",
            reason: error.message
          });
        }
        projectRun.error = error.message;
        projectRun.errorClassification = failureClass;
        projectRun.errorResumeRecommendation = resumeRecommendation;
        skipPendingPhases(projectRun, "automation_aborted_after_phase_failure");
        finalizeAutomationProjectRun(projectRun);
        failures.push({
          projectKey,
          phase: currentPhase,
          error: error.message,
          resumeRecommendation,
          ...failureClass
        });
        console.log(``);
        console.log(`## Automation Failure ${projectKey}`);
        console.log(`- phase: ${currentPhase ?? "setup"}`);
        console.log(`- error: ${error.message}`);
        console.log(`- category: ${failureClass.category}`);
        console.log(`- retryable: ${failureClass.retryable ? "yes" : "no"}`);
        console.log(`- recommended_delay_minutes: ${failureClass.recommendedDelayMinutes ?? "-"}`);
        console.log(`- resume_strategy: ${resumeRecommendation.strategy}`);
        console.log(`- resume_next_action: ${resumeRecommendation.nextAction}`);
        console.log(``);
        if (!options.automationContinueOnProjectError) {
          break;
        }
      }
    }

    const counts = summarizeAutomationProjects(projectRuns);
    const summary = renderAutomationRunSummary({
      runId,
      createdAt,
      dryRun: options.dryRun,
      automationJob: options.automationJob,
      promotionMode,
      continueOnProjectError: options.automationContinueOnProjectError,
      reEvaluateLimit: options.automationReevaluateLimit,
      lockInfo: {
        status: lockInfo.status,
        lockPath: path.relative(rootDir, lockInfo.lockPath)
      },
      projectRuns
    });
    const opsReport = buildAutomationOpsReport({
      runId,
      createdAt,
      dryRun: options.dryRun,
      automationJob: options.automationJob,
      promotionMode,
      continueOnProjectError: options.automationContinueOnProjectError,
      reEvaluateLimit: options.automationReevaluateLimit,
      lockInfo: {
        status: lockInfo.status,
        lockPath: path.relative(rootDir, lockInfo.lockPath)
      },
      counts,
      failures,
      projectRuns
    });
    const manifest = {
      command: "automation-run",
      runId,
      createdAt,
      dryRun: options.dryRun,
      automationJob: options.automationJob,
      promotionMode,
      continueOnProjectError: options.automationContinueOnProjectError,
      forceLock: options.automationForceLock,
      lockTimeoutMinutes: options.automationLockTimeoutMinutes,
      reEvaluateLimit: options.automationReevaluateLimit,
      lockInfo: {
        status: lockInfo.status,
        lockPath: path.relative(rootDir, lockInfo.lockPath)
      },
      counts,
      failures,
      projectRuns
    };
    const runDir = await writeRunArtifacts({
      rootDir,
      config,
      projectKey: "automation",
      runId,
      manifest,
      summary,
      projectProfile: null,
      dryRun: options.dryRun,
      extraFiles: [
        {
          name: "ops.json",
          content: `${JSON.stringify(opsReport, null, 2)}\n`
        }
      ]
    });

    console.log(summary);
    console.log(`Automation run directory: ${path.relative(rootDir, runDir)}`);

    if (options.automationJob) {
      const { statePath, state } = await loadAutomationJobState(rootDir, config);
      const nextState = updateAutomationJobState(state, {
        jobName: options.automationJob,
        runId,
        createdAt,
        counts,
        failures,
        projectRuns
      });
      await writeAutomationJobState(rootDir, config, nextState, options.dryRun);
      console.log(`Automation job state: ${path.relative(rootDir, statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
    }

    await refreshContext(rootDir, config, {
      command: "automation-run",
      projectKey: options.project || config.defaultProject,
      mode: failures.length > 0 ? "partial_failure" : options.dryRun ? "dry_run" : "write",
      reportPath: path.relative(rootDir, runDir)
    });

    if (failures.length > 0) {
      const retryableFailures = failures.filter((failure) => failure.retryable);
      const nonRetryableFailures = failures.filter((failure) => !failure.retryable);
      const automationError = new Error(
        `Automation run had ${failures.length} failed project(s): ${failures.map((failure) => `${failure.projectKey}${failure.phase ? `@${failure.phase}` : ""}`).join(", ")}`
      );
      automationError.exitCode = nonRetryableFailures.length > 0
        ? Math.max(...nonRetryableFailures.map((failure) => failure.exitCode ?? 1))
        : retryableFailures.length > 0
          ? Math.max(...retryableFailures.map((failure) => failure.exitCode ?? 75))
          : 1;
      automationError.retryable = nonRetryableFailures.length === 0 && retryableFailures.length > 0;
      automationError.failures = failures;
      throw automationError;
    }

    return {
      runId,
      createdAt,
      runDir,
      projectRuns,
      counts
    };
  } finally {
    await releaseAutomationLock(lockInfo);
  }
}
