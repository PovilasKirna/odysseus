# ADR-001: Three-layer backend — routes, services, core

**Status:** Accepted  
**Date:** 2026-06-02

## Decision

Separate the backend into three distinct layers with strict import rules: `routes/` for HTTP handling, `services/` for business logic, and `core/` for shared infrastructure.

## Context

As Odysseus grew quickly, business logic began leaking into route handlers, and it became unclear where new code should go. The codebase has three overlapping directories (`routes/`, `services/`, and a partial `src/`) with no enforced boundary between them. Contributors adding new features have no clear rule for where logic belongs, which leads to handlers that are hard to test and review, and services that import from routes.

Without a documented layer contract, every new contributor re-derives the structure from context — or doesn't, and adds to the confusion.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| Single-layer monolith (everything in `app.py` or one directory) | Does not scale. Already caused problems at the current codebase size. |
| Domain-driven folders (all calendar code — routes, services, models — in one `calendar/` directory) | Correct long-term direction but premature to enforce before the codebase is stabilized. Tracked as a future step in [#605](https://github.com/pewdiepie-archdaemon/odysseus/issues/605). |
| No convention, contributor discretion | Status quo. Already demonstrably causing merge conflicts and inconsistent code placement. |

## Consequences

- Route handlers become shorter and easier to review — max ~20 lines, no embedded logic.
- Business logic is testable in isolation via `services/` without spinning up HTTP.
- `core/` stays domain-agnostic — new contributors know what belongs there and what doesn't.
- A follow-up PR (tracked in [#605](https://github.com/pewdiepie-archdaemon/odysseus/issues/605)) will physically reorganize files to match this contract more precisely — renaming `routes/` → `api/` and consolidating `src/` into `services/`. That PR is separate and depends on maintainer approval.
