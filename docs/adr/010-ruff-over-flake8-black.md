# ADR-010: ruff over flake8 + black + isort

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Use ruff for Python linting and formatting. Do not use flake8, black, isort, or pylint as separate tools.

## Context

The current codebase has no enforced Python linting or formatting. As contributor count grows, inconsistent style and avoidable lint issues accumulate in PRs and make diffs harder to review. The standard Python toolchain uses multiple separate tools (flake8 for lint, black for formatting, isort for import sorting) — each with its own config, its own pre-commit hook, and its own CI step.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **flake8 + black + isort** | Three tools to configure and maintain. Known conflicts between black and isort on import formatting. Each needs a separate pre-commit hook and CI step. All are significantly slower than ruff. |
| **pylint** | Extremely slow on large codebases. Very opinionated rule set with a high false positive rate. Difficult to configure to a useful signal-to-noise ratio. |
| **pycodestyle (pep8) alone** | Style-only, no semantic lint rules. Insufficient. |
| **autopep8** | Formatting only. Doesn't replace lint. |

## Consequences

- One tool configured entirely in `pyproject.toml` under `[tool.ruff]`
- `ruff check .` for lint, `ruff format .` for formatting — replaces flake8, black, and isort in a single binary
- ruff is written in Rust — runs ~10–100x faster than flake8 + black on the same codebase
- Covers pyflakes (F), pycodestyle (E), isort (I), and pyupgrade (UP) rules out of the box
- One pre-commit hook, one CI step
- Initial formatting commit will touch many files — should be a standalone commit with no logic changes, clearly labeled (e.g. `chore: apply ruff format across codebase`)
