# ADR-009: uv over pip / requirements.txt

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Replace `requirements.txt` and pip with `uv` and `pyproject.toml` as the Python package manager and dependency format.

## Context

The current setup uses `requirements.txt` with pip. This has no lockfile, no dev dependency separation, no reproducible installs, and no standard place for tool configuration (ruff, pytest, basedpyright). As the contributor count grows, "it works on my machine" dependency issues become increasingly common. A lockfile is the minimum bar for a project expecting many contributors.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **pip + pip-tools** | Adds a lockfile (`requirements.txt` → `requirements.lock`) but still requires a separate tool, separate workflow, and manual pinning. No tool config in `pyproject.toml`. |
| **Poetry** | Mature and widely used, but slower than uv, uses a non-standard lockfile format, and has known resolver issues with complex dependency trees. |
| **Pipenv** | Largely superseded. Resolver is slow, lockfile format not widely supported by other tools. |
| **conda** | Appropriate for data science environments with binary packages. Overkill for a web app backend; unusual for FastAPI projects. |
| **Keep requirements.txt** | No reproducibility, no lockfile, no dev dependency separation, no tool config standard. Does not scale past a handful of contributors. |

## Consequences

- `uv sync` installs from the lockfile — reproducible across all machines and CI
- `uv add <package>` adds a dependency and updates both `pyproject.toml` and `uv.lock` atomically
- `pyproject.toml` becomes the single source of truth for deps, dev deps, and tool config (ruff, pytest, basedpyright)
- `uv.lock` must be committed and must not be hand-edited
- The migration is a one-time formatting-only commit: `uv init`, copy deps from `requirements.txt`, run `uv lock` — no behavior change
- Docker images install via `uv sync --no-dev` in the production layer
