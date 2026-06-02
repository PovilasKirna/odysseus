# ADR-013: Hierarchical CONTEXT.md files and minimal root AGENTS.md

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Replace a single monolithic `CLAUDE.md` / `AGENTS.md` with a minimal root `AGENTS.md` that acts as a pointer map, and per-domain `CONTEXT.md` files that each describe only the area of the codebase relevant to the current task.

## Context

As Odysseus grows, AI-assisted contributors will be a significant part of the contributor base. The standard practice is a single root-level `CLAUDE.md` or `AGENTS.md` that loads into every conversation. This has two failure modes as the codebase scales:

**Token waste:** An agent fixing a calendar sync bug loads rules about IMAP quirks, TanStack Query patterns, and tool security — none of which are relevant. On models with smaller context windows this crowds out the actual code being worked on.

**No record of why:** A contributor (human or AI) reading the code has no way to know whether a particular choice was intentional or accidental. Without that, settled decisions get re-litigated, and an AI assistant trained on general patterns will suggest reversing intentional choices (e.g. switching from pnpm to npm because npm is more common in its training data).

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **Single root `AGENTS.md` with all rules** | Loads all context on every task regardless of relevance. Does not scale past ~5 domains. |
| **Single `CLAUDE.md` with `@import` directives** | Some harnesses support this, but it is not universally supported and still requires maintaining one central file that grows over time. |
| **Wiki / external docs site** | Not loaded into context automatically. Requires contributors to know to look there. |
| **Inline comments only** | Comments explain what code does, not why architectural decisions were made. Cannot prevent an AI assistant from suggesting a change that reverses an intentional decision. |

## Consequences

- `AGENTS.md` at the root stays short (~30 lines) — project overview, pointer map to domain CONTEXT.md files, 3–5 global rules, and a pointer to `docs/adr/`
- Each domain (`backend/`, `frontend/`, `services/calendar/`, etc.) has its own `CONTEXT.md` describing how that area works and what the rules are
- `docs/adr/` records why decisions were made — CONTEXT.md files link to relevant ADRs so readers can follow the reasoning
- An agent working on a calendar bug reads `AGENTS.md` + `services/calendar/CONTEXT.md` only — irrelevant domains never load
- ADRs are immutable once accepted — if a decision changes, a new ADR supersedes the old one. This prevents silent reversal of intentional choices
- CI enforcement of CONTEXT.md presence (e.g. fail if a new service directory is added without one) is optional — start as convention, add enforcement if drift becomes a problem
