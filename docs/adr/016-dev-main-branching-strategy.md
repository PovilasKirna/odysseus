# ADR-016: dev/main branching strategy

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Introduce a `dev` branch as the integration target for all feature and fix PRs. `main` becomes the stable release branch — only `dev` merges into it, not individual feature PRs. Commit messages must follow the Conventional Commits format. Tags on `main` trigger automated `CHANGELOG.md` generation.

## Context

Currently all PRs merge directly to `main`. With the project growing rapidly and many contributors submitting simultaneously, this has visible consequences: broken features land on `main` before anyone notices, there is no integration buffer to catch conflicts between PRs, and there is no point in the history that is known-stable enough to call a release.

A `dev`/`main` split is the minimum branching structure that addresses this — it is well understood by contributors of all experience levels, requires no tooling beyond a GitHub branch protection rule, and gives the maintainer a staging area to review before anything reaches `main`.

Conventional Commits is adopted alongside the branching strategy because it is a prerequisite for automated changelog generation. Without a consistent commit format, `git-cliff` and similar tools cannot reliably classify changes as features, fixes, or chores. The format is lightweight enough to not impose meaningful overhead on contributors.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **Keep merging directly to `main`** | Status quo. Already causing instability. No integration buffer. No concept of a stable release point. |
| **Gitflow (main / develop / release / hotfix / feature)** | Appropriate for projects with scheduled versioned releases. Odysseus is a continuously-deployed self-hosted app — the full Gitflow model adds branching overhead with no clear benefit at this stage. |
| **Trunk-based development (no long-lived branches)** | Requires a mature CI/CD pipeline, feature flags, and a culture of small commits. The contributor base is too distributed and the CI infrastructure too early for this to work safely right now. Worth revisiting once the CI gate (ADR-017) is in place. |
| **`main` + `staging` naming** | Functionally identical to `dev`/`main`. `dev` is the more widely recognised convention and matches what contributors expect. |
| **semantic-release over git-cliff** | `semantic-release` automates version bumping and publishing in addition to changelog generation — more than needed here. `git-cliff` generates the changelog only, leaving release tagging in the maintainer's hands. |

## Consequences

- All feature and fix PRs target `dev`, not `main`
- `main` only receives merges from `dev` — typically when the maintainer decides a batch of changes is stable enough to ship
- Branch protection on `dev`: CI must be green and at least one review required before merge
- Branch protection on `main`: only `dev` can be merged in; no direct pushes
- `CODEOWNERS` assigns automatic reviewers to structural areas so PRs to `dev` are not left waiting — see #593
- Contributors who accidentally open a PR against `main` receive a clear message redirecting them to `dev`
- Hotfixes for critical bugs can branch from `main` and merge to both `main` and `dev` — this is the one exception to the "target `dev`" rule
- Commit messages must follow Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:` — a pre-commit hook (see ADR-009) enforces the format locally
- On each tag push to `main`, a CI step runs `git-cliff` to regenerate `CHANGELOG.md` and commits it to `main` — no manual release notes required
