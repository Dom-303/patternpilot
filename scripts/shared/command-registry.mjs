const COMMANDS = [
  { name: "bootstrap", description: "Create a local config overlay and optionally bind the first target project", handlerKey: "runBootstrap" },
  { name: "getting-started", description: "Show the shortest useful first-run path for a fresh local installation", handlerKey: "runGettingStarted", aliases: ["first-run"] },
  { name: "on-demand", description: "Run the primary manual flow for one project in a single step", handlerKey: "runOnDemand", aliases: ["analyze"] },
  { name: "policy-audit", description: "Run discovery with project policy in audit mode for calibration", handlerKey: "runPolicyAudit" },
  { name: "policy-calibrate", description: "Aggregate saved discovery runs into a project-wide policy calibration report", handlerKey: "runPolicyCalibrate" },
  { name: "policy-compare", description: "Compare the current discovery policy with an alternate policy file", handlerKey: "runPolicyCompare" },
  { name: "policy-pack", description: "Write a bundled discovery-policy calibration packet for one project", handlerKey: "runPolicyPack" },
  { name: "policy-review", description: "Re-evaluate a saved discovery run against the current project policy", handlerKey: "runPolicyReview" },
  { name: "policy-workbench", description: "Write a candidate-level calibration workbench from a saved discovery run", handlerKey: "runPolicyWorkbench" },
  { name: "policy-workbench-review", description: "Summarize manual verdicts and proposed-policy impact from a workbench", handlerKey: "runPolicyWorkbenchReview" },
  { name: "policy-suggest", description: "Derive a suggested policy variant from a workbench and compare it to the source run", handlerKey: "runPolicySuggest" },
  { name: "policy-trial", description: "Simulate a trial policy against the workbench source run and emit a candidate-level before/after matrix", handlerKey: "runPolicyTrial" },
  { name: "policy-cycle", description: "Run review -> suggest -> trial -> replay as one calibration loop and optionally apply the result", handlerKey: "runPolicyCycle" },
  { name: "policy-control", description: "Show the current policy control surface across cycle, handoff, curation and apply", handlerKey: "runPolicyControl" },
  { name: "policy-handoff", description: "Send selected policy-cycle candidates into the normal on-demand intake/review path", handlerKey: "runPolicyHandoff" },
  { name: "policy-curate", description: "Rank handoff candidates for curation and optionally prepare promotion packets", handlerKey: "runPolicyCurate" },
  { name: "policy-curation-review", description: "Preview which curated candidates would touch canonical knowledge artifacts", handlerKey: "runPolicyCurationReview" },
  { name: "policy-curation-apply", description: "Apply selected curated candidates into canonical knowledge artifacts", handlerKey: "runPolicyCurationApply" },
  { name: "policy-curation-batch-review", description: "Review multiple curated candidates together before batch apply", handlerKey: "runPolicyCurationBatchReview" },
  { name: "policy-curation-batch-plan", description: "Build a governance plan with safe sub-batches and manual-review cases", handlerKey: "runPolicyCurationBatchPlan" },
  { name: "policy-curation-batch-apply", description: "Apply the safe curated batch while skipping already promoted and high-risk candidates", handlerKey: "runPolicyCurationBatchApply" },
  { name: "run-plan", description: "Classify the next run as first, follow-up, or maintenance and show the default phase shape", handlerKey: "runPlan" },
  { name: "run-drift", description: "Inspect multi-run drift, queue staleness and resume guidance for one project", handlerKey: "runDrift" },
  { name: "run-stability", description: "Inspect recent lifecycle-relevant runs for stable/unstable streaks across multiple loops", handlerKey: "runStability" },
  { name: "run-governance", description: "Evaluate whether the next project run is manual-only, limited unattended, or fully unattended-ready", handlerKey: "runGovernance" },
  { name: "run-requalify", description: "Inspect whether a latched manual requalification can be cleared after stable follow-up loops", handlerKey: "runRequalify" },
  { name: "product-readiness", description: "Evaluate whether Patternpilot is ready for v1-style local product operation", handlerKey: "runProductReadiness" },
  { name: "validate-cohort", description: "Run the broad foreign-project validation cohort through bootstrap, watchlist, review, readiness and governance", handlerKey: "runValidateCohort" },
  { name: "policy-apply", description: "Apply a proposed policy file back to the project with history snapshots", handlerKey: "runPolicyApply" },
  { name: "automation-dispatch", description: "Run the next ready automation job or a selected one", handlerKey: "runAutomationDispatch" },
  { name: "automation-dispatch-history", description: "Show persisted automation dispatch decisions, reroutes and blocks", handlerKey: "runAutomationDispatchHistory" },
  { name: "automation-jobs", description: "Show scheduler readiness for configured automation jobs", handlerKey: "runAutomationJobs" },
  { name: "automation-reviews", description: "Show open and recently resolved automation operator reviews", handlerKey: "runAutomationReviews" },
  { name: "automation-alert-deliver", description: "Deliver automation alerts to stdout, file, summary or local hook adapters", handlerKey: "runAutomationAlertDeliver" },
  { name: "automation-run", description: "Run discover -> intake -> review and optionally promote", handlerKey: "runAutomation" },
  { name: "doctor", description: "Show GitHub auth, rate-limit and workspace readiness", handlerKey: "runDoctor" },
  { name: "github-app-readiness", description: "Show how close the current setup is to a real GitHub App integration path", handlerKey: "runGithubAppReadiness" },
  { name: "github-app-live-pilot-review", description: "Review whether Patternpilot is ready for a first real PAT-bridge or GitHub App live pilot", handlerKey: "runGithubAppLivePilotReview" },
  { name: "github-app-plan", description: "Write the current GitHub App event, permission and command-mapping plan", handlerKey: "runGithubAppPlan" },
  { name: "github-app-event-preview", description: "Preview how one GitHub App event would map onto existing Patternpilot flows", handlerKey: "runGithubAppEventPreview" },
  { name: "github-app-installation-review", description: "Review one installation webhook packet against local project bindings before persisting it", handlerKey: "runGithubAppInstallationReview" },
  { name: "github-app-installation-apply", description: "Persist one installation webhook packet into the local installation registry", handlerKey: "runGithubAppInstallationApply" },
  { name: "github-app-installation-governance-review", description: "Review the current governance suggestion for one installation or project scope", handlerKey: "runGithubAppInstallationGovernanceReview" },
  { name: "github-app-installation-governance-apply", description: "Persist installation-level governance before multi-repo scope and handoff", handlerKey: "runGithubAppInstallationGovernanceApply" },
  { name: "github-app-installation-runtime-review", description: "Review the suggested runtime mode for one governed installation before app operations continue", handlerKey: "runGithubAppInstallationRuntimeReview" },
  { name: "github-app-installation-runtime-apply", description: "Persist installation runtime policy before scope, handoff and service behavior", handlerKey: "runGithubAppInstallationRuntimeApply" },
  { name: "github-app-installation-operations-review", description: "Review installation-level watchlist/service operations readiness before unattended app behavior", handlerKey: "runGithubAppInstallationOperationsReview" },
  { name: "github-app-installation-operations-apply", description: "Persist installation operations policy so app runtime behavior is governed per installation", handlerKey: "runGithubAppInstallationOperationsApply" },
  { name: "github-app-installation-service-lane-review", description: "Review installation-scoped service lanes and queue pressure before shared service ticks run", handlerKey: "runGithubAppInstallationServiceLaneReview" },
  { name: "github-app-installation-service-lane-apply", description: "Persist installation-scoped service lanes so shared service ticks honor concurrency and lane mode", handlerKey: "runGithubAppInstallationServiceLaneApply" },
  { name: "github-app-installation-service-plan-review", description: "Review installation-scoped shared service priorities and budgets across the current queue", handlerKey: "runGithubAppInstallationServicePlanReview" },
  { name: "github-app-installation-service-plan-apply", description: "Persist installation-scoped shared service plan so service ticks prioritize installations intentionally", handlerKey: "runGithubAppInstallationServicePlanApply" },
  { name: "github-app-installation-service-schedule-review", description: "Review scheduler-scoped runtime lanes and worker grouping across governed installations", handlerKey: "runGithubAppInstallationServiceScheduleReview" },
  { name: "github-app-installation-service-schedule-apply", description: "Persist scheduler-scoped runtime schedule so shared service ticks can run lane-specific worker paths", handlerKey: "runGithubAppInstallationServiceScheduleApply" },
  { name: "github-app-installation-worker-routing-review", description: "Review installation-scoped worker routing and scheduler lanes for shared service workers", handlerKey: "runGithubAppInstallationWorkerRoutingReview" },
  { name: "github-app-installation-worker-routing-apply", description: "Persist installation-scoped worker routing so service ticks respect worker affinity and scheduler lanes", handlerKey: "runGithubAppInstallationWorkerRoutingApply" },
  { name: "github-app-installation-scope", description: "Review which installation repositories are watchlist-ready versus still manual-review", handlerKey: "runGithubAppInstallationScope" },
  { name: "github-app-installation-handoff", description: "Hand off installation-scoped watchlist candidates into mapped project watchlists", handlerKey: "runGithubAppInstallationHandoff" },
  { name: "github-app-installation-show", description: "Show the current local GitHub App installation registry", handlerKey: "runGithubAppInstallationShow" },
  { name: "github-app-webhook-preview", description: "Preview one GitHub webhook delivery as a verified local envelope and mapped Patternpilot route", handlerKey: "runGithubAppWebhookPreview" },
  { name: "github-app-webhook-route", description: "Build a concrete command-oriented route plan from one verified webhook envelope", handlerKey: "runGithubAppWebhookRoute" },
  { name: "github-app-webhook-dispatch", description: "Turn a verified webhook route into a controlled local dispatch plan and optionally execute ready steps", handlerKey: "runGithubAppWebhookDispatch" },
  { name: "github-app-execution-enqueue", description: "Queue an execution, resume or recovery contract for the local GitHub App service loop", handlerKey: "runGithubAppExecutionEnqueue" },
  { name: "github-app-execution-run", description: "Consume an execution contract and run it through the separate local runner layer", handlerKey: "runGithubAppExecutionRun" },
  { name: "github-app-execution-recover", description: "Evaluate a recovery contract and continue execution once retry/backoff policy allows it", handlerKey: "runGithubAppExecutionRecover" },
  { name: "github-app-execution-resume", description: "Consume a resume contract and continue a previously interrupted runner flow", handlerKey: "runGithubAppExecutionResume" },
  { name: "github-app-service-review", description: "Review blocked, dead-letter or claimed service contracts before manual release", handlerKey: "runGithubAppServiceReview" },
  { name: "github-app-service-requeue", description: "Manually release blocked, dead-letter or claimed contracts back to pending", handlerKey: "runGithubAppServiceRequeue" },
  { name: "github-app-service-runtime-closeout-review", description: "Review the final runtime closeout status against the Road-to-100 completion bar", handlerKey: "runGithubAppServiceRuntimeCloseoutReview" },
  { name: "github-app-service-runtime-control-review", description: "Review the final combined runtime control surface across ops, integrity and maintenance", handlerKey: "runGithubAppServiceRuntimeControlReview" },
  { name: "github-app-service-runtime-maintenance-review", description: "Review safe runtime maintenance actions such as reclaiming stale claims and surfacing manual follow-up", handlerKey: "runGithubAppServiceRuntimeMaintenanceReview" },
  { name: "github-app-service-runtime-maintenance-apply", description: "Apply safe runtime maintenance actions such as reclaiming expired queue and runtime claims", handlerKey: "runGithubAppServiceRuntimeMaintenanceApply" },
  { name: "github-app-service-runtime-integrity-review", description: "Validate consistency across queue, claims, histories, receipts and referenced runtime artifacts", handlerKey: "runGithubAppServiceRuntimeIntegrityReview" },
  { name: "github-app-service-runtime-ops-review", description: "Review the full GitHub App service runtime health across queue, claims, histories and recovery lanes", handlerKey: "runGithubAppServiceRuntimeOpsReview" },
  { name: "github-app-service-runtime-cycle-review", description: "Preview a multi-round worker runtime cycle across the current runtime queue", handlerKey: "runGithubAppServiceRuntimeCycleReview" },
  { name: "github-app-service-runtime-cycle-run", description: "Run multiple worker runtime rounds until no dispatchable runtime remains or the cycle limit is reached", handlerKey: "runGithubAppServiceRuntimeCycleRun" },
  { name: "github-app-service-runtime-loop-review", description: "Preview a longer-lived runtime loop that chains multiple runtime sessions together", handlerKey: "runGithubAppServiceRuntimeLoopReview" },
  { name: "github-app-service-runtime-loop-run", description: "Run a longer-lived runtime loop across multiple runtime-session rounds", handlerKey: "runGithubAppServiceRuntimeLoopRun" },
  { name: "github-app-service-runtime-loop-resume", description: "Resume a paused runtime loop from its emitted resume contract", handlerKey: "runGithubAppServiceRuntimeLoopResume" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-review", description: "Preview a multi-round recovery-runtime cycle across persisted loop recovery receipts", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-run", description: "Run multiple worker- and lane-aware recovery-runtime rounds until the cycle drains or reaches its limit", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRun" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-resume", description: "Resume a paused recovery-runtime cycle from its emitted resume contract", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleResume" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-history-review", description: "Review persisted recovery-runtime cycle history and resumable recent cycles", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleHistoryReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-receipts-review", description: "Review persisted recovery-runtime cycle receipts and resumable cycle work", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-auto-resume", description: "Auto-select and resume the best open recovery-runtime cycle receipt", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleAutoResume" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-review", description: "Review cross-family worker-pool coordination across open recovery-runtime cycle families", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-apply", description: "Persist cross-family coordination holds for conflicting recovery-runtime cycle families", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationApply" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-review", description: "Review group-level backpressure across multiple coordination conflict groups", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-apply", description: "Persist group-level backpressure so lower-priority coordination groups wait", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureApply" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-followup-review", description: "Review whether coordination-group backpressure should be auto-released, refreshed or escalated", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-followup-apply", description: "Apply auto-release, refresh or escalation follow-ups for coordination-group backpressure", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupApply" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-history-review", description: "Review persisted history for coordination-group backpressure apply and follow-up runs", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-auto-followup", description: "Auto-apply the highest-priority due follow-ups for coordination-group backpressure", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureAutoFollowup" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-review", description: "Preview a long-running coordination-group backpressure loop before it starts applying session work", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-run", description: "Run multiple coordination-group backpressure sessions across one long-running loop", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRun" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-resume", description: "Resume a paused coordination-group backpressure loop from its emitted resume contract", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopResume" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-history-review", description: "Review persisted history for long-running coordination-group backpressure loops", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-recovery-review", description: "Review the best recovery candidates across persisted coordination-group backpressure loops", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-recover", description: "Recover a coordination-group backpressure loop from its emitted recovery contract", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecover" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session-review", description: "Preview a multi-round coordination-group backpressure session before it starts applying cycle work", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session-run", description: "Run multiple coordination-group backpressure cycle rounds across one session", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionRun" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session-resume", description: "Resume a paused coordination-group backpressure session from its emitted resume contract", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionResume" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle-review", description: "Preview a multi-pass coordination-group backpressure cycle before it starts applying due follow-ups", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle-run", description: "Run multiple coordination-group backpressure follow-up passes until the cycle drains or hits its limit", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleRun" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle-resume", description: "Resume a paused coordination-group backpressure cycle from its emitted resume contract", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleResume" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-followup-review", description: "Review whether coordination holds should be auto-released or escalated", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-followup-apply", description: "Apply auto-release or escalation follow-ups for existing coordination holds", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupApply" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance-review", description: "Review stored worker-family holds, backpressure and budgets across recovery-runtime cycle families", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance-apply", description: "Persist suggested worker-family governance for recovery-runtime cycle families", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceApply" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance-release-review", description: "Review which worker-family governance entries would be released back into the ready pool", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleaseReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance-release", description: "Release held or throttled worker-family governance entries back into the ready pool", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceRelease" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-review", description: "Review worker-family-aware planning across open recovery-runtime cycle receipts", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-run", description: "Run multiple recovery-runtime cycle resumes grouped by worker family", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeRun" },
  { name: "github-app-service-runtime-loop-recovery-runtime-review", description: "Review worker- and lane-aware runtime-loop recovery planning across persisted recovery receipts", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeReview" },
  { name: "github-app-service-runtime-loop-recovery-runtime-run", description: "Run multiple dispatch-ready runtime-loop recoveries through a worker-scoped recovery runtime plan", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryRuntimeRun" },
  { name: "github-app-service-runtime-loop-recovery-auto", description: "Auto-select and recover the best open runtime-loop recovery receipt", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryAuto" },
  { name: "github-app-service-runtime-loop-recovery-receipts-release-review", description: "Review which blocked or exhausted runtime-loop recovery receipts would be released", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryReceiptsReleaseReview" },
  { name: "github-app-service-runtime-loop-recovery-receipts-release", description: "Release blocked or exhausted runtime-loop recovery receipts back into the open pool", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryReceiptsRelease" },
  { name: "github-app-service-runtime-loop-recovery-receipts-review", description: "Review persisted runtime-loop recovery receipts and open recovery work", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryReceiptsReview" },
  { name: "github-app-service-runtime-loop-recover", description: "Recover a runtime loop through its emitted loop recovery contract", handlerKey: "runGithubAppServiceRuntimeLoopRecover" },
  { name: "github-app-service-runtime-loop-recovery-review", description: "Review loop-level runtime recovery candidates and recovery contracts", handlerKey: "runGithubAppServiceRuntimeLoopRecoveryReview" },
  { name: "github-app-service-runtime-loop-history-review", description: "Review persisted runtime-loop history, resumable loops and recent stop reasons", handlerKey: "runGithubAppServiceRuntimeLoopHistoryReview" },
  { name: "github-app-service-runtime-session-review", description: "Preview a longer-lived runtime session that chains multiple runtime cycles together", handlerKey: "runGithubAppServiceRuntimeSessionReview" },
  { name: "github-app-service-runtime-session-run", description: "Run a longer-lived runtime session across multiple runtime-cycle rounds", handlerKey: "runGithubAppServiceRuntimeSessionRun" },
  { name: "github-app-service-runtime-session-resume", description: "Resume a paused runtime session from its emitted resume contract", handlerKey: "runGithubAppServiceRuntimeSessionResume" },
  { name: "github-app-service-runtime-review", description: "Review worker-scoped runtime assignment across scheduler lanes in the local service queue", handlerKey: "runGithubAppServiceRuntimeReview" },
  { name: "github-app-service-runtime-run", description: "Run dispatch-ready worker runtimes through assigned lane-scoped service ticks", handlerKey: "runGithubAppServiceRuntimeRun" },
  { name: "github-app-service-scheduler-review", description: "Review scheduler-scoped runtime lanes across the current local service queue", handlerKey: "runGithubAppServiceSchedulerReview" },
  { name: "github-app-service-scheduler-run", description: "Run dispatch-ready scheduler lanes through lane-scoped local service ticks", handlerKey: "runGithubAppServiceSchedulerRun" },
  { name: "github-app-service-tick", description: "Process queued GitHub App runner contracts through a small local service loop", handlerKey: "runGithubAppServiceTick" },
  { name: "discover", description: "Search GitHub heuristically for project-fit repos before intake", handlerKey: "runDiscover" },
  { name: "discover-import", description: "Build a discovery run from an imported candidate JSON fixture", handlerKey: "runDiscoverImport" },
  { name: "init-project", description: "Bind a new local repo/workspace project to Patternpilot", handlerKey: "runInitProject" },
  { name: "init-env", description: "Create local env files from checked-in examples", handlerKey: "runInitEnv" },
  { name: "discover-workspace", description: "Scan workspace roots for git repos and binding candidates", handlerKey: "runDiscoverWorkspace" },
  { name: "list-projects", description: "Show configured Patternpilot project bindings", handlerKey: "printProjectList" },
  { name: "intake", description: "Create intake queue entries and dossiers from GitHub URLs", handlerKey: "runIntake" },
  { name: "promote", description: "Prepare or apply promotion candidates from queue to curated artifacts", handlerKey: "runPromote" },
  { name: "re-evaluate", description: "Refresh stale or fallback decision data in queue and intake docs", handlerKey: "runReEvaluate" },
  { name: "refresh-context", description: "Refresh STATUS.md and OPEN_QUESTION.md", handlerKey: "runRefreshContext" },
  { name: "review-watchlist", description: "Compare watchlist-backed intake repos against the target project", handlerKey: "runReviewWatchlist" },
  { name: "setup-checklist", description: "Show exactly which secrets or IDs are still needed and where to find them", handlerKey: "runSetupChecklist" },
  { name: "sync-all-watchlists", description: "Run watchlist intake across all configured projects", handlerKey: "runSyncAllWatchlists" },
  { name: "sync-watchlist", description: "Run intake against the configured project watchlist file", handlerKey: "runSyncWatchlist" },
  { name: "show-project", description: "Show the binding and reference context for a project", handlerKey: "runShowProject" },
  { name: "automation-alerts", description: "Show blocked/backoff automation jobs and recommended next action", handlerKey: "runAutomationAlerts" },
  { name: "automation-job-ack", description: "Acknowledge a latched dispatch escalation for a named automation job", handlerKey: "runAutomationJobAck" },
  { name: "automation-job-clear", description: "Clear scheduler state for a named automation job", handlerKey: "runAutomationJobClear" }
];

const COMMAND_MAP = new Map(COMMANDS.map((command) => [command.name, command]));
const ALIAS_MAP = new Map(
  COMMANDS.flatMap((command) => (command.aliases ?? []).map((alias) => [alias, command.name]))
);

const HELP_EXAMPLES = [
  "npm run patternpilot -- getting-started",
  "npm run bootstrap -- --project my-project --target ../my-project --label \"My Project\"",
  "npm run analyze -- --project my-project https://github.com/example/repo",
  "npm run patternpilot -- discover --project my-project --discovery-profile balanced --dry-run",
  "npm run patternpilot -- review-watchlist --project my-project --dry-run",
  "npm run patternpilot -- policy-control --project my-project",
  "npm run patternpilot -- product-readiness",
  "npm run validate:cohort",
  "npm run patternpilot -- on-demand --project my-project --analysis-profile architecture",
  "npm run patternpilot -- automation-jobs",
  "npm run patternpilot -- automation-alerts",
  "npm run patternpilot -- automation-alert-deliver --target file --file state/automation_alerts_published.md",
  "npm run doctor -- --offline",
  "npm run patternpilot -- github-app-readiness",
  "npm run patternpilot -- github-app-event-preview --event-key installation.created --file deployment/github-app/examples/installation.created.json --dry-run",
  "npm run patternpilot -- refresh-context",
  "npm run init:env",
  "npm run init:project -- --project sample-worker --target ../sample-worker --label \"Sample Worker\"",
  "npm run discover:workspace",
  "npm run setup:checklist",
  "npm run sync:all -- --dry-run",
  "npm run patternpilot -- sync-watchlist --project my-project --dry-run",
  "npm run intake -- --project my-project --file links.txt --dry-run",
  "npm run patternpilot -- promote --project my-project --from-status pending_review",
  "npm run show:project -- --project my-project"
];

function padCommandName(name, width) {
  return name.padEnd(width, " ");
}

function categorizeCommand(command) {
  if (
    command.name === "bootstrap"
    || command.name === "getting-started"
    || command.name === "doctor"
    || command.name === "init-project"
    || command.name === "discover-workspace"
    || command.name === "list-projects"
    || command.name === "show-project"
    || command.name === "setup-checklist"
    || command.name === "init-env"
  ) {
    return "Start Here";
  }
  if (
    command.name === "intake"
    || command.name === "on-demand"
    || command.name === "discover"
    || command.name === "sync-watchlist"
    || command.name === "review-watchlist"
    || command.name === "promote"
    || command.name === "re-evaluate"
  ) {
    return "Core Workflow";
  }
  if (
    command.name.startsWith("policy-")
    || command.name.startsWith("run-")
    || command.name.startsWith("automation-")
    || command.name === "product-readiness"
    || command.name === "validate-cohort"
  ) {
    return "Operations";
  }
  if (command.name.startsWith("github-app-")) {
    return "Advanced GitHub App";
  }
  return "Other";
}

export function listPatternpilotCommands() {
  return COMMANDS.map((command) => ({ ...command }));
}

export function resolvePatternpilotCommandName(commandName) {
  if (!commandName) {
    return null;
  }
  return ALIAS_MAP.get(commandName) ?? commandName;
}

export function getPatternpilotCommand(commandName) {
  const resolvedName = resolvePatternpilotCommandName(commandName);
  return resolvedName ? COMMAND_MAP.get(resolvedName) ?? null : null;
}

export function renderPatternpilotHelp() {
  const width = Math.max(...COMMANDS.map((command) => command.name.length)) + 2;
  const grouped = new Map();
  for (const command of COMMANDS) {
    const category = categorizeCommand(command);
    const lines = grouped.get(category) ?? [];
    lines.push(`  ${padCommandName(command.name, width)}${command.description}`);
    grouped.set(category, lines);
  }
  const groupOrder = ["Start Here", "Core Workflow", "Operations", "Advanced GitHub App", "Other"];
  const sections = groupOrder
    .filter((group) => grouped.has(group))
    .map((group) => `${group}:\n${grouped.get(group).join("\n")}`)
    .join("\n\n");

  return `Patternpilot CLI

Quick start:
  npm run getting-started
  npm run bootstrap -- --project my-project --target ../my-project --label "My Project"

${sections}

Examples:
  ${HELP_EXAMPLES.join("\n  ")}
`;
}
