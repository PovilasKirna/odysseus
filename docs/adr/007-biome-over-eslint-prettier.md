# ADR-007: Biome over ESLint + Prettier

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Use Biome for JavaScript/TypeScript linting and formatting. Do not use ESLint and Prettier as separate tools.

## Context

The standard frontend toolchain uses ESLint for linting and Prettier for formatting — two separate tools with separate configs, separate plugins, and known conflicts between their formatting opinions. For a project that expects many contributors with varying setups, reducing the tooling surface area reduces the number of ways a contributor's environment can be misconfigured.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **ESLint + Prettier** | Two tools to configure, two sets of plugins to keep updated, known formatting conflicts between them (e.g. trailing commas, print width). CI must run both. A contributor with a misconfigured Prettier version passes lint but fails format checks. |
| **ESLint only (with formatting rules)** | ESLint formatting rules are slower and less principled than a dedicated formatter. Deprecated in ESLint v9+. |
| **dprint** | Less ecosystem adoption, fewer contributors familiar with it. Biome's linting coverage is broader. |
| **oxc** | Very fast but not yet production-ready as a complete replacement at time of writing. Biome has a more complete rule set. |

## Consequences

- One tool, one config file (`biome.json`), one command: `biome check --write .`
- Biome is written in Rust — runs significantly faster than ESLint + Prettier on large files
- Single pre-commit hook replaces two hooks
- CI runs one step instead of two
- Not 100% ESLint rule parity — some niche ESLint plugins have no Biome equivalent. If a specific rule is needed that Biome doesn't cover, open a focused issue rather than reverting to ESLint.
