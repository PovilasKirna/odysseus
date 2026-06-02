# ADR-017: Testing strategy — three-tier layout, smoke tests, Vitest, coverage gate

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Adopt a three-tier test layout (`tests/unit/`, `tests/regression/`, `tests/integration/`). Prioritise route smoke tests via FastAPI `TestClient` as the first implementation step. Replace ad-hoc `node` invocations with Vitest for JavaScript. Enforce a coverage floor in CI once the smoke test layer exists.

## Context

The project has 27 test files covering security boundaries, regression locks, and pure utilities — a solid foundation for a project this size. But with 173+ Python files across `app.py`, `routes/`, `core/`, `services/`, and `src/`, the suite has not kept pace. There are no route-level integration tests, no structured JS test runner, and no CI coverage gate. A broken route can land on `main` without any test catching it.

The three-tier split exists already in spirit (some files are clearly regression locks, others are pure unit tests) but is not documented or enforced, so contributors don't know where to put new tests.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **Keep the flat `tests/` layout** | Works now but does not scale — contributors can't tell a regression lock from a utility test, so tests end up in random files and coverage is hard to report meaningfully. |
| **Full integration test suite first** | High up-front cost; blocks CI adoption until a large backlog is cleared. Smoke tests give 80% of the value for 20% of the effort. |
| **pytest only (no JS test runner)** | The repo already has `@antithesishq/bombadil` in `package.json` devDependencies and 40+ JS files with no structured tests. Piggybacking JS tests into Python `subprocess` calls (the current pattern) does not scale. |
| **Jest over Vitest** | Vitest is zero-config for ESM modules (which the frontend already uses), faster, and compatible with the same assertion API as Jest. No migration cost. |
| **100% coverage requirement** | Goodhart's Law — contributors write tests to hit the number, not to catch bugs. A floor of ~40% targets the genuinely untested areas without incentivising coverage gaming. |

## Consequences

- `tests/` is reorganised into three subdirectories: `unit/` (pure function tests, no I/O), `regression/` (pinned bug fixes, security gates), `integration/` (route-level, DB-touching tests)
- No existing files need to move immediately — document the intent in `CONTRIBUTING.md` and put new tests in the right place from here on
- A `tests/integration/test_routes_smoke.py` boots the app with an in-memory SQLite DB and hits every route with a valid auth token — this is the first PR to implement
- `vitest` replaces the raw `node --input-type=module` pattern; existing JS tests in `test_compare_js.py` and `test_recipe_recipients_js.py` migrate to `.test.js` files
- Once the smoke test layer exists, CI adds `--cov` with a 40% floor that blocks merges if coverage drops — the floor only ever goes up
- `@antithesishq/bombadil` is removed from `package.json` unless a concrete use case is identified; it is currently installed but unused
