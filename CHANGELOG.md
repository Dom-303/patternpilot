# Changelog

All notable changes to this project will be documented in this file.

The format is intentionally simple and release-oriented.

## [0.4.0] - 2026-04-29

### Added

- **Stale-data banner** at start of `intake` and `on-demand` runs — shows count, top drift reasons, example URLs, and the concrete refresh command. Resolves OQ-007's user-visibility gap.
- **Re-evaluate audit log** in `state/re-evaluate-history.json` — every re-evaluate run records what was refreshed, when, and why.
- **Webhook alert channel** alongside file / github-summary / command / stdout — POSTs JSON to a configurable URL, compatible with Slack / Discord / Teams Inbound Webhooks.
- **Auto-resume for stuck automation jobs** — jobs locked longer than 6h (configurable per job via `autoResumeMinutes`, opt-out via `0`) are released automatically when `automation-jobs` runs. Resolves OQ-008's recovery gap.

### Notes

- All four additions reuse existing infrastructure — no new subsystems introduced.
- Stale-banner can be silenced per call with `--skip-stale-banner` (used internally where banner would be noise).
- Webhook delivery failures are logged but do not break the run.

## [0.3.0] - 2026-04-29

### Added

- **`patternpilot init` — interactive 5-step onboarding wizard** as the new headline first-run experience. Replaces the static `getting-started` text-print in TTY mode (text-print remains as `init --print` for CI). Resolves OQ-006.
  - Step 1: Auto-scan parents/home for git repos, top 3 by mtime
  - Step 2: Detect label, language, context files, and watchlist seed from `package.json#dependencies`
  - Step 3: GitHub auth via gh CLI, Personal Access Token (4 micro-steps with diagnostics), or skip
  - Step 4: Discovery profile (balanced / focused)
  - Step 5: Optional first action — intake URL, discover, or define a problem and explore landscape
- **Re-run menu** when wizard is invoked against existing config: add project, edit, re-auth, set default, cancel
- **Auto-trigger**: any patternpilot command without configured projects in TTY prompts "Setup jetzt starten? [Y/n]"
- WSL2 browser-open via `wslview` with `xdg-open` fallback
- Wizard `--replay <file>` mechanism for scripted/CI testing

### Fixed

- Wizard now actually creates the project (config + bindings + projects) — v0.2.x had a UI walkthrough that recorded choices but never called `runBootstrap`
- Wizard now actually dispatches first-action and re-run intents (intake/discover/problem/set-default) instead of only recording them
- Prompter handles Ctrl+D / EOF cleanly (rejects pending resolvers instead of hanging)
- Prompter pauses while `gh auth login` runs to avoid stdin race
- Token file enforces `mode 0o600` even on overwrite

### Changed

- `getting-started` and `first-run` are now aliases for `init`
- README onboarding section points at the wizard
- `lib/queue.mjs` — OQ-006 marked resolved; `next_recommended_step` updated to mention wizard observation

## [0.2.0] - 2026-04-26

### Added

- public release package allowlist for npm distribution
- refreshed README image assets and clearer public onboarding surface
- report UI hardening for discovery and landscape templates
- scoring, clustering and stability improvements through the Phase 0-7 hardening work
- release smoke coverage for package metadata and HTML renderer behavior

### Changed

- product-readiness defaults to the configured default project, with `--all-projects` still available for broader local checks
- release documentation consistently uses the committed MIT license
- npm package metadata is aligned for publication without local workspace artifacts

### Notes

- This is the first public GitHub/npm release prepared from the current product state.
- The older `v0.1.0` tag remains the internal pre-public preparation point.

## [0.1.0] - 2026-04-18

### Added

- public onboarding surface with `getting-started`, `bootstrap` and guided GitHub token setup
- clean workspace split between `bindings/`, `projects/`, `runs/` and `state/`
- simple, advanced and public-vs-local documentation tracks
- product-readiness, release checklist and `v1` closeout documentation
- visual onboarding and workflow assets in `assets/`
- neutral demo example instead of active dogfood defaults
- authenticated foreign-project pilot closeout evidence

### Changed

- public repo surface now starts from an empty default instead of an active project binding
- local runtime artifacts and project run outputs are more clearly excluded from version control
- README now presents a quick-view, workflow overview and clearer onboarding path
- GitHub auth guidance now reports clearer token states like `token_verified`

### Notes

- This is the first intentional open-source release of `patternpilot`.
- The product is local-first and intentionally keeps runtime state out of the public source tree.
