# Changelog

All notable changes to this project will be documented in this file.

The format is intentionally simple and release-oriented.

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
