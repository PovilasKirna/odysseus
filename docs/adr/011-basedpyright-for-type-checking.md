# ADR-011: basedpyright for Python static type checking

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Add basedpyright as the Python static type checker. It runs separately from ruff — ruff handles style and lint, basedpyright handles type correctness.

## Context

Odysseus has no Python type checker today. As a result, type mismatches between layers (a route handler passing the wrong type to a service, a service returning `None` where a caller expects a value) are only caught at runtime — often in production or during a user report. The codebase uses Pydantic models extensively, which gives a strong foundation for type checking, but only if a type checker is actually running.

The standard Microsoft tool for Python type checking is Pylance, which powers VS Code's Python IntelliSense. However, Pylance is proprietary and only available through the official Microsoft VS Code marketplace. Many contributors to Odysseus are likely using VS Code forks (Cursor, VS Codium, Windsurf) where Pylance cannot be installed.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **Pylance / Pyright (Microsoft)** | Pylance is proprietary — only available in official VS Code, not in forks. Pyright (the open-source base) works as a CLI but the VS Code extension experience is inferior in forks. basedpyright is a drop-in replacement with a better open-source extension. |
| **mypy** | The original Python type checker. Slower than Pyright/basedpyright, especially in incremental mode. Plugin ecosystem is more complex. basedpyright gives faster feedback with comparable rule coverage. |
| **pytype (Google)** | Linux-only. Not viable for contributors on macOS or Windows. |
| **No type checker** | Status quo. Type errors are caught only at runtime. Not acceptable as the codebase grows and contributor count increases. |

## Consequences

- basedpyright catches type errors before the code runs — a route passing the wrong type to a service is a CI failure, not a user-facing bug
- Works as a VS Code extension (`ms-pyright.basedpyright`) in all VS Code forks — the same experience for Cursor, Windsurf, and VS Codium users as for official VS Code users
- Configured in `pyproject.toml`:
  ```toml
  [tool.basedpyright]
  pythonVersion = "3.11"
  typeCheckingMode = "standard"
  ```
- `typeCheckingMode = "standard"` is intentionally not `"strict"` — the existing codebase has many untyped functions and adding strict mode would produce thousands of errors. Standard mode catches the real bugs without drowning contributors in noise. Tighten incrementally as coverage improves.
- Initial run will surface existing type errors — these should be fixed in a separate PR, not mixed with the tooling setup commit
- **Abandonment risk:** basedpyright is a community fork of Microsoft's pyright. If the project is abandoned, the fallback is pyright directly — the CLI flags, `pyproject.toml` config keys, and type inference behaviour are compatible. The migration is a one-line change (`basedpyright` → `pyright` in CI and `pyproject.toml`). This risk is low given the fork's active maintenance, but worth acknowledging.
