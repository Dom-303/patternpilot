# Changelog

All notable changes to this project will be documented in this file.

The format is intentionally simple and release-oriented.

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
