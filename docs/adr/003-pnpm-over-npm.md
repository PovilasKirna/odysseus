# ADR-003: pnpm over npm (or yarn)

**Status:** Proposed  
**Date:** 2026-06-02

## Decision

Use pnpm as the JavaScript package manager. Do not use npm or yarn.

## Context

Odysseus is an AI workspace that will attract contributors using AI-assisted code generation. Supply chain security and dependency isolation are real concerns — a malicious or misconfigured `postinstall` script in a transitive dependency can execute arbitrary code during `npm install`. The project also needs consistent, reproducible installs across contributor machines and CI.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| **npm** | Runs install scripts by default — a supply chain attack vector. Slower installs, no strict dependency isolation (phantom dependencies: code can import packages it didn't declare). |
| **yarn (classic)** | Same phantom dependency problem as npm. Mostly superseded. |
| **yarn berry (PnP)** | Strict isolation, but Plug'n'Play mode breaks many tools and requires extensive configuration to work with shadcn/ui, TanStack, and Vite. Not worth the friction. |
| **Bun** | See ADR-002 — compatibility edge cases make it unsuitable as a primary package manager for this project right now. |

## Consequences

- `pnpm install` blocks install scripts by default — contributors must explicitly opt in to run them, which surfaces supply chain risks before they execute
- Strict dependency isolation: code can only import packages it explicitly declared, preventing phantom dependency bugs
- Installs are significantly faster than npm due to content-addressable storage
- `pnpm-lock.yaml` replaces `package-lock.json` — both must never be committed with manual edits
- CI uses `pnpm install --frozen-lockfile` to guarantee reproducibility
